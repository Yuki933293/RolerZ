"""
Persona Forge — FastAPI Backend
"""
from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from pydantic import BaseModel

# Ensure project root on path so persona_engine / database are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import database as db
from persona_engine import EngineConfig, PersonaEngine, PersonaSeed
from persona_engine.inspiration import InspirationLibrary
from persona_engine.llm import PROVIDER_DEFAULTS, create_llm_client, _PROVIDER_BASE_URLS
from persona_engine.wizard import REQUIRED_FIELDS, WizardEngine

# ── JWT config ──────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("JWT_SECRET", "persona-forge-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


# ── Provider metadata ──────────────────────────────────────────────────
PROVIDERS = {
    "claude":   {"name": "Claude",   "env_key": "ANTHROPIC_API_KEY"},
    "openai":   {"name": "OpenAI",   "env_key": "OPENAI_API_KEY"},
    "deepseek": {"name": "DeepSeek", "env_key": "DEEPSEEK_API_KEY"},
    "custom":   {"name": "自定义",  "env_key": ""},
}

PROVIDER_DEFAULT_URLS = {
    "claude": "https://api.anthropic.com",
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com",
    "custom": "",
}


# ── Pydantic models ────────────────────────────────────────────────────
class AuthRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str

class GenerateRequest(BaseModel):
    concept: str
    count: int = 3
    language: str = "zh"
    provider: str = "claude"
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    selected_inspirations: list[str] = []

class WizardStartRequest(BaseModel):
    concept: str
    provider: str = "claude"
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    count: int = 3
    language: str = "zh"

class WizardAnswerRequest(BaseModel):
    field: str
    answer: str

class CardOverrideRequest(BaseModel):
    custom_data: dict

class SaveGroupsRequest(BaseModel):
    groups: list[dict]

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class FetchModelsRequest(BaseModel):
    provider: str
    api_key: str = ""
    base_url: str = ""


# ── JWT helpers ─────────────────────────────────────────────────────────
def create_access_token(user_id: int, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "username": username, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM,
    )


def get_current_user(authorization: str | None = None) -> dict | None:
    """Extract user from Authorization header. Returns None if no valid token."""
    if not authorization:
        return None
    try:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {"user_id": int(payload["sub"]), "username": payload["username"]}
    except (JWTError, KeyError, ValueError):
        return None


# ── App ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield

app = FastAPI(title="Persona Forge", version="0.3.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth routes ─────────────────────────────────────────────────────────
@app.post("/api/auth/login", response_model=TokenResponse)
def login(req: AuthRequest):
    uid = db.authenticate(req.username, req.password)
    if uid is None:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_access_token(uid, req.username)
    return TokenResponse(access_token=token, username=req.username)


@app.post("/api/auth/register", response_model=TokenResponse)
def register(req: AuthRequest):
    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="密码至少 4 个字符")
    uid = db.create_user(req.username, req.password)
    if uid is None:
        raise HTTPException(status_code=409, detail="用户名已存在")
    token = create_access_token(uid, req.username)
    return TokenResponse(access_token=token, username=req.username)


# ── Provider routes ─────────────────────────────────────────────────────
@app.get("/api/providers")
def list_providers():
    result = []
    for pid, info in PROVIDERS.items():
        has_env = bool(os.environ.get(info["env_key"], "")) if info["env_key"] else False
        result.append({
            "id": pid,
            "name": info["name"],
            "env_key": info["env_key"],
            "has_env_key": has_env,
            "default_model": PROVIDER_DEFAULTS.get(pid, ""),
            "default_url": PROVIDER_DEFAULT_URLS.get(pid, ""),
        })
    return result


@app.post("/api/providers/models")
def fetch_models(req: FetchModelsRequest):
    try:
        if req.provider == "claude":
            import anthropic
            client = anthropic.Anthropic(
                api_key=req.api_key or os.environ.get("ANTHROPIC_API_KEY"),
                timeout=15,
            )
            result = client.models.list(limit=100)
            return sorted([m.id for m in result.data])
        else:
            import openai as _openai
            resolved_key = req.api_key or (
                os.environ.get("OPENAI_API_KEY") if req.provider == "openai"
                else os.environ.get("DEEPSEEK_API_KEY") if req.provider == "deepseek"
                else req.api_key
            )
            resolved_url = req.base_url or _PROVIDER_BASE_URLS.get(req.provider) or PROVIDER_DEFAULT_URLS.get(req.provider, "")
            client = _openai.OpenAI(api_key=resolved_key, base_url=resolved_url, timeout=15)
            result = client.models.list()
            return sorted([m.id for m in result.data])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"获取模型列表失败: {exc}")


# ── Inspiration cards ───────────────────────────────────────────────────
_cards_cache: list[dict] | None = None

def _load_cards() -> list[dict]:
    global _cards_cache
    if _cards_cache is not None:
        return _cards_cache
    lib = InspirationLibrary.load()
    cards = []
    for c in lib.cards:
        cards.append({
            "id": c.id,
            "title_zh": c.title.zh,
            "title_en": c.title.en,
            "category": c.category,
            "tags": c.tags,
            "prompt_zh": c.prompt_fragment.zh,
            "prompt_en": c.prompt_fragment.en,
            "snippets": {k: {"zh": v.zh, "en": v.en} for k, v in c.snippets.items()},
        })
    _cards_cache = cards
    return cards


@app.get("/api/cards")
def list_cards():
    return _load_cards()


@app.get("/api/cards/overrides")
def get_card_overrides(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        return {}
    return db.get_card_overrides(user["user_id"])


@app.put("/api/cards/{card_id}/override")
def save_card_override(
    card_id: str,
    req: CardOverrideRequest,
    authorization: str | None = Header(None),
):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    db.save_card_override(user["user_id"], card_id, req.custom_data)
    return {"ok": True}


@app.delete("/api/cards/{card_id}/override")
def delete_card_override(card_id: str, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    db.delete_card_override(user["user_id"], card_id)
    return {"ok": True}


# ── Card groups ─────────────────────────────────────────────────────────
@app.get("/api/cards/groups")
def get_card_groups(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        return []
    return db.get_card_groups(user["user_id"])


@app.put("/api/cards/groups")
def save_card_groups(req: SaveGroupsRequest, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    db.save_card_groups(user["user_id"], req.groups)
    return {"ok": True}


# ── User config ────────────────────────────────────────────────────
@app.get("/api/config")
def get_user_config(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    return db.get_user_config(user["user_id"])


@app.put("/api/config")
def save_user_config(req: dict, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    db.save_user_config(user["user_id"], req)
    return {"ok": True}


# ── Profile ────────────────────────────────────────────────────────────
@app.post("/api/auth/change-password")
def change_password(req: ChangePasswordRequest, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    if len(req.new_password) < 4:
        raise HTTPException(status_code=400, detail="密码至少 4 个字符")
    ok = db.change_password(user["user_id"], req.old_password, req.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="原密码错误")
    return {"ok": True}


@app.get("/api/profile/stats")
def get_profile_stats(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    stats = db.get_user_stats(user["user_id"])
    stats["username"] = user["username"]
    return stats


@app.get("/api/profile/history")
def get_history(authorization: str | None = Header(None), limit: int = 50, offset: int = 0):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    return db.get_generation_history(user["user_id"], limit, offset)


@app.delete("/api/profile/history/{record_id}")
def delete_history(record_id: int, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    ok = db.delete_generation(user["user_id"], record_id)
    if not ok:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"ok": True}


# ── Generation ──────────────────────────────────────────────────────────
def _apply_overrides(engine: PersonaEngine, overrides: dict[str, dict]) -> None:
    if not overrides:
        return
    for card in engine.inspirations.cards:
        if card.id not in overrides:
            continue
        ov = overrides[card.id]
        if ov.get("prompt_zh"):
            card.prompt_fragment.zh = ov["prompt_zh"]
        if ov.get("prompt_en"):
            card.prompt_fragment.en = ov["prompt_en"]
        if ov.get("snippets"):
            for k, v in ov["snippets"].items():
                if k in card.snippets:
                    if v.get("zh"):
                        card.snippets[k].zh = v["zh"]
                    if v.get("en"):
                        card.snippets[k].en = v["en"]


@app.post("/api/generate")
def generate(req: GenerateRequest, authorization: str | None = Header(None)):
    config = EngineConfig(
        candidate_count=req.count,
        language=req.language,
        llm_provider=req.provider,
        llm_model=req.model or None,
        llm_api_key=req.api_key or None,
        llm_base_url=req.base_url or None,
    )
    engine = PersonaEngine.create(config)
    user = get_current_user(authorization)
    if user:
        overrides = db.get_card_overrides(user["user_id"])
        _apply_overrides(engine, overrides)

    seed = PersonaSeed(
        concept=req.concept,
        selected_inspirations=req.selected_inspirations,
    )
    try:
        output = engine.generate(seed)
        result = output.as_dict(req.language)
        if user:
            db.save_generation(user["user_id"], req.concept, req.language, req.count, result)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Wizard ──────────────────────────────────────────────────────────────
# In-memory wizard sessions (keyed by a simple session token)
import secrets
_wizard_sessions: dict[str, WizardEngine] = {}

@app.post("/api/wizard/start")
def wizard_start(req: WizardStartRequest):
    config = EngineConfig(
        candidate_count=req.count,
        language=req.language,
        llm_provider=req.provider,
        llm_model=req.model or None,
        llm_api_key=req.api_key or None,
        llm_base_url=req.base_url or None,
    )
    wizard = WizardEngine(config=config)
    questions = wizard.start(req.concept)
    session_id = secrets.token_urlsafe(16)
    _wizard_sessions[session_id] = wizard
    return {
        "session_id": session_id,
        "questions": [q.as_dict(req.language) for q in questions],
        "stage": wizard.session.stage if wizard.session else "questioning",
    }


@app.post("/api/wizard/{session_id}/answer")
def wizard_answer(session_id: str, req: WizardAnswerRequest):
    wizard = _wizard_sessions.get(session_id)
    if not wizard:
        raise HTTPException(status_code=404, detail="会话不存在")
    questions = wizard.answer(req.field, req.answer)
    lang = wizard.config.language
    return {
        "questions": [q.as_dict(lang) for q in questions],
        "stage": wizard.session.stage if wizard.session else "questioning",
    }


@app.post("/api/wizard/{session_id}/finish")
def wizard_finish(session_id: str, authorization: str | None = Header(None)):
    wizard = _wizard_sessions.get(session_id)
    if not wizard:
        raise HTTPException(status_code=404, detail="会话不存在")
    user = get_current_user(authorization)
    if user:
        overrides = db.get_card_overrides(user["user_id"])
        _apply_overrides(wizard._engine, overrides)
    try:
        output = wizard.finish()
        result = output.as_dict(wizard.config.language)
        if user and wizard.session:
            db.save_generation(
                user["user_id"],
                wizard.session.concept,
                wizard.config.language,
                wizard.config.candidate_count,
                result,
            )
        del _wizard_sessions[session_id]
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

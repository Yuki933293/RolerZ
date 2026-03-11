"""
Persona Forge — FastAPI Backend
"""
from __future__ import annotations

import json
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from urllib import error as urlerror
from urllib import request as urlrequest

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
_default_secret = "persona-forge-dev-secret-change-in-production"
SECRET_KEY = os.environ.get("JWT_SECRET", _default_secret)
if SECRET_KEY == _default_secret and not os.environ.get("DEV_MODE"):
    import warnings
    warnings.warn("JWT_SECRET not set! Using insecure default. Set JWT_SECRET env var in production.", stacklevel=1)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


# ── Provider metadata ──────────────────────────────────────────────────
PROVIDERS = {
    "claude":     {"name": "Claude",          "env_key": "ANTHROPIC_API_KEY"},
    "openai":     {"name": "OpenAI",          "env_key": "OPENAI_API_KEY"},
    "gemini":     {"name": "Google Gemini",   "env_key": "GEMINI_API_KEY"},
    "deepseek":   {"name": "DeepSeek",        "env_key": "DEEPSEEK_API_KEY"},
    "xai":        {"name": "xAI",             "env_key": "XAI_API_KEY"},
    "moonshot":   {"name": "Moonshot",        "env_key": "MOONSHOT_API_KEY"},
    "zhipu":      {"name": "Zhipu",           "env_key": "ZHIPU_API_KEY"},
    "groq":       {"name": "Groq",            "env_key": "GROQ_API_KEY"},
    "openrouter": {"name": "OpenRouter",      "env_key": "OPENROUTER_API_KEY"},
    "siliconflow":{"name": "SiliconFlow",     "env_key": "SILICONFLOW_API_KEY"},
    "302ai":      {"name": "302.AI",          "env_key": "API_302AI_KEY"},
    "aihubmix":   {"name": "AIHubMix",        "env_key": "AIHUBMIX_API_KEY"},
    "nvidia":     {"name": "NVIDIA",          "env_key": "NVIDIA_API_KEY"},
    "azure":      {"name": "Azure OpenAI",    "env_key": "AZURE_OPENAI_API_KEY"},
    "ollama":     {"name": "Ollama",          "env_key": ""},
    "lmstudio":   {"name": "LM Studio",       "env_key": ""},
    "custom":     {"name": "自定义",          "env_key": ""},
}

PROVIDER_DEFAULT_URLS = {
    "claude":      "https://api.anthropic.com",
    "openai":      "https://api.openai.com/v1",
    "gemini":      "https://generativelanguage.googleapis.com/v1beta/openai",
    "deepseek":    "https://api.deepseek.com",
    "xai":         "https://api.x.ai/v1",
    "moonshot":    "https://api.moonshot.cn/v1",
    "zhipu":       "https://open.bigmodel.cn/api/paas/v4",
    "groq":        "https://api.groq.com/openai/v1",
    "openrouter":  "https://openrouter.ai/api/v1",
    "siliconflow": "https://api.siliconflow.cn/v1",
    "302ai":       "https://api.302.ai/v1",
    "aihubmix":    "https://aihubmix.com/v1",
    "nvidia":      "https://integrate.api.nvidia.com/v1",
    "azure":       "",
    "ollama":      "http://localhost:11434/v1",
    "lmstudio":    "http://localhost:1234/v1",
    "custom":      "",
}


# ── Pydantic models ────────────────────────────────────────────────────
class AuthRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    is_admin: bool = False

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

class UpdateProfileRequest(BaseModel):
    avatar_url: str | None = None
    bio: str | None = None

class FetchModelsRequest(BaseModel):
    provider: str
    api_key: str = ""
    base_url: str = ""

class AnnouncementRequest(BaseModel):
    id: str = ""
    date: str = ""
    type: str = "feature"
    title_zh: str = ""
    title_en: str = ""
    body_zh: str = ""
    body_en: str = ""
    sort_order: int = 0

class SetAdminRequest(BaseModel):
    is_admin: bool


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
_allowed_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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
    return TokenResponse(access_token=token, username=req.username, is_admin=db.is_admin(uid))


@app.post("/api/auth/register", response_model=TokenResponse)
def register(req: AuthRequest):
    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="密码至少 4 个字符")
    uid = db.create_user(req.username, req.password)
    if uid is None:
        raise HTTPException(status_code=409, detail="用户名已存在")
    token = create_access_token(uid, req.username)
    return TokenResponse(access_token=token, username=req.username, is_admin=db.is_admin(uid))


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
    def _extract_model_ids(payload: object) -> list[str]:
        ids: list[str] = []
        if isinstance(payload, dict):
            candidates = payload.get("data")
            if candidates is None:
                for key in ("models", "result", "items"):
                    if key in payload:
                        candidates = payload[key]
                        break
            if isinstance(candidates, list):
                for item in candidates:
                    if isinstance(item, str):
                        ids.append(item)
                    elif isinstance(item, dict):
                        mid = item.get("id") or item.get("model") or item.get("name")
                        if isinstance(mid, str) and mid:
                            ids.append(mid)
        elif isinstance(payload, list):
            for item in payload:
                if isinstance(item, str):
                    ids.append(item)
                elif isinstance(item, dict):
                    mid = item.get("id") or item.get("model") or item.get("name")
                    if isinstance(mid, str) and mid:
                        ids.append(mid)
        return sorted(set(ids))

    def _fetch_models_direct(base_url: str, api_key: str | None) -> list[str]:
        if not base_url:
            raise ValueError("缺少接口地址 base_url")
        endpoint = base_url.rstrip("/")
        if not endpoint.endswith("/models"):
            endpoint = f"{endpoint}/models"
        # Some commercial gateways block Python default user-agent fingerprints.
        # Use a generic browser-like UA for better compatibility.
        headers = {
            "Accept": "application/json",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/123.0.0.0 Safari/537.36"
            ),
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        req_obj = urlrequest.Request(endpoint, headers=headers, method="GET")
        try:
            with urlrequest.urlopen(req_obj, timeout=15) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
        except urlerror.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(body)
                if isinstance(payload, dict) and payload.get("error_code") == 1010:
                    raise RuntimeError(
                        "HTTP 403 (Cloudflare 1010): 中转站拦截了当前客户端签名。"
                        "请在中转站侧放行当前服务器 IP/User-Agent，或关闭 browser_signature 规则。"
                    ) from exc
            except json.JSONDecodeError:
                pass
            raise RuntimeError(f"HTTP {exc.code}: {body[:400]}") from exc

        text = raw.strip()
        if not text:
            raise RuntimeError("中转站 /models 返回空响应")

        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            # Some gateways return plain-text model ids (one per line)
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            if lines and all((" " not in line) and (not line.startswith("<")) for line in lines):
                return sorted(set(lines))

            lower = text.lower()
            if "<html" in lower or "<!doctype html" in lower:
                raise RuntimeError(
                    "中转站 /models 返回了 HTML（通常是 WAF/反爬挑战页面），不是 JSON。"
                    "请在中转站放行当前服务器请求，或直接手填模型名后跳过“获取模型列表”。"
                )
            raise RuntimeError(f"中转站 /models 返回非 JSON: {text[:240]}")

        ids = _extract_model_ids(payload)
        if not ids:
            raise RuntimeError("中转站 /models 返回格式不兼容（未解析到模型 id）")
        return ids

    try:
        if req.provider == "claude":
            import anthropic
            client = anthropic.Anthropic(
                api_key=req.api_key or os.environ.get("ANTHROPIC_API_KEY"),
                timeout=15,
            )
            result = client.models.list(limit=100)
            return sorted([m.id for m in result.data])
        if req.provider == "custom":
            return _fetch_models_direct(req.base_url, req.api_key or None)
        else:
            import openai as _openai
            resolved_key = req.api_key or (
                os.environ.get("OPENAI_API_KEY") if req.provider == "openai"
                else os.environ.get("DEEPSEEK_API_KEY") if req.provider == "deepseek"
                else req.api_key
            )
            resolved_url = req.base_url or _PROVIDER_BASE_URLS.get(req.provider) or PROVIDER_DEFAULT_URLS.get(req.provider, "")
            client = _openai.OpenAI(api_key=resolved_key, base_url=resolved_url, timeout=15)
            try:
                result = client.models.list()
                return sorted([m.id for m in result.data])
            except Exception:
                # Some commercial gateways return non-standard /models payloads.
                # Fallback to a direct HTTP parse to improve compatibility.
                if resolved_url:
                    return _fetch_models_direct(resolved_url, resolved_key)
                raise
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


# ── Announcements ──────────────────────────────────────────────────
def _require_admin(authorization: str | None) -> dict:
    """Extract user and verify admin. Raises 401/403."""
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    if not db.is_admin(user["user_id"]):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


@app.get("/api/announcements")
def list_announcements():
    return db.get_announcements()


@app.post("/api/announcements")
def create_announcement(req: AnnouncementRequest, authorization: str | None = Header(None)):
    _require_admin(authorization)
    ann_id = req.id or f"ann-{secrets.token_hex(6)}"
    db.create_announcement(
        ann_id, req.date, req.type,
        req.title_zh, req.title_en,
        req.body_zh, req.body_en, req.sort_order,
    )
    return {"ok": True, "id": ann_id}


@app.put("/api/announcements/{ann_id}")
def update_announcement(ann_id: str, req: AnnouncementRequest, authorization: str | None = Header(None)):
    _require_admin(authorization)
    ok = db.update_announcement(
        ann_id, req.date, req.type,
        req.title_zh, req.title_en,
        req.body_zh, req.body_en, req.sort_order,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="公告不存在")
    return {"ok": True}


@app.delete("/api/announcements/{ann_id}")
def delete_announcement(ann_id: str, authorization: str | None = Header(None)):
    _require_admin(authorization)
    ok = db.delete_announcement(ann_id)
    if not ok:
        raise HTTPException(status_code=404, detail="公告不存在")
    return {"ok": True}


# ── Admin: user management ────────────────────────────────────────
@app.get("/api/admin/users")
def list_users(authorization: str | None = Header(None)):
    _require_admin(authorization)
    return db.list_users()


@app.put("/api/admin/users/{user_id}/admin")
def set_user_admin(user_id: int, req: SetAdminRequest, authorization: str | None = Header(None)):
    admin = _require_admin(authorization)
    if admin["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="不能修改自己的管理员状态")
    ok = db.set_admin(user_id, req.is_admin)
    if not ok:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"ok": True}


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, authorization: str | None = Header(None)):
    admin = _require_admin(authorization)
    if admin["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="不能删除自己的账号")
    ok = db.delete_user(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="用户不存在")
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


@app.delete("/api/profile/history")
def clear_all_history(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    count = db.clear_generation_history(user["user_id"])
    return {"ok": True, "deleted": count}


@app.get("/api/profile/info")
def get_profile_info(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    profile = db.get_user_profile(user["user_id"])
    if not profile:
        raise HTTPException(status_code=404, detail="用户不存在")
    return profile


@app.put("/api/profile/info")
def update_profile_info(req: UpdateProfileRequest, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    db.update_user_profile(user["user_id"], avatar_url=req.avatar_url, bio=req.bio)
    return {"ok": True}


@app.delete("/api/profile/account")
def delete_account(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    db.delete_user(user["user_id"])
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
                wizard.session.seed.concept,
                wizard.config.language,
                wizard.config.candidate_count,
                result,
            )
        del _wizard_sessions[session_id]
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

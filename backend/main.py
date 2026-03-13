"""
Persona Forge — FastAPI Backend
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from urllib import error as urlerror
from urllib import request as urlrequest

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from pydantic import BaseModel

# Ensure project root on path so persona_engine / database are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import database as db
from persona_engine import EngineConfig, GenerationCancelledError, PersonaEngine, PersonaSeed
from persona_engine.inspiration import InspirationLibrary
from persona_engine.llm import PROVIDER_DEFAULTS, create_llm_client, _PROVIDER_BASE_URLS, build_fusion_prompt, get_system_prompt, parse_llm_response
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
    email: str | None = None

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
    # Advanced LLM params
    temperature: float | None = None
    top_p: float | None = None
    frequency_penalty: float | None = None
    presence_penalty: float | None = None
    max_tokens: int | None = None

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
    email: str | None = None

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

class EventBatch(BaseModel):
    events: list[dict]  # [{"event_type": "view"|"click"|"save", "persona_id": int}]

class FusionRequest(BaseModel):
    card_ids: list[str]
    language: str = "zh"
    provider: str = "claude"
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    temperature: float | None = None
    top_p: float | None = None
    max_tokens: int | None = None


class ChatPreviewRequest(BaseModel):
    messages: list[dict]  # [{"role": "user"|"assistant", "content": "..."}]
    system_prompt: str
    provider: str = "claude"
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    temperature: float | None = None
    top_p: float | None = None
    max_tokens: int | None = None

class CreateChatSessionRequest(BaseModel):
    char_name: str
    system_prompt: str
    messages: list[dict] = []

class UpdateChatSessionRequest(BaseModel):
    messages: list[dict]


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


# ── Rate Limiter (in-memory sliding window) ──────────────────────────
class _RateLimiter:
    """Per-key sliding window rate limiter with automatic cleanup."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self._last_cleanup = time.monotonic()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            # Periodic cleanup every 60s to prevent memory leak
            if now - self._last_cleanup > 60:
                stale_keys = [k for k, v in self._hits.items() if not v or v[-1] < cutoff]
                for k in stale_keys:
                    del self._hits[k]
                self._last_cleanup = now

            timestamps = self._hits[key]
            # Remove expired entries
            while timestamps and timestamps[0] < cutoff:
                timestamps.pop(0)
            if len(timestamps) >= max_requests:
                return False
            timestamps.append(now)
            return True

    def remaining(self, key: str, max_requests: int, window_seconds: int) -> int:
        cutoff = time.monotonic() - window_seconds
        with self._lock:
            timestamps = self._hits.get(key, [])
            active = sum(1 for t in timestamps if t >= cutoff)
            return max(0, max_requests - active)


_limiter = _RateLimiter()

# Rate limit tiers: (max_requests, window_seconds)
_RATE_AUTH = (5, 60)       # 5 req/min — brute force protection
_RATE_LLM = (10, 60)      # 10 req/min — expensive LLM calls
_RATE_WRITE = (30, 60)     # 30 req/min — mutations
_RATE_READ = (60, 60)      # 60 req/min — read endpoints

# Path → tier mapping (prefix match)
_RATE_TIERS: list[tuple[str, tuple[int, int], str]] = [
    # (path_prefix, (max, window), key_type: "ip" | "user")
    ("/api/auth/login", _RATE_AUTH, "ip"),
    ("/api/auth/register", _RATE_AUTH, "ip"),
    ("/api/generate", _RATE_LLM, "user"),
    ("/api/fusion", _RATE_LLM, "user"),
    ("/api/wizard", _RATE_LLM, "user"),
    ("/api/chat/preview", _RATE_LLM, "user"),
    ("/api/community/share", _RATE_WRITE, "user"),
    ("/api/community/personas/", _RATE_WRITE, "user"),  # like/delete
    ("/api/admin/", _RATE_WRITE, "user"),
]


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _extract_user_from_header(authorization: str | None) -> str | None:
    """Lightweight JWT sub extraction for rate limiting (no full validation)."""
    if not authorization:
        return None
    try:
        _, _, token = authorization.partition(" ")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return f"user:{payload['sub']}"
    except Exception:
        return None


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path

    # Skip non-API routes
    if not path.startswith("/api/"):
        return await call_next(request)

    # Determine tier
    tier = _RATE_READ
    key_type = "ip"
    for prefix, t, kt in _RATE_TIERS:
        if path.startswith(prefix):
            tier, key_type = t, kt
            break

    # Build rate limit key
    if key_type == "user":
        auth_header = request.headers.get("authorization")
        rate_key = _extract_user_from_header(auth_header) or f"ip:{_get_client_ip(request)}"
    else:
        rate_key = f"ip:{_get_client_ip(request)}"

    rate_key = f"{path.split('?')[0]}|{rate_key}"
    max_req, window = tier

    if not _limiter.is_allowed(rate_key, max_req, window):
        remaining = 0
        return JSONResponse(
            status_code=429,
            content={"detail": "请求过于频繁，请稍后再试 / Too many requests, please try again later"},
            headers={
                "Retry-After": str(window),
                "X-RateLimit-Limit": str(max_req),
                "X-RateLimit-Remaining": "0",
            },
        )

    response = await call_next(request)
    remaining = _limiter.remaining(rate_key, max_req, window)
    response.headers["X-RateLimit-Limit"] = str(max_req)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    return response


# ── Auth routes ─────────────────────────────────────────────────────────
@app.post("/api/auth/login", response_model=TokenResponse)
def login(req: AuthRequest):
    result = db.authenticate(req.username, req.password)
    if result is None:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    uid, real_username = result
    token = create_access_token(uid, real_username)
    return TokenResponse(access_token=token, username=real_username, is_admin=db.is_admin(uid))


@app.post("/api/auth/register", response_model=TokenResponse)
def register(req: AuthRequest):
    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="密码至少 4 个字符")
    email = req.email.strip() if req.email else None
    if email:
        import re
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
            raise HTTPException(status_code=400, detail="邮箱格式不正确")
    uid = db.create_user(req.username, req.password, email=email)
    if uid is None:
        raise HTTPException(status_code=409, detail="用户名或邮箱已被注册")
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


# ── Notifications ──────────────────────────────────────────────────
@app.get("/api/notifications")
def list_notifications(unread_only: bool = False, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    return db.list_notifications(user["user_id"], unread_only=unread_only)


@app.get("/api/notifications/unread-count")
def unread_notification_count(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    return {"count": db.count_unread_notifications(user["user_id"])}


@app.put("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    db.mark_notification_read(user["user_id"], notification_id)
    return {"ok": True}


@app.put("/api/notifications/read-all")
def mark_all_notifications_read(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    count = db.mark_all_notifications_read(user["user_id"])
    return {"ok": True, "count": count}


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


# ── Admin: dashboard stats ────────────────────────────────────────
@app.get("/api/admin/stats")
def admin_stats(authorization: str | None = Header(None)):
    _require_admin(authorization)
    return db.get_admin_stats()


# ── Community: shared personas ────────────────────────────────────
class SharePersonaRequest(BaseModel):
    name: str
    summary: str = ""
    tags: list[str] = []
    spec_data: dict = {}
    natural_text: str = ""
    score: float = 0
    language: str = "zh"
    card_type: str = ""


@app.post("/api/community/share")
def share_persona(req: SharePersonaRequest, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    pid = db.share_persona(
        user["user_id"], req.name, req.summary, req.tags,
        req.spec_data, req.natural_text, req.score, req.language,
        req.card_type,
    )
    return {"ok": True, "id": pid}


@app.get("/api/tier/config")
def tier_config():
    """Return current tier thresholds (phase, thresholds, mode).
    Also checks for phase transitions and auto-generates notifications.
    """
    db.check_phase_transition()
    return db.get_tier_config()


@app.get("/api/community/personas")
def list_community_personas(
    limit: int = 50, offset: int = 0, sort: str = "latest", tag: str = "",
    card_type: str = "",
    authorization: str | None = Header(None),
):
    user = get_current_user(authorization)
    user_id = user["user_id"] if user else None
    return db.list_shared_personas(limit, offset, sort, tag, card_type, user_id)


@app.post("/api/community/personas/{persona_id}/like")
def toggle_like(persona_id: int, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    liked = db.toggle_persona_like(user["user_id"], persona_id)
    return {"ok": True, "liked": liked}


@app.delete("/api/community/personas/{persona_id}")
def delete_shared(persona_id: int, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    ok = db.delete_shared_persona(user["user_id"], persona_id)
    if not ok:
        raise HTTPException(status_code=404, detail="角色不存在或无权删除")
    return {"ok": True}


# ── Events (analytics) ─────────────────────────────────────────────
@app.post("/api/events")
def record_events(req: EventBatch, authorization: str | None = Header(None)):
    """Record view/click/save events (fire-and-forget, no auth required but tracks user if logged in)."""
    user = get_current_user(authorization)
    user_id = user["user_id"] if user else None
    count = db.record_events(user_id, req.events)
    return {"ok": True, "recorded": count}


@app.get("/api/admin/events/stats")
def admin_event_stats(days: int = 7, authorization: str | None = Header(None)):
    """Get event analytics (admin only)."""
    user = get_current_user(authorization)
    if not user or not db.is_admin(user["user_id"]):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return db.get_event_stats(days)


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


# ── Profile ─────────────────────────────────────��──────────────────────
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
    if req.email is not None:
        email = req.email.strip()
        if email:
            import re
            if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
                raise HTTPException(status_code=400, detail="邮箱格式不正确")
    db.update_user_profile(user["user_id"], avatar_url=req.avatar_url, bio=req.bio, email=req.email)
    return {"ok": True}


@app.delete("/api/profile/account")
def delete_account(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    db.delete_user(user["user_id"])
    return {"ok": True}


# ── Generation cancel registry ─────────────────────────────────────────
_cancel_events: dict[int, threading.Event] = {}


@app.post("/api/generate/cancel")
def cancel_generation(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    event = _cancel_events.get(user["user_id"])
    if event:
        event.set()
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
    extra: dict = {}
    if req.temperature is not None:
        extra["llm_temperature"] = req.temperature
    if req.top_p is not None:
        extra["llm_top_p"] = req.top_p
    if req.frequency_penalty is not None:
        extra["llm_frequency_penalty"] = req.frequency_penalty
    if req.presence_penalty is not None:
        extra["llm_presence_penalty"] = req.presence_penalty
    if req.max_tokens is not None:
        extra["llm_max_tokens"] = req.max_tokens
    config = EngineConfig(
        candidate_count=req.count,
        language=req.language,
        llm_provider=req.provider,
        llm_model=req.model or None,
        llm_api_key=req.api_key or None,
        llm_base_url=req.base_url or None,
        **extra,
    )
    engine = PersonaEngine.create(config)
    user = get_current_user(authorization)
    if user:
        overrides = db.get_card_overrides(user["user_id"])
        _apply_overrides(engine, overrides)

    # Set up cancellation for this user
    cancel_event = threading.Event()
    user_id = user["user_id"] if user else None
    if user_id is not None:
        _cancel_events[user_id] = cancel_event

    seed = PersonaSeed(
        concept=req.concept,
        selected_inspirations=req.selected_inspirations,
    )
    try:
        output = engine.generate(seed, cancel_check=cancel_event.is_set)
        result = output.as_dict(req.language)
        if user:
            db.save_generation(user["user_id"], req.concept, req.language, req.count, result)
        return result
    except GenerationCancelledError:
        raise HTTPException(status_code=499, detail="生成已取消")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if user_id is not None:
            _cancel_events.pop(user_id, None)


# ── Fusion Lab ─────────────────────────────────────────────────────────
@app.post("/api/fusion/generate")
def fusion_generate(req: FusionRequest, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    if len(req.card_ids) < 2:
        raise HTTPException(status_code=400, detail="至少需要 2 张卡牌进行融合")
    if len(req.card_ids) > 5:
        raise HTTPException(status_code=400, detail="最多支持 5 张卡牌融合")

    # Load cards and find selected ones
    lib = InspirationLibrary.load()
    id_map = {c.id: c for c in lib.cards}
    selected_cards = [id_map[cid] for cid in req.card_ids if cid in id_map]
    if len(selected_cards) < 2:
        raise HTTPException(status_code=400, detail="未找到足够的有效卡牌")

    # Apply user overrides if any
    overrides = db.get_card_overrides(user["user_id"])
    if overrides:
        for card in selected_cards:
            if card.id in overrides:
                ov = overrides[card.id]
                if ov.get("prompt_zh"):
                    card.prompt_fragment.zh = ov["prompt_zh"]
                if ov.get("prompt_en"):
                    card.prompt_fragment.en = ov["prompt_en"]

    # Build fusion prompt and call LLM
    prompt = build_fusion_prompt(selected_cards, language=req.language)
    system = get_system_prompt(req.language)
    max_tokens = req.max_tokens or 6400
    client = create_llm_client(
        provider=req.provider,
        model=req.model or None,
        api_key=req.api_key or None,
        base_url=req.base_url or None,
        max_tokens=max_tokens,
    )

    try:
        kwargs: dict = dict(
            system=system,
            temperature=req.temperature if req.temperature is not None else 0.8,
        )
        if req.top_p is not None:
            kwargs["top_p"] = req.top_p
        raw = client.generate(prompt, **kwargs)
        spec = parse_llm_response(raw, language=req.language)
        if spec is None:
            raise RuntimeError("LLM 返回的内容无法解析为有效角色卡")

        # Extract fusion_note from raw JSON
        import json as _json
        fusion_note = ""
        try:
            raw_stripped = raw.strip()
            if raw_stripped.startswith("```"):
                lines = raw_stripped.split("\n")
                end = -1 if lines[-1].strip() == "```" else len(lines)
                raw_stripped = "\n".join(lines[1:end])
            parsed = _json.loads(raw_stripped)
            fusion_note = parsed.get("fusion_note", "")
        except (ValueError, _json.JSONDecodeError):
            pass

        result = spec.as_dict(req.language)
        result["fusion_note"] = fusion_note
        result["source_cards"] = req.card_ids

        # Save to generation history
        db.save_generation(
            user["user_id"],
            f"[融合] {' + '.join(c.title.zh if req.language != 'en' else c.title.en for c in selected_cards)}",
            req.language, 1,
            {"candidates": [result]},
        )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Chat preview ───────────────────────────────────────────────────────
@app.post("/api/chat/preview")
def chat_preview(req: ChatPreviewRequest, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")

    chat_max_tokens = req.max_tokens or 2048
    chat_temperature = req.temperature if req.temperature is not None else 0.8

    client = create_llm_client(
        provider=req.provider,
        model=req.model or None,
        api_key=req.api_key or None,
        base_url=req.base_url or None,
        max_tokens=chat_max_tokens,
    )

    messages = [{"role": m["role"], "content": m["content"]} for m in req.messages]

    try:
        if req.provider == "claude":
            kwargs: dict = {
                "model": client.model,
                "max_tokens": chat_max_tokens,
                "temperature": chat_temperature,
                "system": req.system_prompt,
                "messages": messages,
            }
            if req.top_p is not None:
                kwargs["top_p"] = req.top_p
            response = client._client.messages.create(**kwargs)
            reply = response.content[0].text if response.content else ""
        else:
            # OpenAI-compatible: prepend system message
            full_messages = [{"role": "system", "content": req.system_prompt}] + messages
            oai_kwargs: dict = {
                "model": client.model,
                "messages": full_messages,
                "max_tokens": chat_max_tokens,
                "temperature": chat_temperature,
            }
            if req.top_p is not None:
                oai_kwargs["top_p"] = req.top_p
            try:
                response = client._client.chat.completions.create(**oai_kwargs)
                reply = response.choices[0].message.content or ""
            except Exception as chat_exc:
                # Fallback to Responses API for models that don't support chat completions
                err_msg = str(chat_exc)
                if "not a chat model" in err_msg or "not supported in the v1/chat/completions" in err_msg:
                    resp_kwargs: dict = {
                        "model": client.model,
                        "instructions": req.system_prompt,
                        "input": messages,
                    }
                    resp = client._client.responses.create(**resp_kwargs)
                    reply = resp.output_text or ""
                else:
                    raise
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"reply": reply}


# ── Chat sessions ──────────────────────────────────────────────────────
@app.get("/api/chat/sessions")
def list_chat_sessions(
    visibility: str = "visible",
    char_name: str | None = None,
    authorization: str | None = Header(None),
):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    return db.list_chat_sessions(user["user_id"], visibility=visibility,
                                  char_name=char_name or None)


@app.post("/api/chat/sessions")
def create_chat_session(req: CreateChatSessionRequest, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    sid = db.create_chat_session(user["user_id"], req.char_name, req.system_prompt, req.messages)
    return {"ok": True, "id": sid}


@app.get("/api/chat/sessions/{session_id}")
def get_chat_session(session_id: int, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    session = db.get_chat_session(user["user_id"], session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session


@app.put("/api/chat/sessions/{session_id}")
def update_chat_session(session_id: int, req: UpdateChatSessionRequest, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    ok = db.update_chat_session(user["user_id"], session_id, req.messages)
    if not ok:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"ok": True}


@app.delete("/api/chat/sessions/{session_id}")
def delete_chat_session(session_id: int, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    ok = db.delete_chat_session(user["user_id"], session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"ok": True}


@app.put("/api/chat/sessions/{session_id}/hide")
def hide_chat_session(session_id: int, hidden: bool = True, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    ok = db.hide_chat_session(user["user_id"], session_id, hidden)
    if not ok:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"ok": True}


class BatchDeleteRequest(BaseModel):
    session_ids: list[int]

@app.post("/api/chat/sessions/batch-delete")
def batch_delete_chat_sessions(req: BatchDeleteRequest, authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    count = db.batch_delete_chat_sessions(user["user_id"], req.session_ids)
    return {"ok": True, "deleted": count}


@app.delete("/api/chat/sessions")
def clear_all_chat_sessions(authorization: str | None = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="需要登录")
    count = db.clear_chat_sessions(user["user_id"])
    return {"ok": True, "deleted": count}


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

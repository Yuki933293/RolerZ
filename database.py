"""
Persona Forge — 用户认证与数据持久化 (PostgreSQL)
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from cryptography.fernet import Fernet, InvalidToken

_KEY_PATH = Path(__file__).parent / "data" / ".encryption_key"
_ENC_PREFIX = "ENC:"

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://localhost:5432/rolerz",
)

# --------------- Fernet encryption helpers ---------------

_fernet_instance: Fernet | None = None


def _get_fernet() -> Fernet:
    """Return a cached Fernet instance. Key source priority:
    1. Environment variable ENCRYPTION_KEY
    2. File data/.encryption_key (auto-generated on first run)
    """
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    key = os.environ.get("ENCRYPTION_KEY")
    if key:
        _fernet_instance = Fernet(key.encode() if isinstance(key, str) else key)
        return _fernet_instance

    if _KEY_PATH.exists():
        key = _KEY_PATH.read_text().strip()
    else:
        key = Fernet.generate_key().decode()
        _KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
        _KEY_PATH.write_text(key)
        try:
            _KEY_PATH.chmod(0o600)
        except OSError:
            pass

    _fernet_instance = Fernet(key.encode())
    return _fernet_instance


def _encrypt_config(plaintext: str) -> str:
    """Encrypt a config JSON string. Returns 'ENC:<fernet_token>'."""
    token = _get_fernet().encrypt(plaintext.encode()).decode()
    return _ENC_PREFIX + token


def _decrypt_config(data: str) -> str:
    """Decrypt config data. Handles both encrypted ('ENC:...') and legacy plaintext."""
    if not data.startswith(_ENC_PREFIX):
        return data
    try:
        return _get_fernet().decrypt(data[len(_ENC_PREFIX):].encode()).decode()
    except InvalidToken:
        return "{}"


def _get_conn() -> psycopg.Connection:
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    return conn


def init_db() -> None:
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE DEFAULT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            avatar_url TEXT NOT NULL DEFAULT '',
            bio TEXT NOT NULL DEFAULT '',
            is_admin INTEGER NOT NULL DEFAULT 0,
            email_verified INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_card_overrides (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            card_id TEXT NOT NULL,
            custom_data TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id, card_id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_configs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            config_data TEXT NOT NULL DEFAULT '{}',
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS generation_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            concept TEXT NOT NULL,
            language TEXT NOT NULL DEFAULT 'zh',
            candidate_count INTEGER NOT NULL DEFAULT 1,
            result_data TEXT NOT NULL DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS announcements (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'feature',
            title_zh TEXT NOT NULL DEFAULT '',
            title_en TEXT NOT NULL DEFAULT '',
            body_zh TEXT NOT NULL DEFAULT '',
            body_en TEXT NOT NULL DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_card_groups (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            group_id TEXT NOT NULL,
            group_name TEXT NOT NULL,
            card_ids TEXT NOT NULL DEFAULT '[]',
            sort_order INTEGER DEFAULT 0,
            UNIQUE(user_id, group_id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            char_name TEXT NOT NULL,
            system_prompt TEXT NOT NULL DEFAULT '',
            messages TEXT NOT NULL DEFAULT '[]',
            hidden INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS shared_personas (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            summary TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]',
            spec_data TEXT NOT NULL DEFAULT '{}',
            natural_text TEXT NOT NULL DEFAULT '',
            score DOUBLE PRECISION NOT NULL DEFAULT 0,
            language TEXT NOT NULL DEFAULT 'zh',
            likes INTEGER NOT NULL DEFAULT 0,
            card_type TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS persona_likes (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            persona_id INTEGER NOT NULL REFERENCES shared_personas(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (user_id, persona_id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_collections (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            score DOUBLE PRECISION NOT NULL DEFAULT 0,
            language TEXT NOT NULL DEFAULT 'zh',
            candidate_data TEXT NOT NULL DEFAULT '{}',
            note TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS email_codes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL DEFAULT 0,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            purpose TEXT NOT NULL DEFAULT 'verify',
            expires_at TIMESTAMP NOT NULL,
            used INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL DEFAULT 'info',
            title_zh TEXT NOT NULL DEFAULT '',
            title_en TEXT NOT NULL DEFAULT '',
            body_zh TEXT NOT NULL DEFAULT '',
            body_en TEXT NOT NULL DEFAULT '',
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_notifications_user
            ON notifications(user_id, is_read, created_at DESC)
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            event_type TEXT NOT NULL,
            persona_id INTEGER NOT NULL REFERENCES shared_personas(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_events_persona
            ON events(persona_id, event_type, created_at)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_events_created
            ON events(created_at)
    """)
    conn.commit()
    conn.close()


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()


def create_user(username: str, password: str, email: str | None = None) -> int | None:
    """Create a user. Returns user_id on success, None if username/email is taken."""
    salt = secrets.token_hex(16)
    pw_hash = _hash_password(password, salt)
    conn = _get_conn()
    try:
        row = conn.execute(
            "INSERT INTO users (username, password_hash, salt, email) VALUES (%s, %s, %s, %s) RETURNING id",
            (username, pw_hash, salt, email or None),
        ).fetchone()
        uid = row["id"]
        # First registered user (id=1) is auto-admin
        if uid == 1:
            conn.execute("UPDATE users SET is_admin = 1 WHERE id = 1")
        conn.commit()
        return uid
    except psycopg.errors.UniqueViolation:
        conn.rollback()
        return None
    finally:
        conn.close()


def authenticate(username: str, password: str) -> tuple[int, str] | None:
    """Returns (user_id, username) if credentials are valid, else None.
    Accepts username or email as the login identifier."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT id, username, password_hash, salt FROM users WHERE username = %s OR email = %s",
        (username, username),
    ).fetchone()
    conn.close()
    if row is None:
        return None
    if _hash_password(password, row["salt"]) == row["password_hash"]:
        return (row["id"], row["username"])
    return None


def get_card_overrides(user_id: int) -> dict[str, dict]:
    """Returns {card_id: custom_data_dict} for the given user."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT card_id, custom_data FROM user_card_overrides WHERE user_id = %s",
        (user_id,),
    ).fetchall()
    conn.close()
    result: dict[str, dict] = {}
    for row in rows:
        try:
            result[row["card_id"]] = json.loads(row["custom_data"])
        except json.JSONDecodeError:
            pass
    return result


def save_card_override(user_id: int, card_id: str, custom_data: dict) -> None:
    """Insert or update a per-user card override."""
    conn = _get_conn()
    conn.execute(
        """INSERT INTO user_card_overrides (user_id, card_id, custom_data, updated_at)
           VALUES (%s, %s, %s, NOW())
           ON CONFLICT(user_id, card_id) DO UPDATE SET
               custom_data = EXCLUDED.custom_data,
               updated_at = NOW()""",
        (user_id, card_id, json.dumps(custom_data, ensure_ascii=False)),
    )
    conn.commit()
    conn.close()


def delete_card_override(user_id: int, card_id: str) -> None:
    """Remove a per-user card override (reset to default)."""
    conn = _get_conn()
    conn.execute(
        "DELETE FROM user_card_overrides WHERE user_id = %s AND card_id = %s",
        (user_id, card_id),
    )
    conn.commit()
    conn.close()


def get_card_groups(user_id: int) -> list[dict]:
    """Returns list of {group_id, group_name, card_ids, sort_order} for the user."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT group_id, group_name, card_ids, sort_order "
        "FROM user_card_groups WHERE user_id = %s ORDER BY sort_order",
        (user_id,),
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        try:
            card_ids = json.loads(row["card_ids"])
        except json.JSONDecodeError:
            card_ids = []
        result.append({
            "group_id": row["group_id"],
            "group_name": row["group_name"],
            "card_ids": card_ids,
            "sort_order": row["sort_order"],
        })
    return result


def save_card_groups(user_id: int, groups: list[dict]) -> None:
    """Replace all custom groups for the user."""
    conn = _get_conn()
    conn.execute("DELETE FROM user_card_groups WHERE user_id = %s", (user_id,))
    for i, g in enumerate(groups):
        conn.execute(
            "INSERT INTO user_card_groups (user_id, group_id, group_name, card_ids, sort_order) "
            "VALUES (%s, %s, %s, %s, %s)",
            (user_id, g["group_id"], g["group_name"],
             json.dumps(g.get("card_ids", []), ensure_ascii=False), i),
        )
    conn.commit()
    conn.close()


def get_user_config(user_id: int) -> dict:
    """Returns the user's saved config dict (auto-decrypts)."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT config_data FROM user_configs WHERE user_id = %s",
        (user_id,),
    ).fetchone()
    conn.close()
    if row is None:
        return {}
    try:
        plaintext = _decrypt_config(row["config_data"])
        return json.loads(plaintext)
    except (json.JSONDecodeError, Exception):
        return {}


def save_user_config(user_id: int, config_data: dict) -> None:
    """Insert or update the user's config (encrypted at rest)."""
    encrypted = _encrypt_config(json.dumps(config_data, ensure_ascii=False))
    conn = _get_conn()
    conn.execute(
        """INSERT INTO user_configs (user_id, config_data, updated_at)
           VALUES (%s, %s, NOW())
           ON CONFLICT(user_id) DO UPDATE SET
               config_data = EXCLUDED.config_data,
               updated_at = NOW()""",
        (user_id, encrypted),
    )
    conn.commit()
    conn.close()


def change_password(user_id: int, old_password: str, new_password: str) -> bool:
    """Change user password. Returns True on success, False if old password is wrong."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT password_hash, salt FROM users WHERE id = %s", (user_id,)
    ).fetchone()
    if row is None:
        conn.close()
        return False
    if _hash_password(old_password, row["salt"]) != row["password_hash"]:
        conn.close()
        return False
    new_salt = secrets.token_hex(16)
    new_hash = _hash_password(new_password, new_salt)
    conn.execute(
        "UPDATE users SET password_hash = %s, salt = %s WHERE id = %s",
        (new_hash, new_salt, user_id),
    )
    conn.commit()
    conn.close()
    return True


def save_generation(user_id: int, concept: str, language: str, count: int, result_data: dict) -> int:
    """Save a generation result. Returns the new record id."""
    conn = _get_conn()
    row = conn.execute(
        "INSERT INTO generation_history (user_id, concept, language, candidate_count, result_data) "
        "VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (user_id, concept, language, count, json.dumps(result_data, ensure_ascii=False)),
    ).fetchone()
    conn.commit()
    rid = row["id"] if row else 0
    conn.close()
    return rid


def get_generation_history(user_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
    """Returns generation history for the user, newest first."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, concept, language, candidate_count, result_data, created_at "
        "FROM generation_history WHERE user_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
        (user_id, limit, offset),
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        try:
            data = json.loads(row["result_data"])
        except json.JSONDecodeError:
            data = {}
        result.append({
            "id": row["id"],
            "concept": row["concept"],
            "language": row["language"],
            "candidate_count": row["candidate_count"],
            "result_data": data,
            "created_at": str(row["created_at"]) if row["created_at"] else None,
        })
    return result


def delete_generation(user_id: int, record_id: int) -> bool:
    """Delete a generation record. Returns True if deleted."""
    conn = _get_conn()
    cur = conn.execute(
        "DELETE FROM generation_history WHERE id = %s AND user_id = %s",
        (record_id, user_id),
    )
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


def get_user_stats(user_id: int) -> dict:
    """Returns basic stats for the user."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT COUNT(*) as total, COALESCE(SUM(candidate_count), 0) as total_candidates "
        "FROM generation_history WHERE user_id = %s",
        (user_id,),
    ).fetchone()
    user_row = conn.execute(
        "SELECT created_at FROM users WHERE id = %s", (user_id,)
    ).fetchone()
    conn.close()
    return {
        "total_generations": row["total"] if row else 0,
        "total_candidates": row["total_candidates"] if row else 0,
        "member_since": str(user_row["created_at"]) if user_row and user_row["created_at"] else None,
    }


def is_admin(user_id: int) -> bool:
    """Check if the user is an admin."""
    conn = _get_conn()
    row = conn.execute("SELECT is_admin FROM users WHERE id = %s", (user_id,)).fetchone()
    conn.close()
    return bool(row and row["is_admin"])


# ── Announcements ──

def get_announcements() -> list[dict]:
    """Returns all announcements sorted by date desc, then sort_order."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, date, type, title_zh, title_en, body_zh, body_en, sort_order, created_at "
        "FROM announcements ORDER BY date DESC, sort_order ASC"
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        if d.get("created_at"):
            d["created_at"] = str(d["created_at"])
        result.append(d)
    return result


def create_announcement(ann_id: str, date: str, ann_type: str,
                        title_zh: str, title_en: str,
                        body_zh: str, body_en: str, sort_order: int = 0) -> None:
    conn = _get_conn()
    conn.execute(
        "INSERT INTO announcements (id, date, type, title_zh, title_en, body_zh, body_en, sort_order) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        (ann_id, date, ann_type, title_zh, title_en, body_zh, body_en, sort_order),
    )
    conn.commit()
    conn.close()


def update_announcement(ann_id: str, date: str, ann_type: str,
                        title_zh: str, title_en: str,
                        body_zh: str, body_en: str, sort_order: int = 0) -> bool:
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE announcements SET date=%s, type=%s, title_zh=%s, title_en=%s, "
        "body_zh=%s, body_en=%s, sort_order=%s, updated_at=NOW() WHERE id=%s",
        (date, ann_type, title_zh, title_en, body_zh, body_en, sort_order, ann_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def delete_announcement(ann_id: str) -> bool:
    conn = _get_conn()
    cur = conn.execute("DELETE FROM announcements WHERE id = %s", (ann_id,))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def get_user_profile(user_id: int) -> dict | None:
    """Returns user profile info."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT username, email, email_verified, avatar_url, bio, created_at FROM users WHERE id = %s",
        (user_id,),
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return {
        "username": row["username"],
        "email": row["email"] or "",
        "email_verified": bool(row["email_verified"]),
        "avatar_url": row["avatar_url"],
        "bio": row["bio"],
        "created_at": str(row["created_at"]) if row["created_at"] else None,
    }


def update_user_profile(user_id: int, avatar_url: str | None = None, bio: str | None = None, email: str | None = None) -> bool:
    """Update user profile fields. Returns True on success."""
    conn = _get_conn()
    fields = []
    values: list = []
    if avatar_url is not None:
        fields.append("avatar_url = %s")
        values.append(avatar_url)
    if bio is not None:
        fields.append("bio = %s")
        values.append(bio)
    if email is not None:
        fields.append("email = %s")
        values.append(email if email else None)
    if not fields:
        conn.close()
        return True
    values.append(user_id)
    conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = %s", values)
    conn.commit()
    conn.close()
    return True


def delete_user(user_id: int) -> bool:
    """Delete a user and all related data (CASCADE). Returns True if deleted."""
    conn = _get_conn()
    cur = conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


# ── Admin: user management ──

def list_users() -> list[dict]:
    """Returns all users with basic info for admin panel."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT u.id, u.username, u.email, u.is_admin, u.created_at, "
        "COALESCE(g.gen_count, 0) as generation_count "
        "FROM users u "
        "LEFT JOIN (SELECT user_id, COUNT(*) as gen_count FROM generation_history GROUP BY user_id) g "
        "ON u.id = g.user_id "
        "ORDER BY u.id"
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        if d.get("created_at"):
            d["created_at"] = str(d["created_at"])
        result.append(d)
    return result


def set_admin(user_id: int, is_admin_val: bool) -> bool:
    """Set or revoke admin status. Returns True if user exists."""
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE users SET is_admin = %s WHERE id = %s",
        (1 if is_admin_val else 0, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def clear_generation_history(user_id: int) -> int:
    """Delete all generation history for a user. Returns number of deleted records."""
    conn = _get_conn()
    cur = conn.execute("DELETE FROM generation_history WHERE user_id = %s", (user_id,))
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


# ── Shared personas (community) ──

def share_persona(user_id: int, name: str, summary: str, tags: list[str],
                  spec_data: dict, natural_text: str, score: float, language: str,
                  card_type: str = "") -> int:
    """Share a persona to the community. Returns persona id."""
    conn = _get_conn()
    row = conn.execute(
        "INSERT INTO shared_personas (user_id, name, summary, tags, spec_data, natural_text, score, language, card_type) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (user_id, name, summary, json.dumps(tags), json.dumps(spec_data), natural_text, score, language, card_type),
    ).fetchone()
    conn.commit()
    pid = row["id"] if row else 0
    conn.close()
    return pid


# ── Tier system (4-phase dynamic thresholds) ──
_MYTHIC_TOP_N = 750

_TIER_PHASES = [
    (5_000,   10,    50,     200),
    (50_000,  249,   2_499,  24_999),
    (100_000, 500,   5_000,  50_000),
]


def _get_user_count(conn: psycopg.Connection | None = None) -> int:
    """Get total registered user count."""
    own = conn is None
    if own:
        conn = _get_conn()
    row = conn.execute("SELECT COUNT(*) as cnt FROM users").fetchone()
    count = row["cnt"] if row else 0
    if own:
        conn.close()
    return count


def get_tier_config() -> dict:
    """Return current tier thresholds based on user count."""
    conn = _get_conn()
    user_count = _get_user_count(conn)

    for max_users, rare, epic, legendary in _TIER_PHASES:
        if user_count < max_users:
            conn.close()
            return {
                "phase": _TIER_PHASES.index((max_users, rare, epic, legendary)) + 1,
                "user_count": user_count,
                "mythic_top_n": _MYTHIC_TOP_N,
                "thresholds": {"rare": rare, "epic": epic, "legendary": legendary},
                "mode": "fixed",
            }

    # Phase 4: percentile-based
    row = conn.execute("SELECT COUNT(*) as cnt FROM shared_personas").fetchone()
    total_personas = row["cnt"] if row else 0
    if total_personas == 0:
        conn.close()
        return {
            "phase": 4, "user_count": user_count, "mythic_top_n": _MYTHIC_TOP_N,
            "thresholds": {"rare": 1, "epic": 1, "legendary": 1}, "mode": "percentile",
        }

    def _percentile_likes(pct: float) -> int:
        offset_val = max(0, int(total_personas * (1 - pct)) - 1)
        r = conn.execute(
            "SELECT likes FROM shared_personas ORDER BY likes DESC LIMIT 1 OFFSET %s",
            (offset_val,),
        ).fetchone()
        return max(1, r["likes"] if r else 1)

    rare_threshold = _percentile_likes(0.50)
    epic_threshold = _percentile_likes(0.20)
    legendary_threshold = _percentile_likes(0.01)
    conn.close()

    return {
        "phase": 4, "user_count": user_count, "mythic_top_n": _MYTHIC_TOP_N,
        "thresholds": {"rare": rare_threshold, "epic": epic_threshold, "legendary": legendary_threshold},
        "mode": "percentile",
    }


def _get_legendary_threshold() -> int:
    config = get_tier_config()
    return config["thresholds"]["legendary"]


def list_shared_personas(limit: int = 50, offset: int = 0, sort: str = "latest",
                         tag: str = "", card_type: str = "",
                         current_user_id: int | None = None) -> list[dict]:
    """List shared personas with author info, like status, and mythic_rank."""
    if sort == "hot":
        return list_shared_personas_hot(limit, offset, tag, card_type, current_user_id)
    if sort == "rising":
        return list_shared_personas_rising(limit, offset, tag, card_type, current_user_id)
    if sort == "explore":
        return list_shared_personas_explore(limit, offset, tag, card_type, current_user_id)

    conn = _get_conn()
    conditions, params = _build_persona_filters(tag, card_type)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    order = "sp.created_at DESC" if sort == "latest" else "sp.likes DESC, sp.created_at DESC"

    legendary_threshold = _get_legendary_threshold()
    mythic_cte = (
        f"WITH mythic_ranks AS ("
        f"  SELECT id, ROW_NUMBER() OVER (ORDER BY likes DESC) as mythic_rank "
        f"  FROM shared_personas WHERE likes >= {legendary_threshold} "
        f"  LIMIT {_MYTHIC_TOP_N}"
        f")"
    )

    rows = conn.execute(
        f"{mythic_cte} "
        f"SELECT sp.id, sp.name, sp.summary, sp.tags, sp.spec_data, sp.natural_text, "
        f"sp.score, sp.language, sp.likes, sp.created_at, sp.user_id, sp.card_type, "
        f"u.username as author, mr.mythic_rank "
        f"FROM shared_personas sp "
        f"JOIN users u ON sp.user_id = u.id "
        f"LEFT JOIN mythic_ranks mr ON sp.id = mr.id "
        f"{where} "
        f"ORDER BY {order} "
        f"LIMIT %s OFFSET %s",
        params + [limit, offset],
    ).fetchall()
    return _format_persona_rows(conn, rows, current_user_id)


def toggle_persona_like(user_id: int, persona_id: int) -> bool:
    """Toggle like on a persona. Returns True if now liked, False if unliked."""
    conn = _get_conn()
    existing = conn.execute(
        "SELECT 1 FROM persona_likes WHERE user_id = %s AND persona_id = %s",
        (user_id, persona_id),
    ).fetchone()

    if existing:
        conn.execute("DELETE FROM persona_likes WHERE user_id = %s AND persona_id = %s",
                      (user_id, persona_id))
        conn.execute("UPDATE shared_personas SET likes = likes - 1 WHERE id = %s", (persona_id,))
        liked = False
    else:
        conn.execute("INSERT INTO persona_likes (user_id, persona_id) VALUES (%s, %s)",
                      (user_id, persona_id))
        conn.execute("UPDATE shared_personas SET likes = likes + 1 WHERE id = %s", (persona_id,))
        liked = True

    conn.commit()
    conn.close()
    return liked


def delete_shared_persona(user_id: int, persona_id: int) -> bool:
    """Delete a shared persona (only by owner). Returns True if deleted."""
    conn = _get_conn()
    cur = conn.execute(
        "DELETE FROM shared_personas WHERE id = %s AND user_id = %s",
        (persona_id, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def get_shared_persona_count() -> int:
    conn = _get_conn()
    row = conn.execute("SELECT COUNT(*) as cnt FROM shared_personas").fetchone()
    conn.close()
    return row["cnt"] if row else 0


# ── Admin stats ──

def get_admin_stats() -> dict:
    """Get admin dashboard statistics."""
    conn = _get_conn()
    users = conn.execute("SELECT COUNT(*) as cnt FROM users").fetchone()["cnt"]
    generations = conn.execute("SELECT COUNT(*) as cnt FROM generation_history").fetchone()["cnt"]
    shared = conn.execute("SELECT COUNT(*) as cnt FROM shared_personas").fetchone()["cnt"]
    today_users = conn.execute(
        "SELECT COUNT(*) as cnt FROM users WHERE created_at::date = CURRENT_DATE"
    ).fetchone()["cnt"]
    today_generations = conn.execute(
        "SELECT COUNT(*) as cnt FROM generation_history WHERE created_at::date = CURRENT_DATE"
    ).fetchone()["cnt"]
    trend = conn.execute(
        "SELECT created_at::date as day, COUNT(*) as cnt "
        "FROM generation_history "
        "WHERE created_at >= NOW() - INTERVAL '7 days' "
        "GROUP BY created_at::date ORDER BY day"
    ).fetchall()
    conn.close()
    return {
        "total_users": users,
        "total_generations": generations,
        "total_shared": shared,
        "today_users": today_users,
        "today_generations": today_generations,
        "generation_trend": [{"date": str(r["day"]), "count": r["cnt"]} for r in trend],
    }


# ── Chat sessions ──

def create_chat_session(user_id: int, char_name: str, system_prompt: str,
                        messages: list[dict]) -> int:
    conn = _get_conn()
    row = conn.execute(
        "INSERT INTO chat_sessions (user_id, char_name, system_prompt, messages) "
        "VALUES (%s, %s, %s, %s) RETURNING id",
        (user_id, char_name, system_prompt, json.dumps(messages, ensure_ascii=False)),
    ).fetchone()
    conn.commit()
    sid = row["id"] if row else 0
    conn.close()
    return sid


def list_chat_sessions(user_id: int, limit: int = 50,
                       visibility: str = "visible",
                       char_name: str | None = None) -> list[dict]:
    conn = _get_conn()
    where = ["user_id = %s"]
    params: list = [user_id]
    if visibility == "visible":
        where.append("hidden = 0")
    elif visibility == "hidden":
        where.append("hidden = 1")
    if char_name:
        where.append("char_name = %s")
        params.append(char_name)
    params.append(limit)
    rows = conn.execute(
        f"SELECT id, char_name, messages, created_at, updated_at "
        f"FROM chat_sessions WHERE {' AND '.join(where)} ORDER BY updated_at DESC LIMIT %s",
        params,
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        try:
            msgs = json.loads(row["messages"])
        except json.JSONDecodeError:
            msgs = []
        result.append({
            "id": row["id"],
            "char_name": row["char_name"],
            "message_count": len(msgs),
            "last_message": msgs[-1]["content"][:60] if msgs else "",
            "created_at": str(row["created_at"]) if row["created_at"] else None,
            "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
        })
    return result


def get_chat_session(user_id: int, session_id: int) -> dict | None:
    conn = _get_conn()
    row = conn.execute(
        "SELECT id, char_name, system_prompt, messages, created_at, updated_at "
        "FROM chat_sessions WHERE id = %s AND user_id = %s",
        (session_id, user_id),
    ).fetchone()
    conn.close()
    if row is None:
        return None
    try:
        msgs = json.loads(row["messages"])
    except json.JSONDecodeError:
        msgs = []
    return {
        "id": row["id"],
        "char_name": row["char_name"],
        "system_prompt": row["system_prompt"],
        "messages": msgs,
        "created_at": str(row["created_at"]) if row["created_at"] else None,
        "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
    }


def update_chat_session(user_id: int, session_id: int, messages: list[dict]) -> bool:
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE chat_sessions SET messages = %s, updated_at = NOW() "
        "WHERE id = %s AND user_id = %s",
        (json.dumps(messages, ensure_ascii=False), session_id, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def delete_chat_session(user_id: int, session_id: int) -> bool:
    conn = _get_conn()
    cur = conn.execute(
        "DELETE FROM chat_sessions WHERE id = %s AND user_id = %s",
        (session_id, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def hide_chat_session(user_id: int, session_id: int, hidden: bool = True) -> bool:
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE chat_sessions SET hidden = %s WHERE id = %s AND user_id = %s",
        (1 if hidden else 0, session_id, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def batch_delete_chat_sessions(user_id: int, session_ids: list[int]) -> int:
    if not session_ids:
        return 0
    conn = _get_conn()
    # Use ANY(%s) with array for PostgreSQL
    cur = conn.execute(
        "DELETE FROM chat_sessions WHERE user_id = %s AND id = ANY(%s)",
        (user_id, session_ids),
    )
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


def clear_chat_sessions(user_id: int) -> int:
    conn = _get_conn()
    cur = conn.execute("DELETE FROM chat_sessions WHERE user_id = %s", (user_id,))
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


# ── Notifications ──

def create_notification(user_id: int, ntype: str,
                        title_zh: str, title_en: str,
                        body_zh: str = "", body_en: str = "") -> int:
    conn = _get_conn()
    row = conn.execute(
        "INSERT INTO notifications (user_id, type, title_zh, title_en, body_zh, body_en) "
        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (user_id, ntype, title_zh, title_en, body_zh, body_en),
    ).fetchone()
    conn.commit()
    nid = row["id"] if row else 0
    conn.close()
    return nid


def create_broadcast_notification(ntype: str,
                                  title_zh: str, title_en: str,
                                  body_zh: str = "", body_en: str = "") -> int:
    conn = _get_conn()
    user_ids = [r["id"] for r in conn.execute("SELECT id FROM users").fetchall()]
    for uid in user_ids:
        conn.execute(
            "INSERT INTO notifications (user_id, type, title_zh, title_en, body_zh, body_en) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (uid, ntype, title_zh, title_en, body_zh, body_en),
        )
    conn.commit()
    conn.close()
    return len(user_ids)


def list_notifications(user_id: int, limit: int = 30,
                       unread_only: bool = False) -> list[dict]:
    conn = _get_conn()
    where = "WHERE user_id = %s"
    params: list = [user_id]
    if unread_only:
        where += " AND is_read = 0"
    rows = conn.execute(
        f"SELECT id, type, title_zh, title_en, body_zh, body_en, is_read, created_at "
        f"FROM notifications {where} ORDER BY created_at DESC LIMIT %s",
        params + [limit],
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        if d.get("created_at"):
            d["created_at"] = str(d["created_at"])
        result.append(d)
    return result


def count_unread_notifications(user_id: int) -> int:
    conn = _get_conn()
    row = conn.execute(
        "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = %s AND is_read = 0",
        (user_id,),
    ).fetchone()
    conn.close()
    return row["cnt"] if row else 0


def mark_notification_read(user_id: int, notification_id: int) -> bool:
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = %s AND user_id = %s",
        (notification_id, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def mark_all_notifications_read(user_id: int) -> int:
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE user_id = %s AND is_read = 0",
        (user_id,),
    )
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


# ── Phase transition tracking ──

_PHASE_STORAGE_KEY = "tier_phase"


def _get_stored_phase() -> int | None:
    conn = _get_conn()
    row = conn.execute("SELECT value FROM kv_store WHERE key = %s", (_PHASE_STORAGE_KEY,)).fetchone()
    conn.close()
    if row:
        return int(row["value"])
    return None


def _set_stored_phase(phase: int) -> None:
    conn = _get_conn()
    conn.execute(
        "INSERT INTO kv_store (key, value, updated_at) VALUES (%s, %s, NOW()) "
        "ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
        (_PHASE_STORAGE_KEY, str(phase)),
    )
    conn.commit()
    conn.close()


def check_phase_transition() -> dict | None:
    """Check if tier phase has changed since last check."""
    config = get_tier_config()
    current_phase = config["phase"]
    stored_phase = _get_stored_phase()

    if stored_phase is None:
        _set_stored_phase(current_phase)
        return None

    if current_phase == stored_phase:
        return None

    _set_stored_phase(current_phase)

    phase_names_zh = {1: "试运营", 2: "成长期", 3: "上升期", 4: "正式运营"}
    phase_names_en = {1: "Cold Start", 2: "Growth", 3: "Production", 4: "Dynamic Percentile"}

    title_zh = f"等级制度已升级至第 {current_phase} 阶段"
    title_en = f"Tier system upgraded to Phase {current_phase}"
    body_zh = (
        f"随着用户规模增长，等级制度已从「{phase_names_zh.get(stored_phase, '')}」"
        f"切换至「{phase_names_zh.get(current_phase, '')}」阶段。"
        f"新阈值：稀有 {config['thresholds']['rare']}、"
        f"史诗 {config['thresholds']['epic']}、"
        f"传说 {config['thresholds']['legendary']}。"
    )
    body_en = (
        f"As the user base grows, the tier system has transitioned from "
        f"'{phase_names_en.get(stored_phase, '')}' to '{phase_names_en.get(current_phase, '')}'. "
        f"New thresholds: Rare {config['thresholds']['rare']}, "
        f"Epic {config['thresholds']['epic']}, "
        f"Legendary {config['thresholds']['legendary']}."
    )

    create_broadcast_notification("phase_change", title_zh, title_en, body_zh, body_en)

    import datetime
    ann_id = f"phase-{current_phase}-{datetime.date.today().isoformat()}"
    create_announcement(
        ann_id, datetime.date.today().isoformat(), "improvement",
        title_zh, title_en, body_zh, body_en, sort_order=0,
    )

    return {"old_phase": stored_phase, "new_phase": current_phase, "config": config}


# ── Events (analytics) ──

def record_events(user_id: int | None, events_list: list[dict]) -> int:
    if not events_list:
        return 0
    conn = _get_conn()
    count = 0
    for ev in events_list:
        etype = ev.get("event_type", "")
        pid = ev.get("persona_id")
        if etype not in ("view", "click", "save") or not pid:
            continue
        conn.execute(
            "INSERT INTO events (user_id, event_type, persona_id) VALUES (%s, %s, %s)",
            (user_id, etype, pid),
        )
        count += 1
    conn.commit()
    conn.close()
    return count


def get_event_stats(days: int = 7) -> dict:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT event_type, COUNT(*) as cnt "
        "FROM events WHERE created_at >= NOW() - make_interval(days => %s) "
        "GROUP BY event_type",
        (days,),
    ).fetchall()
    daily = conn.execute(
        "SELECT created_at::date as day, event_type, COUNT(*) as cnt "
        "FROM events WHERE created_at >= NOW() - make_interval(days => %s) "
        "GROUP BY created_at::date, event_type ORDER BY day",
        (days,),
    ).fetchall()
    conn.close()
    return {
        "totals": {r["event_type"]: r["cnt"] for r in rows},
        "daily": [{"date": str(r["day"]), "type": r["event_type"], "count": r["cnt"]} for r in daily],
    }


# ── Discovery streams ──

def list_shared_personas_hot(limit: int = 50, offset: int = 0,
                              tag: str = "", card_type: str = "",
                              current_user_id: int | None = None) -> list[dict]:
    """Hot stream: time-decayed popularity (Hacker News-style gravity)."""
    conn = _get_conn()
    conditions, params = _build_persona_filters(tag, card_type)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    legendary_threshold = _get_legendary_threshold()

    mythic_cte = (
        f"WITH mythic_ranks AS ("
        f"  SELECT id, ROW_NUMBER() OVER (ORDER BY likes DESC) as mythic_rank "
        f"  FROM shared_personas WHERE likes >= {legendary_threshold} "
        f"  LIMIT {_MYTHIC_TOP_N}"
        f")"
    )

    rows = conn.execute(
        f"{mythic_cte} "
        f"SELECT sp.id, sp.name, sp.summary, sp.tags, sp.spec_data, sp.natural_text, "
        f"sp.score, sp.language, sp.likes, sp.created_at, sp.user_id, sp.card_type, "
        f"u.username as author, mr.mythic_rank, "
        f"(sp.likes + 1.0) / POWER(EXTRACT(EPOCH FROM (NOW() - sp.created_at)) / 3600 + 2, 1.5) as hot_score "
        f"FROM shared_personas sp "
        f"JOIN users u ON sp.user_id = u.id "
        f"LEFT JOIN mythic_ranks mr ON sp.id = mr.id "
        f"{where} "
        f"ORDER BY hot_score DESC "
        f"LIMIT %s OFFSET %s",
        params + [limit, offset],
    ).fetchall()
    return _format_persona_rows(conn, rows, current_user_id)


def list_shared_personas_rising(limit: int = 50, offset: int = 0,
                                 tag: str = "", card_type: str = "",
                                 current_user_id: int | None = None) -> list[dict]:
    """Rising stream: personas with most likes gained in recent 72 hours."""
    conn = _get_conn()
    conditions, params = _build_persona_filters(tag, card_type)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    legendary_threshold = _get_legendary_threshold()

    mythic_cte = (
        f"WITH mythic_ranks AS ("
        f"  SELECT id, ROW_NUMBER() OVER (ORDER BY likes DESC) as mythic_rank "
        f"  FROM shared_personas WHERE likes >= {legendary_threshold} "
        f"  LIMIT {_MYTHIC_TOP_N}"
        f"), recent_likes AS ("
        f"  SELECT persona_id, COUNT(*) as recent_count "
        f"  FROM persona_likes "
        f"  WHERE created_at >= NOW() - INTERVAL '3 days' "
        f"  GROUP BY persona_id"
        f")"
    )

    rows = conn.execute(
        f"{mythic_cte} "
        f"SELECT sp.id, sp.name, sp.summary, sp.tags, sp.spec_data, sp.natural_text, "
        f"sp.score, sp.language, sp.likes, sp.created_at, sp.user_id, sp.card_type, "
        f"u.username as author, mr.mythic_rank, "
        f"COALESCE(rl.recent_count, 0) as rising_score "
        f"FROM shared_personas sp "
        f"JOIN users u ON sp.user_id = u.id "
        f"LEFT JOIN mythic_ranks mr ON sp.id = mr.id "
        f"LEFT JOIN recent_likes rl ON sp.id = rl.persona_id "
        f"{where} "
        f"ORDER BY rising_score DESC, sp.created_at DESC "
        f"LIMIT %s OFFSET %s",
        params + [limit, offset],
    ).fetchall()
    return _format_persona_rows(conn, rows, current_user_id)


def list_shared_personas_explore(limit: int = 50, offset: int = 0,
                                  tag: str = "", card_type: str = "",
                                  current_user_id: int | None = None) -> list[dict]:
    """Explore stream: random long-tail discovery with author dedup."""
    conn = _get_conn()
    conditions, params = _build_persona_filters(tag, card_type)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    legendary_threshold = _get_legendary_threshold()

    mythic_cte = (
        f"WITH mythic_ranks AS ("
        f"  SELECT id, ROW_NUMBER() OVER (ORDER BY likes DESC) as mythic_rank "
        f"  FROM shared_personas WHERE likes >= {legendary_threshold} "
        f"  LIMIT {_MYTHIC_TOP_N}"
        f"), author_ranked AS ("
        f"  SELECT sp.*, u.username as author, "
        f"  ROW_NUMBER() OVER (PARTITION BY sp.user_id ORDER BY RANDOM()) as author_rn "
        f"  FROM shared_personas sp "
        f"  JOIN users u ON sp.user_id = u.id "
        f"  {where}"
        f")"
    )

    rows = conn.execute(
        f"{mythic_cte} "
        f"SELECT ar.id, ar.name, ar.summary, ar.tags, ar.spec_data, ar.natural_text, "
        f"ar.score, ar.language, ar.likes, ar.created_at, ar.user_id, ar.card_type, "
        f"ar.author, mr.mythic_rank "
        f"FROM author_ranked ar "
        f"LEFT JOIN mythic_ranks mr ON ar.id = mr.id "
        f"WHERE ar.author_rn <= 2 "
        f"ORDER BY RANDOM() "
        f"LIMIT %s OFFSET %s",
        params + [limit, offset],
    ).fetchall()
    return _format_persona_rows(conn, rows, current_user_id)


def _build_persona_filters(tag: str = "", card_type: str = "") -> tuple[list[str], list]:
    conditions: list[str] = []
    params: list = []
    if tag:
        conditions.append("sp.tags LIKE %s")
        params.append(f'%"{tag}"%')
    if card_type:
        conditions.append("sp.card_type = %s")
        params.append(card_type)
    return conditions, params


def _format_persona_rows(conn: psycopg.Connection, rows: list,
                          current_user_id: int | None) -> list[dict]:
    result = []
    for r in rows:
        d = dict(r)
        d["tags"] = json.loads(d["tags"]) if isinstance(d["tags"], str) else d["tags"]
        d["spec_data"] = json.loads(d["spec_data"]) if isinstance(d["spec_data"], str) else d["spec_data"]
        d["mythic_rank"] = d.get("mythic_rank") or None
        d.pop("hot_score", None)
        d.pop("rising_score", None)
        d.pop("author_rn", None)
        if d.get("created_at"):
            d["created_at"] = str(d["created_at"])
        if current_user_id:
            liked = conn.execute(
                "SELECT 1 FROM persona_likes WHERE user_id = %s AND persona_id = %s",
                (current_user_id, d["id"]),
            ).fetchone()
            d["liked"] = liked is not None
        else:
            d["liked"] = False
        result.append(d)
    conn.close()
    return result


# ── User collections (favorites) ─────────────────────────────────────
def add_to_collection(user_id: int, name: str, tags: list[str], score: float,
                      language: str, candidate_data: dict, note: str = "") -> int:
    conn = _get_conn()
    row = conn.execute(
        """INSERT INTO user_collections (user_id, name, tags, score, language, candidate_data, note)
           VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
        (user_id, name, json.dumps(tags, ensure_ascii=False), score, language,
         json.dumps(candidate_data, ensure_ascii=False), note),
    ).fetchone()
    cid = row["id"] if row else 0
    conn.commit()
    conn.close()
    return cid


def list_collection(user_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM user_collections WHERE user_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
        (user_id, limit, offset),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["tags"] = json.loads(d.get("tags") or "[]") if isinstance(d.get("tags"), str) else d.get("tags", [])
        d["candidate_data"] = json.loads(d.get("candidate_data") or "{}") if isinstance(d.get("candidate_data"), str) else d.get("candidate_data", {})
        if d.get("created_at"):
            d["created_at"] = str(d["created_at"])
        result.append(d)
    return result


def get_collection_ids(user_id: int) -> set[str]:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT candidate_data FROM user_collections WHERE user_id = %s",
        (user_id,),
    ).fetchall()
    conn.close()
    ids = set()
    for r in rows:
        raw = r["candidate_data"]
        data = json.loads(raw) if isinstance(raw, str) else (raw or {})
        cid = data.get("id")
        if cid:
            ids.add(cid)
    return ids


def remove_from_collection(user_id: int, collection_id: int) -> bool:
    conn = _get_conn()
    cur = conn.execute(
        "DELETE FROM user_collections WHERE id = %s AND user_id = %s",
        (collection_id, user_id),
    )
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


def remove_from_collection_by_candidate(user_id: int, candidate_id: str) -> bool:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, candidate_data FROM user_collections WHERE user_id = %s",
        (user_id,),
    ).fetchall()
    for r in rows:
        raw = r["candidate_data"]
        data = json.loads(raw) if isinstance(raw, str) else (raw or {})
        if data.get("id") == candidate_id:
            conn.execute("DELETE FROM user_collections WHERE id = %s", (r["id"],))
            conn.commit()
            conn.close()
            return True
    conn.close()
    return False


def get_collection_count(user_id: int) -> int:
    conn = _get_conn()
    row = conn.execute(
        "SELECT COUNT(*) as cnt FROM user_collections WHERE user_id = %s",
        (user_id,),
    ).fetchone()
    conn.close()
    return row["cnt"] if row else 0


def clear_collection(user_id: int) -> int:
    conn = _get_conn()
    cur = conn.execute("DELETE FROM user_collections WHERE user_id = %s", (user_id,))
    count = cur.rowcount
    conn.commit()
    conn.close()
    return count


def _migrate_encrypt_configs() -> None:
    """One-time migration: encrypt any plaintext config_data rows."""
    conn = _get_conn()
    rows = conn.execute("SELECT id, config_data FROM user_configs").fetchall()
    for row in rows:
        data = row["config_data"]
        if data and not data.startswith(_ENC_PREFIX):
            encrypted = _encrypt_config(data)
            conn.execute(
                "UPDATE user_configs SET config_data = %s WHERE id = %s",
                (encrypted, row["id"]),
            )
    conn.commit()
    conn.close()


# ── Email verification codes ──────────────────────────────────────────
def create_email_code(user_id: int, email: str, code: str, purpose: str = "verify",
                      ttl_minutes: int = 15) -> int:
    """Insert a verification/reset code. Returns row id."""
    from datetime import datetime, timedelta, timezone
    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    conn = _get_conn()
    row = conn.execute(
        "INSERT INTO email_codes (user_id, email, code, purpose, expires_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (user_id, email, code, purpose, expires),
    ).fetchone()
    cid = row["id"] if row else 0
    conn.commit()
    conn.close()
    return cid


def verify_email_code(email: str, code: str, purpose: str = "verify") -> int | None:
    """Check code validity. Returns user_id if valid, None otherwise. Marks code as used."""
    from datetime import datetime, timezone
    conn = _get_conn()
    row = conn.execute(
        """SELECT id, user_id, expires_at FROM email_codes
           WHERE email = %s AND code = %s AND purpose = %s AND used = 0
           ORDER BY created_at DESC LIMIT 1""",
        (email, code, purpose),
    ).fetchone()
    if row is None:
        conn.close()
        return None
    expires = row["expires_at"]
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires:
        conn.close()
        return None
    conn.execute("UPDATE email_codes SET used = 1 WHERE id = %s", (row["id"],))
    conn.commit()
    conn.close()
    return row["user_id"]


def set_email_verified(user_id: int) -> None:
    conn = _get_conn()
    conn.execute("UPDATE users SET email_verified = 1 WHERE id = %s", (user_id,))
    conn.commit()
    conn.close()


def is_email_verified(user_id: int) -> bool:
    conn = _get_conn()
    row = conn.execute("SELECT email_verified FROM users WHERE id = %s", (user_id,)).fetchone()
    conn.close()
    return bool(row and row["email_verified"])


def get_user_email(user_id: int) -> str | None:
    conn = _get_conn()
    row = conn.execute("SELECT email FROM users WHERE id = %s", (user_id,)).fetchone()
    conn.close()
    return row["email"] if row and row["email"] else None


def get_user_by_email(email: str) -> dict | None:
    """Find user by email. Returns {id, username, email} or None."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT id, username, email FROM users WHERE email = %s", (email,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def reset_password(user_id: int, new_password: str) -> None:
    """Reset a user's password (for forgot-password flow)."""
    salt = secrets.token_hex(16)
    pw_hash = _hash_password(new_password, salt)
    conn = _get_conn()
    conn.execute(
        "UPDATE users SET password_hash = %s, salt = %s WHERE id = %s",
        (pw_hash, salt, user_id),
    )
    conn.commit()
    conn.close()


def create_register_code(email: str, code: str, ttl_minutes: int = 15) -> int:
    """Insert a registration verification code (no user yet, user_id=0). Returns row id."""
    from datetime import datetime, timedelta, timezone
    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    conn = _get_conn()
    row = conn.execute(
        "INSERT INTO email_codes (user_id, email, code, purpose, expires_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (0, email, code, "register", expires),
    ).fetchone()
    cid = row["id"] if row else 0
    conn.commit()
    conn.close()
    return cid


def verify_register_code(email: str, code: str) -> bool:
    """Check registration code validity. Returns True if valid, marks code as used."""
    from datetime import datetime, timezone
    conn = _get_conn()
    row = conn.execute(
        """SELECT id, expires_at FROM email_codes
           WHERE email = %s AND code = %s AND purpose = 'register' AND used = 0
           ORDER BY created_at DESC LIMIT 1""",
        (email, code),
    ).fetchone()
    if row is None:
        conn.close()
        return False
    expires = row["expires_at"]
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires:
        conn.close()
        return False
    conn.execute("UPDATE email_codes SET used = 1 WHERE id = %s", (row["id"],))
    conn.commit()
    conn.close()
    return True


def is_email_taken(email: str) -> bool:
    """Check if email is already registered."""
    conn = _get_conn()
    row = conn.execute("SELECT 1 as x FROM users WHERE email = %s", (email,)).fetchone()
    conn.close()
    return row is not None


def is_username_taken(username: str) -> bool:
    """Check if username is already taken."""
    conn = _get_conn()
    row = conn.execute("SELECT 1 as x FROM users WHERE username = %s", (username,)).fetchone()
    conn.close()
    return row is not None


def cleanup_expired_codes() -> int:
    """Remove expired codes. Returns deleted count."""
    conn = _get_conn()
    cur = conn.execute(
        "DELETE FROM email_codes WHERE expires_at < NOW() OR used = 1",
    )
    count = cur.rowcount
    conn.commit()
    conn.close()
    return count


# Auto-initialize on import
init_db()
_migrate_encrypt_configs()

"""
Persona Forge — 用户认证与数据持久化 (SQLite)
"""
from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
from pathlib import Path

_DB_PATH = Path(__file__).parent / "data" / "persona_forge.db"


def _get_conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            avatar_url TEXT NOT NULL DEFAULT '',
            bio TEXT NOT NULL DEFAULT '',
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS user_card_overrides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            card_id TEXT NOT NULL,
            custom_data TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, card_id)
        );
        CREATE TABLE IF NOT EXISTS user_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            config_data TEXT NOT NULL DEFAULT '{}',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS generation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            concept TEXT NOT NULL,
            language TEXT NOT NULL DEFAULT 'zh',
            candidate_count INTEGER NOT NULL DEFAULT 1,
            result_data TEXT NOT NULL DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS announcements (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'feature',
            title_zh TEXT NOT NULL DEFAULT '',
            title_en TEXT NOT NULL DEFAULT '',
            body_zh TEXT NOT NULL DEFAULT '',
            body_en TEXT NOT NULL DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS user_card_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            group_id TEXT NOT NULL,
            group_name TEXT NOT NULL,
            card_ids TEXT NOT NULL DEFAULT '[]',
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, group_id)
        );
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            char_name TEXT NOT NULL,
            system_prompt TEXT NOT NULL DEFAULT '',
            messages TEXT NOT NULL DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS shared_personas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            summary TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]',
            spec_data TEXT NOT NULL DEFAULT '{}',
            natural_text TEXT NOT NULL DEFAULT '',
            score REAL NOT NULL DEFAULT 0,
            language TEXT NOT NULL DEFAULT 'zh',
            likes INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS persona_likes (
            user_id INTEGER NOT NULL,
            persona_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, persona_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (persona_id) REFERENCES shared_personas(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()


def create_user(username: str, password: str) -> int | None:
    """Create a user. Returns user_id on success, None if username is taken."""
    salt = secrets.token_hex(16)
    pw_hash = _hash_password(password, salt)
    conn = _get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)",
            (username, pw_hash, salt),
        )
        uid = cur.lastrowid
        # First registered user (id=1) is auto-admin
        if uid == 1:
            conn.execute("UPDATE users SET is_admin = 1 WHERE id = 1")
        conn.commit()
        return uid
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()


def authenticate(username: str, password: str) -> int | None:
    """Returns user_id if credentials are valid, else None."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT id, password_hash, salt FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    conn.close()
    if row is None:
        return None
    if _hash_password(password, row["salt"]) == row["password_hash"]:
        return row["id"]
    return None


def get_card_overrides(user_id: int) -> dict[str, dict]:
    """Returns {card_id: custom_data_dict} for the given user."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT card_id, custom_data FROM user_card_overrides WHERE user_id = ?",
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
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, card_id) DO UPDATE SET
               custom_data = excluded.custom_data,
               updated_at = CURRENT_TIMESTAMP""",
        (user_id, card_id, json.dumps(custom_data, ensure_ascii=False)),
    )
    conn.commit()
    conn.close()


def delete_card_override(user_id: int, card_id: str) -> None:
    """Remove a per-user card override (reset to default)."""
    conn = _get_conn()
    conn.execute(
        "DELETE FROM user_card_overrides WHERE user_id = ? AND card_id = ?",
        (user_id, card_id),
    )
    conn.commit()
    conn.close()


def get_card_groups(user_id: int) -> list[dict]:
    """Returns list of {group_id, group_name, card_ids, sort_order} for the user."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT group_id, group_name, card_ids, sort_order "
        "FROM user_card_groups WHERE user_id = ? ORDER BY sort_order",
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
    conn.execute("DELETE FROM user_card_groups WHERE user_id = ?", (user_id,))
    for i, g in enumerate(groups):
        conn.execute(
            "INSERT INTO user_card_groups (user_id, group_id, group_name, card_ids, sort_order) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, g["group_id"], g["group_name"],
             json.dumps(g.get("card_ids", []), ensure_ascii=False), i),
        )
    conn.commit()
    conn.close()


def get_user_config(user_id: int) -> dict:
    """Returns the user's saved config dict."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT config_data FROM user_configs WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    conn.close()
    if row is None:
        return {}
    try:
        return json.loads(row["config_data"])
    except json.JSONDecodeError:
        return {}


def save_user_config(user_id: int, config_data: dict) -> None:
    """Insert or update the user's config."""
    conn = _get_conn()
    conn.execute(
        """INSERT INTO user_configs (user_id, config_data, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET
               config_data = excluded.config_data,
               updated_at = CURRENT_TIMESTAMP""",
        (user_id, json.dumps(config_data, ensure_ascii=False)),
    )
    conn.commit()
    conn.close()


def change_password(user_id: int, old_password: str, new_password: str) -> bool:
    """Change user password. Returns True on success, False if old password is wrong."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT password_hash, salt FROM users WHERE id = ?", (user_id,)
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
        "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
        (new_hash, new_salt, user_id),
    )
    conn.commit()
    conn.close()
    return True


def save_generation(user_id: int, concept: str, language: str, count: int, result_data: dict) -> int:
    """Save a generation result. Returns the new record id."""
    conn = _get_conn()
    cur = conn.execute(
        "INSERT INTO generation_history (user_id, concept, language, candidate_count, result_data) VALUES (?, ?, ?, ?, ?)",
        (user_id, concept, language, count, json.dumps(result_data, ensure_ascii=False)),
    )
    conn.commit()
    rid = cur.lastrowid
    conn.close()
    return rid or 0


def get_generation_history(user_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
    """Returns generation history for the user, newest first."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, concept, language, candidate_count, result_data, created_at "
        "FROM generation_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
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
            "created_at": row["created_at"],
        })
    return result


def delete_generation(user_id: int, record_id: int) -> bool:
    """Delete a generation record. Returns True if deleted."""
    conn = _get_conn()
    cur = conn.execute(
        "DELETE FROM generation_history WHERE id = ? AND user_id = ?",
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
        "FROM generation_history WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    user_row = conn.execute(
        "SELECT created_at FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    conn.close()
    return {
        "total_generations": row["total"] if row else 0,
        "total_candidates": row["total_candidates"] if row else 0,
        "member_since": user_row["created_at"] if user_row else None,
    }


def _migrate_users_table() -> None:
    """Add avatar_url, bio, is_admin columns if they don't exist (for existing DBs)."""
    conn = _get_conn()
    try:
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "avatar_url" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''")
        if "bio" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''")
        if "is_admin" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
            # First user is auto-admin
            conn.execute("UPDATE users SET is_admin = 1 WHERE id = 1")
        conn.commit()
    finally:
        conn.close()


def is_admin(user_id: int) -> bool:
    """Check if the user is an admin."""
    conn = _get_conn()
    row = conn.execute("SELECT is_admin FROM users WHERE id = ?", (user_id,)).fetchone()
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
    return [dict(r) for r in rows]


def create_announcement(ann_id: str, date: str, ann_type: str,
                        title_zh: str, title_en: str,
                        body_zh: str, body_en: str, sort_order: int = 0) -> None:
    conn = _get_conn()
    conn.execute(
        "INSERT INTO announcements (id, date, type, title_zh, title_en, body_zh, body_en, sort_order) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (ann_id, date, ann_type, title_zh, title_en, body_zh, body_en, sort_order),
    )
    conn.commit()
    conn.close()


def update_announcement(ann_id: str, date: str, ann_type: str,
                        title_zh: str, title_en: str,
                        body_zh: str, body_en: str, sort_order: int = 0) -> bool:
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE announcements SET date=?, type=?, title_zh=?, title_en=?, "
        "body_zh=?, body_en=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (date, ann_type, title_zh, title_en, body_zh, body_en, sort_order, ann_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def delete_announcement(ann_id: str) -> bool:
    conn = _get_conn()
    cur = conn.execute("DELETE FROM announcements WHERE id = ?", (ann_id,))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def get_user_profile(user_id: int) -> dict | None:
    """Returns user profile info (username, avatar_url, bio, created_at)."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT username, avatar_url, bio, created_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return {
        "username": row["username"],
        "avatar_url": row["avatar_url"],
        "bio": row["bio"],
        "created_at": row["created_at"],
    }


def update_user_profile(user_id: int, avatar_url: str | None = None, bio: str | None = None) -> bool:
    """Update user profile fields. Returns True on success."""
    conn = _get_conn()
    fields = []
    values: list = []
    if avatar_url is not None:
        fields.append("avatar_url = ?")
        values.append(avatar_url)
    if bio is not None:
        fields.append("bio = ?")
        values.append(bio)
    if not fields:
        conn.close()
        return True
    values.append(user_id)
    conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return True


def delete_user(user_id: int) -> bool:
    """Delete a user and all related data (CASCADE). Returns True if deleted."""
    conn = _get_conn()
    cur = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


# ── Admin: user management ──

def list_users() -> list[dict]:
    """Returns all users with basic info for admin panel."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT u.id, u.username, u.is_admin, u.created_at, "
        "COALESCE(g.gen_count, 0) as generation_count "
        "FROM users u "
        "LEFT JOIN (SELECT user_id, COUNT(*) as gen_count FROM generation_history GROUP BY user_id) g "
        "ON u.id = g.user_id "
        "ORDER BY u.id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def set_admin(user_id: int, is_admin_val: bool) -> bool:
    """Set or revoke admin status. Returns True if user exists."""
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE users SET is_admin = ? WHERE id = ?",
        (1 if is_admin_val else 0, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def clear_generation_history(user_id: int) -> int:
    """Delete all generation history for a user. Returns number of deleted records."""
    conn = _get_conn()
    cur = conn.execute("DELETE FROM generation_history WHERE user_id = ?", (user_id,))
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


# ── Shared personas (community) ──

def share_persona(user_id: int, name: str, summary: str, tags: list[str],
                  spec_data: dict, natural_text: str, score: float, language: str) -> int:
    """Share a persona to the community. Returns persona id."""
    conn = _get_conn()
    cur = conn.execute(
        "INSERT INTO shared_personas (user_id, name, summary, tags, spec_data, natural_text, score, language) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, name, summary, json.dumps(tags), json.dumps(spec_data), natural_text, score, language),
    )
    conn.commit()
    pid = cur.lastrowid
    conn.close()
    return pid


def list_shared_personas(limit: int = 50, offset: int = 0, sort: str = "latest",
                         tag: str = "", current_user_id: int | None = None) -> list[dict]:
    """List shared personas with author info and like status."""
    conn = _get_conn()
    where = ""
    params: list = []
    if tag:
        where = "WHERE sp.tags LIKE ?"
        params.append(f'%"{tag}"%')

    order = "sp.created_at DESC" if sort == "latest" else "sp.likes DESC, sp.created_at DESC"

    rows = conn.execute(
        f"SELECT sp.id, sp.name, sp.summary, sp.tags, sp.spec_data, sp.natural_text, "
        f"sp.score, sp.language, sp.likes, sp.created_at, sp.user_id, "
        f"u.username as author "
        f"FROM shared_personas sp "
        f"JOIN users u ON sp.user_id = u.id "
        f"{where} "
        f"ORDER BY {order} "
        f"LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()

    result = []
    for r in rows:
        d = dict(r)
        d["tags"] = json.loads(d["tags"])
        d["spec_data"] = json.loads(d["spec_data"])
        # Check if current user liked this persona
        if current_user_id:
            liked = conn.execute(
                "SELECT 1 FROM persona_likes WHERE user_id = ? AND persona_id = ?",
                (current_user_id, d["id"]),
            ).fetchone()
            d["liked"] = liked is not None
        else:
            d["liked"] = False
        result.append(d)

    conn.close()
    return result


def toggle_persona_like(user_id: int, persona_id: int) -> bool:
    """Toggle like on a persona. Returns True if now liked, False if unliked."""
    conn = _get_conn()
    existing = conn.execute(
        "SELECT 1 FROM persona_likes WHERE user_id = ? AND persona_id = ?",
        (user_id, persona_id),
    ).fetchone()

    if existing:
        conn.execute("DELETE FROM persona_likes WHERE user_id = ? AND persona_id = ?",
                      (user_id, persona_id))
        conn.execute("UPDATE shared_personas SET likes = likes - 1 WHERE id = ?", (persona_id,))
        liked = False
    else:
        conn.execute("INSERT INTO persona_likes (user_id, persona_id) VALUES (?, ?)",
                      (user_id, persona_id))
        conn.execute("UPDATE shared_personas SET likes = likes + 1 WHERE id = ?", (persona_id,))
        liked = True

    conn.commit()
    conn.close()
    return liked


def delete_shared_persona(user_id: int, persona_id: int) -> bool:
    """Delete a shared persona (only by owner). Returns True if deleted."""
    conn = _get_conn()
    cur = conn.execute(
        "DELETE FROM shared_personas WHERE id = ? AND user_id = ?",
        (persona_id, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def get_shared_persona_count() -> int:
    """Get total number of shared personas."""
    conn = _get_conn()
    row = conn.execute("SELECT COUNT(*) as cnt FROM shared_personas").fetchone()
    conn.close()
    return row["cnt"]


# ── Admin stats ──

def get_admin_stats() -> dict:
    """Get admin dashboard statistics."""
    conn = _get_conn()
    users = conn.execute("SELECT COUNT(*) as cnt FROM users").fetchone()["cnt"]
    generations = conn.execute("SELECT COUNT(*) as cnt FROM generation_history").fetchone()["cnt"]
    shared = conn.execute("SELECT COUNT(*) as cnt FROM shared_personas").fetchone()["cnt"]
    today_users = conn.execute(
        "SELECT COUNT(*) as cnt FROM users WHERE date(created_at) = date('now')"
    ).fetchone()["cnt"]
    today_generations = conn.execute(
        "SELECT COUNT(*) as cnt FROM generation_history WHERE date(created_at) = date('now')"
    ).fetchone()["cnt"]
    # Recent 7-day generation trend
    trend = conn.execute(
        "SELECT date(created_at) as day, COUNT(*) as cnt "
        "FROM generation_history "
        "WHERE created_at >= datetime('now', '-7 days') "
        "GROUP BY date(created_at) ORDER BY day"
    ).fetchall()
    conn.close()
    return {
        "total_users": users,
        "total_generations": generations,
        "total_shared": shared,
        "today_users": today_users,
        "today_generations": today_generations,
        "generation_trend": [{"date": r["day"], "count": r["cnt"]} for r in trend],
    }


# ── Chat sessions ──

def create_chat_session(user_id: int, char_name: str, system_prompt: str,
                        messages: list[dict]) -> int:
    """Create a new chat session. Returns session id."""
    conn = _get_conn()
    cur = conn.execute(
        "INSERT INTO chat_sessions (user_id, char_name, system_prompt, messages) "
        "VALUES (?, ?, ?, ?)",
        (user_id, char_name, system_prompt, json.dumps(messages, ensure_ascii=False)),
    )
    conn.commit()
    sid = cur.lastrowid
    conn.close()
    return sid or 0


def list_chat_sessions(user_id: int, limit: int = 50) -> list[dict]:
    """Returns chat sessions for the user, newest first."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, char_name, messages, created_at, updated_at "
        "FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
        (user_id, limit),
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
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        })
    return result


def get_chat_session(user_id: int, session_id: int) -> dict | None:
    """Returns full session data including messages."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT id, char_name, system_prompt, messages, created_at, updated_at "
        "FROM chat_sessions WHERE id = ? AND user_id = ?",
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
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def update_chat_session(user_id: int, session_id: int, messages: list[dict]) -> bool:
    """Update messages in a chat session. Returns True if updated."""
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE chat_sessions SET messages = ?, updated_at = CURRENT_TIMESTAMP "
        "WHERE id = ? AND user_id = ?",
        (json.dumps(messages, ensure_ascii=False), session_id, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def delete_chat_session(user_id: int, session_id: int) -> bool:
    """Delete a chat session. Returns True if deleted."""
    conn = _get_conn()
    cur = conn.execute(
        "DELETE FROM chat_sessions WHERE id = ? AND user_id = ?",
        (session_id, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def clear_chat_sessions(user_id: int) -> int:
    """Delete all chat sessions for a user. Returns count deleted."""
    conn = _get_conn()
    cur = conn.execute("DELETE FROM chat_sessions WHERE user_id = ?", (user_id,))
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


# Auto-initialize on import
init_db()
_migrate_users_table()

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
        conn.commit()
        return cur.lastrowid
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


# Auto-initialize on import
init_db()

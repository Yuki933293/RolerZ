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
            email TEXT UNIQUE DEFAULT NULL,
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
    # Migration: add email column for existing databases
    try:
        conn.execute("ALTER TABLE users ADD COLUMN email TEXT UNIQUE DEFAULT NULL")
    except sqlite3.OperationalError:
        pass  # column already exists
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
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, salt, email) VALUES (?, ?, ?, ?)",
            (username, pw_hash, salt, email or None),
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


def authenticate(username: str, password: str) -> tuple[int, str] | None:
    """Returns (user_id, username) if credentials are valid, else None.
    Accepts username or email as the login identifier."""
    conn = _get_conn()
    # Try username first, then email
    row = conn.execute(
        "SELECT id, username, password_hash, salt FROM users WHERE username = ? OR email = ?",
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


def _migrate_shared_personas_table() -> None:
    """Add card_type column to shared_personas if it doesn't exist."""
    conn = _get_conn()
    try:
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(shared_personas)").fetchall()]
        if "card_type" not in cols:
            conn.execute("ALTER TABLE shared_personas ADD COLUMN card_type TEXT NOT NULL DEFAULT ''")
        conn.commit()
    finally:
        conn.close()


def _migrate_chat_sessions_table() -> None:
    """Add hidden column to chat_sessions if it doesn't exist."""
    conn = _get_conn()
    try:
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(chat_sessions)").fetchall()]
        if "hidden" not in cols:
            conn.execute("ALTER TABLE chat_sessions ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0")
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
    """Returns user profile info (username, email, avatar_url, bio, created_at)."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT username, email, avatar_url, bio, created_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return {
        "username": row["username"],
        "email": row["email"] or "",
        "avatar_url": row["avatar_url"],
        "bio": row["bio"],
        "created_at": row["created_at"],
    }


def update_user_profile(user_id: int, avatar_url: str | None = None, bio: str | None = None, email: str | None = None) -> bool:
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
    if email is not None:
        fields.append("email = ?")
        values.append(email if email else None)
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
        "SELECT u.id, u.username, u.email, u.is_admin, u.created_at, "
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
                  spec_data: dict, natural_text: str, score: float, language: str,
                  card_type: str = "") -> int:
    """Share a persona to the community. Returns persona id."""
    conn = _get_conn()
    cur = conn.execute(
        "INSERT INTO shared_personas (user_id, name, summary, tags, spec_data, natural_text, score, language, card_type) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, name, summary, json.dumps(tags), json.dumps(spec_data), natural_text, score, language, card_type),
    )
    conn.commit()
    pid = cur.lastrowid
    conn.close()
    return pid


# ── Tier system (4-phase dynamic thresholds) ──
_MYTHIC_TOP_N = 750

# Phase thresholds by user count
_TIER_PHASES = [
    # (max_users, rare, epic, legendary)
    (5_000,   10,    50,     200),      # Phase 1: cold start
    (50_000,  249,   2_499,  24_999),   # Phase 2: growth
    (100_000, 500,   5_000,  50_000),   # Phase 3: production
]
# Phase 4 (users >= 100K): percentile-based (rare=top50%, epic=top20%, legendary=top1%)


def _get_user_count(conn: sqlite3.Connection | None = None) -> int:
    """Get total registered user count."""
    own = conn is None
    if own:
        conn = _get_conn()
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if own:
        conn.close()
    return count


def get_tier_config() -> dict:
    """Return current tier thresholds based on user count.

    Returns: { phase: int, user_count: int, mythic_top_n: int,
               thresholds: { rare, epic, legendary },
               mode: 'fixed' | 'percentile' }
    """
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

    # Phase 4: percentile-based (users >= 100K)
    # rare=top50%, epic=top20%, legendary=top1%
    total_personas = conn.execute("SELECT COUNT(*) FROM shared_personas").fetchone()[0]
    if total_personas == 0:
        conn.close()
        return {
            "phase": 4, "user_count": user_count, "mythic_top_n": _MYTHIC_TOP_N,
            "thresholds": {"rare": 1, "epic": 1, "legendary": 1}, "mode": "percentile",
        }

    # Get likes at each percentile cutoff
    def _percentile_likes(pct: float) -> int:
        """Get the minimum likes needed to be in the top pct% of all personas."""
        offset = max(0, int(total_personas * (1 - pct)) - 1)
        row = conn.execute(
            "SELECT likes FROM shared_personas ORDER BY likes DESC LIMIT 1 OFFSET ?",
            (offset,),
        ).fetchone()
        return max(1, row[0] if row else 1)

    rare_threshold = _percentile_likes(0.50)     # top 50%
    epic_threshold = _percentile_likes(0.20)      # top 20%
    legendary_threshold = _percentile_likes(0.01) # top 1%
    conn.close()

    return {
        "phase": 4, "user_count": user_count, "mythic_top_n": _MYTHIC_TOP_N,
        "thresholds": {"rare": rare_threshold, "epic": epic_threshold, "legendary": legendary_threshold},
        "mode": "percentile",
    }


def _get_legendary_threshold() -> int:
    """Get current legendary threshold for mythic CTE."""
    config = get_tier_config()
    return config["thresholds"]["legendary"]


def list_shared_personas(limit: int = 50, offset: int = 0, sort: str = "latest",
                         tag: str = "", card_type: str = "",
                         current_user_id: int | None = None) -> list[dict]:
    """List shared personas with author info, like status, and mythic_rank.
    sort: 'latest' | 'popular' | 'hot' | 'rising' | 'explore'
    """
    # Delegate to specialized streams
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
        f"LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()
    return _format_persona_rows(conn, rows, current_user_id)


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


def list_chat_sessions(user_id: int, limit: int = 50,
                       visibility: str = "visible",
                       char_name: str | None = None) -> list[dict]:
    """Returns chat sessions for the user, newest first.
    visibility: 'visible' (hidden=0), 'hidden' (hidden=1), 'all'.
    char_name: filter by character name if provided.
    """
    conn = _get_conn()
    where = ["user_id = ?"]
    params: list = [user_id]
    if visibility == "visible":
        where.append("hidden = 0")
    elif visibility == "hidden":
        where.append("hidden = 1")
    if char_name:
        where.append("char_name = ?")
        params.append(char_name)
    params.append(limit)
    rows = conn.execute(
        f"SELECT id, char_name, messages, created_at, updated_at "
        f"FROM chat_sessions WHERE {' AND '.join(where)} ORDER BY updated_at DESC LIMIT ?",
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


def hide_chat_session(user_id: int, session_id: int, hidden: bool = True) -> bool:
    """Hide or unhide a chat session. Returns True if updated."""
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE chat_sessions SET hidden = ? WHERE id = ? AND user_id = ?",
        (1 if hidden else 0, session_id, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def batch_delete_chat_sessions(user_id: int, session_ids: list[int]) -> int:
    """Delete multiple chat sessions. Returns count deleted."""
    if not session_ids:
        return 0
    conn = _get_conn()
    placeholders = ",".join("?" for _ in session_ids)
    cur = conn.execute(
        f"DELETE FROM chat_sessions WHERE user_id = ? AND id IN ({placeholders})",
        [user_id] + session_ids,
    )
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


def clear_chat_sessions(user_id: int) -> int:
    """Delete all chat sessions for a user. Returns count deleted."""
    conn = _get_conn()
    cur = conn.execute("DELETE FROM chat_sessions WHERE user_id = ?", (user_id,))
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


# ── Notifications ──

def _migrate_notifications_table() -> None:
    """Create notifications table if it doesn't exist."""
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL DEFAULT 'info',
            title_zh TEXT NOT NULL DEFAULT '',
            title_en TEXT NOT NULL DEFAULT '',
            body_zh TEXT NOT NULL DEFAULT '',
            body_en TEXT NOT NULL DEFAULT '',
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user
            ON notifications(user_id, is_read, created_at DESC);
    """)
    conn.commit()
    conn.close()


def create_notification(user_id: int, ntype: str,
                        title_zh: str, title_en: str,
                        body_zh: str = "", body_en: str = "") -> int:
    """Create a notification for a user. Returns notification id."""
    conn = _get_conn()
    cur = conn.execute(
        "INSERT INTO notifications (user_id, type, title_zh, title_en, body_zh, body_en) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, ntype, title_zh, title_en, body_zh, body_en),
    )
    conn.commit()
    nid = cur.lastrowid
    conn.close()
    return nid or 0


def create_broadcast_notification(ntype: str,
                                  title_zh: str, title_en: str,
                                  body_zh: str = "", body_en: str = "") -> int:
    """Create a notification for ALL users. Returns count created."""
    conn = _get_conn()
    user_ids = [r[0] for r in conn.execute("SELECT id FROM users").fetchall()]
    for uid in user_ids:
        conn.execute(
            "INSERT INTO notifications (user_id, type, title_zh, title_en, body_zh, body_en) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (uid, ntype, title_zh, title_en, body_zh, body_en),
        )
    conn.commit()
    conn.close()
    return len(user_ids)


def list_notifications(user_id: int, limit: int = 30,
                       unread_only: bool = False) -> list[dict]:
    """List notifications for a user, newest first."""
    conn = _get_conn()
    where = "WHERE user_id = ?"
    params: list = [user_id]
    if unread_only:
        where += " AND is_read = 0"
    rows = conn.execute(
        f"SELECT id, type, title_zh, title_en, body_zh, body_en, is_read, created_at "
        f"FROM notifications {where} ORDER BY created_at DESC LIMIT ?",
        params + [limit],
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def count_unread_notifications(user_id: int) -> int:
    """Count unread notifications for a user."""
    conn = _get_conn()
    count = conn.execute(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0",
        (user_id,),
    ).fetchone()[0]
    conn.close()
    return count


def mark_notification_read(user_id: int, notification_id: int) -> bool:
    """Mark a single notification as read."""
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
        (notification_id, user_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def mark_all_notifications_read(user_id: int) -> int:
    """Mark all notifications as read. Returns count updated."""
    conn = _get_conn()
    cur = conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
        (user_id,),
    )
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


# ── Phase transition tracking ──

_PHASE_STORAGE_KEY = "tier_phase"


def _get_stored_phase() -> int | None:
    """Get last known tier phase from a simple key-value store."""
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    row = conn.execute("SELECT value FROM kv_store WHERE key = ?", (_PHASE_STORAGE_KEY,)).fetchone()
    conn.close()
    if row:
        return int(row[0])
    return None


def _set_stored_phase(phase: int) -> None:
    """Store current tier phase."""
    conn = _get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
        (_PHASE_STORAGE_KEY, str(phase)),
    )
    conn.commit()
    conn.close()


def check_phase_transition() -> dict | None:
    """Check if tier phase has changed since last check.
    Returns { old_phase, new_phase, config } if changed, None otherwise.
    Also creates a broadcast notification and announcement on transition.
    """
    config = get_tier_config()
    current_phase = config["phase"]
    stored_phase = _get_stored_phase()

    if stored_phase is None:
        # First run — just store current phase, no notification
        _set_stored_phase(current_phase)
        return None

    if current_phase == stored_phase:
        return None

    # Phase changed!
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

    # Broadcast notification to all users
    create_broadcast_notification("phase_change", title_zh, title_en, body_zh, body_en)

    # Auto-create announcement
    import datetime
    ann_id = f"phase-{current_phase}-{datetime.date.today().isoformat()}"
    create_announcement(
        ann_id,
        datetime.date.today().isoformat(),
        "improvement",
        title_zh, title_en, body_zh, body_en,
        sort_order=0,
    )

    return {"old_phase": stored_phase, "new_phase": current_phase, "config": config}


# ── Events (analytics) ──

def _migrate_events_table() -> None:
    """Create events table for view/click/save tracking."""
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            event_type TEXT NOT NULL,
            persona_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (persona_id) REFERENCES shared_personas(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_events_persona
            ON events(persona_id, event_type, created_at);
        CREATE INDEX IF NOT EXISTS idx_events_created
            ON events(created_at);
    """)
    conn.commit()
    conn.close()


def record_events(user_id: int | None, events_list: list[dict]) -> int:
    """Record a batch of events. Each event: {event_type, persona_id}.
    Returns count inserted."""
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
            "INSERT INTO events (user_id, event_type, persona_id) VALUES (?, ?, ?)",
            (user_id, etype, pid),
        )
        count += 1
    conn.commit()
    conn.close()
    return count


def get_event_stats(days: int = 7) -> dict:
    """Get aggregate event stats for admin dashboard."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT event_type, COUNT(*) as cnt "
        "FROM events WHERE created_at >= datetime('now', ?) "
        "GROUP BY event_type",
        (f"-{days} days",),
    ).fetchall()
    daily = conn.execute(
        "SELECT date(created_at) as day, event_type, COUNT(*) as cnt "
        "FROM events WHERE created_at >= datetime('now', ?) "
        "GROUP BY day, event_type ORDER BY day",
        (f"-{days} days",),
    ).fetchall()
    conn.close()
    return {
        "totals": {r["event_type"]: r["cnt"] for r in rows},
        "daily": [{"date": r["day"], "type": r["event_type"], "count": r["cnt"]} for r in daily],
    }


# ── Discovery streams ──

def list_shared_personas_hot(limit: int = 50, offset: int = 0,
                              tag: str = "", card_type: str = "",
                              current_user_id: int | None = None) -> list[dict]:
    """Hot stream: time-decayed popularity.
    Score = likes / (hours_since_creation + 2)^1.5  (Hacker News-style gravity)
    """
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
        f"(sp.likes + 1.0) / POWER((julianday('now') - julianday(sp.created_at)) * 24 + 2, 1.5) as hot_score "
        f"FROM shared_personas sp "
        f"JOIN users u ON sp.user_id = u.id "
        f"LEFT JOIN mythic_ranks mr ON sp.id = mr.id "
        f"{where} "
        f"ORDER BY hot_score DESC "
        f"LIMIT ? OFFSET ?",
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
        f"  WHERE created_at >= datetime('now', '-3 days') "
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
        f"LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()
    return _format_persona_rows(conn, rows, current_user_id)


def list_shared_personas_explore(limit: int = 50, offset: int = 0,
                                  tag: str = "", card_type: str = "",
                                  current_user_id: int | None = None) -> list[dict]:
    """Explore stream: random long-tail discovery with author dedup (max 2 per author)."""
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
        f"LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()
    return _format_persona_rows(conn, rows, current_user_id)


def _build_persona_filters(tag: str = "", card_type: str = "") -> tuple[list[str], list]:
    """Build WHERE conditions and params for persona queries."""
    conditions: list[str] = []
    params: list = []
    if tag:
        conditions.append("sp.tags LIKE ?")
        params.append(f'%"{tag}"%')
    if card_type:
        conditions.append("sp.card_type = ?")
        params.append(card_type)
    return conditions, params


def _format_persona_rows(conn: sqlite3.Connection, rows: list,
                          current_user_id: int | None) -> list[dict]:
    """Format persona rows with JSON parsing and like status."""
    result = []
    for r in rows:
        d = dict(r)
        d["tags"] = json.loads(d["tags"])
        d["spec_data"] = json.loads(d["spec_data"])
        d["mythic_rank"] = d.get("mythic_rank") or None
        # Remove internal scoring columns
        d.pop("hot_score", None)
        d.pop("rising_score", None)
        d.pop("author_rn", None)
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


# Auto-initialize on import
init_db()
_migrate_users_table()
_migrate_shared_personas_table()
_migrate_chat_sessions_table()
_migrate_notifications_table()
_migrate_events_table()

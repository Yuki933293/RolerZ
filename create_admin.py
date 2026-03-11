#!/usr/bin/env python3
"""
RolerZ — CLI 工具：将指定用户设为管理员
用法:
    python3 create_admin.py <username>

在服务器上执行:
    cd /opt/rolerz
    source venv/bin/activate
    python3 create_admin.py <username>
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import database as db


def main():
    if len(sys.argv) < 2:
        print("用法: python3 create_admin.py <username>")
        sys.exit(1)

    username = sys.argv[1]
    conn = db._get_conn()
    row = conn.execute(
        "SELECT id, is_admin FROM users WHERE username = ?", (username,)
    ).fetchone()
    conn.close()

    if row is None:
        print(f"错误: 用户 '{username}' 不存在")
        sys.exit(1)

    if row["is_admin"]:
        print(f"用户 '{username}' (id={row['id']}) 已经是管理员")
        return

    db.set_admin(row["id"], True)
    print(f"成功: 用户 '{username}' (id={row['id']}) 已设为管理员")


if __name__ == "__main__":
    main()

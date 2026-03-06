from __future__ import annotations

import json
from pathlib import Path


def project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def data_path(name: str) -> Path:
    return project_root() / "data" / name


def load_json(name: str) -> list[dict]:
    path = data_path(name)
    if not path.exists():
        raise FileNotFoundError(f"Missing data file: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def output_path(name: str) -> Path:
    return project_root() / "output" / name


def save_json(data: dict | list, name: str) -> Path:
    """Persist output data to output/<name>. Creates the directory if needed. Returns the path."""
    path = output_path(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
    return path

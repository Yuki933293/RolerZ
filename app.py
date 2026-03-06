"""
Persona Forge — Streamlit 可视化界面
运行：streamlit run app.py
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st

from persona_engine import EngineConfig, PersonaEngine, PersonaSeed
from persona_engine.inspiration import InspirationLibrary
from persona_engine.llm import PROVIDER_DEFAULTS
from persona_engine.wizard import REQUIRED_FIELDS, WizardEngine

# ──────────────────────────────────────────────────────────────────────────
# Page config — must be the very first Streamlit call
# ──────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Persona Forge · 角色锻造台",
    page_icon="✦",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ──────────────────────────────────────────────────────────────────────────
# Global CSS
# ──────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;600&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');

:root {
    --bg:         #F2F2F7;
    --surface:    #FFFFFF;
    --surface2:   #F8F8FC;
    --accent:     #5B6AF0;
    --accent-lt:  rgba(91,106,240,0.10);
    --accent-md:  rgba(91,106,240,0.20);
    --amber:      #C8890A;
    --amber-lt:   rgba(200,137,10,0.10);
    --text:       #111827;
    --text-md:    #374151;
    --text-dim:   #6B7280;
    --text-faint: #9CA3AF;
    --border:     #E5E7EB;
    --border-md:  #D1D5DB;
    --success:    #059669;
    --success-lt: rgba(5,150,105,0.08);
    --error:      #DC2626;
    --error-lt:   rgba(220,38,38,0.08);
    --shadow-sm:  0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md:  0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
    --radius:     10px;
    --radius-sm:  6px;
}

/* ── Reset & base ── */
.stApp {
    background: var(--bg) !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
    color: var(--text) !important;
}
.stApp > header { background: transparent !important; box-shadow: none !important; }
.block-container {
    max-width: 1120px !important;
    padding: 1.5rem 2rem 3rem !important;
}

/* ── Sidebar ── */
section[data-testid="stSidebar"] {
    background: var(--surface) !important;
    border-right: 1px solid var(--border) !important;
    box-shadow: 2px 0 8px rgba(0,0,0,0.04) !important;
}
section[data-testid="stSidebar"] > div { padding-top: 0 !important; }
section[data-testid="stSidebar"] label {
    color: var(--text-md) !important;
    font-size: 0.82rem !important;
    font-weight: 500 !important;
}
section[data-testid="stSidebar"] p {
    color: var(--text-dim) !important;
    font-size: 0.8rem !important;
}

/* ── Text inputs & textareas ── */
.stTextInput > div > div > input,
.stTextArea > div > div > textarea {
    background: var(--surface) !important;
    border: 1.5px solid var(--border-md) !important;
    color: var(--text) !important;
    border-radius: var(--radius-sm) !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 0.9rem !important;
    box-shadow: var(--shadow-sm) !important;
    transition: border-color 0.15s, box-shadow 0.15s !important;
}
.stTextInput > div > div > input:focus,
.stTextArea > div > div > textarea:focus {
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px var(--accent-lt) !important;
    outline: none !important;
}
.stTextInput > div > div > input::placeholder,
.stTextArea > div > div > textarea::placeholder {
    color: var(--text-faint) !important;
}

/* ── Selectbox ── */
.stSelectbox > div > div {
    background: var(--surface) !important;
    border: 1.5px solid var(--border-md) !important;
    color: var(--text) !important;
    border-radius: var(--radius-sm) !important;
    box-shadow: var(--shadow-sm) !important;
}
.stSelectbox > div > div:focus-within {
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px var(--accent-lt) !important;
}

/* ── Primary buttons ── */
.stButton > button {
    background: var(--accent) !important;
    color: #FFFFFF !important;
    border: none !important;
    font-family: 'Inter', sans-serif !important;
    font-weight: 600 !important;
    font-size: 0.875rem !important;
    letter-spacing: 0.02em !important;
    border-radius: var(--radius-sm) !important;
    padding: 0.5rem 1.25rem !important;
    box-shadow: 0 1px 3px rgba(91,106,240,0.3) !important;
    transition: background 0.15s, box-shadow 0.15s, transform 0.1s !important;
}
.stButton > button:hover {
    background: #4857E8 !important;
    box-shadow: 0 3px 10px rgba(91,106,240,0.35) !important;
    transform: translateY(-1px) !important;
}
.stButton > button:active { transform: translateY(0) !important; }

/* ── Download button ── */
.stDownloadButton > button {
    background: var(--surface) !important;
    color: var(--accent) !important;
    border: 1.5px solid var(--accent) !important;
    border-radius: var(--radius-sm) !important;
    font-weight: 500 !important;
    box-shadow: none !important;
    transition: background 0.15s !important;
}
.stDownloadButton > button:hover {
    background: var(--accent-lt) !important;
    transform: none !important;
    box-shadow: none !important;
}

/* ── Toggle ── */
.stToggle label p { color: var(--text-md) !important; font-size: 0.875rem !important; }

/* ── Slider ── */
.stSlider > div > div > div > div {
    background: var(--accent) !important;
}
.stSlider [data-testid="stTickBar"] { color: var(--text-dim) !important; }

/* ── Radio ── */
.stRadio > div { gap: 0.25rem !important; }
.stRadio label { color: var(--text-md) !important; font-size: 0.875rem !important; }
.stRadio [data-testid="stMarkdownContainer"] p { color: var(--text-md) !important; }

/* ── Progress bar ── */
.stProgress > div > div {
    background: var(--border) !important;
    border-radius: 4px !important;
}
.stProgress > div > div > div {
    background: linear-gradient(90deg, var(--accent), #7C8FF5) !important;
    border-radius: 4px !important;
}

/* ── Tabs ── */
.stTabs [data-baseweb="tab-list"] {
    background: transparent !important;
    border-bottom: 2px solid var(--border) !important;
    gap: 0 !important;
    margin-bottom: 0.25rem !important;
}
.stTabs [data-baseweb="tab"] {
    background: transparent !important;
    color: var(--text-dim) !important;
    border: none !important;
    border-bottom: 2px solid transparent !important;
    margin-bottom: -2px !important;
    padding: 0.65rem 1.35rem !important;
    font-size: 0.875rem !important;
    font-weight: 500 !important;
    letter-spacing: 0.01em !important;
    transition: color 0.15s !important;
}
.stTabs [aria-selected="true"] {
    color: var(--accent) !important;
    border-bottom-color: var(--accent) !important;
}
.stTabs [data-baseweb="tab"]:hover { color: var(--text-md) !important; }

/* ── Alerts ── */
.stSuccess {
    background: var(--success-lt) !important;
    border: 1px solid rgba(5,150,105,0.25) !important;
    color: #065F46 !important;
    border-radius: var(--radius-sm) !important;
}
.stSuccess p { color: #065F46 !important; }
.stError {
    background: var(--error-lt) !important;
    border: 1px solid rgba(220,38,38,0.25) !important;
    color: #991B1B !important;
    border-radius: var(--radius-sm) !important;
}
.stError p { color: #991B1B !important; }
.stWarning {
    background: rgba(251,191,36,0.08) !important;
    border: 1px solid rgba(251,191,36,0.3) !important;
    border-radius: var(--radius-sm) !important;
}

/* ── Spinner ── */
.stSpinner > div { border-top-color: var(--accent) !important; }

/* ── Divider ── */
hr { border-color: var(--border) !important; margin: 1rem 0 !important; }

/* ── Labels ── */
label { color: var(--text-md) !important; font-weight: 500 !important; font-size: 0.85rem !important; }

/* ── Form container ── */
.stForm {
    background: var(--surface2) !important;
    border: 1.5px solid var(--border) !important;
    border-radius: var(--radius) !important;
    padding: 1.25rem !important;
}

/* ── General markdown text ── */
.stMarkdown p { color: var(--text-md) !important; }

/* ── Provider selector button override ── */
.provider-btn button {
    background: var(--surface) !important;
    color: var(--text) !important;
    border: 1.5px solid var(--border) !important;
    box-shadow: none !important;
    text-align: left !important;
    padding: 10px 14px !important;
    font-weight: 500 !important;
    font-size: 0.84rem !important;
    transition: border-color 0.15s, background 0.15s !important;
}
.provider-btn button:hover {
    background: var(--surface2) !important;
    border-color: var(--border-md) !important;
    transform: none !important;
    box-shadow: none !important;
}
.provider-btn-active button {
    background: var(--accent-lt) !important;
    color: var(--accent) !important;
    border: 1.5px solid var(--accent) !important;
    box-shadow: none !important;
    text-align: left !important;
    padding: 10px 14px !important;
    font-weight: 600 !important;
    font-size: 0.84rem !important;
}
.provider-btn-active button:hover {
    background: var(--accent-md) !important;
    transform: none !important;
    box-shadow: none !important;
}
/* ── Model list item button ── */
.model-item button {
    background: var(--surface) !important;
    color: var(--text) !important;
    border: 1px solid var(--border) !important;
    box-shadow: none !important;
    font-size: 0.82rem !important;
    font-weight: 400 !important;
    padding: 8px 12px !important;
}
.model-item button:hover {
    background: var(--surface2) !important;
    transform: none !important;
    box-shadow: none !important;
}
.model-item-active button {
    background: var(--accent-lt) !important;
    color: var(--accent) !important;
    border: 1.5px solid var(--accent) !important;
    box-shadow: none !important;
    font-size: 0.82rem !important;
    font-weight: 600 !important;
    padding: 8px 12px !important;
}
.model-item-active button:hover {
    background: var(--accent-md) !important;
    transform: none !important;
    box-shadow: none !important;
}
/* ── Fetch/save buttons (secondary style) ── */
.btn-secondary button {
    background: var(--surface) !important;
    color: var(--accent) !important;
    border: 1.5px solid var(--accent) !important;
    box-shadow: none !important;
    font-size: 0.8rem !important;
}
.btn-secondary button:hover {
    background: var(--accent-lt) !important;
    transform: none !important;
    box-shadow: none !important;
}
</style>
""", unsafe_allow_html=True)


# ──────────────────────────────────────────────────────────────────────────
# Session state initialisation
# ──────────────────────────────────────────────────────────────────────────
_DEFAULTS: dict = {
    "batch_results": None,
    "wiz_results": None,
    "wizard": None,
    "wiz_questions": [],
    "wiz_done": False,
    "error": None,
}
for _k, _v in _DEFAULTS.items():
    if _k not in st.session_state:
        st.session_state[_k] = _v

# Model configuration in session state (persists across tabs)
_MODEL_DEFAULTS: dict = {
    "model_provider": "claude",
    "model_api_key": "",
    "model_name": "",
    "model_base_url": "",
    "model_configured": False,
    "fetched_models": [],        # list of model ID strings
    "fetching_models": False,
}
for _k, _v in _MODEL_DEFAULTS.items():
    if _k not in st.session_state:
        st.session_state[_k] = _v

# Provider metadata
_PROVIDERS = {
    "claude": {
        "name": "Claude",
        "vendor": "Anthropic",
        "env_key": "ANTHROPIC_API_KEY",
        "url": "https://console.anthropic.com",
        "color": "#D97706",
    },
    "openai": {
        "name": "OpenAI",
        "vendor": "OpenAI",
        "env_key": "OPENAI_API_KEY",
        "url": "https://platform.openai.com/api-keys",
        "color": "#10B981",
    },
    "deepseek": {
        "name": "DeepSeek",
        "vendor": "DeepSeek",
        "env_key": "DEEPSEEK_API_KEY",
        "url": "https://platform.deepseek.com",
        "color": "#3B82F6",
    },
    "custom": {
        "name": "自定义",
        "vendor": "OpenAI 兼容",
        "env_key": "",
        "url": "",
        "color": "#8B5CF6",
    },
}


# ──────────────────────────────────────────────────────────────────────────
# Load inspiration cards (cached)
# ──────────────────────────────────────────────────────────────────────────
@st.cache_data
def load_inspiration_cards() -> list[dict]:
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
    return cards


_INSPIRATION_CARDS = load_inspiration_cards()

_CATEGORY_LABELS: dict[str, dict[str, str]] = {
    "personality":   {"zh": "性格核心", "en": "Personality Core"},
    "expression":    {"zh": "表达方式", "en": "Expression Style"},
    "emotion":       {"zh": "情感模式", "en": "Emotion Pattern"},
    "relationship":  {"zh": "关系倾向", "en": "Relationship Style"},
    "background":    {"zh": "成长背景", "en": "Background"},
    "behavior":      {"zh": "行为习惯", "en": "Behavior Pattern"},
    "motivation":    {"zh": "内在动机", "en": "Core Motivation"},
    "conflict":      {"zh": "冲突风格", "en": "Conflict Style"},
}


# ──────────────────────────────────────────────────────────────────────────
# Sidebar — compact: branding + basic generation settings only
# ──────────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("""
    <div style="padding:1.5rem 0.5rem 1.25rem;border-bottom:1px solid #E5E7EB;margin-bottom:1rem;">
        <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;background:#5B6AF0;border-radius:8px;
                        display:flex;align-items:center;justify-content:center;
                        font-size:1rem;color:#fff;font-weight:700;">✦</div>
            <div>
                <div style="font-family:'Inter',sans-serif;font-weight:700;font-size:0.9rem;color:#111827;">
                    Persona Forge
                </div>
                <div style="font-size:0.65rem;color:#9CA3AF;letter-spacing:0.08em;margin-top:1px;">
                    角色锻造台
                </div>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Model status indicator
    prov = st.session_state.model_provider
    prov_info = _PROVIDERS[prov]
    has_key = bool(st.session_state.model_api_key) or bool(os.environ.get(prov_info["env_key"], ""))
    is_configured = has_key or prov == "custom"
    status_color = "#059669" if is_configured else "#DC2626"
    status_text = "已配置" if is_configured else "未配置"

    st.markdown(
        f'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;'
        f'padding:10px 12px;margin-bottom:1rem;">'
        f'<div style="font-size:0.7rem;color:var(--text-faint);letter-spacing:0.06em;'
        f'text-transform:uppercase;margin-bottom:4px;">当前模型</div>'
        f'<div style="display:flex;align-items:center;gap:8px;">'
        f'<span style="width:7px;height:7px;border-radius:50%;background:{status_color};'
        f'display:inline-block;flex-shrink:0;"></span>'
        f'<span style="font-weight:600;font-size:0.88rem;color:var(--text);">'
        f'{prov_info["name"]}</span>'
        f'<span style="font-size:0.72rem;color:var(--text-dim);">'
        f'{st.session_state.model_name or PROVIDER_DEFAULTS.get(prov, "")}</span>'
        f'</div>'
        f'<div style="font-size:0.68rem;color:{status_color};margin-top:3px;">{status_text}</div>'
        f'</div>',
        unsafe_allow_html=True,
    )

    st.markdown("**生成设置**")
    count = st.slider("候选数量", 1, 6, 3)
    lang_label = st.radio("输出语言", ["中文", "English"], horizontal=True)
    lang = "zh" if lang_label == "中文" else "en"

    st.divider()
    st.markdown(
        '<div style="font-size:0.7rem;color:#D1D5DB;line-height:1.8;">'
        'Persona Forge v0.3 · LLM 驱动'
        '</div>',
        unsafe_allow_html=True,
    )


# ──────────────────────────────────────────────────────────────────────────
# Helper: build EngineConfig from saved model config
# ──────────────────────────────────────────────────────────────────────────
def make_config() -> EngineConfig:
    return EngineConfig(
        candidate_count=count,
        language=lang,
        llm_provider=st.session_state.model_provider,
        llm_model=st.session_state.model_name or None,
        llm_api_key=st.session_state.model_api_key or None,
        llm_base_url=st.session_state.model_base_url or None,
    )


# ──────────────────────────────────────────────────────────────────────────
# Helper: render one persona candidate
# ──────────────────────────────────────────────────────────────────────────
def render_candidate_card(cand: dict, lang: str, index: int) -> None:
    score = cand.get("score", 0)
    cid = cand.get("id", f"#{index + 1}")
    tags: list[str] = cand.get("tags", [])
    raw_long = cand.get("natural_long", "")
    raw_short = cand.get("natural_short", "")
    natural = (
        (raw_long if isinstance(raw_long, str) else raw_long.get(lang, ""))
        or (raw_short if isinstance(raw_short, str) else raw_short.get(lang, ""))
    )
    spec = cand.get("spec_long", {})
    raw_opening = spec.get("opening_line", "") if isinstance(spec, dict) else ""
    opening = raw_opening if isinstance(raw_opening, str) else raw_opening.get(lang, "")

    score_pct = int(score * 100)

    with st.container(border=True):
        col_info, col_score = st.columns([5, 1])
        with col_info:
            st.markdown(f"##### CANDIDATE {index + 1}")
            st.caption(cid)
        with col_score:
            if score > 0.7:
                score_color = "green"
            elif score > 0.42:
                score_color = "orange"
            else:
                score_color = "gray"
            st.markdown(f":{score_color}[**{score_pct}**] · SCORE")

        st.progress(min(score, 1.0))

        if tags:
            tag_str = " ".join(f"`{t}`" for t in tags[:9])
            st.markdown(tag_str)

        if opening:
            label = "开场白" if lang == "zh" else "Opening Line"
            st.info(f"**{label}**\n\n_{opening}_")

        if natural:
            st.markdown(natural)


# ──────────────────────────────────────────────────────────────────────────
# Helper: inspiration card picker
# ──────────────────────────────────────────────────────────────────────────
def render_inspiration_picker(key_prefix: str, lang: str) -> list[str]:
    """Render an expandable inspiration card browser. Returns list of selected card IDs."""
    selected_key = f"{key_prefix}_selected_cards"
    if selected_key not in st.session_state:
        st.session_state[selected_key] = []

    with st.expander("灵感卡选择（可选）" if lang == "zh" else "Inspiration Cards (optional)", expanded=False):
        st.markdown(
            f'<p style="color:#6B7280;font-size:0.8rem;margin:0 0 0.75rem;">'
            f'{"选择灵感卡来影响角色生成方向，不选则随机抽取" if lang == "zh" else "Select cards to guide generation, or leave empty for random selection"}'
            f'</p>',
            unsafe_allow_html=True,
        )

        by_cat: dict[str, list[dict]] = {}
        for card in _INSPIRATION_CARDS:
            by_cat.setdefault(card["category"], []).append(card)

        current_selection: list[str] = list(st.session_state[selected_key])

        if current_selection:
            col_count, col_clear = st.columns([4, 1])
            with col_count:
                n = len(current_selection)
                st.markdown(
                    f'<span style="font-size:0.8rem;color:#5B6AF0;font-weight:600;">'
                    f'已选 {n} 张卡</span>',
                    unsafe_allow_html=True,
                )
            with col_clear:
                if st.button("清除", key=f"{key_prefix}_clear_cards", use_container_width=True):
                    st.session_state[selected_key] = []
                    st.rerun()

        for cat in _CATEGORY_LABELS:
            cards_in_cat = by_cat.get(cat, [])
            if not cards_in_cat:
                continue

            cat_label = _CATEGORY_LABELS[cat][lang]
            st.markdown(
                f'<div style="font-size:0.78rem;font-weight:600;color:#374151;'
                f'margin:0.75rem 0 0.35rem;padding-bottom:0.2rem;border-bottom:1px solid #F3F4F6;">'
                f'{cat_label}'
                f'<span style="color:#9CA3AF;font-weight:400;margin-left:6px;">{len(cards_in_cat)}</span>'
                f'</div>',
                unsafe_allow_html=True,
            )

            cols = st.columns(min(len(cards_in_cat), 3))
            for i, card in enumerate(cards_in_cat):
                cid = card["id"]
                title = card[f"title_{lang}"] or card["title_zh"]
                is_selected = cid in current_selection
                col_idx = i % 3

                with cols[col_idx]:
                    snippet_key = next(iter(card["snippets"]), None)
                    snippet_preview = ""
                    if snippet_key:
                        raw = card["snippets"][snippet_key].get(lang, "")
                        snippet_preview = raw[:60] + ("…" if len(raw) > 60 else "")

                    tag_chips = " ".join(f"`{t}`" for t in card["tags"][:3])

                    if is_selected:
                        border_style = "border:2px solid #5B6AF0;background:#F8F9FF;"
                    else:
                        border_style = "border:1.5px solid #E5E7EB;background:#FFFFFF;"

                    st.markdown(
                        f'<div style="{border_style}border-radius:8px;padding:10px 12px;'
                        f'margin-bottom:0.5rem;min-height:80px;">'
                        f'<div style="font-size:0.82rem;font-weight:600;color:#111827;margin-bottom:3px;">'
                        f'{"● " if is_selected else ""}{title}</div>'
                        f'<div style="font-size:0.72rem;color:#6B7280;line-height:1.4;margin-bottom:4px;">'
                        f'{snippet_preview}</div>'
                        f'<div style="font-size:0.68rem;">{tag_chips}</div>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )

                    btn_label = "取消" if is_selected else "选择"
                    if st.button(btn_label, key=f"{key_prefix}_card_{cid}", use_container_width=True):
                        if is_selected:
                            current_selection.remove(cid)
                        else:
                            current_selection.append(cid)
                        st.session_state[selected_key] = current_selection
                        st.rerun()

    return st.session_state[selected_key]


# ──────────────────────────────────────────────────────────────────────────
# Page header
# ──────────────────────────────────────────────────────────────────────────
st.markdown("""
<div style="margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:1px solid #E5E7EB;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:0.35rem;">
        <h1 style="font-family:'Noto Serif SC',serif;font-weight:400;font-size:1.85rem;
                   letter-spacing:0.02em;margin:0;color:#111827;">
            角色锻造台
        </h1>
        <span style="background:#EEF2FF;color:#4F46E5;font-family:'Space Mono',monospace;
                     font-size:0.65rem;letter-spacing:0.12em;padding:3px 10px;
                     border-radius:20px;font-weight:600;border:1px solid #C7D2FE;">
            PERSONA FORGE
        </span>
    </div>
    <p style="color:#6B7280;margin:0;font-size:0.9rem;">
        输入一个角色概念，AI 生成完整的人格档案
    </p>
</div>
""", unsafe_allow_html=True)


# ──────────────────────────────────────────────────────────────────────────
# Tabs — 3-tab layout
# ──────────────────────────────────────────────────────────────────────────
tab_batch, tab_wizard, tab_model = st.tabs(["  快速生成  ", "  引导向导  ", "  模型设置  "])


# ══════════════════════════════════════════════════════════════════════════
# Tab 1 — Batch (quick) generation
# ══════════════════════════════════════════════════════════════════════════
with tab_batch:
    st.markdown('<div style="height:0.75rem;"></div>', unsafe_allow_html=True)

    concept = st.text_input(
        "角色概念",
        placeholder="例如：沉默的城市治愈者、叛逆的档案守护者、情感导航型虚拟人格...",
        key="batch_concept",
    )
    prefs = st.text_input(
        "风格偏好（可选）",
        placeholder="逗号分隔，如：calm, urban, mediator",
        key="batch_prefs",
    )

    # Inspiration card picker
    batch_selected_cards = render_inspiration_picker("batch", lang)

    col_btn, col_dl = st.columns([1, 5])
    with col_btn:
        generate = st.button("✦ 生成", use_container_width=True)

    if generate:
        if not concept.strip():
            st.error("请先输入角色概念")
        else:
            st.session_state.batch_results = None
            st.session_state.error = None
            try:
                with st.spinner("生成中..."):
                    cfg = make_config()
                    engine = PersonaEngine.create(cfg)
                    seed = PersonaSeed(concept=concept.strip())
                    if prefs.strip():
                        seed.preferences = [p.strip() for p in prefs.split(",") if p.strip()]
                    if batch_selected_cards:
                        seed.selected_inspirations = batch_selected_cards
                    output = engine.generate(seed)
                    st.session_state.batch_results = output.as_dict(language=lang)
            except Exception as exc:
                st.session_state.error = str(exc)

    if st.session_state.error:
        st.error(f"生成失败：{st.session_state.error}")

    if st.session_state.batch_results:
        data = st.session_state.batch_results
        candidates = data.get("candidates", [])
        questions = data.get("questions", [])
        meta = data.get("meta", {})

        engine_badge = f"LLM · {meta.get('language', 'zh')}"
        st.markdown(
            f'<div style="margin:1.25rem 0 0.75rem;display:flex;align-items:center;gap:10px;">'
            f'<span style="font-weight:600;color:#111827;font-size:0.95rem;">{len(candidates)} 个候选角色</span>'
            f'<span style="background:#F3F4F6;color:#6B7280;font-size:0.72rem;'
            f'padding:2px 8px;border-radius:4px;border:1px solid #E5E7EB;">{engine_badge}</span>'
            f'</div>',
            unsafe_allow_html=True,
        )

        for i, cand in enumerate(candidates):
            render_candidate_card(cand, lang, i)

        if questions:
            q_items = "".join(
                f'<div style="color:#374151;font-size:0.85rem;padding:4px 0;'
                f'border-bottom:1px solid #F3F4F6;">'
                f'<span style="color:#9CA3AF;margin-right:6px;">·</span>'
                f'{q.get("text", q.get(lang, q.get("zh", "")))}</div>'
                for q in questions
            )
            st.markdown(
                f'<div style="margin-top:1rem;padding:1rem 1.25rem;background:#FFFBEB;'
                f'border:1px solid #FDE68A;border-radius:8px;">'
                f'<div style="font-size:0.72rem;font-weight:600;letter-spacing:0.06em;'
                f'color:#92400E;text-transform:uppercase;margin-bottom:0.6rem;">建议补充以提升质量</div>'
                f'{q_items}</div>',
                unsafe_allow_html=True,
            )

        with col_dl:
            st.download_button(
                "导出 JSON",
                data=json.dumps(data, ensure_ascii=False, indent=2),
                file_name="persona_output.json",
                mime="application/json",
            )


# ══════════════════════════════════════════════════════════════════════════
# Tab 2 — Interactive wizard
# ══════════════════════════════════════════════════════════════════════════
with tab_wizard:
    st.markdown('<div style="height:0.75rem;"></div>', unsafe_allow_html=True)

    wizard: WizardEngine | None = st.session_state.wizard

    # ── Step 0: Enter concept ─────────────────────────────────────────────
    if wizard is None:
        st.markdown(
            '<p style="color:#6B7280;font-size:0.9rem;margin-bottom:1.25rem;line-height:1.6;">'
            '向导会逐步收集角色关键信息（背景、性格、声音风格等），'
            '帮你构建更有个性的完整人格档案。'
            '</p>',
            unsafe_allow_html=True,
        )

        wiz_concept = st.text_input(
            "角色概念",
            placeholder="你的角色是什么？例如：一个在深夜独自工作的 AI 伴侣...",
            key="wiz_concept_input",
        )

        wiz_selected_cards = render_inspiration_picker("wiz", lang)

        if st.button("开始引导 →"):
            if not wiz_concept.strip():
                st.error("请先输入角色概念")
            else:
                cfg = make_config()
                w = WizardEngine(cfg)
                qs = w.start(wiz_concept.strip())
                if wiz_selected_cards:
                    w.session.seed.selected_inspirations = wiz_selected_cards
                st.session_state.wizard = w
                st.session_state.wiz_questions = [q.as_dict(language=lang) for q in qs]
                st.session_state.wiz_done = len(qs) == 0
                st.session_state.wiz_results = None
                st.rerun()

    else:
        concept_display = wizard.session.seed.concept if wizard.session else ""

        col_title, col_reset = st.columns([5, 1])
        with col_title:
            st.markdown(
                f'<div style="background:#F8F9FF;border:1px solid #E0E7FF;border-radius:8px;'
                f'padding:10px 14px;margin-bottom:1rem;">'
                f'<span style="font-size:0.65rem;font-weight:600;letter-spacing:0.1em;'
                f'color:#6366F1;text-transform:uppercase;">构建中</span>'
                f'<div style="font-size:1rem;font-weight:600;color:#111827;margin-top:3px;">'
                f'「{concept_display}」</div>'
                f'</div>',
                unsafe_allow_html=True,
            )
        with col_reset:
            if st.button("重置", help="清除当前向导，重新开始"):
                for key in ("wizard", "wiz_questions", "wiz_done", "wiz_results"):
                    st.session_state[key] = _DEFAULTS.get(key)
                st.rerun()

        # ── Questioning phase ─────────────────────────────────────────────
        if not st.session_state.wiz_done and st.session_state.wiz_questions:
            answered_n = len(wizard.session.answered) if wizard.session else 0
            st.progress(answered_n / 6, text=f"进度：{answered_n} / 6 项已填写")
            st.markdown('<div style="height:0.5rem;"></div>', unsafe_allow_html=True)

            with st.form("wiz_form"):
                answers: dict[str, str] = {}
                for q in st.session_state.wiz_questions:
                    field = q["field"]
                    prompt = q.get("text", q.get("zh" if lang == "zh" else "en", ""))
                    is_req = field in REQUIRED_FIELDS
                    placeholder = "请详细描述..." if is_req else "可留空跳过"
                    answers[field] = st.text_area(
                        prompt,
                        height=90,
                        placeholder=placeholder,
                        key=f"wiz_ans_{field}",
                    )

                col_sub, col_skip = st.columns([1, 1])
                with col_sub:
                    submitted = st.form_submit_button("继续 →", use_container_width=True)
                with col_skip:
                    skip_all = st.form_submit_button("跳过，直接生成", use_container_width=True)

            if submitted:
                next_qs = []
                for q in st.session_state.wiz_questions:
                    field = q["field"]
                    next_qs = wizard.answer(field, answers.get(field, ""))
                st.session_state.wiz_questions = [q.as_dict(language=lang) for q in next_qs]
                st.session_state.wiz_done = len(next_qs) == 0
                st.rerun()

            if skip_all:
                st.session_state.wiz_questions = []
                st.session_state.wiz_done = True
                st.rerun()

        # ── Ready to generate ─────────────────────────────────────────────
        if st.session_state.wiz_done and st.session_state.wiz_results is None:
            n_answered = len(wizard.session.answered) if wizard.session else 0
            st.success(f"已收集 {n_answered} 项信息，可以生成了")

            if st.button("✦ 生成角色档案", use_container_width=False):
                try:
                    with st.spinner("生成中..."):
                        output = wizard.finish()
                        st.session_state.wiz_results = output.as_dict(language=lang)
                    st.rerun()
                except Exception as exc:
                    st.error(f"生成失败：{exc}")

        # ── Results ───────────────────────────────────────────────────────
        if st.session_state.wiz_results:
            data = st.session_state.wiz_results
            candidates = data.get("candidates", [])

            st.markdown(
                f'<div style="margin:0.75rem 0 0.5rem;font-weight:600;color:#111827;">'
                f'{len(candidates)} 个候选角色</div>',
                unsafe_allow_html=True,
            )

            for i, cand in enumerate(candidates):
                render_candidate_card(cand, lang, i)

            col_dl, col_restart = st.columns(2)
            with col_dl:
                st.download_button(
                    "导出 JSON",
                    data=json.dumps(data, ensure_ascii=False, indent=2),
                    file_name="persona_wizard_output.json",
                    mime="application/json",
                    use_container_width=True,
                )
            with col_restart:
                if st.button("重新开始", use_container_width=True, key="wiz_restart"):
                    for key in ("wizard", "wiz_questions", "wiz_done", "wiz_results"):
                        st.session_state[key] = _DEFAULTS.get(key)
                    st.rerun()


# ══════════════════════════════════════════════════════════════════════════
# Tab 3 — Model configuration (AstrBot-style layout)
# ══════════════════════════════════════════════════════════════════════════

def _fetch_model_list(provider: str, api_key: str, base_url: str) -> list[str]:
    """Fetch available model IDs from the provider API."""
    if provider == "claude":
        import anthropic
        client = anthropic.Anthropic(
            api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"),
            timeout=15,
        )
        result = client.models.list(limit=100)
        return sorted([m.id for m in result.data])
    else:
        import openai as _openai
        from persona_engine.llm import _PROVIDER_BASE_URLS
        resolved_key = api_key or (
            os.environ.get("OPENAI_API_KEY") if provider == "openai"
            else os.environ.get("DEEPSEEK_API_KEY") if provider == "deepseek"
            else api_key
        )
        resolved_url = base_url or _PROVIDER_BASE_URLS.get(provider)
        client = _openai.OpenAI(api_key=resolved_key, base_url=resolved_url, timeout=15)
        result = client.models.list()
        return sorted([m.id for m in result.data])


with tab_model:
    st.markdown('<div style="height:0.5rem;"></div>', unsafe_allow_html=True)

    st.markdown(
        '<div style="font-size:1.15rem;font-weight:600;color:var(--text);margin-bottom:0.25rem;">'
        '模型提供商</div>'
        '<p style="font-size:0.82rem;color:var(--text-dim);margin-bottom:1.25rem;">'
        '配置 AI 模型提供商的 API 密钥和参数，用于角色生成</p>',
        unsafe_allow_html=True,
    )

    # Two-column layout: provider list (left) + config form (right)
    col_list, col_config = st.columns([1, 2.5])

    # ── Left column: provider selector ────────────────────────────────
    with col_list:
        st.markdown(
            '<div style="font-size:0.75rem;font-weight:600;color:var(--text-dim);'
            'letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.6rem;">'
            '提供商源</div>',
            unsafe_allow_html=True,
        )

        for pid, pinfo in _PROVIDERS.items():
            is_active = st.session_state.model_provider == pid

            has_env = bool(os.environ.get(pinfo["env_key"], "")) if pinfo["env_key"] else False
            is_configured = has_env or (is_active and st.session_state.model_api_key)
            dot_color = "#059669" if is_configured else "#D1D5DB"

            css_class = "provider-btn-active" if is_active else "provider-btn"
            label = f"{pinfo['name']}　·　{pinfo['vendor']}"

            st.markdown(f'<div class="{css_class}">', unsafe_allow_html=True)
            if st.button(
                label,
                key=f"prov_{pid}",
                use_container_width=True,
                disabled=is_active,
            ):
                st.session_state.model_provider = pid
                st.session_state.model_api_key = ""
                st.session_state.model_name = ""
                st.session_state.model_base_url = ""
                st.session_state.fetched_models = []
                st.rerun()
            st.markdown('</div>', unsafe_allow_html=True)

    # ── Right column: config form ─────────────────────────────────────
    with col_config:
        active_pid = st.session_state.model_provider
        active_info = _PROVIDERS[active_pid]
        active_base_url_hint = {
            "deepseek": "https://api.deepseek.com",
        }.get(active_pid, "")

        # Provider header
        st.markdown(
            f'<div style="display:flex;align-items:center;justify-content:space-between;'
            f'margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border);">'
            f'<div>'
            f'<div style="font-size:1.05rem;font-weight:600;color:var(--text);">{active_info["name"]}</div>'
            f'<div style="font-size:0.75rem;color:var(--text-faint);">'
            f'{active_base_url_hint or active_info["vendor"]}</div>'
            f'</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

        # API Key
        cfg_api_key = st.text_input(
            "API Key",
            value=st.session_state.model_api_key,
            type="password",
            placeholder=f"不填则读取环境变量 {active_info['env_key']}" if active_info["env_key"] else "填写 API Key",
            key="cfg_api_key",
        )

        # API Base URL (for custom provider)
        cfg_base_url = ""
        if active_pid == "custom":
            cfg_base_url = st.text_input(
                "API Base URL",
                value=st.session_state.model_base_url,
                placeholder="例如：http://localhost:11434/v1",
                key="cfg_base_url",
                help="自定义 OpenAI 兼容端点，例如本地 Ollama / vLLM",
            )

        # API Key tip
        if active_info["url"] and not cfg_api_key:
            env_val = os.environ.get(active_info["env_key"], "")
            if env_val:
                st.markdown(
                    f'<div style="background:var(--success-lt);border:1px solid rgba(5,150,105,0.25);'
                    f'border-radius:6px;padding:8px 10px;font-size:0.78rem;color:#065F46;">'
                    f'已从环境变量 <code>{active_info["env_key"]}</code> 检测到 API Key'
                    f'</div>',
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    f'<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:6px;'
                    f'padding:8px 10px;font-size:0.78rem;color:#1D4ED8;">'
                    f'API Key 从 <a href="{active_info["url"]}" target="_blank" '
                    f'style="color:#1D4ED8;font-weight:600;">'
                    f'{active_info["url"].split("//")[1].split("/")[0]}</a> 获取</div>',
                    unsafe_allow_html=True,
                )

        # Save button
        st.markdown('<div style="height:0.5rem;"></div>', unsafe_allow_html=True)
        if st.button("保存配置", key="save_model_config", use_container_width=True):
            if active_pid == "custom" and not cfg_base_url:
                st.error("自定义模式需要填写 API Base URL")
            else:
                st.session_state.model_api_key = cfg_api_key
                st.session_state.model_base_url = cfg_base_url
                st.session_state.model_configured = True
                st.success("配置已保存")
                st.rerun()

        # ── Model list section ────────────────────────────────────────
        st.markdown('<div style="height:1.5rem;"></div>', unsafe_allow_html=True)

        # Header row: title + fetch button
        mcol_title, mcol_fetch = st.columns([3, 1])
        with mcol_title:
            n_models = len(st.session_state.fetched_models)
            count_badge = f'<span style="color:var(--text-faint);font-weight:400;margin-left:6px;">可用模型 {n_models}</span>' if n_models else ""
            st.markdown(
                f'<div style="font-size:0.78rem;font-weight:600;color:var(--text-dim);'
                f'letter-spacing:0.06em;text-transform:uppercase;">'
                f'已配置的模型{count_badge}</div>',
                unsafe_allow_html=True,
            )
        with mcol_fetch:
            effective_key = cfg_api_key or os.environ.get(active_info["env_key"], "")
            can_fetch = bool(effective_key) or (active_pid == "custom" and bool(cfg_base_url))

            st.markdown('<div class="btn-secondary">', unsafe_allow_html=True)
            fetch_clicked = st.button(
                "获取模型列表",
                key="fetch_models",
                use_container_width=True,
                disabled=not can_fetch,
            )
            st.markdown('</div>', unsafe_allow_html=True)

        if fetch_clicked and can_fetch:
            try:
                with st.spinner("正在获取模型列表..."):
                    # Save key first so fetch uses it
                    st.session_state.model_api_key = cfg_api_key
                    st.session_state.model_base_url = cfg_base_url
                    models = _fetch_model_list(active_pid, cfg_api_key, cfg_base_url)
                    st.session_state.fetched_models = models
                    # Auto-select default if current is empty
                    if not st.session_state.model_name and models:
                        default = PROVIDER_DEFAULTS.get(active_pid, "")
                        if default in models:
                            st.session_state.model_name = default
                        else:
                            st.session_state.model_name = models[0]
                st.rerun()
            except Exception as exc:
                st.error(f"获取失败：{exc}")

        if not can_fetch and not st.session_state.fetched_models:
            st.markdown(
                '<div style="color:var(--text-faint);font-size:0.78rem;padding:0.5rem 0;">'
                '请先填写 API Key 后获取模型列表</div>',
                unsafe_allow_html=True,
            )

        # Render fetched model list
        if st.session_state.fetched_models:
            for mid in st.session_state.fetched_models:
                is_selected = st.session_state.model_name == mid
                css = "model-item-active" if is_selected else "model-item"
                indicator = "●" if is_selected else ""

                st.markdown(f'<div class="{css}">', unsafe_allow_html=True)
                if st.button(
                    f"{indicator}  {mid}" if is_selected else mid,
                    key=f"model_sel_{mid}",
                    use_container_width=True,
                ):
                    st.session_state.model_name = mid
                    st.rerun()
                st.markdown('</div>', unsafe_allow_html=True)
        elif not st.session_state.fetched_models and st.session_state.model_name:
            # Show manually set or default model
            current = st.session_state.model_name or PROVIDER_DEFAULTS.get(active_pid, "")
            if current:
                st.markdown(
                    f'<div style="background:var(--surface);border:1.5px solid var(--border);'
                    f'border-radius:8px;padding:10px 14px;display:flex;align-items:center;'
                    f'justify-content:space-between;">'
                    f'<div>'
                    f'<span style="font-size:0.85rem;font-weight:600;color:var(--text);">'
                    f'{active_info["vendor"]}/{current}</span>'
                    f'<div style="font-size:0.7rem;color:var(--text-faint);margin-top:2px;">{current}</div>'
                    f'</div>'
                    f'<span style="font-size:0.7rem;color:var(--success);">● 使用中</span>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

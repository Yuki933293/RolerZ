import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getCards, getCardOverrides, saveCardOverride, deleteCardOverride,
  type InspirationCard,
} from '../api/client';
import { useAuth } from '../stores/useAuth';
import { useConfig } from '../stores/useConfig';
import CardEditModal from '../components/CardEditModal';
import { useT } from '../i18n';

const DEFAULT_CATEGORIES: Record<string, { zh: string; en: string }> = {
  personality:  { zh: '性格卡', en: 'Personality' },
  expression:   { zh: '表达卡', en: 'Expression' },
  emotion:      { zh: '情感卡', en: 'Emotion' },
  relationship: { zh: '关系卡', en: 'Relationship' },
  background:   { zh: '背景卡', en: 'Background' },
  behavior:     { zh: '行为卡', en: 'Behavior' },
  motivation:   { zh: '动机卡', en: 'Motivation' },
  conflict:     { zh: '冲突卡', en: 'Conflict' },
  appearance:   { zh: '外貌卡', en: 'Appearance' },
  scenario:     { zh: '场景卡', en: 'Scenario' },
  quirk:        { zh: '习惯卡', en: 'Quirk' },
};

/* Category glow colors — muted, for shadow only */
const CATEGORY_GLOW: Record<string, string> = {
  personality: 'rgba(78,140,255,0.25)', expression: 'rgba(244,114,182,0.25)',
  emotion: 'rgba(251,191,36,0.2)', relationship: 'rgba(52,211,153,0.25)',
  background: 'rgba(167,139,250,0.25)', behavior: 'rgba(96,165,250,0.25)',
  motivation: 'rgba(251,113,133,0.25)', conflict: 'rgba(251,146,60,0.2)',
  appearance: 'rgba(139,92,246,0.25)', scenario: 'rgba(20,184,166,0.25)',
  quirk: 'rgba(245,158,11,0.2)',
};

/* Accent colors for category icons */
const CATEGORY_ACCENT: Record<string, string> = {
  personality: '#4E8CFF', expression: '#EC4899', emotion: '#F59E0B',
  relationship: '#10B981', background: '#8B5CF6', behavior: '#3B82F6',
  motivation: '#EF4444', conflict: '#F97316',
  appearance: '#7C3AED', scenario: '#14B8A6', quirk: '#EAB308',
};

/* Card gradient background — per-category colors */
const CATEGORY_CARD_BG: Record<string, [string, string]> = {
  personality:  ['#eef4ff', '#dce6f9'],  // light blue
  expression:   ['#fdf2f8', '#f5dce9'],  // light pink
  emotion:      ['#fefce8', '#f9edcc'],  // light yellow
  relationship: ['#ecfdf5', '#d5f0e5'],  // light green
  background:   ['#f5f3ff', '#e8e0f7'],  // light purple
  behavior:     ['#eff6ff', '#dce8fa'],  // sky blue
  motivation:   ['#fef2f2', '#f9dede'],  // light red
  conflict:     ['#fff7ed', '#f7e8d4'],  // light orange
  appearance:   ['#f3f0ff', '#e4dcf9'],  // violet
  scenario:     ['#f0fdfa', '#d6f1ec'],  // light teal
  quirk:        ['#fefce8', '#f5edcf'],  // light gold
};
const DEFAULT_CARD_BG: [string, string] = ['#eef4ff', '#dce6f9'];

const CATEGORY_ICONS: Record<string, string> = {
  personality:  'M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
  expression:   'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  emotion:      'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z',
  relationship: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  background:   'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  behavior:     'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  motivation:   'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  conflict:     'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM8 12l2 2 4-4',
  appearance:   'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  scenario:     'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  quirk:        'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
};

const CATEGORY_ORDER = [
  'personality', 'expression', 'emotion', 'relationship',
  'background', 'behavior', 'motivation', 'conflict',
  'appearance', 'scenario', 'quirk',
];

const TAG_LABELS: Record<string, string> = {
  warm: '热心', boundaries: '有分寸', caring: '关心', independent: '独立',
  stubborn: '固执', 'easy-going': '随和', perceptive: '敏锐', observant: '善观察',
  reliable: '靠得住', casual: '随性', cheerful: '开朗', reserved: '内敛',
  loyal: '忠诚', blunt: '直接', honest: '坦诚', direct: '直率',
  anxious: '焦虑', cautious: '谨慎', intense: '认真', focused: '专注',
  empathetic: '共情', witty: '机智', sarcastic: '毒舌', quiet: '安静',
  indirect: '含蓄', deadpan: '冷面', talkative: '话多', sensitive: '敏感',
  protective: '保护欲', driven: '有冲劲', belonging: '归属感',
  'self-blame': '自责', 'night-owl': '夜猫子', emotional: '感性',
  contrast: '反差', misleading: '误导性', 'first-impression': '第一印象', gap: '落差',
  signature: '标志性', consistent: '固定', identity: '身份', subtle: '微妙',
  expressive: '外显', readable: '可读', transparent: '透明', fluctuating: '起伏',
  plain: '朴素', intentional: '刻意', 'low-maintenance': '省事', comfortable: '自在',
  scar: '疤痕', history: '经历', physical: '身体', story: '故事',
  night: '深夜', strangers: '陌生人', liminal: '过渡', work: '工作',
  proximity: '距离', routine: '日常', 'slow-build': '慢慢靠近',
  rain: '雨天', unexpected: '意外', pause: '暂停', intimate: '亲近',
  transition: '转变', vulnerability: '脆弱', belongings: '物品', change: '变化',
  solitude: '独处', 'in-between': '中间地带', reflection: '反思',
  collecting: '收集', sentimental: '念旧', hoarding: '囤积', meaning: '意义',
  quirky: '古怪', endearing: '可爱', 'alone-habit': '独处习惯', anthropomorphize: '拟人化',
  food: '美食', ritual: '仪式', particular: '讲究', comfort: '治愈',
  walking: '散步', decompression: '减压',
  punctual: '守时', 'over-prepared': '过度准备',
};

const SNIPPET_LABELS: Record<string, { zh: string; en: string }> = {
  personality: { zh: '性格', en: 'Personality' },
  speech: { zh: '语言风格', en: 'Speech' },
  behavior: { zh: '行为', en: 'Behavior' },
  hidden: { zh: '内在', en: 'Inner' },
  emotion: { zh: '情感', en: 'Emotion' },
  relationship: { zh: '关系', en: 'Relationship' },
  motivation: { zh: '动机', en: 'Motivation' },
  background: { zh: '背景', en: 'Background' },
  quirk: { zh: '小习惯', en: 'Quirk' },
  appearance: { zh: '外貌', en: 'Appearance' },
  setting: { zh: '场景', en: 'Setting' },
  atmosphere: { zh: '氛围', en: 'Atmosphere' },
};

/* ── HoloCard: single card with mouse tracking ── */
function HoloCard({ card, lang, isZh, glowColor, accent, iconPath, cardBg, isModified, onClick }: {
  card: InspirationCard;
  lang: 'zh' | 'en';
  isZh: boolean;
  glowColor: string;
  accent: string;
  iconPath: string;
  cardBg: [string, string];
  isModified: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    // ratio from -1 to 1
    const rx = (y - 0.5) * 2;
    const ry = (x - 0.5) * 2;
    el.style.setProperty('--rx', String(rx));
    el.style.setProperty('--ry', String(ry));
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0');
    el.style.setProperty('--ry', '0');
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
  }, []);

  const title = isZh ? card.title_zh : card.title_en;
  const firstSnippet = Object.entries(card.snippets)[0];
  const previewText = firstSnippet
    ? (firstSnippet[1][lang] || firstSnippet[1].zh || '').slice(0, 60)
    : '';

  return (
    <div
      ref={ref}
      className="holo-card card-tier-epic"
      style={{ aspectRatio: '3 / 4', '--glow-color': glowColor, '--card-bg1': cardBg[0], '--card-bg2': cardBg[1] } as React.CSSProperties}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <div className="holo-card-inner">
        {/* Dark base */}
        <div className="card-base" />
        {/* Holo iridescent layer */}
        <div className="holo-layer" />
        {/* Shimmer lines */}
        <div className="holo-lines" />
        {/* Spotlight */}
        <div className="holo-spot" />

        {/* Content */}
        <div className="card-content h-full flex flex-col p-4">
          {/* Top: icon + modified badge */}
          <div className="flex items-start justify-between mb-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.04)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={iconPath} />
              </svg>
            </div>
            {isModified && (
              <span className="text-[0.56rem] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.45)' }}>
                {isZh ? '已定制' : 'Custom'}
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom info */}
          <div>
            {/* Title */}
            <div className="text-[0.95rem] font-bold leading-snug mb-1.5 text-text-primary">
              {title}
            </div>
            {/* Preview */}
            {previewText && (
              <div className="text-[0.68rem] leading-relaxed line-clamp-2 text-text-dim">
                {previewText}...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function Inspirations() {
  const lang = useConfig(s => s.language) as 'zh' | 'en';
  const isZh = lang === 'zh' || lang === 'zh-Hant';
  const t = useT(lang);
  const { token } = useAuth();
  const isLoggedIn = !!token;

  const [cards, setCards] = useState<InspirationCard[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Record<string, unknown>>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<InspirationCard | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCard, setExpandedCard] = useState<InspirationCard | null>(null);

  useEffect(() => { getCards().then(setCards).catch(() => {}); }, []);
  useEffect(() => {
    if (isLoggedIn) getCardOverrides().then(setOverrides).catch(() => {});
  }, [isLoggedIn]);

  const handleSaveCard = async (cardId: string, data: Record<string, unknown>) => {
    try {
      await saveCardOverride(cardId, data);
      setOverrides(prev => ({ ...prev, [cardId]: data }));
      setEditingCard(null);
    } catch { /* ignore */ }
  };

  const handleResetCard = async (cardId: string) => {
    try {
      await deleteCardOverride(cardId);
      setOverrides(prev => { const n = { ...prev }; delete n[cardId]; return n; });
      setEditingCard(null);
    } catch { /* ignore */ }
  };

  const filteredCards = cards.filter(card => {
    if (activeCategory && card.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (isZh ? card.title_zh : card.title_en).toLowerCase();
      const tags = card.tags.map(tg => (isZh ? TAG_LABELS[tg] || tg : tg).toLowerCase());
      return title.includes(q) || tags.some(tg => tg.includes(q));
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3.5 mb-1.5">
          <h1 className="text-[1.75rem] font-light tracking-wide" style={{ fontFamily: "'Noto Serif SC', 'Inter', serif" }}>
            {t('inspirationLibrary') as string}
          </h1>
          <span className="bg-gradient-to-r from-pink-50 to-purple-50 text-purple-600 font-mono text-[0.62rem] tracking-widest px-3 py-1 rounded-full font-semibold border border-purple-200">
            {cards.length} CARDS
          </span>
        </div>
        <p className="text-text-dim text-[0.88rem]">{t('inspirationLibraryDesc') as string}</p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-[320px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder={isZh ? '搜索灵感卡...' : 'Search cards...'}
            className="w-full pl-9 pr-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none bg-white"
          />
        </div>
      </div>

      {/* Category navigation tabs */}
      <div className="sticky top-0 z-10 -mx-1 px-1 pb-0 pt-1 bg-bg border-b border-border mb-5 relative">
        <div className="flex overflow-x-auto tab-scrollbar pb-[2px]">

          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 text-[0.8rem] px-4 py-2.5 transition-all relative ${
              !activeCategory
                ? 'text-accent font-semibold'
                : 'text-text-dim hover:text-text-secondary'
            }`}
          >
            {t('allCategories') as string}
            {!activeCategory && <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-accent" />}
          </button>
          {CATEGORY_ORDER.map(cat => {
            const catCards = cards.filter(c => c.category === cat);
            if (catCards.length === 0) return null;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(isActive ? null : cat)}
                className={`shrink-0 text-[0.8rem] px-4 py-2.5 transition-all flex items-center gap-1.5 relative ${
                  isActive ? 'text-accent font-semibold' : 'text-text-dim hover:text-text-secondary'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={CATEGORY_ICONS[cat] || ''} />
                </svg>
                {DEFAULT_CATEGORIES[cat]?.[lang] || cat}
                <span className="text-[0.66rem] opacity-50">{catCards.length}</span>
                {isActive && <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
        {/* Right fade hint for scrollable tabs */}
        <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none bg-gradient-to-l from-bg to-transparent" />
      </div>

      {/* Cards */}
      {filteredCards.length === 0 ? (
        <div className="text-center py-16 text-text-dim text-[0.88rem]">
          {isZh ? '没有找到匹配的灵感卡' : 'No matching cards found'}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCards.map(card => {
            const accent = CATEGORY_ACCENT[card.category] || '#999';
            const glow = CATEGORY_GLOW[card.category] || 'rgba(100,100,255,0.15)';
            const iconPath = CATEGORY_ICONS[card.category] || '';
            const cardBg = CATEGORY_CARD_BG[card.category] || DEFAULT_CARD_BG;
            return (
              <HoloCard
                key={card.id}
                card={card}
                lang={lang}
                isZh={isZh}
                glowColor={glow}
                accent={accent}
                iconPath={iconPath}
                cardBg={cardBg}
                isModified={card.id in overrides}
                onClick={() => setExpandedCard(card)}
              />
            );
          })}
        </div>
      )}

      {/* ── Expanded card overlay ── */}
      {expandedCard && (
        <ExpandedCardView
          card={expandedCard}
          override={overrides[expandedCard.id] || null}
          lang={lang}
          isZh={isZh}
          isLoggedIn={isLoggedIn}
          onEdit={() => { setEditingCard(expandedCard); setExpandedCard(null); }}
          onClose={() => setExpandedCard(null)}
        />
      )}

      {/* Edit modal */}
      {editingCard && (
        <CardEditModal
          card={editingCard}
          override={overrides[editingCard.id] || null}
          language={lang}
          readOnly={!isLoggedIn}
          onSave={handleSaveCard}
          onReset={handleResetCard}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}

/* ── Expanded Card View ── */
function ExpandedCardView({ card, override, lang, isZh, isLoggedIn, onEdit, onClose }: {
  card: InspirationCard;
  override: Record<string, unknown> | null;
  lang: 'zh' | 'en';
  isZh: boolean;
  isLoggedIn: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const t = useT(lang);
  const accent = CATEGORY_ACCENT[card.category] || '#999';
  const iconPath = CATEGORY_ICONS[card.category] || '';
  const title = isZh ? card.title_zh : card.title_en;
  const catLabel = DEFAULT_CATEGORIES[card.category]?.[lang] || card.category;
  const langKey = `prompt_${lang}` as 'prompt_zh' | 'prompt_en';
  const existingOverride = override || {};
  const promptText = (existingOverride[langKey] as string) || card[langKey] || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 card-expand-overlay"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="card-expand-panel w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Dark gradient header */}
        <div className="relative px-6 pt-6 pb-5" style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)' }}>
          {/* Close */}
          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Icon + category */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={iconPath} />
              </svg>
            </div>
            <span className="text-[0.62rem] font-bold uppercase tracking-[0.12em]" style={{ color: accent }}>{catLabel}</span>
          </div>

          {/* Title */}
          <h2 className="text-[1.2rem] font-bold text-white leading-snug" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{title}</h2>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {card.tags.map(tg => (
              <span key={tg} className="text-[0.62rem] px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)' }}>
                {isZh ? (TAG_LABELS[tg] || tg) : tg}
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-white px-6 py-5 space-y-4">
          {promptText && (
            <div>
              <div className="text-[0.68rem] font-bold uppercase tracking-wider mb-1.5" style={{ color: accent }}>{t('promptSnippet') as string}</div>
              <div className="text-[0.84rem] text-text-secondary leading-relaxed p-3 rounded-lg border-l-[3px]" style={{ borderColor: accent, background: `${accent}08` }}>
                {promptText}
              </div>
            </div>
          )}
          {Object.entries(card.snippets).map(([key, val]) => {
            const overSnips = (existingOverride['snippets'] as Record<string, Record<string, string>>) || {};
            const text = overSnips[key]?.[lang] || val[lang] || val.zh || '';
            if (!text) return null;
            const label = SNIPPET_LABELS[key]?.[lang] || key;
            return (
              <div key={key}>
                <div className="text-[0.68rem] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>{label}</div>
                <div className="text-[0.84rem] text-text-dim leading-relaxed">{text}</div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-border px-6 py-3 flex items-center gap-2">
          {isLoggedIn && (
            <button
              onClick={onEdit}
              className="text-[0.82rem] font-semibold px-4 py-2 rounded-lg text-white transition-all hover:brightness-110"
              style={{ background: `linear-gradient(135deg, #1a1a2e, #0f3460)` }}
            >
              {t('edit') as string}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="text-[0.78rem] text-text-dim border border-border px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors">
            {t('close') as string}
          </button>
        </div>
      </div>
    </div>
  );
}

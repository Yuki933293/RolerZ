import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getCards, getCardOverrides, getCardGroups, saveCardGroups,
  saveCardOverride, deleteCardOverride,
  type InspirationCard, type CardGroup,
} from '../api/client';
import { useAuth } from '../stores/useAuth';
import CardEditModal from './CardEditModal';
import InspirationFlipModal from './InspirationFlipModal';
import { useT } from '../i18n';

const DEFAULT_CATEGORIES: Record<string, { zh: string; en: string }> = {
  personality:  { zh: '性格卡', en: 'Personality Card' },
  expression:   { zh: '表达卡', en: 'Expression Card' },
  emotion:      { zh: '情感卡', en: 'Emotion Card' },
  relationship: { zh: '关系卡', en: 'Relationship Card' },
  background:   { zh: '背景卡', en: 'Background Card' },
  behavior:     { zh: '行为卡', en: 'Behavior Card' },
  motivation:   { zh: '动机卡', en: 'Motivation Card' },
  conflict:     { zh: '冲突卡', en: 'Conflict Card' },
  appearance:   { zh: '外貌卡', en: 'Appearance Card' },
  scenario:     { zh: '场景卡', en: 'Scenario Card' },
  quirk:        { zh: '习惯卡', en: 'Quirk Card' },
};

const CATEGORY_COLORS: Record<string, string> = {
  personality: '#4E8CFF', expression: '#F472B6', emotion: '#FBBF24',
  relationship: '#34D399', background: '#A78BFA', behavior: '#60A5FA',
  motivation: '#FB7185', conflict: '#FB923C',
  appearance: '#8B5CF6', scenario: '#14B8A6', quirk: '#F59E0B',
};


const CATEGORY_GLOW: Record<string, string> = {
  personality: 'rgba(78,140,255,0.25)', expression: 'rgba(244,114,182,0.25)',
  emotion: 'rgba(251,191,36,0.2)', relationship: 'rgba(52,211,153,0.25)',
  background: 'rgba(167,139,250,0.25)', behavior: 'rgba(96,165,250,0.25)',
  motivation: 'rgba(251,113,133,0.25)', conflict: 'rgba(251,146,60,0.2)',
  appearance: 'rgba(139,92,246,0.25)', scenario: 'rgba(20,184,166,0.25)',
  quirk: 'rgba(245,158,11,0.2)',
};

const CATEGORY_CARD_BG: Record<string, [string, string]> = {
  personality:  ['#eef4ff', '#dce6f9'],
  expression:   ['#fdf2f8', '#f5dce9'],
  emotion:      ['#fefce8', '#f9edcc'],
  relationship: ['#ecfdf5', '#d5f0e5'],
  background:   ['#f5f3ff', '#e8e0f7'],
  behavior:     ['#eff6ff', '#dce8fa'],
  motivation:   ['#fef2f2', '#f9dede'],
  conflict:     ['#fff7ed', '#f7e8d4'],
  appearance:   ['#f3f0ff', '#e4dcf9'],
  scenario:     ['#f0fdfa', '#d6f1ec'],
  quirk:        ['#fefce8', '#f5edcf'],
};

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

const DEFAULT_CATEGORY_ORDER = [
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
  // appearance
  contrast: '反差', misleading: '误导性', 'first-impression': '第一印象', gap: '落差',
  signature: '标志性', consistent: '固定', identity: '身份', subtle: '微妙',
  expressive: '外显', readable: '可读', transparent: '透明', fluctuating: '起伏',
  plain: '朴素', intentional: '刻意', 'low-maintenance': '省事', comfortable: '自在',
  scar: '疤痕', history: '经历', physical: '身体', story: '故事',
  // scenario
  night: '深夜', strangers: '陌生人', liminal: '过渡', work: '工作',
  proximity: '距离', routine: '日常', 'slow-build': '慢慢靠近',
  rain: '雨天', unexpected: '意外', pause: '暂停', intimate: '亲近',
  transition: '转变', vulnerability: '脆弱', belongings: '物品', change: '变化',
  solitude: '独处', 'in-between': '中间地带', reflection: '反思',
  // quirk
  collecting: '收集', sentimental: '念旧', hoarding: '囤积', meaning: '意义',
  quirky: '古怪', endearing: '可爱', 'alone-habit': '独处习惯', anthropomorphize: '拟人化',
  food: '美食', ritual: '仪式', particular: '讲究', comfort: '治愈',
  walking: '散步', decompression: '减压',
  punctual: '守时', 'over-prepared': '过度准备',
};

/* ── HoloPickerCard: compact holo card for picker ── */
function HoloPickerCard({ card, lang, isSelected, isModified, accent, iconPath, cardBg, glowColor, onClick, onDoubleClick, children }: {
  card: InspirationCard;
  lang: 'zh' | 'en';
  isSelected: boolean;
  isModified: boolean;
  accent: string;
  iconPath: string;
  cardBg: [string, string];
  glowColor: string;
  onClick: () => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.setProperty('--rx', String((y - 0.5) * 2));
    el.style.setProperty('--ry', String((x - 0.5) * 2));
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

  const title = lang === 'zh' ? card.title_zh : card.title_en;
  const firstSnippet = Object.entries(card.snippets)[0];
  const previewText = firstSnippet
    ? (firstSnippet[1][lang] || firstSnippet[1].zh || '').slice(0, 60)
    : '';

  return (
    <div
      ref={ref}
      className={`holo-card card-tier-epic group ${isSelected ? 'ring-2' : ''}`}
      style={{
        aspectRatio: '3 / 4',
        '--glow-color': glowColor,
        '--card-bg1': cardBg[0],
        '--card-bg2': cardBg[1],
        ...(isSelected ? { ringColor: accent, boxShadow: `0 0 0 2px ${accent}, 0 8px 20px ${accent}30` } : {}),
      } as React.CSSProperties}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="holo-card-inner">
        <div className="card-base" />
        <div className="holo-layer" />
        <div className="holo-lines" />
        <div className="holo-spot" />

        <div className="card-content h-full flex flex-col p-4">
          {/* Top: icon + status */}
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.04)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={iconPath} />
              </svg>
            </div>
            {isSelected && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[0.6rem] shrink-0" style={{ background: accent }}>
                &#x2713;
              </span>
            )}
            {isModified && !isSelected && (
              <span className="text-[0.56rem] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.45)' }}>
                {lang === 'zh' ? '已定制' : 'Custom'}
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom info */}
          <div>
            <div className="text-[0.95rem] font-bold leading-snug mb-1.5 text-text-primary">{title}</div>
            {previewText && (
              <div className="text-[0.68rem] leading-relaxed line-clamp-2 text-text-dim">
                {previewText}...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Extra children (e.g. move-to-group dropdown) */}
      {children}
    </div>
  );
}

interface Props {
  language: string;
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function InspirationPicker({ language, selected, onSelectionChange }: Props) {
  const lang = language as 'zh' | 'en';
  const isZh = lang === 'zh';
  const t = useT(language);
  const selectedCount = t('selectedCount') as (n: number) => string;
  const { token } = useAuth();
  const isLoggedIn = !!token;

  const [cards, setCards] = useState<InspirationCard[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Record<string, unknown>>>({});
  const [customGroups, setCustomGroups] = useState<CardGroup[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<InspirationCard | null>(null);
  const [flipCard, setFlipCard] = useState<InspirationCard | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [showGroupManager, setShowGroupManager] = useState(false);

  // Load cards + overrides + groups
  useEffect(() => {
    getCards().then(setCards).catch(() => {});
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      getCardOverrides().then(setOverrides).catch(() => {});
      getCardGroups().then(g => setCustomGroups(g.length > 0 ? g : null)).catch(() => {});
    } else {
      setOverrides({});
      setCustomGroups(null);
    }
  }, [isLoggedIn]);

  const toggle = (id: string) => {
    onSelectionChange(
      selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
    );
  };

  // ── Group logic ──
  const useCustomLayout = customGroups !== null && customGroups.length > 0;

  const defaultByCategory: Record<string, InspirationCard[]> = {};
  for (const card of cards) {
    (defaultByCategory[card.category] ??= []).push(card);
  }

  type DisplayGroup = { id: string; name: string; color: string; cards: InspirationCard[] };
  const displayGroups: DisplayGroup[] = [];

  if (useCustomLayout && customGroups) {
    const cardMap = new Map(cards.map(c => [c.id, c]));
    for (const g of customGroups) {
      const groupCards = g.card_ids.map(id => cardMap.get(id)).filter(Boolean) as InspirationCard[];
      displayGroups.push({
        id: g.group_id,
        name: g.group_name,
        color: CATEGORY_COLORS[g.group_id] || '#6366F1',
        cards: groupCards,
      });
    }
  } else {
    for (const cat of DEFAULT_CATEGORY_ORDER) {
      const catCards = defaultByCategory[cat];
      if (!catCards || catCards.length === 0) continue;
      displayGroups.push({
        id: cat,
        name: DEFAULT_CATEGORIES[cat]?.[lang] || cat,
        color: CATEGORY_COLORS[cat] || '#6366F1',
        cards: catCards,
      });
    }
  }

  // ── Save custom groups ──
  const handleSaveGroups = useCallback(async (groups: CardGroup[]) => {
    setCustomGroups(groups);
    try {
      await saveCardGroups(groups);
    } catch { /* ignore */ }
  }, []);

  const handleCreateCustomGroups = () => {
    const groups: CardGroup[] = DEFAULT_CATEGORY_ORDER.map((cat, i) => ({
      group_id: cat,
      group_name: DEFAULT_CATEGORIES[cat]?.[lang] || cat,
      card_ids: (defaultByCategory[cat] || []).map(c => c.id),
      sort_order: i,
    }));
    handleSaveGroups(groups);
  };

  const handleRenameGroup = (groupId: string, newName: string) => {
    if (!customGroups) return;
    const updated = customGroups.map(g =>
      g.group_id === groupId ? { ...g, group_name: newName } : g
    );
    handleSaveGroups(updated);
    setEditingGroupId(null);
  };

  const handleMoveGroupUp = (index: number) => {
    if (!customGroups || index <= 0) return;
    const updated = [...customGroups];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    handleSaveGroups(updated.map((g, i) => ({ ...g, sort_order: i })));
  };

  const handleMoveGroupDown = (index: number) => {
    if (!customGroups || index >= customGroups.length - 1) return;
    const updated = [...customGroups];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    handleSaveGroups(updated.map((g, i) => ({ ...g, sort_order: i })));
  };

  const handleAddGroup = () => {
    if (!customGroups) return;
    const id = `custom_${Date.now()}`;
    const updated = [...customGroups, {
      group_id: id,
      group_name: isZh ? '新分组' : 'New Group',
      card_ids: [],
      sort_order: customGroups.length,
    }];
    handleSaveGroups(updated);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (!customGroups) return;
    const updated = customGroups.filter(g => g.group_id !== groupId);
    handleSaveGroups(updated);
  };

  const handleResetGroups = () => {
    setCustomGroups(null);
    saveCardGroups([]).catch(() => {});
  };

  const handleMoveCard = (cardId: string, fromGroupId: string, toGroupId: string) => {
    if (!customGroups) return;
    const updated = customGroups.map(g => {
      if (g.group_id === fromGroupId) {
        return { ...g, card_ids: g.card_ids.filter(id => id !== cardId) };
      }
      if (g.group_id === toGroupId) {
        return { ...g, card_ids: [...g.card_ids, cardId] };
      }
      return g;
    });
    handleSaveGroups(updated);
  };

  // ── Card override handlers ──
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
      setOverrides(prev => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
      setEditingCard(null);
    } catch { /* ignore */ }
  };

  return (
    <div>
      {/* Toggle header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left bg-[#E5E5E5] hover:bg-[#D5D5D5] text-text-primary text-[0.82rem] font-medium px-4 py-2 rounded-lg border border-[#D0D0D0] transition-colors"
        >
          {expanded ? '▾' : '▸'}
          {'  '}
          {t('inspirationCards') as string}
          {selected.length > 0 && (
            <span className="ml-2 text-text-faint">· {selectedCount(selected.length)}</span>
          )}
        </button>
        {selected.length > 0 && (
          <button
            onClick={() => onSelectionChange([])}
            className="text-[0.75rem] text-text-dim border border-border px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors"
          >
            {isZh ? '清除' : 'Clear'}
          </button>
        )}
      </div>

      {/* Selected chips when collapsed */}
      {!expanded && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(id => {
            const card = cards.find(c => c.id === id);
            if (!card) return null;
            const title = lang === 'zh' ? card.title_zh : card.title_en;
            return (
              <span
                key={id}
                onClick={() => toggle(id)}
                className="bg-surface-3 text-text-dim text-[0.72rem] px-2.5 py-1 rounded-full border border-border cursor-pointer hover:bg-border transition-colors"
              >
                {title} ×
              </span>
            );
          })}
        </div>
      )}

      {expanded && (() => {
        const filteredCards = activeCategory
          ? cards.filter(c => c.category === activeCategory)
          : cards;

        return (
          <div className="mt-3">
            {/* Category tab navigation */}
            <div className="relative border-b border-border mb-4">
              <div className="flex overflow-x-auto scrollbar-hide pb-[2px]">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`shrink-0 text-[0.76rem] px-3 py-2 transition-all relative ${
                    !activeCategory ? 'text-accent font-semibold' : 'text-text-dim hover:text-text-secondary'
                  }`}
                >
                  {isZh ? '全部' : 'All'}
                  {!activeCategory && <span className="absolute bottom-0 left-1.5 right-1.5 h-[2px] rounded-full bg-accent" />}
                </button>
                {DEFAULT_CATEGORY_ORDER.map(cat => {
                  const catCards = cards.filter(c => c.category === cat);
                  if (catCards.length === 0) return null;
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(isActive ? null : cat)}
                      className={`shrink-0 text-[0.76rem] px-3 py-2 transition-all flex items-center gap-1 relative ${
                        isActive ? 'text-accent font-semibold' : 'text-text-dim hover:text-text-secondary'
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={CATEGORY_ICONS[cat] || ''} />
                      </svg>
                      {DEFAULT_CATEGORIES[cat]?.[lang] || cat}
                      <span className="text-[0.62rem] opacity-50">{catCards.length}</span>
                      {isActive && <span className="absolute bottom-0 left-1.5 right-1.5 h-[2px] rounded-full bg-accent" />}
                    </button>
                  );
                })}
              </div>
              {/* Right fade hint for scrollable tabs */}
              <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none bg-gradient-to-l from-surface to-transparent" />
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-text-faint text-[0.76rem]">
                {isZh
                  ? '单击选择 · 双击查看详情与编辑'
                  : 'Click to select · Double-click to view/edit'}
              </p>
              {isLoggedIn && (
                <div className="flex items-center gap-2">
                  {!useCustomLayout ? (
                    <button
                      onClick={handleCreateCustomGroups}
                      className="text-[0.72rem] text-accent border border-accent/30 px-2.5 py-1 rounded-md hover:bg-accent/5 transition-colors"
                    >
                      {isZh ? '自定义分组' : 'Custom Groups'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowGroupManager(!showGroupManager)}
                        className={`text-[0.72rem] border px-2.5 py-1 rounded-md transition-colors ${
                          showGroupManager ? 'text-accent border-accent bg-accent/5' : 'text-text-dim border-border hover:bg-surface-3'
                        }`}
                      >
                        {showGroupManager ? (isZh ? '完成管理' : 'Done') : (isZh ? '管理分组' : 'Manage Groups')}
                      </button>
                      <button
                        onClick={handleResetGroups}
                        className="text-[0.72rem] text-text-faint border border-border px-2.5 py-1 rounded-md hover:bg-surface-3 transition-colors"
                      >
                        {t('resetDefault') as string}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Group manager panel */}
            {showGroupManager && useCustomLayout && customGroups && (
              <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
                <div className="text-[0.78rem] font-semibold mb-3">
                  {isZh ? '分组管理' : 'Group Management'}
                </div>
                <div className="space-y-2">
                  {customGroups.map((g, idx) => (
                    <div key={g.group_id} className="flex items-center gap-2 bg-white rounded-lg border border-border px-3 py-2">
                      {editingGroupId === g.group_id ? (
                        <input
                          type="text"
                          value={editGroupName}
                          onChange={e => setEditGroupName(e.target.value)}
                          onBlur={() => handleRenameGroup(g.group_id, editGroupName)}
                          onKeyDown={e => e.key === 'Enter' && handleRenameGroup(g.group_id, editGroupName)}
                          className="flex-1 px-2 py-1 text-[0.8rem] border border-accent rounded outline-none"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="flex-1 text-[0.8rem] font-medium cursor-pointer hover:text-accent"
                          onClick={() => { setEditingGroupId(g.group_id); setEditGroupName(g.group_name); }}
                        >
                          {g.group_name}
                        </span>
                      )}
                      <span className="text-[0.68rem] text-text-faint">{g.card_ids.length}</span>
                      <button onClick={() => handleMoveGroupUp(idx)} disabled={idx === 0}
                        className="text-text-faint hover:text-text-primary disabled:opacity-30 text-sm">↑</button>
                      <button onClick={() => handleMoveGroupDown(idx)} disabled={idx === customGroups.length - 1}
                        className="text-text-faint hover:text-text-primary disabled:opacity-30 text-sm">↓</button>
                      <button onClick={() => handleDeleteGroup(g.group_id)}
                        className="text-text-faint hover:text-error text-sm">×</button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddGroup}
                  className="mt-2 text-[0.76rem] text-accent border border-dashed border-accent/40 rounded-lg px-3 py-1.5 w-full hover:bg-accent/5 transition-colors"
                >
                  + {isZh ? '添加新分组' : 'Add New Group'}
                </button>
              </div>
            )}

            {/* Cards grid */}
            {filteredCards.length === 0 ? (
              <div className="text-center py-8 text-text-faint text-[0.76rem]">
                {isZh ? '没有找到匹配的灵感卡' : 'No matching cards found'}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filteredCards.map(card => {
                  const accent = '#4E8CFF';
                  const glow = 'rgba(78,140,255,0.25)';
                  const iconPath = CATEGORY_ICONS[card.category] || '';
                  const cardBg: [string, string] = ['#eef4ff', '#dce6f9'];

                  return (
                    <HoloPickerCard
                      key={card.id}
                      card={card}
                      lang={lang}
                      isSelected={selected.includes(card.id)}
                      isModified={card.id in overrides}
                      accent={accent}
                      iconPath={iconPath}
                      cardBg={cardBg}
                      glowColor={glow}
                      onClick={() => toggle(card.id)}
                      onDoubleClick={(e) => { e.preventDefault(); setFlipCard(card); }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Flip card modal */}
      {flipCard && (
        <InspirationFlipModal
          card={flipCard}
          override={overrides[flipCard.id] || null}
          lang={lang}
          isZh={isZh}
          isLoggedIn={isLoggedIn}
          accent={CATEGORY_COLORS[flipCard.category] || '#4E8CFF'}
          iconPath={CATEGORY_ICONS[flipCard.category] || ''}
          cardBg={CATEGORY_CARD_BG[flipCard.category] || ['#eef4ff', '#dce6f9']}
          glowColor={CATEGORY_GLOW[flipCard.category] || 'rgba(78,140,255,0.25)'}
          categoryLabel={DEFAULT_CATEGORIES[flipCard.category]?.[lang] || flipCard.category}
          tagLabel={(tg) => isZh ? (TAG_LABELS[tg] || tg) : tg}
          onEdit={() => { setEditingCard(flipCard); setFlipCard(null); }}
          onClose={() => setFlipCard(null)}
        />
      )}

      {/* Card edit modal */}
      {editingCard && (
        <CardEditModal
          card={editingCard}
          override={overrides[editingCard.id] || null}
          language={language}
          readOnly={!isLoggedIn}
          onSave={handleSaveCard}
          onReset={handleResetCard}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  getCards, getCardOverrides, saveCardOverride, deleteCardOverride,
  type InspirationCard,
} from '../api/client';
import { useAuth } from '../stores/useAuth';
import { useConfig } from '../stores/useConfig';
import CardEditModal from '../components/CardEditModal';
import { useT } from '../i18n';

const DEFAULT_CATEGORIES: Record<string, { zh: string; en: string }> = {
  personality:  { zh: '性格特质', en: 'Personality' },
  speech:       { zh: '语言风格', en: 'Speech Style' },
  emotion:      { zh: '情感模式', en: 'Emotion Pattern' },
  relationship: { zh: '关系倾向', en: 'Relationship' },
  background:   { zh: '成长背景', en: 'Background' },
  behavior:     { zh: '行为习惯', en: 'Behavior' },
  motivation:   { zh: '内在动机', en: 'Motivation' },
  conflict:     { zh: '冲突应对', en: 'Conflict Style' },
  appearance:   { zh: '外貌风格', en: 'Appearance' },
  scenario:     { zh: '场景设定', en: 'Scenario' },
  quirk:        { zh: '独特癖好', en: 'Quirk' },
};

const CATEGORY_COLORS: Record<string, string> = {
  personality: '#4E8CFF', speech: '#F472B6', emotion: '#FBBF24',
  relationship: '#34D399', background: '#A78BFA', behavior: '#60A5FA',
  motivation: '#FB7185', conflict: '#FB923C',
  appearance: '#8B5CF6', scenario: '#14B8A6', quirk: '#F59E0B',
};

const CATEGORY_ORDER = [
  'personality', 'speech', 'emotion', 'relationship',
  'background', 'behavior', 'motivation', 'conflict',
  'appearance', 'scenario', 'quirk',
];

const TAG_LABELS: Record<string, string> = {
  tsundere: '傲娇', 'outer-cold': '外冷', 'inner-warm': '内热',
  manipulative: '操控', scheming: '心计', 'gap-moe': '反差萌',
  independent: '独立', cool: '冷静', overthinking: '过度思考',
  analytical: '分析型', expressive: '善表达', caring: '关怀',
  sarcastic: '毒舌', sincere: '真诚', stoic: '隐忍', empathetic: '共情',
  protective: '保护欲', possessive: '占有欲', loyal: '忠诚',
  curiosity: '好奇心', justice: '正义', redemption: '救赎',
  // appearance
  heterochromia: '异瞳', striking: '醒目', scar: '伤疤', resilience: '坚韧',
  fashion: '穿搭', accessory: '配饰', physique: '体格', surprise: '意外',
  // scenario
  apocalypse: '末世', survival: '生存', campus: '校园', urban: '都市',
  supernatural: '超自然', confined: '密闭', tension: '紧张', time: '时间',
  // quirk
  collecting: '收集', ritual: '仪式', night: '深夜', dual: '双面',
  food: '美食', bonding: '羁绊', talent: '才艺', 'secret-skill': '隐藏技能',
};

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

  useEffect(() => {
    getCards().then(setCards).catch(() => {});
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      getCardOverrides().then(setOverrides).catch(() => {});
    }
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
      setOverrides(prev => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
      setEditingCard(null);
    } catch { /* ignore */ }
  };

  // Filter cards
  const filteredCards = cards.filter(card => {
    if (activeCategory && card.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (isZh ? card.title_zh : card.title_en).toLowerCase();
      const tags = card.tags.map(t => (isZh ? TAG_LABELS[t] || t : t).toLowerCase());
      return title.includes(q) || tags.some(t => t.includes(q));
    }
    return true;
  });

  // Group by category
  const grouped: Record<string, InspirationCard[]> = {};
  for (const card of filteredCards) {
    (grouped[card.category] ??= []).push(card);
  }

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

      {/* Search + category filter */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isZh ? '搜索灵感卡...' : 'Search cards...'}
            className="w-full pl-9 pr-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-[0.75rem] px-3 py-1.5 rounded-lg border transition-colors ${
              !activeCategory
                ? 'bg-accent/10 border-accent/30 text-accent font-semibold'
                : 'bg-surface-2 border-border text-text-dim hover:bg-surface-3'
            }`}
          >
            {t('allCategories') as string}
          </button>
          {CATEGORY_ORDER.map(cat => {
            const catCards = cards.filter(c => c.category === cat);
            if (catCards.length === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`text-[0.75rem] px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                  activeCategory === cat
                    ? 'bg-accent/10 border-accent/30 text-accent font-semibold'
                    : 'bg-surface-2 border-border text-text-dim hover:bg-surface-3'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />
                {DEFAULT_CATEGORIES[cat]?.[lang] || cat}
                <span className="text-text-faint text-[0.68rem]">{catCards.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards grid */}
      {filteredCards.length === 0 ? (
        <div className="text-center py-16 text-text-dim text-[0.88rem]">
          {isZh ? '没有找到匹配的灵感卡' : 'No matching cards found'}
        </div>
      ) : (
        CATEGORY_ORDER.map(cat => {
          const catCards = grouped[cat];
          if (!catCards || catCards.length === 0) return null;
          return (
            <div key={cat} className="mb-6">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <span className="w-[3px] h-4 rounded-sm" style={{ background: CATEGORY_COLORS[cat] }} />
                <span className="text-[0.84rem] font-semibold text-text-secondary">
                  {DEFAULT_CATEGORIES[cat]?.[lang] || cat}
                </span>
                <span className="text-[0.72rem] text-text-faint">{catCards.length}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {catCards.map(card => {
                  const isModified = card.id in overrides;
                  const title = isZh ? card.title_zh : card.title_en;
                  const snippetKeys = Object.keys(card.snippets);
                  const firstSnippet = snippetKeys[0]
                    ? (card.snippets[snippetKeys[0]]?.[lang] || '')
                    : '';
                  const tagDisplay = card.tags.slice(0, 4)
                    .map(tg => isZh ? (TAG_LABELS[tg] || tg) : tg);

                  return (
                    <div
                      key={card.id}
                      onClick={() => setEditingCard(card)}
                      className={`cursor-pointer bg-white border rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group ${
                        isModified
                          ? 'border-l-[3px] border-l-amber-400 border-border'
                          : 'border-border hover:border-accent/30'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-[0.88rem] font-semibold text-text-primary group-hover:text-accent transition-colors">
                          {isModified && <span className="text-amber-500 mr-1">✎</span>}
                          {title}
                        </div>
                        <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: CATEGORY_COLORS[card.category] }} />
                      </div>
                      {firstSnippet && (
                        <div className="text-[0.78rem] text-text-dim leading-relaxed mb-2.5 line-clamp-2">
                          {firstSnippet}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {tagDisplay.map(tag => (
                          <span key={tag} className="bg-surface-2 text-text-faint text-[0.68rem] px-2 py-0.5 rounded-full border border-border">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
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

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../stores/useAuth';
import { useConfig } from '../stores/useConfig';
import { useT } from '../i18n';
import {
  getCommunityPersonas, togglePersonaLike, deleteSharedPersona,
  getTierConfig,
  type SharedPersona, type TierConfig,
} from '../api/client';
import LoginPrompt from '../components/LoginPrompt';

/* ── Tier logic for shared personas ── */
type Tier = 'normal' | 'rare' | 'epic' | 'legendary' | 'mythic';

// Fallback thresholds (used before backend config loads)
const DEFAULT_THRESHOLDS = { rare: 10, epic: 50, legendary: 200 };

function getBaseTier(likes: number, thresholds: TierConfig['thresholds']): Exclude<Tier, 'mythic'> {
  if (likes >= thresholds.legendary) return 'legendary';
  if (likes >= thresholds.epic) return 'epic';
  if (likes >= thresholds.rare) return 'rare';
  return 'normal';
}

function computeTiers(
  personas: SharedPersona[],
  thresholds: TierConfig['thresholds'],
  mythicTopN: number,
): Map<number, { tier: Tier; mythicRank?: number }> {
  const result = new Map<number, { tier: Tier; mythicRank?: number }>();
  const legendaries: { id: number; likes: number }[] = [];

  for (const p of personas) {
    const base = getBaseTier(p.likes, thresholds);
    result.set(p.id, { tier: base });
    if (base === 'legendary') {
      legendaries.push({ id: p.id, likes: p.likes });
    }
  }

  legendaries.sort((a, b) => b.likes - a.likes);
  for (let i = 0; i < Math.min(legendaries.length, mythicTopN); i++) {
    result.set(legendaries[i].id, { tier: 'mythic', mythicRank: i + 1 });
  }

  return result;
}

const TIER_BG: Record<Tier, [string, string]> = {
  normal:    ['#f3f4f6', '#e5e7eb'],
  rare:      ['#edeaf2', '#ccc8d8'],
  epic:      ['#e8f2ff', '#c8ddf5'],
  legendary: ['#f3eae4', '#dfc8b4'],
  mythic:    ['#1a1a2e', '#0f3460'],
};

const TIER_GLOW: Record<Tier, string> = {
  normal:    'rgba(0,0,0,0)',
  rare:      'rgba(140,120,180,0.25)',
  epic:      'rgba(0,112,221,0.25)',
  legendary: 'rgba(255,128,0,0.25)',
  mythic:    'rgba(212,175,55,0.25)',
};

const TIER_LABEL: Record<Tier, { zh: string; en: string }> = {
  normal:    { zh: '普通', en: 'Normal' },
  rare:      { zh: '稀有', en: 'Rare' },
  epic:      { zh: '史诗', en: 'Epic' },
  legendary: { zh: '传说', en: 'Legendary' },
  mythic:    { zh: '神话', en: 'Mythic' },
};

const TIER_BADGE_CLASS: Record<Tier, string> = {
  normal:    'bg-gray-100 text-gray-500 border-gray-200',
  rare:      'bg-purple-50 text-purple-500 border-purple-200',
  epic:      'bg-blue-50 text-blue-500 border-blue-200',
  legendary: 'bg-amber-50 text-amber-600 border-amber-200',
  mythic:    'bg-yellow-50 text-yellow-600 border-yellow-300',
};

/* ── Sub-module categories (using backend card_type field) ── */
type CategoryId = 'all' | 'personality' | 'character' | 'background' | 'emotion' | 'scenario' | 'appearance';

const DISCOVER_CATEGORIES: { id: CategoryId; zh: string; en: string }[] = [
  { id: 'all',         zh: '全部',   en: 'All' },
  { id: 'personality', zh: '性格卡', en: 'Personality' },
  { id: 'character',   zh: '角色卡', en: 'Character' },
  { id: 'background',  zh: '背景卡', en: 'Background' },
  { id: 'emotion',     zh: '情感卡', en: 'Emotion' },
  { id: 'scenario',    zh: '场景卡', en: 'Scenario' },
  { id: 'appearance',  zh: '外貌卡', en: 'Appearance' },
];

/* ── Persona holo card ── */
function PersonaHoloCard({
  persona, tier, mythicRank, isZh, onLike, onDelete, isOwner, token, expanded, onToggleExpand,
}: {
  persona: SharedPersona;
  tier: Tier;
  mythicRank?: number;
  isZh: boolean;
  onLike: () => void;
  onDelete: () => void;
  isOwner: boolean;
  token: string | null;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const hasMouseTracking = tier === 'epic' || tier === 'legendary' || tier === 'mythic';

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!hasMouseTracking) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.setProperty('--rx', `${(y - 0.5) * -12}`);
    el.style.setProperty('--ry', `${(x - 0.5) * 12}`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  }, [hasMouseTracking]);

  const handleMouseLeave = useCallback(() => {
    if (!hasMouseTracking) return;
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0');
    el.style.setProperty('--ry', '0');
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
  }, [hasMouseTracking]);

  const bg = TIER_BG[tier];
  const glowColor = TIER_GLOW[tier];

  return (
    <div className="space-y-0">
      {/* Holo card */}
      <div
        ref={cardRef}
        className={`holo-card card-tier-${tier}`}
        style={{
          width: '100%',
          aspectRatio: '3 / 4',
          '--card-bg1': bg[0],
          '--card-bg2': bg[1],
          '--glow-color': glowColor,
        } as React.CSSProperties}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="holo-card-inner">
          <div className="card-base" />
          <div className="holo-layer" />
          <div className="holo-lines" />
          <div className="holo-spot" />
          {tier === 'mythic' && <div className="gold-sweep" />}
          {tier === 'mythic' && (
            <div className="mythic-particles">
              <span /><span /><span /><span /><span /><span />
            </div>
          )}
          <div className="card-content h-full flex flex-col p-4">
            {/* Card header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {persona.name[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[0.85rem] text-text-primary truncate">{persona.name}</div>
                  <div className="text-[0.65rem] text-text-faint">
                    @{persona.author}
                  </div>
                </div>
              </div>
              <span className={`text-[0.58rem] font-semibold px-1.5 py-0.5 rounded-full border ${TIER_BADGE_CLASS[tier]}`}>
                {isZh ? TIER_LABEL[tier].zh : TIER_LABEL[tier].en}
                {tier === 'mythic' && mythicRank && (
                  <span className="ml-1 text-yellow-500">#{mythicRank}</span>
                )}
              </span>
            </div>

            {/* Tags */}
            {persona.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {persona.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="bg-black/5 text-text-dim text-[0.6rem] px-1.5 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 text-[0.76rem] text-text-secondary leading-relaxed overflow-hidden">
              {persona.summary || persona.natural_text?.slice(0, 120) || ''}
              {!persona.summary && persona.natural_text && persona.natural_text.length > 120 && '...'}
            </div>

            {/* Score */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
              <div
                className="text-[0.68rem] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  color: persona.score > 0.7 ? '#059669' : persona.score > 0.42 ? '#D97706' : '#999',
                  background: persona.score > 0.7 ? '#05966910' : persona.score > 0.42 ? '#D9770610' : '#99999910',
                }}
              >
                {Math.round(persona.score * 100)}
              </div>
              <div className="text-[0.6rem] text-text-faint">
                {new Date(persona.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar below card */}
      <div className="flex items-center justify-between px-1 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onLike}
            disabled={!token}
            className={`flex items-center gap-1 text-[0.74rem] px-2.5 py-1 rounded-lg transition-colors ${
              persona.liked
                ? 'text-rose-500 bg-rose-50 border border-rose-200'
                : 'text-text-faint hover:text-rose-500 hover:bg-rose-50 border border-transparent'
            } disabled:opacity-40`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={persona.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {persona.likes}
          </button>
          <button
            onClick={onToggleExpand}
            className="text-[0.72rem] text-accent hover:text-accent/80 transition-colors"
          >
            {expanded ? (isZh ? '收起' : 'Less') : (isZh ? '详情' : 'More')}
          </button>
        </div>
        {isOwner && (
          <button
            onClick={onDelete}
            className="text-[0.68rem] text-text-faint hover:text-error transition-colors"
          >
            {isZh ? '删除' : 'Remove'}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 space-y-2 px-1">
          {persona.natural_text && (
            <div className="text-[0.8rem] text-text-secondary leading-relaxed bg-surface-2 rounded-lg p-3 border border-border">
              {persona.natural_text}
            </div>
          )}
          {persona.spec_data && (
            <div className="grid grid-cols-1 gap-1.5">
              {Object.entries(persona.spec_data)
                .filter(([k, v]) => k !== 'opening_line' && v && typeof v === 'string')
                .slice(0, 8)
                .map(([k, v]) => (
                  <div key={k} className="bg-surface-2 rounded-lg px-3 py-2 border border-border">
                    <div className="text-[0.64rem] font-semibold text-accent uppercase tracking-wider mb-0.5">{k}</div>
                    <div className="text-[0.78rem] text-text-secondary leading-relaxed">{v as string}</div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Tier change notification modal (upgrade + downgrade) ── */
const TIER_ORDER: Tier[] = ['normal', 'rare', 'epic', 'legendary', 'mythic'];

function TierChangeModal({ personaName, oldTier, newTier, newRank, isZh, onClose, onSkip }: {
  personaName: string;
  oldTier: Tier;
  newTier: Tier;
  newRank?: number;
  isZh: boolean;
  onClose: () => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<'enter' | 'reveal' | 'done'>('enter');
  const isUpgrade = TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(oldTier);
  const bg = TIER_BG[newTier];
  const glowColor = isUpgrade ? TIER_GLOW[newTier] : 'rgba(100,100,100,0.15)';

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('reveal'), 800);
    const t2 = setTimeout(() => setPhase('done'), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} className="flex flex-col items-center">
        {/* Title text */}
        <div className={`text-center mb-6 transition-all duration-700 ${phase === 'enter' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className={`text-[0.78rem] mb-1 ${isUpgrade ? 'text-white/60' : 'text-white/40'}`}>
            {isUpgrade
              ? (isZh ? '等级提升' : 'Tier Upgrade')
              : (isZh ? '等级变更' : 'Tier Change')}
          </div>
          <div className="text-white text-lg font-bold mb-1">{personaName}</div>
          <div className="flex items-center gap-2 justify-center text-[0.84rem]">
            <span className="text-white/50">{TIER_LABEL[oldTier][isZh ? 'zh' : 'en']}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
              {isUpgrade
                ? <polyline points="9 18 15 12 9 6" />
                : <polyline points="15 18 9 12 15 6" />}
            </svg>
            <span className={`font-bold ${isUpgrade ? 'text-amber-300' : 'text-gray-400'}`}>
              {TIER_LABEL[newTier][isZh ? 'zh' : 'en']}
            </span>
            {newTier === 'mythic' && newRank && (
              <span className="text-yellow-400 text-[0.72rem]">#{newRank}</span>
            )}
          </div>
          {!isUpgrade && (
            <div className="text-white/30 text-[0.7rem] mt-2 max-w-[240px]">
              {isZh ? '由于阶段阈值调整，等级发生了变化' : 'Tier changed due to threshold adjustment'}
            </div>
          )}
        </div>

        {/* Card animation */}
        <div
          className={`holo-card card-tier-${newTier} transition-all duration-1000 ${
            phase === 'enter' ? 'scale-75 opacity-0' : phase === 'reveal' ? 'scale-110 opacity-100' : 'scale-100 opacity-100'
          } ${!isUpgrade ? 'grayscale-[0.3]' : ''}`}
          style={{
            width: 220,
            aspectRatio: '3 / 4',
            '--card-bg1': bg[0],
            '--card-bg2': bg[1],
            '--glow-color': glowColor,
          } as React.CSSProperties}
        >
          <div className="holo-card-inner">
            <div className="card-base" />
            <div className="holo-layer" />
            <div className="holo-lines" />
            <div className="holo-spot" />
            {newTier === 'mythic' && <div className="gold-sweep" />}
            {newTier === 'mythic' && (
              <div className="mythic-particles">
                <span /><span /><span /><span /><span /><span />
              </div>
            )}
            <div className="card-content h-full flex flex-col items-center justify-center p-4 text-center">
              <div className={`text-lg font-bold mb-1 ${newTier === 'mythic' ? 'text-amber-200' : 'text-text-primary'}`}>
                {personaName}
              </div>
              <div className={`text-[0.72rem] ${newTier === 'mythic' ? 'text-amber-200/60' : 'text-text-faint'}`}>
                {TIER_LABEL[newTier][isZh ? 'zh' : 'en']}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-[0.78rem] text-white/50 hover:text-white/80 transition-colors"
          >
            {isZh ? '跳过' : 'Skip'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-[0.82rem] bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
          >
            {isZh ? '确认' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Tier tracking in localStorage ── */
const TIER_STORAGE_KEY = 'rolerz_persona_tiers';

function getSavedTiers(): Record<number, Tier> {
  try {
    return JSON.parse(localStorage.getItem(TIER_STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveTiers(tiers: Record<number, Tier>) {
  localStorage.setItem(TIER_STORAGE_KEY, JSON.stringify(tiers));
}

/* ── Main component ── */
export default function Discover() {
  const { token, username } = useAuth();
  const lang = useConfig(s => s.language);
  const t = useT(lang);
  const [personas, setPersonas] = useState<SharedPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [category, setCategory] = useState<CategoryId>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [upgradeInfo, setUpgradeInfo] = useState<{
    personaName: string; oldTier: Tier; newTier: Tier; newRank?: number;
  } | null>(null);
  const upgradeQueueRef = useRef<typeof upgradeInfo[]>([]);
  const [tierCfg, setTierCfg] = useState<TierConfig>({
    phase: 1, user_count: 0, mythic_top_n: 750,
    thresholds: DEFAULT_THRESHOLDS, mode: 'fixed',
  });

  const isZh = lang === 'zh' || lang === 'zh-Hant';

  // Load tier config once
  useEffect(() => {
    getTierConfig().then(setTierCfg).catch(() => {});
  }, []);

  const checkUpgrades = useCallback((data: SharedPersona[]) => {
    if (!username) return;
    const saved = getSavedTiers();
    const newSaved = { ...saved };
    const upgrades: NonNullable<typeof upgradeInfo>[] = [];

    for (const p of data) {
      if (p.author !== username) continue;
      const tierInfo = computeTiers(data, tierCfg.thresholds, tierCfg.mythic_top_n).get(p.id);
      // Prefer backend mythic_rank
      const currentTier = p.mythic_rank ? 'mythic' as Tier : (tierInfo?.tier ?? 'normal');
      const previousTier = saved[p.id] as Tier | undefined;

      if (previousTier && currentTier !== previousTier) {
        upgrades.push({
          personaName: p.name,
          oldTier: previousTier,
          newTier: currentTier,
          newRank: p.mythic_rank ?? tierInfo?.mythicRank,
        });
      }
      newSaved[p.id] = currentTier;
    }

    saveTiers(newSaved);

    if (upgrades.length > 0) {
      upgradeQueueRef.current = upgrades.slice(1);
      setUpgradeInfo(upgrades[0]);
    }
  }, [username, tierCfg]);

  const dismissUpgrade = useCallback(() => {
    if (upgradeQueueRef.current.length > 0) {
      setUpgradeInfo(upgradeQueueRef.current.shift()!);
    } else {
      setUpgradeInfo(null);
    }
  }, []);

  const loadPersonas = async () => {
    setLoading(true);
    try {
      const data = await getCommunityPersonas({ sort, tag: '', limit: 100 });
      setPersonas(data);
      checkUpgrades(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadPersonas(); }, [sort]);

  const handleLike = async (id: number) => {
    if (!token) return;
    try {
      const res = await togglePersonaLike(id);
      setPersonas(prev => prev.map(p =>
        p.id === id ? { ...p, liked: res.liked, likes: p.likes + (res.liked ? 1 : -1) } : p
      ));
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    const msg = t('deleteShareConfirm') as string;
    if (!confirm(msg)) return;
    try {
      await deleteSharedPersona(id);
      setPersonas(prev => prev.filter(p => p.id !== id));
    } catch { /* ignore */ }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Compute tiers for all personas; use backend mythic_rank when available
  const tierMap = computeTiers(personas, tierCfg.thresholds, tierCfg.mythic_top_n);
  // Override with backend mythic_rank
  for (const p of personas) {
    if (p.mythic_rank) {
      tierMap.set(p.id, { tier: 'mythic', mythicRank: p.mythic_rank });
    }
  }

  // Filter by category (backend card_type field)
  const categoryFiltered = category === 'all'
    ? personas
    : personas.filter(p => p.card_type === category);

  // Collect tags from category-filtered personas
  const allTags = [...new Set(categoryFiltered.flatMap(p => p.tags))].slice(0, 30);

  // Then filter by selected tags (AND logic)
  const filteredPersonas = selectedTags.length === 0
    ? categoryFiltered
    : categoryFiltered.filter(p => selectedTags.every(tag => p.tags.includes(tag)));

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3.5 mb-1.5">
          <h1 className="text-[1.75rem] font-light tracking-wide" style={{ fontFamily: "'Noto Serif SC', 'Inter', serif" }}>
            {t('discoverTitle') as string}
          </h1>
          <span className="bg-gradient-to-r from-blue-50 to-indigo-50 text-accent font-mono text-[0.62rem] tracking-widest px-3 py-1 rounded-full font-semibold border border-blue-200">
            DISCOVER
          </span>
        </div>
        <p className="text-text-dim text-[0.88rem]">{t('discoverDesc') as string}</p>
      </div>

      {/* Category sub-modules */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto scrollbar-thin pb-1">
        {DISCOVER_CATEGORIES.map(cat => {
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => { setCategory(cat.id); setSelectedTags([]); }}
              className={`text-[0.8rem] px-4 py-1.5 rounded-full border whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-accent text-white border-accent font-semibold shadow-sm'
                  : 'bg-white text-text-dim border-border hover:bg-surface-2'
              }`}
            >
              {isZh ? cat.zh : cat.en}
              {cat.id !== 'all' && (() => {
                const count = personas.filter(p => p.card_type === cat.id).length;
                return count > 0 ? <span className={`ml-1.5 text-[0.65rem] ${isActive ? 'text-white/70' : 'text-text-faint'}`}>{count}</span> : null;
              })()}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setSort('latest')}
            className={`text-[0.78rem] px-3.5 py-1.5 transition-colors ${
              sort === 'latest' ? 'bg-accent text-white' : 'bg-white text-text-dim hover:bg-surface-2'
            }`}
          >
            {t('sortLatest') as string}
          </button>
          <button
            onClick={() => setSort('popular')}
            className={`text-[0.78rem] px-3.5 py-1.5 transition-colors border-l border-border ${
              sort === 'popular' ? 'bg-accent text-white' : 'bg-white text-text-dim hover:bg-surface-2'
            }`}
          >
            {t('sortPopular') as string}
          </button>
        </div>

        {selectedTags.length > 0 && (
          <button
            onClick={() => setSelectedTags([])}
            className="text-[0.72rem] px-2.5 py-1 rounded-full border border-error/30 text-error bg-error/5 hover:bg-error/10 transition-colors"
          >
            {isZh ? '清除筛选' : 'Clear filters'} ({selectedTags.length})
          </button>
        )}
      </div>

      {/* Tag filter — multi-select */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          <span className="text-[0.72rem] text-text-faint mr-1">
            {isZh ? '标签筛选：' : 'Tags:'}
          </span>
          {allTags.map(tag => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-[0.72rem] px-2.5 py-1 rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-accent/10 border-accent/30 text-accent font-medium'
                    : 'bg-white border-border text-text-faint hover:bg-surface-2'
                }`}
              >
                {tag}
                {isSelected && (
                  <span className="ml-1 text-accent/60">×</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-text-dim">{t('loading') as string}</div>
      ) : filteredPersonas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white shadow-lg mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>
          <p className="text-text-dim text-[0.88rem] text-center max-w-md">
            {selectedTags.length > 0
              ? (isZh ? '没有匹配的角色卡' : 'No matching characters')
              : (t('communityEmpty') as string)}
          </p>
          {!token && selectedTags.length === 0 && (
            <div className="mt-6">
              <LoginPrompt titleKey="loginDefault" descKey="loginDefaultDesc" />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPersonas.map(persona => {
            const info = tierMap.get(persona.id) ?? { tier: 'normal' as Tier };
            const isOwner = persona.author === username;
            const isExpanded = expandedId === persona.id;
            return (
              <PersonaHoloCard
                key={persona.id}
                persona={persona}
                tier={info.tier}
                mythicRank={info.mythicRank}
                isZh={isZh}
                onLike={() => handleLike(persona.id)}
                onDelete={() => handleDelete(persona.id)}
                isOwner={isOwner}
                token={token}
                expanded={isExpanded}
                onToggleExpand={() => setExpandedId(isExpanded ? null : persona.id)}
              />
            );
          })}
        </div>
      )}

      {/* Upgrade notification modal */}
      {upgradeInfo && (
        <TierChangeModal
          personaName={upgradeInfo.personaName}
          oldTier={upgradeInfo.oldTier}
          newTier={upgradeInfo.newTier}
          newRank={upgradeInfo.newRank}
          isZh={isZh}
          onClose={dismissUpgrade}
          onSkip={dismissUpgrade}
        />
      )}
    </div>
  );
}
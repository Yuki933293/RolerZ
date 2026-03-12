import { useEffect, useState, useCallback } from 'react';
import { getCards, fusionGenerate, type InspirationCard, type FusionResult } from '../api/client';
import { useConfig } from '../stores/useConfig';
import { useAuth } from '../stores/useAuth';
import LoginPrompt from '../components/LoginPrompt';
import { useT } from '../i18n';

const CATEGORIES: Record<string, { zh: string; en: string }> = {
  personality:  { zh: '性格', en: 'Personality' },
  expression:   { zh: '表达', en: 'Expression' },
  emotion:      { zh: '情感', en: 'Emotion' },
  relationship: { zh: '关系', en: 'Relationship' },
  background:   { zh: '背景', en: 'Background' },
  behavior:     { zh: '行为', en: 'Behavior' },
  motivation:   { zh: '动机', en: 'Motivation' },
  conflict:     { zh: '冲突', en: 'Conflict' },
  appearance:   { zh: '外貌', en: 'Appearance' },
  scenario:     { zh: '场景', en: 'Scenario' },
  quirk:        { zh: '习惯', en: 'Quirk' },
  task:         { zh: '任务', en: 'Task' },
  worldview:    { zh: '世界观', en: 'Worldview' },
};

const CATEGORY_COLORS: Record<string, string> = {
  personality: '#4E8CFF', expression: '#F472B6', emotion: '#FBBF24',
  relationship: '#34D399', background: '#A78BFA', behavior: '#60A5FA',
  motivation: '#FB7185', conflict: '#FB923C',
  appearance: '#8B5CF6', scenario: '#14B8A6', quirk: '#F59E0B',
  task: '#EF4444', worldview: '#6366F1',
};

const CATEGORY_ORDER = [
  'personality', 'expression', 'emotion', 'relationship',
  'background', 'behavior', 'motivation', 'conflict',
  'appearance', 'scenario', 'quirk', 'task', 'worldview',
];

/* Spec field labels for result display */
const FIELD_LABELS: Record<string, { zh: string; en: string }> = {
  identity: { zh: '身份', en: 'Identity' },
  appearance: { zh: '外貌', en: 'Appearance' },
  background: { zh: '背景', en: 'Background' },
  personality: { zh: '性格', en: 'Personality' },
  voice: { zh: '说话方式', en: 'Voice' },
  goals: { zh: '目标', en: 'Goals' },
  relationships: { zh: '关系', en: 'Relationships' },
  conflicts: { zh: '冲突', en: 'Conflicts' },
  taboos: { zh: '禁忌', en: 'Taboos' },
  dialogue_examples: { zh: '对话示例', en: 'Dialogue Examples' },
  opening_line: { zh: '开场白', en: 'Opening Line' },
  system_constraints: { zh: '系统约束', en: 'System Constraints' },
};

const RESULT_FIELD_ORDER = [
  'identity', 'appearance', 'background', 'personality', 'voice',
  'goals', 'relationships', 'conflicts', 'taboos',
  'dialogue_examples', 'opening_line', 'system_constraints',
];

export default function FusionLab() {
  const config = useConfig();
  const token = useAuth(s => s.token);
  const t = useT(config.language);
  const lang = config.language === 'en' ? 'en' : 'zh';

  const [allCards, setAllCards] = useState<InspirationCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FusionResult | null>(null);
  const [fusionAnim, setFusionAnim] = useState(false);

  useEffect(() => {
    getCards().then(setAllCards).catch(() => {});
  }, []);

  const selectedCards = allCards.filter(c => selectedIds.includes(c.id));
  const availableCards = allCards.filter(c => {
    if (selectedIds.includes(c.id)) return false;
    if (filterCategory && c.category !== filterCategory) return false;
    return true;
  });

  // Group available categories from actual cards
  const availableCategories = CATEGORY_ORDER.filter(cat =>
    allCards.some(c => c.category === cat)
  );

  const addCard = useCallback((id: string) => {
    if (selectedIds.length >= 5) return;
    if (selectedIds.includes(id)) return;
    setSelectedIds(prev => [...prev, id]);
  }, [selectedIds]);

  const removeCard = useCallback((id: string) => {
    setSelectedIds(prev => prev.filter(x => x !== id));
  }, []);

  const handleFuse = async () => {
    if (selectedIds.length < 2) return;
    setLoading(true);
    setError('');
    setResult(null);
    setFusionAnim(true);

    // Animation delay
    await new Promise(r => setTimeout(r, 800));

    try {
      const res = await fusionGenerate({
        card_ids: selectedIds,
        language: config.language,
        provider: config.provider,
        model: config.modelName || config.modelId || undefined,
        api_key: config.apiKey || undefined,
        base_url: config.baseUrl || undefined,
        temperature: config.advanced.temperature,
        top_p: config.advanced.topP,
        max_tokens: config.advanced.maxTokens,
      });
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('fusionFailed') as string);
    } finally {
      setLoading(false);
      setFusionAnim(false);
    }
  };

  if (!token) {
    return <LoginPrompt titleKey="loginToCreate" />;
  }

  const isConfigured = config.configured;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </span>
            {t('fusionLab') as string}
          </h1>
          <p className="text-sm text-text-dim mt-2">{t('fusionLabDesc') as string}</p>
        </div>

        {/* Fusion Slots */}
        <div className="mb-6">
          <div className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
            {t('fusionSlots') as string}
            <span className="text-xs text-text-muted font-normal">({selectedIds.length}/5)</span>
          </div>

          <div className={`
            relative rounded-2xl border-2 border-dashed p-5 min-h-[120px] transition-all duration-300
            ${fusionAnim ? 'border-violet-400 bg-violet-50/50 dark:bg-violet-900/10' : 'border-border bg-surface-2/50'}
            ${selectedIds.length === 0 ? 'flex items-center justify-center' : ''}
          `}>
            {fusionAnim && (
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-pink-500/10 to-violet-500/10 animate-pulse" />
              </div>
            )}

            {selectedIds.length === 0 ? (
              <p className="text-sm text-text-muted">{t('fusionEmpty') as string}</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {selectedCards.map((card, idx) => {
                  const color = CATEGORY_COLORS[card.category] || '#888';
                  const catName = CATEGORIES[card.category]?.[lang] || card.category;
                  const title = lang === 'en' ? card.title_en : card.title_zh;
                  return (
                    <div key={card.id} className="relative group">
                      {/* Connector "+" between cards */}
                      {idx > 0 && (
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white dark:bg-surface-3 border border-border flex items-center justify-center text-xs font-bold text-violet-500 z-10">
                          +
                        </div>
                      )}
                      <div
                        className="relative rounded-xl px-4 py-3 pr-8 border transition-all hover:shadow-md cursor-default"
                        style={{
                          borderColor: color + '40',
                          background: `linear-gradient(135deg, ${color}08, ${color}15)`,
                        }}
                      >
                        <div className="text-[0.65rem] font-semibold uppercase tracking-wider mb-1" style={{ color }}>
                          {catName}
                        </div>
                        <div className="text-sm font-medium text-text-primary leading-tight">
                          {title}
                        </div>
                        {/* Remove button */}
                        <button
                          onClick={() => removeCard(card.id)}
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/5 hover:bg-red-100 text-text-muted hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Fuse Button */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={handleFuse}
            disabled={selectedIds.length < 2 || loading || !isConfigured}
            className={`
              px-6 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${selectedIds.length >= 2 && !loading && isConfigured
                ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white hover:shadow-lg hover:shadow-violet-200 active:scale-[0.98]'
                : 'bg-surface-3 text-text-muted cursor-not-allowed'
              }
            `}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" />
                </svg>
                {t('fusionFusing') as string}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                {t('fusionStart') as string}
              </span>
            )}
          </button>

          {selectedIds.length < 2 && selectedIds.length > 0 && (
            <span className="text-xs text-amber-500">{t('fusionMinCards') as string}</span>
          )}
          {!isConfigured && (
            <span className="text-xs text-error">{t('notConfiguredWarning') as string}</span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              {t('fusionResult') as string}
            </h2>

            {/* Fusion note */}
            {result.fusion_note && (
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-violet-50 to-pink-50 border border-violet-200/50">
                <div className="text-xs font-semibold text-violet-600 mb-1">{t('fusionNote') as string}</div>
                <div className="text-sm text-text-secondary">{result.fusion_note}</div>
              </div>
            )}

            {/* Tags */}
            {result.tags && result.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {result.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700 font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Spec fields */}
            <div className="space-y-3">
              {RESULT_FIELD_ORDER.map(field => {
                const value = (result as unknown as Record<string, unknown>)[field];
                if (!value || typeof value !== 'string') return null;
                const label = FIELD_LABELS[field]?.[lang] || field;
                return (
                  <div key={field} className="rounded-xl border border-border bg-white dark:bg-surface-2 overflow-hidden">
                    <div className="px-4 py-2 bg-surface-2/50 border-b border-border">
                      <span className="text-xs font-semibold text-text-dim uppercase tracking-wider">{label}</span>
                    </div>
                    <div className="px-4 py-3 text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                      {value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Card Library */}
        <div>
          <div className="text-sm font-semibold text-text-secondary mb-3">
            {t('fusionAddCard') as string}
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setFilterCategory('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !filterCategory ? 'bg-accent text-white' : 'bg-surface-3 text-text-dim hover:bg-surface-2'
              }`}
            >
              {t('fusionAllCategories') as string}
            </button>
            {availableCategories.map(cat => {
              const color = CATEGORY_COLORS[cat] || '#888';
              const name = CATEGORIES[cat]?.[lang] || cat;
              const isActive = filterCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(isActive ? '' : cat)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: isActive ? color : undefined,
                    color: isActive ? 'white' : color,
                    border: isActive ? 'none' : `1px solid ${color}30`,
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {availableCards.map(card => {
              const color = CATEGORY_COLORS[card.category] || '#888';
              const catName = CATEGORIES[card.category]?.[lang] || card.category;
              const title = lang === 'en' ? card.title_en : card.title_zh;
              const prompt = lang === 'en' ? card.prompt_en : card.prompt_zh;
              const canAdd = selectedIds.length < 5;
              return (
                <button
                  key={card.id}
                  onClick={() => canAdd && addCard(card.id)}
                  disabled={!canAdd}
                  className={`
                    text-left rounded-xl border p-3 transition-all
                    ${canAdd
                      ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                    }
                  `}
                  style={{
                    borderColor: color + '30',
                    background: `linear-gradient(145deg, white, ${color}08)`,
                  }}
                >
                  <div className="text-[0.6rem] font-bold uppercase tracking-widest mb-1.5" style={{ color }}>
                    {catName}
                  </div>
                  <div className="text-[0.82rem] font-semibold text-text-primary mb-1.5 leading-tight">
                    {title}
                  </div>
                  <div className="text-[0.7rem] text-text-dim leading-relaxed line-clamp-2">
                    {prompt}
                  </div>
                </button>
              );
            })}
          </div>

          {availableCards.length === 0 && (
            <div className="text-center py-8 text-sm text-text-muted">
              {filterCategory
                ? (lang === 'en' ? 'No cards in this category' : '该类别没有可用卡牌')
                : (lang === 'en' ? 'All cards have been added' : '所有卡牌已添加')
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

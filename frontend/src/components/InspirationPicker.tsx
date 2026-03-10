import { useEffect, useState, useCallback } from 'react';
import {
  getCards, getCardOverrides, getCardGroups, saveCardGroups,
  saveCardOverride, deleteCardOverride,
  type InspirationCard, type CardGroup,
} from '../api/client';
import { useAuth } from '../stores/useAuth';
import CardEditModal from './CardEditModal';
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

const DEFAULT_CATEGORY_ORDER = [
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
  heterochromia: '异瞳', striking: '醒目', scar: '伤疤', resilience: '坚韧',
  fashion: '穿搭', accessory: '配饰', physique: '体格', surprise: '意外',
  apocalypse: '末世', survival: '生存', campus: '校园', urban: '都市',
  supernatural: '超自然', confined: '密闭', tension: '紧张', time: '时间',
  collecting: '收集', ritual: '仪式', night: '深夜', dual: '双面',
  food: '美食', bonding: '羁绊', talent: '才艺', 'secret-skill': '隐藏技能',
};

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
  const [editingCard, setEditingCard] = useState<InspirationCard | null>(null);
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

      {expanded && (
        <div className="mt-3">
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

          {/* Card groups */}
          {displayGroups.map((group) => (
            <div key={group.id} className="mb-4">
              {/* Group header */}
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-border-lt">
                <span className="w-[3px] h-3.5 rounded-sm" style={{ background: group.color }} />
                <span className="text-[0.78rem] font-semibold text-text-secondary">{group.name}</span>
                <span className="text-[0.68rem] text-text-muted">{group.cards.length}</span>
              </div>

              {group.cards.length === 0 ? (
                <div className="text-center py-4 text-text-faint text-[0.76rem] border border-dashed border-border rounded-lg">
                  {isZh ? '此分组暂无卡片' : 'No cards in this group'}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {group.cards.map(card => {
                    const isSelected = selected.includes(card.id);
                    const isModified = card.id in overrides;
                    const title = lang === 'zh' ? card.title_zh : card.title_en;
                    const firstSnippetKey = Object.keys(card.snippets)[0];
                    const snippet = firstSnippetKey
                      ? (card.snippets[firstSnippetKey]?.[lang] || '').slice(0, 45)
                      : '';
                    const tagDisplay = card.tags.slice(0, 3)
                      .map(tg => lang === 'zh' ? (TAG_LABELS[tg] || tg) : tg).join(' · ');

                    return (
                      <button
                        key={card.id}
                        onClick={() => toggle(card.id)}
                        onDoubleClick={(e) => { e.preventDefault(); setEditingCard(card); }}
                        className={`text-left p-3 rounded-lg border min-h-[88px] transition-all text-[0.78rem] leading-relaxed relative group ${
                          isSelected
                            ? 'bg-[#D0D0D0] border-[#AAAAAA] font-semibold shadow-sm'
                            : isModified
                              ? 'bg-surface-2 border-border border-l-[3px] border-l-amber-400 hover:bg-surface-3'
                              : 'bg-surface-2 border-border hover:bg-surface-3 hover:border-border-md hover:-translate-y-px hover:shadow-sm'
                        }`}
                      >
                        <div className="font-semibold mb-1">
                          {isSelected && <span className="text-accent mr-1">✓</span>}
                          {isModified && <span className="text-amber-500 mr-1">✎</span>}
                          {title}
                        </div>
                        {snippet && (
                          <div className="text-text-dim text-[0.72rem] mb-1 line-clamp-2">{snippet}...</div>
                        )}
                        <div className="text-text-faint text-[0.68rem]">{tagDisplay}</div>

                        {/* Move-to-group dropdown */}
                        {showGroupManager && useCustomLayout && customGroups && (
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <select
                              className="text-[0.65rem] bg-white border border-border rounded px-1 py-0.5 cursor-pointer"
                              value=""
                              onChange={e => {
                                if (e.target.value) handleMoveCard(card.id, group.id, e.target.value);
                              }}
                              onClick={e => e.stopPropagation()}
                            >
                              <option value="">{isZh ? '移至...' : 'Move to...'}</option>
                              {customGroups.filter(g => g.group_id !== group.id).map(g => (
                                <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
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

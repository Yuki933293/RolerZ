import { useState } from 'react';
import type { InspirationCard } from '../api/client';
import { useT } from '../i18n';

interface Props {
  card: InspirationCard;
  override: Record<string, unknown> | null;
  language: string;
  readOnly: boolean;
  onSave: (cardId: string, data: Record<string, unknown>) => void;
  onReset: (cardId: string) => void;
  onClose: () => void;
}

const SNIPPET_LABELS: Record<string, string> = {
  personality: '性格', speech: '语言', behavior: '行为', hidden: '隐藏面',
  emotion: '情感', expression: '表达', relationship: '关系', conflict: '冲突',
  motivation: '动机', background: '背景', trigger: '触发', response: '回应',
  internal: '内心', external: '外在', pattern: '模式', core: '核心',
  style: '风格', habit: '习惯', fear: '恐惧', desire: '渴望',
  mask: '面具', truth: '真相', strength: '优势', weakness: '弱点',
  public: '公开面', private: '私下面', surface: '表层', deep: '深层',
};

const TAG_LABELS: Record<string, string> = {
  tsundere: '傲娇', 'outer-cold': '外冷', 'inner-warm': '内热', denial: '否认',
  manipulative: '操控', scheming: '心计', 'sweet-exterior': '甜蜜外表', strategic: '策略',
  'gap-moe': '反差萌', unexpected: '出人意料', contradiction: '矛盾', layers: '多层次',
  independent: '独立', 'self-sufficient': '自给自足', cool: '冷静', 'non-clingy': '不黏人',
  overthinking: '过度思考', analytical: '分析型', anxious: '焦虑', expressive: '善表达',
  caring: '关怀', sarcastic: '毒舌', witty: '机智', sincere: '真诚',
  stoic: '隐忍', empathetic: '共情', protective: '保护欲', possessive: '占有欲',
  loyal: '忠诚', curiosity: '好奇心', redemption: '救赎', justice: '正义',
};

export default function CardEditModal({ card, override, language, readOnly, onSave, onReset, onClose }: Props) {
  const lang = language as 'zh' | 'en';
  const t = useT(language);
  const langKey = `prompt_${lang}` as 'prompt_zh' | 'prompt_en';

  const existingOverride = override || {};
  const [prompt, setPrompt] = useState(
    (existingOverride[langKey] as string) || card[langKey] || ''
  );
  const [tags, setTags] = useState(
    (existingOverride['tags'] as string[] || card.tags).join(', ')
  );
  const [snippets, setSnippets] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(card.snippets)) {
      const overSnips = (existingOverride['snippets'] as Record<string, Record<string, string>>) || {};
      result[k] = overSnips[k]?.[lang] || v[lang] || v.zh || '';
    }
    return result;
  });
  const [editing, setEditing] = useState(false);

  const title = lang === 'zh' ? card.title_zh : card.title_en;
  const isModified = !!override;

  const handleSave = () => {
    const data: Record<string, unknown> = {};
    if (prompt !== card[langKey]) {
      data[langKey] = prompt;
    }
    const newTags = tags.split(',').map(tg => tg.trim()).filter(Boolean);
    if (JSON.stringify(newTags) !== JSON.stringify(card.tags)) {
      data['tags'] = newTags;
    }
    const snipOverrides: Record<string, Record<string, string>> = {};
    for (const [k, v] of Object.entries(snippets)) {
      const original = card.snippets[k]?.[lang] || card.snippets[k]?.zh || '';
      if (v !== original) {
        snipOverrides[k] = { [lang]: v };
      }
    }
    if (Object.keys(snipOverrides).length > 0) {
      data['snippets'] = snipOverrides;
    }
    onSave(card.id, data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-lg font-bold text-text-primary">{title}</div>
            <div className="text-[0.78rem] text-text-dim mt-1">
              {card.category}
              {isModified && <span className="ml-2 text-amber-600 font-medium">[{t('customized') as string}]</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-text-faint hover:text-text-primary text-xl leading-none p-1">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!editing ? (
            <>
              {/* Tags */}
              <div>
                <div className="text-[0.72rem] font-semibold text-text-faint uppercase tracking-wider mb-2">
                  {t('tags') as string}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(override?.tags as string[] || card.tags).map(tg => (
                    <span key={tg} className="bg-surface-2 text-text-dim text-[0.72rem] px-2.5 py-1 rounded-full border border-border">
                      {lang === 'zh' ? (TAG_LABELS[tg] || tg) : tg}
                    </span>
                  ))}
                </div>
              </div>

              {/* Prompt */}
              <div>
                <div className="text-[0.72rem] font-semibold text-text-faint uppercase tracking-wider mb-1.5">
                  {t('promptSnippet') as string}
                </div>
                <div className="bg-surface-2 rounded-lg p-3 text-[0.84rem] text-text-secondary leading-relaxed border-l-3 border-accent">
                  {(existingOverride[langKey] as string) || card[langKey]}
                </div>
              </div>

              {/* Snippets */}
              {Object.entries(card.snippets).map(([k, v]) => {
                const overSnips = (existingOverride['snippets'] as Record<string, Record<string, string>>) || {};
                const text = overSnips[k]?.[lang] || v[lang] || v.zh;
                if (!text) return null;
                const label = lang === 'zh' ? (SNIPPET_LABELS[k] || k) : k;
                return (
                  <div key={k}>
                    <div className="text-[0.72rem] font-semibold text-accent uppercase tracking-wider mb-1">{label}</div>
                    <div className="text-[0.84rem] text-text-secondary leading-relaxed">{text}</div>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {/* Tags */}
              <div>
                <div className="text-[0.78rem] font-semibold mb-1">{t('tagsCommaSeparated') as string}</div>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
                />
              </div>

              {/* Prompt */}
              <div>
                <div className="text-[0.78rem] font-semibold mb-1">
                  {t('promptSnippet') as string} ({lang.toUpperCase()})
                </div>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none resize-none"
                />
              </div>

              {/* Snippets */}
              {Object.keys(card.snippets).map(k => {
                const label = lang === 'zh' ? (SNIPPET_LABELS[k] || k) : k;
                return (
                  <div key={k}>
                    <div className="text-[0.75rem] font-semibold text-text-dim mb-1">{label}</div>
                    <textarea
                      value={snippets[k] || ''}
                      onChange={e => setSnippets(prev => ({ ...prev, [k]: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none resize-none"
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex items-center gap-2">
          {readOnly ? (
            <div className="text-[0.76rem] text-text-faint flex-1">{t('loginToEdit') as string}</div>
          ) : !editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="bg-[#E5E5E5] hover:bg-[#D5D5D5] text-text-primary text-[0.82rem] font-semibold px-4 py-2 rounded-lg border border-[#D0D0D0] transition-colors"
              >
                {t('edit') as string}
              </button>
              {isModified && (
                <button
                  onClick={() => onReset(card.id)}
                  className="text-[0.78rem] text-text-dim border border-border px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors"
                >
                  {t('resetDefault') as string}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="bg-accent hover:bg-accent-hover text-white text-[0.82rem] font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {t('save') as string}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-[0.78rem] text-text-dim border border-border px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors"
              >
                {t('cancel') as string}
              </button>
              {isModified && (
                <button
                  onClick={() => onReset(card.id)}
                  className="text-[0.78rem] text-text-dim border border-border px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors ml-auto"
                >
                  {t('resetDefault') as string}
                </button>
              )}
            </>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="text-[0.78rem] text-text-dim border border-border px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors"
          >
            {t('close') as string}
          </button>
        </div>
      </div>
    </div>
  );
}

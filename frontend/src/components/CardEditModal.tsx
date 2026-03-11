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
  personality: '性格', speech: '语言风格', behavior: '行为', hidden: '内在',
  emotion: '情感', relationship: '关系', motivation: '动机', background: '背景',
  quirk: '小习惯', appearance: '外貌', setting: '场景', atmosphere: '氛围',
};

const TAG_LABELS: Record<string, string> = {
  warm: '热心', boundaries: '有分寸', 'selective-trust': '选择性信任', considerate: '体贴',
  stubborn: '固执', 'easy-going': '随和', 'strong-willed': '意志强', independent: '独立',
  perceptive: '敏锐', observant: '善观察', quiet: '安静', insightful: '有洞察',
  reliable: '靠得住', casual: '随性', responsible: '负责', 'laid-back': '松弛',
  cheerful: '开朗', deflects: '会岔开', 'avoids-depth': '回避深入', social: '社交强',
  reserved: '内敛', gradual: '慢热', loyal: '忠诚', 'takes-time': '需要时间',
  blunt: '直接', honest: '坦诚', caring: '关心', direct: '直率',
  anxious: '焦虑', prepared: '有准备', cautious: '谨慎', 'detail-oriented': '注重细节',
  intense: '认真', focused: '专注', principled: '有原则',
  carefree: '没心没肺', empathetic: '共情', understated: '不张扬',
  indirect: '含蓄', roundabout: '绕弯子', implied: '暗示', subtle: '微妙',
  deadpan: '冷面', witty: '机智', sarcastic: '毒舌',
  comfortable: '自在', presence: '陪伴感', nonverbal: '非语言',
  talkative: '话多', 'stream-of-thought': '意识流', animated: '活泼', unfiltered: '不过滤',
  'two-modes': '两种模式', formal: '正式', 'trust-based': '基于信任',
  delayed: '迟来', 'slow-processor': '慢反应', retrospective: '回顾型', 'calm-surface': '表面平静',
  sensitive: '敏感', 'absorbs-moods': '吸收情绪', porous: '边界模糊',
  'silent-anger': '沉默式愤怒', withdrawal: '退缩', cold: '冷淡', controlled: '克制',
  introvert: '内向', recharge: '充电', solitude: '独处',
  emotional: '感性', open: '开放',
  'acts-of-service': '行动派', devoted: '投入', equal: '平等', 'mutual-respect': '互相尊重',
  protective: '保护欲', fierce: '凶', trigger: '触发',
  'trust-issues': '信任困难', careful: '小心', selective: '挑选',
  'independent-early': '早独立', 'self-reliant': '靠自己', mature: '成熟',
  'high-expectations': '高期待', perfectionist: '完美主义', 'fear-of-failure': '怕失败', driven: '有冲劲',
  'small-town': '小城镇', grounded: '接地气', adaptable: '适应力强',
  attentive: '用心', memory: '记忆力好',
  'night-owl': '夜猫子', introspective: '内省', private: '私密', creative: '创造力',
  'conflict-avoidant': '回避冲突', 'bottled-up': '积压', explosive: '爆发型',
  'self-blame': '自责', apologetic: '爱道歉', 'over-responsible': '过度负责', internalize: '内化',
  communicative: '爱沟通', confrontational: '正面对决',
  'proving-self': '证明自己', determined: '坚定', 'chip-on-shoulder': '不服输',
  belonging: '归属感', searching: '在寻找', outsider: '局外人', home: '家',
  // appearance
  contrast: '反差', misleading: '误导性', 'first-impression': '第一印象', gap: '落差',
  signature: '标志性', consistent: '固定', identity: '身份',
  expressive: '外显', readable: '可读', transparent: '透明', fluctuating: '起伏',
  plain: '朴素', intentional: '刻意', 'low-maintenance': '省事',
  scar: '疤痕', history: '经历', physical: '身体', story: '故事',
  // scenario
  night: '深夜', strangers: '陌生人', liminal: '过渡', work: '工作',
  proximity: '距离', routine: '日常', 'slow-build': '慢慢靠近',
  rain: '雨天', unexpected: '意外', pause: '暂停', intimate: '亲近',
  transition: '转变', vulnerability: '脆弱', belongings: '物品', change: '变化',
  'in-between': '中间地带', reflection: '反思',
  // quirk
  collecting: '收集', sentimental: '念旧', hoarding: '囤积', meaning: '意义',
  quirky: '古怪', endearing: '可爱', 'alone-habit': '独处习惯', anthropomorphize: '拟人化',
  food: '美食', ritual: '仪式', particular: '讲究', comfort: '治愈',
  walking: '散步', decompression: '减压',
  punctual: '守时', 'over-prepared': '过度准备',
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

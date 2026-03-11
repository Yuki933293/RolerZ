import { useCallback, useEffect, useRef, useState } from 'react';
import type { InspirationCard } from '../api/client';
import { useT } from '../i18n';

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

interface Props {
  card: InspirationCard;
  override: Record<string, unknown> | null;
  lang: 'zh' | 'en';
  isZh: boolean;
  isLoggedIn: boolean;
  accent: string;
  iconPath: string;
  cardBg: [string, string];
  glowColor: string;
  categoryLabel: string;
  tagLabel: (tag: string) => string;
  onEdit: () => void;
  onClose: () => void;
}

export default function InspirationFlipModal({
  card, override, lang, isZh, isLoggedIn,
  accent, iconPath, cardBg, glowColor, categoryLabel,
  tagLabel, onEdit, onClose,
}: Props) {
  const [flipped, setFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const t = useT(lang);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (flipped) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.setProperty('--rx', String((y - 0.5) * 2));
    el.style.setProperty('--ry', String((x - 0.5) * 2));
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  }, [flipped]);

  const handleMouseLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0');
    el.style.setProperty('--ry', '0');
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
  }, []);

  const handleFlip = useCallback(() => {
    setFlipped(f => !f);
    const el = cardRef.current;
    if (el) {
      el.style.setProperty('--rx', '0');
      el.style.setProperty('--ry', '0');
      el.style.setProperty('--mx', '50%');
      el.style.setProperty('--my', '50%');
    }
  }, []);

  const title = isZh ? card.title_zh : card.title_en;
  const isModified = !!override;
  const existingOverride = override || {};
  const langKey = `prompt_${lang}` as 'prompt_zh' | 'prompt_en';
  const promptText = (existingOverride[langKey] as string) || card[langKey] || '';
  const firstSnippet = Object.entries(card.snippets)[0];
  const previewText = firstSnippet
    ? (firstSnippet[1][lang] || firstSnippet[1].zh || '').slice(0, 60)
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center card-expand-overlay"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="card-flip-container card-modal-pop"
        style={{ width: 280, aspectRatio: '3 / 4' }}
        onClick={(e) => { e.stopPropagation(); handleFlip(); }}
      >
        <div className={`card-flip-inner ${flipped ? 'flipped' : ''}`}>
          {/* Front face — holo card */}
          <div className="card-flip-face">
            <div
              ref={cardRef}
              className="holo-card card-tier-epic"
              style={{
                width: '100%',
                height: '100%',
                '--glow-color': glowColor,
                '--card-bg1': cardBg[0],
                '--card-bg2': cardBg[1],
              } as React.CSSProperties}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <div className="holo-card-inner">
                <div className="card-base" />
                <div className="holo-layer" />
                <div className="holo-lines" />
                <div className="holo-spot" />
                <div className="card-content h-full flex flex-col p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.04)' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d={iconPath} />
                      </svg>
                    </div>
                    {isModified && (
                      <span className="text-[0.6rem] font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.45)' }}>
                        {isZh ? '已定制' : 'Custom'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1" />
                  <div>
                    <div className="text-lg font-bold leading-snug mb-2 text-text-primary">{title}</div>
                    {previewText && (
                      <div className="text-[0.72rem] leading-relaxed line-clamp-3 text-text-dim">
                        {previewText}...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Back face — card info + edit */}
          <div className="card-flip-face card-flip-back">
            <div
              className="h-full flex flex-col rounded-2xl overflow-hidden"
              style={{
                background: `linear-gradient(160deg, ${cardBg[0]}, ${cardBg[1]})`,
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              {/* Header */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.04)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={iconPath} />
                    </svg>
                  </div>
                  <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em]" style={{ color: accent }}>{categoryLabel}</span>
                </div>
                <div className="text-[0.95rem] font-bold text-text-primary leading-snug">{title}</div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-2.5 min-h-0" style={{ scrollbarWidth: 'thin' }}>
                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {(override?.tags as string[] || card.tags).map(tg => (
                    <span key={tg} className="text-[0.56rem] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.5)' }}>
                      {tagLabel(tg)}
                    </span>
                  ))}
                </div>

                {/* Prompt */}
                {promptText && (
                  <div>
                    <div className="text-[0.56rem] font-bold uppercase tracking-wider mb-0.5" style={{ color: accent }}>
                      {t('promptSnippet') as string}
                    </div>
                    <div className="text-[0.68rem] text-text-dim leading-relaxed">{promptText}</div>
                  </div>
                )}

                {/* Snippets */}
                {Object.entries(card.snippets).map(([key, val]) => {
                  const overSnips = (existingOverride['snippets'] as Record<string, Record<string, string>>) || {};
                  const text = overSnips[key]?.[lang] || val[lang] || val.zh || '';
                  if (!text) return null;
                  const label = SNIPPET_LABELS[key]?.[lang] || key;
                  return (
                    <div key={key}>
                      <div className="text-[0.56rem] font-bold uppercase tracking-wider mb-0.5" style={{ color: accent }}>{label}</div>
                      <div className="text-[0.68rem] text-text-dim leading-relaxed">{text}</div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-2.5 flex items-center gap-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                {isLoggedIn && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="text-[0.72rem] font-semibold px-3 py-1.5 rounded-lg text-white transition-colors hover:brightness-110"
                    style={{ background: accent }}
                  >
                    {t('edit') as string}
                  </button>
                )}
                <div className="flex-1" />
                <span className="text-[0.56rem] text-text-faint">
                  {isZh ? '点击翻回' : 'Tap to flip'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-white/40 text-xs">
        {isZh ? '点击卡片翻转 · 点击空白处关闭' : 'Click card to flip · Click outside to close'}
      </div>
    </div>
  );
}

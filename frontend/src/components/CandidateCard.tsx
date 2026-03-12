import { useState } from 'react';
import type { Candidate } from '../api/client';
import { sharePersona } from '../api/client';
import { useT } from '../i18n';
import { exportTavernPNG } from '../utils/tavernExport';
import ChatPreview from './ChatPreview';

interface Props {
  candidate: Candidate;
  index: number;
  language: string;
}

const SPEC_LABELS: Record<string, string> = {
  name: '名字', personality: '性格', background: '背景',
  appearance: '外貌', voice: '语言风格', opening_line: '开场白',
  speech_pattern: '说话模式', behavior: '行为习惯', goals: '目标',
  conflicts: '内心冲突', motivation: '动机', relationships: '关系倾向',
  hidden_side: '隐藏面', quirks: '小癖好', values: '核心价值观',
  emotional_pattern: '情感模式', catchphrase: '口头禅',
};

export default function CandidateCard({ candidate, index, language }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState('');
  const [favorited, setFavorited] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const t = useT(language);
  const showDetails = t('showDetails') as (n: number) => string;

  const score = candidate.score;
  const scorePct = Math.round(score * 100);
  const scoreColor = score > 0.7 ? '#059669' : score > 0.42 ? '#D97706' : '#999999';
  const scoreLabel = score > 0.7
    ? (language === 'zh' ? '优秀' : 'Excellent')
    : score > 0.42
      ? (language === 'zh' ? '良好' : 'Good')
      : (language === 'zh' ? '一般' : 'Fair');

  const natural = candidate.natural_long || candidate.natural_short || '';
  const spec = candidate.spec_long as Record<string, string>;
  const opening = spec?.opening_line || '';

  const specEntries = Object.entries(spec || {}).filter(
    ([k, v]) => k !== 'opening_line' && v && typeof v === 'string'
  );

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    } catch { /* ignore */ }
  };

  const copyAll = () => {
    const parts: string[] = [];
    if (natural) parts.push(natural);
    if (specEntries.length > 0) {
      parts.push('\n---\n');
      for (const [k, v] of specEntries) {
        const label = language === 'zh' ? (SPEC_LABELS[k] || k) : k;
        parts.push(`${label}: ${v}`);
      }
    }
    handleCopy(parts.join('\n'), 'all');
  };

  const copyJson = () => {
    handleCopy(JSON.stringify(candidate, null, 2), 'json');
  };

  const handleExportPNG = async () => {
    setExporting(true);
    try {
      await exportTavernPNG(candidate, language);
    } catch { /* ignore */ }
    setExporting(false);
  };

  const handleShare = async () => {
    if (shared) return;
    const name = spec?.identity || spec?.name || 'Character';
    const summary = natural?.slice(0, 200) || '';
    try {
      await sharePersona({
        name,
        summary,
        tags: candidate.tags || [],
        spec_data: candidate.spec_long as Record<string, unknown>,
        natural_text: natural || '',
        score: candidate.score,
        language,
      });
      setShared(true);
    } catch { /* ignore */ }
  };

  return (
    <div className={`bg-white dark:bg-surface-1 border rounded-[14px] p-5 mb-4 shadow-xs transition-colors ${favorited ? 'border-amber-400 ring-1 ring-amber-400/20' : 'border-border'}`}>
      {/* Header: candidate info + score */}
      <div className="flex items-start justify-between mb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-[0.85rem] font-bold">
            {index + 1}
          </div>
          <div>
            <div className="text-[0.7rem] font-semibold text-text-faint tracking-widest">CANDIDATE</div>
            <div className="text-[0.75rem] text-text-dim font-mono">{candidate.id}</div>
          </div>
        </div>
        {/* Score */}
        <div className="text-right">
          <div
            className="inline-flex items-baseline gap-1 px-3 py-1.5 rounded-full border"
            style={{ background: `${scoreColor}0A`, borderColor: `${scoreColor}22` }}
          >
            <span className="text-lg font-bold" style={{ color: scoreColor }}>{scorePct}</span>
            <span className="text-[0.65rem]" style={{ color: scoreColor }}>/ 100</span>
          </div>
          <div className="text-[0.65rem] font-medium mt-1" style={{ color: scoreColor }}>{scoreLabel}</div>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1 bg-surface-3 rounded overflow-hidden mb-3">
        <div
          className="h-full rounded"
          style={{
            width: `${Math.max(scorePct, 5)}%`,
            background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}CC)`,
          }}
        />
      </div>

      {/* Tags */}
      {candidate.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {candidate.tags.slice(0, 9).map(tag => (
            <span key={tag} className="bg-surface-3 text-text-dim text-[0.7rem] px-2 py-0.5 rounded-full border border-border font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Opening line */}
      {opening && (
        <div className="mt-3.5 py-3 px-4 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border-l-[3px] border-blue-500 rounded-r-lg">
          <div className="text-[0.68rem] text-accent font-semibold tracking-wider uppercase mb-1">
            {t('openingLine') as string}
          </div>
          <div className="text-[0.88rem] text-text-secondary italic leading-relaxed">{opening}</div>
        </div>
      )}

      {/* Natural text */}
      {natural && (
        <div className="mt-3.5 text-[0.88rem] text-text-secondary leading-[1.75]">{natural}</div>
      )}

      {/* Expand/collapse for structured spec */}
      {specEntries.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[0.78rem] text-text-dim hover:text-accent transition-colors"
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {expanded
              ? t('collapseDetails') as string
              : showDetails(specEntries.length)}
          </button>

          {expanded && (
            <div className="mt-3 grid grid-cols-1 gap-2">
              {specEntries.map(([k, v]) => {
                const label = language === 'zh' ? (SPEC_LABELS[k] || k) : k;
                return (
                  <div key={k} className="bg-surface-2 rounded-lg px-4 py-2.5 border border-border">
                    <div className="text-[0.7rem] font-semibold text-accent uppercase tracking-wider mb-0.5">{label}</div>
                    <div className="text-[0.84rem] text-text-secondary leading-relaxed">{v}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="mt-4 pt-3.5 border-t border-border flex flex-wrap items-center gap-2">
        {/* Favorite */}
        <button
          onClick={() => setFavorited(f => !f)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.8rem] font-medium transition-all ${
            favorited
              ? 'bg-amber-50 text-amber-600 border border-amber-200 shadow-sm dark:bg-amber-900/20 dark:border-amber-700'
              : 'bg-surface-2 text-text-dim border border-border hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {favorited ? t('unfavorite') as string : t('favorite') as string}
        </button>

        {/* Chat preview */}
        <button
          onClick={() => setChatOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.8rem] font-medium bg-surface-2 text-text-dim border border-border hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {t('exportChatPreview') as string}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          disabled={shared}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.8rem] font-medium transition-all ${
            shared
              ? 'bg-green-50 text-green-600 border border-green-200 dark:bg-green-900/20 dark:border-green-700'
              : 'bg-surface-2 text-text-dim border border-border hover:bg-green-50 hover:text-green-600 hover:border-green-200'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          {shared ? t('shared') as string : t('shareToCommunity') as string}
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Copy text */}
        <button
          onClick={copyAll}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.8rem] font-medium transition-all ${
            copied === 'all'
              ? 'bg-green-50 text-green-600 border border-green-200'
              : 'bg-surface-2 text-text-dim border border-border hover:bg-surface-3'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {copied === 'all' ? t('copied') as string : t('copy') as string}
        </button>

        {/* Copy JSON */}
        <button
          onClick={copyJson}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.8rem] font-medium transition-all ${
            copied === 'json'
              ? 'bg-green-50 text-green-600 border border-green-200'
              : 'bg-surface-2 text-text-dim border border-border hover:bg-surface-3'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          JSON
        </button>

        {/* Export PNG */}
        <button
          onClick={handleExportPNG}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.8rem] font-medium bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-600 border border-blue-200 hover:from-blue-100 hover:to-cyan-100 transition-all disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exporting ? '...' : 'PNG'}
        </button>
      </div>

      {chatOpen && (
        <ChatPreview candidate={candidate} language={language} onClose={() => setChatOpen(false)} />
      )}
    </div>
  );
}

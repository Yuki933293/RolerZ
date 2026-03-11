import { useState, useEffect } from 'react';
import { useAuth } from '../stores/useAuth';
import { useConfig } from '../stores/useConfig';
import { useT } from '../i18n';
import {
  getCommunityPersonas, togglePersonaLike, deleteSharedPersona,
  type SharedPersona,
} from '../api/client';
import LoginPrompt from '../components/LoginPrompt';

export default function Discover() {
  const { token, username } = useAuth();
  const lang = useConfig(s => s.language);
  const t = useT(lang);
  const [personas, setPersonas] = useState<SharedPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [tagFilter, setTagFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadPersonas = async () => {
    setLoading(true);
    try {
      const data = await getCommunityPersonas({ sort, tag: tagFilter, limit: 100 });
      setPersonas(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadPersonas(); }, [sort, tagFilter]);

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

  // Collect all unique tags
  const allTags = [...new Set(personas.flatMap(p => p.tags))].slice(0, 20);

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

        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setTagFilter('')}
              className={`text-[0.72rem] px-2.5 py-1 rounded-full border transition-colors ${
                !tagFilter ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-white border-border text-text-faint hover:bg-surface-2'
              }`}
            >
              {t('allTags') as string}
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                className={`text-[0.72rem] px-2.5 py-1 rounded-full border transition-colors ${
                  tagFilter === tag ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-white border-border text-text-faint hover:bg-surface-2'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-text-dim">{t('loading') as string}</div>
      ) : personas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white shadow-lg mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>
          <p className="text-text-dim text-[0.88rem] text-center max-w-md">{t('communityEmpty') as string}</p>
          {!token && (
            <div className="mt-6">
              <LoginPrompt titleKey="loginDefault" descKey="loginDefaultDesc" />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {personas.map(persona => {
            const isOwner = persona.author === username;
            const isExpanded = expandedId === persona.id;
            return (
              <div
                key={persona.id}
                className="bg-white border border-border rounded-[14px] p-5 shadow-xs hover:shadow-sm transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {persona.name[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="font-semibold text-[0.92rem] text-text-primary">{persona.name}</div>
                      <div className="text-[0.72rem] text-text-faint">
                        @{persona.author} · {new Date(persona.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {/* Score */}
                  <div
                    className="text-[0.72rem] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: persona.score > 0.7 ? '#059669' : persona.score > 0.42 ? '#D97706' : '#999',
                      background: persona.score > 0.7 ? '#05966910' : persona.score > 0.42 ? '#D9770610' : '#99999910',
                    }}
                  >
                    {Math.round(persona.score * 100)}
                  </div>
                </div>

                {/* Tags */}
                {persona.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {persona.tags.slice(0, 6).map(tag => (
                      <span key={tag} className="bg-surface-3 text-text-dim text-[0.68rem] px-2 py-0.5 rounded-full border border-border">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Summary / Natural text preview */}
                <div className="text-[0.84rem] text-text-secondary leading-relaxed mb-3">
                  {isExpanded
                    ? persona.natural_text
                    : (persona.summary || persona.natural_text?.slice(0, 150) || '')}
                  {!isExpanded && persona.natural_text && persona.natural_text.length > 150 && '...'}
                </div>

                {/* Expand */}
                {persona.natural_text && persona.natural_text.length > 150 && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : persona.id)}
                    className="text-[0.76rem] text-accent hover:text-accent/80 transition-colors mb-3"
                  >
                    {isExpanded ? (t('collapseDetails') as string) : (t('viewDetail') as string)}
                  </button>
                )}

                {/* Expanded: structured fields */}
                {isExpanded && persona.spec_data && (
                  <div className="mt-2 mb-3 grid grid-cols-1 gap-2">
                    {Object.entries(persona.spec_data).filter(([k, v]) => k !== 'opening_line' && v && typeof v === 'string').slice(0, 8).map(([k, v]) => (
                      <div key={k} className="bg-surface-2 rounded-lg px-3 py-2 border border-border">
                        <div className="text-[0.68rem] font-semibold text-accent uppercase tracking-wider mb-0.5">{k}</div>
                        <div className="text-[0.82rem] text-text-secondary leading-relaxed">{v as string}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <button
                    onClick={() => handleLike(persona.id)}
                    disabled={!token}
                    className={`flex items-center gap-1.5 text-[0.78rem] px-3 py-1.5 rounded-lg transition-colors ${
                      persona.liked
                        ? 'text-rose-500 bg-rose-50 border border-rose-200'
                        : 'text-text-faint hover:text-rose-500 hover:bg-rose-50 border border-transparent'
                    } disabled:opacity-40`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={persona.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    {persona.likes}
                  </button>

                  {isOwner && (
                    <button
                      onClick={() => handleDelete(persona.id)}
                      className="text-[0.72rem] text-text-faint hover:text-error transition-colors"
                    >
                      {t('deleteShare') as string}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

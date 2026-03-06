import { useState } from 'react';
import { useAuth } from '../stores/useAuth';
import { useConfig } from '../stores/useConfig';
import { useT } from '../i18n';

interface SharedPersona {
  id: string;
  name: string;
  summary: string;
  tags: string[];
  author: string;
  likes: number;
  created_at: string;
}

export default function Discover() {
  const { token } = useAuth();
  const lang = useConfig(s => s.language);
  const t = useT(lang);
  const [personas] = useState<SharedPersona[]>([]);

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

      {/* Coming soon placeholder */}
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white shadow-lg mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-2 text-text-primary">{t('comingSoon') as string}</h2>
        <p className="text-text-dim text-[0.88rem] text-center max-w-md leading-relaxed mb-6">
          {t('comingSoonDesc') as string}
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-[0.8rem] text-text-faint">
          <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-lg px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            {t('shareYourRole') as string}
          </div>
          <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-lg px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {t('collectFavorite') as string}
          </div>
          <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-lg px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {t('searchByTag') as string}
          </div>
        </div>

        {!token && (
          <div className="mt-8 px-4 py-3 bg-accent/5 border border-accent/20 rounded-lg text-[0.82rem] text-accent">
            {t('loginToShare') as string}
          </div>
        )}

        {personas.length > 0 && (
          <div className="w-full mt-8 grid gap-4">
            {/* Future: render shared persona cards here */}
          </div>
        )}
      </div>
    </div>
  );
}

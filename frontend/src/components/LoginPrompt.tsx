import { useState } from 'react';
import { useAuth } from '../stores/useAuth';
import { useConfig } from '../stores/useConfig';
import { login as apiLogin, register as apiRegister } from '../api/client';
import { useT } from '../i18n';

interface Props {
  titleKey?: 'loginToCreate' | 'loginToConfig' | 'loginDefault';
  descKey?: 'loginToCreateDesc' | 'loginToConfigDesc' | 'loginDefaultDesc';
}

export default function LoginPrompt({
  titleKey = 'loginDefault',
  descKey = 'loginDefaultDesc',
}: Props) {
  const { login } = useAuth();
  const lang = useConfig(s => s.language);
  const t = useT(lang);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const fn = mode === 'login' ? apiLogin : apiRegister;
      const res = await fn(username.trim(), password);
      login(res.access_token, res.username);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('operationFailed') as string);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold mb-2 text-text-primary">{t(titleKey) as string}</h2>
      <p className="text-text-dim text-[0.88rem] text-center max-w-md mb-8">{t(descKey) as string}</p>

      <div className="w-full max-w-sm">
        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 text-[0.84rem] rounded-lg transition-colors ${
              mode === 'login'
                ? 'bg-white border border-accent/30 font-semibold text-accent shadow-sm'
                : 'bg-surface-2 border border-border text-text-dim hover:bg-surface-3'
            }`}
          >
            {t('login') as string}
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2 text-[0.84rem] rounded-lg transition-colors ${
              mode === 'register'
                ? 'bg-white border border-accent/30 font-semibold text-accent shadow-sm'
                : 'bg-surface-2 border border-border text-text-dim hover:bg-surface-3'
            }`}
          >
            {t('register') as string}
          </button>
        </div>

        {/* Form */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-3">
          <input
            type="text"
            placeholder={t('username') as string}
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full px-4 py-2.5 text-[0.86rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
          />
          <input
            type="password"
            placeholder={t('password') as string}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            className="w-full px-4 py-2.5 text-[0.86rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
          />
          {error && (
            <div className="text-[0.78rem] text-error">{error}</div>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-40 text-white text-[0.86rem] font-semibold py-2.5 rounded-lg transition-all shadow-md"
          >
            {loading ? t('processing') as string : mode === 'login' ? t('login') as string : t('register') as string}
          </button>
        </div>

        <p className="text-center text-[0.75rem] text-text-faint mt-4">
          {mode === 'login' ? t('noAccount') as string : t('hasAccount') as string}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="text-accent hover:underline ml-1"
          >
            {mode === 'login' ? t('registerNow') as string : t('goLogin') as string}
          </button>
        </p>
      </div>
    </div>
  );
}

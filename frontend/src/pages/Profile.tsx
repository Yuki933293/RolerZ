import { useState, useEffect } from 'react';
import { useAuth } from '../stores/useAuth';
import { useConfig } from '../stores/useConfig';
import { getProfileStats, getHistory, deleteHistory, changePassword, type ProfileStats, type HistoryRecord } from '../api/client';
import CandidateCard from '../components/CandidateCard';
import LoginPrompt from '../components/LoginPrompt';
import { useT } from '../i18n';

export default function Profile() {
  const { token, username } = useAuth();
  const lang = useConfig(s => s.language);
  const t = useT(lang);

  const [tab, setTab] = useState<'history' | 'settings'>('history');
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Password change
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([getProfileStats(), getHistory()])
      .then(([s, h]) => {
        setStats(s);
        setHistory(h);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) {
    return <LoginPrompt titleKey="loginDefault" descKey="loginDefaultDesc" />;
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteHistory(id);
      setHistory(prev => prev.filter(h => h.id !== id));
      if (stats) setStats({ ...stats, total_generations: stats.total_generations - 1 });
    } catch { /* ignore */ }
  };

  const handleChangePassword = async () => {
    setPwdMsg('');
    setPwdError(false);
    if (newPwd.length < 4) {
      setPwdMsg(t('pwdTooShort') as string);
      setPwdError(true);
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg(t('pwdMismatch') as string);
      setPwdError(true);
      return;
    }
    setPwdLoading(true);
    try {
      await changePassword(oldPwd, newPwd);
      setPwdMsg(t('pwdChanged') as string);
      setPwdError(false);
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (e: unknown) {
      setPwdMsg(e instanceof Error ? e.message : t('operationFailed') as string);
      setPwdError(true);
    } finally {
      setPwdLoading(false);
    }
  };

  const tabs = [
    { id: 'history' as const, label: t('myCharacters') as string },
    { id: 'settings' as const, label: t('accountSettings') as string },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3.5 mb-1.5">
          <h1 className="text-[1.75rem] font-light tracking-wide" style={{ fontFamily: "'Noto Serif SC', 'Inter', serif" }}>
            {t('myProfile') as string}
          </h1>
          <span className="bg-gradient-to-r from-blue-50 to-indigo-50 text-accent font-mono text-[0.62rem] tracking-widest px-3 py-1 rounded-full font-semibold border border-blue-200">
            PROFILE
          </span>
        </div>
        <p className="text-text-dim text-[0.88rem]">{t('profileDesc') as string}</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-accent">{stats.total_generations}</div>
            <div className="text-[0.75rem] text-text-dim mt-1">{t('totalGenerations') as string}</div>
          </div>
          <div className="bg-white border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-accent">{stats.total_candidates}</div>
            <div className="text-[0.75rem] text-text-dim mt-1">{t('totalCandidates') as string}</div>
          </div>
          <div className="bg-white border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-text-primary">{username}</div>
            <div className="text-[0.75rem] text-text-dim mt-1">
              {stats.member_since ? `${t('memberSince') as string} ${stats.member_since.split('T')[0].split(' ')[0]}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        {tabs.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`px-4 py-2 rounded-lg text-[0.84rem] font-medium transition-colors ${
              tab === tb.id
                ? 'bg-white border border-accent/30 text-accent shadow-sm'
                : 'bg-surface-2 border border-border text-text-dim hover:bg-surface-3'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* History tab */}
      {tab === 'history' && (
        <div>
          {loading ? (
            <div className="text-center py-12 text-text-dim text-[0.88rem]">{t('loading') as string}</div>
          ) : history.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-faint">
                  <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                </svg>
              </div>
              <p className="text-text-dim text-[0.88rem]">{t('noHistory') as string}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map(record => (
                <div key={record.id} className="bg-white border border-border rounded-xl overflow-hidden">
                  {/* Record header */}
                  <div
                    className="px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-surface-2/50 transition-colors"
                    onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.88rem] font-semibold text-text-primary truncate">{record.concept}</div>
                      <div className="flex items-center gap-3 mt-1 text-[0.72rem] text-text-faint">
                        <span>{record.created_at.split('T')[0].split(' ')[0]}</span>
                        <span>{record.candidate_count} {t('candidateUnit') as string}</span>
                        <span className="uppercase">{record.language}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(record.id); }}
                        className="text-[0.72rem] text-text-faint hover:text-error px-2 py-1 rounded transition-colors"
                      >
                        {t('delete') as string}
                      </button>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-text-faint transition-transform ${expandedId === record.id ? 'rotate-90' : ''}`}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded candidates */}
                  {expandedId === record.id && record.result_data?.candidates && (
                    <div className="px-5 pb-4 border-t border-border pt-3">
                      {record.result_data.candidates.map((c, i) => (
                        <CandidateCard key={c.id} candidate={c} index={i} language={record.language} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === 'settings' && (
        <div className="max-w-md">
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-[0.92rem] font-semibold text-text-primary mb-4">{t('changePassword') as string}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[0.75rem] text-text-dim mb-1 block">{t('oldPassword') as string}</label>
                <input
                  type="password"
                  value={oldPwd}
                  onChange={e => setOldPwd(e.target.value)}
                  className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
                />
              </div>
              <div>
                <label className="text-[0.75rem] text-text-dim mb-1 block">{t('newPassword') as string}</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
                />
              </div>
              <div>
                <label className="text-[0.75rem] text-text-dim mb-1 block">{t('confirmPassword') as string}</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                  className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
                />
              </div>
              {pwdMsg && (
                <div className={`text-[0.78rem] ${pwdError ? 'text-error' : 'text-success'}`}>{pwdMsg}</div>
              )}
              <button
                onClick={handleChangePassword}
                disabled={pwdLoading || !oldPwd || !newPwd || !confirmPwd}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-40 text-white text-[0.84rem] font-semibold px-5 py-2 rounded-lg transition-all"
              >
                {pwdLoading ? t('processing') as string : t('changePassword') as string}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

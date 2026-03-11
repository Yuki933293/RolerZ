import { useState, useEffect } from 'react';
import { useAuth } from '../stores/useAuth';
import { useConfig } from '../stores/useConfig';
import {
  getProfileStats, getProfileInfo, updateProfileInfo,
  getHistory, deleteHistory, changePassword, clearAllHistory, deleteAccount,
  type ProfileStats, type HistoryRecord, type UserProfile,
} from '../api/client';
import CandidateCard from '../components/CandidateCard';
import LoginPrompt from '../components/LoginPrompt';
import { useT } from '../i18n';

type Tab = 'history' | 'profile' | 'security' | 'data';

export default function Profile() {
  const { token, username, logout: doLogout } = useAuth();
  const lang = useConfig(s => s.language);
  const t = useT(lang);

  const [tab, setTab] = useState<Tab>('history');
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Profile info
  const [, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password change
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  // Data management
  const [dataMsg, setDataMsg] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([getProfileStats(), getHistory(), getProfileInfo()])
      .then(([s, h, p]) => {
        setStats(s);
        setHistory(h);
        setProfile(p);
        setAvatarUrl(p.avatar_url || '');
        setBio(p.bio || '');
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

  const handleSaveProfile = async () => {
    setProfileMsg('');
    setProfileSaving(true);
    try {
      await updateProfileInfo({ avatar_url: avatarUrl, bio });
      setProfileMsg(t('profileSaved') as string);
    } catch (e: unknown) {
      setProfileMsg(e instanceof Error ? e.message : t('operationFailed') as string);
    } finally {
      setProfileSaving(false);
    }
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

  const handleClearHistory = async () => {
    if (!window.confirm(t('clearHistoryConfirm') as string)) return;
    try {
      await clearAllHistory();
      setHistory([]);
      if (stats) setStats({ ...stats, total_generations: 0, total_candidates: 0 });
      setDataMsg(t('historyCleared') as string);
    } catch { /* ignore */ }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(t('deleteAccountConfirm') as string)) return;
    try {
      await deleteAccount();
      doLogout();
    } catch { /* ignore */ }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'history', label: t('myCharacters') as string },
    { id: 'profile', label: t('profileInfo') as string },
    { id: 'security', label: t('securitySettings') as string },
    { id: 'data', label: t('dataManagement') as string },
  ];

  const inputClass = 'w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none bg-surface';

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
      <div className="flex gap-2 mb-6 flex-wrap">
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

      {/* Profile info tab */}
      {tab === 'profile' && (
        <div className="max-w-lg space-y-5">
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-[0.92rem] font-semibold text-text-primary mb-1">{t('profileInfo') as string}</h3>
            <p className="text-[0.78rem] text-text-faint mb-4">{t('profileInfoDesc') as string}</p>

            {/* Avatar preview + URL */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-surface-2 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-faint">
                    <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <label className="text-[0.75rem] text-text-dim mb-1 block">{t('avatarUrl') as string}</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  placeholder={t('avatarUrlPlaceholder') as string}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Bio */}
            <div className="mb-4">
              <label className="text-[0.75rem] text-text-dim mb-1 block">{t('bio') as string}</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder={t('bioPlaceholder') as string}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>

            {profileMsg && (
              <div className="text-[0.78rem] text-success mb-3">{profileMsg}</div>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-40 text-white text-[0.84rem] font-semibold px-5 py-2 rounded-lg transition-all"
            >
              {profileSaving ? t('processing') as string : t('saveProfile') as string}
            </button>
          </div>
        </div>
      )}

      {/* Security tab */}
      {tab === 'security' && (
        <div className="max-w-lg">
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-[0.92rem] font-semibold text-text-primary mb-4">{t('changePassword') as string}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[0.75rem] text-text-dim mb-1 block">{t('oldPassword') as string}</label>
                <input
                  type="password"
                  value={oldPwd}
                  onChange={e => setOldPwd(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[0.75rem] text-text-dim mb-1 block">{t('newPassword') as string}</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[0.75rem] text-text-dim mb-1 block">{t('confirmPassword') as string}</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                  className={inputClass}
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

      {/* Data management tab */}
      {tab === 'data' && (
        <div className="max-w-lg space-y-5">
          {/* Clear history */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-[0.92rem] font-semibold text-text-primary mb-1">{t('clearHistory') as string}</h3>
            <p className="text-[0.78rem] text-text-faint mb-3">{t('clearHistoryDesc') as string}</p>
            {dataMsg && <div className="text-[0.78rem] text-success mb-3">{dataMsg}</div>}
            <button
              onClick={handleClearHistory}
              className="text-[0.84rem] font-medium px-4 py-2 rounded-lg border border-border text-text-dim hover:bg-surface-2 transition-colors"
            >
              {t('clearHistory') as string}
            </button>
          </div>

          {/* Delete account */}
          <div className="bg-white border border-error/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[0.92rem] font-semibold text-error">{t('dangerZone') as string}</h3>
            </div>
            <p className="text-[0.78rem] text-text-faint mb-3">{t('deleteAccountDesc') as string}</p>
            <button
              onClick={handleDeleteAccount}
              className="text-[0.84rem] font-medium px-4 py-2 rounded-lg border border-error/30 text-error hover:bg-error/5 transition-colors"
            >
              {t('deleteAccount') as string}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

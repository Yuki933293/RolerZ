import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../stores/useAuth';
import { useConfig } from '../stores/useConfig';
import {
  getProfileStats, getProfileInfo, updateProfileInfo,
  getHistory, deleteHistory, changePassword, clearAllHistory, deleteAccount,
  clearChatSessions, getCollections, getCollectionIds, removeFromCollection, clearCollection,
  sendVerificationCode, verifyEmail,
  type ProfileStats, type HistoryRecord, type UserProfile, type CollectionItem,
} from '../api/client';
import CandidateCard from '../components/CandidateCard';
import LoginPrompt from '../components/LoginPrompt';
import { useT } from '../i18n';

type Tab = 'collection' | 'history' | 'profile' | 'security' | 'data';

export default function Profile() {
  const { token, username, logout: doLogout } = useAuth();
  const lang = useConfig(s => s.language);
  const t = useT(lang);

  const isZh = lang === 'zh' || lang === 'zh-Hant';
  const [tab, setTab] = useState<Tab>('collection');
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Collection (favorites)
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set());

  // Profile info
  const [, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [bio, setBio] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Email verification
  const [verifyCodeSent, setVerifyCodeSent] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyMsg, setVerifyMsg] = useState('');
  const [verifySending, setVerifySending] = useState(false);

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
    Promise.all([getProfileStats(), getHistory(), getProfileInfo(), getCollections(), getCollectionIds()])
      .then(([s, h, p, col, cids]) => {
        setStats(s);
        setHistory(h);
        setProfile(p);
        setAvatarUrl(p.avatar_url || '');
        setProfileEmail(p.email || '');
        setEmailVerified(p.email_verified ?? false);
        setBio(p.bio || '');
        setCollection(col);
        setCollectedIds(new Set(cids.ids));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleCollectionChange = useCallback((candidateId: string, collected: boolean) => {
    setCollectedIds(prev => {
      const next = new Set(prev);
      if (collected) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
    // Refresh collection list when toggling from history tab
    if (!collected) {
      setCollection(prev => prev.filter(c => c.candidate_data?.id !== candidateId));
    }
  }, []);

  const handleRemoveFromCollection = async (item: CollectionItem) => {
    try {
      await removeFromCollection(item.id);
      setCollection(prev => prev.filter(c => c.id !== item.id));
      setCollectedIds(prev => {
        const next = new Set(prev);
        next.delete(item.candidate_data?.id);
        return next;
      });
    } catch { /* ignore */ }
  };

  const handleClearCollection = async () => {
    const msg = isZh ? '确定要清空所有收藏吗？此操作不可撤销。' : 'Clear all collections? This cannot be undone.';
    if (!window.confirm(msg)) return;
    try {
      await clearCollection();
      setCollection([]);
      setCollectedIds(new Set());
    } catch { /* ignore */ }
  };

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
      await updateProfileInfo({ avatar_url: avatarUrl, bio, email: profileEmail });
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

  const handleClearChatSessions = async () => {
    const msg = isZh ? '确定要清空所有聊天记录吗？此操作不可撤销。' : 'Clear all chat sessions? This cannot be undone.';
    if (!window.confirm(msg)) return;
    try {
      await clearChatSessions();
      setDataMsg(isZh ? '聊天记录已清空' : 'Chat sessions cleared');
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
    { id: 'collection', label: `${isZh ? '我的收藏' : 'My Collection'} (${collection.length})` },
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
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-surface-1 border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-500">{collection.length}</div>
            <div className="text-[0.75rem] text-text-dim mt-1">{isZh ? '收藏' : 'Collected'}</div>
          </div>
          <div className="bg-white dark:bg-surface-1 border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-accent">{stats.total_generations}</div>
            <div className="text-[0.75rem] text-text-dim mt-1">{t('totalGenerations') as string}</div>
          </div>
          <div className="bg-white dark:bg-surface-1 border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-accent">{stats.total_candidates}</div>
            <div className="text-[0.75rem] text-text-dim mt-1">{t('totalCandidates') as string}</div>
          </div>
          <div className="bg-white dark:bg-surface-1 border border-border rounded-xl p-4 text-center">
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

      {/* Collection tab */}
      {tab === 'collection' && (
        <div>
          {loading ? (
            <div className="text-center py-12 text-text-dim text-[0.88rem]">{t('loading') as string}</div>
          ) : collection.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-faint">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <p className="text-text-dim text-[0.88rem]">{isZh ? '还没有收藏的角色' : 'No collected characters yet'}</p>
              <p className="text-text-faint text-[0.78rem] mt-1">{isZh ? '在生成页面点击星标按钮收藏喜欢的角色' : 'Click the star button on generated characters to collect them'}</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-[0.82rem] text-text-dim">
                  {collection.length} {isZh ? '个收藏' : 'collected'}
                </div>
                <button
                  onClick={handleClearCollection}
                  className="text-[0.75rem] text-text-faint hover:text-error transition-colors"
                >
                  {isZh ? '清空收藏' : 'Clear all'}
                </button>
              </div>
              <div className="space-y-3">
                {collection.map(item => (
                  <div key={item.id} className="relative">
                    <CandidateCard
                      candidate={item.candidate_data}
                      index={0}
                      language={item.language}
                      collected={true}
                      onCollectionChange={(_id, isCollected) => {
                        if (!isCollected) handleRemoveFromCollection(item);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                        <CandidateCard key={c.id} candidate={c} index={i} language={record.language} collected={collectedIds.has(c.id)} onCollectionChange={handleCollectionChange} />
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

            {/* Email */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <label className="text-[0.75rem] text-text-dim">{t('email') as string}</label>
                {profileEmail && (
                  <span className={`text-[0.65rem] px-1.5 py-0.5 rounded-full font-medium ${
                    emailVerified
                      ? 'bg-green-50 text-green-600 border border-green-200'
                      : 'bg-amber-50 text-amber-600 border border-amber-200'
                  }`}>
                    {emailVerified ? t('emailVerified') as string : t('emailUnverified') as string}
                  </span>
                )}
              </div>
              <input
                type="email"
                value={profileEmail}
                onChange={e => setProfileEmail(e.target.value)}
                placeholder={t('emailOptional') as string}
                className={inputClass}
              />
              {/* Verification flow */}
              {profileEmail && !emailVerified && (
                <div className="mt-2">
                  {!verifyCodeSent ? (
                    <button
                      onClick={async () => {
                        setVerifySending(true);
                        setVerifyMsg('');
                        try {
                          await sendVerificationCode(lang);
                          setVerifyCodeSent(true);
                          setVerifyMsg(t('verifyCodeSent') as string);
                        } catch (e: unknown) {
                          setVerifyMsg(e instanceof Error ? e.message : t('operationFailed') as string);
                        } finally {
                          setVerifySending(false);
                        }
                      }}
                      disabled={verifySending}
                      className="text-[0.78rem] text-accent hover:underline disabled:opacity-50"
                    >
                      {verifySending ? '...' : t('sendVerifyCode') as string}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={verifyCode}
                        onChange={e => setVerifyCode(e.target.value)}
                        placeholder={t('enterVerifyCode') as string}
                        maxLength={6}
                        className="w-32 px-2 py-1.5 text-[0.82rem] border border-border rounded-lg focus:border-accent outline-none tracking-widest text-center font-mono"
                      />
                      <button
                        onClick={async () => {
                          setVerifyMsg('');
                          try {
                            await verifyEmail(verifyCode);
                            setEmailVerified(true);
                            setVerifyMsg(t('emailVerifySuccess') as string);
                            setVerifyCodeSent(false);
                            setVerifyCode('');
                          } catch (e: unknown) {
                            setVerifyMsg(e instanceof Error ? e.message : t('operationFailed') as string);
                          }
                        }}
                        disabled={verifyCode.length < 4}
                        className="text-[0.78rem] font-medium text-white bg-accent hover:bg-accent/90 px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
                      >
                        {t('verifyBtn') as string}
                      </button>
                    </div>
                  )}
                  {verifyMsg && (
                    <div className={`text-[0.72rem] mt-1 ${emailVerified ? 'text-success' : 'text-text-dim'}`}>{verifyMsg}</div>
                  )}
                </div>
              )}
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
          {/* Clear generation history */}
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

          {/* Clear chat sessions */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-[0.92rem] font-semibold text-text-primary mb-1">
              {isZh ? '清空聊天记录' : 'Clear Chat Sessions'}
            </h3>
            <p className="text-[0.78rem] text-text-faint mb-3">
              {isZh ? '删除所有角色对话记录，包括隐藏的对话。此操作不可撤销。' : 'Delete all character chat sessions, including hidden ones. This cannot be undone.'}
            </p>
            <button
              onClick={handleClearChatSessions}
              className="text-[0.84rem] font-medium px-4 py-2 rounded-lg border border-border text-text-dim hover:bg-surface-2 transition-colors"
            >
              {isZh ? '清空聊天记录' : 'Clear Chat Sessions'}
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

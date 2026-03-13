import { useEffect, useState, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Generate from './pages/Generate';
import ModelProvider from './pages/ModelProvider';
import Discover from './pages/Discover';
import Profile from './pages/Profile';
import Inspirations from './pages/Inspirations';
import Help from './pages/Help';
import Announcements from './pages/Announcements';
import UserManagement from './pages/UserManagement';
import AdminDashboard from './pages/AdminDashboard';
import FusionLab from './pages/FusionLab';
import Landing from './pages/Landing';
import { useAuth } from './stores/useAuth';
import { useConfig } from './stores/useConfig';
import { login as apiLogin, register as apiRegister, forgotPassword as apiForgotPassword, resetPassword as apiResetPassword, getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead, type Notification } from './api/client';
import { useT } from './i18n';

const LANG_OPTIONS = [
  { value: 'zh', label: '简体中文' },
  { value: 'zh-Hant', label: '繁體中文' },
  { value: 'en', label: 'English' },
] as const;

function TopBar({ sidebarOpen, onToggleSidebar, showAuthModal, setShowAuthModal }: {
  sidebarOpen: boolean; onToggleSidebar: () => void;
  showAuthModal: boolean; setShowAuthModal: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const language = useConfig(s => s.language);
  const setLanguage = useConfig(s => s.setLanguage);
  const theme = useConfig(s => s.theme);
  const toggleTheme = useConfig(s => s.toggleTheme);
  const { token, username, logout, login } = useAuth();
  const t = useT(language);

  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  // Forgot password flow
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPwd, setForgotNewPwd] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'code'>('email');
  const [forgotMsg, setForgotMsg] = useState('');
  const langRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Notification state
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const isZh = language === 'zh' || language === 'zh-Hant';

  const refreshUnread = useCallback(() => {
    if (!token) return;
    getUnreadCount().then(r => setUnreadCount(r.count)).catch(() => {});
  }, [token]);

  // Poll unread count every 60s
  useEffect(() => {
    refreshUnread();
    const interval = setInterval(refreshUnread, 60_000);
    return () => clearInterval(interval);
  }, [refreshUnread]);

  const openNotifPanel = useCallback(() => {
    if (!token) return;
    setShowNotifPanel(true);
    getNotifications().then(setNotifications).catch(() => {});
  }, [token]);

  const handleMarkRead = useCallback(async (id: number) => {
    await markNotificationRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAuth = async () => {
    if (!authUser.trim() || !authPass.trim()) return;
    setLoading(true);
    setAuthError('');
    try {
      let res;
      if (authMode === 'login') {
        res = await apiLogin(authUser.trim(), authPass);
      } else {
        res = await apiRegister(authUser.trim(), authPass, authEmail.trim() || undefined);
      }
      login(res.access_token, res.username, res.is_admin);
      setShowAuthModal(false);
      setAuthUser('');
      setAuthPass('');
      setAuthEmail('');
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : t('operationFailed') as string);
    } finally {
      setLoading(false);
    }
  };

  const currentLang = LANG_OPTIONS.find(o => o.value === language) || LANG_OPTIONS[0];

  return (
    <>
      <header className="h-12 flex-shrink-0 flex items-center justify-between px-4 bg-white border-b border-border z-40">
        {/* Left: hamburger + brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-dim hover:bg-surface-2 hover:text-text-primary transition-colors"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              ✦
            </div>
            <span className="font-bold text-[0.95rem] text-text-primary">Persona Forge</span>
            <span className="text-[0.62rem] text-text-faint font-mono tracking-wide">v0.3</span>
          </div>
        </div>

        {/* Right: language + user */}
        <div className="flex items-center gap-2.5">
          {/* Language dropdown */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg hover:bg-surface-2 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span className="text-[0.78rem] font-medium text-text-primary">{currentLang.label}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-faint">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showLangMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
                {LANG_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setLanguage(opt.value); setShowLangMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-[0.8rem] transition-colors ${
                      language === opt.value
                        ? 'text-accent font-semibold bg-accent/5'
                        : 'text-text-dim hover:bg-surface-2'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notification bell */}
          {token && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => showNotifPanel ? setShowNotifPanel(false) : openNotifPanel()}
                className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-error text-white text-[0.58rem] font-bold rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifPanel && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg w-[340px] max-h-[420px] flex flex-col z-50">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <span className="text-[0.86rem] font-semibold text-text-primary">
                      {isZh ? '通知' : 'Notifications'}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[0.72rem] text-accent hover:text-accent/80 transition-colors"
                      >
                        {isZh ? '全部已读' : 'Mark all read'}
                      </button>
                    )}
                  </div>
                  {/* List */}
                  <div className="flex-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-[0.82rem] text-text-faint">
                        {isZh ? '暂无通知' : 'No notifications'}
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-surface-2 transition-colors ${
                            n.is_read ? '' : 'bg-accent/[0.03]'
                          }`}
                          onClick={() => !n.is_read && handleMarkRead(n.id)}
                        >
                          <div className="flex items-start gap-2.5">
                            {!n.is_read && (
                              <span className="w-2 h-2 mt-1.5 rounded-full bg-accent shrink-0" />
                            )}
                            <div className={`flex-1 ${n.is_read ? 'ml-[18px]' : ''}`}>
                              <div className="text-[0.82rem] font-medium text-text-primary leading-snug">
                                {isZh ? n.title_zh : n.title_en}
                              </div>
                              {(n.body_zh || n.body_en) && (
                                <div className="text-[0.72rem] text-text-faint mt-1 leading-relaxed line-clamp-2">
                                  {isZh ? n.body_zh : n.body_en}
                                </div>
                              )}
                              <div className="text-[0.64rem] text-text-muted mt-1">
                                {new Date(n.created_at).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
                                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User button */}
          <div className="relative" ref={userRef}>
            {token && username ? (
              <>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[0.65rem] text-white font-bold">
                    {username[0].toUpperCase()}
                  </div>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[180px]">
                    <div className="px-3 py-2 border-b border-border">
                      <div className="text-[0.78rem] font-semibold text-text-primary">{username}</div>
                      <div className="text-[0.65rem] text-success">{t('loggedIn') as string}</div>
                    </div>

                    {/* Theme toggle */}
                    <div className="px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[0.78rem] text-text-dim">
                        {theme === 'dark' ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                          </svg>
                        )}
                        {t('themeMode') as string}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                        className={`relative w-9 h-5 rounded-full transition-colors ${theme === 'dark' ? 'bg-accent' : 'bg-border-md'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${theme === 'dark' ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>

                    <div className="border-t border-border my-1" />

                    {/* Account settings */}
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                      className="w-full text-left px-3 py-2 text-[0.78rem] text-text-dim hover:bg-surface-2 transition-colors flex items-center gap-2"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      {t('accountSettings') as string}
                    </button>

                    {/* Export data */}
                    <button
                      onClick={async () => {
                        setShowUserMenu(false);
                        try {
                          const { getHistory } = await import('./api/client');
                          const history = await getHistory(9999, 0);
                          const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `persona-forge-export-${new Date().toISOString().split('T')[0]}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch { /* ignore */ }
                      }}
                      className="w-full text-left px-3 py-2 text-[0.78rem] text-text-dim hover:bg-surface-2 transition-colors flex items-center gap-2"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      {t('exportData') as string}
                    </button>

                    <div className="border-t border-border my-1" />

                    {/* Logout */}
                    <button
                      onClick={() => { logout(); setShowUserMenu(false); }}
                      className="w-full text-left px-3 py-2 text-[0.78rem] text-error/70 hover:bg-error/5 transition-colors flex items-center gap-2"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      {t('logout') as string}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg hover:bg-surface-2 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="text-[0.78rem] font-medium text-text-dim">{t('login') as string}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auth modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAuthModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text-primary">
                  {authMode === 'forgot'
                    ? t('forgotPassword') as string
                    : authMode === 'login' ? t('login') as string : t('register') as string}
                </h3>
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="text-text-faint hover:text-text-primary text-xl leading-none p-1"
                >
                  ×
                </button>
              </div>

              {authMode !== 'forgot' && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError(''); }}
                    className={`flex-1 py-2 text-[0.84rem] rounded-lg transition-colors ${
                      authMode === 'login'
                        ? 'bg-accent/10 border border-accent/30 font-semibold text-accent'
                        : 'bg-surface-2 border border-border text-text-dim hover:bg-surface-3'
                    }`}
                  >
                    {t('login') as string}
                  </button>
                  <button
                    onClick={() => { setAuthMode('register'); setAuthError(''); }}
                    className={`flex-1 py-2 text-[0.84rem] rounded-lg transition-colors ${
                      authMode === 'register'
                        ? 'bg-accent/10 border border-accent/30 font-semibold text-accent'
                        : 'bg-surface-2 border border-border text-text-dim hover:bg-surface-3'
                    }`}
                  >
                    {t('register') as string}
                  </button>
                </div>
              )}
            </div>

            {/* Forgot password flow */}
            {authMode === 'forgot' ? (
              <div className="px-6 pb-6 space-y-3">
                <p className="text-[0.8rem] text-text-dim">{t('forgotPasswordDesc') as string}</p>
                {forgotStep === 'email' ? (
                  <>
                    <input
                      type="email"
                      placeholder={t('email') as string}
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      className="w-full px-4 py-2.5 text-[0.86rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
                    />
                    {forgotMsg && <div className="text-[0.78rem] text-accent">{forgotMsg}</div>}
                    <button
                      onClick={async () => {
                        setLoading(true);
                        setForgotMsg('');
                        try {
                          await apiForgotPassword(forgotEmail.trim(), language);
                          setForgotMsg(t('resetCodeSent') as string);
                          setForgotStep('code');
                        } catch (e: unknown) {
                          setForgotMsg(e instanceof Error ? e.message : '');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || !forgotEmail.trim()}
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-40 text-white text-[0.86rem] font-semibold py-2.5 rounded-lg transition-all shadow-md"
                    >
                      {loading ? t('processing') as string : t('sendResetCode') as string}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder={t('enterResetCode') as string}
                      value={forgotCode}
                      onChange={e => setForgotCode(e.target.value)}
                      maxLength={6}
                      className="w-full px-4 py-2.5 text-[0.86rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none tracking-widest text-center font-mono"
                    />
                    <input
                      type="password"
                      placeholder={t('newPasswordLabel') as string}
                      value={forgotNewPwd}
                      onChange={e => setForgotNewPwd(e.target.value)}
                      className="w-full px-4 py-2.5 text-[0.86rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
                    />
                    {forgotMsg && <div className={`text-[0.78rem] ${forgotMsg.includes('成功') || forgotMsg.includes('success') ? 'text-success' : 'text-error'}`}>{forgotMsg}</div>}
                    <button
                      onClick={async () => {
                        setLoading(true);
                        setForgotMsg('');
                        try {
                          await apiResetPassword(forgotEmail.trim(), forgotCode.trim(), forgotNewPwd);
                          setForgotMsg(t('resetPasswordSuccess') as string);
                          setTimeout(() => {
                            setAuthMode('login');
                            setForgotStep('email');
                            setForgotEmail('');
                            setForgotCode('');
                            setForgotNewPwd('');
                            setForgotMsg('');
                          }, 2000);
                        } catch (e: unknown) {
                          setForgotMsg(e instanceof Error ? e.message : t('operationFailed') as string);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || !forgotCode.trim() || forgotNewPwd.length < 4}
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-40 text-white text-[0.86rem] font-semibold py-2.5 rounded-lg transition-all shadow-md"
                    >
                      {loading ? t('processing') as string : t('resetPasswordBtn') as string}
                    </button>
                  </>
                )}
                <p className="text-center text-[0.75rem] text-text-faint">
                  <button
                    onClick={() => { setAuthMode('login'); setForgotStep('email'); setForgotMsg(''); }}
                    className="text-accent hover:underline"
                  >
                    {t('backToLogin') as string}
                  </button>
                </p>
              </div>
            ) : (
              /* Login / Register form */
              <div className="px-6 pb-6 space-y-3">
                <input
                  type="text"
                  placeholder={authMode === 'login' ? t('usernameOrEmail') as string : t('username') as string}
                  value={authUser}
                  onChange={e => setAuthUser(e.target.value)}
                  className="w-full px-4 py-2.5 text-[0.86rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
                />
                {authMode === 'register' && (
                  <input
                    type="email"
                    placeholder={t('emailOptional') as string}
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-[0.86rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
                  />
                )}
                <input
                  type="password"
                  placeholder={t('password') as string}
                  value={authPass}
                  onChange={e => setAuthPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                  className="w-full px-4 py-2.5 text-[0.86rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
                />
                {authError && (
                  <div className="text-[0.78rem] text-error">{authError}</div>
                )}
                <button
                  onClick={handleAuth}
                  disabled={loading || !authUser.trim() || !authPass.trim()}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-40 text-white text-[0.86rem] font-semibold py-2.5 rounded-lg transition-all shadow-md"
                >
                  {loading ? t('processing') as string : authMode === 'login' ? t('login') as string : t('register') as string}
                </button>
                <div className="flex items-center justify-between text-[0.75rem] text-text-faint">
                  <span>
                    {authMode === 'login' ? t('noAccount') as string : t('hasAccount') as string}
                    <button
                      onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                      className="text-accent hover:underline ml-1"
                    >
                      {authMode === 'login' ? t('registerNow') as string : t('goLogin') as string}
                    </button>
                  </span>
                  {authMode === 'login' && (
                    <button
                      onClick={() => { setAuthMode('forgot'); setAuthError(''); setForgotMsg(''); }}
                      className="text-text-faint hover:text-accent transition-colors"
                    >
                      {t('forgotPassword') as string}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const token = useAuth(s => s.token);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  }, []);

  useEffect(() => {
    if (token) {
      useConfig.getState().loadFromServer();
    }
  }, [token]);

  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Top navbar — full width */}
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          showAuthModal={showAuthModal}
          setShowAuthModal={setShowAuthModal}
        />

        {/* Body: sidebar + main */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar with smooth transition — hidden on landing */}
          {token && (
            <div
              className="flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
              style={{ width: sidebarOpen ? 240 : 0 }}
            >
              <div className="w-60 h-full">
                <Sidebar />
              </div>
            </div>
          )}

          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={
                token
                  ? <div className="max-w-[1100px] mx-auto px-8 py-6"><Generate /></div>
                  : <Landing onOpenAuth={() => setShowAuthModal(true)} />
              } />
              <Route path="/fusion" element={<div className="max-w-[1100px] mx-auto px-8 py-6"><FusionLab /></div>} />
              <Route path="/discover" element={<div className="max-w-[1100px] mx-auto px-8 py-6"><Discover /></div>} />
              <Route path="/model" element={<div className="max-w-[1100px] mx-auto px-8 py-6"><ModelProvider /></div>} />
              <Route path="/inspirations" element={<div className="max-w-[1100px] mx-auto px-8 py-6"><Inspirations /></div>} />
              <Route path="/announcements" element={<div className="max-w-[1100px] mx-auto px-8 py-6"><Announcements /></div>} />
              <Route path="/help" element={<div className="max-w-[1100px] mx-auto px-8 py-6"><Help /></div>} />
              <Route path="/profile" element={<div className="max-w-[1100px] mx-auto px-8 py-6"><Profile /></div>} />
              <Route path="/admin/users" element={<div className="max-w-[1100px] mx-auto px-8 py-6"><UserManagement /></div>} />
              <Route path="/admin/dashboard" element={<div className="max-w-[1100px] mx-auto px-8 py-6"><AdminDashboard /></div>} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

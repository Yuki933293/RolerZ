import { useState, useEffect } from 'react';
import { useConfig } from '../stores/useConfig';
import { useAuth } from '../stores/useAuth';
import { useT } from '../i18n';
import { getAdminUsers, setUserAdmin, adminDeleteUser, type AdminUser } from '../api/client';

export default function UserManagement() {
  const language = useConfig(s => s.language);
  const { isAdmin, username: currentUser } = useAuth();
  const t = useT(language);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAdminUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="text-center py-20 text-text-dim">
        <div className="text-4xl mb-4">🔒</div>
        <div className="text-lg font-semibold">{t('adminRequired') as string}</div>
      </div>
    );
  }

  const handleToggleAdmin = async (user: AdminUser) => {
    if (user.username === currentUser) return;
    const newVal = !user.is_admin;
    const confirmMsg = newVal
      ? (t('adminPromoteConfirm') as (u: string) => string)(user.username)
      : (t('adminDemoteConfirm') as (u: string) => string)(user.username);
    if (!confirm(confirmMsg)) return;

    setActionLoading(user.id);
    try {
      await setUserAdmin(user.id, newVal);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_admin: newVal ? 1 : 0 } : u));
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (user.username === currentUser) return;
    const confirmMsg = (t('adminDeleteUserConfirm') as (u: string) => string)(user.username);
    if (!confirm(confirmMsg)) return;

    setActionLoading(user.id);
    try {
      await adminDeleteUser(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">{t('adminUserManagement') as string}</h1>
        <p className="text-[0.84rem] text-text-dim mt-1">{t('adminUserManagementDesc') as string}</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 text-error text-[0.84rem]">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-text-dim">{t('loading') as string}</div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-[0.84rem]">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                <th className="text-left px-4 py-3 font-semibold text-text-dim">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-text-dim">{t('username') as string}</th>
                <th className="text-left px-4 py-3 font-semibold text-text-dim">{t('adminRole') as string}</th>
                <th className="text-left px-4 py-3 font-semibold text-text-dim">{t('adminGenerations') as string}</th>
                <th className="text-left px-4 py-3 font-semibold text-text-dim">{t('adminJoinDate') as string}</th>
                <th className="text-right px-4 py-3 font-semibold text-text-dim">{t('adminActions') as string}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const isSelf = user.username === currentUser;
                const isLoading = actionLoading === user.id;
                return (
                  <tr key={user.id} className="border-b border-border/50 last:border-b-0 hover:bg-surface-2/30 transition-colors">
                    <td className="px-4 py-3 text-text-faint font-mono">{user.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[0.6rem] text-white font-bold flex-shrink-0">
                          {user.username[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-text-primary">{user.username}</span>
                        {isSelf && <span className="text-[0.68rem] text-accent bg-accent/10 px-1.5 py-0.5 rounded">{t('adminYou') as string}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_admin ? (
                        <span className="inline-flex items-center gap-1 text-[0.76rem] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          {t('adminAdmin') as string}
                        </span>
                      ) : (
                        <span className="text-[0.76rem] text-text-faint">{t('adminUser') as string}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-dim">{user.generation_count}</td>
                    <td className="px-4 py-3 text-text-dim text-[0.78rem]">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleAdmin(user)}
                            disabled={isLoading}
                            className={`text-[0.76rem] px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 ${
                              user.is_admin
                                ? 'text-amber-600 hover:bg-amber-50 border border-amber-200'
                                : 'text-accent hover:bg-accent/10 border border-accent/20'
                            }`}
                          >
                            {user.is_admin ? t('adminRevoke') as string : t('adminGrant') as string}
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={isLoading}
                            className="text-[0.76rem] px-2.5 py-1 rounded-lg text-error/70 hover:bg-error/5 border border-error/20 transition-colors disabled:opacity-40"
                          >
                            {t('delete') as string}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-8 text-text-dim">{t('adminNoUsers') as string}</div>
          )}
        </div>
      )}

      <div className="mt-4 text-[0.76rem] text-text-faint">
        {t('adminTotalUsers') as string}: {users.length}
      </div>
    </div>
  );
}

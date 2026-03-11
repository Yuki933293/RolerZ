import { useState, useEffect } from 'react';
import { useConfig } from '../stores/useConfig';
import { useAuth } from '../stores/useAuth';
import { useT } from '../i18n';
import { getAdminStats, type AdminStats } from '../api/client';

export default function AdminDashboard() {
  const language = useConfig(s => s.language);
  const { isAdmin } = useAuth();
  const t = useT(language);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const data = await getAdminStats();
        setStats(data);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="text-center py-20 text-text-dim">
        <div className="text-4xl mb-4">🔒</div>
        <div className="text-lg font-semibold">{t('adminRequired') as string}</div>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-text-dim">{t('loading') as string}</div>;
  }

  if (!stats) return null;

  const statCards = [
    { label: t('statTotalUsers') as string, value: stats.total_users, icon: 'users', color: 'blue' },
    { label: t('statTotalGenerations') as string, value: stats.total_generations, icon: 'zap', color: 'amber' },
    { label: t('statTotalShared') as string, value: stats.total_shared, icon: 'globe', color: 'green' },
    { label: t('statTodayUsers') as string, value: stats.today_users, icon: 'user-plus', color: 'cyan' },
    { label: t('statTodayGenerations') as string, value: stats.today_generations, icon: 'activity', color: 'purple' },
  ];

  const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', iconBg: 'bg-blue-500' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', iconBg: 'bg-amber-500' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', iconBg: 'bg-green-500' },
    cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', iconBg: 'bg-cyan-500' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', iconBg: 'bg-purple-500' },
  };

  // Simple bar chart for trend
  const maxTrend = Math.max(...stats.generation_trend.map(d => d.count), 1);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">{t('adminDashboard') as string}</h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((card, i) => {
          const c = colorMap[card.color];
          return (
            <div key={i} className={`${c.bg} border ${c.border} rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg ${c.iconBg} flex items-center justify-center`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {card.icon === 'users' && <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>}
                    {card.icon === 'zap' && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />}
                    {card.icon === 'globe' && <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>}
                    {card.icon === 'user-plus' && <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></>}
                    {card.icon === 'activity' && <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />}
                  </svg>
                </div>
              </div>
              <div className={`text-2xl font-bold ${c.text}`}>{card.value.toLocaleString()}</div>
              <div className="text-[0.74rem] text-text-dim mt-1">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Generation trend chart */}
      <div className="bg-white border border-border rounded-xl p-5">
        <h2 className="text-[0.9rem] font-semibold text-text-primary mb-4">{t('generationTrend') as string}</h2>
        {stats.generation_trend.length === 0 ? (
          <div className="text-center py-8 text-text-faint text-[0.84rem]">
            {language === 'en' ? 'No data in the last 7 days' : '最近7天暂无数据'}
          </div>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {stats.generation_trend.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[0.68rem] text-text-dim font-medium">{d.count}</div>
                <div
                  className="w-full bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-md transition-all"
                  style={{ height: `${Math.max((d.count / maxTrend) * 120, 4)}px` }}
                />
                <div className="text-[0.62rem] text-text-faint">
                  {d.date.slice(5)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

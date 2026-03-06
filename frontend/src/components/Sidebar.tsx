import { useLocation, useNavigate } from 'react-router-dom';
import { useConfig } from '../stores/useConfig';
import { useT } from '../i18n';

const IconGenerate = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <path d="M16 3l1 2.5L19.5 7l-2.5 1L16 10.5 14.5 8 12 7l2.5-1z" />
  </svg>
);

const IconCube = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconDiscover = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const PROVIDER_NAMES: Record<string, string> = {
  claude: 'Claude',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  custom: 'Custom',
};

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const config = useConfig();
  const t = useT(config.language);

  const NAV_ITEMS = [
    { id: '/', label: t('create') as string, icon: <IconGenerate /> },
    { id: '/model', label: t('modelProvider') as string, icon: <IconCube /> },
    { id: '/discover', label: t('discover') as string, icon: <IconDiscover /> },
  ];

  const provName = PROVIDER_NAMES[config.provider] || config.provider;
  const isConfigured = config.configured;

  return (
    <aside className="w-60 h-full bg-white border-r border-border flex flex-col">
      {/* Navigation */}
      <div className="px-3 py-3 flex-1">
        <div className="text-[0.68rem] font-semibold text-text-faint tracking-wider uppercase mb-2 px-2">
          {t('nav') as string}
        </div>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-[0.84rem] font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/15 text-accent font-semibold'
                    : 'text-text-dim hover:bg-surface-3'
                }`}
              >
                <span className="inline-flex mr-2.5 align-middle">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border my-3" />

        {/* Model status */}
        <div className={`mx-1 p-2.5 rounded-lg border ${isConfigured ? 'border-success/20 bg-success/5' : 'border-error/20 bg-error/5'}`}>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-success' : 'bg-error'}`} />
            <span className="text-[0.72rem] font-semibold">{provName}</span>
            <span className="text-[0.68rem] text-text-faint font-mono">
              {config.modelName || ''}
            </span>
          </div>
          <div className={`text-[0.62rem] mt-1 ${isConfigured ? 'text-success' : 'text-error'}`}>
            {isConfigured ? t('configured') as string : t('notConfigured') as string}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-3 border-t border-border">
        <div className="text-center text-[0.68rem] text-text-muted">
          {config.language === 'en' ? 'Character Forge' : config.language === 'zh-Hant' ? '角色鍛造台' : '角色锻造台'}
        </div>
      </div>
    </aside>
  );
}

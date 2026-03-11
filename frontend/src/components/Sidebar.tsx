import { useLocation, useNavigate } from 'react-router-dom';
import { useConfig } from '../stores/useConfig';
import { useAuth } from '../stores/useAuth';
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

const IconInspiration = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

const IconProfile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconAnnouncements = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconHelp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconDashboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const PROVIDER_NAMES: Record<string, string> = {
  claude: 'Claude', openai: 'OpenAI', gemini: 'Gemini', deepseek: 'DeepSeek',
  xai: 'xAI', moonshot: 'Moonshot', zhipu: 'Zhipu', groq: 'Groq',
  openrouter: 'OpenRouter', siliconflow: 'SiliconFlow', '302ai': '302.AI',
  aihubmix: 'AIHubMix', nvidia: 'NVIDIA', azure: 'Azure', ollama: 'Ollama',
  lmstudio: 'LM Studio', custom: 'Custom',
};

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const config = useConfig();
  const { isAdmin } = useAuth();
  const t = useT(config.language);

  const NAV_SECTIONS = [
    {
      label: t('sidebarCreate') as string,
      items: [
        { id: '/', label: t('create') as string, icon: <IconGenerate /> },
        { id: '/inspirations', label: t('inspirationLibrary') as string, icon: <IconInspiration /> },
        { id: '/discover', label: t('discover') as string, icon: <IconDiscover /> },
      ],
    },
    {
      label: t('sidebarManage') as string,
      items: [
        { id: '/profile', label: t('myCharacters2') as string, icon: <IconProfile /> },
        { id: '/model', label: t('modelProvider') as string, icon: <IconCube /> },
      ],
    },
    {
      label: t('sidebarOther') as string,
      items: [
        { id: '/announcements', label: t('announcements') as string, icon: <IconAnnouncements /> },
        { id: '/help', label: t('help') as string, icon: <IconHelp /> },
      ],
    },
    ...(isAdmin ? [{
      label: t('sidebarAdmin') as string,
      items: [
        { id: '/admin/dashboard', label: t('adminDashboard') as string, icon: <IconDashboard /> },
        { id: '/admin/users', label: t('adminUserManagement') as string, icon: <IconUsers /> },
      ],
    }] : []),
  ];

  const provName = PROVIDER_NAMES[config.provider] || config.provider;
  const isConfigured = config.configured;
  const currentLabel = config.label;

  return (
    <aside className="w-60 h-full bg-white border-r border-border flex flex-col">
      {/* Navigation */}
      <div className="px-3 py-3 flex-1">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-4' : ''}>
            <div className="text-[0.68rem] font-semibold text-text-faint tracking-wider uppercase mb-2 px-2">
              {section.label}
            </div>
            <nav className="space-y-0.5">
              {section.items.map(item => {
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
          </div>
        ))}

        <div className="border-t border-border my-3" />

        {/* Current config status */}
        <button
          onClick={() => navigate('/model')}
          className={`mx-1 p-2.5 rounded-lg border text-left w-[calc(100%-0.5rem)] transition-colors hover:bg-surface-3 ${isConfigured ? 'border-success/20 bg-success/5' : 'border-error/20 bg-error/5'}`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConfigured ? 'bg-success' : 'bg-error'}`} />
            <span className="text-[0.74rem] font-semibold text-text-primary truncate">{provName}</span>
          </div>
          {config.modelName && (
            <div className="text-[0.66rem] text-text-dim font-mono truncate pl-3 mb-0.5">
              {config.modelName}
            </div>
          )}
          {currentLabel && (
            <div className="text-[0.64rem] text-accent/70 truncate pl-3 mb-0.5">
              {currentLabel}
            </div>
          )}
          <div className={`text-[0.62rem] pl-3 ${isConfigured ? 'text-success' : 'text-error'}`}>
            {isConfigured ? t('configured') as string : t('notConfigured') as string}
          </div>
        </button>
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

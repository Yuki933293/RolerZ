import { useEffect, useState, useCallback } from 'react';
import { useConfig } from '../stores/useConfig';
import { useAuth } from '../stores/useAuth';
import { getProviders, fetchModels, type ProviderInfo } from '../api/client';
import LoginPrompt from '../components/LoginPrompt';
import { useT } from '../i18n';

const PROVIDER_NAMES: Record<string, string> = {
  claude: 'Claude', openai: 'OpenAI', gemini: 'Gemini', deepseek: 'DeepSeek',
  xai: 'xAI', moonshot: 'Moonshot', zhipu: 'Zhipu', groq: 'Groq',
  openrouter: 'OpenRouter', siliconflow: 'SiliconFlow', '302ai': '302.AI',
  aihubmix: 'AIHubMix', nvidia: 'NVIDIA', azure: 'Azure', ollama: 'Ollama',
  lmstudio: 'LM Studio', custom: 'Custom',
};

const PROVIDER_MODEL_HINTS: Record<string, string> = {
  claude: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-chat',
  xai: 'grok-3-mini-fast',
  moonshot: 'moonshot-v1-8k',
  zhipu: 'glm-4-flash',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'openai/gpt-4o-mini',
  siliconflow: 'Qwen/Qwen2.5-7B-Instruct',
  '302ai': 'gpt-4o-mini',
  aihubmix: 'gpt-4o-mini',
  nvidia: 'meta/llama-3.1-8b-instruct',
};

export default function ModelProvider() {
  const config = useConfig();
  const token = useAuth(s => s.token);
  const t = useT(config.language);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  // Local form state
  const [formKey, setFormKey] = useState(config.apiKey);
  const [formUrl, setFormUrl] = useState(config.baseUrl);
  const [formId, setFormId] = useState(config.modelId);
  const [formLabel, setFormLabel] = useState(config.label);
  const [searchQuery, setSearchQuery] = useState('');

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Key visibility
  const [showKey, setShowKey] = useState(false);

  // Key pool modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [modalKeys, setModalKeys] = useState<string[]>([]);
  const [newKeyInput, setNewKeyInput] = useState('');

  const isZh = config.language === 'zh';

  // Fallback providers if backend is unreachable
  const FALLBACK_PROVIDERS: ProviderInfo[] = [
    { id: 'claude',      name: 'Claude',        env_key: 'ANTHROPIC_API_KEY',    has_env_key: false, default_model: '', default_url: 'https://api.anthropic.com' },
    { id: 'openai',      name: 'OpenAI',        env_key: 'OPENAI_API_KEY',       has_env_key: false, default_model: '', default_url: 'https://api.openai.com/v1' },
    { id: 'gemini',      name: 'Google Gemini',  env_key: 'GEMINI_API_KEY',       has_env_key: false, default_model: '', default_url: 'https://generativelanguage.googleapis.com/v1beta/openai' },
    { id: 'deepseek',    name: 'DeepSeek',      env_key: 'DEEPSEEK_API_KEY',     has_env_key: false, default_model: '', default_url: 'https://api.deepseek.com' },
    { id: 'xai',         name: 'xAI',           env_key: 'XAI_API_KEY',          has_env_key: false, default_model: '', default_url: 'https://api.x.ai/v1' },
    { id: 'moonshot',    name: 'Moonshot',       env_key: 'MOONSHOT_API_KEY',     has_env_key: false, default_model: '', default_url: 'https://api.moonshot.cn/v1' },
    { id: 'zhipu',       name: 'Zhipu',         env_key: 'ZHIPU_API_KEY',        has_env_key: false, default_model: '', default_url: 'https://open.bigmodel.cn/api/paas/v4' },
    { id: 'groq',        name: 'Groq',          env_key: 'GROQ_API_KEY',         has_env_key: false, default_model: '', default_url: 'https://api.groq.com/openai/v1' },
    { id: 'openrouter',  name: 'OpenRouter',     env_key: 'OPENROUTER_API_KEY',   has_env_key: false, default_model: '', default_url: 'https://openrouter.ai/api/v1' },
    { id: 'siliconflow', name: 'SiliconFlow',    env_key: 'SILICONFLOW_API_KEY',  has_env_key: false, default_model: '', default_url: 'https://api.siliconflow.cn/v1' },
    { id: '302ai',       name: '302.AI',        env_key: 'API_302AI_KEY',        has_env_key: false, default_model: '', default_url: 'https://api.302.ai/v1' },
    { id: 'aihubmix',    name: 'AIHubMix',      env_key: 'AIHUBMIX_API_KEY',     has_env_key: false, default_model: '', default_url: 'https://aihubmix.com/v1' },
    { id: 'nvidia',      name: 'NVIDIA',        env_key: 'NVIDIA_API_KEY',       has_env_key: false, default_model: '', default_url: 'https://integrate.api.nvidia.com/v1' },
    { id: 'azure',       name: 'Azure OpenAI',   env_key: 'AZURE_OPENAI_API_KEY', has_env_key: false, default_model: '', default_url: '' },
    { id: 'ollama',      name: 'Ollama',        env_key: '',                      has_env_key: false, default_model: '', default_url: 'http://localhost:11434/v1' },
    { id: 'lmstudio',    name: 'LM Studio',      env_key: '',                      has_env_key: false, default_model: '', default_url: 'http://localhost:1234/v1' },
    { id: 'custom',      name: isZh ? '自定义' : 'Custom', env_key: '', has_env_key: false, default_model: '', default_url: '' },
  ];

  useEffect(() => {
    getProviders()
      .then(data => setProviders(data.length > 0 ? data : FALLBACK_PROVIDERS))
      .catch(() => setProviders(FALLBACK_PROVIDERS));
  }, []);

  // Sync form when provider changes
  useEffect(() => {
    setFormKey(config.apiKey);
    setFormUrl(config.baseUrl);
    setFormId(config.modelId);
    setFormLabel(config.label);
    setSearchQuery('');
  }, [config.provider]);

  const activeProvider = providers.find(p => p.id === config.provider);

  const handleSave = () => {
    config.setApiKey(formKey);
    config.setBaseUrl(formUrl);
    config.setModelId(formId);
    config.setLabel(formLabel.trim());
    if (formId.trim()) {
      config.setModelName(formId.trim());
    }
    config.saveConfig();
    setSaveMsg(isZh ? '配置已保存' : 'Config saved');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const handleFetch = async () => {
    setLoading(true);
    setError('');
    try {
      config.setApiKey(formKey);
      config.setBaseUrl(formUrl);
      config.saveConfig();
      const models = await fetchModels(config.provider, formKey, formUrl);
      config.setFetchedModels(models);
      if (!config.modelName && models.length > 0) {
        const def = activeProvider?.default_model || '';
        const selectedModel = models.includes(def) ? def : models[0];
        config.setModelName(selectedModel);
        config.setModelId(selectedModel);
        setFormId(selectedModel);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (isZh ? '获取失败' : 'Fetch failed'));
    } finally {
      setLoading(false);
    }
  };

  // Key pool helpers
  const openKeyModal = useCallback(() => {
    const existing = config.apiKeys || [];
    const keys = formKey && !existing.includes(formKey)
      ? [formKey, ...existing]
      : existing.length > 0 ? existing : (formKey ? [formKey] : []);
    setModalKeys(keys.filter(Boolean));
    setNewKeyInput('');
    setShowKeyModal(true);
  }, [config.apiKeys, formKey]);

  const addKeyToModal = () => {
    const key = newKeyInput.trim();
    if (key && !modalKeys.includes(key)) {
      setModalKeys(prev => [...prev, key]);
    }
    setNewKeyInput('');
  };

  const handleBatchImport = () => {
    const text = newKeyInput.trim();
    if (!text) return;
    const keys = text.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
    const unique = keys.filter(k => !modalKeys.includes(k));
    if (unique.length > 0) {
      setModalKeys(prev => [...prev, ...unique]);
    }
    setNewKeyInput('');
  };

  const removeKeyFromModal = (index: number) => {
    setModalKeys(prev => prev.filter((_, i) => i !== index));
  };

  const confirmKeyModal = () => {
    config.setApiKeys(modalKeys);
    if (modalKeys.length > 0) {
      setFormKey(modalKeys[0]);
    }
    setShowKeyModal(false);
  };

  const keyCount = (() => {
    const existing = config.apiKeys || [];
    if (formKey && !existing.includes(formKey)) return existing.length + 1;
    return existing.length;
  })();

  const effectiveKey = formKey || (activeProvider?.has_env_key ? '(env)' : '');
  const canFetch = !!effectiveKey || (config.provider === 'custom' && !!formUrl);

  const displayModels = searchQuery
    ? config.fetchedModels.filter(m => m.toLowerCase().includes(searchQuery.toLowerCase()))
    : config.fetchedModels;

  const maskKey = (key: string) => {
    if (key.length <= 12) return key.replace(/./g, '*');
    return key.slice(0, 6) + '...' + key.slice(-6);
  };

  if (!token) {
    return <LoginPrompt titleKey="loginToConfig" descKey="loginToConfigDesc" />;
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3.5 mb-1.5">
          <h1 className="text-[1.75rem] font-light tracking-wide" style={{ fontFamily: "'Noto Serif SC', 'Inter', serif" }}>
            {t('modelProviderTitle') as string}
          </h1>
          <span className="bg-gradient-to-r from-blue-50 to-indigo-50 text-accent font-mono text-[0.62rem] tracking-widest px-3 py-1 rounded-full font-semibold border border-blue-200">
            MODEL PROVIDER
          </span>
        </div>
        <p className="text-text-dim text-[0.88rem]">
          {isZh ? '配置 AI 模型供应商与 API 密钥' : 'Configure AI model providers and API keys'}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left: My Configs */}
        {(() => {
          const configuredProviders = Object.entries(config.providerConfigs)
            .filter(([, cfg]) => cfg.configured)
            .map(([id, cfg]) => ({ id, ...cfg }));

          return (
            <div className="w-56 flex-shrink-0 sticky top-4 self-start max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin">
              <div className="text-[0.78rem] font-semibold text-text-secondary mb-2">
                {t('myConfigs') as string}
              </div>
              <div className="text-[0.68rem] text-text-faint mb-3">{t('myConfigsDesc') as string}</div>

              {configuredProviders.length === 0 ? (
                <div className="text-center py-5 text-text-faint text-[0.76rem] bg-surface-2 border border-border rounded-xl">
                  {t('noConfigs') as string}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {configuredProviders.map(cfg => {
                    const isCurrent = config.provider === cfg.id;
                    const displayName = cfg.label || PROVIDER_NAMES[cfg.id] || cfg.id;
                    const providerTag = cfg.label ? (PROVIDER_NAMES[cfg.id] || cfg.id) : null;

                    return (
                      <div
                        key={cfg.id}
                        className={`px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-accent/5 border-accent/25'
                            : 'bg-white border-border hover:bg-surface-2'
                        }`}
                        onClick={() => { if (!isCurrent) config.setProvider(cfg.id); }}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[0.82rem] font-semibold text-text-primary truncate">{displayName}</span>
                          {providerTag && (
                            <span className="text-[0.58rem] text-text-faint bg-surface-3 px-1 py-0.5 rounded shrink-0">{providerTag}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-[0.68rem] text-text-faint font-mono truncate">
                            {cfg.modelName || cfg.modelId || '—'}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            {isCurrent && (
                              <span className="text-[0.58rem] text-accent bg-accent/10 px-1.5 py-0.5 rounded font-semibold">
                                {t('usingNow') as string}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(t('confirmDeleteConfig') as string)) {
                                  config.deleteProviderConfig(cfg.id);
                                }
                              }}
                              className="text-text-faint hover:text-error p-1 rounded hover:bg-error/10 transition-colors"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Middle: Provider list */}
        <div className="w-44 flex-shrink-0 sticky top-4 self-start max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin">
          <div className="text-[0.78rem] font-semibold text-text-secondary mb-3">
            {t('providerSource') as string}
          </div>
          <div className="space-y-1.5">
            {providers.map(p => {
              const isActive = config.provider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => config.setProvider(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[0.8rem] font-medium transition-all border ${
                    isActive
                      ? 'bg-[#D0D0D0] text-text-primary border-[#BBBBBB] font-semibold'
                      : 'bg-white text-text-primary border-border hover:bg-surface-3'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Config form */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[1.05rem] font-bold">{activeProvider?.name || config.provider}</div>
            <button
              onClick={handleSave}
              className="bg-[#E5E5E5] hover:bg-[#D5D5D5] text-text-primary text-[0.8rem] font-semibold px-5 py-2 rounded-lg border border-[#D0D0D0] transition-colors"
            >
              {t('saveConfig') as string}
            </button>
          </div>

          {saveMsg && (
            <div className="mb-3 px-3 py-2 bg-success/5 border border-success/20 rounded-lg text-[0.78rem] text-success font-medium">
              {saveMsg}
            </div>
          )}

          {/* Label */}
          <div className="mb-4">
            <div className="text-[0.82rem] font-semibold mb-1">{isZh ? '配置备注' : 'Config Label'}</div>
            <input
              type="text"
              value={formLabel}
              onChange={e => setFormLabel(e.target.value)}
              placeholder={isZh ? '给这个配置起个名字，方便记住它的用途' : 'Name this config to remember its purpose'}
              className="w-full px-3 py-2 text-[0.88rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none shadow-xs placeholder:text-text-muted"
            />
          </div>

          {/* ID */}
          <div className="mb-4">
            <div className="text-[0.82rem] font-semibold mb-1">{t('modelId') as string}</div>
            <input
              type="text"
              value={formId}
              onChange={e => setFormId(e.target.value)}
              placeholder={activeProvider ? (isZh ? `如 ${PROVIDER_MODEL_HINTS[config.provider] || 'gpt-4o'}` : `e.g. ${PROVIDER_MODEL_HINTS[config.provider] || 'gpt-4o'}`) : ''}
              className="w-full px-3 py-2 text-[0.88rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none shadow-xs"
            />
            <div className="mt-1 text-[0.72rem] text-text-faint">
              {isZh
                ? '填写要使用的模型名称，也可以从下方模型列表中选择'
                : 'Enter the model name to use, or select from the model list below'}
            </div>
            {/* Responses API hint for known models */}
            {/(-pro|o1-pro|o3-pro)/.test(formId) && config.provider === 'openai' && (
              <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[0.74rem] text-blue-700 flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  {isZh
                    ? '此模型仅支持 OpenAI Responses API（不支持 Chat Completions）。RolerZ 已自动兼容，可以直接使用。部分高级参数（如 Temperature）可能不适用于推理模型。'
                    : 'This model only supports the OpenAI Responses API (not Chat Completions). RolerZ handles this automatically. Some advanced parameters (e.g. Temperature) may not apply to reasoning models.'}
                </span>
              </div>
            )}
          </div>

          {/* API Key */}
          <div className="mb-4">
            <div className="text-[0.82rem] font-semibold mb-1">{t('apiKey') as string}</div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={formKey}
                  onChange={e => setFormKey(e.target.value)}
                  placeholder={activeProvider?.env_key ? `${activeProvider.env_key}` : 'API Key'}
                  className="w-full px-3 py-2 pr-9 text-[0.88rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none shadow-xs placeholder:text-text-muted"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-dim p-0.5 transition-colors"
                >
                  {showKey ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <button
                onClick={openKeyModal}
                className="flex-shrink-0 bg-accent/10 hover:bg-accent/20 text-accent text-[0.8rem] font-semibold px-4 py-2 rounded-lg border border-accent/25 transition-colors"
              >
                {t('keyPoolManage') as string}{keyCount > 1 && <span className="ml-1 text-[0.72rem]">({keyCount})</span>}
              </button>
            </div>
            {activeProvider?.has_env_key && !formKey && (
              <div className="mt-1.5 px-2.5 py-1.5 bg-success/5 border border-success/15 rounded-md text-[0.72rem] text-green-800">
                {t('envKeyHint') as string}
              </div>
            )}
          </div>

          {/* API Base URL */}
          <div className="mb-6">
            <div className="text-[0.82rem] font-semibold mb-1">{t('baseUrl') as string}</div>
            <input
              type="text"
              value={formUrl}
              onChange={e => setFormUrl(e.target.value)}
              placeholder={config.provider === 'custom' ? 'http://localhost:11434/v1' : activeProvider?.default_url || ''}
              className="w-full px-3 py-2 text-[0.88rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none shadow-xs placeholder:text-text-muted"
            />
          </div>

          {/* Advanced Settings */}
          <div className="mb-6">
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-2 text-[0.82rem] font-semibold text-text-dim hover:text-text-primary transition-colors"
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {isZh ? '高级参数设置' : 'Advanced Parameters'}
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 bg-surface-2 border border-border rounded-xl space-y-4">
                <div className="text-[0.72rem] text-text-faint mb-2">
                  {isZh
                    ? '留空表示使用默认值。不确定时建议保持默认。'
                    : 'Leave empty for defaults. Keep defaults if unsure.'}
                </div>

                {/* Temperature */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[0.78rem] font-medium text-text-secondary">Temperature</label>
                    <span className="text-[0.72rem] text-text-faint font-mono">
                      {config.advanced.temperature !== null ? config.advanced.temperature : (isZh ? '默认' : 'default')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0" max="2" step="0.05"
                      value={config.advanced.temperature ?? 0.8}
                      onChange={e => config.setAdvanced({ temperature: parseFloat(e.target.value) })}
                      className="flex-1 h-1.5 accent-accent"
                    />
                    <button
                      onClick={() => config.setAdvanced({ temperature: null })}
                      className="text-[0.68rem] text-text-faint hover:text-accent px-1.5 py-0.5 rounded border border-border hover:border-accent/30 transition-colors"
                    >
                      {isZh ? '重置' : 'Reset'}
                    </button>
                  </div>
                  <div className="text-[0.68rem] text-text-faint mt-1">
                    {isZh
                      ? '控制随机性：低值（0.1-0.3）→精确回复，高值（0.7-1.0）→创意多样'
                      : 'Controls randomness: low (0.1-0.3) → precise, high (0.7-1.0) → creative'}
                  </div>
                </div>

                {/* Top P */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[0.78rem] font-medium text-text-secondary">Top P</label>
                    <span className="text-[0.72rem] text-text-faint font-mono">
                      {config.advanced.topP !== null ? config.advanced.topP : (isZh ? '默认' : 'default')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0" max="1" step="0.05"
                      value={config.advanced.topP ?? 1}
                      onChange={e => config.setAdvanced({ topP: parseFloat(e.target.value) })}
                      className="flex-1 h-1.5 accent-accent"
                    />
                    <button
                      onClick={() => config.setAdvanced({ topP: null })}
                      className="text-[0.68rem] text-text-faint hover:text-accent px-1.5 py-0.5 rounded border border-border hover:border-accent/30 transition-colors"
                    >
                      {isZh ? '重置' : 'Reset'}
                    </button>
                  </div>
                  <div className="text-[0.68rem] text-text-faint mt-1">
                    {isZh
                      ? '核采样：仅从累积概率前 Top P 的词中选择。与 Temperature 通常只调一个。'
                      : 'Nucleus sampling: only pick from tokens whose cumulative probability ≤ Top P. Usually adjust only one of Temperature or Top P.'}
                  </div>
                </div>

                {/* Max Tokens */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[0.78rem] font-medium text-text-secondary">Max Tokens</label>
                    <span className="text-[0.72rem] text-text-faint font-mono">
                      {config.advanced.maxTokens !== null ? config.advanced.maxTokens : (isZh ? '默认' : 'default')}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="256" max="128000" step="256"
                    value={config.advanced.maxTokens ?? ''}
                    onChange={e => {
                      const v = e.target.value;
                      config.setAdvanced({ maxTokens: v ? parseInt(v, 10) : null });
                    }}
                    placeholder={isZh ? '默认 12800' : 'Default 12800'}
                    className="w-full px-3 py-1.5 text-[0.82rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
                  />
                  <div className="text-[0.68rem] text-text-faint mt-1">
                    {isZh
                      ? '最大输出长度。角色卡生成建议 6400-12800，对话预览建议 1024-4096。'
                      : 'Max output length. Recommended 6400-12800 for persona generation, 1024-4096 for chat preview.'}
                  </div>
                </div>

                {/* Frequency Penalty */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[0.78rem] font-medium text-text-secondary">Frequency Penalty</label>
                    <span className="text-[0.72rem] text-text-faint font-mono">
                      {config.advanced.frequencyPenalty !== null ? config.advanced.frequencyPenalty : (isZh ? '默认' : 'default')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0" max="2" step="0.05"
                      value={config.advanced.frequencyPenalty ?? 0}
                      onChange={e => config.setAdvanced({ frequencyPenalty: parseFloat(e.target.value) })}
                      className="flex-1 h-1.5 accent-accent"
                    />
                    <button
                      onClick={() => config.setAdvanced({ frequencyPenalty: null })}
                      className="text-[0.68rem] text-text-faint hover:text-accent px-1.5 py-0.5 rounded border border-border hover:border-accent/30 transition-colors"
                    >
                      {isZh ? '重置' : 'Reset'}
                    </button>
                  </div>
                  <div className="text-[0.68rem] text-text-faint mt-1">
                    {isZh
                      ? '降低高频词的重复概率，值越大重复越少。仅 OpenAI 兼容 API 支持。'
                      : 'Reduces repetition of frequent words. Higher = less repetition. OpenAI-compatible APIs only.'}
                  </div>
                </div>

                {/* Presence Penalty */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[0.78rem] font-medium text-text-secondary">Presence Penalty</label>
                    <span className="text-[0.72rem] text-text-faint font-mono">
                      {config.advanced.presencePenalty !== null ? config.advanced.presencePenalty : (isZh ? '默认' : 'default')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0" max="2" step="0.05"
                      value={config.advanced.presencePenalty ?? 0}
                      onChange={e => config.setAdvanced({ presencePenalty: parseFloat(e.target.value) })}
                      className="flex-1 h-1.5 accent-accent"
                    />
                    <button
                      onClick={() => config.setAdvanced({ presencePenalty: null })}
                      className="text-[0.68rem] text-text-faint hover:text-accent px-1.5 py-0.5 rounded border border-border hover:border-accent/30 transition-colors"
                    >
                      {isZh ? '重置' : 'Reset'}
                    </button>
                  </div>
                  <div className="text-[0.68rem] text-text-faint mt-1">
                    {isZh
                      ? '鼓励模型涉及新话题。值越大越倾向于探索新内容。仅 OpenAI 兼容 API 支持。'
                      : 'Encourages new topics. Higher = more novel content. OpenAI-compatible APIs only.'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fetch + Model list */}
          <div className="flex items-center gap-3 mb-4">
            <div className="text-[0.82rem] font-semibold flex-shrink-0">{t('modelSelect') as string}</div>
            <input
              type="text"
              placeholder={t('searchModel') as string}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-1.5 text-[0.82rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
            />
            <button
              onClick={handleFetch}
              disabled={!canFetch || loading}
              className="bg-[#E5E5E5] hover:bg-[#D5D5D5] disabled:opacity-40 disabled:cursor-not-allowed text-text-primary text-[0.8rem] font-semibold px-4 py-1.5 rounded-lg border border-[#D0D0D0] transition-colors flex-shrink-0"
            >
              {loading ? t('fetching') as string : t('fetchModels') as string}
            </button>
          </div>

          {error && (
            <div className="mb-3 px-3 py-2 bg-error/5 border border-error/20 rounded-lg text-[0.78rem] text-error">
              {error}
            </div>
          )}

          {/* Model rows */}
          <div className="space-y-1.5">
            {displayModels.map(mid => {
              const isSel = config.modelName === mid;
              const prefix = mid.includes('/') ? '' : `${config.provider}/`;
              return (
                <div
                  key={mid}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isSel
                      ? 'bg-accent-lt border-accent'
                      : 'bg-white border-border hover:bg-surface-2'
                  }`}
                >
                  <div>
                    <div className="text-[0.88rem] font-semibold">{prefix}{mid}</div>
                    <div className="text-[0.72rem] text-text-faint font-mono">{mid}</div>
                  </div>
                  {isSel ? (
                    <span className="bg-accent text-white text-[0.7rem] font-semibold px-3 py-1 rounded-full">
                      {isZh ? '使用中' : 'Active'}
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        config.setModelName(mid);
                        config.setModelId(mid);
                        setFormId(mid);
                      }}
                      className="bg-[#E5E5E5] hover:bg-[#D5D5D5] text-text-primary text-[0.78rem] font-medium px-3 py-1 rounded-lg border border-[#D0D0D0] transition-colors"
                    >
                      {isZh ? '选择' : 'Select'}
                    </button>
                  )}
                </div>
              );
            })}
            {config.fetchedModels.length === 0 && (
              <div className="text-center py-8 text-text-faint text-[0.84rem]">
                {isZh ? '暂无模型，请点击「获取模型列表」加载' : 'No models yet. Click "Fetch Models" to load.'}
              </div>
            )}
            {['custom', 'ollama', 'lmstudio', 'azure', '302ai', 'aihubmix'].includes(config.provider) && (
              <div className="mt-3 px-3.5 py-2.5 bg-accent/5 border border-accent/15 rounded-lg flex items-start gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div className="text-[0.76rem] text-text-dim leading-relaxed">
                  {isZh
                    ? '如果获取模型列表失败，可直接在上方「模型名称」中手动输入模型名称（如 gpt-4o），然后点击「保存配置」即可使用。'
                    : 'If fetching the model list fails, you can manually enter the model name (e.g. gpt-4o) in the "Model Name" field above, then click "Save Config" to use it.'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key management modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowKeyModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-border">
              <div className="text-[1rem] font-bold text-text-primary">
                {isZh ? '管理 API Key' : 'Manage API Keys'}
              </div>
              <div className="text-[0.76rem] text-text-faint mt-0.5">
                {activeProvider?.name || config.provider}
              </div>
            </div>

            {/* Modal body */}
            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Add input */}
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKeyInput}
                    onChange={e => setNewKeyInput(e.target.value)}
                    placeholder={isZh ? '添加新项，按回车确认' : 'Add new key, press Enter'}
                    className="flex-1 px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newKeyInput.includes(',') || newKeyInput.includes(';')) {
                          handleBatchImport();
                        } else {
                          addKeyToModal();
                        }
                      }
                    }}
                  />
                  <button
                    onClick={addKeyToModal}
                    disabled={!newKeyInput.trim()}
                    className="text-[0.82rem] text-text-dim border border-border px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors disabled:opacity-40"
                  >
                    {isZh ? '添加' : 'Add'}
                  </button>
                  <button
                    onClick={handleBatchImport}
                    disabled={!newKeyInput.trim()}
                    className="text-[0.82rem] text-accent bg-accent/10 border border-accent/25 px-3 py-2 rounded-lg hover:bg-accent/20 transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    {isZh ? '批量导入' : 'Batch Import'}
                  </button>
                </div>
                <div className="text-[0.68rem] text-text-faint mt-1.5">
                  {isZh ? '批量导入支持逗号、分号或换行分隔多个 Key' : 'Batch import supports comma, semicolon, or newline separated keys'}
                </div>
              </div>

              {/* Key list */}
              <div className="space-y-1.5">
                {modalKeys.map((key, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
                      i === 0 ? 'bg-accent/5 border-accent/20' : 'bg-surface-2 border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {i === 0 && (
                        <span className="text-[0.65rem] text-accent bg-accent/10 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                          {isZh ? '当前' : 'Active'}
                        </span>
                      )}
                      <span className="text-[0.84rem] text-text-secondary font-mono truncate">
                        {maskKey(key)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {i !== 0 && (
                        <button
                          onClick={() => {
                            const reordered = [key, ...modalKeys.filter((_, j) => j !== i)];
                            setModalKeys(reordered);
                          }}
                          className="text-[0.72rem] text-accent hover:bg-accent/10 px-2 py-1 rounded transition-colors"
                        >
                          {isZh ? '启用' : 'Use'}
                        </button>
                      )}
                      <button
                        onClick={() => removeKeyFromModal(i)}
                        className="text-error hover:bg-error/10 p-1 rounded transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {modalKeys.length === 0 && (
                  <div className="text-center py-6 text-text-faint text-[0.82rem]">
                    {isZh ? '暂无密钥，请在上方添加' : 'No keys yet. Add one above.'}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-[0.82rem] text-text-dim border border-border px-4 py-2 rounded-lg hover:bg-surface-3 transition-colors"
              >
                {t('cancel') as string}
              </button>
              <button
                onClick={confirmKeyModal}
                className="text-[0.82rem] text-accent bg-accent/10 border border-accent/25 px-5 py-2 rounded-lg hover:bg-accent/20 transition-colors font-semibold"
              >
                {isZh ? '确认' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

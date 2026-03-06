import { useEffect, useState, useCallback } from 'react';
import { useConfig } from '../stores/useConfig';
import { useAuth } from '../stores/useAuth';
import { getProviders, fetchModels, type ProviderInfo } from '../api/client';
import LoginPrompt from '../components/LoginPrompt';
import { useT } from '../i18n';

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
  const [searchQuery, setSearchQuery] = useState('');

  // Key visibility
  const [showKey, setShowKey] = useState(false);

  // Key pool modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [modalKeys, setModalKeys] = useState<string[]>([]);
  const [newKeyInput, setNewKeyInput] = useState('');

  const isZh = config.language === 'zh';

  // Fallback providers if backend is unreachable
  const FALLBACK_PROVIDERS: ProviderInfo[] = [
    { id: 'claude', name: 'Claude', env_key: 'ANTHROPIC_API_KEY', has_env_key: false, default_model: '', default_url: 'https://api.anthropic.com' },
    { id: 'openai', name: 'OpenAI', env_key: 'OPENAI_API_KEY', has_env_key: false, default_model: '', default_url: 'https://api.openai.com/v1' },
    { id: 'deepseek', name: 'DeepSeek', env_key: 'DEEPSEEK_API_KEY', has_env_key: false, default_model: '', default_url: 'https://api.deepseek.com' },
    { id: 'custom', name: isZh ? '自定义' : 'Custom', env_key: '', has_env_key: false, default_model: '', default_url: '' },
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
    setSearchQuery('');
  }, [config.provider]);

  const activeProvider = providers.find(p => p.id === config.provider);

  const handleSave = () => {
    config.setApiKey(formKey);
    config.setBaseUrl(formUrl);
    config.setModelId(formId);
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
        config.setModelName(models.includes(def) ? def : models[0]);
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
        {/* Left: Provider list */}
        <div className="w-48 flex-shrink-0">
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
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-[0.82rem] font-medium transition-all border ${
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

          {/* ID */}
          <div className="mb-4">
            <div className="text-[0.82rem] font-semibold mb-1">{t('modelId') as string}</div>
            <input
              type="text"
              value={formId}
              onChange={e => setFormId(e.target.value)}
              className="w-full px-3 py-2 text-[0.88rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none shadow-xs"
            />
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
                      onClick={() => config.setModelName(mid)}
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

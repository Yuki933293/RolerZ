import { create } from 'zustand';
import { getUserConfig, saveUserConfig } from '../api/client';

interface ProviderConfig {
  apiKey: string;
  apiKeys: string[];
  baseUrl: string;
  modelName: string;
  modelId: string;
  label: string;
  configured: boolean;
  fetchedModels: string[];
}

interface ConfigStore {
  provider: string;
  apiKey: string;
  apiKeys: string[];
  baseUrl: string;
  modelName: string;
  modelId: string;
  label: string;
  configured: boolean;
  fetchedModels: string[];
  language: string;
  count: number;
  theme: 'light' | 'dark';
  providerConfigs: Record<string, ProviderConfig>;

  setProvider: (p: string) => void;
  setApiKey: (k: string) => void;
  setApiKeys: (keys: string[]) => void;
  setBaseUrl: (u: string) => void;
  setModelName: (m: string) => void;
  setModelId: (id: string) => void;
  setLabel: (l: string) => void;
  setConfigured: (c: boolean) => void;
  setFetchedModels: (m: string[]) => void;
  setLanguage: (l: string) => void;
  setCount: (c: number) => void;
  setTheme: (t: 'light' | 'dark') => void;
  toggleTheme: () => void;
  saveConfig: () => void;
  deleteProviderConfig: (providerId: string) => void;
  loadFromServer: () => Promise<void>;
  saveToServer: () => Promise<void>;
  resetToDefaults: () => void;
}

const PROVIDER_DEFAULT_URLS: Record<string, string> = {
  claude:      'https://api.anthropic.com',
  openai:      'https://api.openai.com/v1',
  gemini:      'https://generativelanguage.googleapis.com/v1beta/openai',
  deepseek:    'https://api.deepseek.com',
  xai:         'https://api.x.ai/v1',
  moonshot:    'https://api.moonshot.cn/v1',
  zhipu:       'https://open.bigmodel.cn/api/paas/v4',
  groq:        'https://api.groq.com/openai/v1',
  openrouter:  'https://openrouter.ai/api/v1',
  siliconflow: 'https://api.siliconflow.cn/v1',
  '302ai':     'https://api.302.ai/v1',
  aihubmix:    'https://aihubmix.com/v1',
  nvidia:      'https://integrate.api.nvidia.com/v1',
  azure:       '',
  ollama:      'http://localhost:11434/v1',
  lmstudio:    'http://localhost:1234/v1',
  custom:      '',
};

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  claude:      'claude-haiku-4-5-20251001',
  openai:      'gpt-4o-mini',
  gemini:      'gemini-2.0-flash',
  deepseek:    'deepseek-chat',
  xai:         'grok-3-mini-fast',
  moonshot:    'moonshot-v1-8k',
  zhipu:       'glm-4-flash',
  groq:        'llama-3.3-70b-versatile',
  openrouter:  'openai/gpt-4o-mini',
  siliconflow: 'Qwen/Qwen2.5-7B-Instruct',
  '302ai':     'gpt-4o-mini',
  aihubmix:    'gpt-4o-mini',
  nvidia:      'meta/llama-3.1-8b-instruct',
};

const DEFAULTS = {
  provider: 'claude',
  apiKey: '',
  apiKeys: [] as string[],
  baseUrl: PROVIDER_DEFAULT_URLS['claude'],
  modelName: '',
  modelId: PROVIDER_DEFAULT_MODELS['claude'] || '',
  label: '',
  configured: false,
  fetchedModels: [] as string[],
  language: 'zh',
  count: 3,
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  providerConfigs: {} as Record<string, ProviderConfig>,
};

function currentProviderConfig(state: ConfigStore): ProviderConfig {
  return {
    apiKey: state.apiKey,
    apiKeys: state.apiKeys,
    baseUrl: state.baseUrl,
    modelName: state.modelName,
    modelId: state.modelId,
    label: state.label,
    configured: state.configured,
    fetchedModels: state.fetchedModels,
  };
}

function serializeForServer(state: ConfigStore): Record<string, unknown> {
  const configs = {
    ...state.providerConfigs,
    [state.provider]: currentProviderConfig(state),
  };
  return {
    provider: state.provider,
    language: state.language,
    count: state.count,
    providerConfigs: configs,
  };
}

export const useConfig = create<ConfigStore>((set, get) => ({
  ...DEFAULTS,

  setProvider: (p) => {
    const state = get();
    const updated: Record<string, ProviderConfig> = {
      ...state.providerConfigs,
      [state.provider]: currentProviderConfig(state),
    };

    const saved = updated[p];
    if (saved) {
      set({
        provider: p,
        apiKey: saved.apiKey,
        apiKeys: saved.apiKeys || [],
        baseUrl: saved.baseUrl,
        modelName: saved.modelName,
        modelId: saved.modelId,
        label: saved.label || '',
        configured: saved.configured,
        fetchedModels: saved.fetchedModels,
        providerConfigs: updated,
      });
    } else {
      const defaultModel = PROVIDER_DEFAULT_MODELS[p] || '';
      set({
        provider: p,
        apiKey: '',
        apiKeys: [],
        baseUrl: PROVIDER_DEFAULT_URLS[p] || '',
        modelName: defaultModel,
        modelId: defaultModel,
        label: '',
        configured: false,
        fetchedModels: [],
        providerConfigs: updated,
      });
    }
  },

  setApiKey: (k) => set({ apiKey: k }),
  setApiKeys: (keys) => set({ apiKeys: keys }),
  setBaseUrl: (u) => set({ baseUrl: u }),
  setModelName: (m) => set({ modelName: m }),
  setModelId: (id) => set({ modelId: id }),
  setLabel: (l) => set({ label: l }),
  setConfigured: (c) => set({ configured: c }),
  setFetchedModels: (m) => set({ fetchedModels: m }),
  setLanguage: (l) => {
    set({ language: l });
    // Auto-save to server if logged in
    setTimeout(() => {
      const state = get();
      if (localStorage.getItem('token')) {
        saveUserConfig(serializeForServer(state)).catch(() => {});
      }
    }, 0);
  },
  setCount: (c) => {
    set({ count: c });
    setTimeout(() => {
      const state = get();
      if (localStorage.getItem('token')) {
        saveUserConfig(serializeForServer(state)).catch(() => {});
      }
    }, 0);
  },
  setTheme: (t) => {
    set({ theme: t });
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  },
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },

  saveConfig: () => {
    const state = get();
    set({
      configured: true,
      providerConfigs: {
        ...state.providerConfigs,
        [state.provider]: { ...currentProviderConfig(state), configured: true },
      },
    });
    // Auto-save to server in background
    const updated = get();
    saveUserConfig(serializeForServer(updated)).catch(() => {});
  },

  deleteProviderConfig: (providerId) => {
    const state = get();
    const { [providerId]: _, ...rest } = state.providerConfigs;
    set({ providerConfigs: rest });
    // If deleting the current provider, reset it
    if (state.provider === providerId) {
      const defaultModel = PROVIDER_DEFAULT_MODELS[providerId] || '';
      set({
        apiKey: '',
        apiKeys: [],
        baseUrl: PROVIDER_DEFAULT_URLS[providerId] || '',
        modelName: defaultModel,
        modelId: defaultModel,
        label: '',
        configured: false,
        fetchedModels: [],
      });
    }
    // Save to server
    const updated = get();
    saveUserConfig(serializeForServer(updated)).catch(() => {});
  },

  loadFromServer: async () => {
    try {
      const data = await getUserConfig();
      if (!data || Object.keys(data).length === 0) return;

      const provider = (data.provider as string) || DEFAULTS.provider;
      const language = (data.language as string) || DEFAULTS.language;
      const count = (data.count as number) || DEFAULTS.count;
      const configs = (data.providerConfigs as Record<string, ProviderConfig>) || {};

      const saved = configs[provider];
      set({
        provider,
        language,
        count,
        providerConfigs: configs,
        apiKey: saved?.apiKey || '',
        apiKeys: saved?.apiKeys || [],
        baseUrl: saved?.baseUrl || PROVIDER_DEFAULT_URLS[provider] || '',
        modelName: saved?.modelName || '',
        modelId: saved?.modelId || PROVIDER_DEFAULT_MODELS[provider] || '',
        label: saved?.label || '',
        configured: saved?.configured || false,
        fetchedModels: saved?.fetchedModels || [],
      });
    } catch {
      // Not logged in or server error — keep defaults
    }
  },

  saveToServer: async () => {
    const state = get();
    await saveUserConfig(serializeForServer(state)).catch(() => {});
  },

  resetToDefaults: () => {
    set({ ...DEFAULTS });
  },
}));

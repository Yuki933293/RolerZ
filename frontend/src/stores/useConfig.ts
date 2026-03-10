import { create } from 'zustand';
import { getUserConfig, saveUserConfig } from '../api/client';

interface ProviderConfig {
  apiKey: string;
  apiKeys: string[];
  baseUrl: string;
  modelName: string;
  modelId: string;
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
  setConfigured: (c: boolean) => void;
  setFetchedModels: (m: string[]) => void;
  setLanguage: (l: string) => void;
  setCount: (c: number) => void;
  setTheme: (t: 'light' | 'dark') => void;
  toggleTheme: () => void;
  saveConfig: () => void;
  loadFromServer: () => Promise<void>;
  saveToServer: () => Promise<void>;
  resetToDefaults: () => void;
}

const PROVIDER_DEFAULT_URLS: Record<string, string> = {
  claude: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com',
  custom: '',
};

const DEFAULTS = {
  provider: 'claude',
  apiKey: '',
  apiKeys: [] as string[],
  baseUrl: PROVIDER_DEFAULT_URLS['claude'],
  modelName: '',
  modelId: 'claude',
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
        configured: saved.configured,
        fetchedModels: saved.fetchedModels,
        providerConfigs: updated,
      });
    } else {
      set({
        provider: p,
        apiKey: '',
        apiKeys: [],
        baseUrl: PROVIDER_DEFAULT_URLS[p] || '',
        modelName: '',
        modelId: p,
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
        modelId: saved?.modelId || provider,
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

const BASE = '';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth ──
export interface TokenResponse {
  access_token: string;
  token_type: string;
  username: string;
}

export function login(username: string, password: string) {
  return request<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function register(username: string, password: string) {
  return request<TokenResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// ── Providers ──
export interface ProviderInfo {
  id: string;
  name: string;
  env_key: string;
  has_env_key: boolean;
  default_model: string;
  default_url: string;
}

export function getProviders() {
  return request<ProviderInfo[]>('/api/providers');
}

export function fetchModels(provider: string, apiKey: string, baseUrl: string) {
  return request<string[]>('/api/providers/models', {
    method: 'POST',
    body: JSON.stringify({ provider, api_key: apiKey, base_url: baseUrl }),
  });
}

// ── User config ──
export function getUserConfig() {
  return request<Record<string, unknown>>('/api/config');
}

export function saveUserConfig(config: Record<string, unknown>) {
  return request('/api/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// ── Cards ──
export interface InspirationCard {
  id: string;
  title_zh: string;
  title_en: string;
  category: string;
  tags: string[];
  prompt_zh: string;
  prompt_en: string;
  snippets: Record<string, { zh: string; en: string }>;
}

export function getCards() {
  return request<InspirationCard[]>('/api/cards');
}

export function getCardOverrides() {
  return request<Record<string, Record<string, unknown>>>('/api/cards/overrides');
}

export function saveCardOverride(cardId: string, customData: Record<string, unknown>) {
  return request('/api/cards/' + cardId + '/override', {
    method: 'PUT',
    body: JSON.stringify({ custom_data: customData }),
  });
}

export function deleteCardOverride(cardId: string) {
  return request('/api/cards/' + cardId + '/override', { method: 'DELETE' });
}

// ── Card groups ──
export interface CardGroup {
  group_id: string;
  group_name: string;
  card_ids: string[];
  sort_order: number;
}

export function getCardGroups() {
  return request<CardGroup[]>('/api/cards/groups');
}

export function saveCardGroups(groups: CardGroup[]) {
  return request('/api/cards/groups', {
    method: 'PUT',
    body: JSON.stringify({ groups }),
  });
}

// ── Generate ──
export interface GenerateParams {
  concept: string;
  count: number;
  language: string;
  provider: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  selected_inspirations?: string[];
}

export interface Candidate {
  id: string;
  score: number;
  tags: string[];
  sources: string[];
  spec_long: Record<string, unknown>;
  spec_short: Record<string, unknown>;
  natural_long: string;
  natural_short: string;
}

export interface GenerateResult {
  candidates: Candidate[];
  questions: unknown[];
  meta: Record<string, unknown>;
}

export function generate(params: GenerateParams) {
  return request<GenerateResult>('/api/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Wizard ──
export interface WizardQuestion {
  id: string;
  field: string;
  text: string;
}

export interface WizardStartResult {
  session_id: string;
  questions: WizardQuestion[];
  stage: string;
}

export function wizardStart(params: {
  concept: string;
  provider: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  count?: number;
  language?: string;
}) {
  return request<WizardStartResult>('/api/wizard/start', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function wizardAnswer(sessionId: string, field: string, answer: string) {
  return request<{ questions: WizardQuestion[]; stage: string }>(
    `/api/wizard/${sessionId}/answer`,
    { method: 'POST', body: JSON.stringify({ field, answer }) },
  );
}

export function wizardFinish(sessionId: string) {
  return request<GenerateResult>(`/api/wizard/${sessionId}/finish`, { method: 'POST' });
}

// ── Profile ──
export interface ProfileStats {
  username: string;
  total_generations: number;
  total_candidates: number;
  member_since: string | null;
}

export interface HistoryRecord {
  id: number;
  concept: string;
  language: string;
  candidate_count: number;
  result_data: GenerateResult;
  created_at: string;
}

export function getProfileStats() {
  return request<ProfileStats>('/api/profile/stats');
}

export function getHistory(limit = 50, offset = 0) {
  return request<HistoryRecord[]>(`/api/profile/history?limit=${limit}&offset=${offset}`);
}

export function deleteHistory(recordId: number) {
  return request(`/api/profile/history/${recordId}`, { method: 'DELETE' });
}

export function changePassword(oldPassword: string, newPassword: string) {
  return request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
}

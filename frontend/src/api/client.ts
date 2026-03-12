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
  is_admin: boolean;
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
  temperature?: number | null;
  top_p?: number | null;
  max_tokens?: number | null;
  frequency_penalty?: number | null;
  presence_penalty?: number | null;
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

export function generate(params: GenerateParams, signal?: AbortSignal) {
  return request<GenerateResult>('/api/generate', {
    method: 'POST',
    body: JSON.stringify(params),
    signal,
  });
}

export function cancelGeneration() {
  return request<{ ok: boolean }>('/api/generate/cancel', { method: 'POST' });
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

export interface UserProfile {
  username: string;
  avatar_url: string;
  bio: string;
  created_at: string;
}

export function getProfileInfo() {
  return request<UserProfile>('/api/profile/info');
}

export function updateProfileInfo(data: { avatar_url?: string; bio?: string }) {
  return request('/api/profile/info', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function clearAllHistory() {
  return request<{ ok: boolean; deleted: number }>('/api/profile/history', { method: 'DELETE' });
}

export function deleteAccount() {
  return request('/api/profile/account', { method: 'DELETE' });
}

// ── Announcements ──
export interface Announcement {
  id: string;
  date: string;
  type: string;
  title_zh: string;
  title_en: string;
  body_zh: string;
  body_en: string;
  sort_order: number;
  created_at?: string;
}

export function getAnnouncements() {
  return request<Announcement[]>('/api/announcements');
}

export function createAnnouncement(data: Omit<Announcement, 'created_at'>) {
  return request('/api/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAnnouncement(annId: string, data: Omit<Announcement, 'created_at'>) {
  return request(`/api/announcements/${annId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteAnnouncement(annId: string) {
  return request(`/api/announcements/${annId}`, { method: 'DELETE' });
}

// ── Admin: user management ──
export interface AdminUser {
  id: number;
  username: string;
  is_admin: number;
  created_at: string;
  generation_count: number;
}

export function getAdminUsers() {
  return request<AdminUser[]>('/api/admin/users');
}

export function setUserAdmin(userId: number, isAdmin: boolean) {
  return request(`/api/admin/users/${userId}/admin`, {
    method: 'PUT',
    body: JSON.stringify({ is_admin: isAdmin }),
  });
}

export function adminDeleteUser(userId: number) {
  return request(`/api/admin/users/${userId}`, { method: 'DELETE' });
}

// ── Chat preview ──
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function chatPreview(data: {
  messages: ChatMessage[];
  system_prompt: string;
  provider: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  temperature?: number | null;
  top_p?: number | null;
  max_tokens?: number | null;
}) {
  return request<{ reply: string }>('/api/chat/preview', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Chat sessions ──
export interface ChatSession {
  id: number;
  char_name: string;
  message_count: number;
  last_message: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionDetail {
  id: number;
  char_name: string;
  system_prompt: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export function listChatSessions(visibility?: string, charName?: string) {
  const params = new URLSearchParams();
  if (visibility) params.set('visibility', visibility);
  if (charName) params.set('char_name', charName);
  const qs = params.toString();
  return request<ChatSession[]>(`/api/chat/sessions${qs ? `?${qs}` : ''}`);
}

export function createChatSession(data: {
  char_name: string;
  system_prompt: string;
  messages: ChatMessage[];
}) {
  return request<{ ok: boolean; id: number }>('/api/chat/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getChatSession(sessionId: number) {
  return request<ChatSessionDetail>(`/api/chat/sessions/${sessionId}`);
}

export function updateChatSession(sessionId: number, messages: ChatMessage[]) {
  return request<{ ok: boolean }>(`/api/chat/sessions/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify({ messages }),
  });
}

export function deleteChatSession(sessionId: number) {
  return request<{ ok: boolean }>(`/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export function hideChatSession(sessionId: number, hidden: boolean = true) {
  return request<{ ok: boolean }>(`/api/chat/sessions/${sessionId}/hide?hidden=${hidden}`, {
    method: 'PUT',
  });
}

export function batchDeleteChatSessions(sessionIds: number[]) {
  return request<{ ok: boolean; deleted: number }>('/api/chat/sessions/batch-delete', {
    method: 'POST',
    body: JSON.stringify({ session_ids: sessionIds }),
  });
}

export function clearChatSessions() {
  return request<{ ok: boolean; deleted: number }>('/api/chat/sessions', {
    method: 'DELETE',
  });
}

// ── Notifications ──
export interface Notification {
  id: number;
  type: string;
  title_zh: string;
  title_en: string;
  body_zh: string;
  body_en: string;
  is_read: number;
  created_at: string;
}

export function getNotifications(unreadOnly?: boolean) {
  const q = unreadOnly ? '?unread_only=true' : '';
  return request<Notification[]>(`/api/notifications${q}`);
}

export function getUnreadCount() {
  return request<{ count: number }>('/api/notifications/unread-count');
}

export function markNotificationRead(id: number) {
  return request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'PUT' });
}

export function markAllNotificationsRead() {
  return request<{ ok: boolean }>('/api/notifications/read-all', { method: 'PUT' });
}

// ── Tier config ──
export interface TierConfig {
  phase: number;
  user_count: number;
  mythic_top_n: number;
  thresholds: { rare: number; epic: number; legendary: number };
  mode: 'fixed' | 'percentile';
}

export function getTierConfig() {
  return request<TierConfig>('/api/tier/config');
}

// ── Community ──
export interface SharedPersona {
  id: number;
  name: string;
  summary: string;
  tags: string[];
  spec_data: Record<string, string>;
  natural_text: string;
  score: number;
  language: string;
  likes: number;
  liked: boolean;
  author: string;
  user_id: number;
  created_at: string;
  card_type: string;
  mythic_rank: number | null;
}

export function sharePersona(data: {
  name: string;
  summary: string;
  tags: string[];
  spec_data: Record<string, unknown>;
  natural_text: string;
  score: number;
  language: string;
  card_type?: string;
}) {
  return request<{ ok: boolean; id: number }>('/api/community/share', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getCommunityPersonas(params?: { limit?: number; offset?: number; sort?: string; tag?: string; card_type?: string }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  if (params?.sort) q.set('sort', params.sort);
  if (params?.tag) q.set('tag', params.tag);
  if (params?.card_type) q.set('card_type', params.card_type);
  return request<SharedPersona[]>(`/api/community/personas?${q}`);
}

export function togglePersonaLike(personaId: number) {
  return request<{ ok: boolean; liked: boolean }>(`/api/community/personas/${personaId}/like`, {
    method: 'POST',
  });
}

export function deleteSharedPersona(personaId: number) {
  return request(`/api/community/personas/${personaId}`, { method: 'DELETE' });
}

// ── Events (analytics) ──
export function recordEvents(events: { event_type: 'view' | 'click' | 'save'; persona_id: number }[]) {
  return request<{ ok: boolean; recorded: number }>('/api/events', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
}

// ── Fusion Lab ──
export interface FusionParams {
  card_ids: string[];
  language: string;
  provider: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  temperature?: number | null;
  top_p?: number | null;
  max_tokens?: number | null;
}

export interface FusionResult {
  identity: string;
  appearance: string;
  background: string;
  personality: string;
  voice: string;
  goals: string;
  relationships: string;
  conflicts: string;
  taboos: string;
  dialogue_examples: string;
  opening_line: string;
  system_constraints: string;
  tags: string[];
  fusion_note: string;
  source_cards: string[];
}

export function fusionGenerate(params: FusionParams) {
  return request<FusionResult>('/api/fusion/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Admin stats ──
export interface AdminStats {
  total_users: number;
  total_generations: number;
  total_shared: number;
  today_users: number;
  today_generations: number;
  generation_trend: { date: string; count: number }[];
}

export function getAdminStats() {
  return request<AdminStats>('/api/admin/stats');
}

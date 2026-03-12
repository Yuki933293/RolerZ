/**
 * Card color backup — per-category variant
 * Backup date: 2026-03-10
 */

// Category glow colors (shadow)
export const CATEGORY_GLOW_BACKUP: Record<string, string> = {
  personality: 'rgba(78,140,255,0.25)', expression: 'rgba(244,114,182,0.25)',
  emotion: 'rgba(251,191,36,0.2)', relationship: 'rgba(52,211,153,0.25)',
  background: 'rgba(167,139,250,0.25)', behavior: 'rgba(96,165,250,0.25)',
  motivation: 'rgba(251,113,133,0.25)', conflict: 'rgba(251,146,60,0.2)',
  appearance: 'rgba(139,92,246,0.25)', scenario: 'rgba(20,184,166,0.25)',
  quirk: 'rgba(245,158,11,0.2)',
};

// Category icon accent colors
export const CATEGORY_ACCENT_BACKUP: Record<string, string> = {
  personality: '#4E8CFF', expression: '#EC4899', emotion: '#F59E0B',
  relationship: '#10B981', background: '#8B5CF6', behavior: '#3B82F6',
  motivation: '#EF4444', conflict: '#F97316',
  appearance: '#7C3AED', scenario: '#14B8A6', quirk: '#EAB308',
};

// Category card gradient backgrounds [start, end]
export const CATEGORY_CARD_BG_BACKUP: Record<string, [string, string]> = {
  personality:  ['#eef4ff', '#dce6f9'],  // light blue
  expression:   ['#fdf2f8', '#f5dce9'],  // light pink
  emotion:      ['#fefce8', '#f9edcc'],  // light yellow
  relationship: ['#ecfdf5', '#d5f0e5'],  // light green
  background:   ['#f5f3ff', '#e8e0f7'],  // light purple
  behavior:     ['#eff6ff', '#dce8fa'],  // sky blue
  motivation:   ['#fef2f2', '#f9dede'],  // light red
  conflict:     ['#fff7ed', '#f7e8d4'],  // light orange
  appearance:   ['#f3f0ff', '#e4dcf9'],  // violet
  scenario:     ['#f0fdfa', '#d6f1ec'],  // light teal
  quirk:        ['#fefce8', '#f5edcf'],  // light gold
};

/**
 * Card Tier System (for community sharing feature)
 *
 * Tier       | Threshold  | Visual Effect
 * -----------|------------|----------------------------------------------
 * Normal     | default    | Static card, category gradient, no effects
 * Rare       | 500+ uses  | Category gradient + silver border glow
 * Epic       | 5000+      | Category gradient + holo 3D + silver border
 * Legendary  | 50000+     | Gold gradient + holo 3D + gold sweep shimmer
 * Mythic     | 100000+    | Gold + holo + gold sweep + rainbow particle border
 *
 * Color scheme:
 * - Normal/Rare/Epic: category-based gradient (blue, green, pink, etc.)
 * - Legendary/Mythic: unified gold gradient (overrides category color)
 *
 * CSS classes: .card-normal, .card-rare, .card-epic, .card-legendary, .card-mythic
 */
export type CardTier = 'normal' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const TIER_THRESHOLDS: Record<CardTier, number> = {
  normal: 0,
  rare: 500,
  epic: 5000,
  legendary: 50000,
  mythic: 100000,
};

export function getCardTier(useCount: number): CardTier {
  if (useCount >= 100000) return 'mythic';
  if (useCount >= 50000) return 'legendary';
  if (useCount >= 5000) return 'epic';
  if (useCount >= 500) return 'rare';
  return 'normal';
}

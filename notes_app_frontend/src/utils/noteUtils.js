/**
 * Small shared utilities for notes.
 */

/** @typedef {{id:string,title:string,content:string,tags:string[],pinned:boolean,favorite:boolean,createdAt:number,updatedAt:number}} Note */

/**
 * PUBLIC_INTERFACE
 * Generate a reasonably unique id without external deps.
 * @returns {string} unique id
 */
export function generateId() {
  // Prefer Web Crypto when available.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * PUBLIC_INTERFACE
 * Normalize user-entered tags:
 * - split by comma
 * - trim
 * - lowercase
 * - remove empties
 * - de-duplicate
 * @param {string} rawTags
 * @returns {string[]} normalized tags
 */
export function normalizeTags(rawTags) {
  if (!rawTags) return [];
  const parts = rawTags
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(parts));
}

/**
 * PUBLIC_INTERFACE
 * Safe JSON parse returning a fallback if parsing fails.
 * @template T
 * @param {string} text
 * @param {T} fallback
 * @returns {T}
 */
export function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * PUBLIC_INTERFACE
 * Create a new blank note (optionally seeded).
 * @param {Partial<Note>} [seed]
 * @returns {Note}
 */
export function createNote(seed = {}) {
  const now = Date.now();
  return {
    id: generateId(),
    title: seed.title ?? '',
    content: seed.content ?? '',
    tags: seed.tags ?? [],
    pinned: seed.pinned ?? false,
    favorite: seed.favorite ?? false,
    createdAt: seed.createdAt ?? now,
    updatedAt: seed.updatedAt ?? now
  };
}

/**
 * PUBLIC_INTERFACE
 * Return a concise preview for note list rendering.
 * @param {string} content
 * @param {number} maxLen
 * @returns {string}
 */
export function makePreview(content, maxLen = 120) {
  const s = (content ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen).trim()}…`;
}

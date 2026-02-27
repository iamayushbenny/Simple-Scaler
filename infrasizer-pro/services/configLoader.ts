/**
 * Remote Configuration Loader
 *
 * Provides global admin configuration persistence by fetching from
 * /config.json (remote) with localStorage as fallback cache.
 *
 * Resolution order:
 *   1. In-memory cache (fastest, avoids re-fetching)
 *   2. Remote /config.json (source of truth for all users)
 *   3. localStorage cache (offline / fetch-failure fallback)
 *   4. Hardcoded defaults (last resort)
 *
 * Call initRemoteConfig() once at app boot (async).
 * Call getConfig() synchronously anywhere — always returns a valid config object.
 *
 * Platform recommendations follow the same pattern via
 * initRemotePlatformConfig() and getRemotePlatformConfig().
 */

import { PlatformRecommendations } from '../config/platformRecommendations';

// ─── Backend base URL ────────────────────────────────────────────────────────

const API_BASE = 'http://172.22.8.6:5000';

// ─── Storage keys ────────────────────────────────────────────────────────────

const CALC_STORAGE_KEY = 'calculationConfig';
const PLATFORM_STORAGE_KEY = 'platformRecommendations_v1';

// ─── In-memory caches ────────────────────────────────────────────────────────

let _calcConfigCache: any = null;
let _platformConfigCache: PlatformRecommendations | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Cache-busted fetch to avoid stale CDN / browser cache */
async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(`${url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Calculation Config ──────────────────────────────────────────────────────

/**
 * Fetch calculation config from backend API and warm the in-memory + localStorage caches.
 * Safe to call multiple times — subsequent calls are near-instant.
 */
export async function initRemoteConfig(): Promise<void> {
  const remote = await fetchJSON<any>(`${API_BASE}/api/calcconfig`);
  if (remote && typeof remote === 'object' && Object.keys(remote).length > 0) {
    _calcConfigCache = remote;
    // Mirror to localStorage so offline sessions still see latest admin config
    try {
      localStorage.setItem(CALC_STORAGE_KEY, JSON.stringify(remote));
    } catch { /* quota errors etc. — safe to ignore */ }
  } else {
    // Remote unavailable — try localStorage cache
    try {
      const cached = localStorage.getItem(CALC_STORAGE_KEY);
      if (cached) _calcConfigCache = JSON.parse(cached);
    } catch { /* corrupt data — fall through to defaults */ }
  }
}

/**
 * Synchronous config getter used by CalculatorEngine.loadConfig().
 * Returns in-memory cache → localStorage cache → null (caller uses defaults).
 */
export function getConfig(): any {
  if (_calcConfigCache) return _calcConfigCache;
  try {
    const cached = localStorage.getItem(CALC_STORAGE_KEY);
    if (cached) {
      _calcConfigCache = JSON.parse(cached);
      return _calcConfigCache;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Save config to localStorage AND persist to backend via POST /api/calcconfig.
 * Called from AdminPanel.handleSave().
 */
export async function saveConfig(config: any): Promise<boolean> {
  _calcConfigCache = config;
  localStorage.setItem(CALC_STORAGE_KEY, JSON.stringify(config));

  try {
    const res = await fetch(`${API_BASE}/api/calcconfig`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Reset config: clear caches and localStorage.
 */
export function resetConfig(): void {
  _calcConfigCache = null;
  localStorage.removeItem(CALC_STORAGE_KEY);
}

// ─── Platform Recommendations Config ─────────────────────────────────────────

/**
 * Fetch platform recommendations from backend API into memory + localStorage.
 */
export async function initRemotePlatformConfig(): Promise<void> {
  const remote = await fetchJSON<PlatformRecommendations>(`${API_BASE}/api/config`);
  if (remote && typeof remote === 'object' && Array.isArray(remote.software)) {
    _platformConfigCache = remote;
    try {
      localStorage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(remote));
    } catch { /* ignore */ }
  } else {
    try {
      const cached = localStorage.getItem(PLATFORM_STORAGE_KEY);
      if (cached) _platformConfigCache = JSON.parse(cached);
    } catch { /* ignore */ }
  }
}

/**
 * Synchronous getter for platform recommendations.
 * Returns cached remote → localStorage → null (caller falls back to defaults).
 */
export function getRemotePlatformConfig(): PlatformRecommendations | null {
  if (_platformConfigCache) return _platformConfigCache;
  try {
    const cached = localStorage.getItem(PLATFORM_STORAGE_KEY);
    if (cached) {
      _platformConfigCache = JSON.parse(cached);
      return _platformConfigCache;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Save platform recommendations to the backend API.
 * Returns true on success, false on failure.
 */
export async function savePlatformConfigRemote(
  data: PlatformRecommendations,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return false;
    // Update in-memory cache so subsequent reads reflect the save
    _platformConfigCache = data;
    try {
      localStorage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

/**
 * Manually update the in-memory platform config cache.
 * Useful when the admin saves and we want immediate consistency
 * without waiting for a re-fetch.
 */
export function updatePlatformConfigCache(
  data: PlatformRecommendations,
): void {
  _platformConfigCache = data;
  try {
    localStorage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

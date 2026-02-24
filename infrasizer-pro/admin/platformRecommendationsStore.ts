/**
 * Platform Recommendations Admin Store
 *
 * Manages load / save / reset / validate for the admin-editable
 * platform recommendations config in localStorage.
 *
 * Storage key: platformRecommendations_v1 (versioned)
 * Includes one-time migration from legacy key.
 */

import {
  PlatformRecommendations,
  SoftwareRecommendation,
  BrowserRecommendation,
} from '../config/platformRecommendations';

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'platformRecommendations_v1';
const LEGACY_KEY = 'platformRecommendations';

// ─── Validation ──────────────────────────────────────────────────────────────

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function validateSoftwareRow(row: unknown): row is SoftwareRecommendation {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    isNonEmptyString(r.software) &&
    isNonEmptyString(r.supportedVersion) &&
    typeof r.componentHosted === 'string' &&
    typeof r.comments === 'string'
  );
}

function validateBrowserRow(row: unknown): row is BrowserRecommendation {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  return isNonEmptyString(r.browser) && isNonEmptyString(r.supportedVersion);
}

/**
 * Validate a parsed object as PlatformRecommendations.
 * Returns the cleaned object or null if invalid.
 */
export function validatePlatformRecommendations(
  data: unknown,
): PlatformRecommendations | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.software) || !Array.isArray(d.browsers)) return null;

  const software = d.software.filter(validateSoftwareRow);
  const browsers = d.browsers.filter(validateBrowserRow);

  // Must have at least some valid rows to be considered a valid config
  if (software.length === 0 && browsers.length === 0) return null;

  // Trim all string fields
  return {
    software: software.map(s => ({
      software: s.software.trim(),
      supportedVersion: s.supportedVersion.trim(),
      componentHosted: s.componentHosted.trim(),
      comments: s.comments.trim(),
    })),
    browsers: browsers.map(b => ({
      browser: b.browser.trim(),
      supportedVersion: b.supportedVersion.trim(),
    })),
  };
}

// ─── Migration ───────────────────────────────────────────────────────────────

/**
 * One-time migration: if legacy key exists and new key does not,
 * copy validated data to the new versioned key and remove legacy.
 */
export function migrateLegacyConfig(): void {
  try {
    const hasNew = localStorage.getItem(STORAGE_KEY);
    if (hasNew) return; // already migrated

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;

    const parsed = JSON.parse(legacy);
    const validated = validatePlatformRecommendations(parsed);
    if (validated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
    }
    // Remove legacy key regardless (clean up)
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Ignore migration errors
  }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Load admin-saved platform recommendations from versioned localStorage.
 * Returns null if none saved or invalid (caller falls back to defaults).
 */
export function loadPlatformConfig(): PlatformRecommendations | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validatePlatformRecommendations(parsed);
  } catch {
    return null;
  }
}

/**
 * Save platform recommendations to versioned localStorage.
 * Validates before saving. Returns true on success.
 */
export function savePlatformConfig(data: PlatformRecommendations): boolean {
  const validated = validatePlatformRecommendations(data);
  if (!validated) return false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  return true;
}

/**
 * Remove admin overrides — reverts to defaults on next load.
 */
export function resetPlatformConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_KEY); // clean up legacy too
}

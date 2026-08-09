export const PREFERENCES_STORAGE_KEY = 'trading-dashboard-preferences';
export const PREFERENCES_VERSION = 1;

export const DEFAULT_PREFERENCES = Object.freeze({
  version: PREFERENCES_VERSION,
  theme: 'system',
  density: 'comfortable',
  reducedMotion: false,
  refreshInterval: 30,
  refreshOnFocus: true,
  staleWarningSeconds: 120,
  maskAccountValues: false,
  maskPositionSizes: false,
  defaultPage: 'overview',
});

const ALLOWED_THEMES = new Set(['system', 'light', 'dark']);
const ALLOWED_DENSITIES = new Set(['comfortable', 'compact']);
const ALLOWED_DEFAULT_PAGES = new Set(['overview', 'portfolio', 'orders', 'agents', 'risk', 'backtest', 'system']);
const ALLOWED_REFRESH_INTERVALS = new Set([0, 5, 10, 30, 60]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function boundedInteger(value, fallback, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

export function sanitizePreferences(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    version: PREFERENCES_VERSION,
    theme: ALLOWED_THEMES.has(source.theme) ? source.theme : DEFAULT_PREFERENCES.theme,
    density: ALLOWED_DENSITIES.has(source.density) ? source.density : DEFAULT_PREFERENCES.density,
    reducedMotion: typeof source.reducedMotion === 'boolean' ? source.reducedMotion : DEFAULT_PREFERENCES.reducedMotion,
    refreshInterval: ALLOWED_REFRESH_INTERVALS.has(source.refreshInterval)
      ? source.refreshInterval
      : DEFAULT_PREFERENCES.refreshInterval,
    refreshOnFocus: typeof source.refreshOnFocus === 'boolean' ? source.refreshOnFocus : DEFAULT_PREFERENCES.refreshOnFocus,
    staleWarningSeconds: boundedInteger(source.staleWarningSeconds, DEFAULT_PREFERENCES.staleWarningSeconds, 30, 900),
    maskAccountValues: typeof source.maskAccountValues === 'boolean' ? source.maskAccountValues : DEFAULT_PREFERENCES.maskAccountValues,
    maskPositionSizes: typeof source.maskPositionSizes === 'boolean' ? source.maskPositionSizes : DEFAULT_PREFERENCES.maskPositionSizes,
    defaultPage: ALLOWED_DEFAULT_PAGES.has(source.defaultPage) ? source.defaultPage : DEFAULT_PREFERENCES.defaultPage,
  };
}

export function loadPreferences(storage = globalThis.localStorage) {
  if (!storage) return { ...DEFAULT_PREFERENCES };
  try {
    const raw = storage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return sanitizePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(preferences, storage = globalThis.localStorage) {
  const safe = sanitizePreferences(preferences);
  if (!storage) return safe;
  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // Preferences are presentation-only. Keep the app usable if browser storage is denied or full.
  }
  return safe;
}

export function clearPreferences(storage = globalThis.localStorage) {
  if (storage) {
    try {
      storage.removeItem(PREFERENCES_STORAGE_KEY);
    } catch {
      // Reset the in-memory preferences even when persistent storage cannot be modified.
    }
  }
  return { ...DEFAULT_PREFERENCES };
}

export function applyPreferences(preferences, root = globalThis.document?.documentElement) {
  if (!root) return;
  const safe = sanitizePreferences(preferences);
  root.dataset.theme = safe.theme;
  root.dataset.density = safe.density;
  root.dataset.reducedMotion = String(safe.reducedMotion);
  root.style.colorScheme = safe.theme === 'system' ? 'light dark' : safe.theme;
}

export function applyPrivacyPreferences(snapshot, preferences) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const safe = sanitizePreferences(preferences);
  if (!safe.maskAccountValues && !safe.maskPositionSizes) return snapshot;

  const positions = Array.isArray(snapshot.positions)
    ? snapshot.positions.map((position) => ({
      ...position,
      valuesMasked: Boolean(position.valuesMasked || safe.maskAccountValues),
      quantityMasked: Boolean(position.quantityMasked || safe.maskPositionSizes),
    }))
    : snapshot.positions;

  return {
    ...snapshot,
    account: snapshot.account
      ? {
        ...snapshot.account,
        valuesMasked: Boolean(snapshot.account.valuesMasked || safe.maskAccountValues),
      }
      : snapshot.account,
    privacy: {
      ...(snapshot.privacy ?? {}),
      valuesMasked: Boolean(snapshot.privacy?.valuesMasked || safe.maskAccountValues),
      positionSizesMasked: Boolean(snapshot.privacy?.positionSizesMasked || safe.maskPositionSizes),
    },
    positions,
  };
}

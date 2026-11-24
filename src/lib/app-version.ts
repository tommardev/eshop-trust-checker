export const FALLBACK_APP_VERSION = '0.0.0-dev';

/**
 * Formats a raw application version string into a consistent `v`-prefixed display label (e.g. `v0.1.0`).
 * Falls back safely when the version is missing, empty, or contains only a prefix.
 */
export function formatAppVersion(rawVersion?: string): string {
  const trimmed = rawVersion?.trim();
  if (!trimmed) {
    return `v${FALLBACK_APP_VERSION}`;
  }

  const normalized = trimmed.replace(/^v+/i, '');
  if (!normalized) {
    return `v${FALLBACK_APP_VERSION}`;
  }

  return `v${normalized}`;
}

/**
 * Returns the build-time application version injected via `next.config.mjs` (`NEXT_PUBLIC_APP_VERSION`),
 * formatted for UI display with a safe fallback when unset.
 */
export function getAppVersion(): string {
  return formatAppVersion(process.env.NEXT_PUBLIC_APP_VERSION);
}

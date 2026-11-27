import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Result of verifying an incoming request against the optional `SYNC_BLACKLIST_SECRET`.
 */
export interface SyncBlacklistAuthResult {
  authorized: boolean;
  mode: 'disabled' | 'enforced';
  reason?: string;
}

/**
 * Constant-time authentication guard for `POST /api/sync-blacklist`.
 */
export class SyncBlacklistAuth {
  public static readonly SECRET_HEADER = 'x-sync-blacklist-secret';

  /**
   * Extracts the caller-supplied secret from `x-sync-blacklist-secret` or `Authorization: Bearer`.
   * Fails closed if `x-sync-blacklist-secret` is explicitly present but blank.
   */
  public static extractProvidedSecret(headers: Pick<Headers, 'get'>): string | null {
    const explicitHeader = headers.get(this.SECRET_HEADER);
    if (explicitHeader != null) {
      const trimmed = explicitHeader.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    const authorization = headers.get('authorization');
    if (authorization == null) {
      return null;
    }

    const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
    return match ? match[1] : null;
  }

  /**
   * Compares two secret strings in constant time without leaking length via `RangeError`.
   */
  public static timingSafeMatch(provided: string, expected: string): boolean {
    const providedDigest = createHash('sha256').update(provided, 'utf8').digest();
    const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
    return timingSafeEqual(providedDigest, expectedDigest);
  }

  /**
   * Verifies request headers against `expectedSecret` (defaults to `process.env.SYNC_BLACKLIST_SECRET`).
   * Auth is disabled only when the expected secret is unset or whitespace-only.
   */
  public static verify(
    headers: Pick<Headers, 'get'>,
    expectedSecret?: string
  ): SyncBlacklistAuthResult {
    // Distinguish an omitted second argument from an explicit `undefined`.
    const rawExpected =
      arguments.length >= 2 ? expectedSecret : process.env.SYNC_BLACKLIST_SECRET;
    const trimmedExpected = typeof rawExpected === 'string' ? rawExpected.trim() : '';

    if (trimmedExpected.length === 0) {
      return { authorized: true, mode: 'disabled' };
    }

    const provided = this.extractProvidedSecret(headers);
    if (!provided) {
      return {
        authorized: false,
        mode: 'enforced',
        reason: 'Missing or malformed sync secret header.',
      };
    }

    if (!this.timingSafeMatch(provided, trimmedExpected)) {
      return {
        authorized: false,
        mode: 'enforced',
        reason: 'Invalid sync secret.',
      };
    }

    return { authorized: true, mode: 'enforced' };
  }
}

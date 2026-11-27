import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SyncBlacklistAuth } from '../sync-blacklist-auth.ts';

interface NextConfigModuleShape {
  default: {
    env?: Record<string, string>;
    output?: string;
  };
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function withSyncBlacklistSecretEnv(value: string | undefined, run: () => void): void {
  const previousValue = process.env.SYNC_BLACKLIST_SECRET;

  if (value === undefined) {
    delete process.env.SYNC_BLACKLIST_SECRET;
  } else {
    process.env.SYNC_BLACKLIST_SECRET = value;
  }

  try {
    run();
  } finally {
    if (previousValue === undefined) {
      delete process.env.SYNC_BLACKLIST_SECRET;
    } else {
      process.env.SYNC_BLACKLIST_SECRET = previousValue;
    }
  }
}

describe('SyncBlacklistAuth', () => {
  describe('disabled mode (optional secret unset or blank)', () => {
    it('authorizes requests in disabled mode when expected secret is undefined, empty, or whitespace', () => {
      assert.deepStrictEqual(SyncBlacklistAuth.verify(new Headers(), undefined), {
        authorized: true,
        mode: 'disabled',
      });
      assert.deepStrictEqual(SyncBlacklistAuth.verify(new Headers(), ''), {
        authorized: true,
        mode: 'disabled',
      });
      assert.deepStrictEqual(SyncBlacklistAuth.verify(new Headers(), '   \t  '), {
        authorized: true,
        mode: 'disabled',
      });
    });

    it('reads process.env.SYNC_BLACKLIST_SECRET by default and restores environment safely', () => {
      withSyncBlacklistSecretEnv(undefined, () => {
        assert.deepStrictEqual(SyncBlacklistAuth.verify(new Headers()), {
          authorized: true,
          mode: 'disabled',
        });
      });

      withSyncBlacklistSecretEnv('   ', () => {
        assert.deepStrictEqual(SyncBlacklistAuth.verify(new Headers()), {
          authorized: true,
          mode: 'disabled',
        });
      });

      withSyncBlacklistSecretEnv('env-secret-value', () => {
        const missingResult = SyncBlacklistAuth.verify(new Headers());
        assert.strictEqual(missingResult.authorized, false);
        assert.strictEqual(missingResult.mode, 'enforced');

        const validResult = SyncBlacklistAuth.verify(
          new Headers({ authorization: 'Bearer env-secret-value' }),
        );
        assert.deepStrictEqual(validResult, {
          authorized: true,
          mode: 'enforced',
        });

        assert.deepStrictEqual(SyncBlacklistAuth.verify(new Headers(), undefined), {
          authorized: true,
          mode: 'disabled',
        });
      });
    });
  });

  describe('enforced mode (fail-closed when SYNC_BLACKLIST_SECRET is set)', () => {
    const expectedSecret = 'super-secret-sync-token-123';

    it('rejects requests with missing headers', () => {
      const result = SyncBlacklistAuth.verify(new Headers(), expectedSecret);
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.mode, 'enforced');
      assert.ok(result.reason && result.reason.length > 0);
    });

    it('rejects non-Bearer Authorization schemes such as Basic', () => {
      const result = SyncBlacklistAuth.verify(
        new Headers({ authorization: 'Basic dXNlcjpwYXNz' }),
        expectedSecret,
      );
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.mode, 'enforced');
    });

    it('rejects malformed Bearer Authorization headers', () => {
      for (const headerValue of [
        'Bearer',
        'Bearer   ',
        'Bearer token extra',
        'Token super-secret-sync-token-123',
      ]) {
        const result = SyncBlacklistAuth.verify(
          new Headers({ authorization: headerValue }),
          expectedSecret,
        );
        assert.strictEqual(
          result.authorized,
          false,
          `Expected malformed Authorization "${headerValue}" to fail closed`,
        );
        assert.strictEqual(result.mode, 'enforced');
      }
    });

    it('rejects wrong Bearer secrets with same and different byte lengths without throwing', () => {
      const sameLengthWrong = 'super-secret-sync-token-999';
      assert.strictEqual(sameLengthWrong.length, expectedSecret.length);

      for (const wrongSecret of [sameLengthWrong, 'short', 'x'.repeat(128)]) {
        const result = SyncBlacklistAuth.verify(
          new Headers({ authorization: `Bearer ${wrongSecret}` }),
          expectedSecret,
        );
        assert.strictEqual(result.authorized, false);
        assert.strictEqual(result.mode, 'enforced');
      }

      assert.strictEqual(SyncBlacklistAuth.timingSafeMatch(expectedSecret, expectedSecret), true);
      assert.strictEqual(SyncBlacklistAuth.timingSafeMatch('abc', 'a'.repeat(64)), false);
      assert.strictEqual(SyncBlacklistAuth.timingSafeMatch('raktas-ąčęė', 'raktas-ąčęė'), true);
      assert.strictEqual(SyncBlacklistAuth.timingSafeMatch('raktas-ąčęė', 'raktas-xxxx'), false);
    });

    it('rejects wrong x-sync-blacklist-secret header values', () => {
      const result = SyncBlacklistAuth.verify(
        new Headers({ [SyncBlacklistAuth.SECRET_HEADER]: 'wrong-secret' }),
        expectedSecret,
      );
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.mode, 'enforced');
    });

    it('fails closed when x-sync-blacklist-secret is blank even if a valid Bearer header is also present', () => {
      const headers = new Headers();
      headers.set(SyncBlacklistAuth.SECRET_HEADER, '');
      headers.set('authorization', `Bearer ${expectedSecret}`);

      const blankResult = SyncBlacklistAuth.verify(headers, expectedSecret);
      assert.strictEqual(blankResult.authorized, false);
      assert.strictEqual(blankResult.mode, 'enforced');

      const whitespaceHeaders = new Headers({
        [SyncBlacklistAuth.SECRET_HEADER]: '   ',
        authorization: `Bearer ${expectedSecret}`,
      });
      const whitespaceResult = SyncBlacklistAuth.verify(whitespaceHeaders, expectedSecret);
      assert.strictEqual(whitespaceResult.authorized, false);
      assert.strictEqual(whitespaceResult.mode, 'enforced');

      const wrongExplicitHeaders = new Headers({
        [SyncBlacklistAuth.SECRET_HEADER]: 'wrong-secret',
        authorization: `Bearer ${expectedSecret}`,
      });
      const wrongExplicitResult = SyncBlacklistAuth.verify(wrongExplicitHeaders, expectedSecret);
      assert.strictEqual(wrongExplicitResult.authorized, false);
      assert.strictEqual(wrongExplicitResult.mode, 'enforced');
    });

    it('authorizes matching Authorization Bearer and case-insensitive bearer headers', () => {
      for (const authHeader of [
        `Bearer ${expectedSecret}`,
        `bearer ${expectedSecret}`,
        `  BEARER   ${expectedSecret}  `,
      ]) {
        const result = SyncBlacklistAuth.verify(
          new Headers({ authorization: authHeader }),
          expectedSecret,
        );
        assert.deepStrictEqual(result, {
          authorized: true,
          mode: 'enforced',
        });
      }
    });

    it('authorizes matching x-sync-blacklist-secret with whitespace trimming on both sides', () => {
      assert.strictEqual(SyncBlacklistAuth.SECRET_HEADER, 'x-sync-blacklist-secret');

      const result = SyncBlacklistAuth.verify(
        new Headers({ [SyncBlacklistAuth.SECRET_HEADER]: `  ${expectedSecret}  ` }),
        `  ${expectedSecret}  `,
      );
      assert.deepStrictEqual(result, {
        authorized: true,
        mode: 'enforced',
      });
    });
  });
});

describe('Node.js runtime & /api/sync-blacklist wiring contract', () => {
  it('locks src/app/api/check/route.ts to runtime = nodejs and force-dynamic without edge', () => {
    const checkRouteSource = readFileSync(
      path.resolve(REPO_ROOT, 'src/app/api/check/route.ts'),
      'utf8',
    );

    assert.match(checkRouteSource, /export\s+const\s+runtime\s*=\s*['"]nodejs['"]\s*;/);
    assert.match(checkRouteSource, /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]\s*;/);
    assert.strictEqual(/runtime\s*=\s*['"]edge['"]/.test(checkRouteSource), false);
  });

  it('locks src/app/api/sync-blacklist/route.ts to nodejs and fails closed with 401 before refresh', () => {
    const syncRouteSource = readFileSync(
      path.resolve(REPO_ROOT, 'src/app/api/sync-blacklist/route.ts'),
      'utf8',
    );

    assert.match(syncRouteSource, /export\s+const\s+runtime\s*=\s*['"]nodejs['"]\s*;/);
    assert.match(syncRouteSource, /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]\s*;/);
    assert.strictEqual(/runtime\s*=\s*['"]edge['"]/.test(syncRouteSource), false);

    assert.match(
      syncRouteSource,
      /import\s*\{[^}]*\bSyncBlacklistAuth\b[^}]*\}\s*from\s*['"]@\/lib\/sync-blacklist-auth['"]\s*;/,
    );

    const authCallIdx = syncRouteSource.indexOf('SyncBlacklistAuth.verify(');
    const refreshCallIdx = syncRouteSource.indexOf('VvtatChecker.refreshFromOfficialSource(');
    assert.notStrictEqual(authCallIdx, -1, 'Expected SyncBlacklistAuth.verify call');
    assert.notStrictEqual(refreshCallIdx, -1, 'Expected VvtatChecker.refreshFromOfficialSource call');
    assert.ok(
      authCallIdx < refreshCallIdx,
      'SyncBlacklistAuth.verify must run before VvtatChecker.refreshFromOfficialSource',
    );

    const preRefreshSegment = syncRouteSource.slice(authCallIdx, refreshCallIdx);
    const unauthorizedGuardMatch = /if\s*\(\s*!auth\.authorized\s*\)\s*\{/.exec(preRefreshSegment);
    assert.ok(
      unauthorizedGuardMatch,
      'Expected if (!auth.authorized) guard before VvtatChecker.refreshFromOfficialSource',
    );

    const guardStartIdx = unauthorizedGuardMatch.index + unauthorizedGuardMatch[0].length - 1;
    let braceDepth = 0;
    let guardEndIdx = -1;
    for (let i = guardStartIdx; i < preRefreshSegment.length; i += 1) {
      if (preRefreshSegment[i] === '{') braceDepth += 1;
      else if (preRefreshSegment[i] === '}') {
        braceDepth -= 1;
        if (braceDepth === 0) {
          guardEndIdx = i;
          break;
        }
      }
    }
    assert.notStrictEqual(guardEndIdx, -1, 'Expected balanced if (!auth.authorized) block');

    const unauthorizedGuardBlock = preRefreshSegment.slice(guardStartIdx, guardEndIdx + 1);
    assert.match(unauthorizedGuardBlock, /\breturn\b[\s\S]*?status:\s*401\b/);
    assert.match(unauthorizedGuardBlock, /['"]Cache-Control['"]\s*:\s*['"]no-store['"]/);
    assert.match(
      unauthorizedGuardBlock,
      /['"]WWW-Authenticate['"]\s*:\s*['"]Bearer\b[^'"]*['"]/,
    );
    assert.strictEqual(syncRouteSource.includes('auth.reason'), false);
    assert.strictEqual(/console\.\w+\([^)]*headers/i.test(syncRouteSource), false);
  });

  it('confirms ssl-checker and security modules import Node.js built-ins', () => {
    const sslCheckerSource = readFileSync(
      path.resolve(REPO_ROOT, 'src/lib/ssl-checker.ts'),
      'utf8',
    );
    const securitySource = readFileSync(path.resolve(REPO_ROOT, 'src/lib/security.ts'), 'utf8');

    assert.match(sslCheckerSource, /from\s+['"]node:tls['"]/);
    assert.match(securitySource, /from\s+['"]node:dns\/promises['"]/);
    assert.match(securitySource, /from\s+['"]node:net['"]/);
  });

  it('confirms next.config.mjs does not enable static output: export', async () => {
    const nextConfigPath = path.resolve(REPO_ROOT, 'next.config.mjs');
    const nextConfigSource = readFileSync(nextConfigPath, 'utf8');
    const nextConfigModule = (await import(
      pathToFileURL(nextConfigPath).href
    )) as NextConfigModuleShape;

    assert.strictEqual(nextConfigModule.default.output, undefined);
    assert.strictEqual(/output\s*:\s*['"]export['"]/.test(nextConfigSource), false);
  });

  it('provides .env.example with empty SYNC_BLACKLIST_SECRET= and no populated secrets', () => {
    const envExamplePath = path.resolve(REPO_ROOT, '.env.example');
    assert.strictEqual(existsSync(envExamplePath), true, 'Expected .env.example to exist');

    const envExampleText = readFileSync(envExamplePath, 'utf8');
    assert.match(envExampleText, /^SYNC_BLACKLIST_SECRET=$/m);
    assert.match(envExampleText, /VERCEL_AUTOMATION_BYPASS_SECRET/);

    const activeAssignments = envExampleText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));

    assert.ok(activeAssignments.includes('SYNC_BLACKLIST_SECRET='));
    assert.ok(
      activeAssignments.every((line) => /^[A-Z][A-Z0-9_]*=$/.test(line)),
      'Expected all active assignments in .env.example to have empty values',
    );
  });
});

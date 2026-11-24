import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FALLBACK_APP_VERSION, formatAppVersion, getAppVersion } from '../app-version.ts';

interface PackageJsonShape {
  name?: string;
  version?: string;
  private?: boolean;
}

interface ReleasePleaseExtraFile {
  type?: string;
  path?: string;
}

interface ReleasePleasePackageConfig {
  'release-type'?: string;
  'initial-version'?: string;
  'bump-minor-pre-major'?: boolean;
  'bump-patch-for-minor-pre-major'?: boolean;
  'include-component-in-tag'?: boolean;
  'include-v-in-tag'?: boolean;
  'extra-files'?: Array<string | ReleasePleaseExtraFile>;
}

interface ReleasePleaseConfigShape {
  $schema?: string;
  packages?: Record<string, ReleasePleasePackageConfig>;
}

interface NextConfigModuleShape {
  default: {
    env?: Record<string, string>;
    output?: string;
  };
}

const GENERIC_VERSION_REGEX =
  /(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(-(?<preRelease>[\w.]+))?(\+(?<build>[-\w.]+))?/;

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

function withAppVersionEnv(value: string | undefined, run: () => void): void {
  const previousValue = process.env.NEXT_PUBLIC_APP_VERSION;

  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
  } else {
    process.env.NEXT_PUBLIC_APP_VERSION = value;
  }

  try {
    run();
  } finally {
    if (previousValue === undefined) {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
    } else {
      process.env.NEXT_PUBLIC_APP_VERSION = previousValue;
    }
  }
}

describe('formatAppVersion', () => {
  it('formats standard semver with a leading v', () => {
    assert.strictEqual(formatAppVersion('0.1.0'), 'v0.1.0');
  });

  it('trims leading and trailing whitespace', () => {
    assert.strictEqual(formatAppVersion('  0.2.3  '), 'v0.2.3');
  });

  it('preserves pre-release identifiers', () => {
    assert.strictEqual(formatAppVersion('0.5.0-rc.1'), 'v0.5.0-rc.1');
  });

  it('deduplicates leading v or V prefixes', () => {
    assert.strictEqual(formatAppVersion('v0.1.0'), 'v0.1.0');
    assert.strictEqual(formatAppVersion('V0.1.0'), 'v0.1.0');
    assert.strictEqual(formatAppVersion('VV1.2.3'), 'v1.2.3');
  });

  it('falls back safely when version is missing, blank, or prefix-only', () => {
    const expectedFallback = `v${FALLBACK_APP_VERSION}`;
    assert.strictEqual(expectedFallback, 'v0.0.0-dev');
    assert.strictEqual(formatAppVersion(undefined), expectedFallback);
    assert.strictEqual(formatAppVersion(''), expectedFallback);
    assert.strictEqual(formatAppVersion('   '), expectedFallback);
    assert.strictEqual(formatAppVersion('v'), expectedFallback);
    assert.strictEqual(formatAppVersion('V'), expectedFallback);
  });
});

describe('getAppVersion', () => {
  it('reads and formats process.env.NEXT_PUBLIC_APP_VERSION when set', () => {
    withAppVersionEnv('0.1.0', () => {
      assert.strictEqual(getAppVersion(), 'v0.1.0');
    });

    withAppVersionEnv(' v0.2.0-beta.1 ', () => {
      assert.strictEqual(getAppVersion(), 'v0.2.0-beta.1');
    });
  });

  it('returns fallback version when process.env.NEXT_PUBLIC_APP_VERSION is unset or blank', () => {
    const expectedFallback = `v${FALLBACK_APP_VERSION}`;

    withAppVersionEnv(undefined, () => {
      assert.strictEqual(getAppVersion(), expectedFallback);
    });

    withAppVersionEnv('', () => {
      assert.strictEqual(getAppVersion(), expectedFallback);
    });

    withAppVersionEnv('   ', () => {
      assert.strictEqual(getAppVersion(), expectedFallback);
    });
  });
});

describe('next.config.mjs build-time contract', () => {
  it('injects NEXT_PUBLIC_APP_VERSION from package.json and preserves Node.js serverless runtime', async () => {
    const pkg = readJsonFile<PackageJsonShape>('package.json');
    const configUrl = pathToFileURL(path.resolve(process.cwd(), 'next.config.mjs')).href;
    const nextConfigModule = (await import(configUrl)) as NextConfigModuleShape;
    const nextConfig = nextConfigModule.default;

    assert.ok(pkg.version);
    assert.strictEqual(nextConfig.env?.NEXT_PUBLIC_APP_VERSION, pkg.version);
    assert.strictEqual(nextConfig.output, undefined);
  });
});

describe('release-please manifest and config parity', () => {
  it('matches package.json version, keeps package private, and enforces Pre-1.0 rules', () => {
    const pkg = readJsonFile<PackageJsonShape>('package.json');
    const manifest = readJsonFile<Record<string, string>>('.release-please-manifest.json');
    const config = readJsonFile<ReleasePleaseConfigShape>('release-please-config.json');
    const rootPackage = config.packages?.['.'];

    assert.strictEqual(pkg.private, true);
    assert.ok(pkg.version);
    assert.strictEqual(manifest['.'], pkg.version);

    assert.ok(config.$schema);
    assert.ok(rootPackage);
    assert.strictEqual(rootPackage['release-type'], 'node');
    assert.strictEqual(rootPackage['initial-version'], '0.1.0');
    assert.strictEqual(rootPackage['bump-minor-pre-major'], true);
    assert.strictEqual(rootPackage['bump-patch-for-minor-pre-major'], true);
    assert.strictEqual(rootPackage['include-component-in-tag'], false);
    assert.strictEqual(rootPackage['include-v-in-tag'], true);

    const hasReadmeExtraFile = rootPackage['extra-files']?.some(
      (entry) => typeof entry === 'object' && entry !== null && entry.type === 'generic' && entry.path === 'README.md',
    );
    assert.strictEqual(hasReadmeExtraFile, true);
  });
});

describe('release-please Generic updater regex safety', () => {
  it('replaces version cleanly inside query-param Shields.io URL without swallowing &color=', () => {
    const pkg = readJsonFile<PackageJsonShape>('package.json');
    assert.ok(pkg.version);

    const badgeLine = `[![Version](https://img.shields.io/static/v1?label=Version&message=v${pkg.version}&color=1d4ed8)](package.json) <!-- x-release-please-version -->`;
    const match = GENERIC_VERSION_REGEX.exec(badgeLine);

    assert.ok(match);
    assert.strictEqual(match[0], pkg.version);
    assert.strictEqual(match.groups?.preRelease, undefined);

    const bumpedMinor = badgeLine.replace(GENERIC_VERSION_REGEX, '0.2.0');
    assert.strictEqual(
      bumpedMinor,
      '[![Version](https://img.shields.io/static/v1?label=Version&message=v0.2.0&color=1d4ed8)](package.json) <!-- x-release-please-version -->',
    );

    const bumpedPatch = badgeLine.replace(GENERIC_VERSION_REGEX, '0.1.1');
    assert.strictEqual(
      bumpedPatch,
      '[![Version](https://img.shields.io/static/v1?label=Version&message=v0.1.1&color=1d4ed8)](package.json) <!-- x-release-please-version -->',
    );
  });

  it('verifies actual README.md version badge survives Generic updater replacement to 0.2.0', () => {
    const pkg = readJsonFile<PackageJsonShape>('package.json');
    assert.ok(pkg.version);

    const readme = readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf8');
    const badgeLine = readme
      .split(/\r?\n/)
      .find((line) => line.includes('x-release-please-version'));

    assert.ok(badgeLine, 'README.md must contain a line with x-release-please-version');
    assert.ok(
      badgeLine.includes(pkg.version),
      `README.md badge line must contain package.json version ${pkg.version}`,
    );

    const match = GENERIC_VERSION_REGEX.exec(badgeLine);
    assert.ok(match);
    assert.strictEqual(match[0], pkg.version);
    assert.strictEqual(match.groups?.preRelease, undefined);

    const bumpedMinor = badgeLine.replace(GENERIC_VERSION_REGEX, '0.2.0');
    assert.ok(bumpedMinor.includes('message=v0.2.0&color=1d4ed8'));
    assert.ok(bumpedMinor.includes('&color=1d4ed8'));
    assert.ok(bumpedMinor.includes('](package.json)'));
    assert.ok(bumpedMinor.includes('<!-- x-release-please-version -->'));
    assert.strictEqual(
      bumpedMinor,
      '[![Version](https://img.shields.io/static/v1?label=Version&message=v0.2.0&color=1d4ed8)](package.json) <!-- x-release-please-version -->',
    );
  });
});

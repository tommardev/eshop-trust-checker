import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface RepositoryMetadata {
  type?: string;
  url?: string;
}

interface PackageJsonMetadata {
  name?: string;
  version?: string;
  private?: boolean;
  license?: string;
  description?: string;
  homepage?: string;
  repository?: RepositoryMetadata;
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const GOVERNANCE_FILES = [
  'LICENSE',
  'COMMERCIAL_LICENSE.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
] as const;

const RAW_EMAIL_PATTERN = /@[a-z0-9.-]+\.[a-z]{2,}/i;
const PLACEHOLDER_MARKER = '[INSERT';

function resolveRepoPath(relativePath: string): string {
  return path.resolve(REPO_ROOT, relativePath);
}

function readRepoText(relativePath: string): string {
  return readFileSync(resolveRepoPath(relativePath), 'utf8');
}

function readRepoJson<T>(relativePath: string): T {
  return JSON.parse(readRepoText(relativePath)) as T;
}

describe('public repository governance and readiness', () => {
  it('root governance files exist', () => {
    for (const file of GOVERNANCE_FILES) {
      assert.strictEqual(
        existsSync(resolveRepoPath(file)),
        true,
        `Expected root governance file ${file} to exist`,
      );
    }
  });

  it('LICENSE contains verbatim GNU AGPL-3.0', () => {
    const licenseText = readRepoText('LICENSE');

    assert.ok(
      licenseText.trimStart().startsWith('GNU AFFERO GENERAL PUBLIC LICENSE'),
      'LICENSE must start with GNU AFFERO GENERAL PUBLIC LICENSE',
    );
    assert.ok(
      licenseText.includes('Version 3, 19 November 2007'),
      'LICENSE must include AGPL-3.0 version header',
    );
    assert.ok(
      licenseText.includes('END OF TERMS AND CONDITIONS'),
      'LICENSE must include END OF TERMS AND CONDITIONS marker',
    );
    assert.ok(
      licenseText.length >= 30_000,
      `LICENSE length (${licenseText.length}) must be at least 30,000 characters`,
    );

    // Custom dual-license or pricing clauses in LICENSE break GitHub Licensee SPDX detection.
    assert.strictEqual(
      licenseText.includes('COMMERCIAL_LICENSE.md'),
      false,
      'LICENSE must not reference COMMERCIAL_LICENSE.md',
    );
    assert.strictEqual(
      /dual[- ]license/i.test(licenseText),
      false,
      'LICENSE must not embed dual-license clauses',
    );
    assert.strictEqual(
      /commercial license/i.test(licenseText),
      false,
      'LICENSE must not embed commercial licensing terms',
    );
    assert.strictEqual(
      /revenue[- ]share/i.test(licenseText),
      false,
      'LICENSE must not embed revenue-share terms',
    );
    assert.strictEqual(
      /flat (annual|perpetual )?fee/i.test(licenseText),
      false,
      'LICENSE must not embed flat-fee pricing terms',
    );
  });

  it('governance files maintain privacy hygiene and required policy sections', () => {
    const markdownPolicyFiles = [
      'COMMERCIAL_LICENSE.md',
      'SECURITY.md',
      'CODE_OF_CONDUCT.md',
      'CONTRIBUTING.md',
    ] as const;

    for (const file of markdownPolicyFiles) {
      const content = readRepoText(file);
      assert.strictEqual(
        RAW_EMAIL_PATTERN.test(content),
        false,
        `${file} must not expose raw private email addresses`,
      );
      assert.strictEqual(
        content.includes(PLACEHOLDER_MARKER),
        false,
        `${file} must not contain leftover ${PLACEHOLDER_MARKER} template placeholders`,
      );
    }

    const commercialLicense = readRepoText('COMMERCIAL_LICENSE.md');
    assert.ok(commercialLicense.includes('AGPL-3.0'));
    assert.ok(commercialLicense.includes('https://github.com/tommardev'));

    const securityPolicy = readRepoText('SECURITY.md');
    assert.ok(securityPolicy.includes('security/advisories/new'));
    assert.ok(securityPolicy.includes('SSRF'));
    assert.ok(securityPolicy.includes('Supported Versions'));

    const codeOfConduct = readRepoText('CODE_OF_CONDUCT.md');
    assert.ok(codeOfConduct.includes('Contributor Covenant'));
    assert.ok(codeOfConduct.includes('2.1'));

    const contributing = readRepoText('CONTRIBUTING.md');
    const requiredContributingTokens = [
      '22.18',
      'Conventional Commits',
      'npm test',
      'npx tsc --noEmit --incremental false',
      'npm run lint',
      'npm run build',
    ] as const;

    for (const token of requiredContributingTokens) {
      assert.ok(
        contributing.includes(token),
        `CONTRIBUTING.md must document "${token}"`,
      );
    }
  });

  it('package.json contains public-readiness metadata while staying private', () => {
    const pkg = readRepoJson<PackageJsonMetadata>('package.json');

    assert.strictEqual(pkg.private, true);
    assert.strictEqual(pkg.license, 'AGPL-3.0-only');
    assert.strictEqual(pkg.homepage, 'https://eshop-trust-checker.vercel.app');
    assert.strictEqual(pkg.repository?.type, 'git');
    assert.strictEqual(
      pkg.repository?.url,
      'git+https://github.com/tommardev/eshop-trust-checker.git',
    );
  });

  it('README.md includes governance pointers and Phase-A badges without premature workflow badges', () => {
    const readme = readRepoText('README.md');

    const expectedGovernanceTargets = [
      '(LICENSE)',
      '(COMMERCIAL_LICENSE.md)',
      '(SECURITY.md)',
      '(CONTRIBUTING.md)',
      '(CODE_OF_CONDUCT.md)',
    ] as const;

    for (const target of expectedGovernanceTargets) {
      assert.ok(
        readme.includes(target),
        `README.md must link to ${target}`,
      );
    }

    assert.ok(readme.includes('[![License:'), 'README.md must include License badge');
    assert.ok(
      readme.includes('[![GitHub Issues](https://img.shields.io/github/issues/tommardev/eshop-trust-checker)]'),
      'README.md must include GitHub Issues badge',
    );
    assert.ok(
      readme.includes('[![Last Commit](https://img.shields.io/github/last-commit/tommardev/eshop-trust-checker)]'),
      'README.md must include Last Commit badge',
    );
    assert.ok(
      readme.includes('<!-- x-release-please-version -->'),
      'README.md must preserve x-release-please-version marker',
    );

    const prematureWorkflowBadges = [
      'workflows/ci.yml',
      'workflows/codeql.yml',
      'workflows/security.yml',
    ] as const;

    for (const workflowPath of prematureWorkflowBadges) {
      assert.strictEqual(
        readme.includes(workflowPath),
        false,
        `README.md must not include premature workflow badge for ${workflowPath}`,
      );
    }
  });
});

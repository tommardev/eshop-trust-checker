# Feature: Pre-1.0 (`0.MINOR.PATCH`) `release-please` Automation, UI/README Version Sync, and Agent Versioning Conventions

The following plan should be complete, but it is important that you validate documentation, codebase patterns, and task sanity before you start implementing.

Pay special attention to exact filenames, JSON schemas, GitHub Actions 40-char SHA pinning, Next.js build-time `env` inlining, and `release-please` Generic updater regex behavior. Keep edits surgical and strictly scoped to Issue `#33`.

## Feature Description

Establish slow, controlled **Pre-1.0 (`0.MINOR.PATCH`)** versioning and wave-based release automation for `eshop-trust-checker` using `release-please` without blocking the Single-Active-PR autonomous sidecars. Synchronize the canonical `package.json` version to the Next.js UI footer and `README.md` at build/release time, clarify `docs/PRD.md` document revision vs application SemVer, and codify strict agent commit and versioning guardrails.

Specifically:

1. **Manifest-Driven `release-please` Configuration**: Add `.release-please-manifest.json` (`{ ".": "0.1.0" }`) and `release-please-config.json` configured for root Node package `"."` with Pre-1.0 shifted SemVer (`bump-minor-pre-major: true`, `bump-patch-for-minor-pre-major: true`), clean `v0.X.Y` tags (`include-component-in-tag: false`, `include-v-in-tag: true`), and `extra-files` targeting `README.md`.
2. **Wave-Controlled GitHub Actions Workflow**: Add `.github/workflows/release-please.yml` triggered on `push` (`branches: [main]`) and `workflow_dispatch`, passing `skip-github-pull-request: ${{ github.event_name == 'push' }}` to SHA-pinned `googleapis/release-please-action` (`v5.0.0`) so normal pushes to `main` never open standing Release PRs that deadlock Core 1a sidecars, while merging a manually dispatched Release PR automatically cuts the git tag and GitHub Release.
3. **Build-Time `NEXT_PUBLIC_APP_VERSION` & Footer Display**: Create `next.config.mjs` (preserving default Node.js serverless runtime) reading `version` from `./package.json` and exposing `env: { NEXT_PUBLIC_APP_VERSION: pkg.version }`. Add a typed helper `src/lib/app-version.ts`, display the formatted version subtly in `src/components/Footer.tsx`, and add deterministic offline unit tests in `src/lib/__tests__/version.test.ts`.
4. **`README.md` Version Badge & `docs/PRD.md` Header Clarification**: Add an auto-updated Shields.io version badge in `README.md` using query-param syntax + `<!-- x-release-please-version -->` (avoiding `-color` pre-release regex collision) and clarify line 4 of `docs/PRD.md` as the PRD document revision without altering specification content.
5. **Agent Versioning Guardrails & Automation Docs**: Codify no-manual-version-bump rules and Pre-1.0 Conventional Commit impact across `AGENTS.md`, `docs/agents/conventions.md`, `.agents/commands/commit.md`, and `docs/AUTOMATION_WORKFLOW.md`.

## User Story

As a maintainer and autonomous delivery pipeline for `eshop-trust-checker`
I want Pre-1.0 (`0.MINOR.PATCH`) wave-controlled release automation, build-time UI/README version synchronization, and clear agent versioning guardrails
So that version bumps, changelogs, git tags, and UI version labels stay synchronized from a single canonical source (`package.json`) without creating standing Release PRs that halt autonomous issue sidecars.

## Problem Statement

1. **No Automated Release / Changelog Pipeline**: `package.json` sits at `"version": "0.1.0"` with no manifest, no changelog automation, and no repeatable process for cutting patch releases (`0.1.x`) or planned wave milestones (`0.2.0`–`0.5.0`).
2. **Sidecar Deadlock Risk with Default `release-please`**: Standard `release-please` workflows open and maintain a standing Release PR on every `push` to `main`. Because `docs/AUTOMATION_WORKFLOW.md` Core 1a halts both Planner and Implementer sidecars whenever `gh pr list --state open` is non-empty, a default `release-please` setup would permanently block autonomous issue processing.
3. **No Build-Time UI or README Version Sync**: The repo currently has no `next.config.*` file, `src/components/Footer.tsx` renders no application version, and `process.env.npm_package_version` is `undefined` at runtime on Vercel and in client bundles (`src/app/page.tsx` is a `'use client'` component). `README.md` also lacks a version badge synchronized with `package.json`.
4. **PRD Version Confusion & Missing Agent Guardrails**: `docs/PRD.md` line 4 reads `**Versija**: 1.0.0 (MVP)`, which can be confused with application SemVer (`0.1.0`), and neither `AGENTS.md`, `docs/agents/conventions.md`, nor `.agents/commands/commit.md` currently prohibits agents from manually editing `"version"`/`CHANGELOG.md` or accidentally triggering Pre-1.0 minor bumps via `!` / `BREAKING CHANGE:`.

## Solution Statement

1. **Pre-1.0 Manifest Config**: Initialize `.release-please-manifest.json` to `{ ".": "0.1.0" }` and `release-please-config.json` with `"release-type": "node"`, `"initial-version": "0.1.0"`, `"bump-minor-pre-major": true`, `"bump-patch-for-minor-pre-major": true`, `"include-component-in-tag": false`, `"include-v-in-tag": true`, and `"extra-files": [{ "type": "generic", "path": "README.md" }]`.
2. **Wave-Controlled Workflow**: Add `.github/workflows/release-please.yml` pinned to `googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0`, with `timeout-minutes: 5`, `concurrency: { group: release-please-main, cancel-in-progress: false }`, top-level `permissions: {}`, job-level `permissions: { contents: write, pull-requests: write, issues: write }`, and `skip-github-pull-request: ${{ github.event_name == 'push' }}`.
3. **Safe Build-Time Injection & UI Helper**: Add `next.config.mjs` using `readFileSync(new URL('./package.json', import.meta.url), 'utf8')` to expose `env: { NEXT_PUBLIC_APP_VERSION: pkg.version }` while keeping default Node.js serverless runtime. Add `src/lib/app-version.ts` accessing `process.env.NEXT_PUBLIC_APP_VERSION` via static dot notation (required for Next.js client bundle inlining) and render it in `src/components/Footer.tsx`.
4. **Collision-Safe README Badge & Surgical PRD Line Edit**: Add a Shields.io static query-parameter badge (`https://img.shields.io/static/v1?label=Version&message=v0.1.0&color=1d4ed8`) annotated with `<!-- x-release-please-version -->` in `README.md` so `release-please`'s `Generic` updater regex (`\d+\.\d+\.\d+(-[\w.]+)?`) never swallows `-color` as a SemVer pre-release suffix. Clarify line 4 of `docs/PRD.md` only.
5. **Governance & Offline Unit Tests**: Update `AGENTS.md`, `docs/agents/conventions.md`, `.agents/commands/commit.md`, and `docs/AUTOMATION_WORKFLOW.md` (documenting `Release-As: 0.X.0` wave-bump commits, GitHub Actions PR creation setting, and `#32` Ruleset `GITHUB_TOKEN` interaction). Add `src/lib/__tests__/version.test.ts` validating helper formatting, fallback behavior, `next.config.mjs` runtime/env contract, manifest parity, and `README.md` generic-updater compatibility 100% offline.

## Out of Scope / Non-Goals

- Not included: Publishing any package to the npm registry (`"private": true` in `package.json` remains permanent).
- Not included: Modifying external local Antigravity sidecar JSON configs (`~/.gemini/config/sidecars/...`) outside this repository.
- Not included: Promoting the application version to `1.0.0` or automatically bumping `package.json` from `0.1.0` in this PR (version stays `0.1.0`).
- Not included: Adding any new npm dependencies or modifying `package-lock.json`.
- Not included: Changing `AuditEngine` scoring weights, checker logic, or API response schemas.
- Not included: Creating `.github/workflows/ci.yml` (`#14`), `LICENSE`/`SECURITY.md` (`#31`), or CodeQL/`main` Ruleset (`#32`).

## Feature Metadata

**Feature Type**: Enhancement / Release & Governance  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: Release automation (`.release-please-manifest.json`, `release-please-config.json`, `.github/workflows/release-please.yml`), Next.js config & UI (`next.config.mjs`, `src/lib/app-version.ts`, `src/components/Footer.tsx`), Unit tests (`src/lib/__tests__/version.test.ts`), Documentation & Agent Rules (`README.md`, `docs/PRD.md`, `docs/AUTOMATION_WORKFLOW.md`, `AGENTS.md`, `docs/agents/conventions.md`, `.agents/commands/commit.md`)  
**Dependencies**: Zero new npm dependencies; `googleapis/release-please-action` (`v5.0.0`, SHA `45996ed1f6d02564a971a2fa1b5860e934307cf7`) runs strictly in GitHub Actions on `ubuntu-latest` (`node24`).

## Related Work

**Implements**: [Issue #33](https://github.com/tommardev/eshop-trust-checker/issues/33)  
**Epic**: Release governance & Pre-1.0 versioning wave strategy coordinated with `docs/decisions/002-public-repository-readiness-and-governance.md` and `docs/AUTOMATION_WORKFLOW.md`

**Back-references**:
- `.agents/plans/issue-13-ci-prep-node-runtime-test-discovery-and-docs.md` - Why: Established `"engines": { "node": ">=22.18.0" }`, cross-platform multi-file `npm test` glob discovery (`"src/**/*.test.ts"`), and the canonical 4-command validation suite.
- `docs/decisions/002-public-repository-readiness-and-governance.md` - Why: Defines the tiered README badge rollout plan while repo transitions from `PRIVATE` to `PUBLIC`.
- `docs/AUTOMATION_WORKFLOW.md` - Why: Defines Core 1a Single-Active-PR guard (`gh pr list --state open`) that release automation must never deadlock.

**Forward-references**:
- Issue `#14` (`.github/workflows/ci.yml` — shares `.github/workflows/` directory, zero file overlap)
- Issue `#16` (Conventional PR Title check — `release-please` default `chore(main): release 0.X.Y` already conforms)
- Issue `#31` (Public repo legal/community files and License/Issues/Last Commit badges in `README.md`)
- Issue `#32` (CodeQL, Secret Scanning, `main` Branch Ruleset — `GITHUB_TOKEN`-authored Release PR check interaction documented here)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `package.json` (lines 1–39) - Why: Canonical `"version": "0.1.0"` (line 3), `"private": true` (line 4), `"scripts.test"` (line 14), and Next.js `^15.5.29` (line 20). Do NOT bump `"version"` or add dependencies.
- `tsconfig.json` (lines 1–29) - Why: Confirms `"strict": true` (line 7), `"allowImportingTsExtensions": true` (line 17), `"paths": { "@/*": ["./src/*"] }` (line 24), and `"include"` scope (line 27).
- `src/app/page.tsx` (lines 1–12, 180–190) - Why: Confirms `Home` is a `'use client'` component rendering `<Footer />` (line 187), so `Footer.tsx` runs in the client bundle and requires static build-time `process.env.NEXT_PUBLIC_APP_VERSION` inlining.
- `src/components/Footer.tsx` (lines 1–75) - Why: Target component for subtle version display alongside the copyright line (lines 69–71).
- `src/lib/__tests__/checkers.test.ts` (lines 1–40) - Why: Canonical `node:test` + `node:assert/strict` test style and `.ts` relative import convention.
- `README.md` (lines 1–12) - Why: Existing Shields.io badge block (lines 3–7) where the auto-updated Version badge is added.
- `docs/PRD.md` (lines 1–8) - Why: Exact line 4 (`**Versija**: 1.0.0 (MVP)`) to clarify surgically without altering specification content.
- `AGENTS.md` (lines 74–92) - Why: `## Boundaries` (`Never:` line 78) and `## Git / PRs` (lines 86–91) where agent versioning rules belong.
- `docs/agents/conventions.md` (lines 1–41) - Why: Existing `repo:` / `golden:` bullet conventions; append `## Versioning and Releases` after `## Public Surfaces` (line 41).
- `docs/agents/security.md` (lines 36–42) - Why: `## CI/CD Workflow Hardening (GitHub Actions)` — 40-char SHA pinning, least-privilege permissions, explicit `timeout-minutes`, no `pull_request_target`.
- `docs/agents/ui-ux.md` (lines 9–34) - Why: Tailwind slate/white styling and WCAG 2.2 AA contrast (`>= 4.5:1`) and semantic HTML requirements for `Footer.tsx`.
- `docs/agents/testing.md` (lines 9–44) - Why: Test placement (`*.test.ts`), offline mocking golden rules, and 4 validation commands.
- `docs/AUTOMATION_WORKFLOW.md` (lines 40–51, 137–156) - Why: Core 1a Single-Active-PR guard (line 46) and Section 5 `## 5. Operations & Troubleshooting` (line 151) where `### Release Automation Coexistence (release-please)` fits.
- `.agents/commands/commit.md` (lines 31–84) - Why: Conventional Commit tag list (lines 35–41) and `Context:` block requirement (lines 62–84) when `AGENTS.md` / `docs/` / `.agents/` files change.
- `docs/decisions/002-public-repository-readiness-and-governance.md` (lines 52–56) - Why: README badge coordination plan across private/public rollout phases.

### New Files to Create

- `.release-please-manifest.json` - Tracks canonical released version (`{ ".": "0.1.0" }`).
- `release-please-config.json` - Manifest configuration for Pre-1.0 Node versioning, clean `v` tags, and `README.md` generic updater.
- `.github/workflows/release-please.yml` - Wave-controlled SHA-pinned GitHub Actions workflow (`push` to `main` skips PRs; `workflow_dispatch` opens/updates consolidated Release PR).
- `next.config.mjs` - Next.js 15 ESM config injecting `NEXT_PUBLIC_APP_VERSION` from `package.json` at build time while preserving default Node.js serverless runtime.
- `src/lib/app-version.ts` - Typed `formatAppVersion()` and `getAppVersion()` helpers with safe fallback.
- `src/lib/__tests__/version.test.ts` - Deterministic offline unit tests verifying version formatting, env fallback, `next.config.mjs` contract, manifest/config parity, and `README.md` generic-updater regex safety.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [googleapis/release-please-action `action.yml` (`v5.0.0`)](https://github.com/googleapis/release-please-action/blob/v5.0.0/action.yml)
  - Specific section: `inputs.skip-github-pull-request`, `inputs.skip-github-release`, `runs.using: node24`
  - Why: Confirms `v5.0.0` (verified commit SHA `45996ed1f6d02564a971a2fa1b5860e934307cf7`) runs on `node24` and supports `skip-github-pull-request: ${{ github.event_name == 'push' }}` in manifest mode (default when `release-type` input is omitted).
- [googleapis/release-please Manifest Schema](https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json)
  - Specific section: `definitions.ReleaserConfigOptions`
  - Why: Confirms exact schema keys (`release-type`, `initial-version`, `bump-minor-pre-major`, `bump-patch-for-minor-pre-major`, `include-component-in-tag`, `include-v-in-tag`, `extra-files`).
- [googleapis/release-please Generic Updater (`src/updaters/generic.ts`)](https://raw.githubusercontent.com/googleapis/release-please/main/src/updaters/generic.ts)
  - Specific section: `VERSION_REGEX` and `INLINE_UPDATE_REGEX`
  - Why: Proves `VERSION_REGEX` includes optional `-(?<preRelease>[\w.]+)`. A path-style Shields.io URL (`.../Version-v0.1.0-1d4ed8`) causes `-1d4ed8` to be parsed as a pre-release suffix and deleted on bump; query-parameter syntax (`https://img.shields.io/static/v1?label=Version&message=v0.1.0&color=1d4ed8`) prevents this bug completely.

### Patterns to Follow

**`release-please-config.json` Pattern:**
```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "initial-version": "0.1.0",
      "bump-minor-pre-major": true,
      "bump-patch-for-minor-pre-major": true,
      "include-component-in-tag": false,
      "include-v-in-tag": true,
      "extra-files": [
        {
          "type": "generic",
          "path": "README.md"
        }
      ]
    }
  }
}
```

**`next.config.mjs` Build-Time Version Injection Pattern:**
```js
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
```
Why `readFileSync(new URL('./package.json', import.meta.url), 'utf8')`: avoids JSON import-attribute syntax (`with { type: 'json' }` vs legacy `assert`) across Node 22/24, Next.js 15 config loaders, and `node --test`.

**Static Env Access Pattern (`src/lib/app-version.ts`):**
Always read `process.env.NEXT_PUBLIC_APP_VERSION` directly (never `process.env[key]` or object destructuring) so Next.js/Webpack statically replaces the reference in client bundles at build time while still allowing `node --test` to mutate `process.env.NEXT_PUBLIC_APP_VERSION` cleanly in unit tests.

**Collision-Safe `README.md` Version Badge Pattern:**
```markdown
[![Version](https://img.shields.io/static/v1?label=Version&message=v0.1.0&color=1d4ed8)](package.json) <!-- x-release-please-version -->
```
Why:
- Works immediately while the repository is `PRIVATE` and continues working after flipping to `PUBLIC`.
- `message=v0.1.0&color=1d4ed8` terminates the SemVer token with `&` (not `-`), so `release-please` replaces only `0.1.0` and preserves `&color=1d4ed8`.

---

## IMPLEMENTATION PLAN

### Phase 1: `release-please` Manifest & Wave-Controlled Workflow

Create the Pre-1.0 manifest, config, and SHA-pinned GitHub Actions workflow so releases run on demand via `workflow_dispatch` without creating standing Release PRs on normal `main` pushes.

**Tasks:**
- Create `.release-please-manifest.json` initialized to `{ ".": "0.1.0" }`.
- Create `release-please-config.json` with Pre-1.0 rules and `README.md` generic updater.
- Create `.github/workflows/release-please.yml` hardened per `docs/agents/security.md`.

### Phase 2: Build-Time `NEXT_PUBLIC_APP_VERSION`, UI Footer & Offline Unit Tests

**Independent of:** Phase 1 (except unit test parity checks that verify `.release-please-manifest.json`, `release-please-config.json`, and `README.md` alongside `next.config.mjs`).

Wire `package.json`'s `version` into Next.js at build time, expose it through a typed helper, display it subtly in `Footer.tsx`, and add deterministic offline unit tests.

**Tasks:**
- Create `next.config.mjs` exposing `env: { NEXT_PUBLIC_APP_VERSION: pkg.version }`.
- Create `src/lib/app-version.ts` with `FALLBACK_APP_VERSION`, `formatAppVersion()`, and `getAppVersion()`.
- Update `src/components/Footer.tsx` to display the formatted version subtly alongside the copyright notice with WCAG 2.2 AA contrast and Lithuanian `aria-label`.
- Create `src/lib/__tests__/version.test.ts` testing formatting, fallbacks, `next.config.mjs` contract, manifest/config sync, and `README.md` generic-updater regex safety.

### Phase 3: `README.md` Badge, `docs/PRD.md` Header, & Agent Governance Docs

**Depends on:** Phase 1 & Phase 2 (so documented paths, workflow settings, and badge syntax match the committed files exactly).

Synchronize human and agent documentation with the Pre-1.0 versioning rules and sidecar coexistence procedures.

**Tasks:**
- Add the Shields.io Version badge with `<!-- x-release-please-version -->` to `README.md`.
- Surgically clarify line 4 of `docs/PRD.md` as the PRD document revision.
- Update `AGENTS.md`, `docs/agents/conventions.md`, `.agents/commands/commit.md`, and `docs/AUTOMATION_WORKFLOW.md`.
- Run the full 4-command validation suite (`npx tsc --noEmit --incremental false`, `npm run lint`, `npm test`, `npm run build`).

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently verifiable.

### 1. CREATE `.release-please-manifest.json`

- **IMPLEMENT**:
  - Create `.release-please-manifest.json` at repository root with exact content:
    ```json
    {
      ".": "0.1.0"
    }
    ```
- **PATTERN**: Standard `release-please` manifest format (`https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md`), 2-space JSON indentation matching `package.json`.
- **IMPORTS**: None.
- **GOTCHA**: Value MUST match `package.json` `"version"` (`"0.1.0"`) verbatim; do NOT add a leading `v` in `.release-please-manifest.json`.
- **VALIDATE**: `node -e "const m=require('./.release-please-manifest.json'), p=require('./package.json'); if (m['.']!==p.version) process.exit(1); console.log('manifest ok:', m['.']);"`
- **SATISFIES**: AC #1

### 2. CREATE `release-please-config.json`

- **IMPLEMENT**:
  - Create `release-please-config.json` at repository root with exact content:
    ```json
    {
      "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
      "packages": {
        ".": {
          "release-type": "node",
          "initial-version": "0.1.0",
          "bump-minor-pre-major": true,
          "bump-patch-for-minor-pre-major": true,
          "include-component-in-tag": false,
          "include-v-in-tag": true,
          "extra-files": [
            {
              "type": "generic",
              "path": "README.md"
            }
          ]
        }
      }
    }
    ```
- **PATTERN**: Official `release-please` schema (`https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json`).
- **IMPORTS**: None.
- **GOTCHA**:
  - Do NOT set `"release-as"` in `release-please-config.json` (deprecated and sticky across runs); deliberate wave bumps (`0.2.0`, `0.5.0`) use `Release-As: 0.X.0` commit footers on `main`.
  - Keep `"include-component-in-tag": false` and `"include-v-in-tag": true` so tags are `v0.1.1` / `v0.2.0` instead of `eshop-trust-checker-v0.2.0`.
- **VALIDATE**: `node -e 'const c=require("./release-please-config.json"); const r=c.packages["."]; if (!c["$schema"] || r["release-type"]!=="node" || r["initial-version"]!=="0.1.0" || !r["bump-minor-pre-major"] || !r["bump-patch-for-minor-pre-major"] || r["include-component-in-tag"]!==false || r["include-v-in-tag"]!==true) process.exit(1); console.log("config ok");'`
- **SATISFIES**: AC #1, AC #4 (partial)

### 3. CREATE `.github/workflows/release-please.yml`

- **IMPLEMENT**:
  - Create `.github/workflows/release-please.yml` (creating `.github/workflows/` directory if absent):
    ```yaml
    # Wave-controlled Pre-1.0 release automation (docs/AUTOMATION_WORKFLOW.md).
    # - On push to main: skips opening Release PRs (zero standing PRs blocking Core 1a sidecars),
    #   but still runs manifest.createReleases() when a merged Release PR is pushed.
    # - On workflow_dispatch: opens or updates the consolidated Release PR on demand.
    # - For planned minor waves (e.g. 0.2.0): push an empty commit on main with footer
    #   "Release-As: 0.2.0" before triggering workflow_dispatch.
    name: Release Please

    on:
      push:
        branches:
          - main
      workflow_dispatch: {}

    concurrency:
      group: release-please-main
      cancel-in-progress: false

    permissions: {}

    jobs:
      release-please:
        name: Release Please
        runs-on: ubuntu-latest
        timeout-minutes: 5
        permissions:
          contents: write
          pull-requests: write
          issues: write
        steps:
          - name: Run release-please
            id: release
            uses: googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0
            with:
              skip-github-pull-request: ${{ github.event_name == 'push' }}
    ```
- **PATTERN**: `docs/agents/security.md` (lines 36–42) — 40-char SHA pinning with `# vX.Y.Z` comment, least-privilege permissions, explicit `timeout-minutes: 5`, no `pull_request_target`.
- **IMPORTS**: None.
- **GOTCHA**:
  - Do NOT pass `release-type` to `release-please-action` (passing `release-type` disables manifest mode and ignores `release-please-config.json`).
  - Do NOT pass `release-as` action input in `workflow_dispatch` inputs (`release-please-action` ignores `release-as` in manifest mode).
  - Do NOT add `actions/checkout` (unnecessary; `release-please-action` operates via GitHub API).
  - Do NOT set `cancel-in-progress: true` on `main` concurrency group (would risk interrupting tag/GitHub Release publication after a Release PR merge).
- **VALIDATE**: `node -e 'const fs=require("node:fs"); const y=fs.readFileSync(".github/workflows/release-please.yml","utf8"); for (const req of ["45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0","timeout-minutes: 5","cancel-in-progress: false","skip-github-pull-request:","github.event_name","contents: write","pull-requests: write","issues: write"]) { if (!y.includes(req)) { console.error("Missing:", req); process.exit(1); } } console.log("workflow ok");'`
- **SATISFIES**: AC #2

### 4. CREATE `next.config.mjs`

- **IMPLEMENT**:
  - Create `next.config.mjs` at repository root:
    ```js
    import { readFileSync } from 'node:fs';

    const pkg = JSON.parse(
      readFileSync(new URL('./package.json', import.meta.url), 'utf8')
    );

    /** @type {import('next').NextConfig} */
    const nextConfig = {
      env: {
        NEXT_PUBLIC_APP_VERSION: pkg.version,
      },
    };

    export default nextConfig;
    ```
- **PATTERN**: Standard Next.js 15 ESM config (`next.config.mjs`) with default Node.js serverless runtime.
- **IMPORTS**: `readFileSync` from `node:fs`.
- **GOTCHA**:
  - NEVER set `output: 'export'` or Edge runtime options — breaks `force-dynamic` API routes and `node:tls` / `node:dns/promises` / `node:net` checkers.
  - Keep `package.json` `"private": true` and `"version": "0.1.0"` untouched.
- **VALIDATE**: `node --input-type=module -e "import cfg from './next.config.mjs'; if (cfg.env?.NEXT_PUBLIC_APP_VERSION !== '0.1.0' || cfg.output) process.exit(1); console.log('next.config ok:', cfg.env.NEXT_PUBLIC_APP_VERSION);"`
- **SATISFIES**: AC #3 (partial)

### 5. CREATE `src/lib/app-version.ts`

- **IMPLEMENT**:
  - Create `src/lib/app-version.ts`:
    ```ts
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
    ```
- **PATTERN**: Strict TypeScript module in `src/lib/` (`tsconfig.json:7`), pure helper functions with explicit return types.
- **IMPORTS**: None.
- **GOTCHA**:
  - Access `process.env.NEXT_PUBLIC_APP_VERSION` with literal dot notation (never `process.env['NEXT_PUBLIC_APP_VERSION']` or destructuring) so Next.js statically replaces it in client bundles.
  - Never read `process.env.npm_package_version` (undefined at runtime on Vercel and in browser bundles).
- **VALIDATE**: `npx tsc --noEmit --incremental false`
- **SATISFIES**: AC #3 (partial)

### 6. UPDATE `src/components/Footer.tsx`

- **IMPLEMENT**:
  - Import `{ getAppVersion } from '@/lib/app-version'` at the top of `src/components/Footer.tsx` (after line 2).
  - Inside `Footer`, compute `const appVersion = getAppVersion();`.
  - Update lines 69–71 to render the version subtly alongside the copyright notice:
    ```tsx
        <div className="mt-8 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} E-Shop Trust Checker ·{' '}
          <span className="font-mono" aria-label={`Programos versija ${appVersion}`}>
            {appVersion}
          </span>
          . Parengta pagal LR teisės aktus ir VVTAT gaires.
        </div>
    ```
- **PATTERN**: `src/components/Footer.tsx` (lines 1–75), `src/app/page.tsx` (`@/` import alias at lines 4–10), `docs/agents/ui-ux.md` (lines 27–34 — WCAG 2.2 AA contrast `text-slate-500` on `bg-white` = 4.76:1 >= 4.5:1, semantic HTML, Lithuanian UI labels).
- **IMPORTS**: `import { getAppVersion } from '@/lib/app-version';`
- **GOTCHA**:
  - `Footer` is rendered inside `'use client'` `src/app/page.tsx` (line 187), so do NOT import `node:fs` or `package.json` directly into `Footer.tsx`; use `getAppVersion()`.
  - Keep the rest of `Footer.tsx` untouched.
- **VALIDATE**: `npx tsc --noEmit --incremental false` and `npm run lint`
- **SATISFIES**: AC #3 (partial)

### 7. UPDATE `README.md`

- **IMPLEMENT**:
  - Add a Shields.io Version badge at line 3 (or line 4 right after `Live App`) in the top badge block of `README.md`:
    ```markdown
    [![Version](https://img.shields.io/static/v1?label=Version&message=v0.1.0&color=1d4ed8)](package.json) <!-- x-release-please-version -->
    ```
- **PATTERN**: Existing Shields.io badge block in `README.md` (lines 3–7); coordinates with `docs/decisions/002-public-repository-readiness-and-governance.md` (lines 52–56) and `#31` (which adds `License`, `GitHub Issues`, and `Last Commit` badges later).
- **IMPORTS**: None.
- **GOTCHA**:
  - **CRITICAL**: Do NOT use path-style Shields.io syntax (`https://img.shields.io/badge/Version-v0.1.0-1d4ed8`)! `release-please`'s `Generic` updater uses `/(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(-(?<preRelease>[\w.]+))?(\+(?<build>[-\w.]+))?/` — a trailing `-1d4ed8` or `-blue` matches `preRelease` and gets stripped on the first release bump, breaking the badge URL! Using `/static/v1?label=Version&message=v0.1.0&color=1d4ed8` terminates the version with `&` and guarantees clean replacements.
  - Link to `package.json` (works in both `PRIVATE` and `PUBLIC` repos before any GitHub Release tag exists).
  - Do not alter unrelated `README.md` sections or the `AGENTS.md` warning at line 98.
- **VALIDATE**: Covered by offline unit test in Task 8 (`src/lib/__tests__/version.test.ts`).
- **SATISFIES**: AC #4 (partial)

### 8. CREATE `src/lib/__tests__/version.test.ts`

- **IMPLEMENT**:
  - Create `src/lib/__tests__/version.test.ts` using `node:test` and `node:assert/strict` (100% offline — zero network/DNS/TLS/HTTP calls) covering:
    1. `formatAppVersion()`:
       - Standard semver (`'0.1.0'` → `'v0.1.0'`), whitespace trimming (`' 0.2.3 '` → `'v0.2.3'`), pre-release (`'0.5.0-rc.1'` → `'v0.5.0-rc.1'`).
       - Deduplicates leading `v`/`V` (`'v0.1.0'` → `'v0.1.0'`, `'VV1.2.3'` → `'v1.2.3'`).
       - Safe fallback to `v${FALLBACK_APP_VERSION}` (`'v0.0.0-dev'`) for `undefined`, `''`, `'   '`, and `'v'`.
    2. `getAppVersion()`:
       - Reads `process.env.NEXT_PUBLIC_APP_VERSION` when set and formats it (save/restore original `process.env.NEXT_PUBLIC_APP_VERSION` in `try...finally` or `beforeEach`/`afterEach`).
       - Returns `v${FALLBACK_APP_VERSION}` when `NEXT_PUBLIC_APP_VERSION` is unset or blank.
    3. Build-time config & release manifest contract:
       - Loads `next.config.mjs` via `await import(pathToFileURL(path.resolve(process.cwd(), 'next.config.mjs')).href)` (typed via inline assertion `{ default: { env?: Record<string, string>; output?: string } }`) and asserts:
         - `nextConfig.env?.NEXT_PUBLIC_APP_VERSION === pkg.version`.
         - `nextConfig.output` is `undefined` (not `'export'`, preserving Node.js serverless runtime).
       - Reads `package.json`, `.release-please-manifest.json`, and `release-please-config.json` and asserts:
         - `pkg.private === true`.
         - `manifest['.'] === pkg.version`.
         - `config.packages['.']` has `'release-type': 'node'`, `'bump-minor-pre-major': true`, `'bump-patch-for-minor-pre-major': true`, `'include-component-in-tag': false`, `'include-v-in-tag': true`, and an `extra-files` entry targeting `README.md`.
       - Reads `README.md`, locates the line containing `x-release-please-version`, asserts it contains `pkg.version`, and tests `release-please`'s exact `Generic` updater regex (`/(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(-(?<preRelease>[\w.]+))?(\+(?<build>[-\w.]+))?/`) replacing `pkg.version` with `'0.2.0'` to prove `&color=` and the closing markdown badge syntax stay completely intact!
- **PATTERN**: `src/lib/__tests__/checkers.test.ts` (lines 1–14 — `import { describe, it } from 'node:test'`, `import assert from 'node:assert/strict'`, `.ts` relative import `'../app-version.ts'`).
- **IMPORTS**: `node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:url`, `../app-version.ts`.
- **GOTCHA**:
  - Use `pathToFileURL(path.resolve(process.cwd(), 'next.config.mjs')).href` for dynamic `import(...)` so `tsc --noEmit --incremental false` does not emit `TS7016` on `.mjs` imports and Windows `file:///` URLs resolve cleanly.
  - Always restore `process.env.NEXT_PUBLIC_APP_VERSION` after env mutation tests so parallel/subsequent tests are unaffected.
  - Zero live network, DNS, TLS, or HTTP calls; all existing external mocks in `src/lib/__tests__/checkers.test.ts` (`WhoisChecker`, `SslChecker`, `WebScraper`, `fetch`) remain intact.
- **VALIDATE**: `npm test` and `npx tsc --noEmit --incremental false`
- **SATISFIES**: AC #3, AC #4 (regression guard), AC #6

### 9. UPDATE `docs/PRD.md` (Line 4 Only)

- **IMPLEMENT**:
  - Update **only** line 4 of `docs/PRD.md`:
    - Before: `**Versija**: 1.0.0 (MVP)  `
    - After: `**Dokumento versija (PRD revizija)**: 1.0.0 (MVP) *(programinės įrangos SemVer versija sekama `package.json` faile pagal `0.MINOR.PATCH`)*  `
- **PATTERN**: Existing Lithuanian markdown header metadata style in `docs/PRD.md` (lines 3–6), preserving trailing two-space line break.
- **IMPORTS**: None.
- **GOTCHA**: Do NOT rewrite or reformat any other lines in `docs/PRD.md` (preserve spec document immutability).
- **VALIDATE**: `git diff docs/PRD.md` (confirm exactly 1 line changed).
- **SATISFIES**: AC #4

### 10. UPDATE `AGENTS.md`, `docs/agents/conventions.md`, `.agents/commands/commit.md`, and `docs/AUTOMATION_WORKFLOW.md`

- **IMPLEMENT**:
  1. **`AGENTS.md`**:
     - Under `## Boundaries` (`Never:` line 78): append `; manually bump "version" in package.json, package-lock.json, or .release-please-manifest.json, or hand-edit CHANGELOG.md in feature/fix PRs`.
     - Under `## Git / PRs` (lines 86–91): add a bullet summarizing Pre-1.0 (`0.MINOR.PATCH`) `release-please` rules (`feat:`/`fix:` = patch; `chore:`/`docs:`/`ci:`/`test:`/`refactor:`/`perf:`/`style:` = no bump; forbid `!` and `BREAKING CHANGE:` unless explicitly instructed by a human; never manually edit version/changelog files).
  2. **`docs/agents/conventions.md`**:
     - Append a new `## Versioning and Releases` section after `## Public Surfaces` (line 41) using the file's `repo:` prefix style:
       - `repo:` Application versioning follows Pre-1.0 SemVer (`0.MINOR.PATCH`) managed exclusively by `release-please` (`release-please-config.json`, `.release-please-manifest.json`).
       - `repo:` Never manually bump `"version"` in `package.json`, `package-lock.json`, `.release-please-manifest.json`, or hand-edit `CHANGELOG.md` in feature/fix PRs.
       - `repo:` Conventional Commit SemVer impact under Pre-1.0: `feat:` and `fix:` produce a PATCH bump; `chore:`, `docs:`, `ci:`, `test:`, `refactor:`, `perf:`, and `style:` produce no bump; `!` and `BREAKING CHANGE:` footers are forbidden unless explicitly requested by a human.
       - `repo:` UI and runtime version display must use `getAppVersion()` (`src/lib/app-version.ts`) backed by build-time `NEXT_PUBLIC_APP_VERSION` in `next.config.mjs` (never `process.env.npm_package_version`).
  3. **`.agents/commands/commit.md`**:
     - Under `### 3. Create Commit` (lines 35–42), include `ci:` and `style:` in the tag list (or immediately after `perf:`), and add a concise `**Pre-1.0 SemVer Impact (release-please):**` subsection specifying:
       - `feat:` / `fix:` → **PATCH** bump (`0.1.0` → `0.1.1`)
       - `chore:`, `docs:`, `ci:`, `test:`, `refactor:`, `perf:`, `style:` → **no version bump**
       - **Forbidden unless explicitly requested by a human:** `!` (e.g. `feat!:`), `BREAKING CHANGE:` footers (trigger a Pre-1.0 MINOR bump), and `Release-As:` footers (reserved for human-initiated wave milestones).
       - **Never manually bump** `"version"` in `package.json`, `package-lock.json`, `.release-please-manifest.json`, or hand-edit `CHANGELOG.md` in feature/fix commits.
  4. **`docs/AUTOMATION_WORKFLOW.md`**:
     - Add a concise `### Release Automation Coexistence (release-please)` subsection in Section 5 (`## 5. Operations & Troubleshooting`) right after `### Human Review & Merging PRs` (line 151) covering:
       - **Zero Standing PRs on `push`:** `.github/workflows/release-please.yml` passes `skip-github-pull-request: ${{ github.event_name == 'push' }}`, so ordinary merges to `main` never open a standing Release PR and never deadlock Core 1a (`gh pr list --state open`).
       - **On-Demand Wave Release PR (`workflow_dispatch`):** Running `Release Please` via `workflow_dispatch` opens or updates a single `chore(main): release 0.X.Y` PR updating `package.json`, `package-lock.json`, `.release-please-manifest.json`, `CHANGELOG.md`, and `README.md`. While this Release PR is open, Core 1a intentionally pauses Planner and Implementer sidecars until a human reviews and merges it; the merge `push` then runs `manifest.createReleases()` to create the `v0.X.Y` git tag and GitHub Release, and sidecars resume automatically.
       - **Verified Wave-Bump Procedure (`0.2.0`, `0.3.0`, `0.5.0`):** Because `release-please-action` ignores the `release-as` action input in manifest mode, push an empty commit on `main` before triggering `workflow_dispatch`:
         `git commit --allow-empty -m "chore: release 0.2.0" -m "Release-As: 0.2.0"`
       - **Repository Settings & `#32` Ruleset Note:** Enable `Settings -> Actions -> General -> Allow GitHub Actions to create and approve pull requests`. Because PRs authored with the default `GITHUB_TOKEN` do not trigger `on: pull_request` workflows (preventing recursive runs), once `#32` enforces required status checks on `main`, either close & reopen the Release PR (or push an update as a human) to trigger CI checks, or configure a dedicated PAT/GitHub App token secret later.
       - **Commit Context Reminder:** Include a `Context:` block in commit messages whenever `AGENTS.md`, `docs/`, or `.agents/` files change (per `.agents/commands/commit.md`).
- **PATTERN**: Existing markdown structure and `repo:`/`golden:` conventions in each respective file.
- **IMPORTS**: None.
- **GOTCHA**:
  - Keep changes concise and avoid bloating `AGENTS.md`.
  - When committing the implementation PR, include a `Context:` block in the commit message listing the modified `AGENTS.md`, `docs/`, and `.agents/` files (per `.agents/commands/commit.md` lines 62–84 and Issue `#33` AC #5).
- **VALIDATE**: Inspect `git diff AGENTS.md docs/agents/conventions.md .agents/commands/commit.md docs/AUTOMATION_WORKFLOW.md` and verify all AC #5 items are explicitly present.
- **SATISFIES**: AC #2 (documentation parts), AC #5

---

## TESTING STRATEGY

### Unit Tests

- All existing unit tests in `src/lib/__tests__/checkers.test.ts` MUST continue mocking all external network, DNS, TLS, and HTTP calls (`WhoisChecker`, `SslChecker`, `WebScraper`, `Security.validateHostname`, `tls.connect`, `globalThis.fetch`) so `npm test` runs deterministically offline in sandbox (`BypassSandbox: false`) and CI.
- New unit tests in `src/lib/__tests__/version.test.ts` (automatically discovered by `npm test` via `node --test "src/**/*.test.ts" "src/**/*.spec.ts"`) run 100% offline with zero network/DNS/TLS/HTTP calls:
  - Unit tests for `formatAppVersion()` covering standard semver, whitespace trimming, duplicate `v`/`V` stripping, pre-release labels, and empty/undefined fallbacks.
  - Unit tests for `getAppVersion()` covering set and unset `process.env.NEXT_PUBLIC_APP_VERSION` with clean env restoration.
  - Contract tests for `next.config.mjs` confirming `env.NEXT_PUBLIC_APP_VERSION === pkg.version` and `output === undefined` (preserving Node.js serverless runtime).
  - Governance parity tests for `.release-please-manifest.json`, `release-please-config.json`, `package.json` (`private: true`), and `README.md` generic-updater regex replacement safety.

### Integration / Build Verification

- `npm run build` compiles `next.config.mjs`, inlines `NEXT_PUBLIC_APP_VERSION` (`"0.1.0"`) into the client bundle for `src/components/Footer.tsx`, and builds all App Router pages and Node.js API routes cleanly.

### Edge Cases

- Missing or blank `NEXT_PUBLIC_APP_VERSION` (e.g. direct `node` execution without Next.js config) gracefully displays `v0.0.0-dev` instead of `vundefined` or crashing.
- Duplicate prefix input (`'v0.1.0'` or `'V0.1.0'`) normalizes cleanly to `'v0.1.0'` (never `'vv0.1.0'`).
- `README.md` badge line replacement via `release-please` `Generic` updater regex preserves `&color=1d4ed8` and markdown link formatting when bumping `0.1.0` → `0.2.0` or `0.1.1`.

---

## VALIDATION COMMANDS

Execute every command after the final edit to confirm zero regressions and 100% compliance with Issue `#33`.

### Level 1: Typecheck & Lint

```bash
npx tsc --noEmit --incremental false
npm run lint
```

### Level 2: Offline Unit Tests

```bash
npm test
```

*(Must run deterministically offline inside sandbox with all external `WhoisChecker`, `SslChecker`, `WebScraper`, `Security.validateHostname`, `tls.connect`, and `fetch` calls mocked; all existing tests plus new `version.test.ts` tests pass.)*

### Level 3: Production Build

```bash
npm run build
```

*(Note on Windows sandbox: run in sandbox first; if Next.js `.next` encounters transient Windows sandbox `EPERM`, retry per terminal sandbox guidance.)*

### Level 4: Manual / Visual & Diff Verification

```bash
git status -s
git diff --stat
```

- Verify `package.json` `"version"` is still `"0.1.0"` and `"private": true`, and `package-lock.json` is untouched.
- Verify `docs/PRD.md` has exactly 1 line changed (line 4).
- Verify `.github/workflows/release-please.yml` uses the exact 40-char SHA `45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0`, `timeout-minutes: 5`, `concurrency` with `cancel-in-progress: false`, minimal permissions, and `skip-github-pull-request: ${{ github.event_name == 'push' }}`.
- Optionally inspect rendered Footer in local dev/prod server (`v0.1.0` visible next to copyright with clean contrast).

---

## ACCEPTANCE CRITERIA

- [ ] **AC #1 (`release-please` Manifest & Pre-1.0 Rules):** `.release-please-manifest.json` (`{ ".": "0.1.0" }`) and `release-please-config.json` (`$schema`, root `"."` with `release-type: "node"`, `initial-version: "0.1.0"`, `bump-minor-pre-major: true`, `bump-patch-for-minor-pre-major: true`, `include-component-in-tag: false`, `include-v-in-tag: true`, and `extra-files` for `README.md`) created and validated.
- [ ] **AC #2 (Wave-Controlled Workflow & Docs):** `.github/workflows/release-please.yml` triggers on `push` (`branches: [main]`) and `workflow_dispatch`, passes `skip-github-pull-request: ${{ github.event_name == 'push' }}`, pins `googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0`, sets `timeout-minutes: 5`, `concurrency` (`cancel-in-progress: false`), and scoped `permissions: { contents: write, pull-requests: write, issues: write }`; wave-bump `Release-As` procedure, Actions PR permission setting, and `#32` Ruleset `GITHUB_TOKEN` behavior documented.
- [ ] **AC #3 (`NEXT_PUBLIC_APP_VERSION`, Footer & Offline Tests):** `next.config.mjs` exposes `NEXT_PUBLIC_APP_VERSION` from `package.json` while preserving Node.js serverless runtime; `src/lib/app-version.ts` and `src/components/Footer.tsx` display formatted `v0.1.0` with safe fallback; `src/lib/__tests__/version.test.ts` passes deterministically offline.
- [ ] **AC #4 (`README.md` Badge & `docs/PRD.md` Header):** `README.md` has a Shields.io version badge updated via `<!-- x-release-please-version -->` without `-color` regex collision; `docs/PRD.md` line 4 clarifies PRD document revision vs application SemVer with zero other edits.
- [ ] **AC #5 (Agent Conventions & Sidecar Coexistence):** `AGENTS.md`, `docs/agents/conventions.md`, `.agents/commands/commit.md`, and `docs/AUTOMATION_WORKFLOW.md` codify no-manual-version-bump boundaries, Pre-1.0 Conventional Commit rules, on-demand Release PR coexistence with Core 1a, and `Context:` commit block expectations.
- [ ] **AC #6 (Full Validation Suite):** `npx tsc --noEmit --incremental false`, `npm run lint`, `npm test`, and `npm run build` all exit `0`.

---

## COMPLETION CHECKLIST

- [ ] All tasks 1–10 executed in order
- [ ] Zero new npm dependencies added; `package.json` (`"version": "0.1.0"`, `"private": true`) and `package-lock.json` untouched
- [ ] All unit tests (existing + `version.test.ts`) pass deterministically offline
- [ ] All 4 required validation commands exit `0` after the final edit
- [ ] Implementation commit message follows Conventional Commits and includes a `Context:` block for `AGENTS.md`, `docs/`, and `.agents/` changes

---

## OPEN QUESTIONS / ASSUMPTIONS

- **Assumed — `.github/workflows/` Directory Creation Before `#14` Merges**: Issue `#33` notes `#14` (Core CI workflow `.github/workflows/ci.yml`) as a dependency establishing `.github/workflows/` conventions, and `#14` is currently still open. Because `.github/workflows/release-please.yml` does not conflict with `.github/workflows/ci.yml` and already follows all CI hardening rules in `docs/agents/security.md`, this plan creates `.github/workflows/release-please.yml` directly without waiting on `#14`.
- **Assumed — Static Query-Param Shields.io Badge Over GitHub Release Badge**: The repository is currently `PRIVATE` (until `#31` + manual Phase B visibility flip) and has no GitHub Releases yet. Using `https://img.shields.io/static/v1?label=Version&message=v0.1.0&color=1d4ed8` with `<!-- x-release-please-version -->` works immediately while private and after going public, and avoids the `release-please` `Generic` updater `-color` pre-release regex bug. A dynamic `img.shields.io/github/v/release/...` badge can optionally replace it after Phase B + first tag if preferred.
- **Assumed — Fallback Label `v0.0.0-dev` When `NEXT_PUBLIC_APP_VERSION` Is Unset**: In production and `next dev` builds, `next.config.mjs` always populates `NEXT_PUBLIC_APP_VERSION` from `package.json` (`v0.1.0`). When `getAppVersion()` runs outside Next.js (e.g. unit tests without env), falling back to `v0.0.0-dev` avoids `undefined` rendering while keeping a predictable SemVer-shaped string.
- **Assumed — No `package.json` or `docs/agents/stack.md` Churn Outside Scope**: `package.json` already has `"version": "0.1.0"` and `"private": true`, so no edit to `package.json` or `package-lock.json` is needed.

---

## NOTES (open canvas)

### Why Query-Param Shields.io Syntax Matters for `release-please`

`googleapis/release-please`'s `Generic` updater (`src/updaters/generic.ts`) matches versions with:

```ts
const VERSION_REGEX =
  /(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(-(?<preRelease>[\w.]+))?(\+(?<build>[-\w.]+))?/;
```

| Badge URL Format | Match Captured by `VERSION_REGEX` | Result After Bumping to `0.2.0` | Verdict |
| :--- | :--- | :--- | :--- |
| `https://img.shields.io/badge/Version-v0.1.0-1d4ed8` | `0.1.0-1d4ed8` (color parsed as `preRelease`!) | `https://img.shields.io/badge/Version-v0.2.0` *(broken URL)* | **Broken** |
| `https://img.shields.io/static/v1?label=Version&message=v0.1.0&color=1d4ed8` | `0.1.0` (terminated by `&`) | `https://img.shields.io/static/v1?label=Version&message=v0.2.0&color=1d4ed8` | **Safe (Chosen)** |

Testing this exact regex in `src/lib/__tests__/version.test.ts` ensures future README edits cannot reintroduce the broken format silently.

### Wave Release Execution Flow (Zero Sidecar Deadlocks)

1. Normal PRs (`feat:`, `fix:`, `docs:`, `chore:`) merge to `main`.
2. `release-please.yml` fires on `push` with `skip-github-pull-request: true` → zero standing Release PRs opened → Core 1a sidecars stay unblocked.
3. At the end of a wave (e.g. cutting `0.2.0`), maintainer pushes an empty commit with `Release-As: 0.2.0` (for minor waves; omitted for patch releases) and triggers `Release Please` via `workflow_dispatch`.
4. `release-please` opens `chore(main): release 0.2.0` (updating `package.json`, `package-lock.json`, `.release-please-manifest.json`, `CHANGELOG.md`, `README.md`). Core 1a pauses sidecars while the human reviews and merges the Release PR.
5. Merging the Release PR triggers `push` on `main` → `manifest.createReleases()` creates tag `v0.2.0` and GitHub Release → Vercel builds with `NEXT_PUBLIC_APP_VERSION=0.2.0` → sidecars resume automatically on the next run.

---

## AMENDMENTS

- *(None at creation.)*

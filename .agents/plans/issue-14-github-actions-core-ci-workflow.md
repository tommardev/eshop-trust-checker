# Feature: GitHub Actions Core CI Workflow (`lint`, `typecheck`, `test`, `build`)

The following plan should be complete, but it is important that you validate documentation, codebase patterns, and task sanity before you start implementing.

Pay special attention to exact GitHub Actions 40-character commit SHAs, job IDs/names (`lint`, `typecheck`, `test`, `build`), `$GITHUB_STEP_SUMMARY` security conventions (`env:` indirection, never inline `${{ ... }}` in `run:`), and surgical scoping to Issue `#14`.

## Feature Description

Add the core GitHub Actions continuous integration workflow (`.github/workflows/ci.yml`) that runs four parallel quality gates—`lint`, `typecheck`, `test`, and `build`—on every pull request targeting `main` and every push to `main`. The workflow implements Roadmap Phase 2 (`2.1`–`2.6`) with supply-chain hardening (full 40-character commit SHA pinning for all actions, least-privilege `contents: read` permissions, `persist-credentials: false`, explicit job timeouts, and PR-only concurrency cancellation) plus per-job Markdown summaries written to `$GITHUB_STEP_SUMMARY`.

## User Story

As a maintainer and contributor to `eshop-trust-checker`
I want GitHub Actions to automatically run `lint`, `typecheck`, `test`, and `build` in parallel on every PR and push to `main`
So that TypeScript, ESLint, offline unit-test, and Next.js production build regressions are caught before merge and can later be enforced as required status checks on `main`.

## Problem Statement

The repository currently has only `.github/workflows/release-please.yml`. While Issue `#13` aligned Node.js runtime requirements (`engines.node: >=22.18.0`), multi-file `npm test` discovery, and local validation documentation, there is still no automated CI workflow executing those four quality gates on pull requests or pushes to `main`. Without `.github/workflows/ci.yml`, regressions can only be detected manually, and downstream governance/security work (`#15` Preview Smoke Check, `#16` Governance/Dependabot, `#17` Security Gate, `#32` `main` Branch Ruleset requiring `lint`, `typecheck`, `test`, `build`) remains blocked.

## Solution Statement

1. Create `.github/workflows/ci.yml` triggered on `pull_request` (`branches: [main]`) and `push` (`branches: [main]`), with top-level `permissions: { contents: read }`, PR-only concurrency cancellation (`group: ${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`), and four parallel jobs named `lint`, `typecheck`, `test`, and `build`.
2. Pin every GitHub Action (`actions/checkout`, `actions/setup-node`, `actions/cache`) to verified 40-character commit SHAs running natively on `node24`, using `persist-credentials: false`, `node-version: '24'`, `cache: 'npm'`, `npm ci`, and `.next/cache` caching in `build`.
3. Add a concise `if: always()` `Summarize run` step to every job that writes trigger, Node version, cache hit status, install outcome, and check outcome to `$GITHUB_STEP_SUMMARY` via `env:` variables (zero inline `${{ ... }}` interpolation in `run:`).
4. Add an offline static contract unit test suite (`src/lib/__tests__/ci-workflow.test.ts`) using `node:test` and `node:fs` (zero network calls) so CI workflow hardening invariants are regression-tested by `npm test`.
5. Update `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` to check off Tasks `2.1`–`2.5`, record an Iteration Log entry, and document Task `2.6` live PR check verification (`gh pr checks`).

## Out of Scope / Non-Goals

- **Not included:** Adding a `CI` workflow badge to `README.md` (explicitly guarded by `src/lib/__tests__/governance.test.ts` lines 234–246 until Phase C / Issue `#32` adds live badges).
- **Not included:** Preview smoke checks or `/api/sync-blacklist` auth guards (Issue `#15`).
- **Not included:** `.github/dependabot.yml`, `.github/CODEOWNERS`, PR template changes, or `pr-hygiene.yml` (Issue `#16`).
- **Not included:** `.github/workflows/security.yml`, Gitleaks secret scanning, or `npm audit` CI gate (Issue `#17`).
- **Not included:** Prettier installation, formatting configs, or `format:check` job (Issue `#18`).
- **Not included:** Playwright, axe-core, API integration tests, or coverage reporting (Issue `#19`).
- **Not included:** CodeQL workflow, Secret Scanning settings, or `main` Branch Ruleset creation (Issue `#32`).
- **Not included:** Dependency upgrades, `package.json` script/engine changes, Next.js/React/ESLint upgrades (Issue `#30`), or manual edits to `"version"` / `.release-please-manifest.json` / `CHANGELOG.md`.
- **Not changing:** Existing audit checkers, API routes, UI components, or `.github/workflows/release-please.yml`.

## Feature Metadata

- **Feature Type**: Enhancement (CI/CD Automation)
- **Estimated Complexity**: Low
- **Primary Systems Affected**: `.github/workflows/ci.yml`, `src/lib/__tests__/ci-workflow.test.ts`, `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`
- **Dependencies**: None (zero new npm packages; uses official GitHub Actions pinned by 40-char commit SHA)

## Related Work

**Implements**: GitHub Issue `#14` (`https://github.com/tommardev/eshop-trust-checker/issues/14`)  ·  **Epic / Roadmap**: `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (Phase 2: Tasks `2.1`–`2.6`)

**Back-references** (plans this builds on or inherits decisions from):

- `.agents/plans/issue-13-ci-prep-node-runtime-test-discovery-and-docs.md` — Why: established `engines.node >= 22.18.0`, multi-file `npm test` glob (`src/**/*.test.ts`, `src/**/*.spec.ts`), and the 4 canonical validation commands.
- `.agents/plans/issue-31-public-repository-readiness-and-governance.md` — Why: added `src/lib/__tests__/governance.test.ts` (including premature badge guard for `workflows/ci.yml`) and ADR-002 status-check naming (`lint`, `typecheck`, `test`, `build`).
- `.agents/plans/issue-33-pre-1-0-release-please-and-version-sync.md` — Why: established the canonical `.github/workflows/release-please.yml` SHA-pinning and `$GITHUB_STEP_SUMMARY` pattern and `next.config.mjs` build-time `package.json` reading.

**Forward-references** (issues/plans that depend on or extend this):

- Issue `#15` (Preview Smoke Check — depends on `#14`)
- Issue `#16` (Governance / Dependabot / PR Title Check — depends on `#14`)
- Issue `#17` (Security CI gate — depends on `#14`)
- Issue `#18` (Prettier `format:check` addition to `ci.yml` — depends on `#14`)
- Issue `#32` (`main` Branch Ruleset requiring `lint`, `typecheck`, `test`, `build` checks + `README.md` CI badge — depends on `#14`)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `AGENTS.md` (lines 21–29, 66–94) — Why: canonical commands, GitHub Actions `$GITHUB_STEP_SUMMARY` rule, commit/versioning boundaries.
- `package.json` (lines 1–45) — Why: confirms `"engines": { "node": ">=22.18.0" }` and exact scripts (`lint`, `test`, `build`) used in CI jobs.
- `tsconfig.json` (lines 1–29) — Why: confirms `"incremental": true` (reason CI runs `npx tsc --noEmit --incremental false`).
- `next.config.mjs` (lines 1–14) — Why: confirms `next build` reads `package.json` (`pkg.version`) and requires no runtime secrets; justifies including `package.json` and `next.config.mjs` in the `.next/cache` hash key.
- `.github/workflows/release-please.yml` (lines 1–79) — Why: canonical repo pattern for 40-char SHA pinning (`# vX.Y.Z` comment), top-level `permissions`, `timeout-minutes`, and `if: always()` `Summarize run` step passing `${{ ... }}` via `env:` into `| tee -a "$GITHUB_STEP_SUMMARY"`.
- `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (lines 68–103, 212–220, 253–259) — Why: authoritative Phase 2 task definitions (`2.1`–`2.6`), required check names for Phase 5.4 (`lint`, `typecheck`, `test`, `build`), and Iteration Log table format.
- `docs/agents/conventions.md` (lines 50–54) — Why: mandatory GitHub Actions `$GITHUB_STEP_SUMMARY` convention and prohibition on interpolating `${{ ... }}` directly inside `run:`.
- `docs/agents/security.md` (lines 36–42) — Why: CI/CD hardening rules (40-char SHA pinning, least-privilege `permissions`, `persist-credentials: false`, no `pull_request_target`, explicit `timeout-minutes`).
- `docs/agents/testing.md` (lines 30–44) — Why: offline deterministic `npm test` requirement and canonical 4 validation commands.
- `src/lib/__tests__/governance.test.ts` (lines 234–246) — Why: explicitly asserts `README.md` must NOT yet include `workflows/ci.yml` badges; do not touch `README.md`.
- `src/lib/__tests__/version.test.ts` (lines 1–67, 127–165) — Why: reference style for offline `node:test` + `node:assert/strict` + `node:fs` repository contract tests.

### New Files to Create

- `.github/workflows/ci.yml` — Core CI workflow with parallel `lint`, `typecheck`, `test`, and `build` jobs.
- `src/lib/__tests__/ci-workflow.test.ts` — Offline unit tests validating `.github/workflows/ci.yml` structure, triggers, permissions, concurrency, 40-char SHA pinning, timeouts, commands, caching, and `$GITHUB_STEP_SUMMARY` safety.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [GitHub Actions: Adding a job summary](https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary)
  - Specific section: `GITHUB_STEP_SUMMARY` usage and Markdown table formatting
  - Why: Required by `AGENTS.md` and `docs/agents/conventions.md` on every workflow in `.github/workflows/`.
- [GitHub Actions: Security hardening for GitHub Actions](https://docs.github.com/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions)
  - Specific section: Pinning actions to full-length commit SHAs and mitigating script injection via `env:`
  - Why: Enforces supply-chain integrity and prevents expression injection in `run:` blocks.
- [Next.js Docs: Continuous Integration (CI) Build Caching](https://nextjs.org/docs/app/guides/ci-build-caching#github-actions)
  - Specific section: GitHub Actions `.next/cache` caching with `actions/cache`
  - Why: Matches Roadmap Task `2.5` for caching `.next/cache` in the `build` job.
- Verified GitHub Actions commit SHAs (verified via `gh api` against upstream `action.yml` on 2026-11-25; all run natively on `node24`):
  - `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1` (`runs.using: node24`, supports `persist-credentials: false`)
  - `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0` (`runs.using: node24`, supports `node-version`, `cache: 'npm'`, outputs `node-version`, `cache-hit`)
  - `actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0` (`runs.using: node24`, supports `path`, `key`, `restore-keys`, output `cache-hit`)

### Patterns to Follow

**1. Workflow Hardening & Job Summary Pattern** (mirror `.github/workflows/release-please.yml` lines 17–79):

```yaml
permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

```yaml
      - name: Summarize run
        if: always()
        env:
          EVENT_NAME: ${{ github.event_name }}
          NODE_VERSION: ${{ steps.setup-node.outputs.node-version }}
          NPM_CACHE_HIT: ${{ steps.setup-node.outputs.cache-hit }}
          INSTALL_OUTCOME: ${{ steps.install.outcome }}
          CHECK_OUTCOME: ${{ steps.lint.outcome }}
        run: |
          {
            echo "### CI Summary (lint)"
            echo ""
            echo "| Field | Value |"
            echo "| --- | --- |"
            echo "| Trigger | \`${EVENT_NAME}\` |"
            echo "| Node.js | \`${NODE_VERSION:-n/a}\` |"
            echo "| npm cache hit | \`${NPM_CACHE_HIT:-false}\` |"
            echo "| npm ci | \`${INSTALL_OUTCOME:-skipped}\` |"
            echo "| npm run lint | \`${CHECK_OUTCOME:-skipped}\` |"
          } | tee -a "$GITHUB_STEP_SUMMARY"
```

**2. Offline Repo Contract Test Pattern** (mirror `src/lib/__tests__/version.test.ts` lines 1–6, 44–47):

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
```

**3. Exact Status Check Naming Convention** (`docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` lines 101, 218 and ADR-002 line 85):

- Job IDs and explicit `name:` fields MUST both be exact lowercase `lint`, `typecheck`, `test`, and `build` so GitHub check runs match the future `main` Branch Ruleset in Issue `#32` without renaming drift.

---

## IMPLEMENTATION PLAN

### Phase 1: Core CI Workflow Authoring

Create `.github/workflows/ci.yml` implementing Roadmap Tasks `2.1`–`2.5` with all security hardening, caching, Node 24 setup, parallel jobs, and `$GITHUB_STEP_SUMMARY` reporting.

**Tasks:**

- Create `.github/workflows/ci.yml` with `pull_request`/`push` triggers on `main`, top-level `permissions: { contents: read }`, PR-only concurrency cancellation, and `NEXT_TELEMETRY_DISABLED: '1'`.
- Define parallel jobs `lint` (10m), `typecheck` (10m), `test` (10m), and `build` (15m, with `.next/cache` via `actions/cache`).
- Include an `if: always()` `Summarize run` step in each job using `env:` variables only.

### Phase 2: Offline Contract Tests

**Depends on:** Phase 1 (tests validate `.github/workflows/ci.yml`).

Create `src/lib/__tests__/ci-workflow.test.ts` to lock down every workflow security, trigger, pinning, command, cache, and summary invariant offline.

**Tasks:**

- Add `node:test` assertions reading `.github/workflows/ci.yml` from disk (zero network calls, zero new dependencies).
- Verify all 40-char SHA pins, `persist-credentials: false`, `permissions`, `concurrency`, `timeout-minutes`, job names, exact commands, `.next/cache`, `$GITHUB_STEP_SUMMARY`, and absence of inline `${{ ... }}` in `run:` scripts.

### Phase 3: Roadmap & Documentation Sync

**Independent of:** Phase 2 (can run right after Phase 1, before final validation).

Update `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` to check off Tasks `2.1`–`2.5` and append an Iteration Log row noting Task `2.6` live PR check verification.

**Tasks:**

- Mark `[x]` on Tasks `2.1`–`2.5` in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`; keep `2.6` `[ ]` until live PR checks pass on GitHub (or check off `2.6` in a follow-up commit on the PR once `gh pr checks` confirms all 4 pass).
- Append a dated row to `## Iteration Log`.

### Phase 4: Validation & Live PR Verification

**Depends on:** Phases 1–3.

Run all four canonical offline validation commands locally, open the PR linked with `Closes #14`, and verify live `gh pr checks` pass (`lint`, `typecheck`, `test`, `build`) for Task `2.6`.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### 1. CREATE `.github/workflows/ci.yml`

- **IMPLEMENT**: Create `.github/workflows/ci.yml` with the exact structure below (4 parallel jobs: `lint`, `typecheck`, `test`, `build`):

```yaml
# Core CI quality gates (docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md Phase 2).
# Runs lint, typecheck, offline unit tests, and production build in parallel
# on every PR to main and every push to main.
name: CI

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

env:
  NEXT_TELEMETRY_DISABLED: '1'

jobs:
  lint:
    name: lint
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup Node.js
        id: setup-node
        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        id: install
        run: npm ci

      - name: Run ESLint
        id: check
        run: npm run lint

      - name: Summarize run
        if: always()
        env:
          EVENT_NAME: ${{ github.event_name }}
          NODE_VERSION: ${{ steps.setup-node.outputs.node-version }}
          NPM_CACHE_HIT: ${{ steps.setup-node.outputs.cache-hit }}
          INSTALL_OUTCOME: ${{ steps.install.outcome }}
          CHECK_OUTCOME: ${{ steps.check.outcome }}
        run: |
          {
            echo "### CI Summary (lint)"
            echo ""
            echo "| Field | Value |"
            echo "| --- | --- |"
            echo "| Trigger | \`${EVENT_NAME}\` |"
            echo "| Node.js | \`${NODE_VERSION:-n/a}\` |"
            echo "| npm cache hit | \`${NPM_CACHE_HIT:-false}\` |"
            echo "| npm ci | \`${INSTALL_OUTCOME:-skipped}\` |"
            echo "| npm run lint | \`${CHECK_OUTCOME:-skipped}\` |"
          } | tee -a "$GITHUB_STEP_SUMMARY"

  typecheck:
    name: typecheck
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup Node.js
        id: setup-node
        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        id: install
        run: npm ci

      - name: Run TypeScript typecheck
        id: check
        run: npx tsc --noEmit --incremental false

      - name: Summarize run
        if: always()
        env:
          EVENT_NAME: ${{ github.event_name }}
          NODE_VERSION: ${{ steps.setup-node.outputs.node-version }}
          NPM_CACHE_HIT: ${{ steps.setup-node.outputs.cache-hit }}
          INSTALL_OUTCOME: ${{ steps.install.outcome }}
          CHECK_OUTCOME: ${{ steps.check.outcome }}
        run: |
          {
            echo "### CI Summary (typecheck)"
            echo ""
            echo "| Field | Value |"
            echo "| --- | --- |"
            echo "| Trigger | \`${EVENT_NAME}\` |"
            echo "| Node.js | \`${NODE_VERSION:-n/a}\` |"
            echo "| npm cache hit | \`${NPM_CACHE_HIT:-false}\` |"
            echo "| npm ci | \`${INSTALL_OUTCOME:-skipped}\` |"
            echo "| npx tsc --noEmit --incremental false | \`${CHECK_OUTCOME:-skipped}\` |"
          } | tee -a "$GITHUB_STEP_SUMMARY"

  test:
    name: test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup Node.js
        id: setup-node
        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        id: install
        run: npm ci

      - name: Run unit tests
        id: check
        run: npm test

      - name: Summarize run
        if: always()
        env:
          EVENT_NAME: ${{ github.event_name }}
          NODE_VERSION: ${{ steps.setup-node.outputs.node-version }}
          NPM_CACHE_HIT: ${{ steps.setup-node.outputs.cache-hit }}
          INSTALL_OUTCOME: ${{ steps.install.outcome }}
          CHECK_OUTCOME: ${{ steps.check.outcome }}
        run: |
          {
            echo "### CI Summary (test)"
            echo ""
            echo "| Field | Value |"
            echo "| --- | --- |"
            echo "| Trigger | \`${EVENT_NAME}\` |"
            echo "| Node.js | \`${NODE_VERSION:-n/a}\` |"
            echo "| npm cache hit | \`${NPM_CACHE_HIT:-false}\` |"
            echo "| npm ci | \`${INSTALL_OUTCOME:-skipped}\` |"
            echo "| npm test | \`${CHECK_OUTCOME:-skipped}\` |"
          } | tee -a "$GITHUB_STEP_SUMMARY"

  build:
    name: build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup Node.js
        id: setup-node
        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        id: install
        run: npm ci

      - name: Cache Next.js build
        id: next-cache
        uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: .next/cache
          key: ${{ runner.os }}-nextjs-${{ hashFiles('package-lock.json') }}-${{ hashFiles('src/**/*', 'next.config.mjs', 'package.json', 'tsconfig.json', 'tailwind.config.js', 'postcss.config.js') }}
          restore-keys: |
            ${{ runner.os }}-nextjs-${{ hashFiles('package-lock.json') }}-

      - name: Run production build
        id: check
        run: npm run build

      - name: Summarize run
        if: always()
        env:
          EVENT_NAME: ${{ github.event_name }}
          NODE_VERSION: ${{ steps.setup-node.outputs.node-version }}
          NPM_CACHE_HIT: ${{ steps.setup-node.outputs.cache-hit }}
          NEXT_CACHE_HIT: ${{ steps.next-cache.outputs.cache-hit }}
          INSTALL_OUTCOME: ${{ steps.install.outcome }}
          CHECK_OUTCOME: ${{ steps.check.outcome }}
        run: |
          {
            echo "### CI Summary (build)"
            echo ""
            echo "| Field | Value |"
            echo "| --- | --- |"
            echo "| Trigger | \`${EVENT_NAME}\` |"
            echo "| Node.js | \`${NODE_VERSION:-n/a}\` |"
            echo "| npm cache hit | \`${NPM_CACHE_HIT:-false}\` |"
            echo "| Next.js cache hit | \`${NEXT_CACHE_HIT:-false}\` |"
            echo "| npm ci | \`${INSTALL_OUTCOME:-skipped}\` |"
            echo "| npm run build | \`${CHECK_OUTCOME:-skipped}\` |"
          } | tee -a "$GITHUB_STEP_SUMMARY"
```

- **PATTERN**: `.github/workflows/release-please.yml` (lines 1–79), `docs/agents/security.md` (lines 36–42), `docs/agents/conventions.md` (lines 50–54).
- **IMPORTS**: Official GitHub Actions pinned to verified 40-char SHAs (`actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`, `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`, `actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0`).
- **GOTCHA**:
  - Keep job IDs and `name:` values exact lowercase (`lint`, `typecheck`, `test`, `build`) so GitHub status checks match Roadmap Task `5.4` / Issue `#32`.
  - Do NOT add `needs:` between jobs; all four must run in parallel.
  - Do NOT add `pull_request_target` or any write permissions.
  - Never interpolate `${{ ... }}` directly inside any `run:` block—always pass via `env:`.
  - Keep `package.json` inside the `.next/cache` `hashFiles(...)` expression because `next.config.mjs` injects `pkg.version` into `NEXT_PUBLIC_APP_VERSION` at build time.
  - Do NOT edit `README.md` to add a CI badge (`src/lib/__tests__/governance.test.ts` lines 234–246 rejects `workflows/ci.yml` badges until Issue `#32`).
- **VALIDATE**: Verify file exists and has no tabs or syntax issues via Node check (and covered thoroughly in Task 2).
- **SATISFIES**: AC #1, AC #2, AC #3, AC #4.

---

### 2. CREATE `src/lib/__tests__/ci-workflow.test.ts`

- **IMPLEMENT**: Create an offline unit test file using `node:test`, `node:assert/strict`, `node:fs`, and `node:path` (matching `src/lib/__tests__/version.test.ts` and `src/lib/__tests__/governance.test.ts`, zero external network calls or new packages) that reads `.github/workflows/ci.yml` and asserts:
  1. **Triggers & Safety**: Triggers on `pull_request` (`branches: [main]`) and `push` (`branches: [main]`); does NOT contain `pull_request_target`.
  2. **Least-Privilege Permissions**: Top-level `permissions:` grants only `contents: read` (no `write-all` or `: write` anywhere in the file).
  3. **Concurrency**: Defines `group: ${{ github.workflow }}-${{ github.ref }}` and `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` so `main` pushes are not cancelled.
  4. **Parallel Jobs & Timeouts**: Contains all four jobs (`lint`, `typecheck`, `test`, `build`) with exact matching `name:` fields, `runs-on: ubuntu-latest`, no `needs:` key, `timeout-minutes: 10` on `lint`/`typecheck`/`test`, and `timeout-minutes: 15` on `build`.
  5. **40-Char SHA Pinning**: Every `uses:` line in `.github/workflows/ci.yml` matches `/^uses:\s+[\w.-]+\/[\w.-]+@[0-9a-f]{40}\s+#\s+v\d+\.\d+\.\d+$/` (no mutable tags like `@v4` or `@main`).
  6. **Checkout, Node 24, and Caching**:
     - Every `actions/checkout` step sets `persist-credentials: false` (4 occurrences).
     - Every `actions/setup-node` step configures `node-version: '24'` and `cache: 'npm'` (4 occurrences).
     - Every job runs `npm ci` (4 occurrences).
     - Exact check commands are present: `npm run lint`, `npx tsc --noEmit --incremental false`, `npm test`, `npm run build`.
     - `build` job configures SHA-pinned `actions/cache` with `path: .next/cache` and `restore-keys:`.
  7. **Job Summaries & Expression Injection Guard**:
     - All 4 jobs include an `if: always()` step writing to `$GITHUB_STEP_SUMMARY`.
     - Parse every `run:` block (both single-line `run: ...` and multiline `run: |` indented blocks) and assert none contains `${{` so GitHub Actions expressions are strictly passed via `env:`.
- **PATTERN**: `src/lib/__tests__/version.test.ts` (lines 1–67) and `src/lib/__tests__/governance.test.ts` (lines 1–60).
- **IMPORTS**: `node:test`, `node:assert/strict`, `node:fs`, `node:path`.
- **GOTCHA**:
  - Must run 100% offline with zero external network/DNS/TLS/HTTP calls (`WhoisChecker`, `SslChecker`, `WebScraper`, `fetch` remain mocked in `checkers.test.ts`, and `ci-workflow.test.ts` uses only local `readFileSync`).
  - Handle both CRLF (`\r\n`) and LF (`\n`) line endings when splitting `.github/workflows/ci.yml` so tests pass identically on Windows (local dev) and Linux (`ubuntu-latest` CI).
  - Keep TypeScript `strict: true` compliant and ESLint clean (`npm run lint` scans `src/**/*.ts`).
- **VALIDATE**: `npm test`
- **SATISFIES**: AC #1, AC #2, AC #3, AC #4, and offline deterministic test requirement.

---

### 3. UPDATE `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`

- **IMPLEMENT**:
  1. In `## Phase 2: Core CI Quality Gates (.github/workflows/ci.yml)` (lines 72–98), change `- [ ]` to `- [x]` for Tasks `2.1`, `2.2`, `2.3`, `2.4`, and `2.5`.
  2. Leave Task `2.6` (`Verify all 4 CI checks on a live GitHub PR`) as `- [ ]` in the initial commit until the PR is actually opened and `gh pr checks` passes on GitHub; add a brief italic note on Task `2.6` or in the Iteration Log explaining it is verified on the live PR (or mark `[x]` on the PR branch right after `gh pr checks` confirms all 4 checks pass).
  3. Append one row to `## Iteration Log` (after line 259) recording the date, `2.1–2.5`, the feature branch / Issue `#14`, and verification summary (`ci.yml` with 40-char SHA-pinned `node24` actions, parallel `lint`/`typecheck`/`test`/`build` jobs, `.next/cache`, `$GITHUB_STEP_SUMMARY`, offline `ci-workflow.test.ts`, and local 4-command verification; Task `2.6` pending live PR check run).
- **PATTERN**: `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` lines 253–259 (Iteration Log entry for Issue `#13`).
- **IMPORTS**: N/A (Markdown doc update).
- **GOTCHA**:
  - Do NOT edit unrelated roadmap phases (Phases 1, 3, 4, 5, 6).
  - Remember `AGENTS.md` line 90: commits touching `docs/` should include a `Context:` section per `.agents/commands/commit.md`.
- **VALIDATE**: `git diff docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`
- **SATISFIES**: AC #5.

---

### 4. RUN Full Local Validation Suite

- **IMPLEMENT**: Execute all four canonical validation commands locally and confirm zero errors or warnings that break exit codes.
- **PATTERN**: `docs/agents/testing.md` lines 30–44.
- **GOTCHA**:
  - Always pass `--incremental false` to `tsc` so stale `.tsbuildinfo` never masks errors.
  - Ensure all unit tests run deterministically offline in sandbox with zero live network calls.
  - Confirm `src/lib/__tests__/governance.test.ts` still passes (proving `README.md` was not prematurely modified).
- **VALIDATE**:
  1. `npx tsc --noEmit --incremental false`
  2. `npm run lint`
  3. `npm test`
  4. `npm run build`
- **SATISFIES**: AC #4, AC #5, and project validation bar.

---

### 5. Live GitHub PR Check Verification (Task `2.6`)

- **IMPLEMENT**: After committing (`Closes #14` in PR description) and pushing the feature branch / opening the PR:
  1. Run `gh pr checks` against the opened PR and confirm all four CI jobs (`lint`, `typecheck`, `test`, `build`) execute on `ubuntu-latest` and report `pass`.
  2. Inspect the GitHub Actions run summary tab (or logs) to verify each job renders its `$GITHUB_STEP_SUMMARY` Markdown table cleanly.
  3. (Optional before merge) If checking off Task `2.6` in the same PR, update `- [ ] **2.6 ...` to `- [x] **2.6 ...` and note the green PR number in the Iteration Log, then re-verify `gh pr checks` passes.
- **PATTERN**: `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` lines 100–102.
- **GOTCHA**:
  - Do not open more than one PR at a time (Core 1a single-PR rule in `docs/AUTOMATION_WORKFLOW.md`).
  - Do not manually edit `package.json` version, `.release-please-manifest.json`, or `CHANGELOG.md`.
- **VALIDATE**: `gh pr checks <pr-number>` shows `lint`, `typecheck`, `test`, and `build` all `pass`.
- **SATISFIES**: AC #5 / Roadmap Task `2.6`.

---

## TESTING STRATEGY

### Unit Tests

- **Existing offline test suite** (`src/lib/__tests__/checkers.test.ts`, `governance.test.ts`, `version.test.ts`):
  - All external network, DNS, TLS, and HTTP calls (`WhoisChecker`, `SslChecker`, `WebScraper`, `Security.validateHostname`, `tls.connect`, `fetch`) MUST remain mocked so `npm test` executes 100% offline and deterministically in both local sandbox and GitHub Actions `ubuntu-latest`.
- **New workflow contract test suite** (`src/lib/__tests__/ci-workflow.test.ts`):
  - Pure filesystem (`node:fs`) static verification of `.github/workflows/ci.yml` using `node:test` and `node:assert/strict` (no YAML npm package needed).
  - Covers triggers, permissions, concurrency, job names/IDs, parallel execution (no `needs:`), timeouts, 40-char SHA pinning with `# vX.Y.Z` comments, `persist-credentials: false`, Node 24 + `npm` cache, `npm ci`, exact 4 commands, `.next/cache`, `if: always()` `$GITHUB_STEP_SUMMARY`, and absence of `${{` inside `run:` blocks.

### Integration Tests

- **Live GitHub Actions PR Run**: Opening the PR triggers `.github/workflows/ci.yml` on real `ubuntu-latest` runners, proving YAML validity, action SHA reachability, Node 24 setup, `npm ci`, `.next/cache` restore/save, and all 4 job commands end-to-end.

### Edge Cases

- **CRLF vs LF line endings**: `ci-workflow.test.ts` splits lines on `/\r?\n/` so assertions pass identically on Windows (local) and Linux (CI).
- **Failed `npm ci` before check step**: Each `Summarize run` step uses `if: always()` and shell defaults (`${CHECK_OUTCOME:-skipped}`, `${NODE_VERSION:-n/a}`, `${NPM_CACHE_HIT:-false}`) so summaries never fail or print empty cells when an earlier step fails.
- **Push to `main` concurrency**: `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` ensures concurrent PR pushes cancel obsolete runs while pushes to `main` always run to completion.
- **Cache invalidation on version bumps**: `next.config.mjs` reads `package.json` for `NEXT_PUBLIC_APP_VERSION`; including `package.json` in the `actions/cache` key ensures Release Please version bumps do not reuse stale Next.js build caches.

---

## VALIDATION COMMANDS

Execute every command below to confirm zero regressions and 100% compliance before opening/merging the PR.

### Level 1: Typecheck & Lint

```bash
npx tsc --noEmit --incremental false
npm run lint
```

### Level 2: Unit Tests (100% Offline)

```bash
npm test
```

*(Must run deterministically offline in sandbox with all external network/DNS/TLS/HTTP calls mocked, and execute `checkers.test.ts`, `governance.test.ts`, `version.test.ts`, and `ci-workflow.test.ts` with 0 failures.)*

### Level 3: Production Build

```bash
npm run build
```

### Level 4: Live CI Workflow Verification (On PR)

```bash
gh pr checks
```

*(Confirm `lint`, `typecheck`, `test`, and `build` all pass on `ubuntu-latest`.)*

---

## ACCEPTANCE CRITERIA

- [ ] **AC #1**: `.github/workflows/ci.yml` exists and triggers on `pull_request` (`branches: [main]`) and `push` (`branches: [main]`).
- [ ] **AC #2**: `.github/workflows/ci.yml` enforces least-privilege `permissions: { contents: read }`, `timeout-minutes: 10` (`15` for `build`) on every job, and `concurrency` (`group: ${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`).
- [ ] **AC #3**: Every GitHub Action (`actions/checkout`, `actions/setup-node`, `actions/cache`) is pinned to a full 40-char commit SHA with `# vX.Y.Z` comment; `actions/checkout` sets `persist-credentials: false`; `actions/setup-node` uses `node-version: '24'` and `cache: 'npm'`; every job installs via `npm ci`.
- [ ] **AC #4**: Four parallel jobs (`lint`, `typecheck`, `test`, `build`) run `npm run lint`, `npx tsc --noEmit --incremental false`, `npm test`, and `npm run build` (with `.next/cache` cached via SHA-pinned `actions/cache` in `build`), and every job includes an `if: always()` `$GITHUB_STEP_SUMMARY` step using `env:` variables only.
- [ ] **AC #5**: `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` has Tasks `2.1`–`2.5` checked off (`[x]`), an updated Iteration Log row, and Task `2.6` noted/verified on the live PR via `gh pr checks`.
- [ ] **AC #6**: Offline contract tests in `src/lib/__tests__/ci-workflow.test.ts` pass, and all four canonical validation commands (`npx tsc --noEmit --incremental false`, `npm run lint`, `npm test`, `npm run build`) exit `0` with zero errors.

---

## COMPLETION CHECKLIST

- [ ] All tasks (1–5) completed in order
- [ ] `.github/workflows/ci.yml` created with verified 40-char SHAs and `$GITHUB_STEP_SUMMARY` steps
- [ ] `src/lib/__tests__/ci-workflow.test.ts` created and passing offline
- [ ] `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` updated (`2.1`–`2.5` checked off + Iteration Log row)
- [ ] `README.md` untouched (preserving `governance.test.ts` badge guard until `#32`)
- [ ] `npx tsc --noEmit --incremental false` exits `0`
- [ ] `npm run lint` exits `0`
- [ ] `npm test` exits `0` offline (all tests pass, 0 skipped, 0 network calls)
- [ ] `npm run build` exits `0`
- [ ] Live PR `gh pr checks` confirms `lint`, `typecheck`, `test`, and `build` all pass (Task `2.6`)

---

## OPEN QUESTIONS / ASSUMPTIONS

*(Planned autonomously without pausing for interactive Q&A; all items below have concrete, codebase-backed defaults—confirm only if you want to deviate.)*

1. **Assumed — Node.js `'24'` in CI (`actions/setup-node`)**: Issue `#14` AC #3 explicitly specifies `node-version: '24'`, matching local Node `v24.20.0` (Iteration Log for `#13`), `docs/agents/stack.md` (`22.18+ / 24 LTS`), and `engines.node >= 22.18.0`.
2. **Assumed — Latest verified `node24`-native GitHub Actions versions**: Pinned to latest verified releases as of 2026-11-25 (`actions/checkout@v7.0.1`, `actions/setup-node@v7.1.0`, `actions/cache@v6.1.0`) whose `action.yml` manifests were verified directly via `gh api` to support every required input/output and run natively on `node24` (avoiding Node 20 runner deprecation warnings).
3. **Assumed — Exact lowercase job `name:` fields (`lint`, `typecheck`, `test`, `build`)**: Matches `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` Task `2.6` / `5.4`, ADR-002 line 85, and Issue `#32` so future `main` Branch Ruleset required status checks align without renaming.
4. **Assumed — Do NOT add a `CI` badge to `README.md` in `#14`**: `src/lib/__tests__/governance.test.ts` (lines 234–246) explicitly forbids `workflows/ci.yml` badges in `README.md` before Phase C, and Issue `#32` explicitly owns adding live workflow badges (`CI`, `CodeQL`, `Security`).
5. **Assumed — Task `2.6` check-off timing**: Check off Tasks `2.1`–`2.5` in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` in the implementation commit and verify Task `2.6` once the PR is open via `gh pr checks`; optionally check off `2.6` on the PR branch right after all 4 checks turn green (or note it in the Iteration Log for follow-up).
6. **Assumed — Zero new npm dependencies**: `src/lib/__tests__/ci-workflow.test.ts` validates `.github/workflows/ci.yml` with standard Node.js built-ins (`node:test`, `node:assert/strict`, `node:fs`, `node:path`) without adding a YAML parser package (respecting `AGENTS.md` "Ask first: Adding new external npm dependencies").

---

## NOTES (open canvas)

### Why 4 Parallel Jobs Instead of 1 Sequential Job?

- **Faster feedback & granular status checks**: `lint`, `typecheck`, `test`, and `build` run concurrently on separate runners; a lint failure never hides a typecheck or test failure.
- **Branch Ruleset alignment**: Issue `#32` and Roadmap Task `5.4` specifically require four distinct status checks (`lint`, `typecheck`, `test`, `build`).
- **Tailored timeouts**: Lightweight checks (`lint`, `typecheck`, `test`) cap at `10` minutes while Next.js production compilation (`build`) gets `15` minutes and `.next/cache`.

### SHA Verification Provenance (2026-11-25 via `gh api`)

| Action | Release Tag | Verified 40-Char Commit SHA | Runner Runtime |
| :--- | :--- | :--- | :--- |
| `actions/checkout` | `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `node24` |
| `actions/setup-node` | `v7.1.0` | `949feb2413d6458794dcd2491c4babbbce0c15c1` | `node24` |
| `actions/cache` | `v6.1.0` | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | `node24` |

### Why Include `package.json` in `.next/cache` Key?

`next.config.mjs` reads `package.json` at build time to populate `env.NEXT_PUBLIC_APP_VERSION`. Including `package.json` alongside `src/**/*`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.js`, and `postcss.config.js` ensures cached Next.js artifacts invalidate cleanly whenever `release-please` bumps the version or build config changes, while still falling back to the `package-lock.json` restore key for fast incremental rebuilds.

### Confidence Assessment

- **Estimated Confidence Score**: `9.5/10` for one-pass implementation success (exact workflow YAML, verified SHAs, matching offline test pattern, zero external dependencies, and `governance.test.ts` gotcha surfaced upfront).

---

## AMENDMENTS

*(Empty at creation. Append dated entries here if the plan changes after approval/execution.)*

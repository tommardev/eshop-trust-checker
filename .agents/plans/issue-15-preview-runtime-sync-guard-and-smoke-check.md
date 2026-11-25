# Feature: Preview Runtime Verification, `/api/sync-blacklist` Auth Guard, and Automated PR Preview Smoke Check

The following plan should be complete, but it is important that you validate documentation, codebase patterns, and task sanity before you start implementing.

Pay special attention to:
- Existing Node.js native test runner behavior (`node --test "src/**/*.test.ts" "src/**/*.spec.ts"` on Node `22.18+` / `24 LTS` does **not** resolve Next.js `@/*` aliases — keep testable logic in `src/lib/` using `.ts` relative imports).
- All unit tests MUST mock external network, DNS, TLS, and HTTP calls (`WhoisChecker`, `SslChecker`, `WebScraper`, `fetch`) so `npm test` runs deterministically offline in the sandbox.
- Never commit real secrets, never check out untrusted PR code in a workflow holding `VERCEL_AUTOMATION_BYPASS_SECRET`, and never inline `${{ ... }}` expressions inside GitHub Actions `run:` blocks.

## Feature Description

Harden and verify the repository's live Preview Deployment setup (Roadmap Phase 3 Tasks `3.1`, `3.2`, and `3.4`; Task `3.3` Vercel GitHub App integration is already complete and live at `https://eshop-trust-checker.vercel.app`):

1. **Explicit Node.js Runtime Compatibility (`3.1`):** Lock API Route Handlers (`src/app/api/check/route.ts` and `src/app/api/sync-blacklist/route.ts`) to `export const runtime = 'nodejs'`, confirm `next.config.mjs` never enables `output: 'export'`, and verify `npm run build` + `npm run start` locally.
2. **Fail-Closed Auth Guard for `POST /api/sync-blacklist` (`3.2`):** Protect `POST /api/sync-blacklist` behind an optional `SYNC_BLACKLIST_SECRET` environment variable (constant-time comparison supporting `Authorization: Bearer <secret>` and `x-sync-blacklist-secret: <secret>`, returning HTTP `401` fail-closed whenever the env var is configured and credentials are missing or invalid), add `.env.example`, and cover all cases with offline unit tests.
3. **Automated PR Preview Smoke Check (`3.4`):** Add `.github/workflows/preview-smoke.yml` triggered on `deployment_status` (`state == 'success'`) with strict `https://` + `*.vercel.app` / `*.netlify.app` URL allowlist validation **before** sending `x-vercel-protection-bypass`, short retry/backoff probes for `GET /` (`200`) and `POST /api/check` SSRF blocking (`400` + SSRF error JSON), commit status publishing (`context: smoke`) on `github.event.deployment.sha`, `$GITHUB_STEP_SUMMARY` reporting, and offline unit tests validating both the workflow contract and the embedded probe logic.

## User Story

As a maintainer and reviewer of `eshop-trust-checker`
I want API routes locked to the Node.js runtime, `/api/sync-blacklist` protected on public preview URLs, and every successful deployment automatically smoke-tested for homepage availability and SSRF protection
So that shareable PR previews are safe to expose and broken deployments or SSRF regressions are caught before merging.

## Problem Statement

1. `src/app/api/check/route.ts` and `src/app/api/sync-blacklist/route.ts` rely on Node.js built-ins (`node:tls`, `node:dns/promises`, `node:net`) via `src/lib/ssl-checker.ts` and `src/lib/security.ts`, yet do not explicitly declare `export const runtime = 'nodejs'`.
2. `POST /api/sync-blacklist` (`src/app/api/sync-blacklist/route.ts`) currently accepts unauthenticated requests (`export async function POST()`) with no `.env.example` template, allowing anonymous callers on public Vercel preview URLs to trigger outbound VVTAT fetches repeatedly.
3. Although Vercel PR Preview Deployments are active (`3.3`), there is no automated post-deploy smoke workflow verifying that deployed previews actually serve `/` (`200`) and enforce SSRF protection on `POST /api/check` (`400` with SSRF error JSON) or reporting a commit status (`smoke`) back to the PR commit.

## Solution Statement

1. **Runtime Guardrails:** Export `export const runtime = 'nodejs';` alongside `export const dynamic = 'force-dynamic';` in both `src/app/api/check/route.ts` and `src/app/api/sync-blacklist/route.ts`, and verify `next.config.mjs` preserves serverless Node.js output (no `output: 'export'`).
2. **Testable Auth Helper + Route Wiring:** Create `src/lib/sync-blacklist-auth.ts` with a `SyncBlacklistAuth` class (matching `AGENTS.md` static-class conventions) using `node:crypto` (`createHash('sha256')` + `timingSafeEqual`) to validate `x-sync-blacklist-secret` or `Authorization: Bearer <secret>` when `SYNC_BLACKLIST_SECRET` is configured. Wire it into `src/app/api/sync-blacklist/route.ts` before `VvtatChecker.refreshFromOfficialSource()`, returning HTTP `401` fail-closed on failure, and commit `.env.example` with empty placeholder keys only.
3. **Hardened Preview Smoke Workflow:** Create `.github/workflows/preview-smoke.yml` listening to `deployment_status` with top-level `permissions: {}`, job-level `permissions: { deployments: read, statuses: write }`, `timeout-minutes: 5`, and SHA-pinned `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0` (Node 24) — intentionally omitting `actions/checkout` so untrusted PR code is never executed with `VERCEL_AUTOMATION_BYPASS_SECRET` and no `contents: read` permission is required. Validate `TARGET_URL` (`https://`, no userinfo/port, strict `*.vercel.app` / `*.netlify.app` host regex) before attaching `x-vercel-protection-bypass` (only for `*.vercel.app`), probe `GET /` (`200`) and `POST /api/check` (`{"query":"http://127.0.0.1"}` -> `400` JSON with `ssrf` in `error`) with retry/backoff and `redirect: 'manual'`, publish commit status `smoke` via GitHub REST API on `github.event.deployment.sha`, and write an `if: always()` `$GITHUB_STEP_SUMMARY` table.
4. **Offline Verification & Roadmap Sync:** Add `src/lib/__tests__/sync-blacklist-auth.test.ts` and `src/lib/__tests__/preview-smoke-workflow.test.ts` (including offline mocked execution of the actual embedded smoke script), verify `npm run build` + `npm run start` locally, and check off Roadmap Tasks `3.1`, `3.2`, and `3.4` in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`.

## Out of Scope / Non-Goals

- **Not included:** Adding rate limiting or changing request validation/response contracts on `POST /api/check` (tracked in Issue `#6`).
- **Not included:** Fixing VVTAT atomic replacement, `normalizeDomain` during refresh, or HTTP `502` upstream error handling in `VvtatChecker` / `/api/sync-blacklist` (tracked in Issue `#20`; `#15` only adds the `SYNC_BLACKLIST_SECRET` auth gate ahead of the existing `VvtatChecker.refreshFromOfficialSource()` call).
- **Not included:** Connecting Vercel GitHub App / Roadmap Task `3.3` (already complete and marked `[x]` per maintainer comment on `#15`).
- **Not included:** Modifying the `Protect main` GitHub Ruleset to require `smoke` (optional follow-up once `preview-smoke.yml` has run green on a live PR).
- **Not included:** Adding any new npm dependencies (zero changes to `package.json` or `package-lock.json`).
- **Not changing:** Version numbers (`package.json`, `package-lock.json`, `.release-please-manifest.json`, `CHANGELOG.md` are managed exclusively by `release-please`).

## Feature Metadata

**Feature Type**: Enhancement (Deployment Hardening, Auth Guard & CI Smoke Gate)
**Estimated Complexity**: Medium
**Primary Systems Affected**:
- `src/lib/sync-blacklist-auth.ts` (new auth helper)
- `src/app/api/sync-blacklist/route.ts` (runtime export + auth guard)
- `src/app/api/check/route.ts` (explicit Node.js runtime export)
- `.env.example` (new environment template)
- `.github/workflows/preview-smoke.yml` (new GitHub Actions smoke check workflow)
- `src/lib/__tests__/sync-blacklist-auth.test.ts` & `src/lib/__tests__/preview-smoke-workflow.test.ts` (new offline unit tests)
- `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (check off Tasks `3.1`, `3.2`, `3.4` + Iteration Log)
**Dependencies**: Zero new npm packages; uses Node.js built-ins (`node:crypto`, `fetch`, `URL`, `AbortSignal.timeout`) and SHA-pinned `actions/setup-node` (`v7.1.0`).

## Related Work

**Implements**: GitHub Issue `#15` (`https://github.com/tommardev/eshop-trust-checker/issues/15`) · **Roadmap**: `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (Phase 3 Tasks `3.1`, `3.2`, `3.4`)

**Back-references**:
- `.agents/plans/issue-13-ci-prep-node-runtime-test-discovery-and-docs.md` — Node `>=22.18.0` / `24 LTS` runtime alignment and `npm test` multi-file discovery.
- `.agents/plans/issue-14-github-actions-core-ci-workflow.md` — Verified 40-char SHA for `actions/setup-node`, `$GITHUB_STEP_SUMMARY` pattern, and `ci-workflow.test.ts` testing conventions.
- `.agents/plans/issue-32-codeql-security-ruleset.md` — Top-level `permissions: {}` + job-level minimal permissions pattern and `codeql-workflow.test.ts` contract testing pattern.

**Forward-references**:
- Issue `#20` (`Data: Fix VVTAT blacklist sync`) — Extends `src/app/api/sync-blacklist/route.ts` after `#15`; must preserve `#15`'s `SYNC_BLACKLIST_SECRET` auth guard.
- Issue `#21` (`Data: Sync LbChecker`) — Reuses `/api/sync-blacklist` after `#15` and `#20`.
- Issue `#19` (`QA: Playwright/axe WCAG 2.2 AA check`) — Builds on Preview Deployments and `VERCEL_AUTOMATION_BYPASS_SECRET` pattern established here.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `src/app/api/sync-blacklist/route.ts` (lines 1-22) — Target API route where `runtime = 'nodejs'` and the `SYNC_BLACKLIST_SECRET` auth guard must be added before `VvtatChecker.refreshFromOfficialSource()`.
- `src/app/api/check/route.ts` (lines 1-84) — Target API route where `runtime = 'nodejs'` is added; also defines the exact `POST /api/check` SSRF behavior (`body.query` -> `Security.isSafeInputTarget` -> HTTP `400` `{ error: "... (SSRF apsauga)." }`).
- `src/lib/security.ts` (lines 1-2, 79-119) — Uses `node:dns/promises` and `node:net`; line 109 defines exact loopback SSRF error message: `'Prieiga prie privačių ar rezervuotų IP adresų draudžiama (SSRF apsauga).'`.
- `src/lib/ssl-checker.ts` (lines 1-15) — Uses `node:tls`, confirming Node.js runtime requirement.
- `next.config.mjs` (lines 1-14) — Uses `node:fs` (`readFileSync`); confirms `output: 'export'` is NOT set.
- `.gitignore` (lines 17-25) — Ignores `.env*` while explicitly allowing `!.env.example` (line 19).
- `.github/workflows/ci.yml` (lines 1-69) — Canonical SHA for `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0` and `$GITHUB_STEP_SUMMARY` (`if: always()` + `env:` indirection).
- `.github/workflows/codeql.yml` (lines 15-35) — Canonical top-level `permissions: {}` + job-level minimal permissions pattern.
- `src/lib/__tests__/codeql-workflow.test.ts` (lines 1-120, 282-591) — Canonical offline YAML contract test helpers (`extractIndentedBlock`, `extractJobs`, `extractJobSteps`, `extractUsesLines`, `extractRunBlocks`) to mirror.
- `src/lib/__tests__/version.test.ts` (lines 127-138) — Existing `next.config.mjs` runtime contract test pattern.
- `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (lines 119-151, 253-261) — Roadmap Tasks `3.1`, `3.2`, `3.3` (already `[x]`), `3.4`, and Iteration Log table.
- `docs/agents/security.md` (lines 30-42) — Repo secrets and GitHub Actions workflow hardening rules (including line 42 on validating `deployment_status.target_url` before sending `x-vercel-protection-bypass`).
- `docs/agents/conventions.md` (lines 34, 50-54) — API route placement and mandatory `$GITHUB_STEP_SUMMARY` rule.
- `docs/agents/testing.md` (lines 11-44) — Canonical 4 validation commands and offline mocking mandate.

### New Files to Create

- `.env.example` — Template documenting optional `SYNC_BLACKLIST_SECRET=` (empty value, zero secrets) and noting `VERCEL_AUTOMATION_BYPASS_SECRET` for GitHub Actions.
- `src/lib/sync-blacklist-auth.ts` — Pure, constant-time auth verification helper (`SyncBlacklistAuth`) using `node:crypto`.
- `.github/workflows/preview-smoke.yml` — Hardened `deployment_status` preview smoke check workflow with URL allowlist validation, retry/backoff probes, commit status publishing, and `$GITHUB_STEP_SUMMARY`.
- `src/lib/__tests__/sync-blacklist-auth.test.ts` — Offline unit tests for `SyncBlacklistAuth`, API route Node runtime / auth wiring contract, `next.config.mjs`, and `.env.example`.
- `src/lib/__tests__/preview-smoke-workflow.test.ts` — Offline YAML contract tests + offline mocked behavioral execution tests of the embedded smoke probe script.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [Vercel Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
  - Specific section: `Using Protection Bypass for Automation` -> Method 1 HTTP header `x-vercel-protection-bypass`.
  - Why: Confirms header name and why HTTP headers must be used instead of query params (avoiding URL log leaks).
- [GitHub REST API: Create a Commit Status](https://docs.github.com/en/rest/commits/statuses#create-a-commit-status)
  - Specific section: `POST /repos/{owner}/{repo}/statuses/{sha}` (`state`, `context`, `description` max 140 chars, `target_url`).
  - Why: Required to publish the `smoke` commit status on `github.event.deployment.sha`.
- [GitHub Actions: Workflow Commands — Adding a Job Summary](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary)
  - Specific section: Writing Markdown to `$GITHUB_STEP_SUMMARY`.
  - Why: Required by `AGENTS.md` and `docs/agents/conventions.md` for every workflow in `.github/workflows/`.
- [Next.js Route Segment Config — `runtime`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#runtime)
  - Specific section: `export const runtime = 'nodejs'`.
  - Why: Guarantees API Route Handlers using `node:tls`, `node:dns/promises`, and `node:net` run on the Node.js runtime.

#### Verified 40-char Action SHA (Already Audited in `.github/workflows/ci.yml`)

| Action | Version Comment | 40-char Commit SHA | Source in Repo |
| :--- | :--- | :--- | :--- |
| `actions/setup-node` | `# v7.1.0` | `949feb2413d6458794dcd2491c4babbbce0c15c1` | `.github/workflows/ci.yml:37` |

### Patterns to Follow

**1. Static Utility Class Pattern (`AGENTS.md` + `src/lib/security.ts`):**
```ts
import { createHash, timingSafeEqual } from 'node:crypto';

export interface SyncBlacklistAuthResult {
  authorized: boolean;
  mode: 'disabled' | 'enforced';
  reason?: string;
}

export class SyncBlacklistAuth {
  public static readonly SECRET_HEADER = 'x-sync-blacklist-secret';

  public static verify(
    headers: Pick<Headers, 'get'>,
    expectedSecret: string | undefined = process.env.SYNC_BLACKLIST_SECRET,
  ): SyncBlacklistAuthResult {
    // ...
  }
}
```

**2. Next.js App Router Route Handler Pattern (`src/app/api/check/route.ts:1-6`):**
```ts
import { NextRequest, NextResponse } from 'next/server';
import { SyncBlacklistAuth } from '@/lib/sync-blacklist-auth';
import { VvtatChecker } from '@/lib/vvtat-checker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

**3. GitHub Actions Hardened Workflow & Summary Pattern (`.github/workflows/codeql.yml` & `ci.yml`):**
```yaml
permissions: {}

jobs:
  smoke:
    name: smoke
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      deployments: read
      statuses: write
```
Every `${{ ... }}` expression is passed through `env:` and NEVER inlined inside any `run:` block; the final step uses `if: always()` and pipes Markdown to `| tee -a "$GITHUB_STEP_SUMMARY"`.

**4. Offline `node:test` Import Pattern (`src/lib/__tests__/*.test.ts`):**
- Always use explicit `.ts` extensions on relative imports in `src/lib/__tests__/` (e.g. `import { SyncBlacklistAuth } from '../sync-blacklist-auth.ts';`).
- Never import `@/*` or `next/server` directly inside `node --test` files; keep framework-agnostic logic in `src/lib/` and assert Next.js route wiring via source/contract checks plus local `next start` verification.

---

## IMPLEMENTATION PLAN

### Phase 1: Runtime Guardrails & `/api/sync-blacklist` Auth Guard (Tasks `3.1` & `3.2`)

Lock API routes to the Node.js runtime, create `.env.example`, implement constant-time `SYNC_BLACKLIST_SECRET` verification in `src/lib/sync-blacklist-auth.ts`, and wire it into `src/app/api/sync-blacklist/route.ts`.

**Tasks:**
- Create `.env.example` documenting `SYNC_BLACKLIST_SECRET=`.
- Create `src/lib/sync-blacklist-auth.ts` with `SyncBlacklistAuth`.
- Update `src/app/api/sync-blacklist/route.ts` with `runtime = 'nodejs'` and fail-closed `401` auth check.
- Update `src/app/api/check/route.ts` with `runtime = 'nodejs'`.

### Phase 2: Automated PR Preview Smoke Check Workflow (Task `3.4`)

**Independent of:** Phase 1 (can be authored independently, though both share offline test verification in Phase 3).

Create `.github/workflows/preview-smoke.yml` with strict URL allowlist validation prior to attaching `x-vercel-protection-bypass`, retry/backoff probes for `GET /` (`200`) and `POST /api/check` (`400` + SSRF JSON), `smoke` commit status publishing on `github.event.deployment.sha`, and `$GITHUB_STEP_SUMMARY`.

**Tasks:**
- Create `.github/workflows/preview-smoke.yml`.

### Phase 3: Offline Unit Tests, Roadmap Sync & Local Production Server Verification

**Depends on:** Phase 1 and Phase 2.

Add comprehensive offline unit tests for both the auth guard/runtime contracts and the preview smoke workflow (including offline mocked execution of the embedded probe script), update `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`, and run all 4 validation commands plus a local `next start` smoke verification.

**Tasks:**
- Create `src/lib/__tests__/sync-blacklist-auth.test.ts`.
- Create `src/lib/__tests__/preview-smoke-workflow.test.ts`.
- Update `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (Tasks `3.1`, `3.2`, `3.4` + Iteration Log).
- Run `npx tsc --noEmit --incremental false`, `npm run lint`, `npm test`, `npm run build`, and local `next start` probe.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### 1. CREATE `.env.example`

- **IMPLEMENT**: Create `.env.example` at the repository root containing only empty placeholder variable declarations and comments (zero real secrets):
  ```dotenv
  # Copy this file to .env.local for local overrides (never commit .env.local).

  # Optional secret protecting POST /api/sync-blacklist on public previews/production.
  # When set to a non-empty value, callers must supply either:
  #   Authorization: Bearer <SYNC_BLACKLIST_SECRET>
  #   or
  #   x-sync-blacklist-secret: <SYNC_BLACKLIST_SECRET>
  # Leave unset (or empty) to keep local development open without auth.
  SYNC_BLACKLIST_SECRET=

  # CI / GitHub Actions only (configure in GitHub Repository Secrets, not .env.local):
  # VERCEL_AUTOMATION_BYPASS_SECRET - Optional Vercel Protection Bypass secret used by
  # .github/workflows/preview-smoke.yml when Vercel Deployment Protection is enabled.
  ```
- **PATTERN**: `.gitignore:18-19` already ignores `.env*` and explicitly un-ignores `!.env.example`.
- **IMPORTS**: None.
- **GOTCHA**: Never populate real values or sample secret strings that could trip Gitleaks/GitHub Secret Scanning. Keep `SYNC_BLACKLIST_SECRET=` empty.
- **VALIDATE**: `node -e "const fs=require('node:fs'); const txt=fs.readFileSync('.env.example','utf8'); if(!/^SYNC_BLACKLIST_SECRET=$/m.test(txt)) process.exit(1); console.log('OK');"`
- **SATISFIES**: AC #2 (Roadmap Task `3.2`)

### 2. CREATE `src/lib/sync-blacklist-auth.ts`

- **IMPLEMENT**: Create `src/lib/sync-blacklist-auth.ts` implementing:
  - `export interface SyncBlacklistAuthResult { authorized: boolean; mode: 'disabled' | 'enforced'; reason?: string; }`
  - `export class SyncBlacklistAuth` with:
    - `public static readonly SECRET_HEADER = 'x-sync-blacklist-secret';`
    - `public static extractProvidedSecret(headers: Pick<Headers, 'get'>): string | null`:
      1. Read `headers.get(this.SECRET_HEADER)`. If non-null (header present), return its `.trim()` if non-empty, else `null` (fail closed when `x-sync-blacklist-secret` is explicitly sent blank — do NOT fall through to `Authorization`).
      2. Otherwise read `headers.get('authorization')`. If non-null, match `/^Bearer\s+(\S+)$/i` against `.trim()`. Return capture group 1 on match, else `null`.
      3. Otherwise return `null`.
    - `public static timingSafeMatch(provided: string, expected: string): boolean`:
      - Hash both UTF-8 strings with `createHash('sha256').update(...).digest()` and compare with `timingSafeEqual(providedDigest, expectedDigest)`. (Avoids length-oracle timing leaks and never throws `RangeError` on mismatched lengths.)
    - `public static verify(headers: Pick<Headers, 'get'>, expectedSecret: string | undefined = process.env.SYNC_BLACKLIST_SECRET): SyncBlacklistAuthResult`:
      - Normalize `const trimmedExpected = typeof expectedSecret === 'string' ? expectedSecret.trim() : '';`
      - If `trimmedExpected.length === 0`, return `{ authorized: true, mode: 'disabled' }`.
      - Extract `const provided = this.extractProvidedSecret(headers);`
      - If `!provided`, return `{ authorized: false, mode: 'enforced', reason: 'Missing or malformed sync secret header.' }`.
      - If `!this.timingSafeMatch(provided, trimmedExpected)`, return `{ authorized: false, mode: 'enforced', reason: 'Invalid sync secret.' }`.
      - Return `{ authorized: true, mode: 'enforced' }`.
- **PATTERN**: `src/lib/security.ts` (static class methods, explicit Node built-in imports with `node:` prefix).
- **IMPORTS**: `import { createHash, timingSafeEqual } from 'node:crypto';`
- **GOTCHA**:
  - Do NOT import `next/server` here — use `Pick<Headers, 'get'>` so this module runs natively under `node --test` without Next.js module resolution.
  - Never log `provided` or `expectedSecret`.
  - See `OPEN QUESTIONS / ASSUMPTIONS` (#1, #2) regarding header support (`Authorization: Bearer` + `x-sync-blacklist-secret`) and empty-string env var behavior.
- **VALIDATE**: `npx tsc --noEmit --incremental false`
- **SATISFIES**: AC #2 (Roadmap Task `3.2`)

### 3. UPDATE `src/app/api/sync-blacklist/route.ts`

- **IMPLEMENT**:
  1. Change line 1 import to `import { NextRequest, NextResponse } from 'next/server';`.
  2. Add `import { SyncBlacklistAuth } from '@/lib/sync-blacklist-auth';`.
  3. Add `export const runtime = 'nodejs';` directly above `export const dynamic = 'force-dynamic';`.
  4. Update `export async function POST()` to `export async function POST(request: NextRequest)`.
  5. At the very top of `POST(request)` (before `try { const updatedCount = await VvtatChecker.refreshFromOfficialSource(); ... }`):
     ```ts
     const auth = SyncBlacklistAuth.verify(request.headers, process.env.SYNC_BLACKLIST_SECRET);
     if (!auth.authorized) {
       return NextResponse.json(
         { error: 'Neautorizuota užklausa. Reikalingas galiojantis sinchronizavimo raktas.' },
         { status: 401, headers: { 'Cache-Control': 'no-store' } }
       );
     }
     ```
  6. Keep the existing `try/catch`, `200` JSON payload, and `500` error handling intact so Issue `#20` merges cleanly later.
- **PATTERN**: `src/app/api/check/route.ts:1-6` (`NextRequest`, `NextResponse`, `dynamic = 'force-dynamic'`).
- **IMPORTS**: `NextRequest`, `NextResponse` from `'next/server'`, `SyncBlacklistAuth` from `'@/lib/sync-blacklist-auth'`, `VvtatChecker` from `'@/lib/vvtat-checker'`.
- **GOTCHA**: Do NOT return `auth.reason` verbatim in the HTTP `401` JSON body (keep the client error generic to avoid leaking whether the header was missing vs invalid). Do NOT log `request.headers`.
- **VALIDATE**: `npx tsc --noEmit --incremental false && npm run lint`
- **SATISFIES**: AC #1, AC #2 (Roadmap Tasks `3.1`, `3.2`)

### 4. UPDATE `src/app/api/check/route.ts`

- **IMPLEMENT**: Add `export const runtime = 'nodejs';` right above `export const dynamic = 'force-dynamic';` (line 6). Leave all request handling, SSRF checks, and response schemas untouched.
- **PATTERN**: Next.js 15 App Router segment config (`export const runtime = 'nodejs';`).
- **IMPORTS**: Unchanged.
- **GOTCHA**: Do NOT modify `POST` or `GET` validation or add rate limiting here (owned by Issue `#6`).
- **VALIDATE**: `npx tsc --noEmit --incremental false && npm run lint`
- **SATISFIES**: AC #1 (Roadmap Task `3.1`)

### 5. CREATE `.github/workflows/preview-smoke.yml`

- **IMPLEMENT**: Create `.github/workflows/preview-smoke.yml` with the following exact structure and security controls:
  - `name: Preview Smoke Check`
  - `on: { deployment_status: }` (no `pull_request_target`, no `types:` field — GitHub `deployment_status` does not support activity types).
  - Top-level `permissions: {}` (least privilege; matches `codeql.yml` and `release-please.yml`).
  - Top-level `concurrency`:
    ```yaml
    concurrency:
      group: ${{ github.workflow }}-${{ github.event.deployment.id }}
      cancel-in-progress: false
    ```
  - Single job `smoke`:
    - `name: smoke`
    - `if: github.event.deployment_status.state == 'success'`
    - `runs-on: ubuntu-latest`
    - `timeout-minutes: 5`
    - `permissions:`
      - `deployments: read`
      - `statuses: write`
    - **Step 1 (`id: setup-node`):**
      ```yaml
      - name: Setup Node.js
        id: setup-node
        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: '24'
      ```
      *(Do NOT add `actions/checkout` or `cache: 'npm'`: omitting checkout keeps exact `permissions: { deployments: read, statuses: write }` without needing `contents: read` and guarantees untrusted PR code is never executed alongside `VERCEL_AUTOMATION_BYPASS_SECRET`.)*
    - **Step 2 (`id: smoke-probe`):** Run self-contained Node 24 smoke probe via `node <<'EOF'` with `env:` passing:
      - `TARGET_URL: ${{ github.event.deployment_status.environment_url || github.event.deployment_status.target_url }}`
      - `DEPLOYMENT_ENVIRONMENT: ${{ github.event.deployment_status.environment }}`
      - `VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}`
      Script behavior (deterministic and offline-testable):
      1. Helper `writeOutput(key, value)` appends sanitized single-line `key=value` to `process.env.GITHUB_OUTPUT` if set.
      2. **Strict URL Allowlist Validation (BEFORE any `fetch` call or bypass header construction):**
         - Require non-empty `TARGET_URL`.
         - Parse with `new URL(rawUrl)`.
         - Require `parsed.protocol === 'https:'`.
         - Require `parsed.username === '' && parsed.password === ''`.
         - Require `parsed.port === ''`.
         - Require `hostname = parsed.hostname.toLowerCase()` matches `/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:vercel\.app|netlify\.app)$/`.
         - Use `origin = parsed.origin` (drops any trailing path/query/hash).
      3. **Conditional Bypass Header Attachment (ONLY after allowlist passes):**
         - Build base headers `{ Accept: 'text/html,application/json' }`.
         - Attach `'x-vercel-protection-bypass': bypassSecret` **ONLY** when `bypassSecret` is non-empty AND `hostname.endsWith('.vercel.app')`. (Never leak Vercel bypass secret to `*.netlify.app` or non-allowlisted hosts!)
      4. **Retry/Backoff Helper (`fetchWithRetry`):**
         - Up to `5` attempts (`maxAttempts = 5`), backoff delays parsed from optional `SMOKE_BACKOFF_MS` (default `2000,4000,6000,8000` ms — lets offline unit tests pass `SMOKE_BACKOFF_MS=0,0,0,0` for instant deterministic testing!).
         - Every `fetch` uses `redirect: 'manual'` (prevents following redirects to SSO login pages or off-origin hosts with bypass headers) and `signal: AbortSignal.timeout(10000)`.
         - Retry on thrown network/DNS/TLS/timeout errors or HTTP status in `[404, 429, 502, 503, 504]`.
         - Fail fast on HTTP `401`/`403` with a clear message mentioning `VERCEL_AUTOMATION_BYPASS_SECRET` (never printing the secret).
      5. **Probe 1 (`GET ${origin}/`):**
         - Expect HTTP `200`. Record `home_status` output.
      6. **Probe 2 (`POST ${origin}/api/check`):**
         - Send `method: 'POST'`, headers `{ ...baseHeaders, 'Content-Type': 'application/json', Accept: 'application/json' }`, body `JSON.stringify({ query: 'http://127.0.0.1' })`.
         - Expect HTTP `400`. Record `ssrf_status` output.
         - Verify `content-type` header contains `application/json`.
         - Parse response body with `JSON.parse`; verify `body && typeof body === 'object' && typeof body.error === 'string' && body.error.toLowerCase().includes('ssrf')`.
         - Reject any proxy/WAF/HTML `400` or generic JSON `400` lacking an SSRF error message.
      7. On success, write `validated_origin`, `home_status`, `ssrf_status`, `detail=Preview smoke checks passed (GET / 200, POST /api/check SSRF 400).` to `$GITHUB_OUTPUT` and exit `0`.
      8. On any error, write `detail=<concise sanitized error>` to `$GITHUB_OUTPUT`, log error to `stderr` (never logging secrets), and exit `1`.
    - **Step 3 (`id: commit-status`, `if: always()`):** Publish commit status `smoke` on `github.event.deployment.sha`:
      - `env:` passes `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`, `GITHUB_REPOSITORY: ${{ github.repository }}`, `DEPLOYMENT_SHA: ${{ github.event.deployment.sha }}`, `RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}`, `SMOKE_OUTCOME: ${{ steps.smoke-probe.outcome }}`, `SMOKE_DETAIL: ${{ steps.smoke-probe.outputs.detail }}`.
      - Uses Node 24 `fetch` to `POST https://api.github.com/repos/${repo}/statuses/${sha}` with:
        - `Authorization: Bearer ${token}`
        - `Accept: application/vnd.github+json`
        - `X-GitHub-Api-Version: 2022-11-28`
        - `Content-Type: application/json`
        - JSON body: `{ state: outcome === 'success' ? 'success' : 'failure', context: 'smoke', description: truncatedDescription140, target_url: runUrl }`
      - Validates `DEPLOYMENT_SHA` matches `/^[0-9a-f]{40}$/i` and `GITHUB_REPOSITORY` matches `/^[\w.-]+\/[\w.-]+$/` before calling the API.
      - Fails the step if GitHub API returns non-2xx.
    - **Step 4 (`name: Summarize run`, `if: always()`):**
      - Passes `EVENT_NAME`, `DEPLOYMENT_ENVIRONMENT`, `DEPLOYMENT_STATE`, `DEPLOYMENT_SHA`, `NODE_VERSION`, `VALIDATED_ORIGIN`, `HOME_STATUS`, `SSRF_STATUS`, `PROBE_OUTCOME`, `STATUS_OUTCOME`, `PROBE_DETAIL` via `env:`.
      - Writes a concise Markdown summary table (`### Preview Smoke Summary`) via `| tee -a "$GITHUB_STEP_SUMMARY"`.
      - NEVER prints `VERCEL_AUTOMATION_BYPASS_SECRET` or `GITHUB_TOKEN`.
- **PATTERN**: `.github/workflows/codeql.yml` (top-level `permissions: {}`, job-level permissions, `if: always()` summary via `env:`) and `.github/workflows/ci.yml` (`actions/setup-node` SHA).
- **IMPORTS**: Uses only `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`.
- **GOTCHA**:
  - ZERO `${{` expressions inside any `run:` block! Every GitHub expression must go through `env:`.
  - GitHub commit status `description` has a strict 140-character limit (`POST /repos/{owner}/{repo}/statuses/{sha}` returns `422` if > 140 chars); truncate cleanly to `<= 140` chars.
  - Because `smoke-probe` can fail, `commit-status` MUST have `if: always()` so failed deployments report `state: 'failure'` to GitHub (never leaving a PR check missing/hanging) while the workflow job itself still fails due to `smoke-probe` failing.
  - See `OPEN QUESTIONS / ASSUMPTIONS` (#3, #4, #5) regarding `environment_url || target_url`, `context: smoke`, and omitting `actions/checkout`.
- **VALIDATE**: `npm test` (once Task 7 is created)
- **SATISFIES**: AC #3, AC #4, AC #5 (Roadmap Task `3.4`)

### 6. CREATE `src/lib/__tests__/sync-blacklist-auth.test.ts`

- **IMPLEMENT**: Create offline deterministic unit tests using `node:test` and `node:assert/strict` covering:
  1. **Auth disabled mode (optional secret unset/blank):**
     - `SyncBlacklistAuth.verify(new Headers(), undefined)` -> `{ authorized: true, mode: 'disabled' }`.
     - Empty string `''` and whitespace `'   '` -> `{ authorized: true, mode: 'disabled' }`.
  2. **Auth enforced mode (fail-closed when `SYNC_BLACKLIST_SECRET` is set):**
     - Missing headers -> `{ authorized: false, mode: 'enforced' }`.
     - Wrong `Authorization` scheme (`Basic dXNlcjpwYXNz`) -> `authorized: false`.
     - Malformed Bearer (`Bearer`, `Bearer token extra`) -> `authorized: false`.
     - Wrong Bearer token (same length and different length, proving `timingSafeEqual` handles mismatched lengths without throwing) -> `authorized: false`.
     - Wrong `x-sync-blacklist-secret` header -> `authorized: false`.
     - Blank `x-sync-blacklist-secret:   ` paired with a valid `Authorization: Bearer <secret>` -> `authorized: false` (explicit header fails closed, no silent fallthrough).
     - Matching `Authorization: Bearer <secret>` and case-insensitive `bearer <secret>` -> `{ authorized: true, mode: 'enforced' }`.
     - Matching `x-sync-blacklist-secret: <secret>` (including trimmed whitespace around expected/header) -> `{ authorized: true, mode: 'enforced' }`.
  3. **Node.js Runtime & Route Wiring Contract (Task `3.1` & `3.2` regression guard):**
     - Assert `src/app/api/check/route.ts` exports `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`, and does NOT set `runtime = 'edge'`.
     - Assert `src/app/api/sync-blacklist/route.ts` exports `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`, does NOT set `runtime = 'edge'`, imports and calls `SyncBlacklistAuth.verify(...)`, and returns `status: 401` when unauthorized.
     - Assert `src/lib/ssl-checker.ts` imports `node:tls` and `src/lib/security.ts` imports `node:dns/promises` and `node:net`.
     - Assert `next.config.mjs` does NOT configure `output: 'export'`.
     - Assert `.env.example` exists, declares `SYNC_BLACKLIST_SECRET=` with an empty value, and does not contain populated secrets.
- **PATTERN**: `src/lib/__tests__/version.test.ts` and `src/lib/__tests__/checkers.test.ts` (explicit `.ts` relative imports, `node:test`, `node:assert/strict`, zero live network calls).
- **IMPORTS**: `describe`, `it` from `'node:test'`, `assert` from `'node:assert/strict'`, `existsSync`, `readFileSync` from `'node:fs'`, `path` from `'node:path'`, `fileURLToPath` from `'node:url'`, `SyncBlacklistAuth` from `'../sync-blacklist-auth.ts'`.
- **GOTCHA**: Restore any env mutations in `try/finally` (prefer passing `expectedSecret` explicitly to `SyncBlacklistAuth.verify(headers, secret)` to avoid mutating `process.env`, with one isolated `try/finally` test confirming default `process.env.SYNC_BLACKLIST_SECRET` reading).
- **VALIDATE**: `node --test src/lib/__tests__/sync-blacklist-auth.test.ts`
- **SATISFIES**: AC #1, AC #2 (Roadmap Tasks `3.1`, `3.2`)

### 7. CREATE `src/lib/__tests__/preview-smoke-workflow.test.ts`

- **IMPLEMENT**: Create offline unit tests mirroring `src/lib/__tests__/codeql-workflow.test.ts` with TWO test suites:
  1. **Suite A — `.github/workflows/preview-smoke.yml` YAML & Hardening Contract:**
     - Workflow file exists, uses spaces (no tabs), `name: Preview Smoke Check`, triggers on `deployment_status`, never uses `pull_request_target`.
     - Top-level `permissions: {}` (no `write-all`, no `contents: write`).
     - Single `smoke` job with `if: github.event.deployment_status.state == 'success'`, `runs-on: ubuntu-latest`, `timeout-minutes: 5`, and exact job permissions `['deployments: read', 'statuses: write']`.
     - Every `uses:` declaration matches 40-char SHA regex with `# vX.Y.Z` (`actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`, `node-version: '24'`).
     - `smoke-probe` step passes `TARGET_URL` (referencing `github.event.deployment_status.target_url`), `VERCEL_AUTOMATION_BYPASS_SECRET` via `env:`.
     - `commit-status` step has `if: always()`, passes `DEPLOYMENT_SHA: ${{ github.event.deployment.sha }}` via `env:`, and posts to `/statuses/` with `context: 'smoke'`.
     - `Summarize run` step has `if: always()`, passes expressions via `env:`, writes to `$GITHUB_STEP_SUMMARY`, and does NOT reference `VERCEL_AUTOMATION_BYPASS_SECRET` or `GITHUB_TOKEN`.
     - Across ALL `run:` blocks in the workflow, ZERO inline `${{` expressions exist.
  2. **Suite B — Offline Behavioral Execution of the Embedded Smoke Probe Script (Mocked `fetch`, Zero Network Calls):**
     - Extract the exact `node <<'EOF' ... EOF` script body from the `smoke-probe` step of `.github/workflows/preview-smoke.yml`.
     - Run it offline via `spawnSync(process.execPath, ['--input-type=module', '-e', harness], { env: ... })` (or CommonJS wrapper) where `harness` installs a deterministic mock `globalThis.fetch` BEFORE executing the extracted script body, with `SMOKE_BACKOFF_MS=0,0,0,0` and a temp/null `GITHUB_OUTPUT` capture.
     - Test cases (100% offline, zero real sockets):
       1. **Allowlist rejection BEFORE `fetch`:** `http://eshop.vercel.app`, `https://evil.com`, `https://vercel.app.evil.com`, `https://vercel.app`, `https://eshop.vercel.app@evil.com`, `https://eshop.vercel.app:8443`, and empty `TARGET_URL` all exit non-zero with `fetchCallCount === 0` (proving `x-vercel-protection-bypass` is NEVER sent to untrusted URLs).
       2. **Happy path (`*.vercel.app` + bypass header):** Mock `GET /` -> `200`, mock `POST /api/check` (`{"query":"http://127.0.0.1"}`) -> `400` `application/json` `{"error":"Prieiga prie privačių ar rezervuotų IP adresų draudžiama (SSRF apsauga)."}`. Assert exit code `0`, `x-vercel-protection-bypass` header sent, `redirect: 'manual'` used, and expected outputs written.
       3. **Host isolation (`*.netlify.app`):** Same happy path for `https://deploy-preview-15--eshop.netlify.app` with `VERCEL_AUTOMATION_BYPASS_SECRET` set — assert exit code `0` AND `x-vercel-protection-bypass` header was **NOT** sent to Netlify!
       4. **False-pass prevention (proxy `400` HTML & generic `400` JSON):** Mock `POST /api/check` returning `400` `text/html` (`<html>Bad Request</html>`) -> assert exit code non-zero. Mock `POST /api/check` returning `400` `application/json` `{"error":"Bad request"}` (no `ssrf`) -> assert exit code non-zero.
       5. **Retry/backoff resilience & `401` fail-fast:** Mock first `GET /` returning `503` (or throwing transient error) then `200` on attempt 2 -> assert exit code `0` and `>= 2` GET attempts. Mock `GET /` returning `401` -> assert non-zero exit on attempt 1 (fail fast) without leaking secret in output.
- **PATTERN**: `src/lib/__tests__/codeql-workflow.test.ts` (YAML section extractors + assertions).
- **IMPORTS**: `describe`, `it` from `'node:test'`, `assert` from `'node:assert/strict'`, `existsSync`, `readFileSync` from `'node:fs'`, `spawnSync` from `'node:child_process'`, `path` from `'node:path'`, `fileURLToPath` from `'node:url'`.
- **GOTCHA**:
  - Must work identically on Windows (`pwsh`) and Linux (`ubuntu-latest`): handle `\r?\n` line endings when extracting the `node <<'EOF'` script and avoid shell-specific escaping in `spawnSync` (pass `process.execPath` directly with array args, `shell: false`).
  - Ensure ZERO real network calls can occur even if a test fails (mock `globalThis.fetch` unconditionally throws if called unexpectedly).
- **VALIDATE**: `node --test src/lib/__tests__/preview-smoke-workflow.test.ts`
- **SATISFIES**: AC #3, AC #4, AC #5 (Roadmap Task `3.4`)

### 8. UPDATE `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`

- **IMPLEMENT**:
  1. Mark Tasks `3.1`, `3.2`, and `3.4` as `[x]` (leaving `3.3` already `[x]`).
  2. Append a concise row to the `## Iteration Log` table at the bottom documenting the date, Task IDs `3.1, 3.2, 3.4`, branch/issue (`Issue #15`), and verification summary.
- **PATTERN**: Existing Iteration Log entries at `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md:258-261`.
- **IMPORTS**: None.
- **GOTCHA**: Do NOT check off Phase 4/5/6 tasks (`4.1`–`4.3`, `5.1`–`5.3`, `6.1`–`6.3`) — those belong to Issues `#16`–`#19`.
- **VALIDATE**: `node -e "const fs=require('node:fs'); const t=fs.readFileSync('docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md','utf8'); for (const id of ['3.1','3.2','3.3','3.4']) { if (!t.includes('- [x] **'+id+' ')) { console.error('Missing checked', id); process.exit(1); } } console.log('Phase 3 all checked');"`
- **SATISFIES**: AC #6

### 9. VERIFY Local Production Server (`npm run build` + `npm run start` Smoke Probe)

- **IMPLEMENT**: Verify AC #1 and AC #2 end-to-end against a real local Next.js production build (single command in sandbox so localhost is reachable from the same command on Windows):
  1. Run `npm run build`.
  2. Start `npx next start -H 127.0.0.1 -p 3150` with `SYNC_BLACKLIST_SECRET=local-verify-secret`, wait for port readiness, probe:
     - `GET http://127.0.0.1:3150/` -> expect HTTP `200`.
     - `POST http://127.0.0.1:3150/api/check` with `{"query":"http://127.0.0.1"}` -> expect HTTP `400` and JSON `error` containing `SSRF`.
     - `POST http://127.0.0.1:3150/api/sync-blacklist` with NO auth header -> expect HTTP `401`.
     - `POST http://127.0.0.1:3150/api/sync-blacklist` with wrong header `x-sync-blacklist-secret: wrong` -> expect HTTP `401`.
  3. Cleanly terminate the `next start` child process in `finally`.
- **PATTERN**: Local production verification matching Roadmap Task `3.1` & `3.2`.
- **IMPORTS**: None (validation command only).
- **GOTCHA**: Do NOT send a valid `SYNC_BLACKLIST_SECRET` to `POST /api/sync-blacklist` during offline verification, because an authorized call triggers a live external fetch to VVTAT (`vvtat.lrv.lt`). Verifying `401` on missing/invalid headers confirms the guard fails closed with zero external calls.
- **VALIDATE**: Run the one-liner Node verification script in Level 4 below.
- **SATISFIES**: AC #1, AC #2 (Roadmap Tasks `3.1`, `3.2`)

---

## TESTING STRATEGY

### Unit Tests

All unit tests run via `npm test` (`node --test "src/**/*.test.ts" "src/**/*.spec.ts"`) using Node.js 24 native test runner and `node:assert/strict`. **Mandatory offline constraint:** All unit tests MUST mock external network, DNS, TLS, and HTTP calls (`WhoisChecker`, `SslChecker`, `WebScraper`, `fetch`) so `npm test` executes deterministically offline in the sandbox with zero network dependency.

- `src/lib/__tests__/sync-blacklist-auth.test.ts`:
  - Tests `SyncBlacklistAuth.verify`, `extractProvidedSecret`, and `timingSafeMatch` across disabled and enforced modes.
  - Tests Node.js runtime declarations (`runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, absence of `edge`/`output: 'export'`) and `.env.example` presence/emptiness.
- `src/lib/__tests__/preview-smoke-workflow.test.ts`:
  - Validates `.github/workflows/preview-smoke.yml` structure, least-privilege permissions, 40-char SHA pinning, `timeout-minutes: 5`, `$GITHUB_STEP_SUMMARY`, and zero inline `${{` in `run:` blocks.
  - Extracts and executes the actual embedded Node smoke script against an offline mocked `globalThis.fetch` covering URL allowlist enforcement, Vercel-only bypass header scoping, retry/backoff, `401` fail-fast, and proxy-`400` rejection.

### Integration Tests

- Local production runtime verification (`npm run build` + `next start` on `127.0.0.1:3150`) proving `/` (`200`), `POST /api/check` SSRF guard (`400` + SSRF JSON), and `POST /api/sync-blacklist` fail-closed `401` work on the real Next.js Node.js production server.

### Edge Cases

- `SYNC_BLACKLIST_SECRET` set to `undefined`, `""`, or `"   "` (whitespace) -> auth disabled cleanly without locking out local dev.
- `SYNC_BLACKLIST_SECRET` set with accidental leading/trailing whitespace -> trimmed cleanly before comparison.
- Secret mismatch with different byte lengths (e.g., 3 chars vs 64 chars) -> constant-time SHA-256 + `timingSafeEqual` returns `false` without throwing `RangeError`.
- Both `x-sync-blacklist-secret` (empty/wrong) and `Authorization: Bearer` (valid) sent together -> explicit `x-sync-blacklist-secret` fails closed.
- Spoofed preview URLs (`https://vercel.app.evil.com`, `https://eshop.vercel.app@evil.com`, `http://eshop.vercel.app`, `https://eshop.vercel.app:8443`, `https://vercel.app`) -> rejected BEFORE any `fetch` or bypass header attachment.
- `*.netlify.app` preview URL when `VERCEL_AUTOMATION_BYPASS_SECRET` is configured -> allowed for smoke probe, but `x-vercel-protection-bypass` is NEVER sent to non-Vercel hosts.
- Proxy/CDN `400` HTML error page or non-SSRF JSON `400` from `/api/check` -> rejected as failure (no false pass).
- Commit status `description` exceeding 140 characters -> truncated safely so GitHub REST API never returns `422`.

---

## VALIDATION COMMANDS

Execute every command below to ensure zero regressions and 100% feature correctness.

### Level 1: Typecheck & Lint

```bash
npx tsc --noEmit --incremental false
npm run lint
```

### Level 2: Unit Tests (100% Offline)

```bash
npm test
```

### Level 3: Production Build

```bash
npm run build
```

### Level 4: Manual / Local Production Server Verification (Single-Command Sandbox Safe)

Run `npm run build` first, then execute this single-command Node probe against `next start` (keeps server + probe in one process tree so Windows sandbox allows loopback probes and stops the server cleanly):

```bash
node -e "
const { spawn } = require('node:child_process');
const nextBin = require.resolve('next/dist/bin/next');
const srv = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', '3150'], {
  env: { ...process.env, SYNC_BLACKLIST_SECRET: 'local-verify-secret', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
async function waitReady() {
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch('http://127.0.0.1:3150/'); if (r.status === 200) return r.status; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('next start did not become ready');
}
(async () => {
  try {
    const homeStatus = await waitReady();
    const ssrfRes = await fetch('http://127.0.0.1:3150/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'http://127.0.0.1' }),
    });
    const ssrfBody = await ssrfRes.json();
    if (ssrfRes.status !== 400 || !String(ssrfBody.error || '').toLowerCase().includes('ssrf')) {
      throw new Error('Unexpected SSRF response: ' + ssrfRes.status + ' ' + JSON.stringify(ssrfBody));
    }
    const unauthRes = await fetch('http://127.0.0.1:3150/api/sync-blacklist', { method: 'POST' });
    if (unauthRes.status !== 401) throw new Error('Expected 401 without secret, got ' + unauthRes.status);
    const badRes = await fetch('http://127.0.0.1:3150/api/sync-blacklist', {
      method: 'POST',
      headers: { 'x-sync-blacklist-secret': 'wrong-secret' },
    });
    if (badRes.status !== 401) throw new Error('Expected 401 with wrong secret, got ' + badRes.status);
    console.log('LOCAL_PROD_OK', { homeStatus, ssrfStatus: ssrfRes.status, unauthStatus: unauthRes.status, badStatus: badRes.status });
  } finally {
    srv.kill();
  }
})().catch((e) => { console.error(e); srv.kill(); process.exit(1); });
"
```

---

## ACCEPTANCE CRITERIA

- [ ] **AC #1**: Next.js production server (`npm run build` + `npm run start`) works with Node.js runtime APIs (`node:tls`, `node:dns/promises`, `node:net`); `src/app/api/check/route.ts` and `src/app/api/sync-blacklist/route.ts` explicitly use Node.js runtime (`export const runtime = 'nodejs'`), and `next.config.mjs` does not enable `edge` runtime or static `output: 'export'`.
- [ ] **AC #2**: `POST /api/sync-blacklist` is guarded by an optional `SYNC_BLACKLIST_SECRET` header check (fail-closed HTTP `401` when env var is set, constant-time comparison), `.env.example` template exists with empty placeholder keys only, and offline unit tests verify the auth guard.
- [ ] **AC #3**: `.github/workflows/preview-smoke.yml` triggers on `deployment_status` (`if: github.event.deployment_status.state == 'success'`) with minimal `permissions: { deployments: read, statuses: write }` (top-level `permissions: {}`), `timeout-minutes: 5`, 40-char SHA-pinned actions, and an `if: always()` `$GITHUB_STEP_SUMMARY` step using `env:` (zero inline `${{` in `run:` blocks).
- [ ] **AC #4**: `preview-smoke.yml` strictly validates `deployment_status` target URL (`https://`, no userinfo/port, `*.vercel.app` / `*.netlify.app` host allowlist) **before** attaching the optional `x-vercel-protection-bypass: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}` header (scoped only to `*.vercel.app`).
- [ ] **AC #5**: `preview-smoke.yml` probes with short retry/backoff for DNS/TLS readiness (`GET <url>/` -> `200`, `POST <url>/api/check` with `{"query":"http://127.0.0.1"}` -> `400` with SSRF error JSON body, rejecting proxy `400`s) and publishes a `smoke` commit status on `github.event.deployment.sha`.
- [ ] **AC #6**: Roadmap Tasks `3.1`, `3.2`, and `3.4` are checked off in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (`3.3` remains `[x]`) and a summary row is appended to the Iteration Log.
- [ ] **AC #7**: All 4 validation commands (`npx tsc --noEmit --incremental false`, `npm run lint`, `npm test`, `npm run build`) exit `0` with all unit tests running deterministically offline.

---

## COMPLETION CHECKLIST

- [ ] All tasks (1 through 9) completed in order
- [ ] Each task validation passed immediately
- [ ] `npx tsc --noEmit --incremental false` exits `0`
- [ ] `npm run lint` exits `0`
- [ ] `npm test` passes 100% offline with zero network calls
- [ ] `npm run build` exits `0`
- [ ] Local production server verification (`next start` probe) succeeds
- [ ] All acceptance criteria (AC #1 through AC #7) met
- [ ] No unintended edits to `package.json`, `package-lock.json`, `.release-please-manifest.json`, or `CHANGELOG.md`

---

## OPEN QUESTIONS / ASSUMPTIONS

1. **Assumed — Accepted auth headers for `SYNC_BLACKLIST_SECRET`:** `SyncBlacklistAuth` accepts both `Authorization: Bearer <secret>` (standard HTTP Bearer auth) and `x-sync-blacklist-secret: <secret>` (convenient for cron/webhook callers). If `x-sync-blacklist-secret` is explicitly present, it takes precedence and fails closed if blank/invalid without falling through to `Authorization`. Confirm before execution if only one header should be accepted.
2. **Assumed — Empty/whitespace `SYNC_BLACKLIST_SECRET` treated as unset:** If a developer copies `.env.example` verbatim (`SYNC_BLACKLIST_SECRET=`) to `.env.local`, trimming `expectedSecret` treats empty/whitespace values as disabled (`mode: 'disabled'`), while any non-empty value enforces fail-closed `401`. Confirm before execution if an explicitly empty string should instead fail closed.
3. **Assumed — Preview URL resolution order (`environment_url || target_url`):** Vercel's official GitHub integration populates both `deployment_status.environment_url` and `deployment_status.target_url` with the preview URL, whereas Netlify and some custom deployers place the live app URL in `environment_url` and build logs in `target_url`. Passing `${{ github.event.deployment_status.environment_url || github.event.deployment_status.target_url }}` satisfies both Vercel and Netlify while remaining compatible with AC #4.
4. **Assumed — Commit status `context: 'smoke'`:** Published commit status uses `context: 'smoke'`, matching the job `name: smoke` and the suggested check name in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md:218` and `.agents/plans/issue-32-codeql-security-ruleset.md`.
5. **Assumed — No `actions/checkout` in `preview-smoke.yml`:** Keeping the smoke script self-contained inside `.github/workflows/preview-smoke.yml` (executed via SHA-pinned `actions/setup-node` Node 24) avoids requiring `contents: read` (honoring exact `permissions: { deployments: read, statuses: write }` in AC #3) and prevents executing untrusted PR code alongside `VERCEL_AUTOMATION_BYPASS_SECRET`.
6. **Assumed — `preview-smoke.yml` runs on all successful `deployment_status` events (Preview & Production):** Both Vercel Preview (`https://eshop-trust-checker-*.vercel.app`) and Production (`https://eshop-trust-checker.vercel.app`) match `*.vercel.app` and benefit from post-deploy smoke verification. Confirm before execution if Production deployments should be excluded via `deployment_status.environment == 'Preview'`.

---

## NOTES (open canvas)

### Architectural Tradeoffs Considered

| Decision | Chosen Approach | Alternative Rejected & Why |
| :--- | :--- | :--- |
| Where to put `/api/sync-blacklist` auth logic | `src/lib/sync-blacklist-auth.ts` (`SyncBlacklistAuth`) | Inline inside `src/app/api/sync-blacklist/route.ts` — `node --test` cannot resolve Next.js `@/*` aliases or `next/server` directly without adding a custom loader/test runner. Extracting to `src/lib/` enables zero-dependency native offline unit testing. |
| Secret comparison primitive | SHA-256 digest + `crypto.timingSafeEqual` | Direct `Buffer.from(a)` vs `Buffer.from(b)` `timingSafeEqual` — throws `RangeError` on length mismatch and leaks length via early check. Comparing fixed 32-byte SHA-256 digests is constant-time and length-safe. |
| Where smoke probe script lives | Inline Node 24 script in `.github/workflows/preview-smoke.yml` + extracted offline execution in `preview-smoke-workflow.test.ts` | Checking out PR repo via `actions/checkout` and running `scripts/preview-smoke.mjs` — would require adding `contents: read` beyond AC #3's exact `{ deployments: read, statuses: write }` and risks running modified PR code if checked out at deployment SHA. |
| Redirect handling in smoke probe | `redirect: 'manual'` | Default `redirect: 'follow'` — could follow a Vercel Deployment Protection `302` SSO redirect or off-origin redirect while carrying headers or masking auth failures. |

### Confidence Assessment

**Estimated Confidence Score for One-Pass Success:** `9.5 / 10`
- All file paths, line numbers, existing test harnesses, Node 24 behaviors, and 40-char Action SHAs are verified directly against the current `main` tree.
- Zero new npm dependencies are required.
- Both new test files run 100% offline with deterministic mocks.

---

## AMENDMENTS

*(Leave empty at creation; append dated entries if this plan changes after initial approval/execution.)*

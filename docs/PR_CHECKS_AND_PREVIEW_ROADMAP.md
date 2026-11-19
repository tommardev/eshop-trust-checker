# PR Checks, CI/CD & Preview Deployments Roadmap

Step-by-step, agent-iterable checklist to eliminate missing GitHub PR checks, fix repo CI blockers, add shareable Preview Deployments, and enforce security and quality gates.

> **Source context:** Audited against repository state (`main` at `ec8a225`), open PR `#11`, merged PR `#10`, `AGENTS.md`, `docs/AUTOMATION_WORKFLOW.md`, `docs/agents/testing.md`, `docs/agents/security.md`, and `docs/agents/ui-ux.md`.

---

## How Agents Should Iterate on This File

1. Pick the **first unchecked** `[ ]` task in phase order (finish Phase 1 before enabling Phase 2 CI).
2. Read the files listed in that task plus the matching helper in `AGENTS.md` (`stack`, `testing`, `security`, `ui-ux`).
3. Keep changes surgical and atomic. Follow `AGENTS.md` boundaries (ask before adding npm packages; verify new packages with Sonatype MCP; use `gh` CLI only for GitHub).
4. **Sidecar coordination note:** Per `docs/AUTOMATION_WORKFLOW.md` (Core 1a), scheduled automation sidecars pause whenever any PR is open (`gh pr list --state open`). Merge or close each PR cleanly before expecting sidecars to resume.
5. Run the task's **Verify** checks, update `[ ]` to `[x]`, and append a one-line note in the **Iteration Log** at the bottom.

---

## Progress Overview

- **Phase 1:** Repo Gaps to Fix Before Enabling CI (`4` tasks)
- **Phase 2:** Core CI Quality Gates (`6` tasks)
- **Phase 3:** Preview Deployments for Live Sharing (`4` tasks)
- **Phase 4:** Security & Supply-Chain PR Checks (`4` tasks)
- **Phase 5:** Formatting, PR Governance & Enforcement (`4` tasks)
- **Phase 6:** UI, Accessibility & Coverage Gates (`3` tasks)

---

## Phase 1: Repo Gaps to Fix Before Enabling CI

Fix these mismatches first so GitHub Actions does not fail immediately or silently skip tests.

- [x] **1.1 Align Node.js runtime version across docs and `package.json`**
  - **Why:** `npm test` runs `node --test src/lib/__tests__/checkers.test.ts`, which imports `.ts` files directly (`tsconfig.json` `allowImportingTsExtensions: true`). Unflagged `.ts` execution requires Node `>= 22.18` (or Node `24` LTS), whereas `README.md` and `docs/agents/stack.md` list Node `18+ / 20+`.
  - **Files:** `package.json`, `README.md`, `docs/agents/stack.md`
  - **Steps:**
    1. Add `"engines": { "node": ">=22.18.0" }` to `package.json`.
    2. Update Node runtime requirements in `README.md` and `docs/agents/stack.md` to Node `22.18+` / `24 LTS` (and note `@types/node` alignment if upgraded later).
  - **Verify:** `node -v` satisfies `>= 22.18.0` and `npm test` exits `0`.

- [x] **1.2 Update `npm test` for multi-file test discovery**
  - **Why:** `package.json` (`scripts.test`) runs only a single file (`src/lib/__tests__/checkers.test.ts`). Any new `*.test.ts` or `*.spec.ts` files (per `AGENTS.md` and `docs/agents/testing.md`) will be skipped in CI.
  - **Files:** `package.json`, `docs/agents/testing.md`, `docs/agents/stack.md`
  - **Steps:**
    1. Update `package.json` `"test"` script to discover all test files cleanly on both Linux (`ubuntu-latest`) and Windows (`pwsh`), e.g. `node --test "src/**/*.test.ts"` (or a small Node helper script if shell globbing differs).
    2. Add `npm test` to the Commands section in `docs/agents/testing.md` and `docs/agents/stack.md`.
  - **Verify:** Run `npm test` locally and confirm all suites in `src/lib/__tests__/checkers.test.ts` execute and pass.

- [x] **1.3 Ensure all unit tests run deterministically offline**
  - **Why:** On `main`, `AuditEngine.analyze` tests in `src/lib/__tests__/checkers.test.ts` hit live external domains (`kalykla.lt`, `pigu.lt`) via WHOIS/RDAP, TLS, and HTTP scraping, which can flake or time out in CI. (PR `#11` addresses this with mocks.)
  - **Files:** `src/lib/__tests__/checkers.test.ts` (and optional `*.mock.ts` / `*.data.ts` fixtures per `docs/agents/testing.md`)
  - **Steps:**
    1. After PR `#11` merges (or if iterating beforehand), inspect `src/lib/__tests__/checkers.test.ts`.
    2. Mock `WhoisChecker.checkDomain`, `SslChecker.checkCertificate`, `WebScraper.analyzeWebsite`, and `fetch` in unit tests (using `node:test` `mock.method` and `try/finally` restore).
  - **Verify:** `npm test` passes with zero external network calls.

- [x] **1.4 Replace template placeholders in `piv-validate` skill**
  - **Why:** `.agents/skills/piv-validate/SKILL.md` still has `# REPLACE:` placeholders instead of this repo's real checks.
  - **Files:** `.agents/skills/piv-validate/SKILL.md` *(gitignored locally via `.gitignore`)*, `AGENTS.md` / `docs/agents/testing.md`
  - **Steps:**
    1. Update local `.agents/skills/piv-validate/SKILL.md` commands to run: `npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, and `npm run build`.
    2. Ensure `docs/agents/testing.md` lists the exact same 4 commands so future repo clones stay aligned even when `.agents/skills/` is restored from `skills-lock.json`.
  - **Verify:** All 4 validation commands run cleanly and exit `0`.

---

## Phase 2: Core CI Quality Gates (`.github/workflows/ci.yml`)

Run the 4 repo-documented checks automatically on every PR to `main` and every push to `main`.

- [ ] **2.1 Create `.github/workflows/ci.yml` skeleton**
  - **Files:** `.github/workflows/ci.yml`
  - **Steps:**
    1. Trigger on `pull_request` (`branches: [main]`) and `push` (`branches: [main]`).
    2. Add `permissions: { contents: read }` (least privilege), `timeout-minutes: 10` (or `15` for `build`) on every job, and `concurrency` (`group: ${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` so `main` runs are not cancelled).
    3. Pin **all** first- and third-party GitHub Actions to full 40-char commit SHAs (with `# vX.Y.Z` comments) across every workflow: use `actions/checkout` with `persist-credentials: false` and `actions/setup-node` with `node-version: '24'` (or `'22'` matching `>=22.18.0`) and `cache: 'npm'`, then `npm ci`.
  - **Verify:** YAML syntax is valid and workflow triggers on PR open/sync.

- [ ] **2.2 Add `lint` job**
  - **Files:** `.github/workflows/ci.yml`
  - **Steps:** Run `npm run lint` (`eslint --ext .ts,.tsx src` with `.eslintrc.json`).
  - **Verify:** Job passes on `main` and fails when an intentional ESLint violation is tested.

- [ ] **2.3 Add `typecheck` job**
  - **Files:** `.github/workflows/ci.yml`
  - **Steps:** Run `npx tsc --noEmit --incremental false`.
  - **Verify:** Job passes with `0` TypeScript errors.

- [ ] **2.4 Add `test` job**
  - **Files:** `.github/workflows/ci.yml`
  - **Steps:** Run `npm test`.
  - **Verify:** Job executes all unit tests offline and exits `0`.

- [ ] **2.5 Add `build` job**
  - **Files:** `.github/workflows/ci.yml`
  - **Steps:** Cache `.next/cache` (SHA-pinned `actions/cache`) and run `npm run build` (`next build`) to catch Next.js App Router, SSR, and bundling errors.
  - **Verify:** `.next` production build succeeds on `ubuntu-latest`.

- [ ] **2.6 Verify all 4 CI checks on a live GitHub PR**
  - **Steps:** Open a PR with `.github/workflows/ci.yml`, run `gh pr checks`, and confirm `lint`, `typecheck`, `test`, and `build` all report `pass`.
  - **Verify:** `gh pr checks <pr-number>` shows 4 green checks.

---

## Phase 3: Preview Deployments (Shareable Running App on Every PR & `main`)

Give reviewers and stakeholders a live URL for every feature PR and `main` while issues are being built.

### Hosting Choice (Pick One Before Implementing)

| Option | Runtime Fit for This App | Pros | Cons / Watch-outs |
| :--- | :--- | :--- | :--- |
| **Vercel** *(Recommended)* | Full Node.js Serverless (`node:tls`, `node:dns/promises`, `node:net` supported) | Zero-config Next.js 14 App Router; automatic per-PR preview URLs + PR comment + GitHub Deployment status | Hobby plan has 10s serverless timeout (`AuditEngine` uses 2.5s–4s parallel timeouts, which fits); check Hobby commercial-use limits |
| **Netlify** | Next.js Runtime + Node.js Functions | Built-in Deploy Previews per PR; Netlify MCP already configured in workspace | Verify `node:tls` outbound port 443 socket behavior with `@netlify/plugin-nextjs` |
| **Cloud Run / Firebase App Hosting / Railway** | Persistent or container Node.js (`npm run start`) | No serverless timeout or socket quirks; keeps in-memory `VvtatChecker.blockedSet` warm | Needs custom GitHub Actions workflow for per-PR preview cleanup (except Railway/Firebase PR previews) |
| **GitHub Pages** *(Unsupported / Excluded)* | Static files only (`output: 'export'`) | Free for public static sites | **Not viable:** breaks `force-dynamic` API routes (`/api/check`, `/api/sync-blacklist`), `node:tls`, `node:dns/promises`, `node:net`, and has no native per-PR preview URLs |

- [ ] **3.1 Verify Next.js production config and Node.js runtime compatibility**
  - **Why:** `src/lib/ssl-checker.ts` uses `node:tls` (`tls.connect` on port 443) and `src/lib/security.ts` uses `node:dns/promises` and `node:net`. Static export (`output: 'export'`) and Edge runtime (`runtime = 'edge'`) will break API routes.
  - **Files:** `next.config.mjs` (create only if needed), `src/app/api/check/route.ts`, `src/app/api/sync-blacklist/route.ts`
  - **Steps:**
    1. Keep API routes on default Node.js runtime (do not set `runtime = 'edge'` or `output: 'export'`).
    2. Test `npm run build` and `npm run start` locally, then hit `GET /` and `POST /api/check`.
  - **Verify:** Local production server renders `/` and returns JSON from `POST /api/check`.

- [ ] **3.2 Protect unauthenticated / unthrottled endpoints on public previews**
  - **Why:** `POST /api/sync-blacklist` has no authentication, and `/api/check` does not have rate limiting yet (tracked in Issue `#6`). Sharing an unprotected public URL exposes outbound scraping/refresh endpoints.
  - **Files:** Deployment platform protection settings and/or `src/app/api/sync-blacklist/route.ts`
  - **Steps:**
    1. Enable platform preview protection (e.g. Vercel Deployment Protection / password or Netlify Visitor Access) before sharing URLs externally. If using Vercel Authentication, also enable **Protection Bypass for Automation** and save the secret in GitHub Actions as `VERCEL_AUTOMATION_BYPASS_SECRET` so `#15` smoke checks can reach previews.
    2. Gate `POST /api/sync-blacklist` behind an optional `SYNC_BLACKLIST_SECRET` header check (configured via hosting env vars + `.env.example`, never committed to git) until Issue `#6` rate limiting is merged.
  - **Verify:** Unauthorized callers cannot abuse `/api/sync-blacklist` on preview URLs.

- [ ] **3.3 Connect hosting provider & PR preview workflow**
  - **Files:** GitHub App integration (Vercel / Netlify — default) or `.github/workflows/preview.yml` (fallback CLI deploy only)
  - **Steps:**
    1. **Default (tokenless):** Connect `tommardev/eshop-trust-checker` via the official **Vercel** (recommended) or **Netlify** GitHub App so `main` and every PR auto-deploy via GitHub Deployments with **zero deploy tokens** stored in GitHub Secrets.
    2. **Fallback only:** If using CLI deploy via `.github/workflows/preview.yml` (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`), run after Phase 2 CI (`needs: [lint, typecheck, test, build]`) with SHA-pinned actions, minimal `permissions:`, and `timeout-minutes`.
    3. Verify preview builds update on PR commits and `main` updates the staging/production URL.
  - **Verify:** Opening/pushing to a PR creates a GitHub Deployment and a working `https://...` preview URL.

- [ ] **3.4 Add automated preview smoke check (`#15`)**
  - **Files:** `.github/workflows/preview-smoke.yml`
  - **Steps:**
    1. Trigger on `deployment_status` (`if: github.event.deployment_status.state == 'success'`) with minimal `permissions: { deployments: read, statuses: write }`, `timeout-minutes: 5`, and SHA-pinned actions.
    2. Validate `deployment_status.target_url` (require `https://` and expected preview host allowlist, e.g. `*.vercel.app` / `*.netlify.app`) **before** sending the optional `x-vercel-protection-bypass: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}` header.
    3. Run a minimal smoke probe with short retry/backoff for DNS/TLS readiness: `GET <preview-url>/` returns HTTP `200`, and `POST <preview-url>/api/check` with `{"query":"http://127.0.0.1"}` returns HTTP `400` with an SSRF error JSON body (avoiding false passes from proxy `400`s).
    4. Publish a commit status (or check run) on `github.event.deployment.sha` if enforcing this smoke check as a required merge check in `5.4`.
  - **Verify:** Smoke check passes on a live PR preview URL and fails if the preview crashes or SSRF blocking regresses.

---

## Phase 4: Security & Supply-Chain PR Checks

Protect the repo against vulnerable packages, leaked secrets, and SSRF/XSS regressions.

- [ ] **4.1 Enable Dependabot Vulnerability Alerts & add `.github/dependabot.yml`**
  - **Why:** GitHub Vulnerability Alerts are currently disabled (`404`), and no automated dependency update config exists.
  - **Files:** `.github/dependabot.yml` (plus GitHub Repo Settings)
  - **Steps:**
    1. In GitHub **Settings -> Code security**, enable **Dependabot alerts** and **Dependabot security updates**.
    2. Create `.github/dependabot.yml` with weekly grouped updates for `npm` (`directory: "/"`) and `github-actions` (`open-pull-requests-limit: 5`).
    3. Note: Keep `docs/AUTOMATION_WORKFLOW.md` Core 1a in mind—Dependabot PRs count as open PRs and pause issue sidecars until merged or closed.
  - **Verify:** `.github/dependabot.yml` parses cleanly and Dependabot alerts show enabled (`gh api repos/tommardev/eshop-trust-checker/vulnerability-alerts`).

- [ ] **4.2 Add dependency vulnerability audit gate (`npm audit`)**
  - **Files:** `.github/workflows/ci.yml` (or `.github/workflows/security.yml`)
  - **Steps:**
    1. Run `npm audit --audit-level=high` locally first to confirm zero baseline high/critical vulnerabilities (use Sonatype MCP if any package needs upgrading).
    2. Add an `audit` job running `npm audit --audit-level=high` on PRs and weekly schedule, using minimal `permissions: { contents: read }`, `timeout-minutes: 10`, SHA-pinned actions, and `persist-credentials: false`.
  - **Verify:** `audit` job passes cleanly on `main`.

- [ ] **4.3 Add secret scanning on PRs**
  - **Files:** `.github/workflows/security.yml`
  - **Steps:**
    1. Add a Gitleaks check (`gitleaks/gitleaks-action` and `actions/checkout` pinned to 40-char commit SHAs, with `fetch-depth: 0`, `persist-credentials: false`, `permissions: { contents: read }`, `timeout-minutes: 10`, and `GITHUB_TOKEN`), and/or enable GitHub Secret Scanning in repo settings if available for your plan.
    2. Add `.env.example` (empty variable names only, zero real secrets) if env vars are introduced in Phase 3.
  - **Verify:** Workflow fails if a dummy test secret pattern is tested locally/in a branch and passes cleanly on `main`.

- [ ] **4.4 Add static security analysis (CodeQL)**
  - **Files:** `.github/workflows/codeql.yml`
  - **Steps:**
    1. Check GitHub plan support first (CodeQL on private repos may require public visibility or GitHub Code Security / GHAS).
    2. If supported, add `.github/workflows/codeql.yml` using SHA-pinned `actions/checkout` (`persist-credentials: false`) and `github/codeql-action/init` + `analyze` with minimal `permissions: { contents: read, security-events: write }`, `timeout-minutes: 20`, `languages: javascript-typescript`, and `queries: security-extended` (flags SSRF, XSS/`dangerouslySetInnerHTML`, and injection).
  - **Verify:** CodeQL workflow runs on PRs and `main` without configuration errors (or record plan limitation if deferred until repo goes public).

---

## Phase 5: Formatting, PR Governance & Enforcement

Standardize code style, PR metadata, and merge rules.

- [ ] **5.1 Add Prettier formatting script and PR check**
  - **Files:** `package.json`, `.prettierrc`, `.prettierignore`, `.github/workflows/ci.yml`
  - **Steps:**
    1. Before adding `prettier`, check its latest secure version and trust score via **Sonatype MCP** (per `AGENTS.md`).
    2. Pin exact `"prettier"` version in `devDependencies`, add `"format": "prettier --write ."` and `"format:check": "prettier --check ."` scripts to `package.json`.
    3. Format existing files in a dedicated `style:` commit so PR diffs stay clean, then add `npm run format:check` to CI.
  - **Verify:** `npm run format:check` exits `0`.

- [ ] **5.2 Add `.github/PULL_REQUEST_TEMPLATE.md`**
  - **Files:** `.github/PULL_REQUEST_TEMPLATE.md`
  - **Steps:** Include concise sections: Summary, Linked Issue (`Closes #`), Automated Validation (`lint`, `tsc`, `test`, `build`), Security/SSRF & Offline Test Mock checklist, and Preview URL link.
  - **Verify:** Opening a new PR auto-populates the template.

- [ ] **5.3 Add `.github/CODEOWNERS` and Conventional PR Title check**
  - **Files:** `.github/CODEOWNERS`, `.github/workflows/pr-hygiene.yml`
  - **Steps:**
    1. Add `.github/CODEOWNERS` assigning review ownership (e.g. `* @tommardev`).
    2. Add a PR title check (`amannn/action-semantic-pull-request` pinned to a 40-char commit SHA, with `permissions: { pull-requests: read }` and `timeout-minutes: 5`) enforcing Conventional Commit prefixes (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `ci`) matching `AGENTS.md`.
  - **Verify:** Non-conventional PR titles fail the check; valid titles pass.

- [ ] **5.4 Enforce Branch Protection / Ruleset on `main`**
  - **Current Blocker:** GitHub API returns `403` (`Upgrade to GitHub Pro or make this repository public to enable this feature`) because `tommardev/eshop-trust-checker` is currently `private` on a Free plan.
  - **Steps:**
    1. Once the repository becomes public or is upgraded to GitHub Pro, create a Ruleset on `main`.
    2. Require: PR before merging (`>= 1` approval), up-to-date branch, conversation resolution, no force-push, and passing status checks (`lint`, `typecheck`, `test`, `build`, `audit`, `smoke` if added).
  - **Verify:** `gh api repos/tommardev/eshop-trust-checker/branches/main` shows `"protected": true` (or ruleset active).

---

## Phase 6: Future UI, Accessibility & Coverage Checks (After Issues #4–#9)

Add these once UI components (`#7`, `#8`), `/api/check` (`#6`), and test suite (`#9`) are implemented.

- [ ] **6.1 Add API route integration & rate-limit tests**
  - **Files:** `src/app/api/check/__tests__/route.test.ts` (or `src/__tests__/`)
  - **Steps:** Verify `400` on invalid/SSRF URLs, `429` on rate-limit bursts (Issue `#6`), and `200` with mocked `AuditEngine`.
  - **Verify:** Included in `npm test` and green in CI.

- [ ] **6.2 Add Playwright + axe-core / Lighthouse CI accessibility check**
  - **Why:** `docs/agents/ui-ux.md` sets WCAG 2.2 AA as a non-negotiable floor (semantic HTML, 4.5:1 contrast, keyboard focus rings, `prefers-reduced-motion`).
  - **Files:** `.github/workflows/ui-quality.yml`
  - **Steps:** Run automated Playwright/axe-core or Lighthouse CI against the Phase 3 Preview URL (or local `npm run start` in CI) on UI-touching PRs, using SHA-pinned actions, `persist-credentials: false`, minimal `permissions: { contents: read }`, and `timeout-minutes: 15`.
  - **Verify:** Zero critical/serious axe-core WCAG 2.2 AA violations.

- [ ] **6.3 Add test coverage reporting**
  - **Files:** `package.json`, `.github/workflows/ci.yml`
  - **Steps:** Add `"test:coverage"` script (using `node --test --experimental-test-coverage` or chosen test runner) and publish summary to `$GITHUB_STEP_SUMMARY`.
  - **Verify:** Coverage summary appears on PR checks without breaking offline execution.

---

## References

- **Repo instructions & helpers:** [`AGENTS.md`](../AGENTS.md), [`docs/agents/stack.md`](agents/stack.md), [`docs/agents/testing.md`](agents/testing.md), [`docs/agents/security.md`](agents/security.md), [`docs/agents/ui-ux.md`](agents/ui-ux.md)
- **Automation & single-PR rules:** [`docs/AUTOMATION_WORKFLOW.md`](AUTOMATION_WORKFLOW.md)
- **Runtime & config files:** [`package.json`](../package.json), [`tsconfig.json`](../tsconfig.json), [`.eslintrc.json`](../.eslintrc.json), [`src/lib/ssl-checker.ts`](../src/lib/ssl-checker.ts), [`src/lib/security.ts`](../src/lib/security.ts), [`src/app/api/check/route.ts`](../src/app/api/check/route.ts), [`src/app/api/sync-blacklist/route.ts`](../src/app/api/sync-blacklist/route.ts)

---

## Iteration Log

| Date | Task ID | Branch / PR | Result / Notes |
| :--- | :--- | :--- | :--- |
| _YYYY-MM-DD_ | _e.g. 1.1_ | _branch or PR #_ | _Summary of verification and remaining notes_ |
| 2026-11-19 | 1.1–1.4 | `feat/issue-13-ci-prep` (Issue #13) | Aligned `engines.node` (`>=22.18.0`), multi-file `npm test` globs (`src/**/*.test.ts` / `src/**/*.spec.ts`), validation docs (`README.md`, `stack.md`, `testing.md`), and offline mock checks; verified on Node `v24.20.0` (`npm test`: 100/100 pass, `tsc`, `lint`, `build`). |

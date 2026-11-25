# Feature: Security & Governance — CodeQL (4.4), Secret Scanning, `main` Branch Ruleset (5.4), and Live CI/CodeQL Badges

The following plan is complete and self-contained for **interactive execution** (not autonomous sidecars, because live `gh api` admin mutations exceed sidecar `access_grants`). Validate codebase patterns, live GitHub repository state, and task sanity before executing.

Pay special attention to:
- Exact 40-character commit SHAs for `actions/checkout` (`v7.0.1`) and `github/codeql-action/{init,analyze}` (`v4.39.5`, dereferenced from annotated tag to commit SHA).
- Updating `src/lib/__tests__/governance.test.ts` (`lines 234–246`), which currently fails if `README.md` contains `workflows/ci.yml` or `workflows/codeql.yml`.
- Sequencing: merge `.github/workflows/codeql.yml` and confirm its exact live check-run context name **before** enforcing the `main` Branch Ruleset, and include Repository Admin bypass (`actor_id: 5`) so the solo maintainer's Planner sidecar and `release-please` workflow stay unblocked while external contributors remain strictly gated.

## Feature Description

Unlock and enforce GitHub Public-repository security and branch governance controls for `tommardev/eshop-trust-checker` (Phase C of ADR-002):
1. Add `.github/workflows/codeql.yml` (Roadmap `4.4`) running static security analysis (`javascript-typescript`, `queries: security-extended`) on PRs, pushes to `main`, weekly schedule, and manual `workflow_dispatch`, plus an offline contract test suite (`src/lib/__tests__/codeql-workflow.test.ts`).
2. Add live `CI` and `CodeQL` workflow status badges to `README.md` (preserving `<!-- x-release-please-version -->` and keeping `Security` deferred until `#17`) and update `src/lib/__tests__/governance.test.ts`.
3. Enable GitHub **Secret Scanning**, **Push Protection**, and **Private Vulnerability Reporting** via `gh api`.
4. Create an active `main` Branch Ruleset (Roadmap `5.4`) via `gh api` blocking force-push/deletion, requiring PRs (`1` approval + dismiss stale reviews + conversation resolution) and up-to-date passing status checks (`lint`, `typecheck`, `test`, `build`, `Analyze (javascript-typescript)`), with **Repository Admin** (`actor_id: 5`) bypass so solo-maintainer automation keeps working while any external contributor is strictly enforced.
5. Update `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (check off `2.6`, `4.4`, `5.4` + Iteration Log) and `docs/decisions/002-public-repository-readiness-and-governance.md` (mark Phase C implemented).

## User Story

As a repository maintainer (solo today, open to future contributors) of `eshop-trust-checker`
I want automated CodeQL SAST scanning, GitHub Secret Scanning with Push Protection, Private Vulnerability Reporting, a `main` Branch Ruleset, and live CI/CodeQL README badges
So that security flaws, leaked credentials, and unverified changes are automatically blocked before reaching `main` without breaking our existing autonomous planning and release workflows.

## Problem Statement

`tommardev/eshop-trust-checker` is now `PUBLIC` (Phase B complete) with Phase A community/legal files (`#31`) and Core CI (`#14`) merged, yet live inspection (`2026-11-25`) shows:
- `security_and_analysis.secret_scanning`: `disabled`
- `security_and_analysis.secret_scanning_push_protection`: `disabled`
- `private-vulnerability-reporting`: `{"enabled": false}`
- `rulesets` on `main`: `[]` (no protection against force-push, deletion, or unreviewed/failing merges)
- No `.github/workflows/codeql.yml` workflow scanning TypeScript/JavaScript for SSRF, XSS, or injection vulnerabilities
- `README.md` lacks live `CI` and `CodeQL` status badges, and `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` still has Tasks `2.6`, `4.4`, and `5.4` unchecked.

## Solution Statement

Execute Issue `#32` in two cleanly ordered interactive stages:
1. **Stage 1 — Repository PR (`feat/issue-32-codeql-security-ruleset`):**
   - Create `.github/workflows/codeql.yml` with 40-char SHA-pinned `node24` actions, minimal `permissions`, `timeout-minutes: 20`, `build-mode: none`, `queries: security-extended`, and an `if: always()` `$GITHUB_STEP_SUMMARY` step.
   - Add offline workflow contract tests in `src/lib/__tests__/codeql-workflow.test.ts` (zero external YAML deps, zero network calls).
   - Add `CI` and `CodeQL` status badges to `README.md` and update `src/lib/__tests__/governance.test.ts` accordingly.
   - Update `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (`2.6`, `4.4`, `5.4`, Iteration Log) and `docs/decisions/002-public-repository-readiness-and-governance.md`.
   - Validate locally (`tsc`, `lint`, `test`, `build`), open PR (`Closes #32`), verify all 5 live checks (`lint`, `typecheck`, `test`, `build`, `Analyze (javascript-typescript)`) pass green on the PR, and merge PR to `main`.
2. **Stage 2 — Live GitHub Security & Ruleset Enforcement (`gh api`, post-merge):**
   - Verify `PUBLIC` visibility (`gh repo view`).
   - Enable Secret Scanning, Push Protection, and Private Vulnerability Reporting via `gh api`.
   - Verify the exact CodeQL check-run name (`Analyze (javascript-typescript)`) and `app.id` (`15368`) on `main`.
   - Create the `Protect main` Branch Ruleset via `POST /repos/tommardev/eshop-trust-checker/rulesets` with `bypass_actors` (`RepositoryRole` `actor_id: 5`, `bypass_mode: "always"`).
   - Verify `GET /rulesets` returns `HTTP 200` with the active ruleset, all security endpoints report enabled, and CodeQL runs green on `main`.

## Out of Scope / Non-Goals

- Not included: Preview smoke checks / `/api/sync-blacklist` secret guard (Issue `#15`, Roadmap `3.1`–`3.2`, `3.4`).
- Not included: `.github/dependabot.yml`, `CODEOWNERS`, PR template changes, or semantic PR title workflow (Issue `#16`, Roadmap `4.1`, `5.2`–`5.3`).
- Not included: Gitleaks workflow, `npm audit` CI gate, or `Security` badge in `README.md` (Issue `#17`, Roadmap `4.2`–`4.3`).
- Not included: Prettier formatting config (Issue `#18`, Roadmap `5.1`) or Playwright/axe/Coverage (Issue `#19`, Roadmap `6.1`–`6.3`).
- Not included: Adding a PAT / GitHub App token secret to `.github/workflows/release-please.yml` (defer to a dedicated follow-up issue if manual close/reopen or Admin Bypass on Release PRs ever becomes friction).
- Not changing: `.github/workflows/ci.yml`, `.github/workflows/release-please.yml`, `package.json` version fields, or `CHANGELOG.md`.

## Feature Metadata

**Feature Type**: Enhancement (Security & Governance)
**Estimated Complexity**: Medium (git PR + live GitHub REST API admin configuration with sidecar/release-please coordination)
**Primary Systems Affected**: `.github/workflows/`, `src/lib/__tests__/`, `README.md`, `docs/`, GitHub repository security & branch ruleset settings
**Dependencies**:
- Issue `#31` (Phase A pre-public files — **Merged** in PR `#35`)
- Manual Phase B visibility flip to `PUBLIC` — **Verified complete** (`visibility: PUBLIC`)
- Issue `#14` (Core CI workflow `.github/workflows/ci.yml` — **Merged** in PR `#38`)
- No new npm dependencies (`package.json` untouched)

## Related Work

**Implements**: GitHub Issue `#32` (`Security & Governance: Enable CodeQL (4.4), Secret Scanning, main Branch Ruleset (5.4), and CI/Security badges`) · **Epic / Roadmap**: `docs/decisions/002-public-repository-readiness-and-governance.md` (Phase C) & `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (`2.6`, `4.4`, `5.4`)

**Back-references** (plans this builds on or inherits decisions from):

- `.agents/plans/issue-31-public-repository-readiness-and-governance.md` — Why: established `README.md` badge layout, `SECURITY.md` Private Vulnerability Reporting instructions, and `src/lib/__tests__/governance.test.ts` premature-badge guard.
- `.agents/plans/issue-14-github-actions-core-ci-workflow.md` — Why: established 40-char SHA pinning (`actions/checkout@v7.0.1`), `$GITHUB_STEP_SUMMARY` pattern, offline workflow contract tests (`ci-workflow.test.ts`), and the 4 CI status check names (`lint`, `typecheck`, `test`, `build`).
- `.agents/plans/issue-33-pre-1-0-release-please-and-version-sync.md` — Why: established `release-please.yml` using default `GITHUB_TOKEN` and `<!-- x-release-please-version -->` marker in `README.md`.

**Forward-references** (follow-ups that will extend this ruleset/badges):

- Issue `#15` (Preview smoke check) — When merged, append `smoke` check context to the `Protect main` Ruleset.
- Issue `#16` (`CODEOWNERS`) — When merged, optionally flip `require_code_owner_review` to `true` on `Protect main`.
- Issue `#17` (Security workflow: `npm audit` + Gitleaks) — When merged, append `audit` check context to `Protect main`, add `Security` badge to `README.md`, and update `governance.test.ts`.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `.github/workflows/ci.yml` (lines 1–69) — Why: canonical SHA-pinned `actions/checkout@v7.0.1` (`3d3c42e5aac5ba805825da76410c181273ba90b1`), PR-only `concurrency`, and `if: always()` `$GITHUB_STEP_SUMMARY` table with `env:` indirection.
- `.github/workflows/release-please.yml` (lines 21–31) — Why: canonical top-level `permissions: {}` + job-level minimal `permissions:` pattern.
- `src/lib/__tests__/ci-workflow.test.ts` (lines 1–273) — Why: pure Node.js offline YAML line/block/uses/run parsing helpers (`extractIndentedBlock`, `extractJobs`, `extractUsesLines`, `extractRunBlocks`) to mirror for `codeql-workflow.test.ts`.
- `src/lib/__tests__/governance.test.ts` (lines 200–248) — Why: currently asserts `README.md` does NOT include `workflows/ci.yml`, `workflows/codeql.yml`, or `workflows/security.yml`; lines 234–246 MUST be updated.
- `README.md` (lines 1–14) — Why: existing single-line badge block and `<!-- x-release-please-version -->` marker (line 4) that MUST remain intact.
- `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (lines 100–103, 181–187, 214–220, 253–260) — Why: tasks `2.6`, `4.4`, `5.4`, and the Iteration Log table to update.
- `docs/decisions/002-public-repository-readiness-and-governance.md` (lines 1–16, 52–56, 75–95) — Why: ADR-002 status header, badges plan, Phase C checklist, and verification criteria.
- `docs/agents/security.md` (lines 36–42) — Why: mandatory CI/CD hardening rules (40-char SHA pinning, least-privilege permissions, `persist-credentials: false`, no `pull_request_target`, explicit `timeout-minutes`).
- `docs/agents/conventions.md` (lines 50–54) — Why: mandatory `$GITHUB_STEP_SUMMARY` rules (`if: always()`, `env:` variables only, never inline `${{ ... }}` in `run:`).
- `docs/AUTOMATION_WORKFLOW.md` (lines 93–98, 153–160) — Why: Planner direct push to `main` and `release-please` default `GITHUB_TOKEN` constraints governing Ruleset `bypass_actors`.

### New Files to Create

- `.github/workflows/codeql.yml` — Hardened CodeQL static security analysis workflow (`javascript-typescript`, `security-extended`, `node24` SHA-pinned actions, `$GITHUB_STEP_SUMMARY`).
- `src/lib/__tests__/codeql-workflow.test.ts` — Deterministic offline contract tests verifying `.github/workflows/codeql.yml` security, pins, triggers, permissions, queries, and summary hygiene.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [GitHub Docs: Workflow configuration options for code scanning](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options)
  - Specific sections: *Languages to be analyzed* (`javascript-typescript`, `build-mode: none`), *Using queries in QL packs* (`queries: security-extended`)
  - Why: Confirms official `github/codeql-action/init@v4` + `analyze@v4` matrix and query-suite syntax.
- [GitHub Docs: REST API endpoints for rules](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset)
  - Specific section: `POST /repos/{owner}/{repo}/rulesets` (`bypass_actors`, `pull_request`, `required_status_checks`)
  - Why: Defines exact schema for `Protect main` Ruleset (`actor_type: "RepositoryRole"`, `actor_id: 5` = Repository Admin, `integration_id: 15368` = GitHub Actions).
- [GitHub Docs: REST API endpoints for repositories](https://docs.github.com/en/rest/repos/repos#update-a-repository)
  - Specific sections: `PATCH /repos/{owner}/{repo}` (`security_and_analysis`) and `PUT /repos/{owner}/{repo}/private-vulnerability-reporting`
  - Why: Defines exact payloads to enable Secret Scanning, Push Protection, and Private Vulnerability Reporting.

#### Verified 40-Character Action Commit SHAs (Verified 2026-11-25 via `gh api`)

| Action | Release Tag | Verified 40-Char Commit SHA | Runtime |
| :--- | :--- | :--- | :--- |
| `actions/checkout` | `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `node24` |
| `github/codeql-action/init` | `v4.39.5` | `915412ff23e8b7659517e607487dbeae018f2934` | `node24` |
| `github/codeql-action/analyze` | `v4.39.5` | `915412ff23e8b7659517e607487dbeae018f2934` | `node24` |

*(Note: `v4.39.5` annotated tag object SHA is `e274593ecfcbcdc39c8f034978d84614cebcb71d`, which dereferences to commit SHA `915412ff23e8b7659517e607487dbeae018f2934`. Always pin the commit SHA, not the tag object SHA.)*

### Patterns to Follow

**1. Workflow Hardening & Summary Pattern (`.github/workflows/ci.yml` + `release-please.yml`):**
- Top-level `permissions: {}` and job-level minimal `permissions: { contents: read, security-events: write }`.
- PR-only concurrency cancellation:
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: ${{ github.event_name == 'pull_request' }}
  ```
- Every `uses:` pinned to 40-char commit SHA with `# vX.Y.Z` comment; `actions/checkout` always sets `persist-credentials: false`.
- `if: always()` summary step passing `${{ ... }}` exclusively via `env:` and writing a compact Markdown table with `| tee -a "$GITHUB_STEP_SUMMARY"`.

**2. Offline Contract Test Pattern (`src/lib/__tests__/ci-workflow.test.ts`):**
- Uses only Node.js built-ins (`node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:url`), splits lines via `/\r?\n/` for Windows/Linux parity.
- **Sub-action SHA regex:** Because CodeQL uses 3-segment sub-actions (`github/codeql-action/init@...`), match `uses:` lines with:
  ```ts
  const SHA_PINNED_USES_REGEX =
    /^uses:\s+[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*@[0-9a-f]{40}\s+#\s+v\d+\.\d+\.\d+$/;
  ```

**3. Badge Formatting Pattern (`README.md:3–11`):**
- One Markdown badge link per line, zero blank lines inside the badge block, preserving line 4 `<!-- x-release-please-version -->`.

---

## IMPLEMENTATION PLAN

Phases run top-to-bottom across two clear stages: **Stage 1 (Git Branch & PR)** followed by **Stage 2 (Live GitHub Admin Settings via `gh api`)**.

### Phase 0: Pre-Flight & Sidecar Lock (Interactive Guard)

Prevent the 15-minute Planner sidecar from racing this interactive session and confirm live repo prerequisites.

**Tasks:**
- Confirm working tree is clean on `main` (`git status -s`, `git pull --ff-only`).
- Claim Issue `#32` interactively (`gh issue edit 32 --add-label in-progress --remove-label ready-for-plan`) so sidecars pause cleanly while `#32` is worked interactively.
- Confirm `gh repo view tommardev/eshop-trust-checker --json visibility` returns `PUBLIC`.
- Create feature branch `feat/issue-32-codeql-security-ruleset` off `main`.

### Phase 1: CodeQL Workflow & Offline Contract Tests

**Depends on:** Phase 0

**Tasks:**
- Create `.github/workflows/codeql.yml` implementing Roadmap `4.4` with verified 40-char `node24` SHAs, `javascript-typescript`, `build-mode: none`, `queries: security-extended`, `timeout-minutes: 20`, and `$GITHUB_STEP_SUMMARY`.
- Create `src/lib/__tests__/codeql-workflow.test.ts` verifying every security, trigger, permission, query, SHA-pin, and summary invariant offline.

### Phase 2: Live README Badges, Governance Test Update & Docs Alignment

**Independent of:** Phase 1 (can be authored alongside Phase 1 before running Phase 3 validation)

**Tasks:**
- Update `README.md` to add live `CI` and `CodeQL` status badges (keeping `Security` omitted until `#17`).
- Update `src/lib/__tests__/governance.test.ts` (`lines 234–246`) to verify `CI` and `CodeQL` badges are present while keeping `workflows/security.yml` guarded as premature.
- Update `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (`2.6`, `4.4`, `5.4`, and Iteration Log) and `docs/decisions/002-public-repository-readiness-and-governance.md` (`Status` + Phase C summary).

### Phase 3: Local Validation, PR Creation & Live CodeQL Verification

**Depends on:** Phases 1 & 2

**Tasks:**
- Run full 4-command local validation suite (`tsc`, `lint`, `test`, `build`).
- Commit atomically with Conventional Commit + `Context:` block (since `docs/` changes), push `feat/issue-32-codeql-security-ruleset`, and open PR (`Closes #32` in body, no `(#32)` in PR title).
- Wait for live GitHub checks via `gh pr checks` and verify all 5 checks pass green: `lint`, `typecheck`, `test`, `build`, and `Analyze (javascript-typescript)`.
- Merge PR into `main` (squash-merge, closing `#32`).

### Phase 4: Live GitHub Security Settings & `main` Branch Ruleset (Post-Merge `gh api`)

**Depends on:** Phase 3 (PR merged so `codeql.yml` exists on `main` and exact CodeQL check-run name is verified)

**Tasks:**
- Enable **Secret Scanning** & **Push Protection** via `PATCH /repos/tommardev/eshop-trust-checker` (and test enabling `secret_scanning_non_provider_patterns` + `secret_scanning_validity_checks` if supported on public Free repos).
- Enable **Private Vulnerability Reporting** via `PUT /repos/tommardev/eshop-trust-checker/private-vulnerability-reporting`.
- Confirm exact check-run names and `app.id: 15368` on `main` (`gh api repos/tommardev/eshop-trust-checker/commits/main/check-runs`).
- Create the active `Protect main` Branch Ruleset via `POST /repos/tommardev/eshop-trust-checker/rulesets`.
- Verify `GET /rulesets` returns `HTTP 200`, all security settings are enabled, CodeQL runs green on `main`, and remove the `in-progress` label from closed `#32` (if still present) so sidecars cleanly resume on the backlog.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently verifiable.

### 1. RUN Pre-Flight Checks & Claim Issue `#32`

- **IMPLEMENT**: Verify clean `main`, `PUBLIC` visibility, claim `#32` interactively to prevent a sidecar race, and branch off `main`:
  ```powershell
  gh repo view tommardev/eshop-trust-checker --json visibility
  gh issue edit 32 --add-label in-progress --remove-label ready-for-plan
  git checkout main
  git pull --ff-only
  git checkout -b feat/issue-32-codeql-security-ruleset
  ```
- **GOTCHA**: Do **not** set `plan-ready` on `#32` (doing so would trigger the autonomous Implementer sidecar). Remove `in-progress` only after PR merge + Stage 2 verification completes.
- **VALIDATE**: `gh repo view tommardev/eshop-trust-checker --json visibility --jq .visibility` outputs `PUBLIC`, and `git symbolic-ref --short HEAD` outputs `feat/issue-32-codeql-security-ruleset`.
- **SATISFIES**: AC #1 (verify `PUBLIC` visibility) and sidecar safety.

### 2. CREATE `.github/workflows/codeql.yml`

- **IMPLEMENT**: Create `.github/workflows/codeql.yml` with exact hardened YAML:
  ```yaml
  # Static security analysis via GitHub CodeQL (docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md Task 4.4).
  # Scans JavaScript/TypeScript with the security-extended query suite on PRs,
  # pushes to main, a weekly schedule, and manual dispatch.
  name: CodeQL

  on:
    push:
      branches:
        - main
    pull_request:
      branches:
        - main
    schedule:
      - cron: '23 4 * * 1'
    workflow_dispatch: {}

  permissions: {}

  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: ${{ github.event_name == 'pull_request' }}

  jobs:
    analyze:
      name: Analyze (${{ matrix.language }})
      runs-on: ubuntu-latest
      timeout-minutes: 20
      permissions:
        contents: read
        security-events: write

      strategy:
        fail-fast: false
        matrix:
          include:
            - language: javascript-typescript
              build-mode: none

      steps:
        - name: Checkout repository
          id: checkout
          uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
          with:
            persist-credentials: false

        - name: Initialize CodeQL
          id: init
          uses: github/codeql-action/init@915412ff23e8b7659517e607487dbeae018f2934 # v4.39.5
          with:
            languages: ${{ matrix.language }}
            build-mode: ${{ matrix.build-mode }}
            queries: security-extended

        - name: Perform CodeQL Analysis
          id: analyze
          uses: github/codeql-action/analyze@915412ff23e8b7659517e607487dbeae018f2934 # v4.39.5
          with:
            category: "/language:${{ matrix.language }}"

        - name: Summarize run
          if: always()
          env:
            EVENT_NAME: ${{ github.event_name }}
            LANGUAGE: ${{ matrix.language }}
            BUILD_MODE: ${{ matrix.build-mode }}
            INIT_OUTCOME: ${{ steps.init.outcome }}
            ANALYZE_OUTCOME: ${{ steps.analyze.outcome }}
          run: |
            {
              echo "### CodeQL Summary (${LANGUAGE})"
              echo ""
              echo "| Field | Value |"
              echo "| --- | --- |"
              echo "| Trigger | \`${EVENT_NAME}\` |"
              echo "| Language | \`${LANGUAGE}\` |"
              echo "| Build mode | \`${BUILD_MODE}\` |"
              echo "| Query suite | \`security-extended\` |"
              echo "| Initialize CodeQL | \`${INIT_OUTCOME:-skipped}\` |"
              echo "| Perform CodeQL Analysis | \`${ANALYZE_OUTCOME:-skipped}\` |"
            } | tee -a "$GITHUB_STEP_SUMMARY"
  ```
- **PATTERN**: `.github/workflows/ci.yml` (lines 1–69), `.github/workflows/release-please.yml` (lines 21–31), `docs/agents/security.md` (lines 36–41), `docs/agents/conventions.md` (lines 50–54).
- **GOTCHA**:
  - Do **not** use `pull_request_target`.
  - Do **not** pin the annotated tag SHA (`e274593e...`); use the verified commit SHA `915412ff23e8b7659517e607487dbeae018f2934`.
  - Do **not** use inline `${{ ... }}` inside `run:`; always pass via `env:`.
  - Keep `name: Analyze (${{ matrix.language }})` so the published GitHub Actions check-run context is deterministically `Analyze (javascript-typescript)`.
- **VALIDATE**: `Test-Path .github/workflows/codeql.yml` returns `True` (and Task 3 unit tests validate full contract).
- **SATISFIES**: AC #3 (CodeQL workflow).

### 3. CREATE `src/lib/__tests__/codeql-workflow.test.ts`

- **IMPLEMENT**: Create an offline contract test file using only `node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:url` (no external YAML parser, no network calls) that validates `.github/workflows/codeql.yml`:
  1. Exists, no `\t` tabs, `name: CodeQL`, no `pull_request_target`.
  2. Triggers include `push` (`main`), `pull_request` (`main`), weekly `schedule` (`cron:`), and `workflow_dispatch`.
  3. Top-level `permissions: {}` and job-level `permissions:` restricted strictly to `contents: read` and `security-events: write` (no `contents: write`, no `write-all`).
  4. Concurrency group `${{ github.workflow }}-${{ github.ref }}` with PR-only `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`.
  5. Single job `analyze` with `runs-on: ubuntu-latest`, `timeout-minutes: 20`, `language: javascript-typescript`, `build-mode: none`.
  6. Every `uses:` matches `/^uses:\s+[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*@[0-9a-f]{40}\s+#\s+v\d+\.\d+\.\d+$/` (supporting 3-segment sub-actions like `github/codeql-action/init`), includes `actions/checkout` with `persist-credentials: false`, `github/codeql-action/init` with `queries: security-extended`, and `github/codeql-action/analyze` with `category: "/language:${{ matrix.language }}"`.
  7. Has an `if: always()` step writing to `$GITHUB_STEP_SUMMARY`, with zero `${{` inside any `run:` block.
- **PATTERN**: `src/lib/__tests__/ci-workflow.test.ts` (lines 1–273).
- **IMPORTS**: `node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:url`.
- **GOTCHA**: Split file contents with `/\r?\n/` so assertions work identically on Windows (CRLF) and Ubuntu CI runners (LF). Ensure the SHA regex handles 3-segment action paths (`github/codeql-action/init`).
- **VALIDATE**: `node --test src/lib/__tests__/codeql-workflow.test.ts`
- **SATISFIES**: AC #3 + repo offline-testing requirement (`docs/agents/testing.md`).

### 4. UPDATE `README.md`

- **IMPLEMENT**: Add the live `CI` and `CodeQL` workflow status badges into the existing badge block (`README.md:3–11`), right after the `License` badge (line 5) and before the stack badges:
  ```markdown
  [![CI](https://github.com/tommardev/eshop-trust-checker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tommardev/eshop-trust-checker/actions/workflows/ci.yml)
  [![CodeQL](https://github.com/tommardev/eshop-trust-checker/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/tommardev/eshop-trust-checker/actions/workflows/codeql.yml)
  ```
- **PATTERN**: `README.md` (lines 3–11) — one badge per line, no blank lines inside the block.
- **GOTCHA**:
  - Do **not** alter line 4 (`<!-- x-release-please-version -->`).
  - Do **not** add a `Security` (`workflows/security.yml`) badge yet — Issue `#17` is still open and not merged.
- **VALIDATE**: Verify both badge URLs and `<!-- x-release-please-version -->` exist in `README.md` (validated by Task 5 `governance.test.ts`).
- **SATISFIES**: AC #5 (live CI and CodeQL status badges in `README.md`).

### 5. UPDATE `src/lib/__tests__/governance.test.ts`

- **IMPLEMENT**: Update `src/lib/__tests__/governance.test.ts` (`lines 234–246`):
  - Add positive assertions that `README.md` includes the `CI` badge (`actions/workflows/ci.yml/badge.svg`) and `CodeQL` badge (`actions/workflows/codeql.yml/badge.svg`).
  - Narrow `prematureWorkflowBadges` to `['workflows/security.yml'] as const` (removing `workflows/ci.yml` and `workflows/codeql.yml`, which are now shipped).
- **PATTERN**: `src/lib/__tests__/governance.test.ts` (lines 220–246).
- **GOTCHA**: Do not weaken or delete any other governance assertions (`AGPL-3.0-only`, `COMMERCIAL_LICENSE.md`, `SECURITY.md`, `x-release-please-version`, `workflows/security.yml` guard).
- **VALIDATE**: `node --test src/lib/__tests__/governance.test.ts`
- **SATISFIES**: AC #5 and zero test regressions.

### 6. UPDATE `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` & `docs/decisions/002-public-repository-readiness-and-governance.md`

- **IMPLEMENT**:
  1. In `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`:
     - Check off Task **`2.6`** (line 100): `- [x] **2.6 Verify all 4 CI checks on a live GitHub PR**` (verified green on PR `#38`: `lint`, `typecheck`, `test`, `build`).
     - Check off Task **`4.4`** (line 181): `- [x] **4.4 Add static security analysis (CodeQL)**`.
     - Check off Task **`5.4`** (line 214): `- [x] **5.4 Enforce Branch Protection / Ruleset on \`main\`**`, updating the outdated `Current Blocker` line (`private` Free repo `403`) to note the repo is `PUBLIC` and `Protect main` Ruleset is active with Repository Admin bypass (`actor_id: 5`), PR review (`1` approval, dismiss stale reviews, resolve conversations), up-to-date required checks (`lint`, `typecheck`, `test`, `build`, `Analyze (javascript-typescript)`), and blocked force-push/deletion.
     - Append a dated row to `## Iteration Log` (after line 260) recording `2.6, 4.4, 5.4` for `feat/issue-32-codeql-security-ruleset` (Issue `#32`).
  2. In `docs/decisions/002-public-repository-readiness-and-governance.md`:
     - Update line 3 `- **Status:**` from `Proposed (Ready for Prep Execution)` to `Accepted (Phases A, B & C Implemented — 2026-11-25)`.
     - Update the `Context` opening note if needed (or add a concise `Implementation Status` note under Phase C) recording that `#31` (Phase A), `PUBLIC` flip (Phase B), and `#32` (Phase C) are complete, including the `Protect main` Ruleset bypass & `release-please` note.
- **PATTERN**: `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (lines 258–260).
- **GOTCHA**: Keep ADR-002's historical Context/Audit summary truthful — do not delete the audit evidence, just update status and record Phase C completion cleanly.
- **VALIDATE**: Read diff of both docs; run `npm test`.
- **SATISFIES**: AC #6 (Roadmap `4.4` and `5.4` checked off + Iteration Log updated, plus `2.6` cleanup and ADR-002 sync).

### 7. RUN Local Validation, Open PR & Verify Live `CI` + `CodeQL` Checks

- **IMPLEMENT**:
  1. Run all 4 repo validation checks:
     - `npx tsc --noEmit --incremental false`
     - `npm run lint`
     - `npm test`
     - `npm run build`
  2. Stage and commit with Conventional Commit + `Context:` section (per `.agents/commands/commit.md` because `docs/` changed):
     - Subject: `feat: add CodeQL workflow, live CI/CodeQL badges, and governance docs` (no `(#32)` in subject/PR title per `docs/agents/planning.md:46`!)
     - Body includes `Closes #32` and `Context:` summary.
  3. Push branch and create PR:
     - `git push -u origin feat/issue-32-codeql-security-ruleset`
     - `gh pr create --base main --head feat/issue-32-codeql-security-ruleset --title "feat: add CodeQL workflow, live CI/CodeQL badges, and governance docs" --body-file ...`
  4. Verify all 5 live checks pass on the PR:
     - `gh pr checks <PR_NUM> --watch`
     - Confirm exact check names: `lint`, `typecheck`, `test`, `build`, `Analyze (javascript-typescript)` all pass green!
  5. Squash-merge PR into `main` (which closes Issue `#32`), then switch locally to `main` and `git pull --ff-only`.
- **GOTCHA**: Do **not** put `(#32)` in the PR title (GitHub squash-merge + `release-please` would duplicate references in `CHANGELOG.md`). Put `Closes #32` in the PR body only. Also inspect whether CodeQL flagged any findings in `src/` on the PR; if any genuine security alerts appear, triage or fix before merging.
- **VALIDATE**: `gh pr checks <PR_NUM>` shows all 5 checks `pass`; `gh pr view <PR_NUM> --json state,mergedAt` shows `MERGED`.
- **SATISFIES**: AC #3 (CodeQL runs green on PR) and AC #5–#6 landed on `main`.

### 8. RUN Live GitHub Security Settings via `gh api` (Secret Scanning, Push Protection, Private Vulnerability Reporting)

- **IMPLEMENT**: Immediately after PR merge (while still interactive), enable GitHub repository security controls:
  1. Enable **Secret Scanning** & **Push Protection** (plus check `secret_scanning_non_provider_patterns` and `secret_scanning_validity_checks` on public repos):
     ```powershell
     $secPayload = @'
     {
       "security_and_analysis": {
         "secret_scanning": { "status": "enabled" },
         "secret_scanning_push_protection": { "status": "enabled" }
       }
     }
     '@
     $secPayload | gh api -X PATCH repos/tommardev/eshop-trust-checker --input - --jq .security_and_analysis
     ```
     *(Optional follow-up check: attempt enabling `secret_scanning_non_provider_patterns` and `secret_scanning_validity_checks`; if GitHub Free public allows them, keep enabled; if `422`/`403` GHAS-only, leave them off and note it.)*
  2. Enable **Private Vulnerability Reporting**:
     ```powershell
     gh api -X PUT repos/tommardev/eshop-trust-checker/private-vulnerability-reporting
     gh api repos/tommardev/eshop-trust-checker/private-vulnerability-reporting
     ```
- **GOTCHA**: Use `--input -` with clean JSON rather than nested `-f` flags to avoid PowerShell quoting pitfalls with nested `security_and_analysis` objects.
- **VALIDATE**:
  - `gh api repos/tommardev/eshop-trust-checker --jq .security_and_analysis` shows `secret_scanning.status == "enabled"` and `secret_scanning_push_protection.status == "enabled"`.
  - `gh api repos/tommardev/eshop-trust-checker/private-vulnerability-reporting --jq .enabled` returns `true`.
- **SATISFIES**: AC #2 (Secret Scanning, Push Protection, Private Vulnerability Reporting enabled).

### 9. RUN Create & Verify `main` Branch Ruleset via `gh api` (Roadmap `5.4`)

- **IMPLEMENT**:
  1. Confirm the exact check-run names and `app.id` (`15368`) on `main` after the merged PR's workflows finish:
     ```powershell
     gh api repos/tommardev/eshop-trust-checker/commits/main/check-runs --jq ".check_runs[] | {name, app_id: .app.id, conclusion}"
     ```
     Verify `lint`, `typecheck`, `test`, `build`, and `Analyze (javascript-typescript)` all appear with `app_id: 15368` and `conclusion: "success"`.
  2. Create the `Protect main` Ruleset via `POST /repos/tommardev/eshop-trust-checker/rulesets`:
     ```json
     {
       "name": "Protect main",
       "target": "branch",
       "enforcement": "active",
       "bypass_actors": [
         {
           "actor_id": 5,
           "actor_type": "RepositoryRole",
           "bypass_mode": "always"
         }
       ],
       "conditions": {
         "ref_name": {
           "include": ["~DEFAULT_BRANCH"],
           "exclude": []
         }
       },
       "rules": [
         { "type": "deletion" },
         { "type": "non_fast_forward" },
         {
           "type": "pull_request",
           "parameters": {
             "dismiss_stale_reviews_on_push": true,
             "require_code_owner_review": false,
             "require_last_push_approval": false,
             "required_approving_review_count": 1,
             "required_review_thread_resolution": true
           }
         },
         {
           "type": "required_status_checks",
           "parameters": {
             "do_not_enforce_on_create": false,
             "strict_required_status_checks_policy": true,
             "required_status_checks": [
               { "context": "lint", "integration_id": 15368 },
               { "context": "typecheck", "integration_id": 15368 },
               { "context": "test", "integration_id": 15368 },
               { "context": "build", "integration_id": 15368 },
               { "context": "Analyze (javascript-typescript)", "integration_id": 15368 }
             ]
           }
         }
       ]
     }
     ```
  3. Clean up the temporary interactive lock label on closed `#32` (and verify no open PRs or lock labels remain):
     ```powershell
     gh issue edit 32 --remove-label in-progress
     gh api repos/tommardev/eshop-trust-checker/rulesets --jq ".[] | {id, name, enforcement, target}"
     ```
- **GOTCHA**:
  - **Assumed/Decided — Admin Bypass (`actor_id: 5`, `bypass_mode: "always"`):** Required so the solo maintainer's Planner sidecar (`git push` of `.agents/plans/` to `main`), `Release-As` empty commits, and solo PR merges (`required_approving_review_count: 1`) work cleanly while external contributors are strictly required to open PRs, obtain 1 review, resolve threads, and pass all 5 status checks.
  - **Assumed/Decided — `release-please` `GITHUB_TOKEN`:** When `release-please` opens `chore(main): release 0.1.4` right after PR `#32` merges, its PR will not auto-trigger `pull_request` checks (GitHub anti-recursion rule). Either close & reopen that Release PR to trigger CI + CodeQL, or merge it via Admin Bypass after verifying `main` is green.
  - Verify `POST /rulesets` does not duplicate an existing ruleset (`GET /rulesets` should return `[]` before creation).
- **VALIDATE**:
  - `gh api repos/tommardev/eshop-trust-checker/rulesets` returns `HTTP 200` containing `"name": "Protect main"`, `"enforcement": "active"`.
  - `gh run list --workflow codeql.yml --limit 3` shows `conclusion: "success"` on `main`.
  - `gh issue list --state open --json number,labels` shows zero lock labels (`in-progress`, `planning-in-progress`, `implemented`, `automation-failed`).
- **SATISFIES**: AC #4 and AC #7.

---

## TESTING STRATEGY

### Unit Tests

- **`src/lib/__tests__/codeql-workflow.test.ts` (New):** Pure Node.js offline contract test suite mirroring `ci-workflow.test.ts` (zero external libraries, zero network calls). Verifies YAML structure, triggers (`push`, `pull_request`, `schedule`, `workflow_dispatch`), zero `pull_request_target`, top-level `permissions: {}` + job-level `contents: read` / `security-events: write`, PR-only concurrency cancellation, `timeout-minutes: 20`, 40-char SHA-pinned `actions/checkout` (`persist-credentials: false`) + `github/codeql-action/{init,analyze}`, `javascript-typescript`, `build-mode: none`, `queries: security-extended`, and `if: always()` `$GITHUB_STEP_SUMMARY` with zero inline `${{` in `run:`.
- **`src/lib/__tests__/governance.test.ts` (Updated):** Verifies `README.md` includes live `CI` and `CodeQL` workflow badges while still rejecting premature `workflows/security.yml` badges and preserving `<!-- x-release-please-version -->`.

### Integration Tests

- **Live GitHub Actions PR Run (`gh pr checks`):** Confirms `.github/workflows/codeql.yml` parses cleanly on GitHub's runner, executes `github/codeql-action/init@v4.39.5` + `analyze@v4.39.5` on `ubuntu-latest` (Node 24), uploads SARIF to GitHub Code Scanning, writes the Job Summary table, and reports `Analyze (javascript-typescript)` green alongside `lint`, `typecheck`, `test`, `build`.
- **Live GitHub Admin API Verification (`gh api`):** Confirms `PUBLIC` visibility, `security_and_analysis` enabled statuses, `private-vulnerability-reporting` enabled (`true`), and `Protect main` Ruleset active (`HTTP 200`).

### Edge Cases

- **Windows CRLF vs. Linux LF line endings:** `codeql-workflow.test.ts` splits on `/\r?\n/` so tests pass on both Windows dev machines and Ubuntu CI runners.
- **3-segment sub-action SHA regex:** `github/codeql-action/init@<sha>` and `github/codeql-action/analyze@<sha>` must pass SHA-pinning validation.
- **Zero CodeQL alerts vs. findings:** If CodeQL surfaces any genuine security findings on existing `src/` code during PR `#32`, review them immediately in the PR's Security tab rather than ignoring or weakening `security-extended`.
- **`release-please` Release PR after merge:** Merging PR `#32` (`feat:`) will trigger `release-please` to open `chore(main): release 0.1.4`. Confirm it is handled cleanly (close/reopen to run checks or merge cleanly) so Core 1a unblocks sidecars afterward.

---

## VALIDATION COMMANDS

### Level 1: Syntax, Types & Lint

```powershell
npx tsc --noEmit --incremental false
npm run lint
```

### Level 2: Offline Unit Tests

```powershell
npm test
```

### Level 3: Production Build

```powershell
npm run build
```

### Level 4: Live GitHub Verification (Interactive `gh` CLI)

```powershell
gh repo view tommardev/eshop-trust-checker --json visibility
gh pr checks <PR_NUM>
gh api repos/tommardev/eshop-trust-checker --jq .security_and_analysis
gh api repos/tommardev/eshop-trust-checker/private-vulnerability-reporting
gh api repos/tommardev/eshop-trust-checker/rulesets --jq ".[] | {id, name, enforcement, target, bypass_actors, rules}"
gh run list --workflow codeql.yml --limit 3
```

---

## ACCEPTANCE CRITERIA

- [ ] **AC #1:** Repository visibility verified as `PUBLIC` (`gh repo view --json visibility` returns `PUBLIC`).
- [ ] **AC #2:** GitHub **Secret Scanning**, **Push Protection**, and **Private Vulnerability Reporting** enabled and verified via `gh api`.
- [ ] **AC #3:** `.github/workflows/codeql.yml` added with 40-char SHA-pinned `actions/checkout` (`persist-credentials: false`) and `github/codeql-action/{init,analyze}`, minimal `permissions: { contents: read, security-events: write }`, `timeout-minutes: 20`, `languages: javascript-typescript`, `queries: security-extended`, PR/push/weekly-schedule triggers, and `if: always()` `$GITHUB_STEP_SUMMARY`, backed by offline unit tests (`codeql-workflow.test.ts`).
- [ ] **AC #4:** Active `Protect main` Branch Ruleset created via `gh api repos/tommardev/eshop-trust-checker/rulesets` blocking deletion and force-push, requiring PRs (`1` approval, dismiss stale reviews, conversation resolution), requiring up-to-date passing status checks (`lint`, `typecheck`, `test`, `build`, `Analyze (javascript-typescript)`), and granting `RepositoryRole` Admin (`actor_id: 5`) bypass.
- [ ] **AC #5:** Live `CI` and `CodeQL` workflow badges added to `README.md` (`Security` omitted until `#17`) and `src/lib/__tests__/governance.test.ts` updated and green.
- [ ] **AC #6:** Roadmap Tasks `2.6`, `4.4`, and `5.4` checked off in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` with Iteration Log entry, and `docs/decisions/002-public-repository-readiness-and-governance.md` status updated.
- [ ] **AC #7:** `gh api repos/tommardev/eshop-trust-checker/rulesets` returns `HTTP 200` with the active `main` ruleset, all 4 local validation commands pass, and live CodeQL runs green on PR and `main`.

---

## COMPLETION CHECKLIST

- [ ] Phase 0 pre-flight & `#32` interactive lock completed
- [ ] `.github/workflows/codeql.yml` created and validated
- [ ] `src/lib/__tests__/codeql-workflow.test.ts` created and passing
- [ ] `README.md` badges added and `src/lib/__tests__/governance.test.ts` updated and passing
- [ ] `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` and `docs/decisions/002-public-repository-readiness-and-governance.md` updated
- [ ] Local validation suite passes (`tsc`, `lint`, `test`, `build`)
- [ ] PR opened, all 5 live checks (`lint`, `typecheck`, `test`, `build`, `Analyze (javascript-typescript)`) pass green, PR merged to `main`
- [ ] Secret Scanning, Push Protection, and Private Vulnerability Reporting enabled and verified via `gh api`
- [ ] `Protect main` Branch Ruleset created and verified (`HTTP 200`) via `gh api`
- [ ] Interactive `in-progress` label removed from closed `#32` and Release PR (`0.1.4`) handled so sidecars resume cleanly

---

## OPEN QUESTIONS / ASSUMPTIONS

The user delegated all 3 governance choices to recommended globally accepted defaults suitable for a solo maintainer that smoothly scale to external contributors:

1. **Decided — Repository Admin Bypass (`actor_id: 5`, `bypass_mode: "always"`):** Enables the solo maintainer's autonomous Planner sidecar (`git push` of `.agents/plans/` to `main`), `Release-As` empty commits, and solo merges without deadlocking, while strictly enforcing PR + review + checks for any external contributor or non-admin collaborator.
2. **Decided — `required_approving_review_count: 1` + `dismiss_stale_reviews_on_push: true`:** Paired with Admin Bypass above, this is the globally accepted open-source standard: external contributors and future `Write` collaborators cannot self-merge without review, while the solo repo Admin can still merge verified PRs cleanly. (`require_code_owner_review` stays `false` until `#16` adds `.github/CODEOWNERS`.)
3. **Decided — Keep default `GITHUB_TOKEN` in `release-please.yml` for now:** Avoids adding/rotating a PAT secret in `#32` (out of scope). When `release-please` opens a Release PR, close & reopen it to trigger CI + CodeQL (or merge via Admin Bypass after confirming `main` is green).
4. **Decided — Exact Ruleset Status Checks (5 checks now, extensible later):** Enforce `lint`, `typecheck`, `test`, `build`, and `Analyze (javascript-typescript)` (`integration_id: 15368`). Add `smoke` (`#15`) and `audit` (`#17`) to the ruleset only after those workflows exist and run green.
5. **Decided — Also check off Roadmap `2.6` (`PR_CHECKS_AND_PREVIEW_ROADMAP.md`):** Task `2.6` was already verified by PR `#38`'s 4 green checks and is trivially updated alongside `4.4` and `5.4`.
6. **Assumed — `secret_scanning_non_provider_patterns` / `secret_scanning_validity_checks`:** Treat as optional best-effort enhancements on public Free repos; core AC #2 requires `secret_scanning` and `secret_scanning_push_protection` enabled.

---

## NOTES (open canvas)

### Why `required_approving_review_count: 1` + Admin Bypass Beats `0` Approvals

| Setting | Solo Maintainer Experience | Future External Contributor / Collaborator |
| :--- | :--- | :--- |
| **`1` approval + Admin Bypass (`actor_id: 5`)** *(Chosen)* | Unblocked: Planner sidecar pushes plans cleanly; maintainer merges verified PRs via Admin Bypass | Protected: must open PR, pass all 5 CI/CodeQL checks, resolve all threads, and get 1 maintainer approval (stale approvals dismissed on new push) |
| `0` approvals + Admin Bypass | Same for solo maintainer | Weak: any future `Write` collaborator could self-merge without code review |
| `1` approval + NO Bypass | Broken: Planner sidecar `git push` fails with `GH013`, and solo maintainer cannot approve own PRs | Protected |

### Why Stage 1 (PR) Must Merge Before Stage 2 (`main` Ruleset)

1. Creating the `main` Ruleset with `Analyze (javascript-typescript)` required **before** `.github/workflows/codeql.yml` has executed on the repo risks a check-name mismatch blocking PR `#32` itself.
2. Running Stage 1 first lets us observe the exact live `check-runs` JSON from GitHub Actions (`name` + `app.id: 15368`) and plug that verified context directly into `POST /rulesets`.

### Action SHA Verification Provenance (2026-11-25 via `gh api`)

- `actions/checkout` `v7.0.1`: `3d3c42e5aac5ba805825da76410c181273ba90b1` (`node24`, matches `.github/workflows/ci.yml`).
- `github/codeql-action` `v4.39.5`: annotated tag `e274593ecfcbcdc39c8f034978d84614cebcb71d` -> dereferenced commit SHA `915412ff23e8b7659517e607487dbeae018f2934` (`init/action.yml` confirmed `using: node24`).

### Confidence Assessment

- **Estimated Confidence Score:** `9.5/10` for one-pass interactive execution (all Action SHAs dereferenced and verified, exact `ci.yml` check names & `app_id: 15368` verified live, `governance.test.ts` badge guard caught upfront, and `Protect main` Ruleset designed to keep solo automation working while meeting open-source contributor standards).

---

## AMENDMENTS

*(Empty at creation. Append dated entries here if the plan changes after approval/execution.)*

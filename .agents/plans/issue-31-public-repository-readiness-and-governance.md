# Feature: Public Repository Readiness & Pre-Public Governance (Issue #31)

The following plan should be complete, but it is important that you validate documentation, existing codebase patterns, and task sanity before you start implementing.

Keep edits surgical and strictly scoped to Issue `#31` (Phase A of `docs/decisions/002-public-repository-readiness-and-governance.md`). Do **not** flip repository visibility to `PUBLIC`, do **not** add new npm dependencies, and do **not** manually bump `"version"` in `package.json`, `package-lock.json`, or `.release-please-manifest.json`.

## Feature Description

Prepare `tommardev/eshop-trust-checker` for switching from `PRIVATE` to `PUBLIC` visibility by adding globally recognized dual-licensing (`AGPL-3.0 + Commercial`), security policy, community health documents, npm/GitHub package metadata, and public-ready `README.md` badges and pointers:

1. **Dual-Licensing (`LICENSE` + `COMMERCIAL_LICENSE.md`):** Add verbatim GNU AGPL-3.0 text in root `LICENSE` (preserving 100% GitHub Licensee detection as `AGPL-3.0`) paired with `COMMERCIAL_LICENSE.md` describing paid commercial licensing terms for closed-source / commercial use outside AGPL-3.0.
2. **Security Policy (`SECURITY.md`):** Document supported pre-1.0 versions, private vulnerability reporting via GitHub Security Advisories, response timelines, and SSRF/scraping security boundaries.
3. **Community Health Files (`CONTRIBUTING.md` + `CODE_OF_CONDUCT.md`):** Document Node `22.18+` setup, the 4 canonical offline validation commands, Conventional Commits + `release-please` rules, and issue-first PR workflow, plus the full standard Contributor Covenant v2.1.
4. **Package Metadata (`package.json`):** Add `"license": "AGPL-3.0-only"`, `"homepage"`, and `"repository"` while preserving `"private": true` and existing `"version": "0.1.0"`.
5. **README Governance & Badges (`README.md`):** Add `License`, `GitHub Issues`, and `Last Commit` badges alongside existing badges (preserving the `<!-- x-release-please-version -->` line untouched) plus concise License, Security, and Contributing sections.
6. **GitHub Repository Metadata (`gh repo edit`):** Populate the repository `description` and 6 `topics` (`lithuania`, `vvtat`, `ecommerce`, `trust-checker`, `nextjs`, `typescript`) while keeping visibility `PRIVATE`.
7. **Offline Governance Regression Tests (`src/lib/__tests__/governance.test.ts`):** Verify all governance files, `package.json` metadata invariants, `README.md` badges/links, and absence of unreplaced template placeholders or leaked private emails using `node:test` offline.

## User Story

As a repository maintainer and prospective open-source contributor or commercial evaluator
I want clear dual-licensing, vulnerability disclosure, contribution guidelines, code of conduct, and repository metadata in place before the repo becomes public
So that the repository meets GitHub Community Standards, protects commercial rights under `AGPL-3.0 + Commercial`, and enables safe external collaboration once visibility flips to `PUBLIC`.

## Problem Statement

1. **No License (`All Rights Reserved` default):** Without root `LICENSE` and `package.json` `"license"`, GitHub treats the codebase as "All Rights Reserved" and cannot render a standard license badge or clear legal terms for open-source vs commercial users.
2. **Missing Security & Community Health Files:** `SECURITY.md`, `CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md` do not exist, leaving GitHub **Insights -> Community Standards** incomplete and giving researchers no documented path to privately report SSRF, XSS, or scraping vulnerabilities.
3. **Incomplete Metadata & Badges:** `package.json` lacks `"license"`, `"homepage"`, and `"repository"`; GitHub repo `description` and `topics` are empty; and `README.md` lacks License, Security, and Contributing pointers plus public-ready `License`, `GitHub Issues`, and `Last Commit` badges.

## Solution Statement

1. **Verbatim `LICENSE` + Separate `COMMERCIAL_LICENSE.md`:** Pull the exact canonical GNU AGPL-3.0 text from GitHub's license API (`gh api licenses/agpl-3.0 --jq .body`) into `LICENSE` without custom modifications so GitHub Licensee detects `AGPL-3.0` cleanly, and document commercial licensing terms (flat fee or revenue share by agreement, GitHub contact pointer with no private email) in `COMMERCIAL_LICENSE.md`.
2. **Project-Accurate `SECURITY.md` & `CONTRIBUTING.md`:** Ground `SECURITY.md` in `docs/agents/security.md` (SSRF private IP blocking, 2MB payload limit, 2.5s–4s `AbortController` timeouts, XSS/scraped HTML sanitization) and `CONTRIBUTING.md` in `AGENTS.md`, `docs/agents/stack.md`, `docs/agents/planning.md`, and `docs/agents/testing.md`.
3. **Standard `CODE_OF_CONDUCT.md`:** Add the full Contributor Covenant v2.1 text with the enforcement contact pointing cleanly to `@tommardev` on GitHub (zero placeholders, zero personal email addresses).
4. **Surgical `package.json` & `README.md` Updates:** Add only the required metadata fields to `package.json` (preserving `"private": true` and `"version"`), add the 3 Phase-A badges and governance sections to `README.md` (preserving the exact `x-release-please-version` badge line tested by `src/lib/__tests__/version.test.ts`), and set GitHub `description` and `topics` via `gh repo edit`.
5. **Deterministic Offline Tests:** Add `src/lib/__tests__/governance.test.ts` using `node:test` and `node:fs` (zero network calls) alongside existing mocked unit tests so `npm test` stays 100% deterministic offline in sandbox.

## Out of Scope / Non-Goals

- **Not included:** Switching repository visibility from `PRIVATE` to `PUBLIC` (manual Phase B gate after this PR merges).
- **Not included:** Enabling CodeQL (`4.4`), Secret Scanning / Push Protection, Private Vulnerability Reporting API toggle, or `main` Branch Ruleset (`5.4`) — tracked in Issue `#32`.
- **Not included:** Adding `CI`, `Security`, `CodeQL`, `Preview Smoke`, or `Coverage` workflow badges to `README.md` before those workflows exist (Issues `#14`, `#15`, `#17`, `#19`, `#32`).
- **Not included:** Adding or upgrading npm dependencies, modifying `package-lock.json`, bumping `"version"`, or creating/editing `CHANGELOG.md`.
- **Not included:** Rewriting `docs/decisions/002-public-repository-readiness-and-governance.md` or updating unrelated `README.md` stack bullets (e.g. `Next.js 14+` wording in `## 🛠️ Siūlomas Technologinis Stekas`).
- **Not included:** Modifying `.github/ISSUE_TEMPLATE/*` or `.github/PULL_REQUEST_TEMPLATE.md` (already present; PR template updates are tracked in Issue `#16`).

## Feature Metadata

- **Feature Type:** Governance / Documentation / Repository Configuration
- **Estimated Complexity:** Low
- **Primary Systems Affected:** Root governance files (`LICENSE`, `COMMERCIAL_LICENSE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`), `package.json`, `README.md`, GitHub repository metadata (`description`, `topics`), offline unit tests (`src/lib/__tests__/governance.test.ts`)
- **Dependencies:** None (no new npm dependencies; requires authenticated `gh` CLI for fetching verbatim AGPL-3.0 text and running `gh repo edit`)

## Related Work

- **Implements:** GitHub Issue `#31` (`https://github.com/tommardev/eshop-trust-checker/issues/31`)
- **Epic / ADR:** `docs/decisions/002-public-repository-readiness-and-governance.md` (Phase A)
- **Back-references:**
  - `.agents/plans/issue-33-pre-1-0-release-please-and-version-sync.md` — established `"private": true`, Pre-1.0 `release-please` rules, `README.md` `<!-- x-release-please-version -->` badge contract, and `src/lib/__tests__/version.test.ts`
  - `.agents/plans/issue-13-ci-prep-node-runtime-test-discovery-and-docs.md` — established Node `>=22.18.0`, multi-file `npm test` glob discovery, and canonical 4 validation commands
- **Forward-references:**
  - Issue `#32` (Phase C: CodeQL `4.4`, Secret Scanning, `main` Branch Ruleset `5.4`, live CI/Security/CodeQL badges — depends on `#31` and manual Phase B visibility flip)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `docs/decisions/002-public-repository-readiness-and-governance.md` (lines 1–95) — Why: Authoritative ADR for Phase A vs B vs C split, dual-license decision (`AGPL-3.0 + Commercial` confirmed in Issue `#31` comment), tiered badge plan, and Community Standards verification checklist.
- `package.json` (lines 1–39) — Why: Target for `"license"`, `"homepage"`, and `"repository"`; must keep `"private": true`, `"version": "0.1.0"`, and exact `engines`/`scripts`/`dependencies`.
- `README.md` (lines 1–99) — Why: Target for 3 new badges (lines 3–8) and License/Security/Contributing sections (after line 87 or 99); line 4 (`x-release-please-version`) is strictly tested by `version.test.ts`.
- `src/lib/__tests__/version.test.ts` (lines 127–222) — Why: Enforces `pkg.private === true`, `manifest['.'] === pkg.version`, and the exact `README.md` version badge line format; also provides the exact `node:test` + `node:fs` pattern to mirror in `src/lib/__tests__/governance.test.ts`.
- `AGENTS.md` (lines 21–30, 74–92) — Why: Canonical commands, security boundaries, Conventional Commits, and Pre-1.0 `release-please` rules referenced in `CONTRIBUTING.md`.
- `docs/agents/security.md` (lines 1–42) — Why: Source of truth for SSRF IP ranges, timeout/payload limits, XSS prevention, and secret hygiene documented in `SECURITY.md`.
- `docs/agents/planning.md` (lines 1–47) — Why: Source of truth for issue-first workflow, branch naming, and `Closes #<N>` PR linking documented in `CONTRIBUTING.md`.
- `docs/agents/stack.md` (lines 1–41) — Why: Source of truth for Node `22.18+` / `24 LTS` requirement and the 4 validation commands.

### New Files to Create

- `LICENSE` — Verbatim full text of GNU Affero General Public License v3.0 (GNU AGPL-3.0).
- `COMMERCIAL_LICENSE.md` — Dual-license commercial terms (closed-source / commercial use outside AGPL-3.0, flat fee or revenue share by agreement, GitHub contact channel).
- `SECURITY.md` — Security policy, supported versions, private vulnerability reporting instructions, response timeline, and SSRF/scraping security scope.
- `CONTRIBUTING.md` — Contributor guide covering Node `22.18+` setup, validation commands, offline test mock discipline, Conventional Commits, `release-please` version rules, and issue-first workflow.
- `CODE_OF_CONDUCT.md` — Standard Contributor Covenant v2.1 with GitHub maintainer contact method.
- `src/lib/__tests__/governance.test.ts` — Deterministic offline unit tests validating presence and invariants of governance files, `package.json` metadata, and `README.md` badges/links.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [GNU Affero General Public License v3.0 (Official Plain Text)](https://www.gnu.org/licenses/agpl-3.0.txt) / GitHub API `gh api licenses/agpl-3.0 --jq .body`
  - Specific section: Full verbatim license text (Preamble, Sections 0–17, End of Terms and Conditions)
  - Why: GitHub's Licensee detector requires unmodified canonical AGPL-3.0 text in `LICENSE` to recognize `AGPL-3.0`.
- [Contributor Covenant v2.1 (Markdown)](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md)
  - Specific section: Complete standard v2.1 text with `Enforcement` contact replaced
  - Why: Satisfies GitHub Community Standards Code of Conduct check.
- [GitHub Docs: About Community Profiles for Public Repositories](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories)
  - Specific section: Checklist of root/community health files (`README.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md`, issue/PR templates, description)
  - Why: Confirms exact filenames and locations recognized by GitHub Insights -> Community Standards.
- [npm `package.json` Specification (`license`, `homepage`, `repository`)](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#license)
  - Specific section: SPDX `license` expression, `homepage`, and `repository` object shape
  - Why: Ensures valid npm/SPDX metadata while keeping `"private": true`.

### Patterns to Follow

**1. Existing `README.md` Badge Block (`README.md:3-8` — DO NOT break line 4!):**
```markdown
[![Live App](https://img.shields.io/badge/Live%20App-Vercel-000000?logo=vercel&logoColor=white)](https://eshop-trust-checker.vercel.app)
[![Version](https://img.shields.io/static/v1?label=Version&message=v0.1.0&color=1d4ed8)](package.json) <!-- x-release-please-version -->
[![License: AGPL-3.0 + Commercial](https://img.shields.io/badge/License-AGPL--3.0%20%2B%20Commercial-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![GitHub Issues](https://img.shields.io/github/issues/tommardev/eshop-trust-checker)](https://github.com/tommardev/eshop-trust-checker/issues)
[![Last Commit](https://img.shields.io/github/last-commit/tommardev/eshop-trust-checker)](https://github.com/tommardev/eshop-trust-checker/commits/main)
```
*GOTCHA:* `src/lib/__tests__/version.test.ts:192-221` asserts that the `README.md` line containing `x-release-please-version` matches the exact format `[![Version](https://img.shields.io/static/v1?label=Version&message=v0.1.0&color=1d4ed8)](package.json) <!-- x-release-please-version -->`. Never alter that line or add `x-release-please-version` to any other line.

**2. `package.json` Metadata Pattern (keep `"private": true` and `"version": "0.1.0"`):**
```json
  "name": "eshop-trust-checker",
  "version": "0.1.0",
  "private": true,
  "license": "AGPL-3.0-only",
  "description": "Lithuanian E-Shop Security and Eligibility Verification Web App based on VVTAT and State Registers",
  "homepage": "https://eshop-trust-checker.vercel.app",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/tommardev/eshop-trust-checker.git"
  },
```

**3. Offline Test Pattern (`src/lib/__tests__/version.test.ts:1-25`):**
- Uses built-in `node:test` (`describe`, `it`), `node:assert/strict`, `node:fs` (`readFileSync`, `existsSync`), and `node:path`.
- Executed by `npm test` (`node --test "src/**/*.test.ts" "src/**/*.spec.ts"`).
- Zero network calls; any tests touching network checkers (`WhoisChecker`, `SslChecker`, `WebScraper`, `fetch`) must mock external DNS/TLS/HTTP calls so `npm test` runs deterministically offline in sandbox.

**4. Command-Line Safety Rule for `gh` Commands (`BypassSandbox: true`):**
- Run each `gh` command in its own single `run_command` call (never chain with `&&`, `;`, or `||`).
- Never include backticks, `$`, `$(...)`, `{...}`, or multi-line strings in `gh` arguments.

---

## IMPLEMENTATION PLAN

### Phase 1: Dual-License Files

**Independent of:** Phase 2 and Phase 3 (all root markdown files can be authored cleanly in order).

**Tasks:**
- Create root `LICENSE` containing verbatim GNU AGPL-3.0 text fetched from GitHub's official license API (`gh api licenses/agpl-3.0 --jq .body`).
- Create root `COMMERCIAL_LICENSE.md` detailing paid commercial licensing terms (closed-source / commercial use outside AGPL-3.0, flat fee or revenue share by agreement, clean GitHub contact pointer with no private email).

### Phase 2: Security & Community Health Files

**Tasks:**
- Create root `SECURITY.md` with supported versions, private vulnerability reporting instructions (GitHub Security Advisories), response timeline expectations, and SSRF/scraping/XSS security scope.
- Create root `CONTRIBUTING.md` covering Node `22.18+` setup, canonical validation commands, offline mocked test requirements, Conventional Commits + `release-please` rules, and issue-first workflow.
- Create root `CODE_OF_CONDUCT.md` with complete standard Contributor Covenant v2.1 text and GitHub maintainer enforcement contact.

### Phase 3: Package Metadata, README Updates & GitHub Repository Metadata

**Depends on:** Phase 1 and Phase 2 (so `README.md` links target existing root files).

**Tasks:**
- Update `package.json` with `"license"`, `"homepage"`, and `"repository"` while preserving `"private": true` and `"version": "0.1.0"`.
- Update `README.md` with Phase-A badges (`License`, `GitHub Issues`, `Last Commit`) and License, Security, and Contributing sections.
- Set GitHub repository `description` and `topics` via `gh repo edit` (without changing `visibility`).

### Phase 4: Offline Verification & Regression Testing

**Depends on:** Phase 1, Phase 2, and Phase 3.

**Tasks:**
- Create `src/lib/__tests__/governance.test.ts` validating governance files, `package.json` metadata, `README.md` badges/links, and privacy/placeholder guardrails offline.
- Run all 4 canonical validation commands (`npx tsc --noEmit --incremental false`, `npm run lint`, `npm test`, `npm run build`) and verify live GitHub metadata with `gh repo view`.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### 1. CREATE `LICENSE`

- **IMPLEMENT**: Fetch the exact canonical GNU Affero General Public License v3.0 text from GitHub's license API (`gh api licenses/agpl-3.0 --jq .body` with `BypassSandbox: true`, or verify against `https://www.gnu.org/licenses/agpl-3.0.txt` via Exa MCP `web_fetch_exa`), and write the complete verbatim text to `LICENSE` at the repository root. Do **not** add custom commercial clauses, headers, or footers inside `LICENSE`.
- **PATTERN**: Standard verbatim GNU AGPL-3.0 (starts with `GNU AFFERO GENERAL PUBLIC LICENSE` / `Version 3, 19 November 2007`, includes sections `0.` through `17.` and `END OF TERMS AND CONDITIONS`).
- **IMPORTS**: N/A (plain text file).
- **GOTCHA**: Modifying `LICENSE` with custom dual-license prose breaks GitHub's Licensee gem detection (turns `AGPL-3.0` into `Other` or `null`). Keep all commercial license terms strictly in `COMMERCIAL_LICENSE.md` and `README.md`.
- **VALIDATE**: `node -e "const fs=require('fs'); const t=fs.readFileSync('LICENSE','utf8'); if(!t.includes('GNU AFFERO GENERAL PUBLIC LICENSE')||!t.includes('Version 3, 19 November 2007')||!t.includes('END OF TERMS AND CONDITIONS')||t.length<30000) process.exit(1); console.log('LICENSE OK:', t.length, 'chars');"`
- **SATISFIES**: AC #1, AC #8

### 2. CREATE `COMMERCIAL_LICENSE.md`

- **IMPLEMENT**: Create `COMMERCIAL_LICENSE.md` at the repository root explaining the Dual-License model (`AGPL-3.0 + Commercial`) clearly and concisely:
  - **Overview:** The codebase is dual-licensed: free to use, modify, and self-host under the [GNU Affero General Public License v3.0](LICENSE) (which requires releasing modified source code to network users under AGPL-3.0), OR available under a paid **Commercial License** for proprietary / closed-source or commercial deployments outside AGPL-3.0 obligations.
  - **When You Need a Commercial License:** Integrating `eshop-trust-checker` into a closed-source SaaS/commercial product, hosting modified versions for commercial use without disclosing source code under AGPL-3.0, or embedding the audit engine/rules into proprietary enterprise compliance workflows.
  - **Commercial Terms:** Available by written agreement with the copyright holder (`tommardev`), structured as a flat annual/perpetual fee or revenue share depending on scope, usage volume, and support needs.
  - **How to Request a Commercial License:** Direct inquiries to the project maintainer via GitHub (`https://github.com/tommardev`) or by opening a brief inquiry issue at `https://github.com/tommardev/eshop-trust-checker/issues` requesting commercial licensing contact (explicitly note not to post confidential details publicly).
  - **Disclaimer:** Clarify that `COMMERCIAL_LICENSE.md` is an informational summary and does not itself grant commercial rights until a separate written commercial license agreement is signed.
- **PATTERN**: `docs/decisions/002-public-repository-readiness-and-governance.md:40-49` (Dual-License AGPL-3.0 + Commercial guidance).
- **IMPORTS**: N/A (markdown).
- **GOTCHA**: Do **not** include any personal/private email address or secret in `COMMERCIAL_LICENSE.md`. Use only GitHub profile / repository URLs (`https://github.com/tommardev`).
- **VALIDATE**: `node -e "const fs=require('fs'); const t=fs.readFileSync('COMMERCIAL_LICENSE.md','utf8'); if(!t.includes('AGPL-3.0')||!t.includes('https://github.com/tommardev')||/@[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) process.exit(1); console.log('COMMERCIAL_LICENSE.md OK');"`
- **SATISFIES**: AC #1

### 3. CREATE `SECURITY.md`

- **IMPLEMENT**: Create `SECURITY.md` at the repository root covering all AC #2 requirements:
  - **Supported Versions:** Table showing current `0.x` (latest `main` / latest `0.x.y` release) as supported (`:white_check_mark:`) and older pre-release commits as unsupported (`:x:`).
  - **Reporting a Vulnerability (Private Disclosure):**
    - Instruct researchers **never** to open a public GitHub Issue for security vulnerabilities.
    - Primary channel: GitHub Private Vulnerability Reporting (`https://github.com/tommardev/eshop-trust-checker/security/advisories/new`).
    - Fallback note (while private or if advisory form is unavailable): contact the maintainer (`@tommardev`) via GitHub (`https://github.com/tommardev`) to arrange private disclosure.
    - What to include: affected endpoint/file, minimal reproduction steps, expected vs actual behavior, and impact assessment.
  - **Response Expectations:**
    - Initial acknowledgment target: within **72 hours** (3 business days).
    - Triage & severity assessment: within **7 days**.
    - Coordinated disclosure: agree on patch timeline before any public advisory.
  - **Security Scope & Architecture Guardrails** (aligned with `docs/agents/security.md`):
    - **In scope:** SSRF bypasses in `src/lib/security.ts` (loopback `127.0.0.0/8`, `::1`, `localhost`; RFC1918 private networks `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`; cloud metadata `169.254.169.254`; DNS rebinding / redirect chains), HTML scraping / XSS injection (`dangerouslySetInnerHTML` or unsanitized scraped content), DoS via missing timeouts (`> 4000ms`) or oversized payloads (`> 2MB`), API route authentication/input validation bypasses (`POST /api/check`, `POST /api/sync-blacklist`), and high/critical dependency vulnerabilities.
    - **Out of scope:** Rate limits or downtime of third-party external registries (VVTAT, DOMREG/RDAP, Lietuvos Bankas, Registrų Centras), social engineering, or findings against third-party e-shops being audited.
- **PATTERN**: `docs/agents/security.md:1-42` (SSRF boundaries, timeout/payload caps, XSS and secret rules).
- **IMPORTS**: N/A (markdown).
- **GOTCHA**: Do **not** include any personal email address; keep reporting strictly to GitHub Security Advisories (`https://github.com/tommardev/eshop-trust-checker/security/advisories/new`) and GitHub profile (`https://github.com/tommardev`).
- **VALIDATE**: `node -e "const fs=require('fs'); const t=fs.readFileSync('SECURITY.md','utf8'); if(!t.includes('security/advisories/new')||!t.includes('SSRF')||!t.includes('Supported Versions')||/@[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) process.exit(1); console.log('SECURITY.md OK');"`
- **SATISFIES**: AC #2, AC #8

### 4. CREATE `CONTRIBUTING.md`

- **IMPLEMENT**: Create `CONTRIBUTING.md` at the repository root covering all AC #3 requirements:
  - **Prerequisites & Local Setup:** Node.js `>=22.18.0` (Node `22.18+` or `24 LTS` recommended for unflagged native TypeScript test execution via `node --test`), npm (`npm install`, `npm run dev`).
  - **Issue-First Workflow:** Reference `.github/ISSUE_TEMPLATE/` (bug/feature templates) and `docs/agents/planning.md`: open or pick an existing GitHub Issue before non-trivial work, branch cleanly (`feat/issue-<N>-<slug>` or `fix/issue-<N>-<slug>`), keep PRs atomic (1 issue = 1 PR), and link PRs with `Closes #<N>`.
  - **Validation Commands (Required Before Opening a PR):** List the exact 4 canonical commands:
    - `npm test` (offline unit tests — **must mock** external network/DNS/TLS/HTTP calls such as `WhoisChecker`, `SslChecker`, `WebScraper`, and `fetch` so tests run deterministically offline)
    - `npx tsc --noEmit --incremental false`
    - `npm run lint`
    - `npm run build`
  - **Commit Conventions & Versioning:** Explain Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`, `style:`) and Pre-1.0 `release-please` rules (`AGENTS.md:88-92`): do **not** manually bump `"version"` in `package.json`, `package-lock.json`, or `.release-please-manifest.json`, do **not** hand-edit `CHANGELOG.md`, and do **not** use `!` / `BREAKING CHANGE:` without explicit maintainer approval.
  - **Security & Code Quality Expectations:** No secrets or `.env.local`, respect SSRF protections (`src/lib/security.ts`), ask before adding new npm dependencies, and follow [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) and [`SECURITY.md`](SECURITY.md).
  - **Licensing Note:** Contributions submitted via Pull Request are licensed under the project's license ([`LICENSE`](LICENSE), AGPL-3.0).
- **PATTERN**: `AGENTS.md:21-30,74-92`, `docs/agents/stack.md:12,38-41`, `docs/agents/planning.md:9-47`, `docs/agents/testing.md:1-35`.
- **IMPORTS**: N/A (markdown).
- **GOTCHA**: Ensure all 4 exact commands appear verbatim (`npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`) and Node requirement says `22.18+` (not older Node 18/20).
- **VALIDATE**: `node -e "const fs=require('fs'); const t=fs.readFileSync('CONTRIBUTING.md','utf8'); for(const s of ['22.18','npm test','npx tsc --noEmit --incremental false','npm run lint','npm run build','Conventional Commits','CODE_OF_CONDUCT.md']){if(!t.includes(s)){console.error('Missing:',s);process.exit(1);}} console.log('CONTRIBUTING.md OK');"`
- **SATISFIES**: AC #3, AC #8

### 5. CREATE `CODE_OF_CONDUCT.md`

- **IMPLEMENT**: Create `CODE_OF_CONDUCT.md` at the repository root containing the complete, standard **Contributor Covenant Code of Conduct, Version 2.1** (`Our Pledge`, `Our Standards`, `Enforcement Responsibilities`, `Scope`, `Enforcement`, `Enforcement Guidelines` 1–4, `Attribution`).
  - Replace `[INSERT CONTACT METHOD]` in the `Enforcement` section with: `the project maintainer via GitHub (https://github.com/tommardev)`.
  - Ensure **no** bracketed template placeholders (`[INSERT ...]` or `[contact ...]`) remain anywhere in the file.
- **PATTERN**: Standard Contributor Covenant v2.1 (`https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md`).
- **IMPORTS**: N/A (markdown).
- **GOTCHA**: Do **not** leave `[INSERT CONTACT METHOD]` or insert a private email address. GitHub's Community Standards detector recognizes standard Contributor Covenant v2.1 headings and attribution link (`https://www.contributor-covenant.org/version/2/1/code_of_conduct.html`).
- **VALIDATE**: `node -e "const fs=require('fs'); const t=fs.readFileSync('CODE_OF_CONDUCT.md','utf8'); if(!t.includes('Contributor Covenant')||!t.includes('2.1')||t.includes('[INSERT')||/@[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) process.exit(1); console.log('CODE_OF_CONDUCT.md OK');"`
- **SATISFIES**: AC #4, AC #8

### 6. UPDATE `package.json`

- **IMPLEMENT**: Add `"license"`, `"homepage"`, and `"repository"` fields to `package.json` immediately after `"private": true` / `"description"`:
  ```json
  "license": "AGPL-3.0-only",
  "homepage": "https://eshop-trust-checker.vercel.app",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/tommardev/eshop-trust-checker.git"
  },
  ```
- **PATTERN**: `package.json:1-10` (2-space indentation, valid JSON).
- **IMPORTS**: N/A (JSON).
- **GOTCHA**:
  - Keep `"private": true` untouched (`src/lib/__tests__/version.test.ts:147` asserts `pkg.private === true`).
  - Keep `"version": "0.1.0"` untouched (never manually bump version; `release-please` owns it).
  - Do **not** run `npm install` or modify `dependencies`, `devDependencies`, `overrides`, or `package-lock.json`.
- **VALIDATE**: `node -e "const p=require('./package.json'); if(p.private!==true||p.version!=='0.1.0'||p.license!=='AGPL-3.0-only'||p.homepage!=='https://eshop-trust-checker.vercel.app'||p.repository?.url!=='git+https://github.com/tommardev/eshop-trust-checker.git') process.exit(1); console.log('package.json OK');"`
- **SATISFIES**: AC #5

### 7. UPDATE `README.md`

- **IMPLEMENT**: Make two surgical additions to `README.md`:
  1. **Badge block (`README.md:3-8`):** Keep line 4 (`Version` badge with `<!-- x-release-please-version -->`) **100% verbatim**, and add the 3 Phase-A badges:
     - `[![License: AGPL-3.0 + Commercial](https://img.shields.io/badge/License-AGPL--3.0%20%2B%20Commercial-blue.svg)](LICENSE)`
     - `[![GitHub Issues](https://img.shields.io/github/issues/tommardev/eshop-trust-checker)](https://github.com/tommardev/eshop-trust-checker/issues)`
     - `[![Last Commit](https://img.shields.io/github/last-commit/tommardev/eshop-trust-checker)](https://github.com/tommardev/eshop-trust-checker/commits/main)`
  2. **Governance Sections (append at end of `README.md` after line 99, separated by `---`):**
     - `## 🤝 Prisidėjimas ir Bendruomenė (Contributing)` — brief pointer to [`CONTRIBUTING.md`](CONTRIBUTING.md) (Node `22.18+`, validation commands, Conventional Commits, issue-first workflow) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
     - `## 🔒 Saugumas (Security)` — brief pointer to [`SECURITY.md`](SECURITY.md) and private reporting via [GitHub Security Advisories](https://github.com/tommardev/eshop-trust-checker/security/advisories/new).
     - `## 📄 Licencija (License)` — clear summary of the Dual-License model: open-source under [**GNU AGPL-3.0**](LICENSE) and available under a paid [**Commercial License**](COMMERCIAL_LICENSE.md) for closed-source or commercial use outside AGPL-3.0 terms.
- **PATTERN**: `README.md:3-8,87-99` (Shields.io markdown badge style + emoji H2 headers + `---` section dividers).
- **IMPORTS**: N/A (markdown).
- **GOTCHA**:
  - **CRITICAL:** Do **not** alter line 4 (`[![Version](https://img.shields.io/static/v1?label=Version&message=v0.1.0&color=1d4ed8)](package.json) <!-- x-release-please-version -->`). `src/lib/__tests__/version.test.ts:192-221` tests this exact line string!
  - Do **not** add `CI`, `Security`, `CodeQL`, `Preview Smoke`, or `Coverage` workflow badges (explicitly Out of Scope until `#14`, `#15`, `#17`, `#19`, `#32`).
- **VALIDATE**: `node --test "src/lib/__tests__/version.test.ts"`
- **SATISFIES**: AC #6, AC #8

### 8. CREATE `src/lib/__tests__/governance.test.ts`

- **IMPLEMENT**: Create an offline unit test suite `src/lib/__tests__/governance.test.ts` mirroring `src/lib/__tests__/version.test.ts` (`node:test`, `node:assert/strict`, `node:fs`, `node:path`) with zero external network/DNS/TLS/HTTP calls:
  - Test 1 (`root governance files exist`): asserts `LICENSE`, `COMMERCIAL_LICENSE.md`, `SECURITY.md`, `CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md` exist at repo root.
  - Test 2 (`LICENSE contains verbatim GNU AGPL-3.0`): asserts `LICENSE` starts with / includes `GNU AFFERO GENERAL PUBLIC LICENSE`, `Version 3, 19 November 2007`, `END OF TERMS AND CONDITIONS`, is at least 30,000 characters, and does not embed custom commercial pricing clauses that would break Licensee detection.
  - Test 3 (`COMMERCIAL_LICENSE.md, SECURITY.md, CODE_OF_CONDUCT.md privacy and completeness`): asserts no raw private email addresses (`/@[a-z0-9.-]+\.[a-z]{2,}/i`, excluding GitHub noreply if ever present) and no leftover template placeholders (`[INSERT`); verifies `SECURITY.md` references `security/advisories/new` and `SSRF`; verifies `CODE_OF_CONDUCT.md` references `Contributor Covenant` and `2.1`; verifies `CONTRIBUTING.md` documents Node `22.18`, `Conventional Commits`, and all 4 canonical validation commands (`npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`).
  - Test 4 (`package.json public-readiness metadata`): asserts `pkg.private === true`, `pkg.license === 'AGPL-3.0-only'`, `pkg.homepage === 'https://eshop-trust-checker.vercel.app'`, and `pkg.repository?.type === 'git'` + `pkg.repository?.url === 'git+https://github.com/tommardev/eshop-trust-checker.git'`.
  - Test 5 (`README.md badges and governance pointers`): asserts `README.md` includes links to `LICENSE`, `COMMERCIAL_LICENSE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, plus the `License`, `GitHub Issues`, and `Last Commit` badges, while NOT adding premature workflow badges (`workflows/ci.yml`, `workflows/codeql.yml`, `workflows/security.yml`).
- **PATTERN**: `src/lib/__tests__/version.test.ts:1-25,140-222` (helpers `readJsonFile`, `readFileSync(path.resolve(process.cwd(), ...), 'utf8')`, `describe`/`it`).
- **IMPORTS**: `node:test`, `node:assert/strict`, `node:fs`, `node:path`.
- **GOTCHA**: Ensure ESLint (`npm run lint`) and `tsconfig.json` strict typecheck (`npx tsc --noEmit --incremental false`) pass with zero warnings on the test file (avoid `any`, use explicit typed interfaces for `package.json` shape). Keep all tests 100% offline with zero network calls.
- **VALIDATE**: `node --test "src/lib/__tests__/governance.test.ts"`
- **SATISFIES**: AC #1–#6, AC #8

### 9. RUN GitHub Repository Metadata Update (`gh repo edit`)

- **IMPLEMENT**: Execute a single `gh repo edit` command outside sandbox (`BypassSandbox: true`, plain single-line command with no `$`, backticks, or shell chaining) to set `description` and the 6 required `topics`:
  ```powershell
  gh repo edit tommardev/eshop-trust-checker --description "Lithuanian e-shop trust and compliance audit engine (VVTAT, JAR, LB, WHOIS/RDAP, TLS)" --add-topic lithuania --add-topic vvtat --add-topic ecommerce --add-topic trust-checker --add-topic nextjs --add-topic typescript
  ```
- **PATTERN**: `docs/decisions/002-public-repository-readiness-and-governance.md:69` & Issue `#31` AC #7.
- **IMPORTS**: Authenticated `gh` CLI (`BypassSandbox: true`).
- **GOTCHA**:
  - **NEVER** pass `--visibility public`! Repository must stay `PRIVATE` until the manual Phase B gate after this PR merges.
  - Keep `homepage` intact (`https://eshop-trust-checker.vercel.app` is already set).
- **VALIDATE**: Run `gh repo view --json visibility,description,homepageUrl,repositoryTopics,licenseInfo` (`BypassSandbox: true`) and confirm `visibility` is `"PRIVATE"`, `description` is populated, `homepageUrl` is `"https://eshop-trust-checker.vercel.app"`, and `repositoryTopics` contains all 6 topics (`lithuania`, `vvtat`, `ecommerce`, `trust-checker`, `nextjs`, `typescript`).
- **SATISFIES**: AC #7, AC #8

---

## TESTING STRATEGY

### Unit Tests

- **Offline Guarantee:** All unit tests executed by `npm test` (`node --test "src/**/*.test.ts" "src/**/*.spec.ts"`) **must** run deterministically offline in the sandbox. Existing checker tests (`src/lib/__tests__/checkers.test.ts`) mock all external network/DNS/TLS/HTTP calls (`WhoisChecker`, `SslChecker`, `WebScraper`, `fetch`), and the new `src/lib/__tests__/governance.test.ts` reads local workspace files strictly via `node:fs` with zero network I/O.
- **New Test Coverage (`src/lib/__tests__/governance.test.ts`):**
  - Verifies existence and core content of `LICENSE`, `COMMERCIAL_LICENSE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.
  - Verifies `LICENSE` matches verbatim GNU AGPL-3.0 markers (preventing accidental truncation or custom text that breaks Licensee).
  - Verifies privacy hygiene (no personal email addresses committed) and zero unreplaced Contributor Covenant placeholders (`[INSERT`).
  - Verifies `package.json` preserves `"private": true` and `"version"` while exposing `"license"`, `"homepage"`, and `"repository"`.
  - Verifies `README.md` contains the 3 Phase-A badges and governance links without breaking the `x-release-please-version` badge line tested by `src/lib/__tests__/version.test.ts`.

### Integration / Build Verification

- Run `npm run build` (`next build`) to confirm `package.json` metadata changes and the new test file do not impact Next.js bundling or TypeScript compilation.
- Verify `gh repo view --json visibility,description,homepageUrl,repositoryTopics,licenseInfo` confirms live GitHub metadata matches AC #7 while visibility remains `PRIVATE`.

### Edge Cases

- **`release-please` Badge Regression:** Adding badges to `README.md` must not touch line 4 (`<!-- x-release-please-version -->`), verified explicitly by `src/lib/__tests__/version.test.ts`.
- **GitHub Licensee Detection:** Any custom header/footer added to `LICENSE` risks GitHub showing `Other` instead of `AGPL-3.0`; verified by fetching canonical text from `gh api licenses/agpl-3.0 --jq .body`.
- **Private Repo Badge Rendering:** `GitHub Issues` and `Last Commit` Shields.io badges return "repo not found" while the repo is `PRIVATE` and automatically start rendering live counts as soon as Phase B flips the repo to `PUBLIC` — this is expected and explicitly specified in Issue `#31` AC #6 (`ready for public visibility`).
- **Community Standards Post-Merge Check:** GitHub's **Insights -> Community Standards** dashboard evaluates the default branch (`main`), so full green checks for `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md` appear immediately after the PR merges to `main`.

---

## VALIDATION COMMANDS

Execute every command below to confirm zero regressions and 100% task completeness:

### Level 1: TypeScript Typecheck & Linting

```powershell
npx tsc --noEmit --incremental false
```

```powershell
npm run lint
```

### Level 2: Deterministic Offline Unit Tests

```powershell
npm test
```

*(Runs `src/lib/__tests__/checkers.test.ts`, `src/lib/__tests__/version.test.ts`, and `src/lib/__tests__/governance.test.ts` completely offline.)*

### Level 3: Production Build

```powershell
npm run build
```

### Level 4: GitHub Metadata & Safety Verification (Outside Sandbox)

```powershell
gh repo view --json visibility,description,homepageUrl,repositoryTopics,licenseInfo
```

Verify:
- `visibility` is still `"PRIVATE"` (visibility flip is manual Phase B).
- `description` is non-empty and accurate.
- `homepageUrl` is `"https://eshop-trust-checker.vercel.app"`.
- `repositoryTopics` includes `lithuania`, `vvtat`, `ecommerce`, `trust-checker`, `nextjs`, `typescript`.
- `git diff package-lock.json .release-please-manifest.json` is empty (no manual version bumps or dependency changes).

---

## ACCEPTANCE CRITERIA

- [ ] **AC #1 (`LICENSE` + `COMMERCIAL_LICENSE.md`):** Root `LICENSE` contains the complete verbatim GNU AGPL-3.0 text; root `COMMERCIAL_LICENSE.md` describes paid commercial licensing terms (closed-source / commercial use outside AGPL-3.0, flat fee or revenue share by agreement, clean GitHub contact pointer).
- [ ] **AC #2 (`SECURITY.md`):** Root `SECURITY.md` documents supported versions, private vulnerability reporting via GitHub Security Advisories, response expectations, and SSRF/scraping security scope.
- [ ] **AC #3 (`CONTRIBUTING.md`):** Root `CONTRIBUTING.md` documents Node `22.18+` setup, the 4 canonical validation commands (`npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`), offline test mocking, Conventional Commits, `release-please` rules, and issue-first workflow.
- [ ] **AC #4 (`CODE_OF_CONDUCT.md`):** Root `CODE_OF_CONDUCT.md` contains full standard Contributor Covenant v2.1 with GitHub maintainer contact method and zero leftover placeholders.
- [ ] **AC #5 (`package.json`):** Updated with `"license": "AGPL-3.0-only"`, `"homepage": "https://eshop-trust-checker.vercel.app"`, and `"repository"`, while preserving `"private": true` and `"version": "0.1.0"`.
- [ ] **AC #6 (`README.md`):** Updated with License (Dual-License AGPL-3.0 + Commercial summary), Security, and Contributing sections plus `License`, `GitHub Issues`, and `Last Commit` badges, with `<!-- x-release-please-version -->` badge line preserved intact.
- [ ] **AC #7 (GitHub Metadata):** Repository `description` and all 6 `topics` (`lithuania`, `vvtat`, `ecommerce`, `trust-checker`, `nextjs`, `typescript`) are set via `gh repo edit`, and repository `visibility` remains `PRIVATE`.
- [ ] **AC #8 (Validation & Community Standards):** All 4 validation commands (`npx tsc --noEmit --incremental false`, `npm run lint`, `npm test`, `npm run build`) pass with zero errors, no private emails/secrets are committed, and all GitHub **Insights -> Community Standards** files exist in root/standard locations ready for green checks upon merge.

---

## COMPLETION CHECKLIST

- [ ] All tasks 1–9 executed in dependency order
- [ ] Each task's inline `VALIDATE` check passed immediately
- [ ] `npx tsc --noEmit --incremental false` exits `0`
- [ ] `npm run lint` exits `0`
- [ ] `npm test` exits `0` (100% offline, including `governance.test.ts`, `version.test.ts`, and `checkers.test.ts`)
- [ ] `npm run build` exits `0`
- [ ] `gh repo view` confirms `visibility: "PRIVATE"`, populated `description`, `homepageUrl`, and all 6 `topics`
- [ ] Zero new npm dependencies added; `package-lock.json` and `.release-please-manifest.json` unchanged
- [ ] Commit uses Conventional Commits (`chore:` or `docs:`) so `release-please` does not trigger an unintended version bump; PR body includes `Closes #31`

---

## OPEN QUESTIONS / ASSUMPTIONS

- **Assumed — `package.json` `"license"` value set to `"AGPL-3.0-only"`:** Issue `#31` AC #5 allows `"AGPL-3.0-only"` or `"SEE LICENSE IN LICENSE"`. This plan chooses `"AGPL-3.0-only"` because it is a valid SPDX license expression recognized by npm, GitHub, and SBOM scanners (matching the verbatim AGPL-3.0 text in `LICENSE`), while `COMMERCIAL_LICENSE.md` provides the optional separate paid commercial grant.
- **Assumed — Contact channel uses GitHub profile/advisories with no email address:** Issue `#31` forbids committing real private contact emails. `SECURITY.md` points to `https://github.com/tommardev/eshop-trust-checker/security/advisories/new`, and `COMMERCIAL_LICENSE.md` and `CODE_OF_CONDUCT.md` point to `https://github.com/tommardev`. Confirm before execution only if a dedicated public alias email (e.g. `security@` or `licensing@`) is preferred later.
- **Assumed — `README.md` governance sections use concise bilingual headings matching existing `README.md` conventions:** Existing `README.md` uses Lithuanian prose with English parenthetical subtitles (e.g. `## 🚀 Paleidimas ir Vystymas (Getting Started)`), while `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `COMMERCIAL_LICENSE.md` are written in clear English for universal open-source / legal readability.
- **Assumed — `gh repo edit` executes during implementation PR:** Setting repo `description` and `topics` is idempotent, safe on a `PRIVATE` repo, and does not affect code branches; keeping `visibility` as `PRIVATE` preserves the manual Phase B gate.
- **Assumed — GitHub Insights -> Community Standards final UI check happens upon merging the PR to `main`:** GitHub evaluates Community Standards files against the default branch (`main`). All required files (`README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`) plus repo `description` will be present once merged.

---

## NOTES (open canvas)

- **Why keep `LICENSE` strictly unmodified AGPL-3.0:** GitHub's `licensee` library compares root `LICENSE` against canonical SPDX templates. Even a 3-line custom dual-license preamble inside `LICENSE` can prevent GitHub from displaying the standard `AGPL-3.0 license` sidebar badge and populating `licenseInfo.spdxId = "AGPL-3.0"`. Placing commercial terms in `COMMERCIAL_LICENSE.md` and referencing both files from `README.md` is the exact industry pattern used by Grafana, Plausible Analytics, and Cal.com.
- **Shields.io badge note while repo is `PRIVATE`:** Static badges (`Live App`, `Version`, `License: AGPL-3.0 + Commercial`, stack badges) render immediately on private repos. Dynamic GitHub badges (`GitHub Issues`, `Last Commit`) require the repo to be `PUBLIC` to query GitHub's unauthenticated API and will automatically display live counts once Phase B switches visibility to `PUBLIC`.
- **Post-merge workflow for maintainer (Manual Phase B -> Issue `#32`):**
  1. Merge Issue `#31` PR into `main` and confirm **Insights -> Community Standards** shows all green checks.
  2. Manually flip repository visibility to `PUBLIC` in GitHub Settings -> General -> Danger Zone (Phase B).
  3. Trigger Issue `#32` (Phase C) to enable CodeQL (`4.4`), Secret Scanning / Push Protection, `main` Branch Ruleset (`5.4`), and live workflow badges.

---

## AMENDMENTS

- *(None at creation.)*

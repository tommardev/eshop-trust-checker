# ADR-002: Public Repository Readiness, Licensing & Governance Plan

- **Status:** Proposed (Ready for Prep Execution)
- **Date:** 2026-11-23
- **Related:** `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (`4.4`, `5.4`), `docs/agents/security.md`, `docs/agents/planning.md`, Issues `#31` (Phase A) & `#32` (Phase C)

---

## Context

`tommardev/eshop-trust-checker` is currently `PRIVATE` on GitHub Free, which blocks two key security and governance controls:
- **Roadmap `4.4`:** CodeQL static security analysis (`.github/workflows/codeql.yml`)
- **Roadmap `5.4`:** Branch Protection / Rulesets on `main` (`HTTP 403` on private Free repos)
- **GitHub Secret Scanning & Push Protection:** Free and natively available once a repository is `PUBLIC`.

Before switching visibility to `PUBLIC`, the repository should meet standard open-source security, legal, and community conventions.

---

## Pre-Public Audit Summary (Verified 2026-11-23)

### Already Clean / Ready
- **Git history & tracked files:** Zero `.env*` files, zero hardcoded secrets/keys/tokens, zero private local file paths (`C:\Users\...`, `D:\Workplace\...`), and commits already use GitHub noreply email (`119356035+tommardev@users.noreply.github.com`).
- **`.gitignore`:** Properly ignores `.env*` (with `!.env.example`), `.vercel`, `.next/`, `node_modules/`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.crt`, `.agents/skills/`, and `worktrees/`.
- **Hosting (Task `3.3`):** Vercel GitHub App is already connected (`https://eshop-trust-checker.vercel.app`) with automatic PR previews.
- **Dependabot Alerts:** Already enabled (`HTTP 204`).
- **Templates:** `.github/ISSUE_TEMPLATE/{bug.yml,feature.yml,config.yml}` and `.github/PULL_REQUEST_TEMPLATE.md` exist.

### Gaps to Close Before Going Public
1. **License (`LICENSE` + `package.json`):** No `LICENSE` file and no `"license"` field in `package.json`. Without an explicit license, GitHub defaults to "All Rights Reserved".
2. **Security Policy (`SECURITY.md`):** Missing vulnerability disclosure instructions (how researchers report SSRF, XSS, or dependency issues privately via GitHub Security Advisories).
3. **Community Health Files:** Missing `CONTRIBUTING.md` (local dev, validation commands, PR conventions) and `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).
4. **Package & Repo Metadata:**
   - `package.json` is missing `"license"`, `"repository"`, and `"homepage"` (`private: true` stays `true` to prevent accidental `npm publish`).
   - GitHub repo `description` and `topics` are empty (`homepageUrl` is already set to `https://eshop-trust-checker.vercel.app`).
   - `README.md` should include a brief License & Security section (and optional CI badge once `#14` merges).

---

## License Decision (Choose Before Executing Phase A)

> **Important distinction:** Under the OSI Open Source Definition, a license that restricts commercial use or charges royalties is **Source-Available** or **Dual-Licensed**, not strictly OSI Open Source. There is no single standard SPDX license with a built-in "% revenue share" clause (revenue definitions and reporting require a short commercial agreement). The globally accepted pattern is **Dual Licensing**: a public license in `LICENSE` paired with a `COMMERCIAL_LICENSE.md` (or `README.md` section) for paid commercial terms.

| Option | Type | Summary | Pros | Cons |
| :--- | :--- | :--- | :--- | :--- |
| **AGPL-3.0 + Commercial** *(Recommended for commercial compensation)* | Dual-License (OSI Copyleft + Paid Commercial) | Free if the user open-sources their entire hosted/modified service under AGPL-3.0; commercial/closed-source users buy a paid Commercial License (flat fee or % revenue share). | Globally recognized by GitHub (`AGPL-3.0` badge), legally battle-tested (used by Grafana, Plausible, Cal.com), strong leverage for paid SaaS/commercial licensing. | A commercial user can still use it free *if* they publish all their own source code under AGPL-3.0. |
| **PolyForm-Noncommercial-1.0.0 + Commercial** | Source-Available (SPDX standard + Paid Commercial) | Free strictly for non-commercial use (personal, education, research, non-profit). **Any** commercial use requires a paid Commercial License (flat fee or % revenue share). | Directly matches "free non-commercial, paid commercial"; short lawyer-drafted standard SPDX text. | Not OSI-approved open source; GitHub shows "Other" instead of a standard OSI badge (Shields.io badge still works). |
| **MIT** | Permissive OSI Open Source | Free for any use, including closed-source commercial use, with attribution only. | Maximum adoption, zero friction. | Zero legal leverage to require commercial compensation. |

---

## README Badges Plan

- **Add now (works immediately):** Live App (`Vercel`), `Next.js 15`, `TypeScript 5.6`, `Node >=22.18`, `Tailwind CSS 3`.
- **Add in Phase A (after `LICENSE` & Public flip):** `License` badge, `GitHub Issues`, `Last Commit`.
- **Add later (as each CI workflow merges):** `CI` (`#14`), `Security` (`#17`), `CodeQL` (`4.4`), `Preview Smoke` (`#15`), `Coverage` (`#19`).

---

## Execution Plan (Ordered Phases)

### Phase A: Pre-Public Repository Preparation (While Still Private)
1. Add `LICENSE` (chosen above: `MIT` or `Apache-2.0`).
2. Add `SECURITY.md` (supported versions, private reporting via GitHub Security Advisories, expected response timeline, SSRF/scraping scope).
3. Add `CONTRIBUTING.md` (setup with Node 22.18+, validation commands `npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`, Conventional Commits, issue-first workflow).
4. Add `CODE_OF_CONDUCT.md` (standard Contributor Covenant v2.1).
5. Update `package.json` with `"license"`, `"repository"`, and `"homepage"` (keep `"private": true`).
6. Update `README.md` with License, Security, and Contributing pointers.
7. Set GitHub repository metadata via `gh repo edit` (`--description` and `--add-topic` e.g. `lithuania`, `vvtat`, `ecommerce`, `trust-checker`, `nextjs`, `typescript`).

### Phase B: Flip Visibility to Public (Manual Gate)
1. Final sanity check: `git status`, confirm no untracked sensitive files, confirm Phase A is merged to `main`.
2. Switch visibility in GitHub UI (`Settings` → `General` → `Danger Zone` → `Change repository visibility` → `Public`) or explicitly authorize `gh repo edit --visibility public`.

### Phase C: Post-Public Security & Governance Unlock (Automated via `gh` / PR)
1. **GitHub Code Security (Settings / API):**
   - Enable **Secret Scanning** and **Push Protection** (free on public repos).
   - Enable **Private Vulnerability Reporting** (matches `SECURITY.md`).
2. **CodeQL Workflow (Roadmap `4.4`):**
   - Add `.github/workflows/codeql.yml` with SHA-pinned `actions/checkout` (`persist-credentials: false`) and `github/codeql-action/{init,analyze}`, `permissions: { contents: read, security-events: write }`, `timeout-minutes: 20`, `languages: javascript-typescript`, `queries: security-extended`.
3. **`main` Branch Ruleset (Roadmap `5.4`):**
   - Create `main` Ruleset via `gh api repos/tommardev/eshop-trust-checker/rulesets`:
     - Block force-push and branch deletion.
     - Require Pull Request before merging (`>= 1` approval or bypass for repo admin if solo maintainer), conversation resolution, and up-to-date branch.
     - Add required status checks (`lint`, `typecheck`, `test`, `build`) as soon as Issue `#14` merges (and `audit` / `smoke` once `#17` / `#15` merge).
4. Check off `4.4` and `5.4` in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`.

---

## Verification

- GitHub **Insights → Community Standards** shows green checks for Description, README, Code of Conduct, Contributing, License, Security Policy, Issue Templates, and PR Template.
- `gh repo view --json visibility,licenseInfo,description,repositoryTopics` returns `PUBLIC` and populated metadata.
- `gh api repos/tommardev/eshop-trust-checker/rulesets` returns the active `main` ruleset (`HTTP 200`).
- `.github/workflows/codeql.yml` runs green on `main` and PRs.

# Feature: CI Prep — Align Node 22.18+ Runtime, Multi-File `npm test`, and Validation Docs

The following plan should be complete, but it is important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, scripts, and documentation files. Keep edits surgical and strictly scoped to Issue #13.

## Feature Description

Resolve all Phase 1 repository runtime, test-discovery, and validation documentation gaps identified in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` before enabling GitHub Actions CI (`#14`). Specifically:

1. Declare `"engines": { "node": ">=22.18.0" }` in `package.json` and update Node.js runtime requirements in `README.md` and `docs/agents/stack.md` to `22.18+` / `24 LTS` (unflagged native TypeScript stripping for `node --test`).
2. Update `package.json` `"scripts.test"` from a single hardcoded file (`src/lib/__tests__/checkers.test.ts`) to cross-platform multi-file glob discovery (`node --test "src/**/*.test.ts" "src/**/*.spec.ts"`), verified to work cleanly in both Windows (`cmd.exe` / `pwsh`) and Linux (`/bin/sh` / `bash`).
3. Document the canonical 4-command validation suite (`npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, and `npm run build`) in `docs/agents/testing.md` and `docs/agents/stack.md`, explicitly noting that `.agents/skills/piv-validate/SKILL.md` is gitignored via `.gitignore` (and updating the local gitignored copy only when present in the main workspace without committing it).
4. Confirm all 100 existing unit tests in `src/lib/__tests__/checkers.test.ts` remain deterministically offline (mocking `WhoisChecker`, `SslChecker`, `WebScraper`, `Security.validateHostname`, `tls.connect`, and `fetch`).
5. Check off Phase 1 Tasks `1.1`–`1.4` and append an iteration log entry in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`.

## User Story

As a maintainer and CI automation pipeline for `eshop-trust-checker`  
I want Node.js runtime requirements, cross-platform multi-file test discovery, and validation commands aligned across `package.json` and project documentation  
So that local checks and upcoming GitHub Actions CI workflows (`#14`) execute all offline unit tests reliably on Node `22.18+` / `24 LTS` without silent skips or environment drift.

## Problem Statement

1. **Missing Node Engine Constraint & Stale Docs**: `src/lib/__tests__/checkers.test.ts` (and `src/lib/audit-engine.ts`) use direct `.ts` import extensions (`allowImportingTsExtensions: true` in `tsconfig.json`), which require unflagged Node.js type stripping introduced in Node `>=22.18.0`. However, `package.json` has no `"engines"` field, while `README.md` (line 52) and `docs/agents/stack.md` (line 12) still list Node `18+ / 20+`.
2. **Single-File `npm test` Blind Spot**: `package.json` (line 11) hardcodes `"test": "node --test src/lib/__tests__/checkers.test.ts"`. Any new `*.test.ts` or `*.spec.ts` files added in future issues (`#6`, `#9`, `#15`, `#19`) would be silently skipped by `npm test` and CI.
3. **Validation Command Drift & Gitignored Skill Placeholders**: `docs/agents/testing.md` (lines 30-33) omits `npm test`, `npm run build`, and `--incremental false` on `tsc`; `docs/agents/stack.md` (lines 28-36) omits `npm test` and `--incremental false`; and `.agents/skills/piv-validate/SKILL.md` is gitignored (`.gitignore` lines 22-24) and contains `# REPLACE:` template placeholders on disk.
4. **Roadmap Status Lag**: `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` Phase 1 Tasks `1.1`–`1.4` (lines 34-64) remain unchecked even though Task `1.3` offline mocks were landed in PR `#11` and expanded in PR `#12`.

## Solution Statement

1. **Runtime Alignment**: Add `"engines": { "node": ">=22.18.0" }` to `package.json` (without modifying `dependencies`, `devDependencies`, or `package-lock.json`). Update Node version documentation in `README.md` and `docs/agents/stack.md` to `22.18+` / `24 LTS`, noting `@types/node` (`^20.17.0`) alignment guidance if upgraded later.
2. **Cross-Platform Multi-File Discovery**: Set `package.json` `"scripts.test"` to `"node --test \"src/**/*.test.ts\" \"src/**/*.spec.ts\""`. Double-quoted globs prevent POSIX `/bin/sh` expansion quirks (`**` failure in `dash`) on Linux while Windows `cmd.exe` / CRT strips double quotes and passes both globs directly to Node's built-in `glob(7)` test runner. Scoping under `src/` also prevents traversing gitignored `worktrees/`, `.next/`, or `node_modules/`.
3. **Committed Source-of-Truth Docs**: Document `npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, and `npm run build` in `docs/agents/testing.md` and `docs/agents/stack.md` (plus `npm test` in `README.md` `### Komandos`), explicitly noting `.agents/skills/piv-validate/SKILL.md` is gitignored and restored via `npx skills experimental_install --yes`.
4. **Offline Determinism Verification**: Verify `src/lib/__tests__/checkers.test.ts` makes zero live network, DNS, TLS, or HTTP calls and document the offline mocking requirement (`WhoisChecker`, `SslChecker`, `WebScraper`, `fetch`) in `docs/agents/testing.md`.
5. **Roadmap Update**: Mark Tasks `1.1`–`1.4` as `[x]` in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` and append a summary row in `## Iteration Log`.

## Out of Scope / Non-Goals

- Not included: Creating `.github/workflows/ci.yml` (deferred to Issue `#14`).
- Not included: Adding new feature/regression unit tests to `src/lib/__tests__/checkers.test.ts` or new test suites (deferred to Issue `#9` and `#15`).
- Not included: Upgrading `@types/node`, `next`, or any npm dependencies, or modifying `package-lock.json` (`AGENTS.md` requires asking first before dependency upgrades/additions).
- Not included: Adding `"type": "module"` to `package.json` (Next.js 14 / ESLint / PostCSS config compatibility should not be altered outside scope).
- Not included: Committing `.agents/skills/` files (explicitly gitignored in `.gitignore` lines 22-24).
- Not changing: Production application code in `src/` (`src/lib/*`, `src/app/*`, `src/components/*`, `src/types/*`) or `tsconfig.json`.

## Feature Metadata

**Feature Type**: Documentation / Chore / CI Prep  
**Estimated Complexity**: Low  
**Primary Systems Affected**: `package.json`, `README.md`, `docs/agents/stack.md`, `docs/agents/testing.md`, `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`  
**Dependencies**: Node.js `>=22.18.0` built-in `node:test` glob runner (zero new external npm packages)

## Related Work

**Implements**: [Issue #13](https://github.com/tommardev/eshop-trust-checker/issues/13)  
**Epic**: `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (Phase 1: Repo Gaps to Fix Before Enabling CI, Tasks `1.1`–`1.4`)

**Back-references**:
- `docs/AUTOMATION_WORKFLOW.md` (line 92) - Why: Defines standard validation command set (`npx tsc --noEmit --incremental false`, `npm test`, `npm run lint`, `npm run build`).
- `.agents/plans/issue-2-jar-modulo-11-and-registry-lookup.md` & PR `#11` - Why: Introduced offline test mocks in `src/lib/__tests__/checkers.test.ts`.
- `.agents/plans/issue-3-tls-ssl-analyzer-and-whois-rdap-domain-age.md` & PR `#12` - Why: Completed offline mocking of `SslChecker` and `WhoisChecker` tests (`100` passing tests).

**Forward-references**:
- Issue `#14` (`.github/workflows/ci.yml` PR workflow for lint, typecheck, test, and build)
- Issue `#9` (Comprehensive unit test suite and security regression tests discovered via updated `npm test`)
- Issue `#15` (Preview verification and `/api/sync-blacklist` auth guard unit tests)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `package.json` (lines 1-33) - Why: Add `"engines"` and update `"scripts.test"` (line 11).
- `README.md` (lines 49-89) - Why: Update Node.js requirement (`line 52`) in Lithuanian and add `npm test` to `### Komandos`.
- `docs/agents/stack.md` (lines 1-36) - Why: Update Node.js runtime (`line 12`), `@types/node` alignment note, and `## Commands` (`lines 28-36`).
- `docs/agents/testing.md` (lines 1-39) - Why: Update `## Commands` (`lines 30-33`) with all 4 validation commands, note gitignored `piv-validate` skill, and record offline mocking rule.
- `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (lines 30-65, 250-254) - Why: Check off Phase 1 Tasks `1.1`–`1.4` and append row to `## Iteration Log`.
- `.gitignore` (lines 22-24) - Why: Confirms `.agents/skills/` is gitignored and must never be force-added.
- `src/lib/__tests__/checkers.test.ts` (lines 541-1363) - Why: Confirm offline mock architecture (`Security.validateHostname`, `tls.connect`, `globalThis.fetch`, `WhoisChecker.checkDomain`, `SslChecker.checkCertificate`, `WebScraper.analyzeWebsite`).
- `tsconfig.json` (lines 1-29) - Why: Confirms `"allowImportingTsExtensions": true` (line 17) and `"incremental": true` (line 15), explaining why Node `>=22.18.0` and `npx tsc --noEmit --incremental false` are required.
- `.agents/skills/piv-validate/SKILL.md` (lines 29-75, only if present in main workspace outside git) - Why: Local gitignored template placeholders referenced by Task `1.4`.

### New Files to Create

- (None; all changes update existing configuration and documentation files.)

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [Node.js Test Runner CLI Docs](https://nodejs.org/api/test.html)
  - Specific section: Running tests from the command line
  - Why: Specifies double-quoted glob arguments (`node --test "**/*.test.js" "**/*.spec.js"`) to avoid cross-platform shell expansion issues on Linux vs Windows.
- [Node.js TypeScript Modules Docs](https://nodejs.org/api/typescript.html)
  - Specific section: Modules: TypeScript (History table)
  - Why: Confirms type stripping became unflagged and warning-free in Node `v22.18.0` (and active in `24 LTS`).
- `AGENTS.md` (lines 20-28, 73-84) - Why: Project command conventions, boundaries, and testing rules.

### Patterns to Follow

**Cross-Platform `node --test` Glob Pattern in `package.json`:**
```json
  "engines": {
    "node": ">=22.18.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint --ext .ts,.tsx src",
    "test": "node --test \"src/**/*.test.ts\" \"src/**/*.spec.ts\""
  },
```
Why double quotes (`\"...\"`) instead of unquoted or single-quoted globs:
- On Windows, `npm` executes scripts through `cmd.exe`, which does **not** strip single quotes `'...'` (passing literal quotes to `node.exe` and matching 0 files), whereas `cmd.exe` / Windows CRT strips double quotes `"..."` and forwards `src/**/*.test.ts` to Node's built-in `glob(7)` matcher.
- On Linux (`ubuntu-latest`), `/bin/sh` (`dash`) does not support recursive `**` globbing if unquoted; double quotes prevent `/bin/sh` expansion so `node` expands `**` recursively across all depths under `src/`.
- Scoping to `src/` avoids matching files inside gitignored `worktrees/`, `.next/`, or `node_modules/`.

**Offline Mocking Pattern (`src/lib/__tests__/checkers.test.ts` lines 583-589, 899-905, 1097-1155):**
All unit tests must mock external network/DNS/TLS/HTTP calls (`WhoisChecker.checkDomain`, `SslChecker.checkCertificate`, `WebScraper.analyzeWebsite`, `Security.validateHostname`, `tls.connect`, `globalThis.fetch`) using `node:test`'s `t.mock.method(...)` so `npm test` executes deterministically offline in sandbox and CI.

---

## IMPLEMENTATION PLAN

### Phase 1: Runtime & Test Discovery Configuration (`package.json`)

Update `package.json` to enforce the Node.js `>=22.18.0` engine floor and replace the single-file test script with cross-platform multi-file glob discovery under `src/`.

**Tasks:**
- Add `"engines": { "node": ">=22.18.0" }` to `package.json`.
- Update `"scripts.test"` to `"node --test \"src/**/*.test.ts\" \"src/**/*.spec.ts\""`.
- Verify multi-file discovery and offline test execution via `npm test` and Windows `cmd /c` invocation.

### Phase 2: Documentation Alignment & Roadmap Completion

**Depends on:** Phase 1 (ensures documented commands and Node version match `package.json` exactly).

Synchronize Node.js version requirements, canonical validation commands, and offline test guarantees across `README.md`, `docs/agents/stack.md`, `docs/agents/testing.md`, and `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (plus optional local-only update to gitignored `.agents/skills/piv-validate/SKILL.md` when working in the main workspace).

**Tasks:**
- Update `README.md` (`### Reikalavimai` and `### Komandos`) to specify Node.js `22.18+` / `24 LTS` and `npm test`.
- Update `docs/agents/stack.md` (`Node.js` runtime line + `@types/node` alignment note + `## Commands` with all 4 validation commands and gitignored skill note).
- Update `docs/agents/testing.md` (`## Commands` with exact 4 validation commands, gitignored `.agents/skills/piv-validate/SKILL.md` note, and explicit offline mock requirement).
- Verify `src/lib/__tests__/checkers.test.ts` remains 100% offline with zero live network/DNS/TLS/HTTP calls.
- Check off Tasks `1.1`–`1.4` and append an entry to `## Iteration Log` in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently verifiable.

### 1. UPDATE `package.json`

- **IMPLEMENT**:
  - Add `"engines": { "node": ">=22.18.0" }` immediately after `"description"` (or `"private": true`).
  - Update `"scripts.test"` at line 11 from `"node --test src/lib/__tests__/checkers.test.ts"` to `"node --test \"src/**/*.test.ts\" \"src/**/*.spec.ts\""`.
- **PATTERN**: Existing JSON 2-space indentation in `package.json` (lines 1-33) and Node.js CLI glob quoting convention (`https://nodejs.org/api/test.html`).
- **IMPORTS**: None.
- **GOTCHA**:
  - Do NOT use single quotes (`'src/**/*.test.ts'`) — Windows `cmd.exe` does not strip single quotes.
  - Do NOT leave globs unquoted (`src/**/*.test.ts`) — Linux `/bin/sh` (`dash`) does not expand `**` recursively.
  - Do NOT add `"type": "module"`, modify `dependencies`/`devDependencies` (`@types/node`), or run `npm install` (keep `package-lock.json` untouched).
- **VALIDATE**: `npm test` (and verify `node -e "const fs=require('node:fs'); console.log(fs.globSync(['src/**/*.test.ts','src/**/*.spec.ts']))"` resolves `src/lib/__tests__/checkers.test.ts`).
- **SATISFIES**: AC #1 (partial), AC #2

### 2. UPDATE `README.md`

- **IMPLEMENT**:
  - Update line 52 under `### Reikalavimai` from `- Node.js 18+ arba 20+` to `- Node.js 22.18+ arba 24 LTS`.
  - Under `### Komandos` (lines 55-75), add a Lithuanian entry for running unit tests:
    ```bash
    # Paleisti vienetinius testus
    npm test
    ```
    and optionally keep `npx tsc --noEmit` (or note `--incremental false` for clean checks).
- **PATTERN**: Preserve existing Lithuanian headings, markdown formatting, and bash block comments in `README.md` (lines 49-75).
- **IMPORTS**: None.
- **GOTCHA**: Do not modify unrelated README sections or alter the `AGENTS.md` warning at line 89.
- **VALIDATE**: `npm run lint` (confirms no syntax/build issues; visually verify `README.md` diff).
- **SATISFIES**: AC #1

### 3. UPDATE `docs/agents/stack.md`

- **IMPLEMENT**:
  - Update line 12 from:
    `- **Node.js:** Node.js 18+ / 20+ runtime (\`@types/node\`: ^20.17.0)`
    to:
    `- **Node.js:** Node.js 22.18+ / 24 LTS runtime (unflagged native TypeScript execution for \`node --test\`; \`@types/node\`: ^20.17.0 — keep aligned if \`@types/node\` is upgraded later)`
  - Update `## Commands` (lines 28-36) to document all 4 canonical validation commands explicitly:
    - `- Run unit tests: \`npm test\``
    - `- Typecheck: \`npx tsc --noEmit --incremental false\` (clean non-incremental check for CI/validation; \`npx tsc --noEmit\` also works locally)`
    - `- Lint code: \`npm run lint\``
    - `- Build application: \`npm run build\``
  - Add a concise note under `## Commands` explaining that `.agents/skills/piv-validate/SKILL.md` is gitignored (`.gitignore`), so `docs/agents/stack.md` and `docs/agents/testing.md` remain the committed source of truth.
- **PATTERN**: Bullet format and inline code style in `docs/agents/stack.md` (lines 5-36).
- **IMPORTS**: None.
- **GOTCHA**: Do not alter package version listings in `## Framework & UI` or `## Domain & Analysis Engines` unless directly verified in `package.json`.
- **VALIDATE**: Inspect updated `docs/agents/stack.md` and verify exact commands (`npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`).
- **SATISFIES**: AC #1, AC #3

### 4. UPDATE `docs/agents/testing.md`

- **IMPLEMENT**:
  - Update `## Commands` (lines 30-33) to list all 4 exact validation commands:
    - `- Run unit tests: \`npm test\` (runs \`node --test\` offline across \`src/**/*.test.ts\` and \`src/**/*.spec.ts\` on Node.js >=22.18.0)`
    - `- Run type checking: \`npx tsc --noEmit --incremental false\``
    - `- Run linting: \`npm run lint\``
    - `- Run production build: \`npm run build\``
  - Add a short note in `## Commands` that `.agents/skills/piv-validate/SKILL.md` is gitignored via `.gitignore` (restored via `npx skills experimental_install --yes`), making `docs/agents/testing.md` and `docs/agents/stack.md` the committed canonical validation reference.
  - Add a bullet under `## Golden Rules` (lines 35-39) explicitly codifying offline determinism:
    - ``- `repo:` All unit tests must mock external network, DNS, TLS, and HTTP calls (`WhoisChecker`, `SslChecker`, `WebScraper`, `Security.validateHostname`, `tls.connect`, `fetch`) so `npm test` runs deterministically offline in sandbox and CI.``
- **PATTERN**: Existing `repo:` / `golden:` prefix style in `docs/agents/testing.md` (lines 5-39).
- **IMPORTS**: None.
- **GOTCHA**: Ensure all 4 command strings match `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` (Task `1.4`) and `docs/AUTOMATION_WORKFLOW.md` (line 92) verbatim.
- **VALIDATE**: Inspect updated `docs/agents/testing.md` and run all 4 commands (`npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`).
- **SATISFIES**: AC #3, AC #4

### 5. VERIFY Offline Unit Tests (`src/lib/__tests__/checkers.test.ts`) & Local `piv-validate` Skill Note

- **IMPLEMENT**:
  - Inspect `src/lib/__tests__/checkers.test.ts` and run `npm test` inside the offline sandbox (`BypassSandbox: false`) to confirm all 100 tests pass with zero live network/DNS/TLS/HTTP calls (`WhoisChecker`, `SslChecker`, `WebScraper`, `Security.validateHostname`, `tls.connect`, and `globalThis.fetch` are mocked).
  - Do NOT edit `src/lib/__tests__/checkers.test.ts` unless a live network call is discovered.
  - **Local skill note (Task 1.4)**:
    - Assumed / Gotcha: In worktree-isolated automation (`worktrees/issue-13-*`), `.agents/skills/` is gitignored and absent from the worktree. Do **not** create or commit `.agents/skills/piv-validate/SKILL.md` inside the PR branch or git commit.
    - If executing interactively in the main workspace where `.agents/skills/piv-validate/SKILL.md` exists on disk, replace its `# REPLACE:` placeholders (`lines 32-33, 41-42, 50-51, 68-69`) with `npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, and `npm run build` locally (leaving it untracked/gitignored). In automated worktree execution, skip editing gitignored `.agents/skills/` outside the worktree and rely on `docs/agents/testing.md` + `docs/agents/stack.md` as documented in AC #3.
- **PATTERN**: `src/lib/__tests__/checkers.test.ts` lines 583-589, 899-905, 1097-1155.
- **IMPORTS**: None.
- **GOTCHA**: Never run `git add -f .agents/skills/...`; keep `.agents/skills/` strictly gitignored.
- **VALIDATE**: `npm test` (inside `BypassSandbox: false` confirming 100/100 offline pass).
- **SATISFIES**: AC #3, AC #4

### 6. UPDATE `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`

- **IMPLEMENT**:
  - Change `- [ ]` to `- [x]` for Tasks `1.1` (line 34), `1.2` (line 42), `1.3` (line 50), and `1.4` (line 58).
  - Append a new entry at the bottom of `## Iteration Log` (after line 254) summarizing the completed Phase 1 tasks (`1.1–1.4`), branch/issue (`#13`), and verification results (`node -v`, `npm test`, `tsc`, `lint`, `build`).
- **PATTERN**: Existing Markdown table format at lines 250-254 of `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`.
- **IMPORTS**: None.
- **GOTCHA**: Keep Phase 2–6 checkboxes (`[ ]`) untouched.
- **VALIDATE**: Inspect `git diff docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md` and confirm Tasks `1.1`–`1.4` are checked and Phase 2+ remain unchecked.
- **SATISFIES**: AC #5

---

## TESTING STRATEGY

### Unit Tests

- This ticket does not add production source code or duplicate Issue `#9`'s regression test expansion.
- Confirm all unit tests in `src/lib/__tests__/checkers.test.ts` mock external network/DNS/TLS/HTTP calls (`WhoisChecker`, `SslChecker`, `WebScraper`, `Security.validateHostname`, `tls.connect`, `globalThis.fetch`) so `npm test` runs deterministically offline in sandbox (`BypassSandbox: false`) and CI (`ubuntu-latest`).

### Multi-File Discovery Verification

- Verify `package.json` `"test"` script (`node --test "src/**/*.test.ts" "src/**/*.spec.ts"`) discovers `src/lib/__tests__/checkers.test.ts` via:
  1. Direct `npm test` execution (confirming all 100 tests across 34 suites execute and pass).
  2. Temporary multi-file verification during Phase 1 validation (if desired, create a transient `src/lib/__tests__/discovery-smoke.test.ts` and/or `.spec.ts` file, run `npm test` to confirm >100 tests are discovered and run, then **delete** the transient file and re-run `npm test` so no dummy file is committed).
  3. Cross-platform shell verification: verify `cmd /c node --test "src/**/*.test.ts" "src/**/*.spec.ts"` on Windows and confirm quoted glob syntax matches Node.js POSIX `/bin/sh` (`ubuntu-latest`) rules (`https://nodejs.org/api/test.html`).

### Edge Cases

- `*.spec.ts` currently matches 0 files under `src/`; verify `node --test "src/**/*.test.ts" "src/**/*.spec.ts"` exits `0` without failing on the empty `.spec.ts` glob while still failing if any matched test fails.
- Verify `engines.node` (`>=22.18.0`) matches current runtime (`v24.20.0`) and planned CI Node `24` / `22.18+` without triggering `npm` errors.

---

## VALIDATION COMMANDS

Execute every command after the final edit to ensure zero regressions and full compliance with Issue `#13`.

### Level 1: Typecheck & Lint

```bash
npx tsc --noEmit --incremental false
npm run lint
```

### Level 2: Offline Unit Tests

```bash
npm test
```

*(Must run cleanly inside offline sandbox with all network/DNS/TLS/HTTP calls mocked; 100 tests pass, 0 fail.)*

### Level 3: Production Build

```bash
npm run build
```

*(Note on Windows sandbox: run in sandbox first; if Next.js `.next` encounters Windows sandbox `EPERM`/hang, retry `npm run build` with `BypassSandbox: true`.)*

### Level 4: Runtime & Diff Sanity Check

```bash
node -v
git status -s
git diff
```

*(Confirm `node -v` satisfies `>=22.18.0`, no untracked temporary test files remain, and `.agents/skills/` is not staged.)*

---

## ACCEPTANCE CRITERIA

- [ ] `"engines": { "node": ">=22.18.0" }` added to `package.json`, and Node version docs in `README.md` and `docs/agents/stack.md` updated to `22.18+` / `24 LTS` (with `@types/node` alignment note).
- [ ] `package.json` `"test"` script updated for cross-platform multi-file discovery (`"node --test \"src/**/*.test.ts\" \"src/**/*.spec.ts\""`) verified on Windows and aligned for Linux CI.
- [ ] `npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, and `npm run build` documented in `docs/agents/testing.md` and `docs/agents/stack.md` (with explicit note that `.agents/skills/piv-validate/SKILL.md` is gitignored).
- [ ] Unit tests in `src/lib/__tests__/checkers.test.ts` confirmed deterministically offline (all external `WhoisChecker`, `SslChecker`, `WebScraper`, `Security.validateHostname`, `tls.connect`, and `fetch` calls mocked).
- [ ] Tasks `1.1`–`1.4` checked off and an entry appended to `## Iteration Log` in `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`.
- [ ] All validation commands (`npx tsc --noEmit --incremental false`, `npm run lint`, `npm test`, `npm run build`) pass after the final edit.

---

## COMPLETION CHECKLIST

- [ ] All tasks 1–6 executed in order
- [ ] Zero temporary smoke test files left in `src/`
- [ ] `package-lock.json` and `src/` production code untouched
- [ ] `.agents/skills/` not committed or tracked in git
- [ ] All 4 required validation commands pass cleanly after final edit
- [ ] Roadmap Tasks `1.1`–`1.4` marked `[x]` with Iteration Log entry

---

## OPEN QUESTIONS / ASSUMPTIONS

- **Assumed — Inclusion of `*.spec.ts` alongside `*.test.ts` in `package.json` `"scripts.test"`**: Issue `#13` AC #2 specifies `*.test.ts under src/`, while `AGENTS.md` (line 81) and `docs/agents/testing.md` (line 11) specify `*.test.ts or *.spec.ts`. This plan uses `"node --test \"src/**/*.test.ts\" \"src/**/*.spec.ts\""` so both conventions are discovered on Windows and Linux without error when `*.spec.ts` has 0 files. Confirm if only `*.test.ts` is preferred.
- **Assumed — Handling gitignored `.agents/skills/piv-validate/SKILL.md` during worktree automation**: Because `.agents/skills/` is gitignored (`.gitignore` lines 22-24), isolated git worktrees (`worktrees/issue-13-*`) will not contain `.agents/skills/piv-validate/SKILL.md` and PR diffs cannot commit updates to it. Execution should prioritize updating the committed references (`docs/agents/testing.md` and `docs/agents/stack.md`) and only update `.agents/skills/piv-validate/SKILL.md` locally if executed in a workspace where that gitignored file exists (never committing it).
- **Assumed — Leaving `AGENTS.md` and `package-lock.json` unmodified**: `Issue #13` ACs name `package.json`, `README.md`, `docs/agents/stack.md`, `docs/agents/testing.md`, and `docs/PR_CHECKS_AND_PREVIEW_ROADMAP.md`. Although Roadmap Task `1.4` mentions `AGENTS.md / docs/agents/testing.md` and `README.md` warns against regenerating `AGENTS.md`, `AGENTS.md` is left untouched (or optionally can have `- Test: npm test` added in a follow-up if desired) and `package-lock.json` is left untouched since no dependencies change.

---

## NOTES (open canvas)

### Alternative `npm test` Multi-File Discovery Options Considered

| Option | Windows (`cmd.exe`/`pwsh`) | Linux (`/bin/sh` CI) | Pros / Cons |
| :--- | :--- | :--- | :--- |
| `node --test "src/**/*.test.ts" "src/**/*.spec.ts"` *(Chosen)* | Passes quoted globs to Node `glob(7)` cleanly | `/bin/sh` strips quotes, passes globs to Node `glob(7)` cleanly | Zero helper scripts, zero deps, matches official Node.js docs, handles `worktrees/` exclusion by scoping to `src/`. |
| `node --test src/**/*.test.ts` *(Unquoted)* | `cmd.exe` passes raw string to Node | `/bin/sh` (`dash`) expands `**` as `*` and misses nested `__tests__` directories | **Rejected**: silently skips `src/lib/__tests__/checkers.test.ts` on Linux. |
| `node --test 'src/**/*.test.ts'` *(Single quotes)* | `cmd.exe` passes literal `'...'` quotes and matches 0 files | Works on `/bin/sh` | **Rejected**: breaks on Windows `cmd.exe` (default `npm` shell on Windows). |
| Custom `scripts/run-tests.mjs` | Works everywhere | Works everywhere | **Rejected**: unnecessary boilerplate when Node `>=22.18.0` natively handles double-quoted globs. |

---

## AMENDMENTS

- *(None at creation.)*

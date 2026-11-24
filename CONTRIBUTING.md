# Contributing to eshop-trust-checker

Thank you for your interest in contributing to `eshop-trust-checker`! Please follow these guidelines to keep changes focused, verifiable, and aligned with the project's architecture and governance rules.

## Prerequisites & Local Setup

- **Node.js:** `>=22.18.0` (Node `22.18+` or `24 LTS` recommended for unflagged native TypeScript test execution via `node --test`)
- **Package Manager:** `npm` (included with Node.js)

Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

The app will be available locally at `http://localhost:3000`.

## Issue-First Workflow

Non-trivial changes follow an issue-first workflow (see [docs/agents/planning.md](docs/agents/planning.md)):

1. **Open or pick a GitHub Issue first:** For new features, bug investigations, multi-file refactors, API/schema changes, or audit engine additions, start with an existing issue or open a new one using the templates in [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/). *(Tiny mechanical fixes such as obvious typos or single-line cleanups may skip creating an issue.)*
2. **Create a clean branch:** Name your branch after the issue using `feat/issue-<N>-<slug>` or `fix/issue-<N>-<slug>`.
3. **Keep Pull Requests atomic:** Keep each PR scoped to one issue (`1 issue = 1 PR`). Never bundle unrelated changes or silent `TODO`s; open a linked follow-up issue instead.
4. **Link the issue in your PR:** Fill out [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) and include `Closes #<N>` (or `Fixes #<N>`) in the PR description so merging automatically closes the issue.

## Validation Commands (Required Before Opening a PR)

All four checks below must pass before opening or updating a Pull Request:

1. **Deterministic offline unit tests:**
   ```bash
   npm test
   ```
   `npm test` runs `node --test "src/**/*.test.ts" "src/**/*.spec.ts"` offline. Any tests touching network-bound modules **must mock** external network, DNS, TLS, and HTTP calls (such as `WhoisChecker`, `SslChecker`, `WebScraper`, `Security.validateHostname`, `tls.connect`, and `fetch`) so the suite runs deterministically without internet access. See [docs/agents/testing.md](docs/agents/testing.md).

2. **Strict TypeScript typecheck:**
   ```bash
   npx tsc --noEmit --incremental false
   ```

3. **ESLint check:**
   ```bash
   npm run lint
   ```

4. **Production Next.js build:**
   ```bash
   npm run build
   ```

## Commit Conventions & Versioning

This repository uses **Conventional Commits** and automated Pre-1.0 (`0.MINOR.PATCH`) versioning managed by `release-please` (`release-please-config.json` and `.release-please-manifest.json`):

- **Commit prefixes:** Use standard Conventional Commits prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`, `style:`).
- **Pre-1.0 version bumps:** `feat:` and `fix:` trigger a patch bump via `release-please`; `chore:`, `docs:`, `ci:`, `test:`, `refactor:`, `perf:`, and `style:` do not bump the version.
- **Do NOT bump versions manually:** Never manually edit `"version"` in `package.json`, `package-lock.json`, or `.release-please-manifest.json`, and never hand-edit `CHANGELOG.md` in feature or fix PRs.
- **Breaking changes:** Do not use `!` in commit headers or `BREAKING CHANGE:` footers without explicit maintainer approval.

## Security & Code Quality Expectations

- **No secrets:** Never commit API keys, credentials, tokens, or `.env.local` files.
- **Respect SSRF & scraping guardrails:** Keep outgoing HTTP requests within the boundaries of [`src/lib/security.ts`](src/lib/security.ts) (private/loopback/metadata IP blocking, `AbortController` timeouts `<= 4000ms`, and `2MB` max payload size) and never use `dangerouslySetInnerHTML` with scraped web content. See [docs/agents/security.md](docs/agents/security.md).
- **Ask before structural changes:** Discuss in an issue with the maintainer before adding new npm dependencies, changing `AuditEngine` scoring thresholds, or modifying public API schemas.
- **Community & security policies:** All contributors are expected to follow [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) and report security vulnerabilities privately in accordance with [`SECURITY.md`](SECURITY.md).

## Licensing Note

By submitting a contribution (including pull requests, code, or documentation) to this repository, you certify that you have the right to submit it and you grant the copyright holder (`tommardev`) a perpetual, worldwide, non-exclusive, royalty-free, irrevocable license to use, modify, redistribute, and sublicense your contribution under both:

1. The GNU Affero General Public License v3.0 only (`AGPL-3.0-only`, see [`LICENSE`](LICENSE)), and
2. Any separate commercial or proprietary license offered by the copyright holder (see [`COMMERCIAL_LICENSE.md`](COMMERCIAL_LICENSE.md)).

# Security & Safety

Security requirements and boundary constraints for `eshop-trust-checker`.

## Precedence

OWASP Top 10 standards (`golden:`) and strict input validation rules are non-negotiable safety floors. They are never overridden by habits or shortcuts.

## SSRF & Network Boundary Protection

Because this application fetches external web pages submitted by untrusted users:

- `golden:` **Never fetch private or loopback IP addresses (SSRF prevention).** Before issuing HTTP requests in scrapers or RDAP clients, ensure the target hostname does not resolve to:
  - Loopback (`127.0.0.0/8`, `::1`, `localhost`)
  - Private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  - Cloud metadata endpoints (`169.254.169.254`)
  - Link-local and non-routable addresses
- `repo:` **Strict Timeout Enforcement:** All outgoing HTTP requests MUST use `AbortController` with timeouts <= 4000ms (`src/lib/scraper.ts#L30-L31`, `src/lib/whois-checker.ts#L23-L24`) to prevent denial-of-service via slow HTTP responses.
- `golden:` **Payload Size Limits:** Limit incoming response body size (max 2MB) when scraping to avoid memory exhaustion from hostile target servers.

## Input Sanitization & URL Normalization

- `repo:` `VvtatChecker.normalizeDomain(input)` strips protocol, credentials, path, and port before querying domain registries.
- `golden:` Never pass user-supplied URL strings directly into shell commands or unsafe execution contexts.

## XSS & Output Encoding

- `golden:` Scraped web content (titles, snippets, company details) is untrusted data. When rendering in React, rely on standard JSX escaping. Never use `dangerouslySetInnerHTML` with scraped strings.

## Secrets & API Credentials

- `golden:` Never commit secrets, API keys, or private tokens to the git repository.
- `repo:` Environment variables belong in `.env.local` (ignored by `.gitignore`).
- `golden:` Never log credentials, API tokens, or personal data.

## CI/CD Workflow Hardening (GitHub Actions)

- `golden:` **Pin all GitHub Actions to full 40-char commit SHAs** (with `# vX.Y.Z` version comments) across every workflow — never rely on mutable tags (`@v4`, `@main`).
- `golden:` **Least-privilege `permissions:`** at the workflow or job level (e.g. `contents: read`; grant `statuses: write` or `security-events: write` only where required).
- `golden:` **Checkout safety:** Set `persist-credentials: false` on `actions/checkout` and never run `pull_request_target` on untrusted PR code.
- `golden:` **Job timeouts:** Set explicit `timeout-minutes` on every job (e.g. `5`–`15` min) to prevent hung builds or probes.
- `repo:` **Preview bypass secret safety:** Validate `deployment_status.target_url` (`https://` + expected preview host allowlist) before sending `x-vercel-protection-bypass` (`VERCEL_AUTOMATION_BYPASS_SECRET`).

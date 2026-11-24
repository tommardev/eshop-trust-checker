# Security Policy

## Supported Versions

`eshop-trust-checker` is currently in pre-1.0 (`0.x`) development. Security fixes are applied to the latest `main` branch and the most recent `0.x.y` release.

| Version | Supported |
| :--- | :--- |
| `0.x` (latest `main` / latest `0.x.y` release) | :white_check_mark: |
| Older pre-release commits | :x: |

## Reporting a Vulnerability (Private Disclosure)

**Please do NOT open a public GitHub Issue for security vulnerabilities.**

To protect users and deployed instances while a fix is prepared, report suspected vulnerabilities privately through:

- **Primary channel:** [GitHub Private Vulnerability Reporting](https://github.com/tommardev/eshop-trust-checker/security/advisories/new)
- **Fallback contact:** If the private advisory form is unavailable, reach out to the maintainer (`@tommardev`) via GitHub at [https://github.com/tommardev](https://github.com/tommardev) to arrange a private disclosure channel.

Please include the following details in your report:

- **Affected target:** Endpoint, file path, or component (for example, `src/lib/security.ts` or `/api/check`).
- **Reproduction steps:** Minimal steps or proof of concept needed to trigger the issue.
- **Expected vs. actual behavior:** What the security guardrail should enforce versus what actually happens.
- **Impact assessment:** Potential security impact and suggested severity.

## Response Expectations

- **Initial acknowledgment:** Within **72 hours** (3 business days) of receiving your report.
- **Triage and severity assessment:** Within **7 days**, including confirmation of reproducibility and scope.
- **Coordinated disclosure:** We will work with you to agree on a remediation and patch timeline before publishing any public security advisory.

## Security Scope & Architecture Guardrails

Because `eshop-trust-checker` accepts user-supplied domains/URLs and fetches external HTML and registry metadata, security boundaries are centered on the guardrails documented in [docs/agents/security.md](docs/agents/security.md).

### In Scope

- **SSRF bypasses in [`src/lib/security.ts`](src/lib/security.ts):** Bypasses targeting loopback (`127.0.0.0/8`, `::1`, `localhost`), RFC 1918 private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), cloud metadata endpoints (`169.254.169.254`), link-local/non-routable addresses, DNS rebinding, or HTTP redirect chains.
- **HTML scraping & XSS injection:** Unsafe rendering of untrusted scraped content (such as `dangerouslySetInnerHTML` usage or unsanitized scraped strings reaching the UI).
- **Denial of Service (DoS):** Missing or bypassable outgoing HTTP timeouts (`> 4000ms`) or response payload size limits (`> 2MB`).
- **API route validation or authorization bypasses:** Security flaws in API endpoints including `POST /api/check` (as well as `GET /api/check`) and `POST /api/sync-blacklist`.
- **Dependency vulnerabilities:** High or critical severity vulnerabilities in direct or transitive packages.

### Out of Scope

- Rate limits, throttling, or temporary downtime of third-party external registries and data sources (such as VVTAT, DOMREG/RDAP, Lietuvos Bankas, or Registrų Centras).
- Social engineering, phishing, or physical attacks against maintainers or contributors.
- Security issues or misconfigurations on third-party e-shops being audited by this application.

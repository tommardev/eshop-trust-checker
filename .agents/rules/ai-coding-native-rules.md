# Reuse existing approaches, code parts, patterns to avoid reinventing

For unfamiliar features don't write from scratch first search GitHub for existing top rated, top starred at least 10000 or more stars and secure projects and code parts, compare their approaches, and implement a suitable solution, code parts, patterns that work's so to not "reinvent the wheel".

# Prefered workflow owner

Prefered but not strictly limited: Coding work follows coleam00 skills. Avoid inventing a parallel process. Cole decides when and in what order. Selected Addy Osmani skills decide how well (UI / API / security / perf / ship). They sit side by side. ui-ux-pro-max skills and existing specific skills for new marketing, landing, and portfolio UI. Emil skills for product surfaces, motion, and reviews. Avoid style variants together.

- Feature / ticket: prime-codebase (or prime-frontend / prime-backend) → piv-plan-implementation → piv-implement → piv-validate → piv-review-changes. Commit/PR only via piv-commit / piv-create-pr when that loop is running, or when I ask.
- Product intent: plan-create-prd. Approach/stack: plan-architecture. Tickets: plan-create-stories.
- Bug with an issue: piv-investigate-issue then piv-implement-issue.
- Tiny/mechanical (typo, rename, obvious one-file fix): skip the PIV loop.
- During implement: do the asked work with surgical diffs (karpathy-guidelines). Load the matching Addy skill when the slice is UI, API, security, performance, or ship. Don't shrink or refuse the request.

# Tools (always)

- Read and edit files with Read, Grep, and StrReplace. Use the shell for commands that have to run, such as dotnet test, git, and builds. Do not use the shell to print, search, or rewrite file contents.

- Docs/APIs: Context7 MCP for library/API docs, setup, migrations, and to confirm current usage patterns - prefer it over training memory and client web search.
- Web Search & Research: Exa MCP (`https://mcp.exa.ai`) using `web_search_exa`, `web_search_advanced_exa`, `web_fetch_exa`, and `agent_run` for live web lookups and page fetching.
- Browser debug and verification: Chrome Devtools for Agents. Use it to test pages, emulate users, and inspect Chrome when the work is user-visible.
- GitHub: `gh` CLI only (no GitHub MCP).
- Deps: Sonatype MCP before adding or upgrading packages.
- UI from Figma: FigmaLocal MCP + the Figma MCP flow, token-driven layout. Only when I gave a Figma URL/node or asked to implement a design.

# Stance

- If the request is ambiguous or has real tradeoffs: list 2+ options with brief pros/cons, pick one, then act. Skip this on mechanical work.
- If unsure, state assumptions instead of guessing. Ask when structure, API, or scope is unclear. Don't guess irreversible calls.
- Don't rewrite spec/source docs; update plan files if direction changes.
- Prefer Subagents (background Agents) use when work would dump a lot of noise into this session - broad explore, independent parallel research, large refactors, PIV fan-out. Not every medium coding task. Pick a model that fits the part.
- Use subagents (background Agents) to not bloat context too much, or when complexity requires more processing, or to cordinate agent tasks.
- Use concision and clarity and clear understandable sentences instead of too complex, or too many grammar answers. Add "references", "navigations steps", etc when that helps for clarity and concision.
- Format files you save (project formatter / style), including md/html/text when a formatter applies.
- Tests: follow the plan. If the plan is silent, unit tests only (fixtures `*.data.ts` / `*.spec.data.ts`, mocks `*.mock.ts`). No e2e unless the plan or I ask. User-visible UI: also verify in the browser.
- After changes: lint/typecheck/build the touched surface (skip tasks/, docs/, .md).
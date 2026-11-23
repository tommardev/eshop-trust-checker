# Planning & Issue Backlog

How work enters the repo as GitHub Issues, gets planned, and moves to PRs. Read this before creating issues, slicing epics, writing plans, or opening PRs.

## Precedence

`repo:` rules below override generic skill defaults (such as `.claude/plans/` paths or `gh label create` calls in `.agents/skills/`). `golden:` items apply where the repo is silent.

## Task Triage (Issue First vs. Do Now)

- `repo:` **Do Now (skip issue & PIV loop):** Tiny/mechanical changes — typo, rename, obvious 1-file fix with zero ambiguity.
- `repo:` **Issue First (`gh issue create`):** New features, multi-file refactors, API/schema changes, audit engine additions, or queued/later work.
- `repo:` **Bug with investigation:** Create or reference a GitHub Issue, then run `piv-investigate-issue` → `piv-implement-issue`.
- `repo:` **Large initiative / epic:** Run `plan-create-prd` → `plan-architecture` → slice into small vertical GitHub Issues (1 issue = 1 shippable PR).
- `golden:` **Follow-up work discovered mid-task:** Never leave silent `TODO`s or expand the current PR scope. File a linked follow-up GitHub Issue (`gh issue create`) referencing the current issue/PR.

## AI-Ready Issue Contract

Every planning issue must be self-contained so either a human, interactive agent, or autonomous planner sidecar can plan it without guessing:

1. **Goal** — User or system problem solved (1–3 sentences).
2. **Acceptance Criteria** — Verifiable `- [ ]` checklist of what "done" looks like.
3. **Scope & Seams** — Likely files/modules (`src/lib/...`, `src/types/audit.ts`, etc.) and relevant `docs/agents/*.md` helpers.
4. **Constraints** — Security (SSRF, timeouts), performance, offline test mocking, or compatibility limits.
5. **Dependencies** — `None` or `Depends on #<N>`.
6. **Out of Scope** — What explicitly must not change.

- `golden:` **Issue stays stable; plan evolves.** The Issue defines *what/why*; the Plan file defines *how*.
- `golden:` **One vertical slice per issue.** Split issues that touch unrelated subsystems before queueing.

## Labels & Autonomous Queue Rules

- `repo:` **GitHub CLI only:** Use `gh issue create|view|edit|comment` and `gh pr create` (never GitHub MCP).
- `repo:` **Never create labels:** Do not run `gh label create`. Only use pre-created labels defined in `docs/AUTOMATION_WORKFLOW.md`:
  - **Queueing (human or triaging agent):** `priority`, `ready-for-plan`
  - **Lifecycle (automation-owned — do not set manually unless recovering a failed run):** `planning-in-progress`, `plan-ready`, `in-progress`, `implemented`, `automation-failed`
- `repo:` **Auto-pickup awareness:** The Planner sidecar (`docs/AUTOMATION_WORKFLOW.md`) picks open unplanned issues in priority order (`priority` + `ready-for-plan` → `priority` → `ready-for-plan` → any open unplanned issue, oldest first).
  - Do **not** open vague half-baked draft issues in GitHub if you do not want the Planner sidecar to pick them up.
  - When creating a chain of dependent issues (`Depends on #<N>`), create prerequisite issues first (lower issue numbers) so FIFO ordering respects dependencies.

## Plans, Branches & PRs

- `repo:` **Canonical plan path:** `.agents/plans/issue-<N>-<slug>.md` (overrides generic `.claude/plans/`).
- `repo:` **Branch naming:** `feat/issue-<N>-<slug>` or `fix/issue-<N>-<slug>`.
- `repo:` **PR linking:** Include `Closes #<N>` (or `Fixes #<N>`) in the commit/PR body so merging closes the issue and unblocks the single-PR pipeline.
- `repo:` **Validation before PR:** `npx tsc --noEmit --incremental false`, `npm test`, `npm run lint`, and `npm run build` (see `docs/agents/stack.md`).

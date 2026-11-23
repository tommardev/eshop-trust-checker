# ADR-001: Autonomous Queue Opt-In Gate (`ready-for-plan`)

- **Status:** Deferred (keeping Option A: Auto-drain FIFO for now)
- **Date:** 2026-11-23
- **Related:** `docs/AUTOMATION_WORKFLOW.md`, `docs/agents/planning.md`

---

## Context

Today, the Planner sidecar (`gh-auto-Issue-Plan-Create-For-Implement`) selects open unplanned issues in this priority order:

1. `priority` + `ready-for-plan`
2. `priority`
3. `ready-for-plan`
4. **Any open unplanned issue** (oldest / lowest issue number first)

Because tier 4 picks *any* open unplanned issue, `ready-for-plan` acts only as an optional priority booster. This works well for a hands-off queue (Option A), but creates a risk if rough draft ideas or dependent epic slices (`Depends on #<N>`) are parked in GitHub Issues before they are ready to be planned.

---

## When to Switch to Option B (Triggers)

Implement Option B when any of these become true:
- You want to park rough, half-baked, or future backlog ideas directly in GitHub Issues without triggering auto-planning.
- You regularly slice multi-issue epics into GitHub Issues at once and need strict control over which issue enters planning next.
- Dependent issues (`Depends on #<N>`) are getting picked up out of order.

---

## Option B Design: Mandatory `ready-for-plan` Opt-In Gate

### Who Sets `ready-for-plan`?
- **Human reviewer:** Adds `ready-for-plan` after reviewing and approving a draft backlog issue.
- **Triaging agent:** Passes `--label ready-for-plan` during `gh issue create` **only** when the issue satisfies the 6-part AI-ready contract (`docs/agents/planning.md`) and has no open `Depends on #<N>` blockers.

### Target State Machine
`Backlog (no workflow label)` → `ready-for-plan` → `planning-in-progress` → `plan-ready` → `in-progress` → `implemented` → `Closed` (or `automation-failed`).

### Trade-offs to Keep in Mind
- **Pros:** Safe to store rough ideas, parking-lot items, and future epic slices in GitHub Issues; prevents wasted planning runs.
- **Cons:** Adds an explicit gate — if neither a human nor an agent adds `ready-for-plan`, the autonomous pipeline stays idle.

---

## Implementation Checklist (Ready When Needed)

1. **Planner sidecar config** (`~/.gemini/config/sidecars/github-issue-implementation-plan-generator/sidecar.json` — outside this repo):
   - Restrict Step 2 issue selection strictly to open issues carrying `ready-for-plan`.
   - New priority order: `priority` + `ready-for-plan` → `ready-for-plan` (oldest / lowest issue number wins). If none match, exit cleanly.
   - *(Optional dependency guard)* Parse `Depends on #<N>` in the issue body; if any referenced `#<N>` is still `open`, skip the issue and check the next eligible `ready-for-plan` issue.
2. **Update `docs/AUTOMATION_WORKFLOW.md`**:
   - Update Mermaid state diagram to add `Backlog` → `ReadyForPlan` transition.
   - Change `ready-for-plan` description in Section 3 from *"Optional manual trigger"* to *"Required opt-in trigger for autonomous planning"*.
   - Update Sidecar 1 Step 2 selection tiers to remove the *"any open unplanned issue"* fallback.
3. **Update `docs/agents/planning.md`**:
   - Update `Auto-pickup awareness` so agents know unlabeled issues stay safely in backlog and must be labeled `ready-for-plan` to enter the autonomous queue.
4. **Verify**:
   - Open a test issue *without* `ready-for-plan`; confirm the next 15m planner tick exits cleanly without claiming it.
   - Add `ready-for-plan`; confirm the planner claims it (`planning-in-progress` → `plan-ready`).

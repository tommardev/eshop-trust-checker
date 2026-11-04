---
description: Generate implementation report reflecting on completed work
---

# Execution Report

Review and deeply analyze the implementation you just completed.

## Context

You have just finished implementing a feature or fix. Before moving on, reflect on:

- What you implemented
- How it aligns with the plan or requirements
- What challenges you encountered
- What diverged and why

## Generate Report

Save to: `.agents/execution-reports/[feature-name].md`

### Meta Information

- Plan/Requirement: [path to plan or requirement that guided this implementation]
- Feature: [brief description]
- Files added: [list with full paths]
- Files modified: [list with full paths]
- Lines changed: +X -Y

### Validation Results

```
Type Checking:  ✅/❌ [details if failed / not applicable]
Linting:        ✅/❌ [details if failed / not applicable]
Formatting:     ✅/❌ [details if failed / not applicable]
Tests:          ✅/❌ [X passed, Y failed / not applicable]
```

### What Went Well

List specific things that worked smoothly:
- [concrete examples from this implementation]

### Challenges Encountered

List specific difficulties:
- [what was difficult and why, with file:line references]

### Divergences from Plan

For each divergence, document:

**[Divergence Title]**
- Planned: [what was originally planned]
- Actual: [what was implemented instead]
- Reason: [why this divergence occurred]
- Type: [Better approach found | Plan assumption wrong | Security concern | Performance issue | Architecture constraint | Other]

### Skipped Items

List anything from the plan that was not implemented:
- [what was skipped]
- Reason: [why it was skipped]

### Architecture & Convention Observations

- Architecture boundaries respected: [yes/no — any cross-module concerns?]
- Test isolation & reliability: [any test pollution or mocking concerns?]
- Import patterns: [any circular or problematic imports?]

### Recommendations

Based on this implementation, what should change for next time?
- Workflow/planning improvements: [suggestions]
- Project guidelines / AGENTS.md additions: [suggestions]
- Tooling/command improvements: [suggestions]

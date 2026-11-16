---
description: Analyze implementation against plan for process improvements
argument-hint: "[plan-file] [execution-report-file]"
---

# System Review

Perform a meta-level analysis of how well the implementation followed the plan and identify process improvements.

## Purpose

**System review is NOT code review.** You are not looking for bugs in the code — you are looking for bugs in the engineering process.

**Your job:**

- Analyze plan adherence and divergence patterns
- Identify which divergences were justified vs problematic
- Surface process improvements that prevent future issues
- Suggest updates to project guidelines (AGENTS.md, plan templates, commands)

**Philosophy:**

- Good divergence reveals plan limitations → improve planning
- Bad divergence reveals unclear requirements → improve communication
- Repeated issues reveal missing automation → create reusable commands or scripts

## Context & Inputs

You will analyze four key artifacts:

**Planning Process / Plan Template:**
Read the plan or spec that guided the work:
Plan file: $1

**Execution Report:**
Read what the agent actually did and why:
Execution report: $2

## Analysis Workflow

### Step 1: Understand the Planned Approach

Read the plan ($1) and extract:

- What features were planned?
- What architecture was specified?
- What validation steps were defined?
- What patterns were referenced?

### Step 2: Understand the Actual Implementation

Read the execution report ($2) and extract:

- What was implemented?
- What diverged from the plan?
- What challenges were encountered?
- What was skipped and why?

### Step 3: Classify Each Divergence

For each divergence identified in the execution report, classify as:

**Good Divergence ✅** (Justified):

- Plan assumed something that did not exist in the codebase
- Better pattern discovered during implementation
- Performance optimization needed
- Security issue discovered that required a different approach

**Bad Divergence ❌** (Problematic):

- Ignored explicit constraints in the plan
- Created new architecture instead of following existing patterns
- Took shortcuts that introduce technical debt
- Misunderstood requirements

### Step 4: Trace Root Causes

For each problematic divergence, identify the root cause:

- Was the plan unclear? Where and why?
- Was codebase context missing? Where and why?
- Was validation missing? Where and why?
- Was a manual step repeated? Where and why?

### Step 5: Generate Process Improvements

Based on patterns across divergences, suggest:

- **AGENTS.md / Guidelines updates:** Patterns or anti-patterns to document
- **Planning updates:** Instructions that need clarification or missing steps
- **New commands / scripts:** Manual processes that should be automated
- **Validation additions:** Checks that would catch issues earlier

## Output Format

Save your analysis to: `.agents/system-reviews/[feature-name]-review.md`

### Report Structure:

#### Meta Information

- Plan reviewed: [path to $1]
- Execution report: [path to $2]
- Date: [current date]

#### Overall Alignment Score: __/10

Scoring guide:

- 10: Perfect adherence, all divergences justified
- 7-9: Minor justified divergences
- 4-6: Mix of justified and problematic divergences
- 1-3: Major problematic divergences

#### Divergence Analysis

For each divergence from the execution report:

```yaml
divergence: [what changed]
planned: [what plan specified]
actual: [what was implemented]
reason: [agent's stated reason from report]
classification: good ✅ | bad ❌
justified: yes/no
root_cause: [unclear plan | missing context | etc]
```

#### Pattern Compliance

Assess adherence to documented patterns:

- [ ] Followed project boundaries and architecture conventions
- [ ] Used documented import patterns and module structures
- [ ] Applied testing patterns correctly
- [ ] Met validation requirements (type-check, lint, test)
- [ ] Respected AGENTS.md / repository conventions

#### System Improvement Actions

Based on analysis, recommend specific actions:

**Update AGENTS.md:**

- [ ] Document [pattern X] discovered during implementation
- [ ] Add anti-pattern warning for [Y]
- [ ] Clarify [technology constraint Z]

**Update Planning Conventions:**

- [ ] Add instruction for [missing step]
- [ ] Clarify [ambiguous instruction]
- [ ] Add validation requirement for [X]

**Create New Command or Script:**

- [ ] `/[command-name]` for [manual process repeated 3+ times]

#### Key Learnings

**What worked well:**

- [specific things that went smoothly]

**What needs improvement:**

- [specific process gaps identified]

**For next implementation:**

- [concrete improvements to try]

## Important

- **Be specific:** Don't say "plan was unclear" — say "plan didn't specify which validation pattern to use"
- **Focus on patterns:** One-off issues are rarely actionable. Look for repeated problems.
- **Action-oriented:** Every finding should have a concrete asset update suggestion
- **Suggest improvements:** Don't just analyze — actually suggest the text to add to AGENTS.md or commands

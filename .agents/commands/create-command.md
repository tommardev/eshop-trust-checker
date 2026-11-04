---
description: Meta command creator - generates slash commands following established patterns
argument-hint: <command-name> <purpose description>
---

<objective>
Create a new slash command: `$ARGUMENTS`

You are an AI coding assistant creating a command for future AI agent sessions. The agent executing the generated command has standard coding agent capabilities:
- Subagent delegation and task orchestration
- Read, Write, Edit, Glob, Grep tools
- Safe shell execution
- Web search and page fetch
- Extended reasoning for complex analysis

**Meta Principle**: The command you create will be executed by an agent identical to you. Write instructions you would want to receive.
</objective>

<context>
Existing commands: in `.agents/commands/`
Command patterns: in `.agents/commands/commit.md` and `.agents/commands/handoff.md`
AGENTS.md conventions: @AGENTS.md
</context>

<process>

## Phase 1: ANALYZE - Understand the Command Request

**PARSE the input:**
- Command name: Extract from first argument
- Purpose: Extract from remaining arguments
- Command type: Determine category

**CLASSIFY command type:**

| Type | Characteristics | Examples |
|------|----------------|----------|
| WORKFLOW | Multi-phase, produces artifacts, needs subagents | plan-feature, rca |
| ACTION | Single operation, immediate result | commit, create-pr |
| ANALYSIS | Investigates codebase, produces report | rca, review-doc |
| UTILITY | Helper task, quick execution | validate, check-ignores |

**DETERMINE requirements:**
- Does it need arguments? → Add `argument-hint`
- Does it need tool restrictions? → Add `allowed-tools` if supported
- Does it produce files? → Define output path
- Does it need codebase exploration? → Plan for subagent research
- Does it need external research? → Plan for WebSearch

**PHASE_1_CHECKPOINT:**
- [ ] Command name is kebab-case
- [ ] Purpose is clear and specific
- [ ] Command type identified
- [ ] Requirements mapped

---

## Phase 2: EXPLORE - Study Existing Patterns

**Analyze existing commands in `.agents/commands/` to find patterns for creating a new command:**

DISCOVER:
1. YAML frontmatter patterns — description, argument-hint
2. Tag usage — which tags are used and when
3. Phase structure — how commands break down work
4. Checkpoint patterns — how self-validation is done
5. Output format patterns — how results are reported

**IDENTIFY patterns to mirror:**

| Pattern | Source Command | Snippet |
|---------|---------------|---------|
| Frontmatter | `commit.md:1-4` | `---\ndescription:...\n---` |
| Objective section | `handoff.md:6-10` | `## Objective` |
| Output structure | `handoff.md:45-102` | Report template |

**PHASE_2_CHECKPOINT:**
- [ ] Explored existing commands in `.agents/commands/`
- [ ] Identified patterns to mirror
- [ ] Found similar command as primary reference

---

## Phase 3: DESIGN - Structure the Command

**DETERMINE required sections/tags:**

| Tag/Section | When to Include | Required? |
|-------------|-----------------|-----------|
| `<objective>` or `# Objective` | Always | YES |
| `<context>` or `## Context` | When dynamic state needed | If applicable |
| `<process>` or `## Process` | Always | YES |
| `<output>` or `## Output` | When producing artifacts | If applicable |
| `<verification>` or `## Verification` | When quality checks needed | Recommended |
| `<success_criteria>` | Always | YES |

**DESIGN phase structure:**

For WORKFLOW commands:
```
Phase 1: PARSE/UNDERSTAND - Analyze input
Phase 2: EXPLORE/GATHER - Collect context
Phase 3: ANALYZE/DESIGN - Plan changes
Phase 4: EXECUTE/GENERATE - Do the work
Phase 5: VALIDATE/VERIFY - Check results
```

For ACTION commands:
```
1. Gather context
2. Execute action
3. Report result
```

**DESIGN output format:**
- What file(s) does it create?
- What does it report to the user?
- What is the next step suggestion?

**PHASE_3_CHECKPOINT:**
- [ ] Sections/tags selected appropriately
- [ ] Phase structure matches command type
- [ ] Output format defined
- [ ] Complexity matches purpose (not over-engineered)

---

## Phase 4: GENERATE - Write the Command

**STRUCTURE the command file:**

```markdown
---
description: {Clear, concise description}
argument-hint: {If arguments needed}
---

<objective>
{What this command does and why}
</objective>

<context>
{Dynamic context and @file references}
</context>

<process>

## Phase 1: {VERB} - {Phase Name}

**{ACTION}:**
- Step 1
- Step 2

**PHASE_1_CHECKPOINT:**
- [ ] Validation item 1
- [ ] Validation item 2

---

## Phase 2: {VERB} - {Phase Name}

...

</process>

<output>
**OUTPUT_FILE**: {path if applicable}

**REPORT_TO_USER**:
{What to display after completion}
</output>

<verification>
{Final validation checklist before completing}
</verification>

<success_criteria>
{How to know the command succeeded}
</success_criteria>
```

**APPLY information-dense keywords:**
- Phase names: PARSE, EXPLORE, ANALYZE, DESIGN, GENERATE, VALIDATE
- Action keywords: EXTRACT, CLASSIFY, DETERMINE, IDENTIFY, CREATE, UPDATE
- Checkpoint format: `**PHASE_N_CHECKPOINT:**` with checkboxes

**PHASE_4_CHECKPOINT:**
- [ ] YAML frontmatter complete
- [ ] All required sections present
- [ ] Phases have checkpoints
- [ ] Keywords are information-dense
- [ ] Output format specified

---

## Phase 5: VALIDATE - Quality Check

**VERIFY command quality:**

| Check | Question | Pass? |
|-------|----------|-------|
| CLARITY | Would an agent understand this command without ambiguity? | |
| COMPLETENESS | Are all steps explicit with no guesswork? | |
| CAPABILITY_MATCH | Does it only ask for capabilities coding agents possess? | |
| PATTERN_FAITHFUL | Does it match existing command patterns? | |
| NOT_OVER_ENGINEERED | Is complexity appropriate for the task? | |

**PHASE_5_CHECKPOINT:**
- [ ] Command is clear and actionable
- [ ] No ambiguous instructions
- [ ] Matches agent capabilities
- [ ] Follows established patterns
- [ ] Appropriate complexity level

</process>

<output>
**OUTPUT_FILE**: `.agents/commands/{command-name}.md`

**REPORT_TO_USER**:

```markdown
## Command Created

**File**: `.agents/commands/{command-name}.md`

**Usage**: `/{command-name} {arguments if any}`

**Type**: {WORKFLOW/ACTION/ANALYSIS/UTILITY}

**Description**: {one-line description}

**Structure**:
- {N} phases
- {Key features}

**Test it**: Try running `/{command-name}` to verify it works as expected.
```
</output>

<verification>
**Before saving the command, verify:**

**STRUCTURE:**
- [ ] YAML frontmatter has required `description` field
- [ ] `argument-hint` present if command takes arguments
- [ ] All tags properly opened and closed
- [ ] Objective, Process, and Success Criteria present

**CONTENT:**
- [ ] Objective clearly states what and why
- [ ] Process has logical phase breakdown
- [ ] Each phase has checkpoint with validation items
- [ ] Output format defined if command produces artifacts
- [ ] Success criteria are measurable

**QUALITY:**
- [ ] Instructions you would want to receive
- [ ] No ambiguous or vague steps
- [ ] Information-dense keywords used
- [ ] Matches complexity to task (not over-engineered)
- [ ] Agent capabilities correctly referenced
</verification>

<success_criteria>
**EXECUTABLE**: Command can be run immediately without confusion
**PATTERN_FAITHFUL**: Matches established command conventions
**SELF_DOCUMENTING**: Purpose and process clear from reading
**RIGHT_SIZED**: Complexity matches the task (simple tasks = simple commands)
</success_criteria>

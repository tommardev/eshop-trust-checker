import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface RunBlock {
  lineNumber: number;
  content: string;
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CODEQL_WORKFLOW_RELATIVE_PATH = '.github/workflows/codeql.yml';
const CODEQL_WORKFLOW_PATH = path.resolve(REPO_ROOT, CODEQL_WORKFLOW_RELATIVE_PATH);

const SHA_PINNED_USES_REGEX =
  /^uses:\s+[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*@[0-9a-f]{40}\s+#\s+v\d+\.\d+\.\d+$/;
const BLOCK_SCALAR_VALUE_REGEX =
  /^(\s*)(?:-\s+)?[a-zA-Z0-9_-]+:\s*[|>](?:[+-]\d*|\d+[+-]?)?\s*(?:#.*)?$/;
const BLOCK_SCALAR_RUN_REGEX = /^(\s*)(?:-\s+)?run:\s*[|>](?:[+-]\d*|\d+[+-]?)?\s*(?:#.*)?$/;

function readCodeqlWorkflowText(): string {
  return readFileSync(CODEQL_WORKFLOW_PATH, 'utf8');
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function leadingSpaces(line: string): number {
  const match = /^ */.exec(line);
  return match ? match[0].length : 0;
}

function isBlankOrComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

function extractIndentedBlock(lines: string[], indent: number, key: string): string[] {
  const indentPrefix = ' '.repeat(indent);
  const blockScalarHeaderPattern = new RegExp(
    `^${indentPrefix}${key}:\\s*[|>](?:[+-]\\d*|\\d+[+-]?)?\\s*(?:#.*)?$`,
  );
  const headerPattern = new RegExp(`^${indentPrefix}${key}:(?:\\s*(?:#.*)?)?$`);
  const inlinePattern = new RegExp(`^${indentPrefix}${key}:\\s+(.+)$`);
  const block: string[] = [];
  let capturing = false;
  let blockScalarIndent: number | null = null;

  for (const line of lines) {
    if (!capturing) {
      if (blockScalarHeaderPattern.test(line)) {
        capturing = true;
        blockScalarIndent = indent;
        block.push(line);
      } else if (headerPattern.test(line)) {
        capturing = true;
        block.push(line);
      } else if (inlinePattern.test(line)) {
        block.push(line);
        break;
      }
      continue;
    }

    const trimmed = line.trim();
    if (blockScalarIndent !== null) {
      if (trimmed !== '' && leadingSpaces(line) <= blockScalarIndent) {
        blockScalarIndent = null;
      } else {
        block.push(line);
        continue;
      }
    }

    if (trimmed !== '' && !trimmed.startsWith('#') && leadingSpaces(line) <= indent) {
      break;
    }

    const blockScalarMatch = BLOCK_SCALAR_VALUE_REGEX.exec(line);
    if (blockScalarMatch) {
      blockScalarIndent = blockScalarMatch[1].length;
    }

    block.push(line);
  }

  return block;
}

function extractJobs(lines: string[]): Map<string, string[]> {
  const jobsBlock = extractIndentedBlock(lines, 0, 'jobs');
  const jobs = new Map<string, string[]>();
  let currentJobId: string | null = null;
  let currentJobLines: string[] = [];
  let blockScalarIndent: number | null = null;

  for (const line of jobsBlock.slice(1)) {
    const trimmed = line.trim();
    if (blockScalarIndent !== null) {
      if (trimmed !== '' && leadingSpaces(line) <= blockScalarIndent) {
        blockScalarIndent = null;
      } else {
        if (currentJobId !== null) {
          currentJobLines.push(line);
        }
        continue;
      }
    }

    const jobMatch = /^  ([a-zA-Z0-9_-]+):(?:\s*(?:#.*)?)?$/.exec(line);
    if (jobMatch) {
      if (currentJobId !== null) {
        jobs.set(currentJobId, currentJobLines);
      }
      currentJobId = jobMatch[1];
      currentJobLines = [line];
      continue;
    }

    const blockScalarMatch = BLOCK_SCALAR_VALUE_REGEX.exec(line);
    if (blockScalarMatch) {
      blockScalarIndent = blockScalarMatch[1].length;
    }

    if (currentJobId !== null) {
      currentJobLines.push(line);
    }
  }

  if (currentJobId !== null) {
    jobs.set(currentJobId, currentJobLines);
  }

  return jobs;
}

function extractJobSteps(jobLines: string[]): string[][] {
  const stepsBlock = extractIndentedBlock(jobLines, 4, 'steps');
  const steps: string[][] = [];
  let currentStep: string[] | null = null;
  let blockScalarIndent: number | null = null;

  for (const line of stepsBlock.slice(1)) {
    const trimmed = line.trim();
    if (blockScalarIndent !== null) {
      if (trimmed !== '' && leadingSpaces(line) <= blockScalarIndent) {
        blockScalarIndent = null;
      } else {
        if (currentStep !== null) {
          currentStep.push(line);
        }
        continue;
      }
    }

    if (/^      -\s+/.test(line)) {
      if (currentStep !== null) {
        steps.push(currentStep);
      }
      currentStep = [line];
      continue;
    }

    const blockScalarMatch = BLOCK_SCALAR_VALUE_REGEX.exec(line);
    if (blockScalarMatch) {
      blockScalarIndent = blockScalarMatch[1].length;
    }

    if (currentStep !== null) {
      currentStep.push(line);
    }
  }

  if (currentStep !== null) {
    steps.push(currentStep);
  }

  return steps;
}

function extractUsesLines(lines: string[]): string[] {
  const usesLines: string[] = [];
  let blockScalarIndent: number | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (blockScalarIndent !== null) {
      if (trimmed !== '' && leadingSpaces(line) <= blockScalarIndent) {
        blockScalarIndent = null;
      } else {
        continue;
      }
    }

    if (isBlankOrComment(line)) {
      continue;
    }

    const blockScalarMatch = BLOCK_SCALAR_VALUE_REGEX.exec(line);
    if (blockScalarMatch) {
      blockScalarIndent = blockScalarMatch[1].length;
      continue;
    }

    if (/^\s*(?:-\s+)?uses:/.test(line)) {
      usesLines.push(trimmed.replace(/^-\s+/, ''));
    }
  }

  return usesLines;
}

function extractRunBlocks(lines: string[]): RunBlock[] {
  const blocks: RunBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlankOrComment(line)) {
      i += 1;
      continue;
    }

    const blockScalarMatch = BLOCK_SCALAR_RUN_REGEX.exec(line);
    if (blockScalarMatch) {
      const runIndent = blockScalarMatch[1].length;
      const startLine = i + 1;
      const bodyLines: string[] = [];
      i += 1;

      while (i < lines.length) {
        const bodyLine = lines[i];
        if (bodyLine.trim() === '') {
          bodyLines.push(bodyLine);
          i += 1;
          continue;
        }
        if (leadingSpaces(bodyLine) <= runIndent) {
          break;
        }
        bodyLines.push(bodyLine);
        i += 1;
      }

      blocks.push({
        lineNumber: startLine,
        content: bodyLines.join('\n'),
      });
      continue;
    }

    const singleLineMatch = /^\s*(?:-\s+)?run:\s*(.+)$/.exec(line);
    if (singleLineMatch) {
      blocks.push({
        lineNumber: i + 1,
        content: singleLineMatch[1],
      });
    }

    i += 1;
  }

  return blocks;
}

function hasMainBranchTarget(triggerBlock: string[]): boolean {
  const branchesBlock = extractIndentedBlock(triggerBlock, 4, 'branches');
  if (branchesBlock.length === 0) {
    return false;
  }

  return branchesBlock.some(
    (line) =>
      /^\s*-\s*['"]?main['"]?\s*(?:#.*)?$/.test(line) ||
      /^\s*branches:\s*\[\s*['"]?main['"]?\s*\]\s*(?:#.*)?$/.test(line),
  );
}

describe('.github/workflows/codeql.yml contract', () => {
  it('exists, uses spaces without tabs, names CodeQL, and configures push, pull_request, weekly schedule, and workflow_dispatch without pull_request_target', () => {
    assert.strictEqual(
      existsSync(CODEQL_WORKFLOW_PATH),
      true,
      `Expected ${CODEQL_WORKFLOW_RELATIVE_PATH} to exist`,
    );

    const workflowText = readCodeqlWorkflowText();
    const lines = splitLines(workflowText);

    assert.strictEqual(
      workflowText.includes('\t'),
      false,
      'codeql.yml must not contain tab characters',
    );
    assert.ok(
      lines.some((line) => /^name:\s*CodeQL\s*$/.test(line)),
      'codeql.yml must set workflow name: CodeQL',
    );
    assert.strictEqual(
      /\bpull_request_target\b/.test(workflowText),
      false,
      'codeql.yml must never use pull_request_target',
    );

    const onBlock = extractIndentedBlock(lines, 0, 'on');
    assert.ok(onBlock.length > 0, 'codeql.yml must define an on: trigger block');

    const pushBlock = extractIndentedBlock(onBlock, 2, 'push');
    const pullRequestBlock = extractIndentedBlock(onBlock, 2, 'pull_request');
    const scheduleBlock = extractIndentedBlock(onBlock, 2, 'schedule');
    const workflowDispatchBlock = extractIndentedBlock(onBlock, 2, 'workflow_dispatch');

    assert.strictEqual(
      hasMainBranchTarget(pushBlock),
      true,
      'codeql.yml must trigger on push targeting main',
    );
    assert.strictEqual(
      hasMainBranchTarget(pullRequestBlock),
      true,
      'codeql.yml must trigger on pull_request targeting main',
    );

    const cronLine = scheduleBlock.find((line) => /^\s+-\s+cron:\s*/.test(line));
    assert.ok(cronLine, 'codeql.yml must define a schedule cron entry');
    const cronMatch = /^\s+-\s+cron:\s*['"](\S+\s+\S+\s+\S+\s+\S+\s+(\S+))['"]\s*(?:#.*)?$/.exec(
      cronLine,
    );
    assert.ok(cronMatch, `schedule cron entry must be a valid 5-field expression: ${cronLine}`);
    assert.match(
      cronMatch[2],
      /^(?:[0-7]|SUN|MON|TUE|WED|THU|FRI|SAT)$/i,
      `schedule cron must run weekly on a single day of the week: ${cronLine}`,
    );

    assert.ok(
      workflowDispatchBlock.length > 0,
      'codeql.yml must allow manual workflow_dispatch runs',
    );
  });

  it('enforces top-level permissions: {}, minimal job permissions, and PR-only concurrency cancellation', () => {
    const workflowText = readCodeqlWorkflowText();
    const lines = splitLines(workflowText);

    const topLevelPermissions = extractIndentedBlock(lines, 0, 'permissions');
    assert.strictEqual(
      topLevelPermissions.length,
      1,
      'Top-level permissions: must be inline empty mapping {}',
    );
    assert.match(
      topLevelPermissions[0],
      /^permissions:\s*\{\}\s*(?:#.*)?$/,
      'Top-level permissions: must be permissions: {}',
    );

    assert.strictEqual(
      /\bwrite-all\b/.test(workflowText),
      false,
      'codeql.yml must never grant write-all permissions',
    );
    assert.strictEqual(
      lines.some((line) => !isBlankOrComment(line) && /^\s*contents:\s*write\b/.test(line)),
      false,
      'codeql.yml must never grant contents: write',
    );

    const jobs = extractJobs(lines);
    const analyzeJob = jobs.get('analyze');
    assert.ok(analyzeJob, 'Expected analyze job to exist');

    const jobPermissionsBlock = extractIndentedBlock(analyzeJob, 4, 'permissions');
    const jobPermissionEntries = jobPermissionsBlock
      .slice(1)
      .filter((line) => !isBlankOrComment(line))
      .map((line) => line.trim())
      .sort();

    assert.deepStrictEqual(
      jobPermissionEntries,
      ['contents: read', 'security-events: write'],
      'analyze job permissions must grant only contents: read and security-events: write',
    );

    const concurrencyBlock = extractIndentedBlock(lines, 0, 'concurrency');
    assert.ok(
      concurrencyBlock.some((line) =>
        /^\s+group:\s*\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.ref\s*\}\}\s*$/.test(line),
      ),
      'concurrency.group must be ${{ github.workflow }}-${{ github.ref }}',
    );
    assert.ok(
      concurrencyBlock.some((line) =>
        /^\s+cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*==\s*'pull_request'\s*\}\}\s*$/.test(
          line,
        ),
      ),
      "concurrency.cancel-in-progress must be ${{ github.event_name == 'pull_request' }}",
    );
  });

  it('defines a single analyze job on ubuntu-latest with timeout-minutes: 20 and javascript-typescript matrix', () => {
    const lines = splitLines(readCodeqlWorkflowText());
    const jobs = extractJobs(lines);

    assert.deepStrictEqual(
      Array.from(jobs.keys()),
      ['analyze'],
      'codeql.yml must define a single job named analyze',
    );

    const analyzeJob = jobs.get('analyze');
    assert.ok(analyzeJob, 'Expected analyze job to exist');

    assert.ok(
      analyzeJob.some((line) =>
        /^    name:\s*Analyze \(\$\{\{\s*matrix\.language\s*\}\}\)\s*$/.test(line),
      ),
      'analyze job must set name: Analyze (${{ matrix.language }})',
    );
    assert.ok(
      analyzeJob.some((line) => /^    runs-on:\s*ubuntu-latest\s*$/.test(line)),
      'analyze job must use runs-on: ubuntu-latest',
    );
    assert.ok(
      analyzeJob.some((line) => /^    timeout-minutes:\s*20\s*$/.test(line)),
      'analyze job must set timeout-minutes: 20',
    );

    const strategyBlock = extractIndentedBlock(analyzeJob, 4, 'strategy');
    assert.ok(
      strategyBlock.some((line) => /^      fail-fast:\s*false\s*$/.test(line)),
      'analyze job strategy must set fail-fast: false',
    );

    const matrixBlock = extractIndentedBlock(strategyBlock, 6, 'matrix');
    assert.ok(
      matrixBlock.some((line) => /^\s+-\s+language:\s*javascript-typescript\s*$/.test(line)),
      'analyze matrix must target language: javascript-typescript',
    );
    assert.ok(
      matrixBlock.some((line) => /^\s+build-mode:\s*none\s*$/.test(line)),
      'analyze matrix must set build-mode: none',
    );
  });

  it('pins every GitHub Action (including 3-segment sub-actions) to a full 40-char commit SHA with semver comment', () => {
    const lines = splitLines(readCodeqlWorkflowText());
    const usesLines = extractUsesLines(lines);

    assert.strictEqual(
      usesLines.length,
      3,
      'Expected 3 uses: declarations (checkout, codeql-action/init, codeql-action/analyze)',
    );

    for (const usesLine of usesLines) {
      assert.match(
        usesLine,
        SHA_PINNED_USES_REGEX,
        `Action reference must be 40-char SHA-pinned with # vX.Y.Z comment: ${usesLine}`,
      );
    }

    assert.strictEqual(
      usesLines.filter((line) => line.startsWith('uses: actions/checkout@')).length,
      1,
      'Expected 1 actions/checkout step',
    );
    assert.strictEqual(
      usesLines.filter((line) => line.startsWith('uses: github/codeql-action/init@')).length,
      1,
      'Expected 1 github/codeql-action/init step',
    );
    assert.strictEqual(
      usesLines.filter((line) => line.startsWith('uses: github/codeql-action/analyze@')).length,
      1,
      'Expected 1 github/codeql-action/analyze step',
    );
  });

  it('configures checkout persist-credentials: false, security-extended queries, and language category in order', () => {
    const lines = splitLines(readCodeqlWorkflowText());
    const jobs = extractJobs(lines);
    const analyzeJob = jobs.get('analyze');
    assert.ok(analyzeJob, 'Expected analyze job to exist');

    const steps = extractJobSteps(analyzeJob);
    assert.ok(steps.length >= 4, 'analyze job must include checkout, init, analyze, and summary steps');

    const checkoutIndex = steps.findIndex((step) =>
      step.some((line) => /^\s+(?:-\s+)?uses:\s*actions\/checkout@/.test(line)),
    );
    const initIndex = steps.findIndex((step) =>
      step.some((line) => /^\s+(?:-\s+)?uses:\s*github\/codeql-action\/init@/.test(line)),
    );
    const analyzeIndex = steps.findIndex((step) =>
      step.some((line) => /^\s+(?:-\s+)?uses:\s*github\/codeql-action\/analyze@/.test(line)),
    );

    assert.notStrictEqual(checkoutIndex, -1, 'Expected actions/checkout step');
    assert.notStrictEqual(initIndex, -1, 'Expected github/codeql-action/init step');
    assert.notStrictEqual(analyzeIndex, -1, 'Expected github/codeql-action/analyze step');
    assert.ok(
      checkoutIndex < initIndex && initIndex < analyzeIndex,
      'Steps must execute in order: checkout -> init -> analyze',
    );

    const checkoutWith = extractIndentedBlock(steps[checkoutIndex], 8, 'with');
    assert.ok(
      checkoutWith.some((line) => /^\s+persist-credentials:\s*false\s*$/.test(line)),
      'actions/checkout must set persist-credentials: false',
    );

    const initWith = extractIndentedBlock(steps[initIndex], 8, 'with');
    assert.ok(
      initWith.some((line) => /^\s+languages:\s*\$\{\{\s*matrix\.language\s*\}\}\s*$/.test(line)),
      'codeql-action/init must set languages: ${{ matrix.language }}',
    );
    assert.ok(
      initWith.some((line) =>
        /^\s+build-mode:\s*\$\{\{\s*matrix\.build-mode\s*\}\}\s*$/.test(line),
      ),
      'codeql-action/init must set build-mode: ${{ matrix.build-mode }}',
    );
    assert.ok(
      initWith.some((line) => /^\s+queries:\s*security-extended\s*$/.test(line)),
      'codeql-action/init must set queries: security-extended',
    );

    const analyzeWith = extractIndentedBlock(steps[analyzeIndex], 8, 'with');
    assert.ok(
      analyzeWith.some((line) =>
        /^\s+category:\s*["']\/language:\$\{\{\s*matrix\.language\s*\}\}["']\s*$/.test(line),
      ),
      'codeql-action/analyze must set category: "/language:${{ matrix.language }}"',
    );
  });

  it('writes if: always() $GITHUB_STEP_SUMMARY using env: variables and avoids ${{ in all run: blocks', () => {
    const lines = splitLines(readCodeqlWorkflowText());
    const jobs = extractJobs(lines);
    const analyzeJob = jobs.get('analyze');
    assert.ok(analyzeJob, 'Expected analyze job to exist');

    const steps = extractJobSteps(analyzeJob);
    const summarySteps = steps.filter((step) =>
      extractRunBlocks(step).some((runBlock) => runBlock.content.includes('$GITHUB_STEP_SUMMARY')),
    );

    assert.strictEqual(
      summarySteps.length,
      1,
      'analyze job must include 1 step writing to $GITHUB_STEP_SUMMARY',
    );

    const summaryStep = summarySteps[0];
    assert.ok(
      summaryStep.some((line) => /^\s+if:\s*always\(\)\s*$/.test(line)),
      'summary step must set if: always()',
    );

    const envBlock = extractIndentedBlock(summaryStep, 8, 'env');
    assert.ok(
      envBlock.length >= 2 && envBlock.slice(1).some((line) => /\$\{\{/.test(line)),
      'summary step must pass GitHub expressions via env:',
    );

    const summaryRuns = extractRunBlocks(summaryStep);
    assert.strictEqual(summaryRuns.length, 1);
    assert.ok(
      summaryRuns[0].content.includes('CodeQL Summary'),
      'summary output must include CodeQL Summary heading',
    );

    const allRunBlocks = extractRunBlocks(lines);
    assert.strictEqual(allRunBlocks.length, 1, 'Expected 1 run: block (summary step)');

    for (const runBlock of allRunBlocks) {
      assert.strictEqual(
        runBlock.content.includes('${{'),
        false,
        `run: block starting at line ${runBlock.lineNumber} must not inline \${{ ... }} expressions; pass via env: instead`,
      );
    }
  });
});

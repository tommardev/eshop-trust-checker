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
const CI_WORKFLOW_RELATIVE_PATH = '.github/workflows/ci.yml';
const CI_WORKFLOW_PATH = path.resolve(REPO_ROOT, CI_WORKFLOW_RELATIVE_PATH);

const SHA_PINNED_USES_REGEX = /^uses:\s+[\w.-]+\/[\w.-]+@[0-9a-f]{40}\s+#\s+v\d+\.\d+\.\d+$/;
const BLOCK_SCALAR_VALUE_REGEX =
  /^(\s*)(?:-\s+)?[a-zA-Z0-9_-]+:\s*[|>](?:[+-]\d*|\d+[+-]?)?\s*(?:#.*)?$/;
const BLOCK_SCALAR_RUN_REGEX = /^(\s*)(?:-\s+)?run:\s*[|>](?:[+-]\d*|\d+[+-]?)?\s*(?:#.*)?$/;

const EXPECTED_JOBS = [
  { id: 'lint', timeoutMinutes: 10, command: 'npm run lint' },
  { id: 'typecheck', timeoutMinutes: 10, command: 'npx tsc --noEmit --incremental false' },
  { id: 'test', timeoutMinutes: 10, command: 'npm test' },
  { id: 'build', timeoutMinutes: 15, command: 'npm run build' },
] as const;

function readCiWorkflowText(): string {
  return readFileSync(CI_WORKFLOW_PATH, 'utf8');
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

describe('.github/workflows/ci.yml contract', () => {
  it('exists, uses spaces without tabs, and triggers on pull_request/push to main without pull_request_target', () => {
    assert.strictEqual(
      existsSync(CI_WORKFLOW_PATH),
      true,
      `Expected ${CI_WORKFLOW_RELATIVE_PATH} to exist`,
    );

    const workflowText = readCiWorkflowText();
    const lines = splitLines(workflowText);

    assert.strictEqual(workflowText.includes('\t'), false, 'ci.yml must not contain tab characters');
    assert.ok(
      lines.some((line) => /^name:\s*CI\s*$/.test(line)),
      'ci.yml must set workflow name: CI',
    );
    assert.strictEqual(
      /\bpull_request_target\b/.test(workflowText),
      false,
      'ci.yml must never use pull_request_target',
    );

    const onBlock = extractIndentedBlock(lines, 0, 'on');
    assert.ok(onBlock.length > 0, 'ci.yml must define an on: trigger block');

    const pullRequestBlock = extractIndentedBlock(onBlock, 2, 'pull_request');
    const pushBlock = extractIndentedBlock(onBlock, 2, 'push');

    assert.strictEqual(
      hasMainBranchTarget(pullRequestBlock),
      true,
      'ci.yml must trigger on pull_request targeting main',
    );
    assert.strictEqual(
      hasMainBranchTarget(pushBlock),
      true,
      'ci.yml must trigger on push targeting main',
    );
  });

  it('enforces least-privilege permissions, PR-only concurrency cancellation, and telemetry opt-out', () => {
    const workflowText = readCiWorkflowText();
    const lines = splitLines(workflowText);

    const permissionsBlock = extractIndentedBlock(lines, 0, 'permissions');
    const permissionEntries = permissionsBlock
      .slice(1)
      .filter((line) => !isBlankOrComment(line))
      .map((line) => line.trim());

    assert.deepStrictEqual(
      permissionEntries,
      ['contents: read'],
      'Top-level permissions: must grant only contents: read',
    );
    assert.strictEqual(
      /\bwrite-all\b/.test(workflowText),
      false,
      'ci.yml must never grant write-all permissions',
    );
    assert.strictEqual(
      lines.some((line) => !isBlankOrComment(line) && /:\s*write\b/.test(line)),
      false,
      'ci.yml must never grant any : write permission',
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

    const envBlock = extractIndentedBlock(lines, 0, 'env');
    assert.ok(
      envBlock.some((line) => /^\s+NEXT_TELEMETRY_DISABLED:\s*['"]1['"]\s*$/.test(line)),
      "Top-level env: must set NEXT_TELEMETRY_DISABLED: '1'",
    );
  });

  it('runs lint, typecheck, test, and build as parallel ubuntu-latest jobs with explicit timeouts', () => {
    const lines = splitLines(readCiWorkflowText());
    const jobs = extractJobs(lines);

    assert.deepStrictEqual(
      Array.from(jobs.keys()),
      EXPECTED_JOBS.map((job) => job.id),
      'ci.yml must define exact parallel jobs: lint, typecheck, test, build',
    );

    for (const expectedJob of EXPECTED_JOBS) {
      const jobLines = jobs.get(expectedJob.id);
      assert.ok(jobLines, `Expected job ${expectedJob.id} to exist`);

      assert.ok(
        jobLines.some((line) => new RegExp(`^    name:\\s*${expectedJob.id}\\s*$`).test(line)),
        `Job ${expectedJob.id} must define exact lowercase name: ${expectedJob.id}`,
      );
      assert.ok(
        jobLines.some((line) => /^    runs-on:\s*ubuntu-latest\s*$/.test(line)),
        `Job ${expectedJob.id} must use runs-on: ubuntu-latest`,
      );
      assert.strictEqual(
        jobLines.some((line) => !isBlankOrComment(line) && /^\s+needs:/.test(line)),
        false,
        `Job ${expectedJob.id} must run in parallel without needs:`,
      );
      assert.ok(
        jobLines.some((line) =>
          new RegExp(`^    timeout-minutes:\\s*${expectedJob.timeoutMinutes}\\s*$`).test(line),
        ),
        `Job ${expectedJob.id} must set timeout-minutes: ${expectedJob.timeoutMinutes}`,
      );
    }
  });

  it('pins every GitHub Action to a full 40-character commit SHA with semver comment', () => {
    const lines = splitLines(readCiWorkflowText());
    const usesLines = extractUsesLines(lines);

    assert.strictEqual(
      usesLines.length,
      9,
      'Expected 9 uses: declarations across lint, typecheck, test, and build',
    );

    for (const usesLine of usesLines) {
      assert.match(
        usesLine,
        SHA_PINNED_USES_REGEX,
        `Action reference must be 40-char SHA-pinned with # vX.Y.Z comment: ${usesLine}`,
      );
    }

    const checkoutCount = usesLines.filter((line) => line.startsWith('uses: actions/checkout@')).length;
    const setupNodeCount = usesLines.filter((line) =>
      line.startsWith('uses: actions/setup-node@'),
    ).length;
    const cacheCount = usesLines.filter((line) => line.startsWith('uses: actions/cache@')).length;

    assert.strictEqual(checkoutCount, 4, 'Expected 4 actions/checkout steps');
    assert.strictEqual(setupNodeCount, 4, 'Expected 4 actions/setup-node steps');
    assert.strictEqual(cacheCount, 1, 'Expected 1 actions/cache step in build job');
  });

  it('configures checkout safety, Node 24, npm ci, exact commands, and .next/cache in build', () => {
    const lines = splitLines(readCiWorkflowText());
    const jobs = extractJobs(lines);

    for (const expectedJob of EXPECTED_JOBS) {
      const jobLines = jobs.get(expectedJob.id);
      assert.ok(jobLines, `Expected job ${expectedJob.id} to exist`);

      const steps = extractJobSteps(jobLines);
      assert.ok(steps.length >= 5, `Job ${expectedJob.id} must contain setup, install, check, and summary steps`);

      const checkoutSteps = steps.filter((step) =>
        step.some((line) => /^\s+(?:-\s+)?uses:\s*actions\/checkout@/.test(line)),
      );
      assert.strictEqual(
        checkoutSteps.length,
        1,
        `Job ${expectedJob.id} must have 1 actions/checkout step`,
      );
      assert.ok(
        checkoutSteps[0].some((line) => /^\s+persist-credentials:\s*false\s*$/.test(line)),
        `Job ${expectedJob.id} checkout step must set persist-credentials: false`,
      );

      const setupNodeSteps = steps.filter((step) =>
        step.some((line) => /^\s+(?:-\s+)?uses:\s*actions\/setup-node@/.test(line)),
      );
      assert.strictEqual(
        setupNodeSteps.length,
        1,
        `Job ${expectedJob.id} must have 1 actions/setup-node step`,
      );
      assert.ok(
        setupNodeSteps[0].some((line) => /^\s+node-version:\s*['"]24['"]\s*$/.test(line)),
        `Job ${expectedJob.id} setup-node step must set node-version: '24'`,
      );
      assert.ok(
        setupNodeSteps[0].some((line) => /^\s+cache:\s*['"]npm['"]\s*$/.test(line)),
        `Job ${expectedJob.id} setup-node step must set cache: 'npm'`,
      );

      const installStepIndex = steps.findIndex((step) =>
        step.some((line) => /^\s+(?:-\s+)?run:\s*npm ci\s*$/.test(line)),
      );
      assert.notStrictEqual(
        installStepIndex,
        -1,
        `Job ${expectedJob.id} must run npm ci`,
      );

      const escapedCommand = expectedJob.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const checkStepIndex = steps.findIndex((step) =>
        step.some((line) => new RegExp(`^\\s+(?:-\\s+)?run:\\s*${escapedCommand}\\s*$`).test(line)),
      );
      assert.notStrictEqual(
        checkStepIndex,
        -1,
        `Job ${expectedJob.id} must run exact command: ${expectedJob.command}`,
      );
      assert.ok(
        checkStepIndex > installStepIndex,
        `Job ${expectedJob.id} must run ${expectedJob.command} after npm ci`,
      );

      const cacheStepIndices = steps
        .map((step, index) =>
          step.some((line) => /^\s+(?:-\s+)?uses:\s*actions\/cache@/.test(line)) ? index : -1,
        )
        .filter((index) => index !== -1);

      if (expectedJob.id === 'build') {
        assert.strictEqual(cacheStepIndices.length, 1, 'build job must configure 1 actions/cache step');
        const cacheStepIndex = cacheStepIndices[0];
        const cacheStep = steps[cacheStepIndex];

        assert.ok(
          cacheStepIndex > installStepIndex && cacheStepIndex < checkStepIndex,
          'build job must configure .next/cache after npm ci and before npm run build',
        );
        assert.ok(
          cacheStep.some((line) => /^\s+path:\s*\.next\/cache\s*$/.test(line)),
          'build job cache step must target path: .next/cache',
        );

        const keyLine = cacheStep.find((line) => /^\s+key:\s*.+$/.test(line));
        assert.ok(keyLine, 'build job cache step must define a key:');
        assert.ok(
          /hashFiles\([^)]*['"]package\.json['"][^)]*\)/.test(keyLine),
          'build job cache key must include package.json in hashFiles(...)',
        );

        const withBlock = extractIndentedBlock(cacheStep, 8, 'with');
        const restoreKeysBlock = extractIndentedBlock(withBlock, 10, 'restore-keys');
        assert.ok(
          restoreKeysBlock.length >= 2 &&
            restoreKeysBlock
              .slice(1)
              .some((line) => !isBlankOrComment(line) && line.includes('nextjs-')),
          'build job cache step must define non-empty restore-keys:',
        );
      } else {
        assert.strictEqual(
          cacheStepIndices.length,
          0,
          `Job ${expectedJob.id} should not configure Next.js build cache`,
        );
      }
    }
  });

  it('writes if: always() $GITHUB_STEP_SUMMARY on every job and avoids ${{ in all run: blocks', () => {
    const lines = splitLines(readCiWorkflowText());
    const jobs = extractJobs(lines);

    for (const expectedJob of EXPECTED_JOBS) {
      const jobLines = jobs.get(expectedJob.id);
      assert.ok(jobLines, `Expected job ${expectedJob.id} to exist`);

      const steps = extractJobSteps(jobLines);
      const summarySteps = steps.filter((step) =>
        extractRunBlocks(step).some((runBlock) => runBlock.content.includes('$GITHUB_STEP_SUMMARY')),
      );

      assert.strictEqual(
        summarySteps.length,
        1,
        `Job ${expectedJob.id} must include 1 step writing to $GITHUB_STEP_SUMMARY`,
      );

      const summaryStep = summarySteps[0];
      assert.ok(
        summaryStep.some((line) => /^\s+if:\s*always\(\)\s*$/.test(line)),
        `Job ${expectedJob.id} summary step must set if: always()`,
      );

      const envBlock = extractIndentedBlock(summaryStep, 8, 'env');
      assert.ok(
        envBlock.length >= 2 && envBlock.slice(1).some((line) => /\$\{\{/.test(line)),
        `Job ${expectedJob.id} summary step must pass expressions via env:`,
      );

      const summaryRuns = extractRunBlocks(summaryStep);
      assert.strictEqual(summaryRuns.length, 1);
      assert.ok(
        summaryRuns[0].content.includes(`CI Summary (${expectedJob.id})`),
        `Job ${expectedJob.id} summary output must identify job (${expectedJob.id})`,
      );
    }

    const allRunBlocks = extractRunBlocks(lines);
    assert.strictEqual(
      allRunBlocks.length,
      12,
      'Expected 12 run: blocks across 4 jobs (install, check, summary)',
    );

    for (const runBlock of allRunBlocks) {
      assert.strictEqual(
        runBlock.content.includes('${{'),
        false,
        `run: block starting at line ${runBlock.lineNumber} must not inline \${{ ... }} expressions; pass via env: instead`,
      );
    }
  });
});

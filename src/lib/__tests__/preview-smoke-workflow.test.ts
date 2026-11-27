import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface RunBlock {
  lineNumber: number;
  content: string;
}

type MockFetchStep =
  | {
      type: 'response';
      status: number;
      headers?: Record<string, string>;
      body?: string;
      failOnBodyRead?: boolean;
    }
  | {
      type: 'throw';
      message: string;
    };

interface RecordedFetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  redirect: string | null;
  hasSignal: boolean;
  body: string | null;
}

interface ProbeExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  outputs: Record<string, string>;
  fetchCalls: RecordedFetchCall[];
  unexpectedCallError: string | null;
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const WORKFLOW_RELATIVE_PATH = '.github/workflows/preview-smoke.yml';
const WORKFLOW_PATH = path.resolve(REPO_ROOT, WORKFLOW_RELATIVE_PATH);

const SHA_PINNED_USES_REGEX =
  /^uses:\s+[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*@[0-9a-f]{40}\s+#\s+v\d+\.\d+\.\d+$/;
const BLOCK_SCALAR_VALUE_REGEX =
  /^(\s*)(?:-\s+)?[a-zA-Z0-9_-]+:\s*[|>](?:[+-]\d*|\d+[+-]?)?\s*(?:#.*)?$/;
const BLOCK_SCALAR_RUN_REGEX = /^(\s*)(?:-\s+)?run:\s*[|>](?:[+-]\d*|\d+[+-]?)?\s*(?:#.*)?$/;

function readWorkflowText(): string {
  return readFileSync(WORKFLOW_PATH, 'utf8');
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

function extractEmbeddedNodeScript(workflowText: string, stepId: string): string {
  const lines = splitLines(workflowText);
  const jobs = extractJobs(lines);
  const smokeJob = jobs.get('smoke');
  assert.ok(smokeJob, 'Expected smoke job to exist');

  const steps = extractJobSteps(smokeJob);
  const idPattern = new RegExp(`^\\s+id:\\s*${stepId}\\s*$`);
  const targetStep = steps.find((step) => step.some((line) => idPattern.test(line)));
  assert.ok(targetStep, `Expected ${stepId} step to exist`);

  const runBlocks = extractRunBlocks(targetStep);
  assert.strictEqual(runBlocks.length, 1, `Expected ${stepId} step to have 1 run: block`);

  const runLines = splitLines(runBlocks[0].content);
  const startIdx = runLines.findIndex((line) =>
    /^\s*node(?:\s+--input-type=module)?\s+<<\s*'EOF'\s*$/.test(line),
  );
  assert.notStrictEqual(
    startIdx,
    -1,
    `Expected node [--input-type=module] <<'EOF' in ${stepId} run block`,
  );

  const endIdx = runLines.findIndex(
    (line, index) => index > startIdx && /^\s*EOF\s*$/.test(line),
  );
  assert.notStrictEqual(endIdx, -1, `Expected closing EOF in ${stepId} run block`);

  const rawBodyLines = runLines.slice(startIdx + 1, endIdx);
  const nonEmptyIndents = rawBodyLines
    .filter((line) => line.trim() !== '')
    .map((line) => leadingSpaces(line));
  const commonIndent = nonEmptyIndents.length > 0 ? Math.min(...nonEmptyIndents) : 0;

  return rawBodyLines
    .map((line) => (line.length >= commonIndent ? line.slice(commonIndent) : line))
    .join('\n');
}

function parseGithubOutputs(rawText: string): Record<string, string> {
  const outputs: Record<string, string> = {};
  for (const line of splitLines(rawText)) {
    if (!line) {
      continue;
    }
    const sepIdx = line.indexOf('=');
    if (sepIdx !== -1) {
      outputs[line.slice(0, sepIdx)] = line.slice(sepIdx + 1);
    }
  }
  return outputs;
}

function runEmbeddedNodeScript(options: {
  scriptSource: string;
  envOverrides: Record<string, string | undefined>;
  mockSteps: MockFetchStep[];
}): ProbeExecutionResult {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'preview-smoke-script-'));
  const outputPath = path.join(tempDir, 'github-output.txt');
  const tracePath = path.join(tempDir, 'fetch-trace.json');

  try {
    const scriptBase64 = Buffer.from(options.scriptSource, 'utf8').toString('base64');
    const harness = [
      "import { writeFileSync } from 'node:fs';",
      `const __mockSteps = ${JSON.stringify(options.mockSteps)};`,
      `const __tracePath = ${JSON.stringify(tracePath)};`,
      'const __calls = [];',
      'let __unexpectedCallError = null;',
      'function __flushTrace() {',
      "  writeFileSync(__tracePath, JSON.stringify({ calls: __calls, unexpectedCallError: __unexpectedCallError }), 'utf8');",
      '}',
      '__flushTrace();',
      'globalThis.fetch = async (input, init = {}) => {',
      '  const normalizedHeaders = {};',
      '  for (const [key, value] of new Headers(init?.headers).entries()) {',
      '    normalizedHeaders[key.toLowerCase()] = value;',
      '  }',
      '  const callRecord = {',
      '    url: String(input),',
      "    method: (init?.method || 'GET').toUpperCase(),",
      '    headers: normalizedHeaders,',
      '    redirect: init?.redirect ?? null,',
      '    hasSignal: Boolean(init?.signal),',
      "    body: typeof init?.body === 'string' ? init.body : null,",
      '  };',
      '  __calls.push(callRecord);',
      '  const stepIndex = __calls.length - 1;',
      '  if (stepIndex >= __mockSteps.length) {',
      '    __unexpectedCallError = `Unexpected fetch call #${stepIndex + 1}: ${callRecord.method} ${callRecord.url}`;',
      '    __flushTrace();',
      '    throw new Error(__unexpectedCallError);',
      '  }',
      '  __flushTrace();',
      '  const step = __mockSteps[stepIndex];',
      "  if (step.type === 'throw') {",
      '    throw new Error(step.message);',
      '  }',
      '  const response = new Response(step.body ?? null, {',
      '    status: step.status,',
      '    headers: step.headers ?? {},',
      '  });',
      '  if (step.failOnBodyRead) {',
      "    response.text = async () => { throw new Error('Response body must not be read'); };",
      "    response.json = async () => { throw new Error('Response body must not be read'); };",
      '  }',
      '  return response;',
      '};',
      `const __scriptBase64 = ${JSON.stringify(scriptBase64)};`,
      "await import('data:text/javascript;base64,' + __scriptBase64);",
    ].join('\n');

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      GITHUB_OUTPUT: outputPath,
    };

    for (const [key, value] of Object.entries(options.envOverrides)) {
      if (value === undefined) {
        delete childEnv[key];
      } else {
        childEnv[key] = value;
      }
    }

    const result = spawnSync(process.execPath, ['--input-type=module', '-e', harness], {
      env: childEnv,
      encoding: 'utf8',
      shell: false,
      timeout: 15000,
    });

    assert.strictEqual(result.error, undefined, `Subprocess spawn error: ${String(result.error)}`);
    assert.strictEqual(result.signal, null, `Subprocess terminated by signal: ${String(result.signal)}`);

    const rawOutputs = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
    const trace = existsSync(tracePath)
      ? (JSON.parse(readFileSync(tracePath, 'utf8')) as {
          calls: RecordedFetchCall[];
          unexpectedCallError: string | null;
        })
      : { calls: [], unexpectedCallError: null };

    return {
      exitCode: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      outputs: parseGithubOutputs(rawOutputs),
      fetchCalls: trace.calls,
      unexpectedCallError: trace.unexpectedCallError,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runEmbeddedSmokeProbe(options: {
  scriptSource: string;
  targetUrl?: string;
  deploymentEnvironment?: string;
  bypassSecret?: string;
  mockSteps: MockFetchStep[];
}): ProbeExecutionResult {
  return runEmbeddedNodeScript({
    scriptSource: options.scriptSource,
    envOverrides: {
      SMOKE_BACKOFF_MS: '0,0,0,0',
      TARGET_URL: options.targetUrl,
      DEPLOYMENT_ENVIRONMENT: options.deploymentEnvironment,
      VERCEL_AUTOMATION_BYPASS_SECRET: options.bypassSecret,
    },
    mockSteps: options.mockSteps,
  });
}

function runEmbeddedCommitStatus(options: {
  scriptSource: string;
  githubToken?: string;
  githubRepository?: string;
  deploymentSha?: string;
  runUrl?: string;
  smokeOutcome?: string;
  smokeDetail?: string;
  mockSteps: MockFetchStep[];
}): ProbeExecutionResult {
  return runEmbeddedNodeScript({
    scriptSource: options.scriptSource,
    envOverrides: {
      GITHUB_TOKEN: options.githubToken,
      GITHUB_REPOSITORY: options.githubRepository,
      DEPLOYMENT_SHA: options.deploymentSha,
      RUN_URL: options.runUrl,
      SMOKE_OUTCOME: options.smokeOutcome,
      SMOKE_DETAIL: options.smokeDetail,
    },
    mockSteps: options.mockSteps,
  });
}

describe('Suite A: .github/workflows/preview-smoke.yml YAML & hardening contract', () => {
  it('exists, uses spaces without tabs, names Preview Smoke Check, and triggers only on repository_dispatch (vercel.deployment.success) and deployment_status', () => {
    assert.strictEqual(
      existsSync(WORKFLOW_PATH),
      true,
      `Expected ${WORKFLOW_RELATIVE_PATH} to exist`,
    );

    const workflowText = readWorkflowText();
    const lines = splitLines(workflowText);

    assert.strictEqual(
      workflowText.includes('\t'),
      false,
      'preview-smoke.yml must not contain tab characters',
    );
    assert.ok(
      lines.some((line) => /^name:\s*Preview Smoke Check\s*$/.test(line)),
      'preview-smoke.yml must set name: Preview Smoke Check',
    );
    assert.strictEqual(
      /\bpull_request_target\b/.test(workflowText),
      false,
      'preview-smoke.yml must never use pull_request_target',
    );

    const onBlock = extractIndentedBlock(lines, 0, 'on');
    assert.ok(onBlock.length > 0, 'preview-smoke.yml must define an on: trigger block');

    const topLevelTriggers = onBlock
      .slice(1)
      .filter((line) => /^  [a-zA-Z0-9_-]+:/.test(line))
      .map((line) => line.trim().split(':')[0])
      .sort();
    assert.deepStrictEqual(
      topLevelTriggers,
      ['deployment_status', 'repository_dispatch'],
      'preview-smoke.yml on: block must only define repository_dispatch and deployment_status',
    );

    const dispatchBlock = extractIndentedBlock(onBlock, 2, 'repository_dispatch');
    assert.ok(
      dispatchBlock.some((line) => /^\s+-\s*vercel\.deployment\.success\s*$/.test(line)),
      'repository_dispatch trigger must subscribe to vercel.deployment.success',
    );

    const deploymentStatusBlock = extractIndentedBlock(onBlock, 2, 'deployment_status');
    assert.ok(
      deploymentStatusBlock.length > 0 &&
        /^\s+deployment_status:(?:\s*\{\})?\s*(?:#.*)?$/.test(deploymentStatusBlock[0]),
      'preview-smoke.yml must trigger on deployment_status',
    );
  });

  it('enforces top-level permissions: {}, single smoke job, dual trigger guard, timeout-minutes: 5, and minimal job permissions', () => {
    const workflowText = readWorkflowText();
    const lines = splitLines(workflowText);

    const topLevelPermissions = extractIndentedBlock(lines, 0, 'permissions');
    assert.strictEqual(topLevelPermissions.length, 1);
    assert.match(
      topLevelPermissions[0],
      /^permissions:\s*\{\}\s*(?:#.*)?$/,
      'Top-level permissions must be permissions: {}',
    );
    assert.strictEqual(/\bwrite-all\b/.test(workflowText), false);
    assert.strictEqual(
      lines.some((line) => !isBlankOrComment(line) && /^\s*contents:\s*(?:read|write)\b/.test(line)),
      false,
      'preview-smoke.yml must not grant contents: read or contents: write',
    );

    const concurrencyBlock = extractIndentedBlock(lines, 0, 'concurrency');
    assert.ok(
      concurrencyBlock.some((line) =>
        /^\s+group:\s*\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.event\.client_payload\.id\s*\|\|\s*github\.event\.deployment\.id\s*\|\|\s*github\.run_id\s*\}\}\s*$/.test(
          line,
        ),
      ),
      'concurrency.group must scope to workflow and client_payload.id || deployment.id || run_id',
    );
    assert.ok(
      concurrencyBlock.some((line) => /^\s+cancel-in-progress:\s*false\s*$/.test(line)),
      'concurrency.cancel-in-progress must be false',
    );

    const jobs = extractJobs(lines);
    assert.deepStrictEqual(Array.from(jobs.keys()), ['smoke']);

    const smokeJob = jobs.get('smoke');
    assert.ok(smokeJob);
    assert.ok(smokeJob.some((line) => /^    name:\s*smoke\s*$/.test(line)));

    const jobIfBlock = extractIndentedBlock(smokeJob, 4, 'if');
    assert.ok(jobIfBlock.length > 0, 'smoke job must define an if: guard');
    const normalizedJobIf = jobIfBlock
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    assert.ok(
      normalizedJobIf.includes(
        "github.event_name == 'repository_dispatch' && github.event.action == 'vercel.deployment.success'",
      ),
      'smoke job if: must guard repository_dispatch vercel.deployment.success',
    );
    assert.ok(
      normalizedJobIf.includes(
        "github.event_name == 'deployment_status' && github.event.deployment_status.state == 'success'",
      ),
      "smoke job if: must guard deployment_status state == 'success'",
    );

    assert.ok(smokeJob.some((line) => /^    runs-on:\s*ubuntu-latest\s*$/.test(line)));
    assert.ok(smokeJob.some((line) => /^    timeout-minutes:\s*5\s*$/.test(line)));

    const jobPermissionsBlock = extractIndentedBlock(smokeJob, 4, 'permissions');
    const jobPermissionEntries = jobPermissionsBlock
      .slice(1)
      .filter((line) => !isBlankOrComment(line))
      .map((line) => line.trim())
      .sort();
    assert.deepStrictEqual(jobPermissionEntries, ['deployments: read', 'statuses: write']);
  });

  it('pins actions/setup-node to a 40-char SHA for Node 24 without actions/checkout', () => {
    const lines = splitLines(readWorkflowText());
    const usesLines = extractUsesLines(lines);

    assert.strictEqual(usesLines.length, 1, 'Expected 1 uses: declaration (actions/setup-node)');
    assert.match(usesLines[0], SHA_PINNED_USES_REGEX);
    assert.strictEqual(
      usesLines[0],
      'uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0',
    );
    assert.strictEqual(
      usesLines.some((line) => line.includes('actions/checkout')),
      false,
      'preview-smoke.yml must never check out untrusted PR code',
    );

    const smokeJob = extractJobs(lines).get('smoke');
    assert.ok(smokeJob);
    const steps = extractJobSteps(smokeJob);
    const setupStep = steps.find((step) =>
      step.some((line) => /^\s+id:\s*setup-node\s*$/.test(line)),
    );
    assert.ok(setupStep);
    assert.ok(setupStep.some((line) => /^\s+node-version:\s*['"]24['"]\s*$/.test(line)));
  });

  it('wires smoke-probe, commit-status, and sanitized summary steps via env: with zero inline ${{ in run: blocks', () => {
    const lines = splitLines(readWorkflowText());
    const smokeJob = extractJobs(lines).get('smoke');
    assert.ok(smokeJob);

    const steps = extractJobSteps(smokeJob);
    assert.strictEqual(steps.length, 4, 'Expected setup-node, smoke-probe, commit-status, Summarize run');

    const probeStep = steps.find((step) =>
      step.some((line) => /^\s+id:\s*smoke-probe\s*$/.test(line)),
    );
    assert.ok(probeStep, 'Expected smoke-probe step');
    const probeEnv = extractIndentedBlock(probeStep, 8, 'env');
    assert.ok(
      probeEnv.some((line) =>
        /^\s+TARGET_URL:\s*\$\{\{\s*github\.event\.client_payload\.url\s*\|\|\s*github\.event\.deployment_status\.environment_url\s*\|\|\s*github\.event\.deployment_status\.target_url\s*\}\}\s*$/.test(
          line,
        ),
      ),
      'smoke-probe TARGET_URL must resolve client_payload.url || deployment_status.environment_url || deployment_status.target_url',
    );
    assert.ok(
      probeEnv.some((line) =>
        /^\s+VERCEL_AUTOMATION_BYPASS_SECRET:\s*\$\{\{\s*secrets\.VERCEL_AUTOMATION_BYPASS_SECRET\s*\}\}\s*$/.test(
          line,
        ),
      ),
      'smoke-probe must pass VERCEL_AUTOMATION_BYPASS_SECRET via env:',
    );
    const probeRuns = extractRunBlocks(probeStep);
    assert.strictEqual(probeRuns.length, 1);
    assert.match(probeRuns[0].content, /node\s+--input-type=module\s+<<'EOF'/);

    const commitStatusStep = steps.find((step) =>
      step.some((line) => /^\s+id:\s*commit-status\s*$/.test(line)),
    );
    assert.ok(commitStatusStep, 'Expected commit-status step');
    assert.ok(
      commitStatusStep.some((line) => /^\s+if:\s*success\(\)\s*\|\|\s*failure\(\)\s*$/.test(line)),
      'commit-status step must set if: success() || failure()',
    );
    const statusEnv = extractIndentedBlock(commitStatusStep, 8, 'env');
    assert.ok(
      statusEnv.some((line) =>
        /^\s+DEPLOYMENT_SHA:\s*\$\{\{\s*github\.event\.client_payload\.git\.sha\s*\|\|\s*github\.event\.deployment\.sha\s*\}\}\s*$/.test(
          line,
        ),
      ),
      'commit-status DEPLOYMENT_SHA must resolve client_payload.git.sha || deployment.sha via env:',
    );
    const statusRuns = extractRunBlocks(commitStatusStep);
    assert.strictEqual(statusRuns.length, 1);
    assert.match(statusRuns[0].content, /node\s+--input-type=module\s+<<'EOF'/);
    assert.ok(statusRuns[0].content.includes('/statuses/'));
    assert.match(statusRuns[0].content, /context:\s*['"]smoke['"]/);

    const summarySteps = steps.filter((step) =>
      extractRunBlocks(step).some((runBlock) => runBlock.content.includes('$GITHUB_STEP_SUMMARY')),
    );
    assert.strictEqual(summarySteps.length, 1, 'Expected 1 step writing $GITHUB_STEP_SUMMARY');
    const summaryStep = summarySteps[0];
    assert.ok(summaryStep.some((line) => /^\s+if:\s*always\(\)\s*$/.test(line)));

    const summaryEnv = extractIndentedBlock(summaryStep, 8, 'env');
    assert.ok(summaryEnv.length >= 2 && summaryEnv.slice(1).some((line) => /\$\{\{/.test(line)));
    assert.ok(summaryEnv.some((line) => /^\s+EVENT_ACTION:\s*/.test(line)));
    assert.ok(summaryEnv.some((line) => /^\s+DEPLOYMENT_ENVIRONMENT:\s*/.test(line)));
    assert.ok(summaryEnv.some((line) => /^\s+DEPLOYMENT_STATE:\s*/.test(line)));
    assert.ok(summaryEnv.some((line) => /^\s+DEPLOYMENT_SHA:\s*/.test(line)));

    const summaryRuns = extractRunBlocks(summaryStep);
    assert.strictEqual(summaryRuns.length, 1);
    assert.match(summaryRuns[0].content, /sanitize_cell\s*\(\)/);
    assert.ok(summaryRuns[0].content.includes('$(sanitize_cell '));

    const summaryText = summaryStep.join('\n');
    assert.strictEqual(summaryText.includes('VERCEL_AUTOMATION_BYPASS_SECRET'), false);
    assert.strictEqual(summaryText.includes('GITHUB_TOKEN'), false);
    assert.ok(summaryText.includes('Preview Smoke Summary'));

    const allRunBlocks = extractRunBlocks(lines);
    assert.strictEqual(allRunBlocks.length, 3);
    for (const runBlock of allRunBlocks) {
      assert.strictEqual(
        runBlock.content.includes('${{'),
        false,
        `run: block starting at line ${runBlock.lineNumber} must not inline \${{ ... }} expressions`,
      );
    }
  });
});

describe('Suite B: Embedded smoke-probe script offline execution (mocked fetch)', () => {
  const scriptSource = extractEmbeddedNodeScript(readWorkflowText(), 'smoke-probe');

  it('rejects disallowed, spoofed, non-HTTPS, userinfo, custom-port, and empty TARGET_URLs before any fetch', () => {
    const rejectedTargets: Array<string | undefined> = [
      'http://eshop.vercel.app',
      'https://evil.com',
      'https://vercel.app.evil.com',
      'https://vercel.app',
      'https://eshop.vercel.app@evil.com',
      'https://eshop.vercel.app:8443',
      '',
      '   ',
      undefined,
    ];

    for (const targetUrl of rejectedTargets) {
      const res = runEmbeddedSmokeProbe({
        scriptSource,
        targetUrl,
        bypassSecret: 'top-secret-bypass-value',
        mockSteps: [],
      });

      assert.notStrictEqual(
        res.exitCode,
        0,
        `Expected non-zero exit for disallowed TARGET_URL "${String(targetUrl)}"`,
      );
      assert.strictEqual(
        res.fetchCalls.length,
        0,
        `Expected zero fetch calls for disallowed TARGET_URL "${String(targetUrl)}"`,
      );
      assert.strictEqual(res.unexpectedCallError, null);
      assert.strictEqual(res.stdout.includes('top-secret-bypass-value'), false);
      assert.strictEqual(res.stderr.includes('top-secret-bypass-value'), false);
      assert.strictEqual((res.outputs.detail ?? '').includes('top-secret-bypass-value'), false);
    }
  });

  it('passes happy path for *.vercel.app, sends x-vercel-protection-bypass, uses redirect: manual, and writes outputs', () => {
    const bypassSecret = 'vercel-bypass-secret-123';
    const res = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app/ignored?foo=bar',
      deploymentEnvironment: 'Preview',
      bypassSecret,
      mockSteps: [
        {
          type: 'response',
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
          body: '<!doctype html><html><body>OK</body></html>',
        },
        {
          type: 'response',
          status: 400,
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            error: 'Prieiga prie privačių ar rezervuotų IP adresų draudžiama (SSRF apsauga).',
          }),
        },
      ],
    });

    assert.strictEqual(res.exitCode, 0, `Expected exit 0, stderr: ${res.stderr}`);
    assert.strictEqual(res.unexpectedCallError, null);
    assert.strictEqual(res.fetchCalls.length, 2);

    const [homeCall, ssrfCall] = res.fetchCalls;
    assert.strictEqual(homeCall.method, 'GET');
    assert.strictEqual(homeCall.url, 'https://eshop-trust-checker-pr-15.vercel.app/');
    assert.strictEqual(homeCall.redirect, 'manual');
    assert.strictEqual(homeCall.hasSignal, true);
    assert.strictEqual(homeCall.headers['x-vercel-protection-bypass'], bypassSecret);

    assert.strictEqual(ssrfCall.method, 'POST');
    assert.strictEqual(ssrfCall.url, 'https://eshop-trust-checker-pr-15.vercel.app/api/check');
    assert.strictEqual(ssrfCall.redirect, 'manual');
    assert.strictEqual(ssrfCall.hasSignal, true);
    assert.strictEqual(ssrfCall.headers['x-vercel-protection-bypass'], bypassSecret);
    assert.strictEqual(ssrfCall.headers['content-type'], 'application/json');
    assert.deepStrictEqual(JSON.parse(ssrfCall.body ?? '{}'), { query: 'http://127.0.0.1' });

    assert.deepStrictEqual(res.outputs, {
      validated_origin: 'https://eshop-trust-checker-pr-15.vercel.app',
      home_status: '200',
      ssrf_status: '400',
      detail: 'Preview smoke checks passed (GET / 200, POST /api/check SSRF 400).',
    });
    assert.strictEqual(res.stdout.includes(bypassSecret), false);
    assert.strictEqual(res.stderr.includes(bypassSecret), false);
  });

  it('isolates Vercel bypass secret so x-vercel-protection-bypass is never sent to *.netlify.app', () => {
    const bypassSecret = 'vercel-bypass-secret-123';
    const res = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://deploy-preview-15--eshop.netlify.app',
      deploymentEnvironment: 'Preview',
      bypassSecret,
      mockSteps: [
        {
          type: 'response',
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html>OK</html>',
        },
        {
          type: 'response',
          status: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: 'Neteisingas domenas (SSRF apsauga).' }),
        },
      ],
    });

    assert.strictEqual(res.exitCode, 0, `Expected exit 0, stderr: ${res.stderr}`);
    assert.strictEqual(res.unexpectedCallError, null);
    assert.strictEqual(res.fetchCalls.length, 2);

    for (const call of res.fetchCalls) {
      assert.strictEqual(
        'x-vercel-protection-bypass' in call.headers,
        false,
        `Did not expect x-vercel-protection-bypass header on Netlify request (${call.url})`,
      );
      assert.strictEqual(call.redirect, 'manual');
    }

    assert.strictEqual(res.outputs.validated_origin, 'https://deploy-preview-15--eshop.netlify.app');
    assert.strictEqual(res.outputs.home_status, '200');
    assert.strictEqual(res.outputs.ssrf_status, '400');
  });

  it('isolates Vercel bypass secret from unrelated *.vercel.app projects', () => {
    const bypassSecret = 'vercel-bypass-secret-123';
    const res = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://other-project.vercel.app',
      deploymentEnvironment: 'Preview',
      bypassSecret,
      mockSteps: [
        {
          type: 'response',
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html>OK</html>',
        },
        {
          type: 'response',
          status: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: 'SSRF apsauga' }),
        },
      ],
    });

    assert.strictEqual(res.exitCode, 0, `Expected exit 0, stderr: ${res.stderr}`);
    assert.strictEqual(res.unexpectedCallError, null);
    assert.strictEqual(res.fetchCalls.length, 2);

    for (const call of res.fetchCalls) {
      assert.strictEqual(
        'x-vercel-protection-bypass' in call.headers,
        false,
        `Did not expect x-vercel-protection-bypass header on unrelated Vercel host (${call.url})`,
      );
      assert.strictEqual(call.redirect, 'manual');
    }

    assert.strictEqual(res.outputs.validated_origin, 'https://other-project.vercel.app');
  });

  it('prevents false passes on proxy 400 HTML (checking Content-Type before body read), malformed JSON, generic 400 JSON, and SSRF 200 regression', () => {
    const html400 = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app',
      mockSteps: [
        {
          type: 'response',
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html>OK</html>',
        },
        {
          type: 'response',
          status: 400,
          headers: { 'content-type': 'text/html; charset=utf-8' },
          body: '<html><body>400 Bad Request</body></html>',
          failOnBodyRead: true,
        },
      ],
    });

    assert.notStrictEqual(html400.exitCode, 0);
    assert.strictEqual(html400.unexpectedCallError, null);
    assert.strictEqual(html400.outputs.ssrf_status, '400');
    assert.match(html400.outputs.detail ?? '', /application\/json.*"text\/html"/i);

    const malformedJson400 = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app',
      mockSteps: [
        {
          type: 'response',
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html>OK</html>',
        },
        {
          type: 'response',
          status: 400,
          headers: { 'content-type': 'application/json' },
          body: '{not-json',
        },
      ],
    });

    assert.notStrictEqual(malformedJson400.exitCode, 0);
    assert.strictEqual(malformedJson400.unexpectedCallError, null);
    assert.strictEqual(malformedJson400.outputs.ssrf_status, '400');
    assert.match(malformedJson400.outputs.detail ?? '', /invalid json/i);

    const genericJson400 = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app',
      mockSteps: [
        {
          type: 'response',
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html>OK</html>',
        },
        {
          type: 'response',
          status: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: 'Bad request' }),
        },
      ],
    });

    assert.notStrictEqual(genericJson400.exitCode, 0);
    assert.strictEqual(genericJson400.unexpectedCallError, null);
    assert.strictEqual(genericJson400.outputs.ssrf_status, '400');
    assert.match(genericJson400.outputs.detail ?? '', /ssrf/i);

    const ssrfRegression200 = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app',
      mockSteps: [
        {
          type: 'response',
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html>OK</html>',
        },
        {
          type: 'response',
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ trustScore: 80 }),
        },
      ],
    });

    assert.notStrictEqual(ssrfRegression200.exitCode, 0);
    assert.strictEqual(ssrfRegression200.unexpectedCallError, null);
    assert.strictEqual(ssrfRegression200.outputs.ssrf_status, '200');
    assert.match(ssrfRegression200.outputs.detail ?? '', /expected HTTP 400.*got 200/i);
  });

  it('fails fast on 3xx redirects with Deployment Protection hint and fails on GET / 500', () => {
    const redirect307 = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app',
      mockSteps: [
        {
          type: 'response',
          status: 307,
          headers: { location: 'https://vercel.com/login?token=sensitive' },
        },
      ],
    });

    assert.notStrictEqual(redirect307.exitCode, 0);
    assert.strictEqual(redirect307.unexpectedCallError, null);
    assert.strictEqual(redirect307.fetchCalls.length, 1);
    assert.strictEqual(redirect307.fetchCalls[0].redirect, 'manual');
    assert.strictEqual(redirect307.outputs.home_status, '307');
    assert.match(redirect307.outputs.detail ?? '', /Deployment Protection/);
    assert.match(redirect307.outputs.detail ?? '', /VERCEL_AUTOMATION_BYPASS_SECRET/);
    assert.strictEqual((redirect307.outputs.detail ?? '').includes('token=sensitive'), false);

    const home500 = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app',
      mockSteps: [{ type: 'response', status: 500, body: 'Internal Server Error' }],
    });

    assert.notStrictEqual(home500.exitCode, 0);
    assert.strictEqual(home500.unexpectedCallError, null);
    assert.strictEqual(home500.fetchCalls.length, 1);
    assert.strictEqual(home500.outputs.home_status, '500');
    assert.match(home500.outputs.detail ?? '', /expected HTTP 200, got 500/i);
  });

  it('retries transient 503/network errors, exhausts after 5 attempts, and fails fast on 401/403 without leaking secret', () => {
    const retry503 = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app',
      mockSteps: [
        { type: 'response', status: 503, body: 'Service Unavailable' },
        { type: 'response', status: 200, headers: { 'content-type': 'text/html' }, body: 'OK' },
        {
          type: 'response',
          status: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: 'SSRF apsauga' }),
        },
      ],
    });

    assert.strictEqual(retry503.exitCode, 0, `Expected retry 503->200 to pass: ${retry503.stderr}`);
    assert.strictEqual(retry503.unexpectedCallError, null);
    assert.strictEqual(retry503.fetchCalls.length, 3);
    assert.strictEqual(retry503.outputs.home_status, '200');
    assert.strictEqual(retry503.outputs.ssrf_status, '400');

    const retryThrown = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app',
      mockSteps: [
        { type: 'throw', message: 'ECONNRESET' },
        { type: 'response', status: 200, headers: { 'content-type': 'text/html' }, body: 'OK' },
        {
          type: 'response',
          status: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: 'SSRF apsauga' }),
        },
      ],
    });

    assert.strictEqual(
      retryThrown.exitCode,
      0,
      `Expected retry after transient throw to pass: ${retryThrown.stderr}`,
    );
    assert.strictEqual(retryThrown.unexpectedCallError, null);
    assert.strictEqual(retryThrown.fetchCalls.length, 3);

    const exhausted503 = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app',
      mockSteps: Array.from({ length: 5 }, () => ({
        type: 'response' as const,
        status: 503,
        body: 'Service Unavailable',
      })),
    });

    assert.notStrictEqual(exhausted503.exitCode, 0);
    assert.strictEqual(exhausted503.unexpectedCallError, null);
    assert.strictEqual(exhausted503.fetchCalls.length, 5);
    assert.strictEqual(exhausted503.outputs.home_status, '503');

    const secret = 'very-sensitive-bypass-secret-value';
    const failFast401 = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app',
      bypassSecret: secret,
      mockSteps: [{ type: 'response', status: 401, body: 'Unauthorized' }],
    });

    assert.notStrictEqual(failFast401.exitCode, 0);
    assert.strictEqual(failFast401.unexpectedCallError, null);
    assert.strictEqual(failFast401.fetchCalls.length, 1, 'HTTP 401 must fail fast without retrying');
    assert.match(failFast401.stderr, /VERCEL_AUTOMATION_BYPASS_SECRET/);
    assert.strictEqual(failFast401.stdout.includes(secret), false);
    assert.strictEqual(failFast401.stderr.includes(secret), false);
    assert.strictEqual((failFast401.outputs.detail ?? '').includes(secret), false);

    const failFast403 = runEmbeddedSmokeProbe({
      scriptSource,
      targetUrl: 'https://eshop-trust-checker-pr-15.vercel.app',
      bypassSecret: undefined,
      mockSteps: [{ type: 'response', status: 403, body: 'Forbidden' }],
    });

    assert.notStrictEqual(failFast403.exitCode, 0);
    assert.strictEqual(failFast403.unexpectedCallError, null);
    assert.strictEqual(failFast403.fetchCalls.length, 1, 'HTTP 403 must fail fast without retrying');
    assert.match(failFast403.stderr, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  });
});

describe('Suite C: Embedded commit-status script offline execution (mocked fetch)', () => {
  const scriptSource = extractEmbeddedNodeScript(readWorkflowText(), 'commit-status');
  const validSha = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  const validRepo = 'tommardev/eshop-trust-checker';
  const validRunUrl = 'https://github.com/tommardev/eshop-trust-checker/actions/runs/123456';

  it('publishes success commit status with Authorization header, context smoke, and target_url', () => {
    const token = 'ghs_mock_token_success_123';
    const res = runEmbeddedCommitStatus({
      scriptSource,
      githubToken: token,
      githubRepository: validRepo,
      deploymentSha: validSha,
      runUrl: validRunUrl,
      smokeOutcome: 'success',
      smokeDetail: 'Preview smoke checks passed (GET / 200, POST /api/check SSRF 400).',
      mockSteps: [{ type: 'response', status: 201, body: '{}' }],
    });

    assert.strictEqual(res.exitCode, 0, `Expected exit 0, stderr: ${res.stderr}`);
    assert.strictEqual(res.unexpectedCallError, null);
    assert.strictEqual(res.fetchCalls.length, 1);

    const call = res.fetchCalls[0];
    assert.strictEqual(call.method, 'POST');
    assert.strictEqual(
      call.url,
      `https://api.github.com/repos/${validRepo}/statuses/${validSha}`,
    );
    assert.strictEqual(call.headers.authorization, `Bearer ${token}`);
    assert.strictEqual(call.hasSignal, true);

    const payload = JSON.parse(call.body ?? '{}') as Record<string, string>;
    assert.deepStrictEqual(payload, {
      state: 'success',
      context: 'smoke',
      description: 'Preview smoke checks passed (GET / 200, POST /api/check SSRF 400).',
      target_url: validRunUrl,
    });
  });

  it('publishes failure commit status and truncates detail longer than 140 chars to 140 ending with ...', () => {
    const longDetail = 'X'.repeat(180);
    const res = runEmbeddedCommitStatus({
      scriptSource,
      githubToken: 'ghs_mock_token_failure_123',
      githubRepository: validRepo,
      deploymentSha: validSha,
      runUrl: validRunUrl,
      smokeOutcome: 'failure',
      smokeDetail: longDetail,
      mockSteps: [{ type: 'response', status: 201, body: '{}' }],
    });

    assert.strictEqual(res.exitCode, 0, `Expected exit 0, stderr: ${res.stderr}`);
    assert.strictEqual(res.unexpectedCallError, null);
    assert.strictEqual(res.fetchCalls.length, 1);

    const payload = JSON.parse(res.fetchCalls[0].body ?? '{}') as Record<string, string>;
    assert.strictEqual(payload.state, 'failure');
    assert.strictEqual(payload.context, 'smoke');
    assert.strictEqual(payload.description.length, 140);
    assert.ok(payload.description.endsWith('...'));
    assert.strictEqual(payload.description, `${'X'.repeat(137)}...`);
  });

  it('publishes error commit status with setup-failed fallback when smoke-probe outcome is skipped', () => {
    const res = runEmbeddedCommitStatus({
      scriptSource,
      githubToken: 'ghs_mock_token_skipped_123',
      githubRepository: validRepo,
      deploymentSha: validSha,
      runUrl: validRunUrl,
      smokeOutcome: 'skipped',
      smokeDetail: '',
      mockSteps: [{ type: 'response', status: 201, body: '{}' }],
    });

    assert.strictEqual(res.exitCode, 0, `Expected exit 0, stderr: ${res.stderr}`);
    assert.strictEqual(res.unexpectedCallError, null);
    assert.strictEqual(res.fetchCalls.length, 1);

    const payload = JSON.parse(res.fetchCalls[0].body ?? '{}') as Record<string, string>;
    assert.strictEqual(payload.state, 'error');
    assert.strictEqual(payload.context, 'smoke');
    assert.match(payload.description, /setup failed/i);
  });

  it('rejects invalid DEPLOYMENT_SHA and invalid GITHUB_REPOSITORY before issuing fetch', () => {
    const invalidInputs = [
      { repo: validRepo, sha: 'not-a-sha' },
      { repo: validRepo, sha: 'a1b2c3' },
      { repo: validRepo, sha: '' },
      { repo: 'invalid-repo-without-slash', sha: validSha },
      { repo: 'owner/repo/extra', sha: validSha },
      { repo: '', sha: validSha },
    ];

    for (const entry of invalidInputs) {
      const res = runEmbeddedCommitStatus({
        scriptSource,
        githubToken: 'ghs_mock_token_invalid_123',
        githubRepository: entry.repo,
        deploymentSha: entry.sha,
        runUrl: validRunUrl,
        smokeOutcome: 'success',
        smokeDetail: 'OK',
        mockSteps: [],
      });

      assert.notStrictEqual(
        res.exitCode,
        0,
        `Expected non-zero exit for repo="${entry.repo}" sha="${entry.sha}"`,
      );
      assert.strictEqual(res.fetchCalls.length, 0);
      assert.strictEqual(res.unexpectedCallError, null);
    }
  });

  it('fails non-zero cleanly on non-2xx GitHub API responses without leaking GITHUB_TOKEN', () => {
    const secretToken = 'ghs_super_secret_github_token_999';

    for (const status of [422, 500]) {
      const res = runEmbeddedCommitStatus({
        scriptSource,
        githubToken: secretToken,
        githubRepository: validRepo,
        deploymentSha: validSha,
        runUrl: validRunUrl,
        smokeOutcome: 'success',
        smokeDetail: 'OK',
        mockSteps: [
          {
            type: 'response',
            status,
            body: `GitHub API error echoing ${secretToken}`,
          },
        ],
      });

      assert.notStrictEqual(res.exitCode, 0, `Expected non-zero exit for HTTP ${status}`);
      assert.strictEqual(res.unexpectedCallError, null);
      assert.strictEqual(res.fetchCalls.length, 1);
      assert.match(res.stderr, new RegExp(`HTTP ${status}`));
      assert.strictEqual(res.stdout.includes(secretToken), false);
      assert.strictEqual(res.stderr.includes(secretToken), false);
    }
  });
});

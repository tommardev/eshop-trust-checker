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

function extractSmokeProbeScript(): string {
  const lines = splitLines(readWorkflowText());
  const jobs = extractJobs(lines);
  const smokeJob = jobs.get('smoke');
  assert.ok(smokeJob, 'Expected smoke job to exist');

  const steps = extractJobSteps(smokeJob);
  const probeStep = steps.find((step) =>
    step.some((line) => /^\s+id:\s*smoke-probe\s*$/.test(line)),
  );
  assert.ok(probeStep, 'Expected smoke-probe step to exist');

  const runBlocks = extractRunBlocks(probeStep);
  assert.strictEqual(runBlocks.length, 1, 'Expected smoke-probe step to have 1 run: block');

  const runLines = splitLines(runBlocks[0].content);
  const startIdx = runLines.findIndex((line) => /^\s*node\s+<<\s*'EOF'\s*$/.test(line));
  assert.notStrictEqual(startIdx, -1, "Expected node <<'EOF' in smoke-probe run block");

  const endIdx = runLines.findIndex(
    (line, index) => index > startIdx && /^\s*EOF\s*$/.test(line),
  );
  assert.notStrictEqual(endIdx, -1, 'Expected closing EOF in smoke-probe run block');

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

function runEmbeddedSmokeProbe(options: {
  scriptSource: string;
  targetUrl?: string;
  deploymentEnvironment?: string;
  bypassSecret?: string;
  mockSteps: MockFetchStep[];
}): ProbeExecutionResult {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'preview-smoke-probe-'));
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
      '  return new Response(step.body ?? null, {',
      '    status: step.status,',
      '    headers: step.headers ?? {},',
      '  });',
      '};',
      `const __scriptBase64 = ${JSON.stringify(scriptBase64)};`,
      "await import('data:text/javascript;base64,' + __scriptBase64);",
    ].join('\n');

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      GITHUB_OUTPUT: outputPath,
      SMOKE_BACKOFF_MS: '0,0,0,0',
    };

    if (options.targetUrl === undefined) {
      delete childEnv.TARGET_URL;
    } else {
      childEnv.TARGET_URL = options.targetUrl;
    }

    if (options.deploymentEnvironment === undefined) {
      delete childEnv.DEPLOYMENT_ENVIRONMENT;
    } else {
      childEnv.DEPLOYMENT_ENVIRONMENT = options.deploymentEnvironment;
    }

    if (options.bypassSecret === undefined) {
      delete childEnv.VERCEL_AUTOMATION_BYPASS_SECRET;
    } else {
      childEnv.VERCEL_AUTOMATION_BYPASS_SECRET = options.bypassSecret;
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

describe('Suite A: .github/workflows/preview-smoke.yml YAML & hardening contract', () => {
  it('exists, uses spaces without tabs, names Preview Smoke Check, and triggers only on deployment_status', () => {
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

    const deploymentStatusBlock = extractIndentedBlock(onBlock, 2, 'deployment_status');
    assert.ok(
      deploymentStatusBlock.length > 0 &&
        /^\s+deployment_status:(?:\s*\{\})?\s*(?:#.*)?$/.test(deploymentStatusBlock[0]),
      'preview-smoke.yml must trigger on deployment_status',
    );

    const activeOnEntries = onBlock.slice(1).filter((line) => !isBlankOrComment(line));
    assert.strictEqual(
      activeOnEntries.length,
      1,
      'preview-smoke.yml on: block must only define deployment_status',
    );
  });

  it('enforces top-level permissions: {}, single smoke job, timeout-minutes: 5, and minimal job permissions', () => {
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
        /^\s+group:\s*\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.event\.deployment\.id\s*\}\}\s*$/.test(
          line,
        ),
      ),
      'concurrency.group must scope to workflow and deployment.id',
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
    assert.ok(
      smokeJob.some((line) =>
        /^    if:\s*github\.event\.deployment_status\.state\s*==\s*'success'\s*$/.test(line),
      ),
      "smoke job must guard on github.event.deployment_status.state == 'success'",
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

  it('wires smoke-probe, commit-status, and summary steps via env: with zero inline ${{ in run: blocks', () => {
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
      probeEnv.some(
        (line) =>
          /^\s+TARGET_URL:\s*/.test(line) &&
          line.includes('github.event.deployment_status.target_url'),
      ),
      'smoke-probe must pass TARGET_URL referencing github.event.deployment_status.target_url via env:',
    );
    assert.ok(
      probeEnv.some((line) =>
        /^\s+VERCEL_AUTOMATION_BYPASS_SECRET:\s*\$\{\{\s*secrets\.VERCEL_AUTOMATION_BYPASS_SECRET\s*\}\}\s*$/.test(
          line,
        ),
      ),
      'smoke-probe must pass VERCEL_AUTOMATION_BYPASS_SECRET via env:',
    );

    const commitStatusStep = steps.find((step) =>
      step.some((line) => /^\s+id:\s*commit-status\s*$/.test(line)),
    );
    assert.ok(commitStatusStep, 'Expected commit-status step');
    assert.ok(
      commitStatusStep.some((line) => /^\s+if:\s*always\(\)\s*$/.test(line)),
      'commit-status step must set if: always()',
    );
    const statusEnv = extractIndentedBlock(commitStatusStep, 8, 'env');
    assert.ok(
      statusEnv.some((line) =>
        /^\s+DEPLOYMENT_SHA:\s*\$\{\{\s*github\.event\.deployment\.sha\s*\}\}\s*$/.test(line),
      ),
      'commit-status must pass DEPLOYMENT_SHA: ${{ github.event.deployment.sha }} via env:',
    );
    const statusRuns = extractRunBlocks(commitStatusStep);
    assert.strictEqual(statusRuns.length, 1);
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
  const scriptSource = extractSmokeProbeScript();

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

  it('prevents false passes on proxy 400 HTML responses and generic 400 JSON lacking ssrf', () => {
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
          headers: { 'content-type': 'text/html' },
          body: '<html><body>400 Bad Request</body></html>',
        },
      ],
    });

    assert.notStrictEqual(html400.exitCode, 0);
    assert.strictEqual(html400.unexpectedCallError, null);
    assert.strictEqual(html400.outputs.ssrf_status, '400');
    assert.match(html400.outputs.detail ?? '', /application\/json/i);

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
  });

  it('retries transient 503/network errors and fails fast on 401 without leaking secret', () => {
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
  });
});

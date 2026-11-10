import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
import { validateOp, type Op } from '../engine/index.ts';
import type { AgentRunners, TextAgentInput, TextAgentResult } from './agent-proposals.ts';

const MAX_OUTPUT = 2 * 1024 * 1024;
const TIMEOUT_MS = 3 * 60 * 1000;

export interface CommandInvocation {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
  env?: NodeJS.ProcessEnv;
  shell: false;
  signal: AbortSignal;
}

export interface CommandResult { stdout: string; stderr: string }

export interface LocalAgentOptions {
  available?: (command: string) => Promise<boolean>;
  run?: (invocation: CommandInvocation) => Promise<CommandResult>;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', minLength: 1, maxLength: 500 },
    ops: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object' } },
  },
  required: ['summary', 'ops'],
};

async function commandAvailable(command: string): Promise<boolean> {
  const path = process.env.PATH ?? '';
  for (const dir of path.split(delimiter)) {
    if (!dir) continue;
    try { await access(join(dir, command), constants.X_OK); return true; } catch { /* keep looking */ }
  }
  return false;
}

function runCommand(invocation: CommandInvocation): Promise<CommandResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      env: invocation.env,
      shell: invocation.shell,
      stdio: ['pipe', 'pipe', 'pipe'],
      signal: invocation.signal,
    });
    let stdout = '';
    let stderr = '';
    const collect = (target: 'stdout' | 'stderr', chunk: Buffer) => {
      if (target === 'stdout') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
      if (stdout.length + stderr.length > MAX_OUTPUT) child.kill('SIGTERM');
    };
    child.stdout.on('data', (chunk: Buffer) => collect('stdout', chunk));
    child.stderr.on('data', (chunk: Buffer) => collect('stderr', chunk));
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (stdout.length + stderr.length > MAX_OUTPUT) return reject(new Error('AI process output exceeded 2 MB'));
      if (code !== 0) return reject(new Error(`AI process failed (${signal ?? code}): ${stderr.slice(-2000)}`));
      resolveResult({ stdout, stderr });
    });
    child.stdin.end(invocation.stdin);
  });
}

function responseObject(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (record.structured_output !== undefined) return record.structured_output;
  if (typeof record.result === 'string') {
    try { return JSON.parse(record.result); } catch { return record.result; }
  }
  return value;
}

export function parseAgentResponse(output: string): TextAgentResult {
  let parsed: unknown;
  try { parsed = responseObject(JSON.parse(output.trim())); }
  catch { throw new Error('the agent did not return valid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('the agent response must be a JSON object');
  const value = parsed as Record<string, unknown>;
  if (typeof value.summary !== 'string' || value.summary.trim() === '' || value.summary.length > 500) {
    throw new Error('the agent response has an invalid summary');
  }
  if (!Array.isArray(value.ops) || value.ops.length === 0 || value.ops.length > 50) {
    throw new Error('the agent response has an invalid operations list');
  }
  for (const op of value.ops) validateOp(op);
  return { summary: value.summary.trim(), ops: value.ops as Op[] };
}

function promptFor(input: TextAgentInput): string {
  const selection = input.selection;
  return [
    'You are editing one selected element in a Nevermind Studio HTML slide deck.',
    'Work only in this temporary directory. Do not edit any repository or user file.',
    'Use the supplied nm-studio CLI as your tool: run `./nm-studio inspect deck.html --slide ' + selection.slide + ' --depth 8`,',
    'check candidate operations by piping them on stdin: `./nm-studio apply deck.html - --dry-run <<\'EOF\'` ... `EOF`, and run `./nm-studio lint deck.html`.',
    'Your shell can run only ./nm-studio; nothing else is permitted.',
    'Return only JSON matching schema.json. Do not wrap it in Markdown.',
    'Allowed operations: setText, setAttr, setUtility, setClasses, setStyle.',
    `Every operation must target numeric source id ${selection.id}. Do not use structural operations or setToken.`,
    `Selection context: ${JSON.stringify({ id: selection.id, key: selection.key, slide: selection.slide, tag: selection.tag, role: selection.role, text: selection.text, classes: selection.classes, html: selection.html }, null, 2)}`,
    `User request: ${input.prompt}`,
  ].join('\n');
}

async function writeCliShim(dir: string): Promise<void> {
  const cliPath = resolve(process.argv[1]);
  const shim = join(dir, 'nm-studio');
  const execArgs = process.execArgv.filter((arg) => arg !== '--inspect' && !arg.startsWith('--inspect=')).map((arg) => JSON.stringify(arg)).join(', ');
  const source = `#!/usr/bin/env node\nimport { spawnSync } from 'node:child_process';\nconst result = spawnSync(${JSON.stringify(process.execPath)}, [${execArgs}${execArgs ? ', ' : ''}${JSON.stringify(cliPath)}, ...process.argv.slice(2)], { stdio: 'inherit' });\nprocess.exit(result.status ?? 1);\n`;
  await writeFile(shim, source, 'utf8');
  await chmod(shim, 0o700);
}

/** The only shell command the in-editor agent may run without asking: the nm-studio shim in its temp dir.
 *  Unrestricted `Bash` under dontAsk would let a request run anything on the user's machine. */
export const AGENT_TOOL_RULE = 'Bash(./nm-studio:*)';

export function createLocalAgentRunners(options: LocalAgentOptions = {}): AgentRunners {
  const available = options.available ?? commandAvailable;
  const run = options.run ?? runCommand;
  return {
    async text(input, outerSignal) {
      const dir = await mkdtemp(join(tmpdir(), 'nm-studio-ai-'));
      const controller = new AbortController();
      const abort = () => controller.abort(outerSignal.reason);
      outerSignal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(new Error('AI request timed out')), TIMEOUT_MS);
      timer.unref();
      try {
        await Promise.all([
          writeFile(join(dir, 'deck.html'), input.selection.source, 'utf8'),
          writeFile(join(dir, 'schema.json'), JSON.stringify(RESPONSE_SCHEMA), 'utf8'),
          writeCliShim(dir),
        ]);
        const prompt = promptFor(input);
        const env = { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ''}` };
        let invocation: CommandInvocation;
        if (await available('claude')) {
          invocation = {
            command: 'claude',
            args: ['-p', '--bare', '--restricted', '--no-session-persistence', '--permission-mode', 'dontAsk', '--allowedTools', AGENT_TOOL_RULE, '--json-schema', JSON.stringify(RESPONSE_SCHEMA), '--output-format', 'json'],
            cwd: dir, stdin: prompt, env, shell: false, signal: controller.signal,
          };
        } else if (await available('codex')) {
          invocation = {
            command: 'codex',
            args: ['exec', '--skip-git-repo-check', '--ephemeral', '-C', dir, '-s', 'workspace-write', '--output-schema', join(dir, 'schema.json'), '--color', 'never', '-'],
            cwd: dir, stdin: prompt, env, shell: false, signal: controller.signal,
          };
        } else {
          throw new Error('install or sign in to Claude Code or Codex CLI before using AI requests');
        }
        return parseAgentResponse((await run(invocation)).stdout);
      } finally {
        clearTimeout(timer);
        outerSignal.removeEventListener('abort', abort);
        await rm(dir, { recursive: true, force: true });
      }
    },
    async image(input, outerSignal) {
      const controller = new AbortController();
      const abort = () => controller.abort(outerSignal.reason);
      outerSignal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(new Error('image request timed out')), TIMEOUT_MS);
      timer.unref();
      const args = [input.outputPath, input.prompt, ...(input.referencePath ? [input.referencePath] : [])];
      try {
        await run({
          command: join(homedir(), '.claude', 'scripts', 'codex_image.sh'),
          args,
          cwd: dirname(input.outputPath),
          stdin: '',
          env: process.env,
          shell: false,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
        outerSignal.removeEventListener('abort', abort);
      }
    },
  };
}

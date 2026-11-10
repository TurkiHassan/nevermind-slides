import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createLocalAgentRunners, parseAgentResponse, type CommandInvocation } from '../../src/server/local-agent-runner.ts';
import type { AgentSelectionSnapshot } from '../../src/server/agent-proposals.ts';

const selection: AgentSelectionSnapshot = {
  baseVersion: 4,
  deckPath: '/work/deck.html',
  source: '<section class="slide"><p>قديم</p></section>\n',
  key: 'n5',
  id: 4,
  slide: 1,
  tag: 'p',
  role: 'text',
  text: 'قديم',
  classes: [],
  html: '<p>قديم</p>',
};

describe('local AI agent runner', () => {
  it('runs Claude with structured output, selection context, and nm-studio as the only edit contract', async () => {
    const calls: CommandInvocation[] = [];
    const runners = createLocalAgentRunners({
      available: async (command) => command === 'claude',
      run: async (invocation) => {
        calls.push(invocation);
        return { stdout: JSON.stringify({ structured_output: { summary: 'غيّر النص', ops: [{ kind: 'setText', id: 4, text: 'جديد' }] } }), stderr: '' };
      },
    });

    const result = await runners.text({ prompt: 'غيّر النص', selection }, new AbortController().signal);

    expect(result).toEqual({ summary: 'غيّر النص', ops: [{ kind: 'setText', id: 4, text: 'جديد' }] });
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe('claude');
    expect(calls[0].args).toEqual(expect.arrayContaining(['-p', '--bare', '--no-session-persistence', '--permission-mode', 'dontAsk', '--allowedTools', 'Bash(./nm-studio:*)', '--output-format', 'json']));
    // Unrestricted shell access must never be granted under dontAsk.
    expect(calls[0].args).not.toContain('Bash');
    expect(calls[0].args.join(' ')).not.toContain('غيّر النص');
    expect(calls[0].stdin).toContain('nm-studio inspect');
    expect(calls[0].stdin).toContain('nm-studio apply');
    expect(calls[0].stdin).toContain('"id": 4');
    expect(calls[0].stdin).toContain('غيّر النص');
    expect(calls[0].shell).toBe(false);
  });

  it('falls back to codex exec and parses a plain structured response', async () => {
    const calls: CommandInvocation[] = [];
    const runners = createLocalAgentRunners({
      available: async (command) => command === 'codex',
      run: async (invocation) => {
        calls.push(invocation);
        return { stdout: JSON.stringify({ summary: 'ضبط الصنف', ops: [{ kind: 'setClasses', id: 4, classes: ['text-4xl'] }] }), stderr: '' };
      },
    });

    await expect(runners.text({ prompt: 'صغّر النص', selection }, new AbortController().signal)).resolves.toMatchObject({ summary: 'ضبط الصنف' });
    expect(calls[0].command).toBe('codex');
    expect(calls[0].args).toEqual(expect.arrayContaining(['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'workspace-write', '--color', 'never', '-']));
    expect(calls[0].args.join(' ')).not.toContain('صغّر النص');
  });

  it('rejects prose or invalid operation JSON from the agent', () => {
    expect(() => parseAgentResponse('I changed it.')).toThrow(/valid JSON/);
    expect(() => parseAgentResponse(JSON.stringify({ summary: 'bad', ops: [{ kind: 'remove', id: 'wrong' }] }))).toThrow(/invalid/);
  });

  it('invokes codex_image.sh with an output path, prompt, and optional reference without a shell', async () => {
    const calls: CommandInvocation[] = [];
    const runners = createLocalAgentRunners({
      available: async () => false,
      run: async (invocation) => {
        calls.push(invocation);
        writeFileSync(invocation.args[0], Buffer.from('89504e470d0a1a0a00000000', 'hex'));
        return { stdout: invocation.args[0], stderr: '' };
      },
    });
    await runners.image!({ prompt: 'رسم تقني', selection, outputPath: '/tmp/generated.png', referencePath: '/tmp/reference.png' }, new AbortController().signal);
    expect(calls[0]).toMatchObject({ command: join(homedir(), '.claude', 'scripts', 'codex_image.sh'), shell: false });
    expect(calls[0].args).toEqual(['/tmp/generated.png', 'رسم تقني', '/tmp/reference.png']);
  });
});

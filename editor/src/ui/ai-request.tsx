import { useEffect, useRef, useState } from 'preact/hooks';
import { acceptAiProposal } from './actions.ts';
import { api } from './api.ts';
import { elementByKey } from './frame.ts';
import { banner, selection, t } from './state.ts';
import type { AgentProposal } from './types.ts';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function AiRequest() {
  const s = t.value;
  const key = selection.value;
  const selected = elementByKey(key);
  const imageSelected = selected?.tagName.toLowerCase() === 'img';
  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState<'text' | 'image'>('text');
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const generation = useRef(0);

  // Reset only when the selection actually changes after mount. Running on mount would erase a prompt typed (or
  // filled) before this first effect ran: the same bug class DraftNumber and DraftInput fixed in the panel.
  const shownKey = useRef(key);
  useEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    generation.current++;
    setProposal(null);
    setPrompt('');
    if (!imageSelected) setKind('text');
  }, [key]);

  const fail = (error: unknown) => {
    banner.value = { kind: 'error', message: error instanceof Error ? error.message : String(error) };
  };
  const submit = async () => {
    const value = prompt.trim();
    if (!key || !value || proposal?.status === 'running') return;
    const ticket = ++generation.current;
    try {
      let next = await api.createAiRequest(value, key, kind);
      if (ticket !== generation.current) return;
      setProposal(next);
      while (next.status === 'running') {
        await wait(250);
        next = await api.aiRequest(next.id);
        if (ticket !== generation.current) return;
        setProposal(next);
      }
    } catch (error) { if (ticket === generation.current) fail(error); }
  };
  const reject = async () => {
    if (!proposal) return;
    try { setProposal(await api.rejectAiRequest(proposal.id)); }
    catch (error) { fail(error); }
  };
  const accept = async () => {
    if (!proposal) return;
    try {
      await acceptAiProposal(proposal.id);
      setProposal({ ...proposal, status: 'accepted' });
    } catch (error) { fail(error); }
  };

  const status = proposal?.status === 'running' ? s.aiRunning
    : proposal?.status === 'ready' ? s.aiReady
      : proposal?.status === 'accepted' ? s.aiAccepted
        : proposal?.status === 'rejected' ? s.aiRejected
          : proposal?.status === 'failed' ? s.aiFailed(proposal.error ?? '') : '';

  return (
    <section class="ai-request" aria-labelledby="ai-request-title" data-testid="ai-request">
      <h2 id="ai-request-title">{s.aiTitle}</h2>
      <p class="hint">{key ? s.aiIntro : s.aiSelect}</p>
      {imageSelected && (
        <div class="ai-kind tray" role="group" aria-label={s.aiKind}>
          <button type="button" class={kind === 'text' ? 'on' : ''} aria-pressed={kind === 'text'} onClick={() => setKind('text')}>{s.aiEditElement}</button>
          <button type="button" class={kind === 'image' ? 'on' : ''} aria-pressed={kind === 'image'} onClick={() => setKind('image')}>{s.aiRegenerateImage}</button>
        </div>
      )}
      <label class="ai-compose">
        <span class="lbl">{s.aiPrompt}</span>
        <textarea
          value={prompt}
          maxLength={4000}
          disabled={!key || proposal?.status === 'running'}
          placeholder={imageSelected && kind === 'image' ? s.aiImagePlaceholder : s.aiPlaceholder}
          data-testid="ai-prompt"
          onInput={(event) => setPrompt(event.currentTarget.value)}
        />
      </label>
      <button type="button" class="ai-submit raised-s" disabled={!key || !prompt.trim() || proposal?.status === 'running'} data-testid="ai-submit" onClick={() => { void submit(); }}>
        {proposal?.status === 'running' ? s.aiRunning : s.aiSubmit}
      </button>
      {status && <p class={`ai-status ${proposal?.status ?? ''}`} role="status" aria-live="polite" data-testid="ai-status">{status}</p>}
      {proposal?.status === 'ready' && proposal.diff && (
        <div class="ai-review">
          <div class="ai-review-head">
            <h3>{proposal.summary || s.aiDiff}</h3>
            <span>{s.aiDiff}</span>
          </div>
          <pre class="pressed" dir="ltr" data-testid="ai-diff"><code>{proposal.diff}</code></pre>
          <div class="ai-actions">
            <button type="button" class="raised-s" data-testid="ai-reject" onClick={() => { void reject(); }}>{s.aiReject}</button>
            <button type="button" class="raised-s accept" data-testid="ai-accept" onClick={() => { void accept(); }}>{s.aiAccept}</button>
          </div>
        </div>
      )}
    </section>
  );
}

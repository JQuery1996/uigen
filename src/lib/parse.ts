// Splits an assistant reply into its chat prose and the generated component code.
// The model is instructed to emit the component inside a single fenced code block
// (```tsx). Everything outside the fence is conversational text.

const FENCE_RE = /```(?:tsx|ts|jsx|js|javascript|typescript)?\s*\n([\s\S]*?)```/i;

export interface ParsedReply {
  /** Extracted component source, or null when the reply is chat-only (e.g. off-topic). */
  code: string | null;
  /** Conversational text with the code fence stripped out. */
  prose: string;
}

export function parseReply(raw: string): ParsedReply {
  const match = raw.match(FENCE_RE);
  if (!match) {
    return { code: null, prose: raw.trim() };
  }
  const code = match[1].trim();
  const prose = raw.replace(match[0], "").replace(/\n{3,}/g, "\n\n").trim();
  return { code: code.length > 0 ? code : null, prose };
}

/** True once a reply text contains an opening fence — used to switch the UI to "building" state mid-stream. */
export function hasCodeFenceStart(raw: string): boolean {
  return /```(?:tsx|ts|jsx|js|javascript|typescript)?\s*\n/i.test(raw);
}

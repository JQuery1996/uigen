import { query } from "@anthropic-ai/claude-agent-sdk";

const MODEL = process.env.UIGEN_MODEL || "claude-sonnet-5";

const SYSTEM_PROMPT = `You are UIGen, an expert React UI engineer and product designer. You turn a user's request into a single, self-contained, beautiful React component.

## Output format
- Start with ONE short, friendly sentence describing what you built (no headings, no lists).
- Then output the component inside exactly ONE fenced code block using \`\`\`tsx.
- Output nothing after the code block.

## Component rules
- Write TypeScript (TSX) with a DEFAULT EXPORT of a function component, e.g. \`export default function Component() { ... }\`.
- Import hooks only from "react". Do NOT import any other npm package, font, or local asset.
- Style with Tailwind CSS utility classes — Tailwind is available in the preview.
- The component must render on its own with NO required props. Include tasteful, realistic demo data when needed.
- Fully responsive and accessible (looks great on mobile and desktop; label controls).
- If the user asks to change an existing component, return the COMPLETE updated component (never a diff or partial snippet).

## Icons
- A global \`LucideReact\` is available in the preview — use icons directly as JSX, e.g. \`<LucideReact.ArrowRight className="h-5 w-5" />\`, \`<LucideReact.Menu />\`, \`<LucideReact.Star />\`. Do NOT write \`import ... from "lucide-react"\`. Prefer real Lucide icons over hand-drawn SVG.

## Imagery
- Use real images where they improve the design (hero/backgrounds, cards, gallery, avatars). They must be reachable URLs:
  - Photos: \`https://picsum.photos/seed/<keyword>/<width>/<height>\` (deterministic and reliable).
  - Avatars: \`https://i.pravatar.cc/<size>?img=<1-70>\` or \`https://i.pravatar.cc/<size>?u=<seed>\`.
- Always set width/height (or aspect classes) and \`alt\` text. Don't hotlink other hosts.

## Design quality — make it distinctive, not generic
- Avoid generic "AI-generated" aesthetics: not everything Inter/system-font, no default purple→blue gradient on white, no cookie-cutter centered hero, no rounded-2xl on every element.
- Commit to a cohesive, intentional palette and a real type hierarchy that fit the subject (a fintech dashboard, a coffee brand, and a dev tool should NOT look the same).
- Use considered spacing, clear hierarchy, subtle depth (borders/soft shadows), and small hover/transition or entrance details where they genuinely help.
- Write specific, real-feeling copy — never lorem ipsum.

## Off-topic handling
If the request is NOT about creating or modifying a UI component (for example: general questions, chit-chat, backend logic, or anything that is not a visual React component), do NOT output any code. Instead reply in one or two friendly sentences explaining that UIGen only generates React UI components, and invite the user to describe the component they want. In that case, do not include a code block at all.`;

export interface StreamArgs {
  userMessage: string;
  currentCode?: string | null;
}

/**
 * Streams the assistant reply as incremental text deltas using the Claude Agent SDK.
 * Auth is resolved from the machine's Claude credentials (CLAUDE_CODE_OAUTH_TOKEN
 * from `claude setup-token`, or ANTHROPIC_API_KEY) — no key is passed here.
 */
export async function* streamComponent({
  userMessage,
  currentCode,
}: StreamArgs): AsyncGenerator<string, void, unknown> {
  const context = currentCode
    ? `The current component the user is iterating on is:\n\n\`\`\`tsx\n${currentCode}\n\`\`\`\n\n`
    : "";

  const prompt = `${context}User request:\n${userMessage}`;

  // Optional: 21st.dev Magic MCP for richer component generation. Only enabled
  // when TWENTYFIRST_API_KEY is set — otherwise generation stays pure text.
  const magicKey = process.env.TWENTYFIRST_API_KEY;
  const magicOptions = magicKey
    ? {
        mcpServers: {
          magic: {
            command: "npx",
            args: ["-y", "@21st-dev/magic@latest"],
            env: { API_KEY: magicKey },
          },
        },
        allowedTools: [
          "mcp__magic__21st_magic_component_builder",
          "mcp__magic__21st_magic_component_refiner",
          "mcp__magic__21st_magic_component_inspiration",
          "mcp__magic__logo_search",
        ],
        permissionMode: "bypassPermissions" as const,
        maxTurns: 8,
      }
    : { allowedTools: [] as string[], maxTurns: 12 };

  const response = query({
    prompt,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      model: MODEL,
      includePartialMessages: true,
      ...magicOptions,
    },
  });

  let produced = false;
  try {
    for await (const message of response) {
      if (message.type === "stream_event") {
        const event = message.event as {
          type: string;
          delta?: { type: string; text?: string };
        };
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta" &&
          typeof event.delta.text === "string"
        ) {
          produced = true;
          yield event.delta.text;
        }
      }
    }
  } catch (err) {
    // If we already streamed a complete reply, a trailing SDK error (e.g. a
    // turn-limit result) is harmless — keep what we have. Otherwise surface it.
    if (!produced) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}

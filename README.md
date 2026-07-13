# UIGen

Generate React UI components from a prompt — a Claude-style chat where you describe
a component and it streams in live, with **Code** and **Preview** tabs. Create
projects, chat inside each one, and every result is stored locally.

## What it does

- **Chat → component.** Describe a UI ("a pricing page with three tiers") and a
  self-contained React + Tailwind component streams back token-by-token, like Claude.
- **Code & Preview tabs.** The component renders live in a sandboxed iframe
  (transpiled in-browser with Babel; React + Tailwind loaded from CDN) and you can
  read/copy the source. No remote build service — the preview is instant.
- **Projects.** Create projects from the sidebar; each has its own chat history and
  current component. Everything persists to a local SQLite database.
- **Iterate.** Follow-up messages ("make it dark mode", "add a footer") modify the
  existing component — the full history is kept.
- **Retry & versions.** Regenerate any reply with **Retry**; swap between results
  with a `‹ 1 / 2 ›` pager (chat text and preview both update), like Claude/ChatGPT.
- **Rich output.** Generated components can use **Lucide icons** (`<LucideReact.Star/>`)
  and **real images** (Lorem Picsum / Pravatar), and are prompted for distinctive,
  non-generic design.
- **Optional Magic MCP.** Set `TWENTYFIRST_API_KEY` in `.env` to route generation
  through the [21st.dev Magic](https://21st.dev/magic) MCP for a higher ceiling
  (off by default; see `.env`).
- **Off-topic guardrail.** Ask something unrelated and it politely explains it only
  builds UI components (no code returned).
- **Responsive.** Works on mobile — the sidebar becomes a drawer and the workspace
  toggles between Chat and Preview.

## How generation works (no API key required)

The backend calls the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`). The
request goes to Claude and Claude generates the component — there is **no OpenAI or
paid Claude API key in the app**. Auth is resolved from the Claude credentials
already on your machine.

Pick **one** auth path (see `.env`):

1. **Subscription token (recommended — no per-token billing).** If you have a Claude
   Pro/Max plan, mint a token once:
   ```bash
   npx claude setup-token
   ```
   Put the value in `.env` as `CLAUDE_CODE_OAUTH_TOKEN=...`. (If you're already
   logged into Claude Code on this machine, the SDK may pick that session up
   automatically.)
2. **API key.** Set `ANTHROPIC_API_KEY=sk-ant-...` in `.env` (pay-per-token).

Change the model with `UIGEN_MODEL` (default `claude-sonnet-5`).

> Because it uses your machine's Claude login, this is designed to run **locally /
> single-user**. To deploy publicly you'd add server-side credentials + auth.

## Setup

```bash
npm install
npx prisma generate      # generate the Prisma client
npx prisma db push       # create prisma/dev.db (SQLite)
```

Then set your Claude auth in `.env` (see above) and run:

```bash
npm run dev              # http://localhost:3000
```

## Tech

| Layer     | Choice                                             |
| --------- | -------------------------------------------------- |
| Framework | Next.js 16 (App Router) + TypeScript + Tailwind v4 |
| AI        | Claude Agent SDK (streamed via Server-Sent Events) |
| Preview   | Sandboxed iframe (Babel Standalone + React + Tailwind CDN) |
| Storage   | Prisma + SQLite (`prisma/dev.db`)                  |
| Icons     | lucide-react                                       |

## Project structure

```
prisma/schema.prisma            Project + Message models
src/lib/generate.ts             Claude Agent SDK wrapper (system prompt + streaming)
src/lib/parse.ts                Splits reply into chat prose + component code
src/lib/preview.ts              Builds the sandboxed iframe document (transpile + render)
src/app/api/chat/route.ts       Streaming generation endpoint (SSE) + persistence
src/app/api/projects/...        Project CRUD
src/components/AppShell.tsx     Sidebar + responsive drawer
src/components/Workspace.tsx    Chat + live streaming + preview orchestration
src/components/PreviewPanel.tsx Code/Preview tabs (iframe preview + source view)
src/app/project/[id]/page.tsx   The per-project workspace
```

## Notes

- Generated components are self-contained (default export, only `react` imported,
  styled with Tailwind), so they render reliably in the sandbox.
- The assistant returns a short sentence plus one `tsx` code block; the app extracts
  the code for the preview and shows the sentence in the chat.

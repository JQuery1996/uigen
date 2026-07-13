# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The import above is critical: this project runs **Next.js 16.2**, whose App Router
> APIs differ from older versions (e.g. `params` is a `Promise` you must `await`).
> Consult `node_modules/next/dist/docs/` before writing framework code.

## What this is

UIGen is a local, single-user "chat → React component" tool: describe a UI, and a
self-contained React + Tailwind component streams back and renders live in a
sandboxed iframe. Everything persists to a local SQLite DB. No paid API key is used —
generation runs through the **Claude Agent SDK** against the machine's own Claude
credentials.

## Commands

```bash
npm run dev              # dev server at http://localhost:3000
npm run build            # production build
npm run start            # serve the production build
npm run lint             # eslint (eslint-config-next)

npx prisma generate      # regenerate the Prisma client after editing schema.prisma
npx prisma db push       # apply schema to prisma/dev.db (SQLite)
npx prisma studio        # inspect the local DB
```

There is **no test suite** — no test runner or `test` script is configured.

Auth for generation lives in `.env`: either `CLAUDE_CODE_OAUTH_TOKEN` (from
`npx claude setup-token`) or `ANTHROPIC_API_KEY`. `UIGEN_MODEL` overrides the model
(default `claude-sonnet-5`). Optional `TWENTYFIRST_API_KEY` enables the 21st.dev Magic MCP.

## Architecture

The end-to-end flow of one generation turn spans several files — understanding it is
the key to being productive here:

1. **`src/components/Workspace.tsx`** (client) POSTs to `/api/chat` and reads a
   Server-Sent Events stream, updating chat + preview live as text arrives.
2. **`src/app/api/chat/route.ts`** (Node runtime, `force-dynamic`) persists the user
   message, resolves the *prior* component code as context, calls the generator, and
   re-emits deltas as SSE (`user` / `delta` / `done` / `error` events). It also derives
   a project name from the first message.
3. **`src/lib/generate.ts`** wraps the Claude Agent SDK `query()`. It holds the
   **system prompt** that defines the entire output contract (one sentence + one
   ```tsx``` block, Tailwind-only, default export, no external imports, Lucide via a
   global, Picsum/Pravatar images, off-topic guardrail). Auth is resolved by the SDK
   from the machine — no key is passed in code.
4. **`src/lib/parse.ts`** splits a completed reply into `prose` + `code` by extracting
   the single fenced code block.
5. **`src/lib/preview.ts`** — `buildPreviewDoc()` turns the component source into a
   standalone HTML doc for the sandboxed iframe: it `sanitize()`s the code (strips
   imports, rewrites `export default` to an entry constant, maps lucide imports to the
   global UMD), transpiles with Babel Standalone in-browser, and loads React + Tailwind
   from CDN. **No server-side bundler is involved.** `PreviewPanel.tsx` renders this.

### Data model (`prisma/schema.prisma`)

`Project` has many `Message`s. A `Message` stores raw `content` (prose + fence), the
extracted `code`, and a `parentId`. **Retry/versions** work by pointing multiple
assistant messages at the same parent user message: `route.ts` reuses the parent user
message on retry (via `parentUserId`) and deliberately feeds the component *as it stood
before that turn* as context, so retries produce alternatives rather than compounding.
`Workspace.tsx`'s `buildTurns()` regroups the flat message list into
`{ user, versions[] }` turns for the `‹ 1/2 ›` pager.

### Routing

- `/` → redirects to `/projects` (project list).
- `/project/[id]` → the workspace (server component loads messages + current code,
  renders `AppShell` + `Workspace`).
- `/api/projects` (GET list / POST create) and `/api/projects/[id]` (GET / PATCH / DELETE).

### Styling

Tailwind v4 (CSS-first, `@import "tailwindcss"` + `@theme inline` in
`src/app/globals.css`). App UI styles **only through semantic tokens** defined there
(`bg-canvas`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, etc.) which map to
CSS variables with automatic light/dark via `prefers-color-scheme`. Prefer these tokens
over raw Tailwind colors when touching app chrome. (Generated *preview* components are
separate — they use plain Tailwind from the CDN.)

## Conventions

- **Commit sparingly** — only commit complex code. Don't create a commit for trivial
  or mechanical changes unless explicitly asked.
- `@/*` path alias maps to `src/*`.
- Use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional classes.
- The generation output contract lives entirely in the system prompt in `generate.ts` —
  change component-generation behavior there, and keep `parse.ts` / `preview.ts`
  (which assume a single default-exported, import-light TSX block) in sync with it.

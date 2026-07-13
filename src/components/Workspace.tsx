"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Sparkles,
  Loader2,
  Eye,
  MessageSquare,
  Box,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LogIn,
  LayoutDashboard,
  Quote,
} from "lucide-react";
import { PreviewPanel } from "@/components/PreviewPanel";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

const EXAMPLES = [
  { icon: CreditCard, label: "Pricing page", prompt: "A pricing page with three tiers" },
  { icon: LogIn, label: "Login form", prompt: "A sleek login form with social buttons" },
  { icon: LayoutDashboard, label: "Dashboard", prompt: "A dashboard stat card grid" },
  { icon: Quote, label: "Testimonials", prompt: "A testimonial carousel section" },
];

function splitPartial(text: string): { prose: string; building: boolean } {
  const i = text.indexOf("```");
  if (i === -1) return { prose: text, building: false };
  return { prose: text.slice(0, i).trim(), building: true };
}

interface Turn {
  user: ChatMessage;
  versions: ChatMessage[];
}

function buildTurns(messages: ChatMessage[]): Turn[] {
  const turns: Turn[] = [];
  const byId: Record<string, Turn> = {};
  for (const m of messages) {
    if (m.role === "user") {
      const t: Turn = { user: m, versions: [] };
      turns.push(t);
      byId[m.id] = t;
    } else {
      const parent = m.parentId ? byId[m.parentId] : undefined;
      if (parent) parent.versions.push(m);
      else if (turns.length) turns[turns.length - 1].versions.push(m);
    }
  }
  return turns;
}

export function Workspace({
  projectId,
  projectName,
  initialMessages,
  initialCode,
}: {
  projectId: string;
  projectName: string;
  initialMessages: ChatMessage[];
  initialCode: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [currentCode, setCurrentCode] = useState<string | null>(initialCode);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState<{ prose: string; building: boolean } | null>(null);
  const [inflightParent, setInflightParent] = useState<string | null>(null);
  const [active, setActive] = useState<Record<string, number>>({});
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);

  const turns = useMemo(() => buildTurns(messages), [messages]);
  const empty = turns.length === 0 && !streaming;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  function activeIndex(turn: Turn): number {
    const raw = active[turn.user.id];
    const max = Math.max(turn.versions.length - 1, 0);
    return raw === undefined ? max : Math.min(raw, max);
  }

  function selectVersion(turn: Turn, idx: number) {
    setActive((a) => ({ ...a, [turn.user.id]: idx }));
    const v = turn.versions[idx];
    if (v?.code) setCurrentCode(v.code);
  }

  async function runGeneration(opts: { text?: string; parentUserId?: string }) {
    if (busy) return;
    let inflight = opts.parentUserId ?? null;

    if (opts.text) {
      const tmpId = `tmp-${Date.now()}`;
      setMessages((m) => [
        ...m,
        { id: tmpId, role: "user", content: opts.text!, createdAt: new Date().toISOString() },
      ]);
      inflight = tmpId;
    }
    setInflightParent(inflight);
    setBusy(true);
    setStreaming({ prose: "", building: false });

    let full = "";
    let currentInflight = inflight;
    try {
      const body = opts.parentUserId
        ? { projectId, parentUserId: opts.parentUserId }
        : { projectId, message: opts.text };
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        throw new Error((await res.json().catch(() => ({}))).error || "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "user") {
            const real = data.message;
            // Capture the id NOW — the setMessages updater runs asynchronously, and
            // `currentInflight` is reassigned below before React invokes it.
            const from = currentInflight;
            setMessages((m) => m.map((x) => (x.id === from ? { ...x, id: real.id } : x)));
            currentInflight = real.id;
            setInflightParent(real.id);
          } else if (data.type === "delta") {
            full += data.text;
            setStreaming(splitPartial(full));
          } else if (data.type === "done") {
            const a = data.message;
            const realParent: string = data.parentId ?? a.parentId;
            // Authoritatively reconcile the (possibly still-temp) user message id to
            // the server's real id, then append the assistant — one atomic update so
            // grouping and Retry always use the persisted id.
            const inflightNow = currentInflight;
            setMessages((m) => [
              ...m.map((x) =>
                x.role === "user" && x.id === inflightNow ? { ...x, id: realParent } : x
              ),
              {
                id: a.id,
                role: "assistant",
                content: data.prose || "",
                code: data.code ?? null,
                parentId: realParent,
                createdAt: a.createdAt,
              },
            ]);
            currentInflight = realParent;
            setActive((s) => ({ ...s, [realParent]: 9999 })); // jump to newest version
            if (data.code) {
              setCurrentCode(data.code);
              setMobileView("preview");
            }
            setStreaming(null);
          } else if (data.type === "error") {
            setMessages((m) => [
              ...m,
              {
                id: `err-${Date.now()}`,
                role: "assistant",
                content: `⚠️ ${data.message}`,
                code: null,
                parentId: data.parentId ?? currentInflight,
                createdAt: new Date().toISOString(),
              },
            ]);
            setStreaming(null);
          }
        }
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ ${e instanceof Error ? e.message : "Something went wrong"}`,
          code: null,
          parentId: currentInflight,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setStreaming(null);
      setBusy(false);
      setInflightParent(null);
    }
  }

  function send(text: string) {
    if (!text.trim()) return;
    setInput("");
    runGeneration({ text: text.trim() });
  }

  const composer = (
    <Composer value={input} onChange={setInput} onSend={() => send(input)} busy={busy} />
  );

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Mobile view toggle */}
      <div className="flex gap-1 border-b border-line p-2 md:hidden">
        <MobileTab
          active={mobileView === "chat"}
          onClick={() => setMobileView("chat")}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="Chat"
        />
        <MobileTab
          active={mobileView === "preview"}
          onClick={() => setMobileView("preview")}
          icon={<Eye className="h-3.5 w-3.5" />}
          label="Preview"
        />
      </div>

      {/* Chat column */}
      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col md:max-w-[52%] md:border-r md:border-line",
          mobileView === "chat" ? "flex" : "hidden md:flex"
        )}
      >
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="w-full max-w-2xl">
              <div className="mb-8 flex items-center justify-center gap-3">
                <Sparkles className="h-7 w-7 text-accent" />
                <h1 className="font-serif text-4xl font-medium tracking-tight text-ink">
                  What should we build?
                </h1>
              </div>
              {composer}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => send(ex.prompt)}
                    className="inline-flex items-center gap-2 rounded-xl border border-line bg-raised px-3.5 py-2 text-sm text-muted transition hover:border-line-strong hover:text-ink"
                  >
                    <ex.icon className="h-4 w-4 text-accent" />
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
                {turns.map((turn) => {
                  const idx = activeIndex(turn);
                  const streamingHere = inflightParent === turn.user.id && streaming;
                  const version = turn.versions[idx];
                  return (
                    <div key={turn.user.id} className="space-y-4">
                      <UserBubble text={turn.user.content} />
                      {streamingHere ? (
                        <StreamingBubble prose={streaming!.prose} building={streaming!.building} />
                      ) : version ? (
                        <AssistantMessage
                          message={version}
                          versionCount={turn.versions.length}
                          versionIndex={idx}
                          busy={busy}
                          onPrev={() => selectVersion(turn, Math.max(0, idx - 1))}
                          onNext={() =>
                            selectVersion(turn, Math.min(turn.versions.length - 1, idx + 1))
                          }
                          onRetry={() => runGeneration({ parentUserId: turn.user.id })}
                          onOpenPreview={() => setMobileView("preview")}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-4 pb-4 pt-2">
              <div className="mx-auto max-w-3xl">{composer}</div>
            </div>
          </>
        )}
      </section>

      {/* Artifact / preview column */}
      <section
        className={cn("min-h-0 flex-1", mobileView === "preview" ? "flex" : "hidden md:flex")}
      >
        <div className="min-h-0 w-full">
          <PreviewPanel code={currentCode} title={projectName} />
        </div>
      </section>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function autosize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }
  return (
    <div className="rounded-2xl border border-raised-line bg-raised px-3 pb-2 pt-3 shadow-sm transition focus-within:border-accent/60">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          autosize();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
            requestAnimationFrame(() => ref.current && (ref.current.style.height = "auto"));
          }
        }}
        placeholder="Describe a component, or ask for a change…"
        rows={1}
        disabled={busy}
        className="max-h-52 min-h-[24px] w-full resize-none bg-transparent px-1 text-[15px] leading-relaxed outline-none placeholder:text-faint disabled:opacity-60"
      />
      <div className="flex items-center justify-between pt-1">
        <span className="inline-flex items-center gap-1.5 pl-1 text-[11px] font-medium text-faint">
          <Box className="h-3.5 w-3.5" /> React · Tailwind
        </span>
        <button
          onClick={() => {
            onSend();
            requestAnimationFrame(() => ref.current && (ref.current.style.height = "auto"));
          }}
          disabled={busy || !value.trim()}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Send"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-md bg-bubble px-4 py-2.5 text-[15px] leading-relaxed text-ink">
        {text}
      </div>
    </div>
  );
}

function StreamingBubble({ prose, building }: { prose: string; building: boolean }) {
  return (
    <div className="flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {prose && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{prose}</p>}
        <span className="mt-1.5 inline-flex items-center gap-2 text-[13px] text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          {building ? "Building component…" : "Thinking…"}
        </span>
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  versionCount,
  versionIndex,
  busy,
  onPrev,
  onNext,
  onRetry,
  onOpenPreview,
}: {
  message: ChatMessage;
  versionCount: number;
  versionIndex: number;
  busy: boolean;
  onPrev: () => void;
  onNext: () => void;
  onRetry: () => void;
  onOpenPreview: () => void;
}) {
  return (
    <div className="group flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {message.content && (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
            {message.content}
          </p>
        )}
        {message.code && (
          <button
            onClick={onOpenPreview}
            className="mt-3 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-panel px-3 py-2.5 text-left transition hover:border-line-strong"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
              <Box className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">Component</span>
              <span className="block text-xs text-muted">React · Tailwind · click to view</span>
            </span>
          </button>
        )}

        {/* Controls: version pager (‹ 1/2 ›) + retry */}
        <div className="mt-2 flex items-center gap-1 text-muted">
          {versionCount > 1 && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={onPrev}
                disabled={versionIndex === 0}
                className="grid h-6 w-6 place-items-center rounded-md transition hover:bg-panel hover:text-ink disabled:opacity-30"
                aria-label="Previous version"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[2.5rem] text-center text-xs tabular-nums">
                {versionIndex + 1} / {versionCount}
              </span>
              <button
                onClick={onNext}
                disabled={versionIndex === versionCount - 1}
                className="grid h-6 w-6 place-items-center rounded-md transition hover:bg-panel hover:text-ink disabled:opacity-30"
                aria-label="Next version"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={onRetry}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition hover:bg-panel hover:text-ink disabled:opacity-40"
            title="Generate another version"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
        active ? "bg-accent text-accent-ink" : "bg-panel text-muted"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

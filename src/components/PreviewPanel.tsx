"use client";

import { useMemo, useState } from "react";
import { Eye, Code2, Copy, Check, Sparkles, RefreshCw, Box } from "lucide-react";
import { buildPreviewDoc } from "@/lib/preview";
import { cn } from "@/lib/utils";

type Tab = "preview" | "code";

export function PreviewPanel({ code, title }: { code: string | null; title?: string }) {
  const [tab, setTab] = useState<Tab>("preview");
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const doc = useMemo(() => (code ? buildPreviewDoc(code) : null), [code]);

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      {/* Artifact header */}
      <div className="flex h-12 items-center justify-between gap-3 border-b border-line px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent/10 text-accent">
            <Box className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-sm font-medium text-ink">{title || "Component"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-lg bg-panel p-0.5">
            <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </TabButton>
            <TabButton active={tab === "code"} onClick={() => setTab("code")}>
              <Code2 className="h-3.5 w-3.5" /> Code
            </TabButton>
          </div>
          {tab === "preview" && code && (
            <IconAction onClick={() => setReloadKey((k) => k + 1)} label="Reload preview">
              <RefreshCw className="h-4 w-4" />
            </IconAction>
          )}
          {tab === "code" && code && (
            <IconAction onClick={copy} label="Copy code">
              {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
            </IconAction>
          )}
        </div>
      </div>

      {/* Body — both views stay mounted so toggling tabs never reloads the
          preview (which would re-fetch the CDN and flash unstyled). */}
      <div className="relative min-h-0 flex-1">
        {!code ? (
          <EmptyState />
        ) : (
          <>
            <div className={cn("absolute inset-0", tab === "preview" ? "block" : "hidden")}>
              <iframe
                key={reloadKey}
                title="Component preview"
                sandbox="allow-scripts"
                srcDoc={doc ?? ""}
                className="h-full w-full border-0 bg-white"
              />
            </div>
            <div
              className={cn(
                "absolute inset-0 overflow-auto bg-code-bg",
                tab === "code" ? "block" : "hidden"
              )}
            >
              <pre className="min-h-full p-4 text-[13px] leading-relaxed text-code-ink">
                <code className="font-mono">{code}</code>
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full place-items-center bg-panel px-8 text-center">
      <div className="max-w-xs">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-ink shadow-sm">
          <Sparkles className="h-5 w-5" />
        </span>
        <h3 className="text-[15px] font-semibold text-ink">Your component will appear here</h3>
        <p className="mt-1.5 text-sm text-muted">
          Describe a UI in the chat and it renders live in this panel.
        </p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
        active ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

function IconAction({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-panel hover:text-ink"
    >
      {children}
    </button>
  );
}

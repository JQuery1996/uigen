"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Sparkles, Trash2, Menu, X, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/types";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const activeId = pathname.startsWith("/project/") ? pathname.split("/")[2] : null;

  const load = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load, pathname]);
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  async function createProject() {
    setCreating(true);
    try {
      const res = await fetch("/api/projects", { method: "POST" });
      const p = await res.json();
      router.push(`/project/${p.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this project and all its chats?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (activeId === id) router.push("/projects");
    else load();
  }

  async function saveRename(id: string) {
    const name = editValue.trim();
    setEditingId(null);
    if (!name) return;
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    load();
  }

  const sidebar = (
    <div className="flex h-full w-[264px] flex-col bg-panel">
      <div className="flex items-center justify-between px-3 py-3">
        <Link href="/projects" className="flex items-center gap-2 rounded-lg px-1.5 py-1">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-ink">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-serif text-xl font-medium tracking-tight">UIGen</span>
        </Link>
        <button
          className="rounded-md p-1.5 text-muted hover:bg-canvas md:hidden"
          onClick={() => setDrawer(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3">
        <button
          onClick={createProject}
          disabled={creating}
          className="flex w-full items-center gap-2 rounded-xl border border-line-strong bg-canvas px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> New project
        </button>
      </div>

      <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-faint">
          Projects
        </p>
        {projects.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-faint">No projects yet.</p>
        )}
        {projects.map((p) => {
          const active = p.id === activeId;
          const editing = editingId === p.id;
          return (
            <div
              key={p.id}
              className={cn(
                "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition",
                active ? "bg-canvas shadow-sm" : "hover:bg-canvas/60"
              )}
            >
              {editing ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(p.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="min-w-0 flex-1 rounded border border-line-strong bg-canvas px-1.5 py-0.5 text-sm outline-none focus:border-accent"
                />
              ) : (
                <Link
                  href={`/project/${p.id}`}
                  className={cn(
                    "min-w-0 flex-1 truncate py-0.5",
                    active ? "text-ink" : "text-muted"
                  )}
                  title={p.name}
                >
                  {p.name}
                </Link>
              )}

              {editing ? (
                <button
                  onClick={() => saveRename(p.id)}
                  className="rounded p-1 text-muted hover:bg-bubble"
                  aria-label="Save name"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="flex opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setEditingId(p.id);
                      setEditValue(p.name);
                    }}
                    className="rounded p-1 text-faint hover:bg-bubble hover:text-ink"
                    aria-label="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    className="rounded p-1 text-faint hover:bg-accent/10 hover:text-accent"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas text-ink">
      <aside className="hidden border-r border-line md:block">{sidebar}</aside>

      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full border-r border-line shadow-xl">
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line px-3 py-2 md:hidden">
          <button
            onClick={() => setDrawer(true)}
            className="rounded-md p-1.5 text-muted hover:bg-panel"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="grid h-5 w-5 place-items-center rounded bg-accent text-accent-ink">
              <Sparkles className="h-3 w-3" />
            </span>
            UIGen
          </span>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

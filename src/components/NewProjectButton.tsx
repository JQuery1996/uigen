"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

export function NewProjectButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects", { method: "POST" });
      const p = await res.json();
      router.push(`/project/${p.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={create}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      New project
    </button>
  );
}

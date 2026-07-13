import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { NewProjectButton } from "@/components/NewProjectButton";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  return (
    <AppShell>
      <div className="grid h-full place-items-center px-6">
        <div className="max-w-lg text-center">
          <div className="mb-5 flex items-center justify-center gap-3">
            <Sparkles className="h-8 w-8 text-accent" />
            <h1 className="font-serif text-[34px] font-medium leading-tight tracking-tight text-ink text-balance">
              Design something today?
            </h1>
          </div>
          <p className="mx-auto mt-1 max-w-sm text-[15px] leading-relaxed text-muted">
            Create a project, describe what you want, and watch a React component stream
            in with live Preview and Code tabs.
          </p>
          <div className="mt-7 flex justify-center">
            <NewProjectButton />
          </div>
          <p className="mt-3 text-xs text-faint">Or open a project from the sidebar.</p>
        </div>
      </div>
    </AppShell>
  );
}

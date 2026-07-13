import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { Workspace } from "@/components/Workspace";
import { parseReply } from "@/lib/parse";
import type { ChatMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!project) notFound();

  const messages: ChatMessage[] = project.messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    // For assistant replies, show the prose (the code lives in the preview panel).
    content: m.role === "assistant" ? parseReply(m.content).prose : m.content,
    code: m.code,
    parentId: m.parentId,
    createdAt: m.createdAt.toISOString(),
  }));

  const currentCode =
    [...project.messages].reverse().find((m) => m.role === "assistant" && m.code)
      ?.code ?? null;

  return (
    <AppShell>
      <Workspace
        projectId={project.id}
        projectName={project.name}
        initialMessages={messages}
        initialCode={currentCode}
      />
    </AppShell>
  );
}

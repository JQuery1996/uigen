import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { streamComponent } from "@/lib/generate";
import { parseReply } from "@/lib/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const encoder = new TextEncoder();
const sse = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

export async function POST(req: NextRequest) {
  const { projectId, message, parentUserId } = await req.json().catch(() => ({}));

  if (typeof projectId !== "string") {
    return json({ error: "projectId is required" }, 400);
  }
  const isRetry = typeof parentUserId === "string" && parentUserId.length > 0;
  if (!isRetry && (typeof message !== "string" || !message.trim())) {
    return json({ error: "message is required" }, 400);
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return json({ error: "Project not found" }, 404);

  // Resolve the user message this reply answers: reuse it on retry, create it otherwise.
  let userMessage;
  let emitUser = false;
  if (isRetry) {
    userMessage = await prisma.message.findUnique({ where: { id: parentUserId } });
    if (!userMessage || userMessage.projectId !== projectId || userMessage.role !== "user") {
      return json({ error: "Invalid parentUserId" }, 400);
    }
  } else {
    const count = await prisma.message.count({ where: { projectId } });
    userMessage = await prisma.message.create({
      data: { projectId, role: "user", content: message.trim() },
    });
    emitUser = true;
    if (count === 0 && project.name === "Untitled project") {
      const derived = message.trim().replace(/\s+/g, " ").slice(0, 48);
      await prisma.project.update({ where: { id: projectId }, data: { name: derived } });
    }
  }

  // Context = the component as it stood *before* this turn, so retries produce
  // alternatives for the same request rather than compounding on each other.
  const prior = await prisma.message.findFirst({
    where: {
      projectId,
      role: "assistant",
      code: { not: null },
      createdAt: { lt: userMessage.createdAt },
    },
    orderBy: { createdAt: "desc" },
  });
  const currentCode = prior?.code ?? null;
  const promptText = userMessage.content;
  const parentId = userMessage.id;

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        if (emitUser) controller.enqueue(sse({ type: "user", message: userMessage }));

        for await (const delta of streamComponent({ userMessage: promptText, currentCode })) {
          full += delta;
          controller.enqueue(sse({ type: "delta", text: delta }));
        }

        const { code, prose } = parseReply(full);
        const assistant = await prisma.message.create({
          data: { projectId, role: "assistant", content: full, code, parentId },
        });
        await prisma.project.update({
          where: { id: projectId },
          data: { updatedAt: new Date() },
        });

        controller.enqueue(sse({ type: "done", message: assistant, code, prose, parentId }));
      } catch (err) {
        const messageText = err instanceof Error ? err.message : String(err);
        controller.enqueue(sse({ type: "error", message: messageText, parentId }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

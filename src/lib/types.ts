export type Role = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  code?: string | null;
  parentId?: string | null;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  _count?: { messages: number };
}

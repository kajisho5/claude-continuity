/**
 * Replies sent through the Message Batches API at half price: the job list kept in batches.json.
 * Most batches finish within an hour; one that is not done in 24 hours expires unbilled, and results can be
 * downloaded for 29 days (https://platform.claude.com/docs/en/build-with-claude/batch-processing).
 */
export type BatchStatus = "pending" | "done" | "expired" | "canceled" | "errored";
export type BatchJob = {
  id: string; chatId: string; chatTitle: string; model: string; createdAt: string; status: BatchStatus;
  endedAt?: string; estimateUsd?: number; costUsd?: number; error?: string; canceling?: boolean;
  /** Display names of the remote connectors used, by MCP server name (for the "what Claude did" steps). */
  connectorNames?: Record<string, string>;
  /** The finished reply, kept until the window has put it into the chat. */
  result?: unknown;
};

export const RESULTS_KEPT_MS = 29 * 24 * 60 * 60 * 1000;
const MAX_JOBS = 200;

/** Jobs read from disk: unknown shapes are dropped, and the newest MAX_JOBS kept. */
export function sanitizeJobs(raw: unknown): BatchJob[] {
  if (!Array.isArray(raw)) return [];
  const states: BatchStatus[] = ["pending", "done", "expired", "canceled", "errored"];
  return raw.filter((j: any) => j && typeof j.id === "string" && typeof j.chatId === "string" && states.includes(j.status))
    .map((j: any) => ({
      id: j.id.slice(0, 100), chatId: j.chatId.slice(0, 100), chatTitle: String(j.chatTitle ?? "").slice(0, 300), model: String(j.model ?? "").slice(0, 200),
      createdAt: String(j.createdAt ?? ""), status: j.status,
      ...(typeof j.endedAt === "string" ? { endedAt: j.endedAt } : {}),
      ...(typeof j.estimateUsd === "number" && Number.isFinite(j.estimateUsd) ? { estimateUsd: j.estimateUsd } : {}),
      ...(typeof j.costUsd === "number" && Number.isFinite(j.costUsd) ? { costUsd: j.costUsd } : {}),
      ...(typeof j.error === "string" ? { error: j.error.slice(0, 500) } : {}),
      ...(j.canceling === true ? { canceling: true } : {}),
      ...(j.connectorNames && typeof j.connectorNames === "object" ? { connectorNames: j.connectorNames } : {}),
      ...(j.result !== undefined ? { result: j.result } : {})
    }))
    .slice(-MAX_JOBS);
}

/** A pending job whose results can no longer be downloaded counts as expired. */
export function isPastRetention(job: BatchJob, now: number): boolean {
  const created = Date.parse(job.createdAt);
  return job.status === "pending" && Number.isFinite(created) && now - created > RESULTS_KEPT_MS;
}

/** The list sent to the window: results ride along until delivered. */
export const pendingCount = (jobs: BatchJob[]) => jobs.filter(j => j.status === "pending").length;

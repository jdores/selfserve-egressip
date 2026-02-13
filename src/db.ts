import { Env, AuditLogEntry } from "./types";

/**
 * Insert an audit log entry. Best-effort — errors are logged but not thrown.
 */
export async function insertAuditLog(
  env: Env,
  entry: {
    actor: string;
    action: AuditLogEntry["action"];
    target_email: string | null;
    assigned_to: string | null;
    removed_from: string | null;
    details: string | null;
  }
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_log (timestamp, actor, action, target_email, assigned_to, removed_from, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        new Date().toISOString(),
        entry.actor,
        entry.action,
        entry.target_email,
        entry.assigned_to,
        entry.removed_from,
        entry.details
      )
      .run();
  } catch (err) {
    console.error("Failed to insert audit log entry:", err);
  }
}

/**
 * Query audit log entries with cursor-based pagination (newest first).
 */
export async function queryAuditLog(
  env: Env,
  cursor?: number,
  limit: number = 50
): Promise<{ entries: AuditLogEntry[]; nextCursor: number | null; hasMore: boolean }> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  // Fetch one extra to determine if there are more
  const fetchLimit = safeLimit + 1;

  let stmt;
  if (cursor) {
    stmt = env.DB.prepare(
      `SELECT * FROM audit_log WHERE id < ? ORDER BY id DESC LIMIT ?`
    ).bind(cursor, fetchLimit);
  } else {
    stmt = env.DB.prepare(
      `SELECT * FROM audit_log ORDER BY id DESC LIMIT ?`
    ).bind(fetchLimit);
  }

  const result = await stmt.all<AuditLogEntry>();
  const rows = result.results || [];

  const hasMore = rows.length > safeLimit;
  const entries = hasMore ? rows.slice(0, safeLimit) : rows;
  const nextCursor = hasMore && entries.length > 0 ? entries[entries.length - 1].id : null;

  return { entries, nextCursor, hasMore };
}

/**
 * Delete audit log entries older than 90 days. Returns the number of deleted rows.
 */
export async function cleanupAuditLog(env: Env): Promise<number> {
  const result = await env.DB.prepare(
    `DELETE FROM audit_log WHERE timestamp < datetime('now', '-90 days')`
  ).run();

  return result.meta?.changes ?? 0;
}

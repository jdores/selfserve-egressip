import { Env } from "./types";
import { handleGetUserPage, handleSelect, handleReset, handleWhoami } from "./handlers/user";
import {
  handleGetAdminPage,
  handleAdminAssign,
  handleAdminRemove,
  handleAdminLogs,
} from "./handlers/admin";
import { cleanupAuditLog } from "./db";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // --- User routes ---
    if (path === "/" && method === "GET") {
      return handleGetUserPage(request, env);
    }

    if (path === "/whoami" && method === "GET") {
      return handleWhoami(request);
    }

    if (path === "/select" && method === "POST") {
      return handleSelect(request, env);
    }

    if (path === "/reset" && method === "POST") {
      return handleReset(request, env);
    }

    // --- Admin routes ---
    if (path === "/admin" && method === "GET") {
      return handleGetAdminPage(request, env);
    }

    if (path === "/admin/assign" && method === "POST") {
      return handleAdminAssign(request, env);
    }

    if (path === "/admin/remove" && method === "POST") {
      return handleAdminRemove(request, env);
    }

    if (path === "/admin/logs" && method === "GET") {
      return handleAdminLogs(request, env);
    }

    // --- 404 ---
    return new Response(JSON.stringify({ success: false, error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      const deleted = await cleanupAuditLog(env);
      console.log(`Cron: audit log cleanup deleted ${deleted} entries older than 90 days`);
    } catch (err) {
      console.error("Cron: audit log cleanup failed:", err);
    }
  },
};

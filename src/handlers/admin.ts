import { Env, EgressLocation, ListMembership } from "../types";
import { getEmailFromAccessJWT } from "../auth";
import {
  addToList,
  removeFromList,
  getAllListMemberships,
  findUserInMemberships,
} from "../api";
import { insertAuditLog, queryAuditLog } from "../db";
import { renderAdminPage } from "../ui/admin-page";

function parseLocations(env: Env): EgressLocation[] {
  try {
    return JSON.parse(env.EGRESS_LOCATIONS);
  } catch {
    console.error("EGRESS_LOCATIONS env var is malformed");
    throw new Error("EGRESS_LOCATIONS is malformed");
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * GET /admin — Serve the admin page.
 * Reads live list memberships from the Zero Trust API.
 */
export async function handleGetAdminPage(request: Request, env: Env): Promise<Response> {
  const email = getEmailFromAccessJWT(request);
  if (!email) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const locations = parseLocations(env);

  // Read live state from API
  let memberships: Map<string, ListMembership>;
  try {
    memberships = await getAllListMemberships(env, locations);
  } catch (err) {
    console.error("Admin page API fetch failed:", err);
    // Render with empty data on API failure
    memberships = new Map();
    for (const loc of locations) {
      memberships.set(loc.id, { name: loc.name, emails: [] });
    }
  }

  const html = renderAdminPage(locations, memberships);
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}

/**
 * POST /admin/assign — Admin assigns a user to a location.
 * Reads live state from the API, removes from old list if needed, adds to new list.
 */
export async function handleAdminAssign(request: Request, env: Env): Promise<Response> {
  const adminEmail = getEmailFromAccessJWT(request);
  if (!adminEmail) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  let body: { email?: string; listId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid request body" }, 400);
  }

  const targetEmail = body.email?.trim().toLowerCase();
  const listId = body.listId;

  if (!targetEmail || !isValidEmail(targetEmail)) {
    return jsonResponse({ success: false, error: "Invalid email address" }, 400);
  }

  if (!listId) {
    return jsonResponse({ success: false, error: "Missing listId" }, 400);
  }

  const locations = parseLocations(env);
  const targetLocation = locations.find((l) => l.id === listId);
  if (!targetLocation) {
    return jsonResponse({ success: false, error: "Invalid location" }, 400);
  }

  try {
    // Read live state from API
    const memberships = await getAllListMemberships(env, locations);
    const currentAssignment = findUserInMemberships(targetEmail, locations, memberships);

    // No-op if already on the same location
    if (currentAssignment?.listId === listId) {
      return jsonResponse({
        success: true,
        email: targetEmail,
        assignedTo: targetLocation.name,
        removedFrom: null,
      });
    }

    let removedFromName: string | null = null;
    if (currentAssignment) {
      await removeFromList(env, currentAssignment.listId, targetEmail);
      removedFromName = currentAssignment.locationName;
    }

    await addToList(env, listId, targetEmail);

    // Audit log
    await insertAuditLog(env, {
      actor: adminEmail,
      action: "admin_assign",
      target_email: targetEmail,
      assigned_to: targetLocation.name,
      removed_from: removedFromName,
      details: null,
    });

    console.log(`Admin ${adminEmail} assigned ${targetEmail} to ${targetLocation.name}, removed from ${removedFromName || "none"}`);

    return jsonResponse({
      success: true,
      email: targetEmail,
      assignedTo: targetLocation.name,
      removedFrom: removedFromName,
    });
  } catch (err) {
    console.error("Error in /admin/assign:", err);
    return jsonResponse(
      { success: false, error: "Error updating egress policies, please try again" },
      500
    );
  }
}

/**
 * POST /admin/remove — Admin removes a user from their location.
 * Reads live state from the API to find which list the user is on.
 */
export async function handleAdminRemove(request: Request, env: Env): Promise<Response> {
  const adminEmail = getEmailFromAccessJWT(request);
  if (!adminEmail) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid request body" }, 400);
  }

  const targetEmail = body.email?.trim().toLowerCase();
  if (!targetEmail || !isValidEmail(targetEmail)) {
    return jsonResponse({ success: false, error: "Invalid email address" }, 400);
  }

  const locations = parseLocations(env);

  try {
    // Read live state from API
    const memberships = await getAllListMemberships(env, locations);
    const currentAssignment = findUserInMemberships(targetEmail, locations, memberships);

    if (!currentAssignment) {
      return jsonResponse({
        success: true,
        email: targetEmail,
        removedFrom: null,
      });
    }

    await removeFromList(env, currentAssignment.listId, targetEmail);

    // Audit log
    await insertAuditLog(env, {
      actor: adminEmail,
      action: "admin_remove",
      target_email: targetEmail,
      assigned_to: null,
      removed_from: currentAssignment.locationName,
      details: null,
    });

    console.log(`Admin ${adminEmail} removed ${targetEmail} from ${currentAssignment.locationName}`);

    return jsonResponse({
      success: true,
      email: targetEmail,
      removedFrom: currentAssignment.locationName,
    });
  } catch (err) {
    console.error("Error in /admin/remove:", err);
    return jsonResponse(
      { success: false, error: "Error updating egress policies, please try again" },
      500
    );
  }
}

/**
 * GET /admin/logs — Paginated audit log
 */
export async function handleAdminLogs(request: Request, env: Env): Promise<Response> {
  const email = getEmailFromAccessJWT(request);
  if (!email) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const cursorParam = url.searchParams.get("cursor");
  const limitParam = url.searchParams.get("limit");

  const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined;
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  try {
    const result = await queryAuditLog(env, cursor, limit);
    return jsonResponse({
      success: true,
      entries: result.entries,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (err) {
    console.error("Error in /admin/logs:", err);
    return jsonResponse(
      { success: false, error: "Error loading audit logs" },
      500
    );
  }
}

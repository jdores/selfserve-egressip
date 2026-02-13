import { Env, EgressLocation } from "../types";
import { getEmailFromAccessJWT } from "../auth";
import {
  addToList,
  removeFromList,
  getAllListMemberships,
  findUserInMemberships,
} from "../api";
import { insertAuditLog } from "../db";
import { renderUserPage } from "../ui/user-page";

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

/**
 * GET /whoami — Return the user's current location and IP from CF request metadata.
 * Used by the location widget to show where the user is egressing from.
 */
export async function handleWhoami(request: Request): Promise<Response> {
  const cf = (request as any).cf as Record<string, unknown> | undefined;
  const ip = request.headers.get("CF-Connecting-IP") || null;

  return jsonResponse({
    success: true,
    ip,
    city: cf?.city || null,
    country: cf?.country || null,
    region: cf?.region || null,
    timezone: cf?.timezone || null,
    colo: cf?.colo || null,
  });
}

/**
 * GET / — Serve the user-facing page
 * Reads live state from the Zero Trust API to determine current assignment.
 */
export async function handleGetUserPage(request: Request, env: Env): Promise<Response> {
  const email = getEmailFromAccessJWT(request);
  if (!email) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const locations = parseLocations(env);

  // Read live state from API
  const memberships = await getAllListMemberships(env, locations);
  const currentAssignment = findUserInMemberships(email, locations, memberships);

  const html = renderUserPage(email, locations, currentAssignment);

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}

/**
 * POST /select — Assign user to a location.
 * Reads live state from the API, removes from old list if needed, adds to new list.
 */
export async function handleSelect(request: Request, env: Env): Promise<Response> {
  const email = getEmailFromAccessJWT(request);
  if (!email) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  let body: { listId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid request body" }, 400);
  }

  const listId = body.listId;
  if (!listId) {
    return jsonResponse({ success: false, error: "Missing listId" }, 400);
  }

  const locations = parseLocations(env);
  const targetLocation = locations.find((l) => l.id === listId);
  if (!targetLocation) {
    return jsonResponse({ success: false, error: "Invalid location" }, 400);
  }

  try {
    // Read live state from API to find current assignment
    const memberships = await getAllListMemberships(env, locations);
    const currentAssignment = findUserInMemberships(email, locations, memberships);

    // No-op if already on the same location
    if (currentAssignment?.listId === listId) {
      return jsonResponse({
        success: true,
        assignedTo: targetLocation.name,
        removedFrom: null,
      });
    }

    // Remove from old list first (if any)
    let removedFromName: string | null = null;
    if (currentAssignment) {
      await removeFromList(env, currentAssignment.listId, email);
      removedFromName = currentAssignment.locationName;
    }

    // Add to new list
    await addToList(env, listId, email);

    // Audit log (best-effort)
    await insertAuditLog(env, {
      actor: email,
      action: "select",
      target_email: email,
      assigned_to: targetLocation.name,
      removed_from: removedFromName,
      details: null,
    });

    console.log(`User ${email} assigned to ${targetLocation.name}, removed from ${removedFromName || "none"}`);

    return jsonResponse({
      success: true,
      assignedTo: targetLocation.name,
      removedFrom: removedFromName,
    });
  } catch (err) {
    console.error("Error in /select:", err);
    return jsonResponse(
      {
        success: false,
        error: "Error updating egress policies, please try again",
      },
      500
    );
  }
}

/**
 * POST /reset — Remove user from current location (back to default).
 * Reads live state from the API, removes from current list if on one.
 */
export async function handleReset(request: Request, env: Env): Promise<Response> {
  const email = getEmailFromAccessJWT(request);
  if (!email) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const locations = parseLocations(env);

  try {
    // Read live state from API
    const memberships = await getAllListMemberships(env, locations);
    const currentAssignment = findUserInMemberships(email, locations, memberships);

    // No-op if already on default
    if (!currentAssignment) {
      return jsonResponse({
        success: true,
        removedFrom: null,
      });
    }

    await removeFromList(env, currentAssignment.listId, email);

    // Audit log (best-effort)
    await insertAuditLog(env, {
      actor: email,
      action: "reset",
      target_email: email,
      assigned_to: null,
      removed_from: currentAssignment.locationName,
      details: null,
    });

    console.log(`User ${email} reset to default, removed from ${currentAssignment.locationName}`);

    return jsonResponse({
      success: true,
      removedFrom: currentAssignment.locationName,
    });
  } catch (err) {
    console.error("Error in /reset:", err);
    return jsonResponse(
      {
        success: false,
        error: "Error updating egress policies, please try again",
      },
      500
    );
  }
}

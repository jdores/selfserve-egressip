import { Env, ZeroTrustListItem, EgressLocation, CurrentAssignment, ListMembership } from "./types";

const API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * Add an email to a Zero Trust Gateway list.
 */
export async function addToList(env: Env, listId: string, email: string): Promise<void> {
  const url = `${API_BASE}/accounts/${env.CF_ACCOUNT_ID}/gateway/lists/${listId}`;
  const requestBody = { append: [{ value: email }] };

  console.log(`[API] addToList: PATCH ${url}`);
  console.log(`[API] addToList request body: ${JSON.stringify(requestBody)}`);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log(`[API] addToList response: ${response.status} ${responseText}`);

  if (!response.ok) {
    throw new Error(`Zero Trust API error (addToList): ${response.status} ${responseText}`);
  }
}

/**
 * Remove an email from a Zero Trust Gateway list.
 * Note: The "remove" field takes an array of plain strings, NOT objects.
 *
 * If the API returns 400 with "not found in list", we treat it as a no-op
 * success — the item is already gone, which is the desired end state.
 */
export async function removeFromList(env: Env, listId: string, email: string): Promise<void> {
  const url = `${API_BASE}/accounts/${env.CF_ACCOUNT_ID}/gateway/lists/${listId}`;
  const requestBody = { remove: [email] };

  console.log(`[API] removeFromList: PATCH ${url}`);
  console.log(`[API] removeFromList request body: ${JSON.stringify(requestBody)}`);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log(`[API] removeFromList response: ${response.status} ${responseText}`);

  if (!response.ok) {
    // Treat "not found in list" as a no-op — the item is already gone
    if (response.status === 400 && responseText.includes("not found in list")) {
      console.log(`[API] removeFromList: item not in list, treating as no-op`);
      return;
    }
    throw new Error(`Zero Trust API error (removeFromList): ${response.status} ${responseText}`);
  }
}

/**
 * Get all items in a Zero Trust Gateway list.
 */
export async function getListItems(env: Env, listId: string): Promise<string[]> {
  const emails: string[] = [];
  let page = 1;

  // The API uses page-based pagination (page, per_page, total_pages)
  while (true) {
    const params = new URLSearchParams();
    params.set("page", String(page));

    const url = `${API_BASE}/accounts/${env.CF_ACCOUNT_ID}/gateway/lists/${listId}/items?${params.toString()}`;

    console.log(`[API] getListItems: GET ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();
    console.log(`[API] getListItems response: ${response.status} ${responseText.substring(0, 500)}`);

    if (!response.ok) {
      throw new Error(`Zero Trust API error (getListItems): ${response.status} ${responseText}`);
    }

    const data = JSON.parse(responseText) as {
      result: ZeroTrustListItem[];
      result_info?: { page?: number; per_page?: number; total_pages?: number; total_count?: number };
    };

    for (const item of data.result || []) {
      emails.push(item.value);
    }

    const totalPages = data.result_info?.total_pages ?? 1;
    if (page >= totalPages) {
      break;
    }
    page++;
  }

  return emails;
}

/**
 * Fetch all list memberships from the API.
 * Returns a Map of listId -> ListMembership (name + emails).
 */
export async function getAllListMemberships(
  env: Env,
  locations: EgressLocation[]
): Promise<Map<string, ListMembership>> {
  const memberships = new Map<string, ListMembership>();

  for (const loc of locations) {
    const emails = await getListItems(env, loc.id);
    memberships.set(loc.id, { name: loc.name, emails });
  }

  return memberships;
}

/**
 * Find which list a user is currently on by scanning all lists.
 * Returns null if the user is not on any list (default).
 */
export function findUserInMemberships(
  email: string,
  locations: EgressLocation[],
  memberships: Map<string, ListMembership>
): CurrentAssignment | null {
  for (const loc of locations) {
    const membership = memberships.get(loc.id);
    if (membership && membership.emails.includes(email)) {
      return { locationName: loc.name, listId: loc.id };
    }
  }
  return null;
}

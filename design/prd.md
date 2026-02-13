# PRD — Self-Serve Egress Location Selector

## 1. Overview

### Problem Statement
Cloudflare WARP users currently have no way to self-select their egress location. An administrator must manually assign users to Zero Trust Gateway lists that correspond to egress policies, which doesn't scale and creates unnecessary support burden.

### Proposed Solution
A Cloudflare Worker-based web application, protected by Cloudflare Access, that lets authenticated users pick their preferred egress location from a set of pre-configured options. The Worker reads and updates the Zero Trust Gateway lists directly via API — the API is the sole source of truth, with no caching layer.

### Target User Persona
- **End user:** A Cloudflare WARP user within the organization who needs to change their egress location (e.g., for geo-testing, compliance, or regional access).
- **Admin:** An internal administrator who needs visibility into current assignments and the ability to manually override them.

### How It Works — Egress Policies and Zero Trust Lists

Cloudflare Gateway supports **egress policies** that route outbound traffic from WARP users through specific dedicated egress IPs at specific geolocations. Each egress policy is configured with:

- A **dedicated egress IPv4/IPv6** address at a specific geolocation (e.g., `8.29.230.206` in Hounslow, GB for UK egress)
- An **identity filter** that determines which users match the policy — specifically, a condition like "User Email in list `self-serve-egressip-uk`"

The admin manually creates these egress policies in the Cloudflare dashboard (one per location). Each policy is linked to a **Zero Trust list** of type "User Emails". The mapping is:

| Egress Policy | Dedicated Egress IP | Geolocation | Zero Trust List |
|---|---|---|---|
| Self-serve egress → UK | 8.29.230.206 | Hounslow, GB | `self-serve-egressip-uk` |
| Self-serve egress → PT | 8.29.231.207 | Montijo, PT | `self-serve-egressip-pt` |
| Self-serve egress → DE | 8.29.230.207 | Dreieich, DE | `self-serve-egressip-de` |
| Self-serve egress → US/NY | 104.30.162.103 | New York, US | `self-serve-egressip-us-ny` |
| Self-serve egress → JP | 8.29.109.45 | Narita, JP | `self-serve-egressip-jp` |

**When a user selects a location** in this app, the Worker adds the user's email to the corresponding Zero Trust list via API. This causes the user to match the egress policy associated with that list, and their WARP traffic egresses through the dedicated IP and geolocation of that policy. Users not on any list fall through to the default Cloudflare egress behavior (nearest IP).

The following screenshots show the admin-configured egress policies and lists in the Cloudflare dashboard:

**Egress policies overview** — Each policy has a dedicated IPv4 and geolocation:

![Egress Policies](design/references/egresspolicies01.png)

**Egress policy detail** — Shows the identity filter matching users whose email is in the corresponding Zero Trust list (`self-serve-egressip-uk`), plus the egress IPs:

![Egress Policy Detail](design/references/egresspolicies02.png)

**Zero Trust lists** — The "User Emails" lists that the Worker manages via API:

![Zero Trust Lists](design/references/zerotrustlist02.png)

---

## 2. Technical Architecture

### System Diagram

```
┌───────────────┐     ┌────────────────────┐     ┌────────────────────────────────┐
│    Browser    │────▶│  Cloudflare Access  │────▶│       Cloudflare Worker        │
│  (User/Admin) │     │   (JWT injection)   │     │  selfservegress.jdores.xyz     │
└───────────────┘     └────────────────────┘     │                                │
│  Routes:                       │
│    GET  /                      │
│    GET  /whoami                │
│    POST /select                │
│    POST /reset                 │
│    GET  /admin                 │
│    GET  /admin/logs            │
│    POST /admin/assign          │
│    POST /admin/remove          │
                                                  │                                │
                                                  │  Cron Trigger:                 │
                                                  │    Daily 00:00 UTC             │
                                                  │    (audit log cleanup)         │
                                                  │                                │
                                                   └──────────────┬──────────┬───┘
                                                                      │          │
                                                                      ▼          ▼
                                                           ┌────────┐ ┌─────────────┐
                                                           │   D1   │ │  CF Zero    │
                                                           │ (self- │ │  Trust      │
                                                           │ serve- │ │  Gateway    │
                                                           │ gress) │ │  Lists API  │
                                                           └────────┘ └─────────────┘
```

### Cloudflare Services Used

| Service | Purpose |
|---|---|
| **Workers** | Hosts the application — serves HTML UI and handles all API routes in a single Worker |
| **D1** (`selfservegress`) | SQLite database for the audit log — stores time-ordered, queryable records of all state-changing actions |
| **Cloudflare Access** | Authentication layer — injects a JWT with the user's email into every request. Two Access applications configured manually: one for `/` (all users) and one for `/admin` (admins only) |
| **Zero Trust Gateway Lists API** | The sole source of truth for list membership. Every page load and action reads the live list state from the API. No caching layer. |

### Data Model

**Zero Trust Gateway Lists (source of truth)**

The Worker reads live list membership via `GET /gateway/lists/{list_id}/items` on every request. User assignment is determined by scanning all configured lists for the user's email. There is no local cache — the API is always authoritative.

**D1 Database: `selfservegress`**

Table: `audit_log`

| Column | Type | Description |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Auto-incrementing row ID |
| `timestamp` | `TEXT NOT NULL` | ISO 8601 timestamp (e.g., `2026-02-13T14:30:00Z`) |
| `actor` | `TEXT NOT NULL` | Email of the person who performed the action |
| `action` | `TEXT NOT NULL` | One of: `select`, `reset`, `admin_assign`, `admin_remove` |
| `target_email` | `TEXT` | Email of the user whose assignment changed (same as `actor` for self-service; `NULL` for `admin_sync`) |
| `assigned_to` | `TEXT` | Location name the user was assigned to (NULL if reset/remove) |
| `removed_from` | `TEXT` | Location name the user was removed from (NULL if none) |
| `details` | `TEXT` | Additional context (e.g., sync reconciliation summary as JSON) |

Indexes:
- `CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp)` — for ordered queries and retention cleanup
- `CREATE INDEX idx_audit_log_actor ON audit_log(actor)` — for filtering by actor
- `CREATE INDEX idx_audit_log_target ON audit_log(target_email)` — for filtering by target user

D1 schema initialization SQL (run via `wrangler d1 execute`):

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_email TEXT,
  assigned_to TEXT,
  removed_from TEXT,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_email);
```

**Wrangler Environment Variable:**

| Variable | Type | Value |
|---|---|---|
| `EGRESS_LOCATIONS` | `string` (JSON) | `'[{"id":"d7e99b05-a207-4ae1-981a-9db2f6a12298","name":"United Kingdom"},{"id":"bbea2d64-c173-4558-a314-6aaf7acde9d1","name":"Germany"},{"id":"a0832bb1-4da8-4a66-b9c5-32b5963b48a1","name":"United States (New York)"},{"id":"67a93ec7-9970-4c87-a537-a7ce6ec70277","name":"Japan"},{"id":"04eeb115-ccf0-47f1-9e7f-9bc67c7a122e","name":"Portugal"}]'` |

**Configuring `EGRESS_LOCATIONS`:**

The `EGRESS_LOCATIONS` variable in `wrangler.toml` must be edited to match the Zero Trust lists and egress policies that have been pre-configured in the Cloudflare dashboard. Each entry maps a Zero Trust list to a user-facing location name:

- `id` — The UUID of the Zero Trust list (found in the Cloudflare dashboard under Gateway > Lists, or via the API). This is the list the Worker will add/remove user emails from.
- `name` — The human-readable location name displayed in the UI (e.g., "United Kingdom", "Japan"). This should match the geolocation of the corresponding egress policy.

Before deploying, the admin must:
1. Create the Zero Trust lists (type "User Emails") in the Cloudflare dashboard — one per egress location.
2. Create the egress policies (under Gateway > Egress Policies) — each with a dedicated egress IP, geolocation, and an identity filter set to "User Email in list" pointing to the corresponding Zero Trust list.
3. Copy each list's UUID from the dashboard and update the `EGRESS_LOCATIONS` JSON array in `wrangler.toml` with the correct `id` and `name` pairs.

**Wrangler Secrets (set via `wrangler secret put`):**

| Secret | Purpose |
|---|---|
| `CF_ACCOUNT_ID` | Cloudflare account ID for API calls |
| `CF_API_TOKEN` | API token with Zero Trust: Edit permissions |

### API Design

All routes are served by a single Worker. JSON API routes return `Content-Type: application/json`.

---

#### `GET /`
Serves the main HTML page. Extracts the user email from the `Cf-Access-Jwt-Assertion` header (base64-decode the JWT payload, read the `email` claim). Reads all Zero Trust lists via API to determine the user's current assignment. Renders the UI with the current selection highlighted.

**Response:** `200 OK` — HTML page
**Error:** `401 Unauthorized` — if no valid Access JWT header is present (plain JSON error)

---

#### `GET /whoami`
Returns the user's current observed location and IP address, derived from Cloudflare's `request.cf` metadata and the `CF-Connecting-IP` header. Used by the location widget on the user page. No authentication required (the data is about the request itself, not a user record).

**Success Response:** `200 OK`
```json
{
  "success": true,
  "ip": "203.0.113.42",
  "city": "London",
  "country": "GB",
  "region": "England",
  "timezone": "Europe/London",
  "colo": "LHR"
}
```

---

#### `POST /select`
Assigns the user to a new egress location.

**Request Body:**
```json
{
  "listId": "d7e99b05-a207-4ae1-981a-9db2f6a12298"
}
```

**Logic:**
1. Extract user email from JWT header.
2. Read all Zero Trust lists via API to find current assignment (if any).
3. If user is already on a different list, call the Zero Trust API to remove the email from the old list.
4. Call the Zero Trust API to add the email to the new list.
5. Return success with details of what changed.

**Success Response:** `200 OK`
```json
{
  "success": true,
  "assignedTo": "United Kingdom",
  "removedFrom": "Germany"
}
```

**Success Response (no previous assignment):** `200 OK`
```json
{
  "success": true,
  "assignedTo": "United Kingdom",
  "removedFrom": null
}
```

**Error Response:** `500 Internal Server Error`
```json
{
  "success": false,
  "error": "Error updating egress policies, please try again"
}
```

**Error:** `401 Unauthorized` — if no valid Access JWT header is present

---

#### `POST /reset`
Removes the user from all egress lists (returns to default).

**Request Body:** None required.

**Logic:**
1. Extract user email from JWT header.
2. Read all Zero Trust lists via API to find current assignment (if any).
3. If user is assigned to a list, call the Zero Trust API to remove the email from that list.
4. Return success.

**Success Response:** `200 OK`
```json
{
  "success": true,
  "removedFrom": "Germany"
}
```

**Success Response (was already on default):** `200 OK`
```json
{
  "success": true,
  "removedFrom": null
}
```

**Error Response:** `500 Internal Server Error`
```json
{
  "success": false,
  "error": "Error updating egress policies, please try again"
}
```

**Error:** `401 Unauthorized`

---

#### `GET /admin`
Serves the admin HTML page. Reads live list memberships from the Zero Trust API for all configured locations. Displays all locations with their assigned users.

**Response:** `200 OK` — HTML page
**Error:** `401 Unauthorized`

---

#### `POST /admin/assign`
Admin manually assigns a user to a location. Reads live state from the API, removes from old list if needed, adds to new list. Same logic as `POST /select` but the email is provided in the request body instead of extracted from JWT.

**Request Body:**
```json
{
  "email": "user@example.com",
  "listId": "d7e99b05-a207-4ae1-981a-9db2f6a12298"
}
```

**Validation:**
- `email` must be a valid email format. If not: `400 Bad Request` with `{ "success": false, "error": "Invalid email address" }`.
- `listId` must match one of the configured `EGRESS_LOCATIONS`. If not: `400 Bad Request` with `{ "success": false, "error": "Invalid location" }`.

**Success Response:** `200 OK`
```json
{
  "success": true,
  "email": "user@example.com",
  "assignedTo": "United Kingdom",
  "removedFrom": "Germany"
}
```

**Error Response:** `500 Internal Server Error`
```json
{
  "success": false,
  "error": "Error updating egress policies, please try again"
}
```

**Error:** `401 Unauthorized`

---

#### `POST /admin/remove`
Admin removes a user from their current location (back to default).

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Validation:**
- `email` must be a valid email format. If not: `400 Bad Request` with `{ "success": false, "error": "Invalid email address" }`.

**Success Response:** `200 OK`
```json
{
  "success": true,
  "email": "user@example.com",
  "removedFrom": "United Kingdom"
}
```

**Error Response:** `500 Internal Server Error`
```json
{
  "success": false,
  "error": "Error updating egress policies, please try again"
}
```

**Error:** `401 Unauthorized`

---

#### `GET /admin/logs`
Returns paginated audit log entries, newest first.

**Query Parameters:**
- `cursor` (optional) — the `id` of the last entry from the previous page. Omit for the first page.
- `limit` (optional) — number of entries to return. Default: `50`. Max: `100`.

**Success Response:** `200 OK`
```json
{
  "success": true,
  "entries": [
    {
      "id": 42,
      "timestamp": "2026-02-13T14:30:00Z",
      "actor": "admin@example.com",
      "action": "admin_assign",
      "targetEmail": "user@example.com",
      "assignedTo": "United Kingdom",
      "removedFrom": "Germany",
      "details": null
    }
  ],
  "nextCursor": 41,
  "hasMore": true
}
```

**Response when no more entries:** `200 OK`
```json
{
  "success": true,
  "entries": [],
  "nextCursor": null,
  "hasMore": false
}
```

**Error:** `401 Unauthorized`

---

#### Cron Trigger: Audit Log Cleanup

**Schedule:** `0 0 * * *` (daily at 00:00 UTC)

**Logic:**
1. Delete all rows from `audit_log` where `timestamp` is older than 90 days.
2. Log the number of deleted rows to the console.

**SQL:**
```sql
DELETE FROM audit_log WHERE timestamp < datetime('now', '-90 days');
```

---

### Zero Trust Gateway Lists API Usage

**Add an email to a list:**
```
PATCH /accounts/{account_id}/gateway/lists/{list_id}
```
```json
{
  "append": [
    { "value": "user@example.com" }
  ]
}
```

**Remove an email from a list:**
```
PATCH /accounts/{account_id}/gateway/lists/{list_id}
```
```json
{
  "remove": [
    "user@example.com"
  ]
}
```

**Get all items in a list:**
```
GET /accounts/{account_id}/gateway/lists/{list_id}/items?page=1
```
The response uses page-based pagination (`page`, `per_page`, `total_pages`, `total_count`). The Worker iterates through all pages to collect the full membership.

---

## 3. Functional Requirements

| ID | Description | Acceptance Criteria | Priority |
|---|---|---|---|
| FR-001 | **User email extraction** — Extract the authenticated user's email from the `Cf-Access-Jwt-Assertion` header by base64-decoding the JWT payload and reading the `email` claim. The email is normalized to lowercase to prevent case-sensitivity issues with Zero Trust list operations. | Email is correctly extracted and lowercased on every request. Requests without the header return `401`. | P0 |
| FR-002 | **Display egress locations** — The main page (`/`) shows a button for each location configured in `EGRESS_LOCATIONS`, plus a "Default" button to reset. | All configured locations render as clickable buttons. The "Default" button is visually distinct. | P0 |
| FR-003 | **Show current assignment** — The main page highlights which location the user is currently assigned to (or "Default" if none). | Current assignment is determined by reading all Zero Trust lists via API. The corresponding button is visually highlighted on page load. | P0 |
| FR-004 | **Select egress location** — When a user clicks a location button, the Worker reads live list state from the API, removes them from any previous list, and adds them to the selected list. | After clicking, the user sees their new selection highlighted. The Zero Trust list is updated. The debug panel shows the assignment and removal details. | P0 |
| FR-005 | **Reset to default** — When a user clicks the "Default" button, the Worker reads live list state from the API and removes them from their current list (if any). | After clicking, no location is highlighted. Zero Trust list is updated. | P0 |
| FR-006 | **Debug panel** — A collapsible dropdown in the footer shows: the user's email address, and after any action, the name of the list the user was assigned to and removed from (or "N/A" if none). | Debug panel is collapsed by default. Shows email on load. Shows assignment/removal info after each action. | P0 |
| FR-007 | **Error handling** — If any Zero Trust API call fails, display the inline error message "Error updating egress policies, please try again" and allow the user to retry. | Error message appears inline on failure. User can click the same button again to retry. UI does not enter a broken state. | P0 |
| FR-008 | **Admin dashboard** — `GET /admin` shows all locations with their assigned users. Data is read live from the Zero Trust API on every page load. | Admin page lists every location and its users, fetched directly from the API. | P0 |
| FR-009 | *(Removed — sync is no longer needed since the API is the sole source of truth)* | | |
| FR-010 | **Admin manual assignment** — Admins can assign any email to any location from `/admin`. | Admin enters an email and selects a location. The Worker reads live state, updates the Zero Trust list. The admin UI refreshes to show the change. | P1 |
| FR-011 | **Admin remove user** — Admins can remove a user from their current location from `/admin`. | Admin clicks remove on a user. The Worker reads live state, removes the email from the Zero Trust list. The admin UI refreshes to show the change. | P1 |
| FR-012 | **Unauthenticated request handling** — Requests without a valid `Cf-Access-Jwt-Assertion` header return `401 Unauthorized`. | All routes return `401` with a JSON error body when the header is missing or the payload cannot be decoded. | P0 |
| FR-013 | **Audit logging** — Every state-changing action (`select`, `reset`, `admin_assign`, `admin_remove`) writes a row to the `audit_log` table in D1 with actor, action, target, and details. | After any successful state change, a corresponding audit log entry exists in D1 with correct fields. | P0 |
| FR-014 | **Audit log admin view** — The `/admin` page has a "Logs" tab that displays the last 50 audit log entries in a table (newest first) with a "Load more" button for pagination. | Clicking the "Logs" tab fetches entries from `GET /admin/logs`. "Load more" appends the next page. Entries display timestamp, actor, action, target, assigned-to, removed-from, and details. | P1 |
| FR-015 | **Audit log retention** — A Cron Trigger runs daily at 00:00 UTC and deletes audit log entries older than 90 days. | Entries older than 90 days are automatically deleted. The Cron Trigger logs the number of deleted rows to the console. | P1 |
| FR-016 | **User location widget** — The main page displays a card showing the user's current observed location (city, region, country) and IP address, derived from Cloudflare `request.cf` metadata. A refresh button re-fetches `GET /whoami` to update the display, allowing users to confirm their egress location changed after selecting a new one. | Widget loads automatically on page load. Shows city, region, country, IP, and colo. Refresh button re-fetches without a page reload. | P1 |

---

## 4. Non-Functional Requirements

### Performance Targets
- **Page load (GET /):** < 3s (reads all 5 Zero Trust lists via API to determine current assignment). UI should show a loading state during this time.
- **Action (POST /select, /reset):** < 5s (reads all lists + remove + add via Zero Trust API). UI should show a loading state during this time.
- **Admin page load:** < 5s (reads all 5 lists via API to display current memberships).

### Security Requirements
- **Authentication:** Cloudflare Access handles authentication. The Worker validates the presence of the `Cf-Access-Jwt-Assertion` header and extracts the email from the payload. No signature validation is performed (Access has already validated the token).
- **Authorization:** Two separate Access applications (configured manually): one for `/` (all authorized users) and one for `/admin` (admins only).
- **Secrets:** `CF_ACCOUNT_ID` and `CF_API_TOKEN` are stored as Worker secrets via `wrangler secret put`. They must never appear in code, config files, or logs. The `account_id` field is intentionally omitted from `wrangler.toml` — Wrangler resolves the account from the `CLOUDFLARE_ACCOUNT_ID` environment variable or interactive prompt at deploy time.
- **Input validation:** All user-provided inputs (email, listId) are validated before use.

### Observability
- **Workers Logs (Observability):** Enabled via `[observability]` in `wrangler.toml` with `head_sampling_rate = 1` (100% of requests logged). Invocation logs, `console.log` output, errors, and uncaught exceptions are automatically collected and viewable in the Cloudflare dashboard under Workers > Observability. Logs are retained for 7 days (paid plan).
- **Console logging:** Key events (assignment changes, errors, API call details) are logged via `console.log` and automatically captured by Workers Logs.
- **Audit log:** All state-changing actions are persisted to D1 with actor, action, target, and details. Viewable via the admin "Logs" tab. Retained for 90 days.
- **Error responses:** All errors return structured JSON with `success: false` and an `error` message.

### Rate Limiting / Abuse Prevention
- Cloudflare Access is the primary gate — only authenticated users can reach the Worker.
- No additional rate limiting is needed given the low expected volume.

---

## 5. Implementation Plan

### File / Directory Structure

```
project-root/
├── design/                    # Design docs (not deployed)
│   ├── rules.md
│   ├── prd-creator.md
│   ├── initial-idea.md
│   ├── prd.md
│   ├── change-request.md
│   ├── changelog.md
│   ├── references/
│   └── assets/
├── src/
│   ├── index.ts               # Worker entry point — request router + cron handler
│   ├── auth.ts                # JWT email extraction from Access header
│   ├── api.ts                 # Zero Trust Gateway Lists API client + live state helpers
│   ├── db.ts                  # D1 audit log helpers (insert, query, cleanup)
│   ├── handlers/
│   │   ├── user.ts            # Handlers for GET /, POST /select, POST /reset
│   │   └── admin.ts           # Handlers for GET /admin, GET /admin/logs, POST /admin/assign, POST /admin/remove
│   ├── ui/
│   │   ├── user-page.ts       # HTML template for the user-facing page
│   │   └── admin-page.ts      # HTML template for the admin page (with tabs: Assignments, Logs)
│   └── types.ts               # TypeScript type definitions
├── schema.sql                 # D1 schema initialization SQL
├── wrangler.toml              # Worker config — locations, D1 binding, custom domain
├── package.json
├── tsconfig.json
├── LICENSE
└── .gitignore
```

### Tech Stack

- **Runtime:** Cloudflare Workers
- **Language:** TypeScript
- **Build:** Wrangler (no additional bundler needed)
- **Dependencies:** None — zero external dependencies. All HTML/CSS is generated inline.

### Implementation Tasks (ordered)

| Task | Scope | Dependencies | PR Description |
|---|---|---|---|
| **T1: Project scaffolding** | `wrangler.toml`, `package.json`, `tsconfig.json`, `.gitignore`, `LICENSE`, `src/index.ts` (hello world), `src/types.ts`, `schema.sql` | None | Initialize the Worker project with config, TypeScript, D1 database binding, egress locations variable, custom domain config, cron trigger. Create `schema.sql` with the audit log table and indexes. Verify `wrangler deploy` works. |
| **T2: Auth & routing** | `src/index.ts`, `src/auth.ts` | T1 | Implement the request router (if/else on pathname + method). Implement `getEmailFromAccessJWT()`. Return 401 for unauthenticated requests. Return 404 for unknown routes. Add the `scheduled` event handler stub for the cron trigger. |
| **T3: API client & D1 helpers** | `src/api.ts`, `src/db.ts` | T1 | Implement the Zero Trust API client (add to list, remove from list, get list items, get all memberships, find user in memberships). Implement D1 audit log helpers (insert entry, query with cursor-based pagination, delete entries older than 90 days). |
| **T4: User page & actions** | `src/handlers/user.ts`, `src/ui/user-page.ts` | T2, T3 | Implement `GET /`, `POST /select`, `POST /reset`. Build the user-facing HTML page with location buttons, current selection highlighting, loading states, error messages, and debug panel. Write audit log entries on successful actions. |
| **T5: Admin page & actions** | `src/handlers/admin.ts`, `src/ui/admin-page.ts` | T2, T3 | Implement `GET /admin`, `POST /admin/assign`, `POST /admin/remove`. Build the admin HTML page with tabs (Assignments, Logs), user lists per location, assignment form, and remove buttons. Write audit log entries on successful actions. |
| **T6: Audit log UI & cron cleanup** | `src/handlers/admin.ts`, `src/ui/admin-page.ts`, `src/index.ts` | T5 | Implement `GET /admin/logs` with cursor-based pagination. Build the "Logs" tab UI with a table and "Load more" button. Implement the cron trigger handler that deletes entries older than 90 days. |
| **T7: Polish & deploy** | All files | T4, T5, T6 | Final UI polish, error handling review, console logging, README, and production deploy. Run `schema.sql` against D1 via `wrangler d1 execute`. Prompt user for `CF_ACCOUNT_ID` and `CF_API_TOKEN` to set via `wrangler secret put`. |

### Manual Setup Required (outside of code)

- **Zero Trust lists:** Create one Zero Trust list (type "User Emails") per egress location in the Cloudflare dashboard under Gateway > Lists. Copy each list's UUID.
- **Egress policies:** Create one egress policy per location under Gateway > Egress Policies. Each policy needs a dedicated egress IP/geolocation and an identity filter set to "User Email in list `<list-name>`".
- **`EGRESS_LOCATIONS` in `wrangler.toml`:** Update the JSON array with the list UUIDs and location names from the steps above.
- **Cloudflare Access Application (user):** Must be configured manually to protect `selfservegress.jdores.xyz` (all paths except `/admin*`), or the entire domain with a separate policy for `/admin`.
- **Cloudflare Access Application (admin):** Must be configured manually to protect `selfservegress.jdores.xyz/admin*` with a stricter policy.
- **DNS:** `selfservegress.jdores.xyz` must be proxied through Cloudflare (configured as part of the custom domain setup in `wrangler.toml`, but the DNS zone must exist).
- **D1 Database:** Created via `wrangler d1 create selfservegress` — the ID goes into `wrangler.toml`. Schema initialized via `wrangler d1 execute selfservegress --file=schema.sql`.
- **Secrets:** `CF_ACCOUNT_ID` and `CF_API_TOKEN` set via `wrangler secret put`. For deploys, set `CLOUDFLARE_ACCOUNT_ID` as an environment variable or let Wrangler prompt interactively (since `account_id` is not in `wrangler.toml`).

---

## 6. Edge Cases & Error Handling

| Edge Case | Handling |
|---|---|
| **User clicks the same location they're already on** | No-op (detected by reading live API state). Return success with `removedFrom: null`. |
| **User clicks "Default" but is already on default** | No-op (detected by reading live API state). Return success with `removedFrom: null`. |
| **User is on a list but was added manually via dashboard** | Detected automatically since the Worker reads live API state. No sync needed. |
| **Zero Trust API returns an error on add** | Return error to the user. The user's state remains unchanged. |
| **Zero Trust API returns an error on remove (during a switch)** | Return error to the user. Do not proceed with the add. The user's state remains unchanged. |
| **Email is already in the target list (duplicate add)** | The Zero Trust API handles this gracefully (no error). Proceed normally. |
| **Email is not in the source list (duplicate remove)** | The Zero Trust API returns a 400 with `"not found in list"`. The Worker treats this as a no-op success and proceeds with the rest of the operation (e.g., adding to the new list). |
| **`EGRESS_LOCATIONS` env var is malformed** | Worker should fail fast on startup with a clear console error. |
| **Zero Trust API is temporarily unavailable** | Return `500` with the standard error message. User can retry. |
| **`Cf-Access-Jwt-Assertion` header present but payload is not valid JSON** | Return `401 Unauthorized`. |
| **Admin assigns a user who is already on the same location** | No-op (detected by reading live API state). Return success. |
| **D1 write fails when inserting audit log entry** | Log the error to console but do not fail the main operation. The user action (list update) has already succeeded. Audit logging is best-effort. |
| **Cron trigger runs but D1 is temporarily unavailable** | Log the error to console. The next daily run will clean up. No data loss risk. |
| **Admin loads "Logs" tab but audit_log table is empty** | Show a "No log entries" message in the table body. |

---

## 7. Future Considerations

| Feature | Reason for Deferral |
|---|---|
| **JWT signature validation** | Not needed currently since Cloudflare Access validates the token before it reaches the Worker. Could be added later for defense-in-depth. |
| **User-friendly names / descriptions for locations** | Currently locations are named after cities/countries. Could add descriptions like "Use for accessing UK-only services". |
| **Bulk admin operations** | Import/export CSV of user assignments. Not needed at current scale. |
| **Rate limiting** | Not needed at current volume. Could add Workers Rate Limiting if user base grows significantly. |
| **Notification on assignment change** | Email or Slack notification when a user's egress changes. Deferred — adds external dependency. |
| **KV caching layer** | Re-introduce KV as a read cache for list memberships to reduce API calls and improve page load times. Deferred until user volume justifies the added complexity and desync risk. |

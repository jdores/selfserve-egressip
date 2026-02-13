# Changelog

## 2026-02-13 — CR-001: Initial implementation

Full implementation of the Self-Serve Egress Location Selector per the PRD.

### Files created
- `package.json` — Project config with dev dependencies (wrangler, typescript, @cloudflare/workers-types)
- `tsconfig.json` — TypeScript configuration targeting ES2022 with Workers types
- `wrangler.toml` — Worker config with KV binding, D1 binding, custom domain, cron trigger, EGRESS_LOCATIONS env var
- `schema.sql` — D1 schema for audit_log table with 3 indexes
- `LICENSE` — MIT license
- `README.md` — Project documentation with setup instructions
- `src/types.ts` — TypeScript type definitions (Env, EgressLocation, UserAssignment, LocationCache, AuditLogEntry, API response types)
- `src/index.ts` — Worker entry point with request router (8 routes) and cron handler
- `src/auth.ts` — JWT email extraction from Cf-Access-Jwt-Assertion header
- `src/api.ts` — Zero Trust Gateway Lists API client (addToList, removeFromList, getListItems)
- `src/kv.ts` — KV helpers for user assignments and location cache
- `src/db.ts` — D1 audit log helpers (insert, query with cursor pagination, cleanup)
- `src/handlers/user.ts` — Handlers for GET /, POST /select, POST /reset
- `src/handlers/admin.ts` — Handlers for GET /admin, POST /admin/sync, POST /admin/assign, POST /admin/remove, GET /admin/logs
- `src/ui/user-page.ts` — User-facing HTML template with location buttons, active state, loading, error handling, debug panel
- `src/ui/admin-page.ts` — Admin HTML template with Assignments tab (sync, assign form, user tables) and Logs tab (paginated audit log)

### Files modified
- `.gitignore` — Added node_modules/, dist/, .wrangler/, .dev.vars, *.pem, *.key

### Requirements covered
FR-001 through FR-015 (all functional requirements from the PRD)

## 2026-02-13 — CR-002: Update wrangler

Updated wrangler from v3.114.17 to v4.65.0 to resolve deprecation warnings.

### Files modified
- `package.json` — Updated wrangler dependency from `^3.109.2` to `^4.65.0`

## 2026-02-13 — CR-003: Fix location switching + add API debug logging

**Root cause:** The `removeFromList` function was sending `{ remove: [{ value: email }] }` but the Cloudflare Zero Trust Gateway Lists PATCH API expects the `remove` field to be an array of plain strings: `{ remove: ["email"] }`. The `append` field correctly uses objects (`[{ value: email }]`), so the initial assignment to a list worked, but switching (which requires a remove) failed.

**Fix:** Changed `removeFromList` in `src/api.ts` to send `{ remove: [email] }` instead of `{ remove: [{ value: email }] }`.

**Debug logging:** Added full API request/response logging:
- Console logs (`wrangler tail`) for every API call with method, URL, request body, and response status+body
- Debug panel in the user-facing page now shows an "API Calls" section after each action with full request/response details
- API responses are included in the JSON response from `/select` and `/reset` under the `apiDebug` field

### Files modified
- `src/api.ts` — Fixed `remove` body format; added `ApiDebugLog` interface, `getApiDebugLogs()`, `clearApiDebugLogs()`, and console logging for all API calls
- `src/handlers/user.ts` — Import debug log helpers; clear/attach API debug logs in `/select` and `/reset` responses
- `src/ui/user-page.ts` — Added `renderApiDebug()` and `esc()` JS functions; added `#debug-api` container in debug panel; wired up API debug rendering after each action
- `design/prd.md` — Corrected `remove` API body format from `[{ value }]` to `[string]`; updated FR-006 to include API debug info

### Requirements covered
- CR-003, FR-006, FR-007

## 2026-02-13 — CR-003b: Fix "not found in list" error on location switch

**Root cause:** The Cloudflare Zero Trust Gateway Lists API returns HTTP 400 with `"item to be removed, <email>, not found in list"` when you try to remove an item that doesn't exist in a list. The PRD incorrectly assumed the API handles duplicate removes gracefully. This caused failures when KV said a user was on a list but the user wasn't actually in that list (KV/API state desync).

**Fix:** `removeFromList` in `src/api.ts` now checks if a 400 response contains `"not found in list"` and treats it as a no-op success instead of throwing. This allows the subsequent add operation to proceed normally.

### Files modified
- `src/api.ts` — Added "not found in list" 400 handling as no-op in `removeFromList`
- `design/prd.md` — Corrected edge case table: "Email is not in the source list" now documents the 400 behavior and the Worker's no-op handling

### Requirements covered
- CR-003b, FR-004, FR-007

## 2026-02-13 — CR-003c: Fix list item pagination and email normalization

**Root causes:** Two bugs identified by comparing real Cloudflare API responses with the Worker code:

1. **`getListItems` pagination was broken.** The code used cursor-based pagination (`result_info.cursors.after`) but the Zero Trust Gateway Lists Items API returns page-based pagination (`page`, `per_page`, `total_pages`, `total_count`). Since `cursors.after` was always undefined, only the first page (50 items max) was ever retrieved. This caused admin sync to write incomplete KV state, which then caused subsequent user operations to target wrong lists or skip removals.

2. **No email case normalization.** Emails extracted from the JWT or entered by admins were used as-is, but Zero Trust list values are case-sensitive. A casing mismatch (e.g., `Jose@jdores.xyz` vs `jose@jdores.xyz`) would cause the `remove` API call to silently fail to match.

**Fixes:**
- `src/api.ts`: Rewrote `getListItems` to use page-based pagination — iterates through pages using `page` parameter and `total_pages` from `result_info`.
- `src/auth.ts`: Added `.toLowerCase()` to the extracted email to normalize casing.
- `src/handlers/admin.ts`: Added `.toLowerCase()` to admin-entered email inputs in `handleAdminAssign` and `handleAdminRemove`.

### Files modified
- `src/api.ts` — Fixed `getListItems` pagination from cursor-based to page-based
- `src/auth.ts` — Normalize extracted email to lowercase
- `src/handlers/admin.ts` — Normalize admin-entered emails to lowercase
- `design/prd.md` — Updated `getListItems` API docs to document page-based pagination; updated FR-001 to document email normalization

### Requirements covered
- CR-003c, FR-001, FR-008, FR-009

## 2026-02-13 — CR-004: Remove KV, use Zero Trust API as sole source of truth

**Motivation:** The KV caching layer was the root cause of multiple desync bugs (CR-003b, CR-003c). Rapid button clicks could cause race conditions where KV state diverged from the actual Zero Trust list state, leading to users being added to multiple lists or not removed from old ones. For a PoC with few users, the added latency of reading from the API on every request is negligible, while the elimination of the entire desync class of bugs is a major reliability win.

**Architecture change:** Removed KV entirely. The Zero Trust Gateway Lists API is now the sole source of truth. Every page load and action reads the live list memberships from the API before making changes. No local caching.

**Changes:**
- Deleted `src/kv.ts` entirely
- Removed KV namespace binding from `wrangler.toml`
- Removed `KV` from `Env` interface in `src/types.ts`
- Removed `UserAssignment`, `LocationCache`, `SyncResponse` types; added `CurrentAssignment`, `ListMembership`
- Added `getAllListMemberships()` and `findUserInMemberships()` helpers to `src/api.ts`
- Rewrote `src/handlers/user.ts` — all handlers now read live API state before each action
- Rewrote `src/handlers/admin.ts` — removed `handleAdminSync` and `performSync`; all handlers read live API state
- Removed `POST /admin/sync` route from `src/index.ts`
- Updated `src/ui/user-page.ts` — changed `UserAssignment` to `CurrentAssignment`
- Updated `src/ui/admin-page.ts` — changed `LocationCache` to `ListMembership`; removed "Sync from API" button
- Comprehensively updated `design/prd.md` to reflect the new architecture

### Files deleted
- `src/kv.ts`

### Files modified
- `src/types.ts` — Removed KV-related types, added `CurrentAssignment` and `ListMembership`
- `src/api.ts` — Added `getAllListMemberships()` and `findUserInMemberships()` helpers
- `src/handlers/user.ts` — Rewrote to read live API state instead of KV
- `src/handlers/admin.ts` — Rewrote to read live API state; removed sync handler
- `src/index.ts` — Removed `/admin/sync` route
- `src/ui/user-page.ts` — Updated type import
- `src/ui/admin-page.ts` — Updated type import; removed sync button
- `wrangler.toml` — Removed KV namespace binding
- `design/prd.md` — Major update: removed all KV references, updated architecture diagram, data model, route descriptions, functional requirements, edge cases, performance targets

### Requirements covered
- CR-004, FR-003, FR-004, FR-005, FR-008, FR-010, FR-011

## 2026-02-13 — CR-005: Enable Workers Observability

Enabled Workers Logs (Observability) so that invocation logs, `console.log` output, errors, and uncaught exceptions are automatically captured and viewable in the Cloudflare dashboard under Workers > Observability. Configured with 100% sampling rate.

Also updated `README.md` to reflect the current architecture — removed all stale KV and sync references from CR-004.

### Files modified
- `wrangler.toml` — Added `[observability]` section with `enabled = true` and `head_sampling_rate = 1`
- `design/prd.md` — Updated Observability section to document Workers Logs
- `README.md` — Rewrote to reflect current architecture (no KV, no sync route, added observability)

### Requirements covered
- CR-005

## 2026-02-13 — CR-006: User location widget

Added a "Your current location" widget to the user page so users can see where their traffic is egressing from and confirm it changed after selecting a new location. The widget displays city, region, country, IP address, and Cloudflare colo derived from `request.cf` metadata. A new `GET /whoami` JSON route was added to support client-side refresh without a full page reload.

### Files modified
- `src/index.ts` — Added `GET /whoami` route
- `src/handlers/user.ts` — Added `handleWhoami` handler returning `request.cf` location data as JSON
- `src/ui/user-page.ts` — Added location widget with auto-load on init and refresh button; added `fetchWhoami()` JS function
- `design/prd.md` — Updated to document `GET /whoami` route, location widget, and `request.cf` metadata usage
- `design/change-request.md` — Moved CR-006 to Finalized
- `README.md` — Updated route table to include `GET /whoami`

### Requirements covered
- CR-006

## 2026-02-13 — CR-007: Remove API calls from debug dropdown

Removed the API request/response debug logging from the user page debug panel. The debug panel still shows the user's email and assignment/removal details, but no longer renders raw API call information. Console-level API logging (`console.log`) is retained for Workers Observability.

### Files modified
- `src/api.ts` — Removed `ApiDebugLog` interface, `debugLogs` array, `getApiDebugLogs()`, `clearApiDebugLogs()`, and all `debugLogs.push()` calls
- `src/handlers/user.ts` — Removed imports of `getApiDebugLogs`/`clearApiDebugLogs`, removed `clearApiDebugLogs()` calls, removed `apiDebug` field from all JSON responses
- `src/ui/user-page.ts` — Removed `renderApiDebug()` function, `esc()` helper, `#debug-api` container, and `renderApiDebug(data.apiDebug)` calls in `selectLocation()` and `resetLocation()`
- `design/prd.md` — Updated FR-006 to remove API call details from debug panel description
- `README.md` — Updated debug panel feature description

### Requirements covered
- CR-007, FR-006

## 2026-02-13 — CR-008: Improve documentation

Added a "How It Works" section to both the PRD and README explaining how the app controls user egress locations. Documents the relationship between egress policies (each with a dedicated IP and geolocation), Zero Trust lists (type "User Emails"), and the Worker (which adds/removes emails from lists via API). Includes three screenshots from the Cloudflare dashboard showing the egress policies overview, a policy's detail panel with the identity filter, and the Zero Trust lists.

Note: The CR referenced `zerotrustlist01.png` but the actual file in `design/references/` is `zerotrustlist02.png`. Used the correct filename.

### Files modified
- `design/prd.md` — Added "How It Works — Egress Policies and Zero Trust Lists" subsection in the Overview with a mapping table and three embedded screenshots
- `README.md` — Added "How It Works" section with the same explanation, mapping table, and screenshots
- `design/change-request.md` — Moved CR-008 to Finalized

### Requirements covered
- CR-008
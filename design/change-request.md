# Change Requests

> **Instructions for the LLM:** When processing this file, implement each outstanding change request in order. For each one:
> 1. Ask clarifying questions if anything is ambiguous — do not assume.
> 2. Check `design/references/` for any supporting context (images, logs, screenshots) mentioned in the request.
> 3. Check `design/assets/` for any app files (images, fonts, static files) that need to be integrated into the project. Always keep the originals in `design/assets/`.
> 4. Implement the code changes in `src/`.
> 5. Update `design/prd.md` to reflect the change.
> 6. Move the completed request from **Outstanding** to **Finalized** below.
> 7. Update `README.md` to reflect the current state of the project.
> 8. Append an entry to `design/changelog.md`.

---

## Outstanding

<!-- Add change requests here using the format below:

### CR-001: Short title
**Priority:** P0 / P1 / P2
**Description:** What needs to change and why.
**References:** (optional) List any files in design/references/ that provide context.
**Assets:** (optional) List any files in design/assets/ to integrate into the project.
**Acceptance criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

-->
---

*(No outstanding change requests)*

## Finalized

### CR-010: Improve documentation — EGRESS_LOCATIONS configuration
**Description:** Added documentation to both the PRD and README explaining that `EGRESS_LOCATIONS` in `wrangler.toml` must be edited with the Zero Trust list UUIDs and location names that correspond to the egress policies pre-configured in the Cloudflare dashboard. Added a new "Configure egress locations" setup step to the README with instructions for creating lists, egress policies, and updating `wrangler.toml`. Updated the PRD data model section with a "Configuring EGRESS_LOCATIONS" subsection and added Zero Trust lists and egress policies to the Manual Setup section.
**Status:** Completed — 2026-02-13

### CR-009: Remove account_id from wrangler.toml
**Description:** Removed the `account_id` line from `wrangler.toml` since `CF_ACCOUNT_ID` is already set as a Worker secret. Wrangler resolves the account from the `CLOUDFLARE_ACCOUNT_ID` environment variable at deploy time, or prompts interactively. Updated the PRD security section and manual setup instructions, and updated the README deploy step to show the env var approach.
**Status:** Completed — 2026-02-13

### CR-008: Improve documentation
**Description:** Added a "How It Works" section to both `design/prd.md` and `README.md` explaining the relationship between egress policies, Zero Trust lists, and the Worker. Documents how each egress policy has a dedicated IP and geolocation and is matched by an identity filter tied to a Zero Trust list. When the Worker adds a user's email to a list, the user matches the corresponding egress policy and egresses through that policy's dedicated IP. Includes screenshots from the Cloudflare dashboard (`egresspolicies01.png`, `egresspolicies02.png`, `zerotrustlist02.png`).
**References:** `design/references/egresspolicies01.png`, `design/references/egresspolicies02.png`, `design/references/zerotrustlist02.png`
**Status:** Completed — 2026-02-13

### CR-007: Remove API calls from the debug dropdown
**Description:** Removed the API request/response debug logging from the debug panel in the user page. The debug panel still shows the user's email and assignment/removal info, but no longer displays raw API call details. Also removed the `ApiDebugLog` interface, `getApiDebugLogs()`/`clearApiDebugLogs()` helpers from `api.ts`, the `apiDebug` field from all JSON responses, and the `renderApiDebug()`/`esc()` JS functions from the user page template. Console-level API logging (via `console.log`) is retained for Workers Observability.
**Status:** Completed — 2026-02-13

### CR-006: User location widget
**Description:** Added a "Your current location" widget to the user page that displays the user's observed city, region, country, IP address, and Cloudflare colo, derived from `request.cf` metadata. A refresh button re-fetches `GET /whoami` so users can confirm their egress changed after selecting a new location. The widget loads automatically on page init. Added `GET /whoami` route returning this data as JSON.
**Status:** Completed — 2026-02-13

### CR-005: Workers observability
**Description:** Enabled Workers Observability by adding `[observability]` config to `wrangler.toml` with `enabled = true` and `head_sampling_rate = 1` (100%). Invocation logs, `console.log` output, errors, and uncaught exceptions are now automatically captured and viewable in the Cloudflare dashboard under Workers > Observability (7-day retention on paid plan). Also updated README.md to reflect the current architecture (removed stale KV references).
**Status:** Completed — 2026-02-13

### CR-004: Remove KV, use API as sole source of truth
**Description:** Removed KV caching layer entirely. The Zero Trust Gateway Lists API is now the sole source of truth for list membership. Every page load and action reads live state from the API before making changes. This eliminates the entire class of KV/API desync bugs that caused CR-003b and CR-003c. Removed `POST /admin/sync` route and sync UI button (no longer needed). Acceptable latency tradeoff for a PoC with few users.
**Status:** Completed — 2026-02-13

### CR-003c: Location update failed 03
**Description:** Fixed two bugs identified from real Cloudflare API examples: (1) `getListItems` used cursor-based pagination (`result_info.cursors.after`) but the actual API returns page-based pagination (`page`, `per_page`, `total_pages`). This meant only the first 50 items were ever read, causing admin sync to produce incomplete KV state, which then caused subsequent user operations to malfunction. Fixed to use page-based iteration. (2) Added email normalization (lowercase) in JWT extraction and admin inputs to prevent case-sensitivity mismatches with Zero Trust list values.
**Status:** Completed — 2026-02-13

### CR-001: Initial deployment
**Description:** Implement the PRD.
**Status:** Completed — 2026-02-13

### CR-002: Update wrangler
**Description:** Updated wrangler from v3.114.17 to v4.65.0 to resolve deprecation warnings.
**Status:** Completed — 2026-02-13

### CR-003: Location update failed
**Description:** Fixed bug where switching between egress locations failed. Root cause: the `remove` field in the Zero Trust Gateway Lists PATCH API expects an array of plain strings (`["email"]`), not an array of objects (`[{ value: "email" }]`). Also added full API request/response debug logging to the debug panel and Worker console logs.
**References:** `design/references/locationfail01.png`
**Status:** Completed — 2026-02-13

### CR-003b: Location update failed 02
**Description:** Fixed bug where switching locations failed when KV said the user was on a list but the user wasn't actually in that list (KV/API state desync). Root cause: the Zero Trust API returns HTTP 400 with `"not found in list"` when you try to remove an item that doesn't exist — it does NOT handle this gracefully. Fix: `removeFromList` now treats a 400 with `"not found in list"` as a no-op success instead of throwing an error, allowing the subsequent add to proceed.
**References:** `design/references/locationfail02.png`
**Status:** Completed — 2026-02-13

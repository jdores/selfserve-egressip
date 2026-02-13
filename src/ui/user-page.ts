import { EgressLocation, CurrentAssignment } from "../types";

export function renderUserPage(
  email: string,
  locations: EgressLocation[],
  currentAssignment: CurrentAssignment | null
): string {
  const locationButtons = locations
    .map((loc) => {
      const isActive = currentAssignment?.listId === loc.id;
      return `
        <button
          class="location-btn${isActive ? " active" : ""}"
          data-list-id="${loc.id}"
          data-name="${escapeHtml(loc.name)}"
          onclick="selectLocation('${loc.id}', '${escapeJs(loc.name)}')"
          ${isActive ? 'aria-current="true"' : ""}
        >
          <span class="location-name">${escapeHtml(loc.name)}</span>
          ${isActive ? '<span class="badge">Active</span>' : ""}
        </button>`;
    })
    .join("\n");

  const isDefault = !currentAssignment;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Egress Location</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f7fa;
      color: #1a1a2e;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .container {
      max-width: 640px;
      margin: 0 auto;
      padding: 48px 24px;
      flex: 1;
      width: 100%;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }

    .subtitle {
      font-size: 1.1rem;
      color: #6b7280;
      margin-bottom: 32px;
    }

    /* Location widget */
    .whoami-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .whoami-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .whoami-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .whoami-location {
      font-size: 1rem;
      font-weight: 600;
      color: #1a1a2e;
    }

    .whoami-ip {
      font-size: 0.85rem;
      color: #6b7280;
      font-family: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
      word-break: break-all;
    }

    .whoami-refresh {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      font-size: 1rem;
      color: #6b7280;
    }

    .whoami-refresh:hover {
      background: #f3f4f6;
      border-color: #d1d5db;
      color: #374151;
    }

    .whoami-refresh.spinning svg {
      animation: spin 0.6s linear infinite;
    }

    .locations {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .location-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      background: #fff;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      color: #1a1a2e;
      transition: all 0.15s ease;
      width: 100%;
      text-align: left;
    }

    .location-btn:hover {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .location-btn.active {
      border-color: #3b82f6;
      background: #eff6ff;
      box-shadow: 0 0 0 1px #3b82f6;
    }

    .location-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .badge {
      background: #3b82f6;
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .default-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border: 2px dashed #d1d5db;
      border-radius: 12px;
      background: #fafafa;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      color: #6b7280;
      transition: all 0.15s ease;
      width: 100%;
      text-align: left;
      margin-top: 4px;
    }

    .default-btn:hover {
      border-color: #9ca3af;
      background: #f3f4f6;
    }

    .default-btn.active {
      border-color: #6b7280;
      background: #f3f4f6;
      color: #1a1a2e;
      box-shadow: 0 0 0 1px #6b7280;
    }

    .default-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .error-msg {
      display: none;
      background: #fef2f2;
      color: #dc2626;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 0.9rem;
      margin-top: 16px;
      border: 1px solid #fecaca;
    }

    .error-msg.visible {
      display: block;
    }

    .loading-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(255, 255, 255, 0.7);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }

    .loading-overlay.visible {
      display: flex;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Debug panel */
    footer {
      border-top: 1px solid #e5e7eb;
      background: #fff;
    }

    .debug-toggle {
      display: block;
      width: 100%;
      padding: 12px 24px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.8rem;
      color: #9ca3af;
      text-align: left;
    }

    .debug-toggle:hover {
      color: #6b7280;
    }

    .debug-content {
      display: none;
      padding: 0 24px 16px;
      font-size: 0.8rem;
      color: #6b7280;
      font-family: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
      line-height: 1.6;
    }

    .debug-content.visible {
      display: block;
    }

    .debug-content p {
      margin-bottom: 4px;
    }

    .debug-label {
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="loading-overlay" id="loading">
    <div class="spinner"></div>
  </div>

  <div class="container">
    <h1>Egress Location</h1>
    <p class="subtitle">Select your preferred egress location</p>

    <div class="whoami-card" id="whoami-card">
      <div class="whoami-info">
        <span class="whoami-label">Your current location</span>
        <span class="whoami-location" id="whoami-location">Loading...</span>
        <span class="whoami-ip" id="whoami-ip"></span>
      </div>
      <button class="whoami-refresh" id="whoami-refresh" onclick="refreshWhoami()" title="Refresh location">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 1v5h5"/>
          <path d="M15 15v-5h-5"/>
          <path d="M13.5 6A6 6 0 0 0 3 3.5L1 6"/>
          <path d="M2.5 10A6 6 0 0 0 13 12.5l2-2.5"/>
        </svg>
      </button>
    </div>

    <div class="locations">
      ${locationButtons}

      <button
        class="default-btn${isDefault ? " active" : ""}"
        id="default-btn"
        onclick="resetLocation()"
        ${isDefault ? 'aria-current="true"' : ""}
      >
        <span class="location-name">Default</span>
        ${isDefault ? '<span class="badge" style="background:#6b7280">Active</span>' : ""}
      </button>
    </div>

    <div class="error-msg" id="error-msg">
      Error updating egress policies, please try again
    </div>
  </div>

  <footer>
    <button class="debug-toggle" onclick="toggleDebug()">Debug Info ▸</button>
    <div class="debug-content" id="debug-content">
      <p><span class="debug-label">Email:</span> ${escapeHtml(email)}</p>
      <p><span class="debug-label">Assigned to:</span> <span id="debug-assigned">${currentAssignment ? escapeHtml(currentAssignment.locationName) : "N/A"}</span></p>
      <p><span class="debug-label">Removed from:</span> <span id="debug-removed">N/A</span></p>
    </div>
  </footer>

  <script>
    let debugOpen = false;

    function toggleDebug() {
      debugOpen = !debugOpen;
      const el = document.getElementById('debug-content');
      const btn = document.querySelector('.debug-toggle');
      if (debugOpen) {
        el.classList.add('visible');
        btn.textContent = 'Debug Info ▾';
      } else {
        el.classList.remove('visible');
        btn.textContent = 'Debug Info ▸';
      }
    }

    function setLoading(on) {
      const el = document.getElementById('loading');
      if (on) el.classList.add('visible');
      else el.classList.remove('visible');

      // Disable all buttons
      document.querySelectorAll('.location-btn, .default-btn').forEach(b => b.disabled = on);
    }

    function showError(show) {
      const el = document.getElementById('error-msg');
      if (show) el.classList.add('visible');
      else el.classList.remove('visible');
    }

    function updateUI(assignedTo, removedFrom, activeListId) {
      // Update buttons
      document.querySelectorAll('.location-btn').forEach(btn => {
        const id = btn.getAttribute('data-list-id');
        const isActive = id === activeListId;
        btn.classList.toggle('active', isActive);
        if (isActive) {
          btn.setAttribute('aria-current', 'true');
          btn.innerHTML = '<span class="location-name">' + btn.getAttribute('data-name') + '</span><span class="badge">Active</span>';
        } else {
          btn.removeAttribute('aria-current');
          btn.innerHTML = '<span class="location-name">' + btn.getAttribute('data-name') + '</span>';
        }
      });

      // Update default button
      const defaultBtn = document.getElementById('default-btn');
      const isDefault = !activeListId;
      defaultBtn.classList.toggle('active', isDefault);
      if (isDefault) {
        defaultBtn.setAttribute('aria-current', 'true');
        defaultBtn.innerHTML = '<span class="location-name">Default</span><span class="badge" style="background:#6b7280">Active</span>';
      } else {
        defaultBtn.removeAttribute('aria-current');
        defaultBtn.innerHTML = '<span class="location-name">Default</span>';
      }

      // Update debug
      document.getElementById('debug-assigned').textContent = assignedTo || 'N/A';
      document.getElementById('debug-removed').textContent = removedFrom || 'N/A';
    }

    async function selectLocation(listId, name) {
      showError(false);
      setLoading(true);
      try {
        const res = await fetch('/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listId })
        });
        const data = await res.json();
        if (!data.success) {
          showError(true);
          return;
        }
        updateUI(data.assignedTo, data.removedFrom, listId);
      } catch {
        showError(true);
      } finally {
        setLoading(false);
      }
    }

    async function resetLocation() {
      showError(false);
      setLoading(true);
      try {
        const res = await fetch('/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (!data.success) {
          showError(true);
          return;
        }
        updateUI(null, data.removedFrom, null);
      } catch {
        showError(true);
      } finally {
        setLoading(false);
      }
    }

    // --- Whoami location widget ---
    async function refreshWhoami() {
      const btn = document.getElementById('whoami-refresh');
      const locEl = document.getElementById('whoami-location');
      const ipEl = document.getElementById('whoami-ip');

      btn.classList.add('spinning');
      try {
        const res = await fetch('/whoami');
        const data = await res.json();
        if (data.success) {
          const parts = [];
          if (data.city) parts.push(data.city);
          if (data.region) parts.push(data.region);
          if (data.country) parts.push(data.country);
          locEl.textContent = parts.length > 0 ? parts.join(', ') : 'Unknown';

          const ipParts = [];
          if (data.ip) ipParts.push(data.ip);
          if (data.colo) ipParts.push('(' + data.colo + ')');
          ipEl.textContent = ipParts.join(' ');
        } else {
          locEl.textContent = 'Error loading location';
          ipEl.textContent = '';
        }
      } catch {
        locEl.textContent = 'Error loading location';
        ipEl.textContent = '';
      } finally {
        btn.classList.remove('spinning');
      }
    }

    // Load on page init
    refreshWhoami();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(str: string): string {
  return str.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
}

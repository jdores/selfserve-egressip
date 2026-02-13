import { EgressLocation, ListMembership } from "../types";

export function renderAdminPage(
  locations: EgressLocation[],
  locationData: Map<string, ListMembership>
): string {
  const locationSections = locations
    .map((loc) => {
      const membership = locationData.get(loc.id);
      const emails = membership?.emails || [];
      const userRows = emails.length > 0
        ? emails
            .map(
              (email) => `
            <tr>
              <td>${escapeHtml(email)}</td>
              <td>
                <button class="remove-btn" onclick="removeUser('${escapeJs(email)}')">Remove</button>
              </td>
            </tr>`
            )
            .join("")
        : `<tr><td colspan="2" class="empty-row">No users assigned</td></tr>`;

      return `
        <div class="location-section">
          <h3>${escapeHtml(loc.name)} <span class="user-count">(${emails.length})</span></h3>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th style="width:100px">Action</th>
              </tr>
            </thead>
            <tbody>
              ${userRows}
            </tbody>
          </table>
        </div>`;
    })
    .join("\n");

  const locationOptions = locations
    .map((loc) => `<option value="${loc.id}">${escapeHtml(loc.name)}</option>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — Egress Location</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f7fa;
      color: #1a1a2e;
      min-height: 100vh;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 48px 24px;
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
      margin-bottom: 24px;
    }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 0;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 24px;
    }

    .tab-btn {
      padding: 10px 20px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 500;
      color: #6b7280;
      transition: all 0.15s ease;
    }

    .tab-btn:hover { color: #1a1a2e; }

    .tab-btn.active {
      color: #3b82f6;
      border-bottom-color: #3b82f6;
    }

    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* Toolbar */
    .toolbar {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .btn {
      padding: 8px 16px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      transition: all 0.15s ease;
    }

    .btn:hover { background: #f9fafb; border-color: #9ca3af; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-primary {
      background: #3b82f6;
      color: #fff;
      border-color: #3b82f6;
    }

    .btn-primary:hover { background: #2563eb; }

    /* Assign form */
    .assign-form {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .assign-form input,
    .assign-form select {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
      background: #fff;
    }

    .assign-form input { width: 260px; }
    .assign-form select { width: 220px; }

    /* Tables */
    .location-section {
      margin-bottom: 24px;
    }

    .location-section h3 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .user-count { color: #9ca3af; font-weight: 400; }

    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    th {
      text-align: left;
      padding: 10px 16px;
      background: #f9fafb;
      font-size: 0.8rem;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    td {
      padding: 10px 16px;
      border-top: 1px solid #f3f4f6;
      font-size: 0.9rem;
    }

    .empty-row {
      color: #9ca3af;
      font-style: italic;
      text-align: center;
    }

    .remove-btn {
      padding: 4px 12px;
      border: 1px solid #fecaca;
      border-radius: 6px;
      background: #fff;
      color: #dc2626;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .remove-btn:hover { background: #fef2f2; }

    /* Audit log table */
    .log-table th, .log-table td {
      font-size: 0.8rem;
      padding: 8px 12px;
    }

    .log-table td { font-family: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace; }

    .load-more-row td {
      text-align: center;
      padding: 16px;
    }

    /* Status messages */
    .status-msg {
      display: none;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 0.9rem;
      margin-bottom: 16px;
    }

    .status-msg.visible { display: block; }
    .status-msg.success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .status-msg.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

    /* Loading */
    .loading-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(255, 255, 255, 0.7);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }

    .loading-overlay.visible { display: flex; }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loading-overlay" id="loading">
    <div class="spinner"></div>
  </div>

  <div class="container">
    <h1>Admin Dashboard</h1>
    <p class="subtitle">Manage egress location assignments</p>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('assignments')">Assignments</button>
      <button class="tab-btn" onclick="switchTab('logs')">Logs</button>
    </div>

    <div class="status-msg" id="status-msg"></div>

    <!-- Assignments Tab -->
    <div class="tab-content active" id="tab-assignments">
      <div class="toolbar">
        <div class="assign-form">
          <input type="email" id="assign-email" placeholder="user@example.com" />
          <select id="assign-location">
            <option value="">Select location...</option>
            ${locationOptions}
          </select>
          <button class="btn btn-primary" onclick="assignUser()">Assign</button>
        </div>
      </div>

      <div id="location-list">
        ${locationSections}
      </div>
    </div>

    <!-- Logs Tab -->
    <div class="tab-content" id="tab-logs">
      <table class="log-table" id="log-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Target</th>
            <th>Assigned To</th>
            <th>Removed From</th>
          </tr>
        </thead>
        <tbody id="log-body">
          <tr><td colspan="6" class="empty-row">Loading...</td></tr>
        </tbody>
      </table>
      <div style="text-align:center; margin-top:16px;">
        <button class="btn" id="load-more-btn" onclick="loadMoreLogs()" style="display:none;">Load more</button>
      </div>
    </div>
  </div>

  <script>
    let logsCursor = null;
    let logsLoaded = false;

    function setLoading(on) {
      const el = document.getElementById('loading');
      if (on) el.classList.add('visible');
      else el.classList.remove('visible');
    }

    function showStatus(msg, type) {
      const el = document.getElementById('status-msg');
      el.textContent = msg;
      el.className = 'status-msg visible ' + type;
      setTimeout(() => { el.classList.remove('visible'); }, 4000);
    }

    function switchTab(tab) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      document.querySelector('[onclick="switchTab(\\'' + tab + '\\')"]').classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');

      if (tab === 'logs' && !logsLoaded) {
        loadLogs();
      }
    }

    async function assignUser() {
      const email = document.getElementById('assign-email').value.trim();
      const listId = document.getElementById('assign-location').value;

      if (!email) { showStatus('Please enter an email address', 'error'); return; }
      if (!listId) { showStatus('Please select a location', 'error'); return; }

      setLoading(true);
      try {
        const res = await fetch('/admin/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, listId })
        });
        const data = await res.json();
        if (data.success) {
          showStatus('Assigned ' + data.email + ' to ' + data.assignedTo, 'success');
          document.getElementById('assign-email').value = '';
          document.getElementById('assign-location').value = '';
          // Reload to refresh assignment lists
          setTimeout(() => location.reload(), 500);
        } else {
          showStatus(data.error || 'Assignment failed', 'error');
        }
      } catch {
        showStatus('Error updating egress policies, please try again', 'error');
      } finally {
        setLoading(false);
      }
    }

    async function removeUser(email) {
      if (!confirm('Remove ' + email + ' from their current location?')) return;

      setLoading(true);
      try {
        const res = await fetch('/admin/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
          showStatus('Removed ' + data.email + ' from ' + (data.removedFrom || 'default'), 'success');
          setTimeout(() => location.reload(), 500);
        } else {
          showStatus(data.error || 'Remove failed', 'error');
        }
      } catch {
        showStatus('Error updating egress policies, please try again', 'error');
      } finally {
        setLoading(false);
      }
    }

    async function loadLogs() {
      logsLoaded = true;
      logsCursor = null;

      try {
        const res = await fetch('/admin/logs');
        const data = await res.json();
        if (data.success) {
          renderLogs(data.entries, false);
          logsCursor = data.nextCursor;
          document.getElementById('load-more-btn').style.display = data.hasMore ? 'inline-block' : 'none';
        }
      } catch {
        document.getElementById('log-body').innerHTML = '<tr><td colspan="6" class="empty-row">Error loading logs</td></tr>';
      }
    }

    async function loadMoreLogs() {
      if (!logsCursor) return;

      try {
        const res = await fetch('/admin/logs?cursor=' + logsCursor);
        const data = await res.json();
        if (data.success) {
          renderLogs(data.entries, true);
          logsCursor = data.nextCursor;
          document.getElementById('load-more-btn').style.display = data.hasMore ? 'inline-block' : 'none';
        }
      } catch {
        showStatus('Error loading logs', 'error');
      }
    }

    function renderLogs(entries, append) {
      const tbody = document.getElementById('log-body');
      if (!append) tbody.innerHTML = '';

      if (entries.length === 0 && !append) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No log entries</td></tr>';
        return;
      }

      for (const e of entries) {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + esc(formatTimestamp(e.timestamp)) + '</td>' +
          '<td>' + esc(e.actor) + '</td>' +
          '<td>' + esc(e.action) + '</td>' +
          '<td>' + esc(e.target_email || 'N/A') + '</td>' +
          '<td>' + esc(e.assigned_to || 'N/A') + '</td>' +
          '<td>' + esc(e.removed_from || 'N/A') + '</td>';
        tbody.appendChild(tr);
      }
    }

    function formatTimestamp(ts) {
      try {
        return new Date(ts).toLocaleString();
      } catch {
        return ts;
      }
    }

    function esc(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
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
  return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

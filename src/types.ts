// Cloudflare Worker environment bindings
export interface Env {
  DB: D1Database;
  EGRESS_LOCATIONS: string;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

// Parsed egress location from EGRESS_LOCATIONS env var
export interface EgressLocation {
  id: string;
  name: string;
}

// Result of scanning all lists for a user's current assignment
export interface CurrentAssignment {
  locationName: string;
  listId: string;
}

// Snapshot of all list memberships (listId -> emails)
export interface ListMembership {
  name: string;
  emails: string[];
}

// Audit log entry stored in D1
export interface AuditLogEntry {
  id: number;
  timestamp: string;
  actor: string;
  action: "select" | "reset" | "admin_assign" | "admin_remove";
  target_email: string | null;
  assigned_to: string | null;
  removed_from: string | null;
  details: string | null;
}

// Zero Trust API list item
export interface ZeroTrustListItem {
  value: string;
}

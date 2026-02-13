/**
 * Extract the user's email from the Cf-Access-Jwt-Assertion header.
 * The JWT payload is the second dot-separated segment, base64url-encoded.
 * We do NOT validate the signature — Cloudflare Access has already done that.
 */
export function getEmailFromAccessJWT(request: Request): string | null {
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) return null;

  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;

    // base64url → base64 → decode
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const decoded = atob(payload);
    const parsed = JSON.parse(decoded);

    if (typeof parsed.email !== "string" || parsed.email.length === 0) {
      return null;
    }

    // Normalize to lowercase — Cloudflare list values are case-sensitive,
    // so we must ensure consistent casing for add/remove operations.
    return parsed.email.toLowerCase();
  } catch {
    return null;
  }
}

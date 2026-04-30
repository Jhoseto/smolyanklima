/**
 * Simple in-memory sliding window rate limiter for public POST endpoints.
 * Suitable for single-instance / low traffic; replace with Redis for scale.
 */

type Bucket = { resetAt: number; count: number };

const buckets = new Map<string, Bucket>();

function windowKey(clientId: string, windowMs: number) {
  const slot = Math.floor(Date.now() / windowMs);
  return `${clientId}:${slot}`;
}

export function allowPublicPost(clientId: string, maxPerWindow: number, windowMs: number): boolean {
  const key = windowKey(clientId, windowMs);
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { resetAt: now + windowMs, count: 1 });
    return true;
  }
  if (existing.count >= maxPerWindow) return false;
  existing.count += 1;
  return true;
}

export function getClientIdFromRequest(req: { headers: Headers }) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || forwardedFor;
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

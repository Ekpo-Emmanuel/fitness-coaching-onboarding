export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export type RateLimiter = {
  take(key: string): Promise<RateLimitResult>;
};

type Bucket = { count: number; resetAt: number };

export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = () => Date.now(),
  ) {}

  async take(key: string): Promise<RateLimitResult> {
    const now = this.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true };
    }
    if (current.count >= this.limit) {
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
    }
    current.count += 1;
    return { ok: true };
  }
}

const publicSubmitLimiter = new MemoryRateLimiter(20, 60_000);

export function publicSubmitRateLimiter(): RateLimiter {
  return publicSubmitLimiter;
}

export function clientIp(request: Request, trustForwarded: boolean) {
  if (trustForwarded) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function submitRateKey(ip: string, slug: string) {
  return `submit:${ip}:${slug}`;
}

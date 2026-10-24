// Small in-memory limiter: a per-minute burst window plus a per-day cap.
// It protects the API key from runaway clients; it is not a billing system.
export class RateLimiter {
  constructor({ perMinute, perDay, now = () => Date.now() }) {
    this.perMinute = perMinute;
    this.perDay = perDay;
    this.now = now;
    this.minute = new Map();
    this.day = { key: "", count: 0 };
  }

  check(clientId) {
    const t = this.now();
    const dayKey = new Date(t).toISOString().slice(0, 10);
    if (this.day.key !== dayKey) this.day = { key: dayKey, count: 0 };
    if (this.day.count >= this.perDay) {
      return { allowed: false, reason: "daily", retryAfter: Math.ceil((Date.parse(dayKey) + 86_400_000 - t) / 1000) };
    }

    const recent = (this.minute.get(clientId) ?? []).filter((ts) => t - ts < 60_000);
    if (recent.length >= this.perMinute) {
      this.minute.set(clientId, recent);
      return { allowed: false, reason: "minute", retryAfter: Math.ceil((60_000 - (t - recent[0])) / 1000) };
    }
    recent.push(t);
    this.minute.set(clientId, recent);
    this.day.count += 1;
    return { allowed: true, remainingToday: this.perDay - this.day.count };
  }
}

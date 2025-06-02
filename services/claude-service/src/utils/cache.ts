interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  constructor(defaultTTLSeconds = 300) { // 5 minutes default
    this.defaultTTL = defaultTTLSeconds * 1000;
  }

  set(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats
  getStats() {
    this.cleanup(); // Clean up before calculating stats
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Global caches for different data types
export const sessionCache = new SimpleCache<any>(60); // 1 minute for sessions
export const runCache = new SimpleCache<any>(300); // 5 minutes for runs
export const statsCache = new SimpleCache<any>(30); // 30 seconds for statistics

// Helper function to cache resolver results
export async function withCache<T>(
  cache: SimpleCache<T>,
  key: string,
  fn: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const result = await fn();
  cache.set(key, result, ttlSeconds);
  return result;
}
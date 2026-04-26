type CacheEntry<T> = {
  data: T;
  expiry: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 1000 * 60 * 2;

export function getCacheKey(key: string, params: Record<string, unknown>) {
  return `${key}:${JSON.stringify(params)}`;
}

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setCache<T>(
  key: string,
  data: T,
  ttl: number = DEFAULT_TTL_MS
) {
  cache.set(key, {
    data,
    expiry: Date.now() + ttl,
  });
}

export function clearReportingCache() {
  cache.clear();
}

export function clearReportingCacheWithLog(reason?: string) {
  cache.clear();

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[reporting-cache] cleared${reason ? `: ${reason}` : ""}`
    );
  }
}
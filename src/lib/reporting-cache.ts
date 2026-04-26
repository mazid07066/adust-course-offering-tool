type CacheEntry<T> = {
  data: T;
  expiry: number;
};

const cache = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL_MS = 1000 * 60 * 2; // 2 minutes

export function getCacheKey(key: string, params: Record<string, any>) {
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
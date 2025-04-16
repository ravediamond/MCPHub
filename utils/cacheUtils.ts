/**
 * A simple in-memory cache implementation with TTL support
 */

interface CacheOptions {
    ttl: number; // Time to live in milliseconds
}

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

export class MemoryCache {
    private static instance: MemoryCache;
    private cache: Map<string, CacheEntry<any>>;
    private cleanupInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.cache = new Map();
        // Run cleanup every minute to remove expired items
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }

    public static getInstance(): MemoryCache {
        if (!MemoryCache.instance) {
            MemoryCache.instance = new MemoryCache();
        }
        return MemoryCache.instance;
    }

    /**
     * Set a value in the cache with a TTL
     */
    public set<T>(key: string, value: T, options: CacheOptions): void {
        const expiresAt = Date.now() + options.ttl;
        this.cache.set(key, { value, expiresAt });
    }

    /**
     * Get a value from the cache
     * Returns undefined if the key doesn't exist or has expired
     */
    public get<T>(key: string): T | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            return undefined;
        }

        // Check if the entry has expired
        if (entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.value as T;
    }

    /**
     * Remove a specific key from the cache
     */
    public delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear all entries from the cache
     */
    public clear(): void {
        this.cache.clear();
    }

    /**
     * Remove all expired items from the cache
     */
    private cleanup(): void {
        const now = Date.now();
        // Fix for TypeScript iterator issue - convert to array first
        const keysToCheck = Array.from(this.cache.keys());

        for (const key of keysToCheck) {
            const entry = this.cache.get(key);
            if (entry && entry.expiresAt < now) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Ensure cache is cleaned up when the app shuts down
     */
    public dispose(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// Export a singleton instance
export const cache = MemoryCache.getInstance();

/**
 * A wrapper function to implement a cache-first strategy
 * Will fetch from the cache if available, otherwise call the fetcher function and cache the result
 */
export async function cachedFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 3600000 // Default TTL: 1 hour
): Promise<T> {
    const cachedData = cache.get<T>(key);

    if (cachedData !== undefined) {
        return cachedData;
    }

    // Data not in cache, fetch it
    const freshData = await fetcher();
    cache.set(key, freshData, { ttl });
    return freshData;
}
import { Injectable } from '@nestjs/common';
import NodeCache from 'node-cache';

/**
 * Generic cache abstraction. Backed by an in-process node-cache store today;
 * every call site only ever uses get/set/has/del, so swapping the backing
 * store for Redis later is a single-file change here, not a call-site
 * rewrite (the methods would become Promise-returning at that point).
 */
@Injectable()
export class CacheService {
    private readonly store: NodeCache;

    constructor() {
        // stdTTL=0 — no default expiry; callers pass ttlSeconds explicitly per
        // key when one is wanted. useClones=false — some cached values (e.g. a
        // Mongoose document) don't need structured-clone-on-read/write semantics
        // and callers mutate via set() rather than in-place object mutation.
        this.store = new NodeCache({
            stdTTL: 0,
            checkperiod: 120,
            useClones: false,
        });
    }

    get<T>(key: string): T | undefined {
        return this.store.get<T>(key);
    }

    set<T>(key: string, value: T, ttlSeconds?: number): boolean {
        return ttlSeconds !== undefined
            ? this.store.set(key, value, ttlSeconds)
            : this.store.set(key, value);
    }

    has(key: string): boolean {
        return this.store.has(key);
    }

    del(key: string): number {
        return this.store.del(key);
    }
}

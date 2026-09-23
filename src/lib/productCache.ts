// The product read endpoints keep small in-process TTL caches on globalThis.
// Any route that changes `product_name` clears them, so the navbar reflects the
// change immediately instead of after the TTL expires.

/* [old]
const CACHE_KEYS = [
    "__automed_getnewproductname_cache",
    "__automed_getnavbardata_cache",
    "__automed_getproductname_cache",
];
*/
const CACHE_KEYS = [
    "__automed_getnewproductname_cache",
    "__automed_getnavbardata_cache",
    "__automed_getproductname_cache",
    "__automed_getmainproductdata_cache",
    "__automed_getsummary_cache",
    "__automed_getlasttestdata_cache",
];

export function invalidateProductCaches() {
    const globalAny = globalThis as any;
    for (const key of CACHE_KEYS) {
        const cache: Map<string, any> | undefined = globalAny[key];
        if (cache && typeof cache.clear === "function") cache.clear();
    }
}

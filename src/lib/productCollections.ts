import type { Db } from "mongodb";

// Helpers shared by the read endpoints that fan out over every subproduct
// collection. Each of them used to carry its own copy of this logic.

/** Run `fn` over `items` with at most `concurrency` in flight. */
export async function mapWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<void>,
): Promise<void> {
    let index = 0;
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
        while (index < items.length) {
            await fn(items[index++]);
        }
    });
    await Promise.all(workers);
}

/**
 * Every subproduct collection name, taken from `product_name` (cheaper than
 * listCollections). Falls back to listing collections when the registry is
 * empty, so a fresh database still reports whatever data it holds.
 */
export async function listSubProductCollections(db: Db): Promise<string[]> {
    const products = await db
        .collection("product_name")
        .find({}, { projection: { _id: 0, subProduct: 1 } })
        .toArray();

    const names = Array.from(
        new Set(
            products
                .flatMap((p: any) => (Array.isArray(p.subProduct) ? p.subProduct : []))
                .filter((n: any): n is string => typeof n === "string" && n.length > 0),
        ),
    );

    if (names.length > 0) return names;

    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    return collections.map((c) => c.name).filter((n) => n !== "product_name");
}

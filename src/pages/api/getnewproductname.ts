import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";

type Data = {
    [key: string]: any;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Data>,
) {
    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // small TTL cache: this endpoint is hit frequently by the navbar
    const CACHE_TTL_MS = 15_000;
    type CacheEntry = { expiresAt: number; value: any };
    const globalAny = globalThis as any;
    const cache: Map<string, CacheEntry> =
        globalAny.__automed_getnewproductname_cache ??
        (globalAny.__automed_getnewproductname_cache = new Map());

    const now = Date.now();
    const cached = cache.get("all");
    if (cached && cached.expiresAt > now) {
        res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
        return res.status(200).json(cached.value);
    }

    try {
        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");

        // Case-insensitive compare helper
        const ciCompare = (a: string, b: string) =>
            a.localeCompare(b, undefined, { sensitivity: "accent", caseFirst: "false" });

        // Keep payload small: only what UI needs
        let products = await db
            .collection("product_name")
            .find(
                {},
                {
                    projection: {
                        _id: 0,
                        mainProduct: 1,
                        subProduct: 1,
                    },
                },
            )
            .toArray();

        // A subproduct collection (e.g. "order") can be shared by multiple main
        // products, with documents distinguished only by the `mainproduct` field.
        // Compute the flag per (mainProduct, subProduct) pair and query with that
        // filter so the dot matches what the dashboard shows for the same product.
        const flagKey = (mainProduct: string, subName: string) =>
            `${mainProduct}::${subName}`;

        const productSubPairs = products.flatMap((p: any) => {
            const main = typeof p.mainProduct === "string" ? p.mainProduct : "";
            const subs = Array.isArray(p.subProduct) ? p.subProduct : [];
            return subs
                .filter((n: any) => typeof n === "string" && n.length > 0)
                .map((subName: string) => ({ main, subName }));
        }) as Array<{ main: string; subName: string }>;

        const flagsByPair: Record<string, "pass" | "fail" | "error"> = {};
        const sonarByPair: Record<string, boolean> = {};
        const sonarScannedByPair: Record<string, { date: string; time?: string }> = {};

        async function mapWithConcurrency<T>(
            items: T[],
            concurrency: number,
            fn: (item: T) => Promise<void>,
        ) {
            let index = 0;
            const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
                while (index < items.length) {
                    const currentIndex = index++;
                    await fn(items[currentIndex]);
                }
            });
            await Promise.all(workers);
        }

        await mapWithConcurrency(productSubPairs, 10, async ({ main, subName }) => {
            const key = flagKey(main, subName);
            try {
                // Does this product have any SonarQube data, and when was it last
                // scanned? (Sonar data may live in a different dated document than
                // the latest test results, so query it separately.)
                const sonarDoc = await db.collection(subName).findOne(
                    { mainproduct: main, "sonar.projectKey": { $exists: true } },
                    {
                        sort: { date: -1, "sonar.fetchedAtTime": -1 },
                        projection: {
                            _id: 0,
                            date: 1,
                            "sonar.fetchedAtDate": 1,
                            "sonar.fetchedAtTime": 1,
                        },
                    },
                );
                sonarByPair[key] = Boolean(sonarDoc);
                if (sonarDoc) {
                    const s = (sonarDoc as any).sonar ?? {};
                    sonarScannedByPair[key] = {
                        date: s.fetchedAtDate || (sonarDoc as any).date || "",
                        time: typeof s.fetchedAtTime === "string" ? s.fetchedAtTime : undefined,
                    };
                }

                const latest = await db.collection(subName).findOne(
                    { mainproduct: main },
                    {
                        sort: { date: -1 },
                        projection: {
                            _id: 0,
                            "nametest.fail": 1,
                            "nametest.error": 1,
                        },
                    },
                );
                if (
                    !latest ||
                    !Array.isArray((latest as any).nametest) ||
                    (latest as any).nametest.length === 0
                ) {
                    // No test data -> no status dot (leave flag unset).
                    return;
                }

                let hasFail = false;
                let hasError = false;
                for (const t of (latest as any).nametest) {
                    if (typeof t?.fail === "number" && t.fail > 0) hasFail = true;
                    if (typeof t?.error === "number" && t.error > 0) hasError = true;
                    if (hasFail && hasError) break;
                }

                // Show a single dot: error takes priority over fail.
                let flag: "pass" | "fail" | "error" = "pass";
                if (hasError) flag = "error";
                else if (hasFail) flag = "fail";

                flagsByPair[key] = flag;
            } catch {
                // ignore collection read errors and leave flag unset (no dot)
            }
        });

        // Sort subProduct arrays and main products case-insensitively
        products = products
            .map((p: any) => {
                const subs = Array.isArray(p.subProduct) ? p.subProduct.slice() : [];
                subs.sort(ciCompare);
                return { ...p, subProduct: subs };
            })
            .sort((x: any, y: any) => ciCompare(x.mainProduct, y.mainProduct));

        const mappedProducts = products.map((p: any) => {
            const subs = Array.isArray(p.subProduct)
                ? p.subProduct.map((name: string) => ({
                      name,
                      flag: flagsByPair[flagKey(p.mainProduct, name)] ?? null,
                      hasSonar: sonarByPair[flagKey(p.mainProduct, name)] ?? false,
                      sonarScannedAt: sonarScannedByPair[flagKey(p.mainProduct, name)] ?? null,
                  }))
                : [];
            return {
                mainProduct: p.mainProduct,
                subProduct: subs,
            };
        });

        const payload = { products: mappedProducts };
        cache.set("all", { expiresAt: now + CACHE_TTL_MS, value: payload });

        res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
        return res.status(200).json(payload);
    } catch {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

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

        // Determine which collections we actually need to check flags for.
        // Using product_name avoids a full listCollections scan on every request.
        const subproductNames = Array.from(
            new Set(
                products
                    .flatMap((p: any) => (Array.isArray(p.subProduct) ? p.subProduct : []))
                    .filter((n: any) => typeof n === "string" && n.length > 0),
            ),
        ) as string[];

        const flagsByCollection: Record<string, "pass" | "fail" | "error" | "all"> = {};

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

        await mapWithConcurrency(subproductNames, 10, async (col) => {
            try {
                const latest = await db.collection(col).findOne(
                    {},
                    {
                        sort: { date: -1 },
                        projection: {
                            _id: 0,
                            "nametest.fail": 1,
                            "nametest.error": 1,
                        },
                    },
                );
                if (!latest || !Array.isArray((latest as any).nametest)) {
                    flagsByCollection[col] = "pass";
                    return;
                }

                let hasFail = false;
                let hasError = false;
                for (const t of (latest as any).nametest) {
                    if (typeof t?.fail === "number" && t.fail > 0) hasFail = true;
                    if (typeof t?.error === "number" && t.error > 0) hasError = true;
                    if (hasFail && hasError) break;
                }

                let flag: "pass" | "fail" | "error" | "all" = "pass";
                if (hasFail && hasError) flag = "all";
                else if (hasFail) flag = "fail";
                else if (hasError) flag = "error";

                flagsByCollection[col] = flag;
            } catch {
                // ignore collection read errors and leave flag as pass
                flagsByCollection[col] = "pass";
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
                      flag: flagsByCollection[name] ?? "pass",
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

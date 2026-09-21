// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";

type Data = {
    [key: string]: any;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Data>
) {
    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const CACHE_TTL_MS = 15_000;
    type CacheEntry = { expiresAt: number; value: any };
    const globalAny = globalThis as any;
    const cache: Map<string, CacheEntry> =
        globalAny.__automed_getlasttestdata_cache ??
        (globalAny.__automed_getlasttestdata_cache = new Map());

    const now = Date.now();
    const cached = cache.get("all");
    if (cached && cached.expiresAt > now) {
        res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
        return res.status(200).json(cached.value);
    }

    try {
        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");
        
        const result: { [key: string]: any } = {};

        // Determine collection list from product_name (faster than listCollections)
        const products = await db
            .collection("product_name")
            .find(
                {},
                {
                    projection: {
                        _id: 0,
                        subProduct: 1,
                    },
                },
            )
            .toArray();

        let collectionNames = Array.from(
            new Set(
                products
                    .flatMap((p: any) => (Array.isArray(p.subProduct) ? p.subProduct : []))
                    .filter((n: any) => typeof n === "string" && n.length > 0),
            ),
        ) as string[];

        if (collectionNames.length === 0) {
            const collections = await db.listCollections().toArray();
            collectionNames = collections
                .map((c: any) => c.name)
                .filter((n: string) => n !== "product_name");
        }

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

        // A subproduct collection can be shared by several main products, so take
        // the latest document *per main product* and key it by "<main>::<sub>".
        await mapWithConcurrency(collectionNames, 10, async (collectionName) => {
            try {
                const latestPerMain = await db
                    .collection(collectionName)
                    .aggregate([
                        {
                            $project: {
                                _id: 0,
                                date: 1,
                                time: 1,
                                mainproduct: 1,
                                nametest: {
                                    name: 1,
                                    pass: 1,
                                    fail: 1,
                                    error: 1,
                                    time: 1,
                                },
                            },
                        },
                        { $sort: { date: -1 } },
                        {
                            $group: {
                                _id: "$mainproduct",
                                date: { $first: "$date" },
                                time: { $first: "$time" },
                                mainproduct: { $first: "$mainproduct" },
                                nametest: { $first: "$nametest" },
                            },
                        },
                    ])
                    .toArray();

                for (const doc of latestPerMain) {
                    const main = typeof doc.mainproduct === "string" ? doc.mainproduct : "";
                    const { _id, ...rest } = doc as any;
                    result[`${main}::${collectionName}`] = {
                        ...rest,
                        subproduct: collectionName,
                    };
                }
            } catch {
                // ignore per-collection errors
            }
        });

        const payload = {
            data: result,
            collectionsProcessed: collectionNames.length,
        };

        cache.set("all", { expiresAt: now + CACHE_TTL_MS, value: payload });
        res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
        return res.status(200).json(payload);

    } catch (error) {
        return res.status(500).json({ 
            error: "Internal Server Error",
            message: "Failed to retrieve latest test data"
        });
    }
}

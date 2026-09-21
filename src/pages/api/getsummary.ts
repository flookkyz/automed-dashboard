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

    try {
        const { date } = req.query;

        if (!date) {
            res.status(400).json({ error: "date query parameter is required" });
            return;
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (typeof date !== "string" || !dateRegex.test(date)) {
            return res
                .status(400)
                .json({ error: "Invalid date format. Use yyyy-mm-dd" });
        }

        const CACHE_TTL_MS = 15_000;
        type CacheEntry = { expiresAt: number; value: any };
        const globalAny = globalThis as any;
        const cache: Map<string, CacheEntry> =
            globalAny.__automed_getsummary_cache ??
            (globalAny.__automed_getsummary_cache = new Map());

        const cacheKey = `date:${date}`;
        const now = Date.now();
        const cached = cache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
            return res.status(200).json(cached.value);
        }

        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");

        // Determine collection list from product_name first (faster than listCollections).
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

        const data: { [key: string]: any } = {};

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

        // A subproduct collection can hold one document per main product for the
        // same date, so read them all and key the result by "<main>::<sub>".
        // Keys stay case-sensitive: two main products whose names differ only by
        // case are distinct products and must not collapse into one entry.
        await mapWithConcurrency(collectionNames, 10, async (collectionName) => {
            try {
                const docs = await db
                    .collection(collectionName)
                    .find(
                        { date },
                        {
                            projection: {
                                _id: 0,
                                date: 1,
                                time: 1,
                                mainproduct: 1,
                                "nametest.name": 1,
                                "nametest.pass": 1,
                                "nametest.fail": 1,
                                "nametest.error": 1,
                                "nametest.time": 1,
                                "sonar.projectKey": 1,
                                "sonar.hostUrl": 1,
                                "sonar.fetchedAtDate": 1,
                                "sonar.fetchedAtTime": 1,
                                "sonar.summary": 1,
                            },
                        },
                    )
                    .toArray();

                for (const doc of docs) {
                    const main = typeof doc.mainproduct === "string" ? doc.mainproduct : "";
                    data[`${main}::${collectionName}`] = {
                        ...doc,
                        subproduct: collectionName,
                    };
                }
            } catch {
                // ignore per-collection errors: the row simply has no cell
            }
        });

        cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, value: data });
        res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
        return res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
}

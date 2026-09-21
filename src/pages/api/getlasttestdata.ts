import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";
import { listSubProductCollections, mapWithConcurrency } from "../../lib/productCollections";

// Latest test result per (main product, sub product), keyed by "<main>::<sub>".
//
// A subproduct collection can be shared by several main products, so the newest
// document overall is not the newest for each of them -- hence the $group.

const CACHE_TTL_MS = 15_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const globalAny = globalThis as any;
    const cache: Map<string, { expiresAt: number; value: any }> =
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
        const collectionNames = await listSubProductCollections(db);

        const result: Record<string, any> = {};

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
                                nametest: { name: 1, pass: 1, fail: 1, error: 1, time: 1 },
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
                        { $project: { _id: 0 } },
                    ])
                    .toArray();

                for (const doc of latestPerMain) {
                    const main = typeof doc.mainproduct === "string" ? doc.mainproduct : "";
                    result[`${main}::${collectionName}`] = {
                        ...doc,
                        subproduct: collectionName,
                    };
                }
            } catch {
                // ignore per-collection errors: those rows simply have no latest
            }
        });

        const payload = { data: result, collectionsProcessed: collectionNames.length };

        cache.set("all", { expiresAt: now + CACHE_TTL_MS, value: payload });
        res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
        return res.status(200).json(payload);
    } catch {
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to retrieve latest test data",
        });
    }
}

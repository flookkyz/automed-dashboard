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
    const { mainproduct, subproduct } = req.query;

    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const mainproductStr = typeof mainproduct === "string" ? mainproduct : "";
    const subproductStr = typeof subproduct === "string" ? subproduct : "";
    if (!subproductStr) {
        return res.status(400).json({ error: "Missing subproduct parameter" });
    }
    if (!mainproductStr) {
        return res.status(400).json({ error: "Missing mainproduct parameter" });
    }

    const CACHE_TTL_MS = 30_000;
    type CacheEntry = { expiresAt: number; value: any };
    const globalAny = globalThis as any;
    const cache: Map<string, CacheEntry> =
        globalAny.__automed_getdatefromtest_cache ??
        (globalAny.__automed_getdatefromtest_cache = new Map());

    const cacheKey = `${mainproductStr}|${subproductStr}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
        return res.status(200).json(cached.value);
    }

    try {
        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");
        const collection = db.collection(subproductStr);

        // Return only dates: distinct avoids transferring entire documents.
        const dates = (await collection.distinct("date", {
            mainproduct: mainproductStr,
        })) as string[];

        dates.sort();

        cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, value: dates });
        res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
        return res.status(200).json(dates);
    } catch {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

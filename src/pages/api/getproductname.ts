// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
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

    const CACHE_TTL_MS = 60_000;
    type CacheEntry = { expiresAt: number; value: any };
    const globalAny = globalThis as any;
    const cache: Map<string, CacheEntry> =
        globalAny.__automed_getproductname_cache ??
        (globalAny.__automed_getproductname_cache = new Map());

    const now = Date.now();
    const cached = cache.get("all");
    if (cached && cached.expiresAt > now) {
        res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
        return res.status(200).json(cached.value);
    }

    try {
        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");
        const collections = await db.listCollections().toArray();
        const collectionNames = collections
            .filter((collection) => collection.name !== "product_name")
            .map((collection) => collection.name)
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

        const payload = { collectionNames };
        cache.set("all", { expiresAt: now + CACHE_TTL_MS, value: payload });
        res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
        return res.status(200).json(payload);
    } catch {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
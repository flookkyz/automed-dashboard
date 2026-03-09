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
    globalAny.__automed_getnavbardata_cache ??
    (globalAny.__automed_getnavbardata_cache = new Map());

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
        }
      )
      .toArray();

    const collectionNames = Array.from(
      new Set(
        products
          .flatMap((p: any) => (Array.isArray(p.subProduct) ? p.subProduct : []))
          .filter((n: any) => typeof n === "string" && n.length > 0)
      )
    ) as string[];

    async function mapWithConcurrency<T>(
      items: T[],
      concurrency: number,
      fn: (item: T) => Promise<void>
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

    await mapWithConcurrency(collectionNames, 10, async (collectionName) => {
      try {
        const latestData = await db.collection(collectionName).findOne(
          {},
          {
            sort: { date: -1 },
            projection: {
              _id: 0,
              mainproduct: 1,
              "nametest.fail": 1,
              "nametest.error": 1,
            },
          }
        );

        if (!latestData) return;

        let hasFail = false;
        let hasError = false;
        if (Array.isArray((latestData as any).nametest)) {
          for (const test of (latestData as any).nametest) {
            if (typeof test?.fail === "number" && test.fail > 0) hasFail = true;
            if (typeof test?.error === "number" && test.error > 0) hasError = true;
            if (hasFail && hasError) break;
          }
        }

        result[collectionName as any] = {
          mainproduct: (latestData as any).mainproduct,
          hasFail,
          hasError,
        };
      } catch {
        // ignore per-collection failures
      }
    });

    const payload = {
      data: result,
      length: collectionNames.length,
    };
    cache.set("all", { expiresAt: now + CACHE_TTL_MS, value: payload });

    res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to retrieve navbar data",
    });
  }
}

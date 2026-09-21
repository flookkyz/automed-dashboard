import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";
import { listSubProductCollections, mapWithConcurrency } from "../../lib/productCollections";

// Test results for one day, or for a whole date range in a single request.
//
//   GET /api/getsummary?date=YYYY-MM-DD         -> { "<main>::<sub>": doc }
//   GET /api/getsummary?from=...&to=...         -> { "YYYY-MM-DD": { "<main>::<sub>": doc } }
//
// The range form exists because the history grid needs two to four weeks at
// once: asking per day costs one query per collection *per day*, while one
// `$in` covers the whole range for the same number of queries.
//
// A subproduct collection can hold one document per main product for the same
// date, so entries are keyed by "<main>::<sub>". Keys stay case-sensitive: two
// main products whose names differ only by case are distinct products and must
// not collapse into one entry.

type DayMap = Record<string, any>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 92;
const CACHE_TTL_MS = 15_000;

const PROJECTION = {
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
} as const;

function single(value: string | string[] | undefined): string | undefined {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value[0];
    return undefined;
}

/** Inclusive list of YYYY-MM-DD keys, or null when the range is unusable. */
function buildDateRange(from: string, to: string): string[] | null {
    const start = Date.parse(`${from}T00:00:00Z`);
    const end = Date.parse(`${to}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;

    const days = Math.round((end - start) / 86_400_000) + 1;
    if (days > MAX_RANGE_DAYS) return null;

    return Array.from(
        { length: days },
        (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const date = single(req.query.date as any);
    const from = single(req.query.from as any);
    const to = single(req.query.to as any);

    let dates: string[];
    let cacheKey: string;

    if (from || to) {
        if (!from || !to || !DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
            return res.status(400).json({ error: "from and to must both be yyyy-mm-dd" });
        }
        const range = buildDateRange(from, to);
        if (!range) {
            return res
                .status(400)
                .json({ error: `Invalid range (max ${MAX_RANGE_DAYS} days, from must be <= to)` });
        }
        dates = range;
        cacheKey = `range:${from}:${to}`;
    } else {
        if (!date || !DATE_PATTERN.test(date)) {
            return res.status(400).json({ error: "date query parameter is required (yyyy-mm-dd)" });
        }
        dates = [date];
        cacheKey = `date:${date}`;
    }

    const globalAny = globalThis as any;
    const cache: Map<string, { expiresAt: number; value: any }> =
        globalAny.__automed_getsummary_cache ??
        (globalAny.__automed_getsummary_cache = new Map());

    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
        return res.status(200).json(cached.value);
    }

    try {
        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");
        const collectionNames = await listSubProductCollections(db);

        const byDate: Record<string, DayMap> = {};
        for (const d of dates) byDate[d] = {};

        await mapWithConcurrency(collectionNames, 10, async (collectionName) => {
            try {
                const docs = await db
                    .collection(collectionName)
                    .find({ date: { $in: dates } }, { projection: PROJECTION })
                    .toArray();

                for (const doc of docs) {
                    const day = byDate[doc.date as string];
                    if (!day) continue;
                    const main = typeof doc.mainproduct === "string" ? doc.mainproduct : "";
                    day[`${main}::${collectionName}`] = { ...doc, subproduct: collectionName };
                }
            } catch {
                // ignore per-collection errors: those rows simply have no cells
            }
        });

        const payload = dates.length === 1 && !from ? byDate[dates[0]] : byDate;

        cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, value: payload });
        res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
        return res.status(200).json(payload);
    } catch {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";
import { mapWithConcurrency } from "../../lib/productCollections";

// Navbar data: every main product with its subproducts, each carrying the
// status dot and SonarQube info.
//
// A subproduct collection (e.g. "order") can be shared by several main
// products, with documents distinguished only by the `mainproduct` field, so
// everything here is computed per (mainProduct, subProduct) pair.
//
// One aggregate per collection groups by `mainproduct` and hands back that
// product's documents newest-first; asking per pair instead cost roughly twice
// as many round trips for the same answer.

type Flag = "pass" | "fail" | "error";
type SonarScannedAt = { date: string; time?: string };

type PairInfo = {
    flag: Flag | null;
    hasSonar: boolean;
    sonarScannedAt: SonarScannedAt | null;
};

const CACHE_TTL_MS = 15_000;

const pairKey = (mainProduct: string, subName: string) => `${mainProduct}::${subName}`;

/** Single dot per product: error takes priority over fail. */
function flagOf(nametest: any): Flag | null {
    if (!Array.isArray(nametest) || nametest.length === 0) return null;

    let hasFail = false;
    let hasError = false;
    for (const t of nametest) {
        if (typeof t?.fail === "number" && t.fail > 0) hasFail = true;
        if (typeof t?.error === "number" && t.error > 0) hasError = true;
        if (hasFail && hasError) break;
    }

    if (hasError) return "error";
    if (hasFail) return "fail";
    return "pass";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Small TTL cache: this endpoint is hit by the navbar on every page.
    const globalAny = globalThis as any;
    const cache: Map<string, { expiresAt: number; value: any }> =
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

        const ciCompare = (a: string, b: string) =>
            a.localeCompare(b, undefined, { sensitivity: "accent", caseFirst: "false" });

        const products = await db
            .collection("product_name")
            .find({}, { projection: { _id: 0, mainProduct: 1, subProduct: 1 } })
            .toArray();

        const collectionNames = Array.from(
            new Set(
                products
                    .flatMap((p: any) => (Array.isArray(p.subProduct) ? p.subProduct : []))
                    .filter((n: any): n is string => typeof n === "string" && n.length > 0),
            ),
        );

        const infoByPair: Record<string, PairInfo> = {};

        await mapWithConcurrency(collectionNames, 10, async (collectionName) => {
            try {
                const groups = await db
                    .collection(collectionName)
                    .aggregate([
                        {
                            $project: {
                                _id: 0,
                                date: 1,
                                mainproduct: 1,
                                nametest: { fail: 1, error: 1 },
                                sonar: {
                                    projectKey: 1,
                                    fetchedAtDate: 1,
                                    fetchedAtTime: 1,
                                },
                            },
                        },
                        { $sort: { date: -1, "sonar.fetchedAtTime": -1 } },
                        { $group: { _id: "$mainproduct", docs: { $push: "$$ROOT" } } },
                    ])
                    .toArray();

                for (const group of groups) {
                    const main = group._id;
                    if (typeof main !== "string" || !main) continue;

                    const docs = group.docs as any[];
                    // Sonar results can sit in an older document than the latest
                    // test run, so the two are looked up separately.
                    const sonarDoc = docs.find((d) => d?.sonar?.projectKey);

                    infoByPair[pairKey(main, collectionName)] = {
                        flag: flagOf(docs[0]?.nametest),
                        hasSonar: Boolean(sonarDoc),
                        sonarScannedAt: sonarDoc
                            ? {
                                  date: sonarDoc.sonar.fetchedAtDate || sonarDoc.date || "",
                                  time:
                                      typeof sonarDoc.sonar.fetchedAtTime === "string"
                                          ? sonarDoc.sonar.fetchedAtTime
                                          : undefined,
                              }
                            : null,
                    };
                }
            } catch {
                // ignore collection read errors: those pairs get no dot
            }
        });

        const mappedProducts = products
            .map((p: any) => {
                const subs = (Array.isArray(p.subProduct) ? p.subProduct : [])
                    .filter((n: any): n is string => typeof n === "string" && n.length > 0)
                    .sort(ciCompare)
                    .map((name: string) => {
                        const info = infoByPair[pairKey(p.mainProduct, name)];
                        return {
                            name,
                            flag: info?.flag ?? null,
                            hasSonar: info?.hasSonar ?? false,
                            sonarScannedAt: info?.sonarScannedAt ?? null,
                        };
                    });

                return { mainProduct: p.mainProduct, subProduct: subs };
            })
            .sort((x: any, y: any) => ciCompare(x.mainProduct, y.mainProduct));

        const payload = { products: mappedProducts };
        cache.set("all", { expiresAt: now + CACHE_TTL_MS, value: payload });

        res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
        return res.status(200).json(payload);
    } catch {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

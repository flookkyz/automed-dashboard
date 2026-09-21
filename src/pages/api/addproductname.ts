import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";
import { invalidateProductCaches } from "../../lib/productCache";

// Register a main product / sub product **name only** (no test data).
//
// The dashboard normally creates these entries as a side effect of a test run
// being pushed (see addjsondata / addxmldata / addappiumdata). This route lets
// a product be registered up front so it shows up in the navbar while it waits
// for its first test result.
//
// POST body: { mainProduct: string, subProduct?: string | string[] }

type SkippedItem = { name: string; reason: string };

// A name that differs from an existing one only by letter case. Not an error
// (both names are legal and distinct), but almost always a typo, so it is
// reported back instead of quietly creating a near-twin product.
type Warning = { field: "mainProduct" | "subProduct"; name: string; similarTo: string };

type ResponseData = {
    mainProduct: string;
    created: boolean;
    subProduct: string[];
    added: string[];
    skipped: SkippedItem[];
    warnings: Warning[];
};

// A subProduct name is also used as a MongoDB collection name and as a URL
// segment (`/{mainproduct}/{subproduct}`), so keep it to safe characters.
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const RESERVED_NAMES = new Set(["product_name"]);

function validateName(raw: unknown, label: string): { value?: string; error?: string } {
    if (typeof raw !== "string") return { error: `${label} must be a string` };

    const value = raw.trim();
    if (!value) return { error: `${label} is required` };
    if (!NAME_PATTERN.test(value)) {
        return {
            error: `${label} "${value}" is invalid: use 1-64 characters, letters/digits/._- only, starting with a letter or digit`,
        };
    }
    if (RESERVED_NAMES.has(value.toLowerCase()) || value.toLowerCase().startsWith("system.")) {
        return { error: `${label} "${value}" is reserved` };
    }

    return { value };
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A name from `list` that matches `value` apart from letter case. */
function findSimilar(value: string, list: string[]): string | undefined {
    const lower = value.toLowerCase();
    return list.find((name) => name !== value && name.toLowerCase() === lower);
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData | { error: string; details?: string }>,
) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const body =
        typeof req.body === "string" && req.body.length > 0
            ? (() => {
                  try {
                      return JSON.parse(req.body);
                  } catch {
                      return null;
                  }
              })()
            : req.body;

    if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Invalid JSON body" });
    }

    const main = validateName((body as any).mainProduct ?? (body as any).mainproduct, "mainProduct");
    if (main.error) return res.status(400).json({ error: main.error });
    const mainProduct = main.value as string;

    const rawSubs = (body as any).subProduct ?? (body as any).subproduct ?? [];
    const subList = Array.isArray(rawSubs) ? rawSubs : [rawSubs];

    const requestedSubs: string[] = [];
    const skipped: SkippedItem[] = [];
    const warnings: Warning[] = [];

    for (const raw of subList) {
        if (typeof raw === "string" && raw.trim() === "") continue; // ignore blank rows
        const sub = validateName(raw, "subProduct");
        if (sub.error) return res.status(400).json({ error: sub.error });

        const value = sub.value as string;
        if (requestedSubs.includes(value)) {
            skipped.push({ name: value, reason: "duplicate in request" });
            continue;
        }

        const similarInRequest = findSimilar(value, requestedSubs);
        if (similarInRequest) {
            warnings.push({ field: "subProduct", name: value, similarTo: similarInRequest });
        }

        requestedSubs.push(value);
    }

    try {
        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");
        const productNameCollection = db.collection("product_name");

        // Fetch every main product matching case-insensitively, so an existing
        // "AlgoTrade" can be reported when "algotrade" is submitted rather than
        // silently becoming a second product.
        const mainCandidates = await productNameCollection
            .find(
                { mainProduct: { $regex: `^${escapeRegex(mainProduct)}$`, $options: "i" } },
                { projection: { _id: 0, mainProduct: 1, subProduct: 1 } },
            )
            .toArray();

        const existing = mainCandidates.find((doc) => doc.mainProduct === mainProduct) ?? null;

        const similarMain = findSimilar(
            mainProduct,
            mainCandidates
                .map((doc) => doc.mainProduct)
                .filter((name): name is string => typeof name === "string"),
        );
        if (similarMain) {
            warnings.push({ field: "mainProduct", name: mainProduct, similarTo: similarMain });
        }

        const existingSubs: string[] = Array.isArray(existing?.subProduct)
            ? (existing!.subProduct as any[]).filter(
                  (s): s is string => typeof s === "string" && s.length > 0,
              )
            : [];

        const added: string[] = [];
        for (const sub of requestedSubs) {
            if (existingSubs.includes(sub)) {
                skipped.push({ name: sub, reason: "already exists" });
                continue;
            }

            const similarSub = findSimilar(sub, existingSubs);
            if (similarSub) {
                warnings.push({ field: "subProduct", name: sub, similarTo: similarSub });
            }

            added.push(sub);
        }

        if (!existing) {
            await productNameCollection.insertOne({
                mainProduct,
                subProduct: added,
            });
        } else if (added.length > 0) {
            await productNameCollection.updateOne(
                { mainProduct },
                { $addToSet: { subProduct: { $each: added } } },
            );
        }

        if (!existing || added.length > 0) invalidateProductCaches();

        return res.status(200).json({
            mainProduct,
            created: !existing,
            subProduct: [...existingSubs, ...added],
            added,
            skipped,
            warnings,
        });
    } catch (e: any) {
        return res.status(500).json({
            error: "Internal Server Error",
            details: e?.message ? String(e.message) : undefined,
        });
    }
}

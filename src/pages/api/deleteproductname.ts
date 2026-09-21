import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";
import { invalidateProductCaches } from "../../lib/productCache";
import { parseJsonBody, validateExistingName } from "../../lib/productNames";

// Remove a registered product name, and optionally its test results.
//
// POST body:
//   { mainProduct: string, subProduct?: string, deleteTestData?: boolean }
//
// With `subProduct` only that name is pulled from the main product; without it
// the whole main product entry is removed along with all of its subproducts.
//
// `deleteTestData` is scoped by `mainproduct`: a subproduct collection can be
// shared by several main products (their documents differ only by that field),
// so another product's history is never touched.

type KeptCollection = { name: string; reason: string };

type ResponseData = {
    mainProduct: string;
    subProduct: string | null;
    removedSubProducts: string[];
    removedMainProduct: boolean;
    deletedTestData: boolean;
    deletedDocuments: number;
    droppedCollections: string[];
    keptCollections: KeptCollection[];
};

const NAMESPACE_NOT_FOUND = 26;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData | { error: string; details?: string }>,
) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const body = parseJsonBody(req);
    if (!body) return res.status(400).json({ error: "Invalid JSON body" });

    const main = validateExistingName(body.mainProduct ?? body.mainproduct, "mainProduct");
    if (main.error) return res.status(400).json({ error: main.error });
    const mainProduct = main.value as string;

    const rawSub = body.subProduct ?? body.subproduct;
    let subProduct: string | null = null;
    if (rawSub !== undefined && rawSub !== null && rawSub !== "") {
        const sub = validateExistingName(rawSub, "subProduct");
        if (sub.error) return res.status(400).json({ error: sub.error });
        subProduct = sub.value as string;
    }

    const deleteTestData = body.deleteTestData === true;

    try {
        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");
        const productNameCollection = db.collection("product_name");

        const doc = await productNameCollection.findOne({ mainProduct });
        if (!doc) {
            return res.status(404).json({ error: `Main product not found: ${mainProduct}` });
        }

        const existingSubs: string[] = Array.isArray(doc.subProduct)
            ? doc.subProduct.filter((s: any): s is string => typeof s === "string" && s.length > 0)
            : [];

        if (subProduct && !existingSubs.includes(subProduct)) {
            return res
                .status(404)
                .json({ error: `Subproduct not found under ${mainProduct}: ${subProduct}` });
        }

        const targets = subProduct ? [subProduct] : existingSubs;

        // Drop the registration first: that is the part the user asked for, and
        // if the optional data cleanup fails afterwards the leftover documents
        // are harmless (and reachable again by re-adding the name).
        if (subProduct) {
            await productNameCollection.updateOne(
                { mainProduct },
                { $pull: { subProduct } } as any,
            );
        } else {
            await productNameCollection.deleteOne({ mainProduct });
        }

        let deletedDocuments = 0;
        const droppedCollections: string[] = [];
        const keptCollections: KeptCollection[] = [];

        if (deleteTestData) {
            for (const name of targets) {
                const result = await db.collection(name).deleteMany({ mainproduct: mainProduct });
                deletedDocuments += result.deletedCount ?? 0;

                // Still listed under another main product? Leave the collection
                // in place even if it is empty right now.
                const otherOwner = await productNameCollection.findOne(
                    { subProduct: name },
                    { projection: { _id: 0, mainProduct: 1 } },
                );
                if (otherOwner) {
                    keptCollections.push({
                        name,
                        reason: `ยังถูกใช้โดย ${otherOwner.mainProduct}`,
                    });
                    continue;
                }

                const remaining = await db.collection(name).countDocuments({}, { limit: 1 });
                if (remaining > 0) {
                    keptCollections.push({
                        name,
                        reason: "ยังมี document ของ product อื่นเหลืออยู่",
                    });
                    continue;
                }

                // A subproduct registered ahead of its first run has no
                // collection at all; skip it quietly rather than reporting a
                // drop that did not happen.
                const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
                if (!exists) continue;

                try {
                    await db.collection(name).drop();
                    droppedCollections.push(name);
                } catch (e: any) {
                    // Raced with another delete; nothing left to do.
                    if (e?.code !== NAMESPACE_NOT_FOUND) {
                        keptCollections.push({
                            name,
                            reason: e?.message ? String(e.message) : "drop failed",
                        });
                    }
                }
            }
        }

        invalidateProductCaches();

        return res.status(200).json({
            mainProduct,
            subProduct,
            removedSubProducts: targets,
            removedMainProduct: !subProduct,
            deletedTestData: deleteTestData,
            deletedDocuments,
            droppedCollections,
            keptCollections,
        });
    } catch (e: any) {
        return res.status(500).json({
            error: "Internal Server Error",
            details: e?.message ? String(e.message) : undefined,
        });
    }
}

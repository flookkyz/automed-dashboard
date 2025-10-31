import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";

type Data = {
    [key: string]: any;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Data>,
) {
    if (req.method === 'GET') {
        try {
            const client = await clientPromise;
            const db = client.db("automedtest-dashboard");
            // Exclude _id field. We still ask Mongo to sort by mainProduct,
            // but also perform a case-insensitive sort in JS to guarantee
            // consistent ordering, and sort each subProduct array.
            let products = await db
                .collection("product_name")
                .find({}, { projection: { _id: 0 } })
                .sort({ mainProduct: 1 })
                .toArray();

            // Case-insensitive compare helper
            const ciCompare = (a: string, b: string) =>
                a.localeCompare(b, undefined, { sensitivity: 'accent', caseFirst: 'false' });

            // Sort subProduct arrays and main products case-insensitively
            products = products.map((p: any) => {
                if (Array.isArray(p.subProduct)) {
                    p.subProduct = p.subProduct.slice().sort(ciCompare);
                }
                return p;
            });

            products.sort((x: any, y: any) => ciCompare(x.mainProduct, y.mainProduct));

            // Build flags for each collection (except product_name)
            const collections = await db.listCollections().toArray();
            const colNames = collections.map((c: any) => c.name).filter((n: string) => n !== 'product_name');

            const flagsByCollection: Record<string, string> = {};

            // For each collection, get latest document and inspect for fail/error counts
            await Promise.all(colNames.map(async (col: string) => {
                try {
                    // find latest document by date (assumes documents have a `date` field in ISO format)
                    const latest = await db.collection(col).findOne({}, { sort: { date: -1 } });
                    if (!latest) return;

                    let hasFail = false;
                    let hasError = false;

                    // Recursively analyze an object/array for numeric fail/error > 0
                    const analyze = (node: any) => {
                        if (node == null) return;
                        if (Array.isArray(node)) {
                            for (const el of node) analyze(el);
                        } else if (typeof node === 'object') {
                            // If object directly contains numeric counters
                            if (typeof node.fail === 'number' && node.fail > 0) hasFail = true;
                            if (typeof node.error === 'number' && node.error > 0) hasError = true;
                            // Walk children
                            for (const v of Object.values(node)) analyze(v);
                        }
                    };

                    analyze(latest);

                    let flag = 'pass';
                    if (hasFail && hasError) flag = 'all';
                    else if (hasFail) flag = 'fail';
                    else if (hasError) flag = 'error';

                    flagsByCollection[col] = flag;
                } catch (e) {
                    // ignore collection read errors and leave flag undefined
                }
            }));

            // Map products.subProduct strings to objects with computed flag
            const mappedProducts = products.map((p: any) => {
                const subs = Array.isArray(p.subProduct)
                    ? p.subProduct.map((name: string) => ({ name, flag: flagsByCollection[name] ?? 'pass' }))
                    : [];
                return {
                    mainProduct: p.mainProduct,
                    subProduct: subs,
                };
            });

            res.status(200).json({ products: mappedProducts });
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

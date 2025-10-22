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

            res.status(200).json({ products });
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

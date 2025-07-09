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
            // Exclude _id field
            const products = await db.collection("product_name").find({}, { projection: { _id: 0 } }).toArray();

            res.status(200).json({ products });
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

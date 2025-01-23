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
    if (req.method === 'GET') {
        try {
            const client = await clientPromise;
            const db = client.db("automedtest-dashboard");
            const collections = await db.listCollections().toArray();
            const collectionNames = collections.map((collection) => collection.name).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

            res.status(200).json({ collectionNames });
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
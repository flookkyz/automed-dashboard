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
    try {
        const { date } = req.query;

        if (!date) {
            res.status(400).json({ error: "date query parameter is required" });
            return;
        }

        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");
        const collections = await db.listCollections().toArray();
        const data: { [key: string]: any } = {};

        for (const collection of collections) {
            const collectionName = collection.name;
            const collectionData = await db
                .collection(collectionName)
                .findOne({ date });
            data[collectionName] = collectionData;
        }

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
}

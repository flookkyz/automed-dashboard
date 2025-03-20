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
    const { nameproduct } = req.query;
    if (req.method === "GET") {
        try {
            const client = await clientPromise;
            const db = client.db("automedtest-dashboard");
            const collection = db.collection(nameproduct as string);
            const documents = await collection.find({}).sort({ date: 1 }).toArray(); // Sort by date in ascending order
            const dates = documents.map((doc) => doc.date);

            res.status(200).json( dates );
        } catch (error) {
            res.status(500).json({ error: "Internal Server Error" });
        }
    } else {
        res.setHeader("Allow", ["GET"]);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

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
    const { mainproduct, subproduct } = req.query;
    if (req.method === "GET") {
        try {
            const client = await clientPromise;
            const db = client.db("automedtest-dashboard");
            if (!subproduct) {
                return res.status(400).json({ error: "Missing subproduct parameter" });
            }
            const collection = db.collection(subproduct as string);
            const documents = await collection.find({ mainproduct: mainproduct as string }).sort({ date: 1 }).toArray();
            const dates = documents.map((doc) => doc.date);
            res.status(200).json(dates);
        } catch (error) {
            res.status(500).json({ error: "Internal Server Error" });
        }
    } else {
        res.setHeader("Allow", ["GET"]);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

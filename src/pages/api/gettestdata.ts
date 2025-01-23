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
    const { nameproduct, date } = req.query;

    if (!date) {
        return res.status(400).json({ error: "Missing date parameter" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (typeof date !== "string" || !dateRegex.test(date)) {
        return res
            .status(400)
            .json({ error: "Invalid date format. Use yyyy-mm-dd" });
    }

    try {
        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");
        let data;

        if (nameproduct) {
            data = await db.collection(nameproduct as string).findOne({ date });
            if (!data) {
                return res.status(404).json({ error: "Data not found" });
            }
        } else {
            return res.status(400).json({ error: "Missing nameproduct parameter" });
        }

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

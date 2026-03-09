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
    const { mainproduct, subproduct, date } = req.query;

    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const mainproductStr = typeof mainproduct === "string" ? mainproduct : "";
    const subproductStr = typeof subproduct === "string" ? subproduct : "";
    const dateStr = typeof date === "string" ? date : "";

    if (!dateStr) {
        return res.status(400).json({ error: "Missing date parameter" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
        return res
            .status(400)
            .json({ error: "Invalid date format. Use yyyy-mm-dd" });
    }

    try {
        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");
        let data;

        if (subproductStr && mainproductStr) {
            data = await db
                .collection(subproductStr)
                .findOne({ date: dateStr, mainproduct: mainproductStr }, { projection: { _id: 0 } });
            if (!data) {
                return res.status(404).json({ error: "Data not found" });
            }
        } else {
            return res.status(400).json({ error: "Missing subproduct parameter" });
        }

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

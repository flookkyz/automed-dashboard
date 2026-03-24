import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";

type Data = {
  [key: string]: any;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { mainproduct, subproduct } = req.query;
  const mainproductStr = typeof mainproduct === "string" ? mainproduct : "";
  const subproductStr = typeof subproduct === "string" ? subproduct : "";

  if (!mainproductStr) return res.status(400).json({ error: "Missing mainproduct parameter" });
  if (!subproductStr) return res.status(400).json({ error: "Missing subproduct parameter" });

  try {
    const client = await clientPromise;
    const db = client.db("automedtest-dashboard");

    const doc = await db.collection("sonarq_results").findOne(
      { mainproduct: mainproductStr, subproduct: subproductStr },
      { sort: { timestamp: -1 }, projection: { _id: 0 } },
    );

    if (!doc) {
      return res.status(404).json({ error: "SonarQube data not found" });
    }

    return res.status(200).json(doc);
  } catch {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

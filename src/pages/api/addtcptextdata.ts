import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";

type Data = {
  [key: string]: any;
};

function getThailandDateString(): string {
  const now = new Date();
  const thailandTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return thailandTime.toISOString().split("T")[0];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { mainproduct, subproduct, name, pass, fail, time } = req.body;

    if (!mainproduct || !subproduct || !name) {
      return res.status(400).json({ error: "Missing required parameters: mainproduct, subproduct, name" });
    }

    if (typeof mainproduct !== "string" || typeof subproduct !== "string" || typeof name !== "string") {
      return res.status(400).json({ error: "mainproduct, subproduct, and name must be strings" });
    }

    if (pass !== undefined && typeof pass !== "number" && !Number.isInteger(Number(pass))) {
      return res.status(400).json({ error: "pass must be a number" });
    }

    if (fail !== undefined && typeof fail !== "number" && !Number.isInteger(Number(fail))) {
      return res.status(400).json({ error: "fail must be a number" });
    }

    const testData = {
      date: getThailandDateString(),
      mainproduct,
      nametest: [
        {
          name,
          pass: pass !== undefined ? Number(pass) : 0,
          fail: fail !== undefined ? Number(fail) : 0,
          error: 0,
          time: typeof time === "number" ? time : 0,
          detailfail: [],
        },
      ],
    };

    const client = await clientPromise;
    const db = client.db("automedtest-dashboard");
    const result = await db.collection(subproduct).insertOne(testData);

    return res.status(201).json({
      success: true,
      message: "Data added successfully",
      data: { _id: result.insertedId, ...testData },
    });
  } catch (error) {
    console.error("Error adding TCP text data:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

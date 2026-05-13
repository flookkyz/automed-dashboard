// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";
import { MongoClient } from "mongodb";

type TestDetail = {
  detail: string;
};

type Test = {
  name: string;
  detailfail: TestDetail[];
  detailerror: TestDetail[];
  pass: number;
  fail: number;
  error: number;
};

type TestData = {
  mainproduct: string;
  subproduct: string;
  date: string;
  nametest: Test[];
  time?: string;
  timestamp?: Date;
};

type Data = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  console.log("Request body", req.body);
  const data: TestData = req.body;
  console.log(data);
  data.timestamp = new Date();

  // Validate data fields
  if (!data.mainproduct || typeof data.mainproduct !== "string") {
    return res.status(400).json({ message: "Invalid or missing mainproduct" });
  }

  if (!data.subproduct || typeof data.subproduct !== "string") {
    return res.status(400).json({ message: "Invalid or missing subproduct" });
  }

  if (!Array.isArray(data.nametest) || data.nametest.length === 0) {
    return res.status(400).json({ message: "Invalid or missing nametest" });
  }

  for (const test of data.nametest) {
    if (!test.name || typeof test.name !== "string") {
      return res.status(400).json({ message: "Invalid or missing test name" });
    }
    if (
      typeof test.pass !== "number" ||
      typeof test.fail !== "number" ||
      typeof test.error !== "number"
    ) {
      return res.status(400).json({
        message: "Invalid or missing pass, fail, or error values",
      });
    }
  }
  // Helper to get date in Thailand timezone (UTC+7)
  function getThailandDateString() {
    const now = new Date();
    const thailandTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    return thailandTime.toISOString().split("T")[0];
  }

  // Helper to get time in Thailand timezone (UTC+7) in HH:MM:ss format
  function getThailandTimeString() {
    const now = new Date();
    const thailandTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    return thailandTime.toISOString().split("T")[1].split(".")[0];
  }

  data.date = getThailandDateString(); // Only keep the date part in Thailand timezone
  data.time = getThailandTimeString(); // Add time in HH:MM:ss format

  try {
    const client = await clientPromise;
    const db = client.db("automedtest-dashboard");

    const productNameCollection = db.collection("product_name");
    const existingMainProduct = await productNameCollection.findOne({
      mainProduct: data.mainproduct,
    });

    if (existingMainProduct) {
      const subProductExists =
        Array.isArray(existingMainProduct.subProduct) &&
        existingMainProduct.subProduct.includes(data.subproduct);

      if (!subProductExists) {
        await productNameCollection.updateOne(
          { mainProduct: data.mainproduct },
          { $addToSet: { subProduct: data.subproduct as string } }
        );
      }
    } else {
      await productNameCollection.insertOne({
        mainProduct: data.mainproduct,
        subProduct: [data.subproduct],
      });
    }

    const existingDoc = await db
      .collection(data.subproduct)
      .findOne({ date: data.date });

    if (existingDoc) {
      const existingTests = existingDoc.nametest || [];
      const newTests = data.nametest;

      const mergedTests = [...existingTests];

      newTests.forEach((newTest) => {
        const index = mergedTests.findIndex((test) => test.name === newTest.name);
        if (index !== -1) {
          mergedTests[index] = newTest;
        } else {
          mergedTests.push(newTest);
        }
      });

      data.nametest = mergedTests;
    }

    const { subproduct, ...dataWithoutNameproduct } = data;

    await db.collection(subproduct).updateOne(
      { date: data.date },
      { $set: dataWithoutNameproduct },
      { upsert: true }
    );

    console.log(
      `[SUCCESS] mainproduct="${data.mainproduct}" subproduct="${subproduct}" date="${data.date}" saved successfully`
    );

    return res.status(200).json({
      message: "Data saved successfully in product " + subproduct,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      `[ERROR] mainproduct="${data.mainproduct}" subproduct="${data.subproduct}" date="${data.date}" failed: ${reason}`
    );
    return res.status(500).json({ message: `Internal server error: ${reason}` });
  }
}

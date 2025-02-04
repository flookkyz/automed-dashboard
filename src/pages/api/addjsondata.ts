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
    nameproduct: string;
    date: string;
    nametest: Test[];
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
    if (!data.nameproduct || typeof data.nameproduct !== "string") {
        return res.status(400).json({ message: "Invalid or missing nameproduct" });
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
    data.date = new Date().toISOString().split("T")[0]; // Only keep the date part

    const client = await clientPromise;
    const db = client.db("automedtest-dashboard");

    // Fetch existing document for the given date
    const existingDoc = await db
        .collection(data.nameproduct)
        .findOne({ date: data.date });

    if (existingDoc) {
        // Merge nametest arrays
        const existingTests = existingDoc.nametest || [];
        const newTests = data.nametest;

        const mergedTests = [...existingTests];

        newTests.forEach((newTest) => {
            const index = mergedTests.findIndex((test) => test.name === newTest.name);
            if (index !== -1) {
                // Overwrite existing test
                mergedTests[index] = newTest;
            } else {
                // Add new test
                mergedTests.push(newTest);
            }
        });

        data.nametest = mergedTests;
    }

    const { nameproduct, ...dataWithoutNameproduct } = data;

    await db.collection(nameproduct).updateOne(
        { date: data.date }, // Filter by date
        { $set: dataWithoutNameproduct }, // Update the document
        { upsert: true } // Insert if not exists
    );

    return res.status(200).json({
        message: "Data saved successfully in product " + nameproduct,
    });
}

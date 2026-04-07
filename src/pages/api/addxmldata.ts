// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";
import fs from "fs";
import path from "path";
import formidable from "formidable";
import xml2js from "xml2js";

export const config = {
  api: {
    bodyParser: false, // Disallow body parsing, since we're using formidable
  },
};

export function extractErrorAndCallLog(text: string): {
  error: string;
  expected?: string;
  received?: string;
  name?: string;
} {
  const errorMatch = text.match(/Error:.*?(?=\n\s*\n)/s);
  const expectedMatch = text.match(/Expected:\s*(.*)/);
  const receivedMatch = text.match(/Received:\s*(.*)/);

  const errorText = errorMatch ? errorMatch[0] : "Error not found";
  const expectedText = expectedMatch ? expectedMatch[1].trim() : undefined;
  const receivedText = receivedMatch ? receivedMatch[1].trim() : undefined;

  return { error: errorText, expected: expectedText, received: receivedText };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const form = formidable();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: "Error parsing the form data" });
    }

    if (!fields.mainproduct || !fields.subproduct) {
      return res.status(400).json({ error: "Invalid or missing mainproduct or subproduct" });
    }
    const reqmainproduct = fields.mainproduct;
    const reqsubproduct = fields.subproduct;
    const uploaded = (files as any).file as formidable.File | formidable.File[] | undefined;
    const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;

    if (!file) {
      return res.status(400).json({ error: "File not found in the request" });
    }

    // Parse XML to JSON (use Formidable temp file; avoid writing to /app/uploads)
    try {
      const xml = fs.readFileSync(file.filepath, "utf-8");
      const result = await xml2js.parseStringPromise(xml, {
        mergeAttrs: true,
      });

      interface Detail {
        error: string;
        name?: string;
        expected?: string;
        received?: string;
      }

      interface TestSuite {
        tests: number;
        failures: number;
        errors: number;
        time: number;
        name: string;
        testcase: Array<{ [key: string]: any }>;
      }

      interface DataMap {
        name: string;
        pass: number;
        fail: number;
        error: number;
        time: number;
        detailfail: Detail[];
      }

      const suites = (result as any)?.testsuites?.testsuite as TestSuite[] | undefined;
      if (!Array.isArray(suites)) {
        return res.status(400).json({ error: "Invalid XML format: testsuites.testsuite not found" });
      }

      const datafromxml: DataMap[] = [];
      suites.forEach((testsuite: TestSuite) => {
        const detail: Detail[] = [];

        (testsuite.testcase || []).forEach((tc) => {
          if (!tc?.failure) return;

          const data: Detail = {
            error: "",
            name: String(tc.name),
          };

          const extracted = extractErrorAndCallLog(tc.failure[0]._);
          data.error = extracted.error;
          data.expected = extracted.expected;
          data.received = extracted.received;

          detail.push(data);
        });

        const datamap: DataMap = {
          name: String(testsuite.name),
          pass: Number(testsuite.tests) - Number(testsuite.failures) - Number(testsuite.errors),
          fail: Number(testsuite.failures),
          error: Number(testsuite.errors),
          time: Number(testsuite.time),
          detailfail: detail,
        };
        datafromxml.push(datamap);
      });

      // Helper to get date/time in Thailand timezone (UTC+7)
      function getThailandDateString() {
        const now = new Date();
        const thailandTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
        return thailandTime.toISOString().split("T")[0];
      }

      function getThailandTimeString() {
        const now = new Date();
        const thailandTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
        return thailandTime.toISOString().split("T")[1].split(".")[0];
      }

      const nowdate = getThailandDateString();
      const nowtime = getThailandTimeString();

      const datatosaveindb = {
        mainproduct: String(reqmainproduct),
        subproduct: String(reqsubproduct),
        nametest: datafromxml,
        time: nowtime,
      };

      const client = await clientPromise;
      const db = client.db("automedtest-dashboard");

      // Update product_name collection (same logic as addjsondata)
      const productNameCollection = db.collection("product_name");
      const existingMainProduct = await productNameCollection.findOne({
        mainProduct: String(reqmainproduct),
      });

      if (existingMainProduct) {
        const subProductExists =
          Array.isArray((existingMainProduct as any).subProduct) &&
          (existingMainProduct as any).subProduct.includes(String(reqsubproduct));

        if (!subProductExists) {
          await productNameCollection.updateOne(
            { mainProduct: String(reqmainproduct) },
            { $addToSet: { subProduct: String(reqsubproduct) } }
          );
        }
      } else {
        await productNameCollection.insertOne({
          mainProduct: String(reqmainproduct),
          subProduct: [String(reqsubproduct)],
        });
      }

      const existingDoc = await db
        .collection(String(reqsubproduct))
        .findOne({ date: nowdate });

      if (existingDoc) {
        const existingTests = (existingDoc as any).nametest || [];
        const newTests = datatosaveindb.nametest;

        const mergedTests = [...existingTests];
        newTests.forEach((newTest) => {
          const index = mergedTests.findIndex((test: any) => test.name === newTest.name);
          if (index !== -1) {
            mergedTests[index] = newTest;
          } else {
            mergedTests.push(newTest);
          }
        });

        datatosaveindb.nametest = mergedTests;
      }

      const { mainproduct, subproduct, nametest, time } = datatosaveindb;
      const dataWithoutMainproduct = { mainproduct, nametest, time };

      await db.collection(subproduct).updateOne(
        { date: nowdate },
        { $set: dataWithoutMainproduct },
        { upsert: true }
      );

      return res.status(200).json({
        message: "Data saved successfully in product " + reqsubproduct,
      });
    } catch (parseError) {
      return res.status(500).json({ error: "Error parsing XML to JSON" });
    }
  });
}

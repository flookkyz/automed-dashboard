// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";
import fs from "fs";
import path from "path";
import formidable from "formidable";
import xml2js from "xml2js";

// Ensure the uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

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
    const file = files.file ? (files.file[0] as formidable.File) : null;

    if (!file) {
      return res.status(400).json({ error: "File not found in the request" });
    }
    const filePath = path.join(
      uploadDir,
      file.originalFilename || "defaultFilename.xml"
    );
    const fileStream = fs.createWriteStream(filePath);
    const fileBuffer = fs.readFileSync(file.filepath);
    fileStream.write(fileBuffer);
    fileStream.end();

    // Parse XML to JSON
    try {
      fileStream.on("finish", async () => {
        const xml = fs.readFileSync(filePath, "utf-8");
        const result = await xml2js.parseStringPromise(xml, {
          mergeAttrs: true,
        });
        interface TestSuite {
          tests: number;
          failures: number;
          errors: number;
          time: number;
          name: string;
          testcase: Array<{ [key: string]: any }>;
          failure: Array<{ [key: string]: any }>;
        }
        let datafromxml: Array<{
          name: string;
          pass: number;
          fail: number;
          error: number;
          time: number;
        }> = [];
        (result.testsuites.testsuite as TestSuite[]).map(
          (testsuite: TestSuite) => {
            const detail: Detail[] = [];
            testsuite.testcase.map((tc) => {
              let data: Detail = {
                error: "",
                name: String(tc.name),
              };
              if (tc.failure) {
                const extracted = extractErrorAndCallLog(tc.failure[0]._);
                data.error = extracted.error;
                data.expected = extracted.expected;
                data.received = extracted.received;
              }
              if (tc.failure) {
                detail.push(data);
                console.log("detail", detail);
                
              }
            });

            interface Detail {
              error: string;
              name?: string;
              expected?: string;
              received?: string;
            }

            interface DataMap {
              name: string;
              pass: number;
              fail: number;
              error: number;
              time: number;
              detailfail: Detail[];
            }

            let datamap: DataMap = {
              name: String(testsuite.name),
              pass: testsuite.tests - testsuite.failures - testsuite.errors,
              fail: Number(testsuite.failures),
              error: Number(testsuite.errors),
              time: Number(testsuite.time),
              detailfail: detail,
            };
            datafromxml.push(datamap);
          }
        );

        // Helper to get date in Thailand timezone (UTC+7)
        function getThailandDateString() {
          const now = new Date();
          // Convert to UTC+7
          const thailandTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
          return thailandTime.toISOString().split("T")[0];
        }

        // Helper to get time in Thailand timezone (UTC+7) in HH:MM:ss format
        function getThailandTimeString() {
          const now = new Date();
          // Convert to UTC+7
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
        // console.log("datafromxml", datatosaveindb);
        /////////////////////////////////////////
        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");
        
        // Update product_name collection (same logic as addjsondata)
        const productNameCollection = db.collection("product_name");
        const existingMainProduct = await productNameCollection.findOne({
          mainProduct: String(reqmainproduct),
        });

        if (existingMainProduct) {
          // Check if subProduct already exists in the array
          const subProductExists =
            Array.isArray(existingMainProduct.subProduct) &&
            existingMainProduct.subProduct.includes(String(reqsubproduct));

          if (!subProductExists) {
            // Add subProduct to existing mainProduct (only if not duplicate)
            await productNameCollection.updateOne(
              { mainProduct: String(reqmainproduct) },
              { $addToSet: { subProduct: String(reqsubproduct) } }
            );
          }
        } else {
          // Create new mainProduct with subProduct array
          await productNameCollection.insertOne({
            mainProduct: String(reqmainproduct),
            subProduct: [String(reqsubproduct)],
          });
        }

        const existingDoc = await db
          .collection(String(reqsubproduct))
          .findOne({ date: nowdate });

        if (existingDoc) {
          // Merge nametest arrays
          const existingTests = existingDoc.nametest || [];
          const newTests = datatosaveindb.nametest;

          const mergedTests = [...existingTests];

          newTests.forEach((newTest) => {
            const index = mergedTests.findIndex(
              (test) => test.name === newTest.name
            );
            if (index !== -1) {
              // Overwrite existing test
              mergedTests[index] = newTest;
            } else {
              // Add new test
              mergedTests.push(newTest);
            }
          });

          datatosaveindb.nametest = mergedTests;
        }

        const { mainproduct, subproduct, nametest, time } = datatosaveindb;
        const dataWithoutMainproduct = { mainproduct, nametest, time };

        await db.collection(subproduct).updateOne(
          { date: nowdate }, // Filter by date
          { $set: dataWithoutMainproduct }, // Update the document
          { upsert: true } // Insert if not exists
        );

        ////////////////////////////////////////////////////////////
        return res.status(200).json({
          message: "Data saved successfully in product " + reqsubproduct,
        });
        // return res.status(200).json({
        //   // message: result.testsuites.testsuite[2].testcase[0].failure[0]._,
        //   message: datafromxml,
        //   // message: result.testsuites.testsuite[1],
        // });
      });
    } catch (parseError) {
      return res.status(500).json({ error: "Error parsing XML to JSON" });
    }
  });
}

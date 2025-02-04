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
  name?: string;
} {
  const errorMatch = text.match(/Error:.*?(?=\n\s*\n)/s);

  const errorText = errorMatch ? errorMatch[0] : "Error not found";

  return { error: errorText };
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

    if (!fields.nameproduct) {
      return res.status(400).json({ error: "Invalid or missing nameproduct" });
    }
    const reqnameproduct = fields.nameproduct;
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
              console.log("tc", String(tc.name));
              console.log("fail", tc.failure ? tc.failure[0]._ : "no fail");
              let data: { name?: string; error: string } = {
                error: "",
              };
              if (tc.failure) {
                data = extractErrorAndCallLog(tc.failure[0]._);
                data.name = String(tc.name);
                detail.push(data);
              }
            });

            interface Detail {
              error: string;
              name?: string;
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
        const datatosaveindb = {
          nameproduct: String(reqnameproduct),
          nametest: datafromxml,
        };
        // console.log("datafromxml", datatosaveindb);
        /////////////////////////////////////////
        const client = await clientPromise;

        const nowdate = new Date().toISOString().split("T")[0];
        const db = client.db("automedtest-dashboard");
        const existingDoc = await db
          .collection(String(reqnameproduct))
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

        const { nametest } = datatosaveindb;
        const dataWithoutNameproduct = { nametest };

        await db.collection(datatosaveindb.nameproduct).updateOne(
          { date: nowdate }, // Filter by date
          { $set: dataWithoutNameproduct }, // Update the document
          { upsert: true } // Insert if not exists
        );

        ////////////////////////////////////////////////////////////
        return res.status(200).json({
          message: "Data saved successfully in product " + reqnameproduct,
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

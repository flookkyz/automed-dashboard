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
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const client = await clientPromise;
    const db = client.db("automedtest-dashboard");

    // Get all collection names
    const collections = await db.listCollections().toArray();
    const collectionNames = collections
      .map((col) => col.name)
      .filter((name) => name !== "product_name"); // Exclude product_name collection

    const result: { [key: string]: any } = {};

    // Process each collection
    for (const collectionName of collectionNames) {
      try {
        // Find the latest date in this collection
        const latestDoc = await db.collection(collectionName).findOne(
          {},
          {
            sort: { date: -1 }, // Sort by date descending to get latest
            projection: { date: 1 }, // Only get the date field first
          }
        );

        if (latestDoc && latestDoc.date) {
          // Get the full document with the latest date
          const latestData = await db
            .collection(collectionName)
            .findOne({ date: latestDoc.date });

          if (latestData) {
            // Check for failures and errors in nametest array
            let hasFail = false;
            let hasError = false;

            if (latestData.nametest && Array.isArray(latestData.nametest)) {
              for (const test of latestData.nametest) {
                if (test.fail && test.fail > 0) {
                  hasFail = true;
                }
                if (test.error && test.error > 0) {
                  hasError = true;
                }
                // Break early if both are found
                if (hasFail && hasError) {
                  break;
                }
              }
            }

            // Add the status flags and mainproduct to the data
            result[collectionName] = {
              mainproduct: latestData.mainproduct,
              hasFail: hasFail,
              hasError: hasError,
            };
          }
        }
      } catch (collectionError) {
        console.error(
          `Error processing collection ${collectionName}:`,
          collectionError
        );
        // Continue with other collections even if one fails
        continue;
      }
    }

    return res.status(200).json({
      data: result,
      length: collectionNames.length,
    });
  } catch (error) {
    console.error("Error in getnavbardata:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to retrieve navbar data",
    });
  }
}

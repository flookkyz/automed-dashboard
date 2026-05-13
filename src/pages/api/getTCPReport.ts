import fs from "fs";
import path from "path";
import JSON5 from "json5";
import type { NextApiRequest, NextApiResponse } from "next";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

type Data = {
  [key: string]: any;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const logPath = path.join(UPLOADS_DIR, "_TestLog.js");
    const summaryPath = path.join(UPLOADS_DIR, "summary.htm");

    const [fileContent, summaryFile] = await Promise.all([
      fs.promises.readFile(logPath, "utf-8"),
      fs.promises.readFile(summaryPath, "utf-8").catch(() => null),
    ]);

    const messagesArray: string[] = [];
    const dataString = fileContent.match(/{.*}/s);
    if (dataString?.[0]) {
      const logData = JSON5.parse(dataString[0]);
      if (Array.isArray(logData.items)) {
        for (const item of logData.items) {
          if (item.Type === "Error" && item.Message) {
            messagesArray.push(item.Message);
          }
        }
      }
    }

    let sumData = null;
    if (summaryFile) {
      const summaryMatch = summaryFile.match(/var data\s*=\s*(\{[\s\S]*?\})\s*;/);
      if (summaryMatch?.[1]) {
        const summaryData = JSON5.parse(summaryMatch[1]);
        sumData = {
          name: summaryData.summary?.title,
          time: summaryData.summary?.duration,
          pass: summaryData.summary?.testsPassed,
          fail: summaryData.summary?.testsFailed,
        };
      }
    }

    return res.status(200).json({ summary: sumData, messagesArray });
  } catch (error) {
    console.error("Error reading TCP report:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

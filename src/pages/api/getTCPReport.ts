import fs from "fs";
import JSON5 from "json5";
import type { NextApiRequest, NextApiResponse } from "next";

const filePath = "D:/automed-dashboard/automed-dashboard/uploads/_TestLog.js";

type Data = {
  [key: string]: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method === "GET") {
    try {
      // อ่านไฟล์ _TestLog.js
      const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
      let fileContent = "";
      fileStream.on("data", (chunk) => {
        fileContent += chunk;
      });
      fileStream.on("end", async () => {
        const dataString = fileContent.match(/{.*}/s);
        let messagesArray: any = [];
        if (dataString && dataString[0]) {
          try {
            const jsonStr = dataString[0];
            const logData = JSON5.parse(jsonStr);
            if (logData.items && Array.isArray(logData.items)) {
              logData.items.forEach((item: any) => {
                if (item.Type === "Error" && item.Message) {
                  messagesArray.push(item.Message);
                }
              });
            }
          } catch (error) {
            console.error("เกิดข้อผิดพลาดในการ parse JSON:", error);
            res.status(500).json({ error: "Internal Server Error" });
            return;
          }
        }

        // อ่านไฟล์ summary.htm
        let summaryData = null;
        try {
          const summaryFile = fs.readFileSync(
            "D:/automed-dashboard/automed-dashboard/uploads/summary.htm",
            "utf-8"
          );
          const summaryMatch = summaryFile.match(
            /var data\s*=\s*(\{[\s\S]*?\})\s*;/
          );
          if (summaryMatch && summaryMatch[1]) {
            summaryData = JSON5.parse(summaryMatch[1]);
          }
        } catch (error) {
          console.error("Error reading summary.htm:", error);
        }
        console.log("summaryData", summaryData);
        const sumData = {
          name: summaryData.summary?.title,
          time: summaryData.summary?.duration,
          pass: summaryData.summary?.testsPassed,
          fail: summaryData.summary?.testsFailed,
        };

        res.status(200).json({
          summary: sumData,
          messagesArray,
        });
      });
      fileStream.on("error", (error) => {
        console.error("เกิดข้อผิดพลาดในการอ่านไฟล์:", error);
        res.status(500).json({ error: "Failed to read file" });
      });
    } catch (error) {
      console.error("Error creating read stream:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

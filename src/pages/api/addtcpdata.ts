import { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

interface SummaryData {
  title: string;
  duration: number;
  testsExecuted: number;
  testsPassed: number;
  testsFailed: number;
}

function extractSummaryData(htmlContent: string): SummaryData | null {
  try {
    const match = htmlContent.match(/var\s+data\s*=\s*({[\s\S]*?});/);
    if (!match) return null;

    const jsonString = match[1]
      .replace(/'/g, '"')
      .replace(/(\w+):/g, '"$1":')
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");

    const data = JSON.parse(jsonString);
    if (!data?.summary) return null;

    return {
      title: data.summary.title || "",
      duration: data.summary.duration || 0,
      testsExecuted: data.summary.testsExecuted || 0,
      testsPassed: data.summary.testsPassed || 0,
      testsFailed: data.summary.testsFailed || 0,
    };
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Only POST requests are accepted." });
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const form = formidable({
    uploadDir: uploadsDir,
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024,
    maxFields: 10,
    maxFieldsSize: 2 * 1024 * 1024,
    allowEmptyFiles: false,
    minFileSize: 1,
  });

  let fields: formidable.Fields;
  let files: formidable.Files;
  try {
    [fields, files] = await form.parse(req);
  } catch (parseError) {
    return res.status(400).json({
      success: false,
      message: "Error parsing form data",
      error: parseError instanceof Error ? parseError.message : "Parse error",
    });
  }

  const mainproduct = Array.isArray(fields.mainproduct) ? fields.mainproduct[0] : fields.mainproduct;
  const subproduct = Array.isArray(fields.subproduct) ? fields.subproduct[0] : fields.subproduct;

  if (!mainproduct || !subproduct) {
    return res.status(400).json({ success: false, message: "Missing required parameters: mainproduct and subproduct are required." });
  }

  const uploaded = files.file;
  const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
  if (!file) {
    return res.status(400).json({ success: false, message: "No file uploaded. Please upload an .htm file." });
  }

  try {
    if (!file.originalFilename?.endsWith(".htm") && !file.originalFilename?.endsWith(".html")) {
      return res.status(400).json({ success: false, message: "Invalid file type. Only .htm and .html files are allowed." });
    }

    const htmlContent = await fs.promises.readFile(file.filepath, "utf-8");
    const summaryData = extractSummaryData(htmlContent);

    if (!summaryData) {
      return res.status(400).json({ success: false, message: "Unable to extract summary data from the uploaded file." });
    }

    return res.status(200).json({
      success: true,
      message: "File processed successfully",
      data: {
        mainproduct,
        subproduct,
        file: { originalName: file.originalFilename, size: file.size },
        extractedData: summaryData,
        uploadTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    fs.promises.unlink(file.filepath).catch(() => {});
  }
}

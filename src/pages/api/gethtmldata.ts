// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
// import * as cheerio from "cheerio";
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

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const form = formidable();
    form.parse(req, async (err, _, files) => {
        if (err) {
            return res.status(400).json({ error: "Error parsing the form data" });
        }

        const file = files.file ? files.file[0] as formidable.File : null;

        if (!file) {
            return res.status(400).json({ error: "File not found in the request" });
        }
        const filePath = path.join(uploadDir, file.originalFilename || "defaultFilename.xml");
        // const filePath = path.join(process.cwd(), "uploads", file.originalFilename || "defaultFilename.xml");
        const fileStream = fs.createWriteStream(filePath);
        const fileBuffer = fs.readFileSync(file.filepath);
        fileStream.write(fileBuffer);
        fileStream.end();

        const xml = fs.readFileSync(filePath, "utf-8");

        // Parse XML to JSON
        try {
            const result = await xml2js.parseStringPromise(xml, { mergeAttrs: true });
            return res.status(200).json(result.testsuites);
        } catch (parseError) {
            return res.status(500).json({ error: "Error parsing XML to JSON" });
        }
    });
}

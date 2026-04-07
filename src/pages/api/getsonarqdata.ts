import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";

type SonarDocResponse = {
  mainproduct?: string;
  subproduct?: string;
  projectKey?: string;
  branch?: string | null;
  scannedAt?: string;
  analysisId?: string | null;
  qualityGate?: any;
  measures?: any;
  newCodePeriod?: any;
  issueCounts?: any;
  timestamp?: string;
  date?: string;
  time?: string;
};

function buildScannedAt(fetchedAtDate?: string, fetchedAtTime?: string): string | undefined {
  if (!fetchedAtDate || !fetchedAtTime) return undefined;
  // Store as Thailand timezone (+07:00) to match how dates are generated in the DB.
  return `${fetchedAtDate}T${fetchedAtTime}+07:00`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { mainproduct, subproduct, date } = req.query;

  const mainproductStr = typeof mainproduct === "string" ? mainproduct : "";
  const subproductStr = typeof subproduct === "string" ? subproduct : "";
  const dateStr = typeof date === "string" ? date : "";

  if (!subproductStr) {
    return res.status(400).json({ error: "Missing subproduct parameter" });
  }

  try {
    const client = await clientPromise;
    const db = client.db("automedtest-dashboard");

    const filter: any = {};
    if (dateStr) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        return res.status(400).json({ error: "Invalid date format. Use yyyy-mm-dd" });
      }
      filter.date = dateStr;
    } else {
      // If caller doesn't specify a date, prefer the latest document that actually has Sonar data.
      // Otherwise we may accidentally return a newer doc that only has test results (nametest) and no sonar.
      filter["sonar.projectKey"] = { $exists: true };
    }

    if (mainproductStr) {
      filter.mainproduct = mainproductStr;
    }

    const rawDoc = await db
      .collection(subproductStr)
      .find(filter)
      .sort({ date: -1, "sonar.fetchedAtTime": -1 })
      .limit(1)
      .next();

    if (!rawDoc) {
      return res.status(404).json({ error: "Data not found" });
    }

    const sonar = (rawDoc as any).sonar ?? {};

    const qualityGate =
      sonar?.raw?.qualityGate?.projectStatus ??
      sonar?.raw?.qualityGate ??
      sonar?.summary?.qualityGate ??
      undefined;

    const measures =
      sonar?.raw?.measures?.component?.measures ??
      sonar?.raw?.measures?.measures ??
      sonar?.raw?.measures ??
      undefined;

    const newCodePeriod =
      sonar?.raw?.qualityGate?.projectStatus?.period ??
      sonar?.raw?.qualityGate?.period ??
      undefined;

    const response: SonarDocResponse = {
      mainproduct: (rawDoc as any).mainproduct,
      subproduct: subproductStr,
      projectKey: sonar?.projectKey,
      branch: sonar?.branch ?? null,
      scannedAt: buildScannedAt(sonar?.fetchedAtDate, sonar?.fetchedAtTime),
      analysisId: sonar?.raw?.ceTask?.task?.analysisId ?? null,
      qualityGate,
      measures,
      newCodePeriod,
      date: (rawDoc as any).date,
      time: (rawDoc as any).time,
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

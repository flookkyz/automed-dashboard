import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";

type SonarIngestBody = {
  mainproduct: string;
  subproduct: string;
  projectKey?: string;
  branch?: string | null;
  scannedAt?: string;
  analysisId?: string;
  qualityGate?: unknown;
  measures?: unknown;
  newCodePeriod?: unknown;
  metadata?: unknown;
  raw?: unknown;
};

type Data = {
  message: string;
  upsertedId?: unknown;
};

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

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Optional API key protection (enabled only when env var is set)
  const requiredKey = process.env.DASHBOARD_API_KEY;
  if (requiredKey) {
    const headerKey = asNonEmptyString(req.headers["x-api-key"]) ||
      asNonEmptyString(req.headers["X-API-KEY"]) ||
      asNonEmptyString(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!headerKey || headerKey !== requiredKey) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  const body = (req.body ?? {}) as Partial<SonarIngestBody>;
  const mainproduct = asNonEmptyString(body.mainproduct);
  const subproduct = asNonEmptyString(body.subproduct);

  if (!mainproduct) return res.status(400).json({ message: "Invalid or missing mainproduct" });
  if (!subproduct) return res.status(400).json({ message: "Invalid or missing subproduct" });

  const scannedAt = asNonEmptyString(body.scannedAt) ?? new Date().toISOString();
  const projectKey = asNonEmptyString(body.projectKey);
  const branch = typeof body.branch === "string" ? body.branch : body.branch === null ? null : undefined;
  const analysisId = asNonEmptyString(body.analysisId);

  const doc = {
    mainproduct,
    subproduct,
    projectKey,
    branch,
    analysisId,
    scannedAt,
    date: getThailandDateString(),
    time: getThailandTimeString(),
    timestamp: new Date(),
    qualityGate: body.qualityGate ?? null,
    measures: body.measures ?? null,
    newCodePeriod: body.newCodePeriod ?? null,
    metadata: body.metadata ?? null,
    raw: body.raw ?? null,
  };

  const client = await clientPromise;
  const db = client.db("automedtest-dashboard");

  // Keep main/sub product names in sync with the rest of the dashboard.
  const productNameCollection = db.collection("product_name");
  const existingMainProduct = await productNameCollection.findOne({
    mainProduct: mainproduct,
  });

  if (existingMainProduct) {
    const subProductExists =
      Array.isArray((existingMainProduct as any).subProduct) &&
      (existingMainProduct as any).subProduct.includes(subproduct);

    if (!subProductExists) {
      await productNameCollection.updateOne(
        { mainProduct: mainproduct },
        { $addToSet: { subProduct: subproduct } },
      );
    }
  } else {
    await productNameCollection.insertOne({
      mainProduct: mainproduct,
      subProduct: [subproduct],
    });
  }

  // Store SonarQube data in a dedicated collection to avoid overwriting test results.
  const sonarCollection = db.collection("sonarq_results");

  const filter = analysisId
    ? { mainproduct, subproduct, analysisId }
    : { mainproduct, subproduct, projectKey: projectKey ?? null, scannedAt };

  const result = await sonarCollection.updateOne(filter, { $set: doc }, { upsert: true });

  return res.status(200).json({
    message: `SonarQube data saved successfully for ${mainproduct}/${subproduct}`,
    upsertedId: (result as any).upsertedId,
  });
}

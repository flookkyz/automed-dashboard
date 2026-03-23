import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../../lib/mongodb";

type IngestBody = {
  projectKey?: string;
  branch?: string | null;
  mainproduct?: string;
  subproduct?: string;
  scannedAt?: string;
  dashboardUrl?: string;
  qualityGate?: any;
  measures?: any;
  newCodePeriod?: any;
  metadata?: Record<string, any>;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const body = (req.body ?? {}) as IngestBody;

    const projectKey = typeof body.projectKey === "string" ? body.projectKey.trim() : "";
    if (!projectKey) {
      return res.status(400).json({ error: "projectKey is required" });
    }

    const branch =
      body.branch === null
        ? null
        : typeof body.branch === "string"
          ? body.branch.trim() || null
          : null;

    const mainproduct = typeof body.mainproduct === "string" ? body.mainproduct.trim() : "";
    const subproduct = typeof body.subproduct === "string" ? body.subproduct.trim() : "";

    // Keep backward compatibility: allow ingest without mainproduct/subproduct.
    const hasProductPair = Boolean(mainproduct) || Boolean(subproduct);
    if (hasProductPair && (!mainproduct || !subproduct)) {
      return res
        .status(400)
        .json({ error: "Both mainproduct and subproduct are required when providing product info" });
    }

    const scannedAt = body.scannedAt && typeof body.scannedAt === "string" ? body.scannedAt : new Date().toISOString();
    const dashboardUrl = typeof body.dashboardUrl === "string" ? body.dashboardUrl.trim() : "";
    const receivedAt = new Date().toISOString();

    const snapshot = {
      projectKey,
      branch,
      mainproduct: hasProductPair ? mainproduct : null,
      subproduct: hasProductPair ? subproduct : null,
      scannedAt,
      receivedAt,
      dashboardUrl: dashboardUrl || null,
      qualityGate: body.qualityGate ?? null,
      measures: body.measures ?? null,
      newCodePeriod: body.newCodePeriod ?? null,
      metadata: body.metadata ?? {},
    };

    const client = await clientPromise;
    const db = client.db("automedtest-dashboard");

    await db.collection("sonar_snapshots").insertOne(snapshot);

    await db.collection("sonar_latest").updateOne(
      {
        projectKey,
        branch,
        mainproduct: hasProductPair ? mainproduct : null,
        subproduct: hasProductPair ? subproduct : null,
      },
      { $set: snapshot },
      { upsert: true },
    );

    // Also store under the same collections used by existing flows (collection name = subproduct).
    if (hasProductPair) {
      const nowdate = getThailandDateString();
      const nowtime = getThailandTimeString();

      await db.collection("product_name").updateOne(
        { mainProduct: String(mainproduct) },
        {
          $setOnInsert: { mainProduct: String(mainproduct) },
          $addToSet: { subProduct: String(subproduct) },
        },
        { upsert: true },
      );

      await db.collection(String(subproduct)).updateOne(
        { date: nowdate },
        {
          $set: {
            mainproduct: String(mainproduct),
            time: String(nowtime),
            sonar: {
              projectKey,
              branch,
              scannedAt,
              receivedAt,
              dashboardUrl: dashboardUrl || null,
              qualityGate: snapshot.qualityGate,
              measures: snapshot.measures,
              newCodePeriod: snapshot.newCodePeriod,
              metadata: snapshot.metadata,
            },
          },
        },
        { upsert: true },
      );
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: "Internal Server Error", message: error?.message ?? String(error) });
  }
}

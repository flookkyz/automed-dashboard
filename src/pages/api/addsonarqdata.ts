import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";

type SonarSummary = {
  overall?: {
    bugs?: number;
    vulnerabilities?: number;
    codeSmells?: number;
    securityHotspots?: number;
    coverage?: number | null;
    duplicatedLinesDensity?: number | null;
  };
  newCode?: {
    bugs?: number;
    vulnerabilities?: number;
    codeSmells?: number;
    securityHotspots?: number;
    coverage?: number | null;
    duplicatedLinesDensity?: number | null;
  };
  qualityGate?: {
    status?: string;
    conditions?: any[];
  };
};

type SonarUpsertBody = {
  mainproduct: string;
  subproduct: string;
  projectKey: string;
  hostUrl?: string;
  branch?: string;
  summary?: SonarSummary;
  raw?: {
    qualityGate?: any;
    measures?: any;
    ceTask?: any;
  };
};

type Data = {
  message: string;
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const body: Partial<SonarUpsertBody> = req.body ?? {};

  if (!body.mainproduct || typeof body.mainproduct !== "string") {
    return res.status(400).json({ error: "Invalid or missing mainproduct" });
  }

  if (!body.subproduct || typeof body.subproduct !== "string") {
    return res.status(400).json({ error: "Invalid or missing subproduct" });
  }

  if (!body.projectKey || typeof body.projectKey !== "string") {
    return res.status(400).json({ error: "Invalid or missing projectKey" });
  }

  const nowDate = getThailandDateString();
  const nowTime = getThailandTimeString();

  const client = await clientPromise;
  const db = client.db("automedtest-dashboard");

  // Keep product_name in sync (same behavior as addjsondata/addxmldata)
  const productNameCollection = db.collection("product_name");
  const existingMainProduct = await productNameCollection.findOne({
    mainProduct: body.mainproduct,
  });

  if (existingMainProduct) {
    const subProductExists =
      Array.isArray((existingMainProduct as any).subProduct) &&
      (existingMainProduct as any).subProduct.includes(body.subproduct);

    if (!subProductExists) {
      await productNameCollection.updateOne(
        { mainProduct: body.mainproduct },
        { $addToSet: { subProduct: body.subproduct } }
      );
    }
  } else {
    await productNameCollection.insertOne({
      mainProduct: body.mainproduct,
      subProduct: [body.subproduct],
    });
  }

  const sonarDoc = {
    projectKey: body.projectKey,
    hostUrl: typeof body.hostUrl === "string" ? body.hostUrl : undefined,
    branch: typeof body.branch === "string" ? body.branch : undefined,
    fetchedAtDate: nowDate,
    fetchedAtTime: nowTime,
    summary: body.summary ?? undefined,
    raw: body.raw ?? undefined,
  };

  await db.collection(body.subproduct).updateOne(
    { date: nowDate },
    {
      $set: {
        mainproduct: body.mainproduct,
        sonar: sonarDoc,
      },
    },
    { upsert: true }
  );

  return res.status(200).json({
    message: `SonarQube data saved successfully in product ${body.subproduct}`,
  });
}

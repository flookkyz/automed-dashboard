import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";
import clientPromise from "../../lib/mongodb";
import xml2js from "xml2js";

export const config = {
  api: {
    bodyParser: false,
  },
};

type AppiumCounts = {
  totalTests: number;
  pass: number;
  fail: number;
  failures: number;
  errors: number;
  skipped: number;
};

type TestDetail = {
  name: string;
  status: "PASS" | "FAIL" | "SKIP" | "UNKNOWN";
  start?: string;
  elapsedSeconds?: number;
  failReason?: string;
};

type AppiumResult = AppiumCounts & {
  tests: TestDetail[];
  suiteName?: string;
  totalElapsedSeconds?: number;
};

function asSingleQueryValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object" && value !== null && "_" in (value as any)) {
    return toNumber((value as any)._);
  }
  return 0;
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function sumCounts(suites: Array<Record<string, unknown>>): AppiumCounts {
  let totalTests = 0;
  let failures = 0;
  let errors = 0;
  let skipped = 0;

  for (const suite of suites) {
    totalTests += toNumber((suite as any).tests);
    failures += toNumber((suite as any).failures);
    errors += toNumber((suite as any).errors);
    skipped += toNumber((suite as any).skipped);
  }

  const fail = failures + errors;
  const pass = Math.max(0, totalTests - fail - skipped);

  return { totalTests, pass, fail, failures, errors, skipped };
}

function normalizeStatus(status: unknown): TestDetail["status"] {
  const s = String(status || "").toUpperCase();
  if (s === "PASS") return "PASS";
  if (s === "FAIL") return "FAIL";
  if (s === "SKIP" || s === "SKIPPED") return "SKIP";
  return "UNKNOWN";
}

function truncateReason(text: string | undefined, maxLen = 2000): string | undefined {
  if (!text) return undefined;
  const cleaned = String(text).replace(/\s+$/g, "");
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen) + "...";
}

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

type DashboardDetail = {
  error: string;
  name?: string;
  start?: string;
  elapsedSeconds?: number;
  expected?: string;
  received?: string;
};

type DashboardTest = {
  name: string;
  detailfail: DashboardDetail[];
  detailerror: DashboardDetail[];
  pass: number;
  fail: number;
  error: number;
  time: number;
  testcases?: TestDetail[];
};

type DashboardBody = {
  mainproduct: string;
  subproduct: string;
  date: string;
  time: string;
  nametest: DashboardTest[];
};

function buildDashboardBody(params: {
  mainproduct: string;
  subproduct: string;
  fileLabel: string;
  parsed: AppiumResult;
}): DashboardBody {
  const { mainproduct, subproduct, fileLabel, parsed } = params;

  const suiteName = parsed.suiteName || fileLabel;
  const totalElapsed =
    typeof parsed.totalElapsedSeconds === "number"
      ? parsed.totalElapsedSeconds
      : parsed.tests.reduce(
          (acc, t) => acc + (typeof t.elapsedSeconds === "number" ? t.elapsedSeconds : 0),
          0
        );

  const detailfail: DashboardDetail[] = parsed.tests
    .filter((t) => t.status === "FAIL")
    .map((t) => {
      const reason = truncateReason(t.failReason);
      const parts = [
        t.name ? `testcase: ${t.name}` : undefined,
        typeof t.elapsedSeconds === "number" ? `elapsed: ${t.elapsedSeconds}s` : undefined,
        reason ? `reason: ${reason}` : undefined,
      ].filter(Boolean);

      return {
        error: reason || parts.join(" | ") || "FAILED",
        name: t.name,
        start: t.start,
        elapsedSeconds: t.elapsedSeconds,
      };
    });

  const nametest: DashboardTest[] = [
    {
      name: suiteName,
      detailfail,
      detailerror: [],
      pass: parsed.pass,
      fail: parsed.fail,
      error: parsed.errors,
      time: Number(totalElapsed.toFixed(6)),
      testcases: parsed.tests,
    },
  ];

  return {
    mainproduct,
    subproduct,
    date: getThailandDateString(),
    time: getThailandTimeString(),
    nametest,
  };
}

type DbDetail = {
  error: string;
  name?: string;
  expected?: string;
  received?: string;
};

type DbNameTest = {
  name: string;
  pass: number;
  fail: number;
  error: number;
  time: number;
  detailfail: DbDetail[];
};

type DbDocument = {
  date: string;
  mainproduct: string;
  nametest: DbNameTest[];
  time: string;
};

function buildDbNametest(parsed: AppiumResult, fallbackSuiteName: string): DbNameTest[] {
  const suiteName = parsed.suiteName || fallbackSuiteName;
  const totalElapsed =
    typeof parsed.totalElapsedSeconds === "number"
      ? parsed.totalElapsedSeconds
      : parsed.tests.reduce(
          (acc, t) => acc + (typeof t.elapsedSeconds === "number" ? t.elapsedSeconds : 0),
          0
        );

  const detailfail: DbDetail[] = parsed.tests
    .filter((t) => t.status === "FAIL")
    .map((t) => ({
      name: t.name,
      error: truncateReason(t.failReason) || "FAILED",
    }));

  return [
    {
      name: suiteName,
      pass: parsed.pass,
      fail: parsed.fail,
      error: parsed.errors,
      time: Number(totalElapsed.toFixed(6)),
      detailfail,
    },
  ];
}

async function saveToDb(params: {
  mainproduct: string;
  subproduct: string;
  nametest: DbNameTest[];
  nowdate: string;
  nowtime: string;
}) {
  const { mainproduct, subproduct, nametest, nowdate, nowtime } = params;
  const client = await clientPromise;
  const db = client.db("automedtest-dashboard");

  const productNameCollection = db.collection("product_name");
  await productNameCollection.updateOne(
    { mainProduct: String(mainproduct) },
    {
      $setOnInsert: { mainProduct: String(mainproduct) },
      $addToSet: { subProduct: String(subproduct) },
    },
    { upsert: true }
  );

  const collection = db.collection(String(subproduct));
  // Merge nametest without reading the full document (faster for large detail arrays).
  for (const newTest of nametest) {
    const updateExisting = await collection.updateOne(
      { date: nowdate, "nametest.name": newTest.name },
      {
        $set: {
          mainproduct: String(mainproduct),
          time: String(nowtime),
          "nametest.$": newTest,
        },
      }
    );

    if (updateExisting.matchedCount === 0) {
      await collection.updateOne(
        { date: nowdate },
        {
          $set: {
            mainproduct: String(mainproduct),
            time: String(nowtime),
          },
          $push: { nametest: newTest as any },
        } as any,
        { upsert: true }
      );
    }
  }
}

async function parseAppiumJUnitXml(xml: string): Promise<AppiumResult> {
  const parsed = await xml2js.parseStringPromise(xml, {
    mergeAttrs: true,
    explicitArray: false,
    trim: true,
  });

  const suitesFromTestSuites = toArray<Record<string, unknown>>(
    (parsed as any)?.testsuites?.testsuite
  );

  const suitesFromSingleSuite = toArray<Record<string, unknown>>((parsed as any)?.testsuite);

  const suites = suitesFromTestSuites.length > 0 ? suitesFromTestSuites : suitesFromSingleSuite;

  if (suites.length === 0) {
    return {
      totalTests: 0,
      pass: 0,
      fail: 0,
      failures: 0,
      errors: 0,
      skipped: 0,
      tests: [],
    };
  }

  const counts = sumCounts(suites);
  const tests: TestDetail[] = [];
  const suiteName = String((suites[0] as any)?.name || "").trim() || undefined;

  for (const suite of suites) {
    const testcases = toArray<Record<string, unknown>>((suite as any).testcase);
    for (const tc of testcases) {
      const name = String((tc as any).name || "");
      const time = toNumber((tc as any).time);
      const failures = toArray<any>((tc as any).failure);
      const errors = toArray<any>((tc as any).error);
      const skipped = toArray<any>((tc as any).skipped);

      let status: TestDetail["status"] = "PASS";
      let failReason: string | undefined;
      if (failures.length > 0) {
        status = "FAIL";
        failReason = truncateReason(
          String(failures[0]?._ ?? failures[0]?.message ?? "")
        );
      } else if (errors.length > 0) {
        status = "FAIL";
        failReason = truncateReason(String(errors[0]?._ ?? errors[0]?.message ?? ""));
      } else if (skipped.length > 0) {
        status = "SKIP";
      }

      tests.push({
        name,
        status,
        elapsedSeconds: time || undefined,
        failReason,
      });
    }
  }

  return { ...counts, tests, suiteName };
}

async function detectRobotFrameworkXml(filePath: string): Promise<boolean> {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const head = buffer.subarray(0, bytesRead).toString("utf-8");
    return head.includes("<robot");
  } finally {
    await handle.close();
  }
}

function parseRobotFrameworkOutputFile(filePath: string): Promise<AppiumResult> {
  // Uses streaming parser so it works even for very large output.xml files.
  // Counts only <status> tags that are direct children of <test>.
  // Note: Robot Framework uses status=PASS/FAIL (and sometimes SKIP).
  // sax is a transitive dependency of xml2js.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sax = require("sax") as any;

  return new Promise((resolve, reject) => {
    const tests: TestDetail[] = [];
    const stack: string[] = [];
    let currentTest: TestDetail | null = null;
    let capturingFailMsg = false;
    let failMsgBuffer = "";
    const failMsgCandidates: string[] = [];

    let capturingFailStatusText = false;
    let failStatusTextBuffer = "";
    const failStatusCandidates: string[] = [];

    let suiteName: string | undefined;

    let capturingSuiteDoc = false;
    let suiteDocBuffer = "";

    function pickBestFailReason(): string | undefined {
      const candidates = [...failStatusCandidates, ...failMsgCandidates]
        .map((c) => String(c || "").trim())
        .filter(Boolean);
      if (candidates.length === 0) return undefined;

      // Prefer common Appium wait/element messages if present.
      const preferred = candidates
        .slice()
        .reverse()
        .find((c) => /did not appear|element\s+'[^']+'|timed out|timeout/i.test(c));
      return truncateReason(preferred || candidates[candidates.length - 1]);
    }

    const parser = sax.createStream(true, {
      trim: true,
      normalize: true,
    });

    parser.on("opentag", (node: any) => {
      const tagName = String(node.name);
      stack.push(tagName);

      if (tagName === "suite") {
        const parent = stack[stack.length - 2];
        if (!suiteName && parent === "robot") {
          suiteName = String(node.attributes?.name || "").trim() || undefined;
        }
      }

      if (tagName === "doc" && stack[stack.length - 2] === "suite") {
        // Prefer suite-level documentation as display name if present.
        capturingSuiteDoc = true;
        suiteDocBuffer = "";
        return;
      }

      if (tagName === "test") {
        currentTest = {
          name: String(node.attributes?.name || ""),
          status: "UNKNOWN",
        };
        capturingFailMsg = false;
        failMsgBuffer = "";
        failMsgCandidates.length = 0;
        capturingFailStatusText = false;
        failStatusTextBuffer = "";
        failStatusCandidates.length = 0;
        return;
      }

      if (!currentTest) return;

      if (tagName === "status") {
        const rawStatus = node.attributes?.status ?? node.attributes?.STATUS ?? node.attributes?.Status;
        const normalized = normalizeStatus(rawStatus);

        // Test-level status (direct child of <test>) gives start/elapsed.
        if (stack[stack.length - 2] === "test") {
          currentTest.status = normalized;
          const start = node.attributes?.start ?? node.attributes?.START;
          const elapsed = node.attributes?.elapsed ?? node.attributes?.ELAPSED;
          if (start) currentTest.start = String(start);
          const elapsedSeconds = toNumber(elapsed);
          if (elapsedSeconds) currentTest.elapsedSeconds = elapsedSeconds;
        }

        // Many Robot/Appium failures store the real reason as inner-text of a failing <status>.
        if (normalized === "FAIL") {
          capturingFailStatusText = true;
          failStatusTextBuffer = "";
        }
        return;
      }

      if (tagName === "msg") {
        const level = String(node.attributes?.level || node.attributes?.LEVEL || "").toUpperCase();
        // Capture FAIL-level message inside a test (may not always be the best, but useful fallback).
        if (level === "FAIL") {
          capturingFailMsg = true;
          failMsgBuffer = "";
        }
      }
    });

    parser.on("text", (text: string) => {
      if (capturingSuiteDoc) {
        if (suiteDocBuffer.length < 5000) suiteDocBuffer += text;
      }
      if (!currentTest) return;
      if (capturingFailStatusText) {
        if (failStatusTextBuffer.length < 20000) failStatusTextBuffer += text;
      }
      if (capturingFailMsg) {
        if (failMsgBuffer.length < 20000) failMsgBuffer += text;
      }
    });

    parser.on("cdata", (text: string) => {
      if (capturingSuiteDoc) {
        if (suiteDocBuffer.length < 5000) suiteDocBuffer += text;
      }
      if (!currentTest) return;
      if (capturingFailStatusText) {
        if (failStatusTextBuffer.length < 20000) failStatusTextBuffer += text;
      }
      if (capturingFailMsg) {
        if (failMsgBuffer.length < 20000) failMsgBuffer += text;
      }
    });

    parser.on("closetag", (name: string) => {
      const tagName = String(name);
      if (tagName === "doc") {
        if (capturingSuiteDoc) {
          const docText = suiteDocBuffer.trim();
          // If suite doc exists, prefer it as suiteName (more user-friendly).
          if (docText) {
            suiteName = docText;
          }
        }
        capturingSuiteDoc = false;
        suiteDocBuffer = "";
      }
      if (tagName === "msg") {
        if (capturingFailMsg) {
          const msg = failMsgBuffer.trim();
          if (msg) failMsgCandidates.push(msg);
        }
        capturingFailMsg = false;
        failMsgBuffer = "";
      }

      if (tagName === "status") {
        if (capturingFailStatusText) {
          const statusText = failStatusTextBuffer.trim();
          if (statusText) failStatusCandidates.push(statusText);
        }
        capturingFailStatusText = false;
        failStatusTextBuffer = "";
      }

      if (tagName === "test" && currentTest) {
        if (currentTest.status === "FAIL") {
          const reason = pickBestFailReason();
          if (reason) currentTest.failReason = reason;
        }
        tests.push(currentTest);
        currentTest = null;
        capturingFailMsg = false;
        failMsgBuffer = "";
        capturingFailStatusText = false;
        failStatusTextBuffer = "";
      }

      stack.pop();
    });

    parser.on("end", () => {
      const totalTests = tests.length;
      const pass = tests.filter((t) => t.status === "PASS").length;
      const failures = tests.filter((t) => t.status === "FAIL").length;
      const skipped = tests.filter((t) => t.status === "SKIP").length;
      resolve({
        totalTests,
        pass,
        fail: failures,
        failures,
        errors: 0,
        skipped,
        tests,
        suiteName,
      });
    });

    parser.on("error", (error: any) => {
      reject(error);
    });

    createReadStream(filePath, { encoding: "utf-8" }).pipe(parser);
  });
}

function parseRobotFrameworkOutputFileFast(filePath: string): Promise<AppiumResult> {
  // Faster mode: count pass/fail and collect only failed test details.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sax = require("sax") as any;

  return new Promise((resolve, reject) => {
    const failedTests: TestDetail[] = [];
    const stack: string[] = [];

    let totalTests = 0;
    let pass = 0;
    let failures = 0;
    let skipped = 0;
    let totalElapsedSeconds = 0;

    let currentTestName = "";
    let currentTestStatus: TestDetail["status"] = "UNKNOWN";
    let currentTestStart: string | undefined;
    let currentTestElapsed: number | undefined;

    let suiteName: string | undefined;
    let capturingSuiteDoc = false;
    let suiteDocBuffer = "";

    let capturingFailMsg = false;
    let failMsgBuffer = "";
    const failMsgCandidates: string[] = [];

    let capturingFailStatusText = false;
    let failStatusTextBuffer = "";
    const failStatusCandidates: string[] = [];

    function pickBestFailReason(): string | undefined {
      const candidates = [...failStatusCandidates, ...failMsgCandidates]
        .map((c) => String(c || "").trim())
        .filter(Boolean);
      if (candidates.length === 0) return undefined;
      const preferred = candidates
        .slice()
        .reverse()
        .find((c) => /did not appear|element\s+'[^']+'|timed out|timeout/i.test(c));
      return truncateReason(preferred || candidates[candidates.length - 1]);
    }

    const parser = sax.createStream(true, {
      trim: true,
    });

    parser.on("opentag", (node: any) => {
      const tagName = String(node.name);
      stack.push(tagName);

      if (tagName === "suite") {
        const parent = stack[stack.length - 2];
        if (!suiteName && parent === "robot") {
          suiteName = String(node.attributes?.name || "").trim() || undefined;
        }
      }

      if (tagName === "doc" && stack[stack.length - 2] === "suite") {
        capturingSuiteDoc = true;
        suiteDocBuffer = "";
        return;
      }

      if (tagName === "test") {
        currentTestName = String(node.attributes?.name || "");
        currentTestStatus = "UNKNOWN";
        currentTestStart = undefined;
        currentTestElapsed = undefined;
        failMsgCandidates.length = 0;
        failStatusCandidates.length = 0;
        capturingFailMsg = false;
        capturingFailStatusText = false;
        failMsgBuffer = "";
        failStatusTextBuffer = "";
        return;
      }

      if (tagName === "status") {
        const rawStatus = node.attributes?.status ?? node.attributes?.STATUS ?? node.attributes?.Status;
        const normalized = normalizeStatus(rawStatus);

        if (stack[stack.length - 2] === "test") {
          currentTestStatus = normalized;
          const start = node.attributes?.start ?? node.attributes?.START;
          const elapsed = node.attributes?.elapsed ?? node.attributes?.ELAPSED;
          if (start) currentTestStart = String(start);
          const elapsedSeconds = toNumber(elapsed);
          if (elapsedSeconds) currentTestElapsed = elapsedSeconds;
        }

        if (normalized === "FAIL") {
          capturingFailStatusText = true;
          failStatusTextBuffer = "";
        }
        return;
      }

      if (tagName === "msg") {
        const level = String(node.attributes?.level || node.attributes?.LEVEL || "").toUpperCase();
        if (level === "FAIL") {
          capturingFailMsg = true;
          failMsgBuffer = "";
        }
      }
    });

    parser.on("text", (text: string) => {
      if (capturingSuiteDoc) {
        if (suiteDocBuffer.length < 5000) suiteDocBuffer += text;
      }
      if (capturingFailStatusText) {
        if (failStatusTextBuffer.length < 20000) failStatusTextBuffer += text;
      }
      if (capturingFailMsg) {
        if (failMsgBuffer.length < 20000) failMsgBuffer += text;
      }
    });

    parser.on("cdata", (text: string) => {
      if (capturingSuiteDoc) {
        if (suiteDocBuffer.length < 5000) suiteDocBuffer += text;
      }
      if (capturingFailStatusText) {
        if (failStatusTextBuffer.length < 20000) failStatusTextBuffer += text;
      }
      if (capturingFailMsg) {
        if (failMsgBuffer.length < 20000) failMsgBuffer += text;
      }
    });

    parser.on("closetag", (name: string) => {
      const tagName = String(name);

      if (tagName === "doc") {
        if (capturingSuiteDoc) {
          const docText = suiteDocBuffer.trim();
          if (docText) suiteName = docText;
        }
        capturingSuiteDoc = false;
        suiteDocBuffer = "";
      }

      if (tagName === "msg") {
        if (capturingFailMsg) {
          const msg = failMsgBuffer.trim();
          if (msg) failMsgCandidates.push(msg);
        }
        capturingFailMsg = false;
        failMsgBuffer = "";
      }

      if (tagName === "status") {
        if (capturingFailStatusText) {
          const statusText = failStatusTextBuffer.trim();
          if (statusText) failStatusCandidates.push(statusText);
        }
        capturingFailStatusText = false;
        failStatusTextBuffer = "";
      }

      if (tagName === "test") {
        totalTests += 1;
        if (currentTestStatus === "PASS") pass += 1;
        else if (currentTestStatus === "SKIP") skipped += 1;
        else if (currentTestStatus === "FAIL") failures += 1;

        if (typeof currentTestElapsed === "number") {
          totalElapsedSeconds += currentTestElapsed;
        }

        if (currentTestStatus === "FAIL") {
          failedTests.push({
            name: currentTestName,
            status: "FAIL",
            start: currentTestStart,
            elapsedSeconds: currentTestElapsed,
            failReason: pickBestFailReason(),
          });
        }
      }

      stack.pop();
    });

    parser.on("end", () => {
      resolve({
        totalTests,
        pass,
        fail: failures,
        failures,
        errors: 0,
        skipped,
        tests: failedTests,
        suiteName,
        totalElapsedSeconds: Number(totalElapsedSeconds.toFixed(6)),
      });
    });

    parser.on("error", (error: any) => {
      reject(error);
    });

    createReadStream(filePath, { encoding: "utf-8" }).pipe(parser);
  });
}

function getUploadedFile(files: formidable.Files): formidable.File | undefined {
  const fileValue = (files as any).file;
  if (!fileValue) return undefined;
  if (Array.isArray(fileValue)) return fileValue[0];
  return fileValue as formidable.File;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const rawFile = asSingleQueryValue(req.query.file as any);
    if (!rawFile) {
      const contentType = String(req.headers["content-type"] || "").toLowerCase();
      const isMultipart = contentType.includes("multipart/form-data");
      return res.status(400).json({
        error: "Missing query param: file",
        hint: isMultipart
          ? "You are sending form-data with GET. Use POST to upload a file. GET only supports reading a file by name via query string."
          : "GET requires ?file=<filename>. Use POST to upload a file in form-data field name 'file'.",
        usage: {
          get: "/api/parseappiumxml?file=output-FAIL-tests9%20-passed8-failed1.xml",
          post: "POST /api/parseappiumxml (multipart/form-data: file=@output.xml)",
        },
      });
    }

    const safeFileName = path.basename(rawFile);
    const fullPath = path.join(process.cwd(), "uploads", "appium", safeFileName);

    const mainproduct = asSingleQueryValue(req.query.mainproduct as any) || "UNKNOWN";
    const subproduct = asSingleQueryValue(req.query.subproduct as any) || "UNKNOWN";

    try {
      const isRobot = await detectRobotFrameworkXml(fullPath);
      const parsed = isRobot
        ? await parseRobotFrameworkOutputFile(fullPath)
        : await parseAppiumJUnitXml(await fs.readFile(fullPath, "utf-8"));
      const body = buildDashboardBody({
        mainproduct,
        subproduct,
        fileLabel: safeFileName,
        parsed,
      });
      return res.status(200).json(body);
    } catch {
      return res.status(404).json({ error: "File not found or unreadable", file: safeFileName });
    }
  }

  if (req.method === "POST") {
    const MAX_UPLOAD_BYTES =
      Number(process.env.APPIUM_MAX_UPLOAD_BYTES) || 1 * 1024 * 1024 * 1024; // default 1GB
    const form = formidable({
      multiples: false,
      maxFileSize: MAX_UPLOAD_BYTES,
      maxTotalFileSize: MAX_UPLOAD_BYTES,
    });

    console.log(
      `[INFO] addappiumdata POST received: content-type="${req.headers["content-type"] || ""}" content-length="${req.headers["content-length"] || ""}"`
    );

    return form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("[ERROR] addappiumdata failed to parse form-data:", err);
        // formidable size-limit errors carry code 1009 (maxFileSize) / 1015 (maxTotalFileSize)
        const isTooLarge =
          (err as any)?.httpCode === 413 ||
          (err as any)?.code === 1009 ||
          (err as any)?.code === 1015;
        if (isTooLarge) {
          const maxMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
          return res.status(413).json({
            error: "Uploaded file too large",
            maxFileSizeBytes: MAX_UPLOAD_BYTES,
            hint: `File exceeds the upload limit of ${maxMb} MB. Increase APPIUM_MAX_UPLOAD_BYTES to allow larger files.`,
          });
        }
        return res.status(400).json({ error: "Error parsing form-data" });
      }

      console.log(
        `[INFO] addappiumdata form parsed: fields=${JSON.stringify(Object.keys(fields))} files=${JSON.stringify(Object.keys(files))}`
      );

      const file = getUploadedFile(files);
      if (!file) {
        console.error(
          `[ERROR] addappiumdata uploaded file not found (expected field name: file). Received file fields: ${JSON.stringify(
            Object.keys(files)
          )}`
        );
        return res.status(400).json({ error: "File not found in form-data (field name: file)" });
      }

      console.log(
        `[INFO] addappiumdata file received: originalFilename="${file.originalFilename || ""}" mimetype="${file.mimetype || ""}" size=${file.size} filepath="${file.filepath}"`
      );

      const mainFromFields = asSingleQueryValue((fields as any).mainproduct);
      const subFromFields = asSingleQueryValue((fields as any).subproduct);
      const mainFromQuery = asSingleQueryValue(req.query.mainproduct as any);
      const subFromQuery = asSingleQueryValue(req.query.subproduct as any);
      const mainProductValue = mainFromFields || mainFromQuery || "UNKNOWN";
      const subProductValue = subFromFields || subFromQuery || "UNKNOWN";

      console.log(
        `[INFO] addappiumdata resolved products: mainproduct="${mainProductValue}" (fields="${mainFromFields || ""}" query="${mainFromQuery || ""}") subproduct="${subProductValue}" (fields="${subFromFields || ""}" query="${subFromQuery || ""}")`
      );

      if (mainProductValue === "UNKNOWN" || subProductValue === "UNKNOWN") {
        console.error(
          `[ERROR] addappiumdata invalid/missing product: mainproduct="${mainProductValue}" subproduct="${subProductValue}"`
        );
        return res.status(400).json({
          error: "Invalid or missing mainproduct or subproduct",
          hint: "Send mainproduct/subproduct as form-data fields (recommended) or as query params.",
        });
      }

      try {
        const isRobot = await detectRobotFrameworkXml(file.filepath);
        console.log(
          `[INFO] addappiumdata parsing file="${file.originalFilename || ""}" detected format=${isRobot ? "RobotFramework" : "AppiumJUnit"}`
        );
        const parsed = isRobot
          ? await parseRobotFrameworkOutputFileFast(file.filepath)
          : await parseAppiumJUnitXml(await fs.readFile(file.filepath, "utf-8"));

        const nowdate = getThailandDateString();
        const nowtime = getThailandTimeString();
        const dbNametest = buildDbNametest(parsed, file.originalFilename || "uploaded.xml");
        console.log(
          `[INFO] addappiumdata saving to DB: mainproduct="${mainProductValue}" subproduct="${subProductValue}" nametest="${dbNametest}" date="${nowdate}" time="${nowtime}"`
        );
        await saveToDb({
          mainproduct: mainProductValue,
          subproduct: subProductValue,
          nametest: dbNametest,
          nowdate,
          nowtime,
        });

        console.log(
          `[INFO] addappiumdata saved successfully: subproduct="${subProductValue}" nametest="${dbNametest}"`
        );
        return res.status(200).json({
          message: "Data saved successfully in product " + subProductValue,
        });
      } catch (error) {
        console.error(
          `[ERROR] addappiumdata failed to parse/save XML: file="${file.originalFilename || ""}" mainproduct="${mainProductValue}" subproduct="${subProductValue}"`,
          error
        );
        return res.status(500).json({ error: "Error parsing XML" });
      }
    });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}

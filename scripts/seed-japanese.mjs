import { readFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// File paths
const CSV_PATH = join(projectRoot, "japanese.csv");
const DEFAULT_SERVICE_ACCOUNT_PATH = join(projectRoot, "voca-drink-b5bb094bd3bd.json");

function tryParseJsonMaybeBase64(value) {
  if (!value) return null;
  try {
    if (value.trim().startsWith("{")) return JSON.parse(value);
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function loadServiceAccount() {
  // Highest priority: JSON content from env (raw or base64)
  const fromJsonEnv = tryParseJsonMaybeBase64(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (fromJsonEnv) return fromJsonEnv;

  // Next: GOOGLE_APPLICATION_CREDENTIALS file path
  const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gacPath) {
    const content = await readFile(gacPath, "utf8");
    return JSON.parse(content);
  }

  // Fallback: local file (kept out of git via .gitignore)
  try {
    const content = await readFile(DEFAULT_SERVICE_ACCOUNT_PATH, "utf8");
    return JSON.parse(content);
  } catch (e) {
    throw new Error(
      "Service account not found. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS."
    );
  }
}

function parseArgs(argv) {
  const args = {};
  for (const token of argv.slice(2)) {
    if (!token.startsWith("--")) continue;
    const [k, v] = token.slice(2).split("=");
    args[k] = v ?? "true";
  }
  return args;
}

function normalizeKana(kanaRaw) {
  if (!kanaRaw) return "";
  return String(kanaRaw).replaceAll("〜", "-").replaceAll("~", "-").trim();
}

function buildExamples(row) {
  const examples = [];
  const e1 = {
    sentence: (row.JP_Example_1 || "").trim(),
    pronunciation: (row.JP_Example_Pronunciation_1 || "").trim(),
    translation: { ko: (row.JP_Example_Meaning_1 || "").trim() },
  };
  if (e1.sentence || e1.pronunciation || e1.translation.ko) examples.push(e1);

  const e2 = {
    sentence: (row.JP_Example_2 || "").trim(),
    pronunciation: (row.JP_Example_Pronunciation_2 || "").trim(),
    translation: { ko: (row.JP_Example_Meaning_2 || "").trim() },
  };
  if (e2.sentence || e2.pronunciation || e2.translation.ko) examples.push(e2);

  return examples;
}

function transformRowToDoc(row) {
  const kanaSource = row.Gana ?? row.Kana ?? "";
  return {
    kana: normalizeKana(kanaSource),
    kanji: (row.Kanji || "").trim(),
    meanings: { ko: (row.Meaning || "").trim() },
    tags: ["csat"],
    examples: buildExamples(row),
    createdAt: new Date().toISOString(),
  };
}

async function main() {
  const [csvContent, serviceAccount] = await Promise.all([
    readFile(CSV_PATH, "utf8"),
    loadServiceAccount(),
  ]);

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  const db = getFirestore();

  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const args = parseArgs(process.argv);
  const skipRaw = Number(args.skip ?? 0);
  const limitRaw = args.limit !== undefined ? Number(args.limit) : undefined;
  const skip =
    Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.floor(limitRaw)
      : undefined;

  const sliceEnd = limit ? skip + limit : undefined;
  const selected = rows.slice(skip, sliceEnd).map(transformRowToDoc);

  let inserted = 0;
  for (const doc of selected) {
    await db.collection("japanese").add(doc);
    inserted += 1;
  }

  console.log(
    `Inserted ${inserted} documents into 'japanese' (skip=${skip}${
      limit ? `, limit=${limit}` : ""
    }).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

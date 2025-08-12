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
const SERVICE_ACCOUNT_PATH = join(projectRoot, "voca-drink-b5bb094bd3bd.json");

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
  const [csvContent, saJson] = await Promise.all([
    readFile(CSV_PATH, "utf8"),
    readFile(SERVICE_ACCOUNT_PATH, "utf8"),
  ]);

  const serviceAccount = JSON.parse(saJson);

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

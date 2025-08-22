import { readFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// File paths
const CSV_PATH = join(projectRoot, "Japanese - Kana.csv");
const DEFAULT_SERVICE_ACCOUNT_PATH = join(
  projectRoot,
  "voca-drink-b5bb094bd3bd.json"
);

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
  const fromJsonEnv = tryParseJsonMaybeBase64(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  );
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

function aggregateRows(rows) {
  // Group by kana syllable; build examples from words
  const map = new Map();
  for (const row of rows) {
    const kanaSyllable = String(row[0] ?? "").trim();
    const koPron = String(row[1] ?? "").trim();
    const jpWord = String(row[2] ?? "").trim();
    const koMeaning = String(row[3] ?? "").trim();
    if (!kanaSyllable) continue;
    if (!map.has(kanaSyllable)) {
      map.set(kanaSyllable, {
        id: kanaSyllable,
        kana: normalizeKana(kanaSyllable),
        kanji: "",
        meanings: { ko: koPron }, // show Korean pronunciation as the meaning line
        tags: ["kana"],
        examples: [],
        createdAt: new Date().toISOString(),
      });
    }
    if (jpWord || koMeaning) {
      const doc = map.get(kanaSyllable);
      doc.examples.push({
        sentence: jpWord,
        pronunciation: "",
        translation: { ko: koMeaning },
      });
    }
  }
  return Array.from(map.values());
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
    columns: false,
    skip_empty_lines: true,
    trim: true,
  });

  const args = parseArgs(process.argv);
  const targetCollection = (args.collection || "japanese_kana").toString();
  const dryRun = String(args.dryRun || "false").toLowerCase() === "true";

  const skipRaw = Number(args.skip ?? 0);
  const limitRaw = args.limit !== undefined ? Number(args.limit) : undefined;
  const skip =
    Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.floor(limitRaw)
      : undefined;

  const sliceEnd = limit ? skip + limit : undefined;
  const selectedRows = rows.slice(skip, sliceEnd);
  const aggregatedDocs = aggregateRows(selectedRows);

  if (dryRun) {
    console.log(
      `Dry run: would insert ${aggregatedDocs.length} docs into '${targetCollection}'. Example:`,
      aggregatedDocs[0]
    );
    return;
  }

  // Clear existing docs (except metadata)
  const existing = await db.collection(targetCollection).get();
  const deletions = [];
  existing.forEach((d) => {
    if (d.id !== "metadata") deletions.push(d.ref.delete());
  });
  if (deletions.length > 0) await Promise.all(deletions);

  // Insert aggregated docs with deterministic IDs (kana syllable)
  let inserted = 0;
  for (const doc of aggregatedDocs) {
    const id = doc.id || doc.kana;
    await db
      .collection(targetCollection)
      .doc(String(id))
      .set(doc, { merge: true });
    inserted += 1;
  }

  // Upsert metadata document for deck discoverability
  try {
    const metaRef = db.collection(targetCollection).doc("metadata");
    await metaRef.set(
      {
        name:
          targetCollection === "japanese_kana"
            ? "Japanese Kana"
            : targetCollection,
        title:
          targetCollection === "japanese_kana"
            ? "Japanese Kana"
            : targetCollection,
        count: inserted,
        isPublic: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("Failed to write metadata:", e?.message || e);
  }

  console.log(
    `Inserted ${inserted} documents into '${targetCollection}' (skip=${skip}${
      limit ? `, limit=${limit}` : ""
    }).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

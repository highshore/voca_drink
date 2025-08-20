import { readFile, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

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
  const fromJsonEnv = tryParseJsonMaybeBase64(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  );
  if (fromJsonEnv) return fromJsonEnv;
  const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gacPath) {
    const content = await readFile(gacPath, "utf8");
    return JSON.parse(content);
  }
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

function ratingToInt(r) {
  switch (r) {
    case "again":
      return 1;
    case "hard":
      return 2;
    case "good":
      return 3;
    case "easy":
      return 4;
    default:
      return 3;
  }
}

function toIso(ts) {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  const d = new Date(ts);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const uid = args.uid;
  const out = args.out || join(projectRoot, "leitner-review-logs.json");
  if (!uid) {
    console.error(
      "Usage: node scripts/leitner-export-logs.mjs --uid=USER_ID [--out=path.json]"
    );
    process.exit(1);
  }

  const serviceAccount = await loadServiceAccount();
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  const db = getFirestore();

  const col = db.collection("users").doc(uid).collection("reviews");
  const snap = await col.orderBy("createdAt", "asc").get();

  const logs = [];
  snap.forEach((d) => {
    const data = d.data();
    const deck = data.deck;
    const vocabId = data.vocabId;
    const rating = ratingToInt(data.rating);
    const at = toIso(data.createdAt);
    if (!deck || !vocabId || !at) return;
    logs.push({
      cardId: `${deck}:${vocabId}`,
      reviewTimestamp: at,
      userRating: rating,
    });
  });

  await writeFile(out, JSON.stringify(logs, null, 2));
  console.log(`Exported ${logs.length} logs for uid=${uid} to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

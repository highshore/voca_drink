import { readFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
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
  const fromJsonEnv = tryParseJsonMaybeBase64(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
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
    throw new Error("Service account not found. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
  }
}

async function main() {
  const serviceAccount = await loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  const db = getFirestore();
  const snap = await db.collection("japanese").get();
  console.log(`japanese count: ${snap.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

import { readFile } from "fs/promises";
import { dirname, resolve, join } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

async function main() {
  const args = parseArgs(process.argv);
  const collection = (args.collection || "").toString();
  if (!collection) {
    throw new Error(
      "Usage: node scripts/set-deck-public.mjs --collection=<name> [--public=true|false]"
    );
  }
  const publicFlag = String(args.public ?? "true").toLowerCase() === "true";

  const serviceAccount = await loadServiceAccount();
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  const db = getFirestore();

  // Count docs (excluding metadata)
  const snap = await db.collection(collection).get();
  const count = Math.max(
    0,
    snap.size - (snap.docs.some((d) => d.id === "metadata") ? 1 : 0)
  );

  await db.collection(collection).doc("metadata").set(
    {
      name: collection,
      title: collection,
      isPublic: publicFlag,
      count,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log(
    `Updated ${collection}/metadata with isPublic=${publicFlag}, count=${count}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

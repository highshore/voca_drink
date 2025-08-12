import { readFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const SERVICE_ACCOUNT_PATH = join(projectRoot, "voca-drink-b5bb094bd3bd.json");

async function main() {
  const saJson = await readFile(SERVICE_ACCOUNT_PATH, "utf8");
  const serviceAccount = JSON.parse(saJson);

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

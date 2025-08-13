import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export type DeckMetadata = {
  name?: string;
  title?: string;
  count: number;
};

const CANDIDATE_META_IDS = ["metadata", "meta", "_meta", "__meta__"];

export async function getDeckMetadata(
  deck: string
): Promise<DeckMetadata | null> {
  for (const id of CANDIDATE_META_IDS) {
    try {
      const ref = doc(db, deck, id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        const nameVal =
          typeof data.name === "string" && data.name.trim().length > 0
            ? data.name
            : undefined;
        const titleVal =
          typeof data.title === "string" && data.title.trim().length > 0
            ? data.title
            : undefined;
        const countRaw = data.count;
        const count: number = Number.isFinite(countRaw) ? Number(countRaw) : 0;
        return { name: nameVal, title: titleVal, count };
      }
    } catch (_) {
      // ignore and try next id
    }
  }
  return null;
}

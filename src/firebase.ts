import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase web configuration
const firebaseConfig = {
  apiKey: "REDACTED_API_KEY",
  authDomain: "voca-drink.firebaseapp.com",
  projectId: "voca-drink",
  storageBucket: "voca-drink.firebasestorage.app",
  messagingSenderId: "843178484254",
  appId: "1:843178484254:web:957c5b6a48e43dffbc040f",
  measurementId: "G-PS55P74D2Y",
};

// Initialize Firebase app (client)
export const app = initializeApp(firebaseConfig);

// Initialize analytics in browser environments only
if (typeof window !== "undefined") {
  try {
    getAnalytics(app);
  } catch (_) {
    // no-op if analytics cannot initialize
  }
}

// Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Google provider and helpers
export const googleProvider = new GoogleAuthProvider();
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export type { User };

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { messages, SUPPORTED_LANGUAGES, type LanguageCode } from "./messages";
import { useAuth } from "../auth/AuthContext";
import { getDoc, setDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

type I18nContextValue = {
  lang: LanguageCode;
  t: (key: string) => string;
  setLanguage: (code: LanguageCode) => Promise<void>;
  supported: { code: LanguageCode; label: string }[];
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const LOCAL_STORAGE_KEY = "voca_drink.lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [lang, setLang] = useState<LanguageCode>(() => {
    const fromStorage = (typeof window !== "undefined" &&
      localStorage.getItem(LOCAL_STORAGE_KEY)) as LanguageCode | null;
    return fromStorage && (fromStorage === "en" || fromStorage === "ko")
      ? fromStorage
      : "en";
  });

  // Load language from user profile if logged in
  useEffect(() => {
    let cancelled = false;
    async function loadUserLang() {
      if (!user) return;
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const pref = (
          snap.exists()
            ? ((snap.data() as any)?.language as string | undefined)
            : undefined
        ) as LanguageCode | undefined;
        if (!cancelled && (pref === "en" || pref === "ko")) {
          setLang(pref);
          if (typeof window !== "undefined")
            localStorage.setItem(LOCAL_STORAGE_KEY, pref);
        }
      } catch (_) {}
    }
    loadUserLang();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const t = useCallback(
    (key: string) => {
      const dict = messages[lang] ?? messages.en;
      return dict[key] ?? key;
    },
    [lang]
  );

  const setLanguage = useCallback(
    async (code: LanguageCode) => {
      setLang(code);
      if (typeof window !== "undefined")
        localStorage.setItem(LOCAL_STORAGE_KEY, code);
      if (user) {
        try {
          const ref = doc(db, "users", user.uid);
          await setDoc(ref, { language: code }, { merge: true });
        } catch (_) {}
      }
    },
    [user]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, t, setLanguage, supported: SUPPORTED_LANGUAGES }),
    [lang, t, setLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

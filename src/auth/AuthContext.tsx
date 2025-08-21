import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, signInWithGoogle, signOutUser, type User } from "../firebase";
import { ensureUserDocument } from "../services/userService";
import { onAuthStateChanged } from "firebase/auth";
import { UniversalLoader } from "../components/UniversalLoader";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login: async () => {
        const u = await signInWithGoogle();
        await ensureUserDocument(u);
      },
      logout: async () => {
        await signOutUser();
      },
    }),
    [user, isLoading]
  );

  return (
    <AuthContext.Provider value={value}>
      {isLoading ? <UniversalLoader message="Initializing…" /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

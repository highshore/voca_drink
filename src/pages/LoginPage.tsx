import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { login, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state: any = location.state;
  const fromState = state?.from;
  const fromPath = (() => {
    if (typeof fromState === "string") return fromState;
    if (fromState && typeof fromState === "object") {
      const p = fromState.pathname ?? "/";
      const s = fromState.search ?? "";
      const h = fromState.hash ?? "";
      return `${p}${s}${h}`;
    }
    return "/";
  })();

  useEffect(() => {
    if (!isLoading && user) {
      navigate(fromPath, { replace: true });
    }
  }, [isLoading, user, fromPath, navigate]);

  const onLogin = async () => {
    await login();
    navigate(fromPath, { replace: true });
  };
  return (
    <div className="stack">
      <h2>Sign in</h2>
      <p>Use your Google account to continue.</p>
      <button className="button brand" onClick={onLogin} disabled={isLoading}>
        Sign in with Google
      </button>
    </div>
  );
}

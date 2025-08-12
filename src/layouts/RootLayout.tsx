import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { s } from "../ui/layout";

export function RootLayout() {
  const { user, logout, login, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const onLogin = async () => {
    await login();
    // If user triggered from a protected route, send them back including query/hash
    const fromState: any = (location.state as any)?.from;
    let target = "/";
    if (typeof fromState === "string") {
      target = fromState;
    } else if (fromState && typeof fromState === "object") {
      const p = fromState.pathname ?? "/";
      const s = fromState.search ?? "";
      const h = fromState.hash ?? "";
      target = `${p}${s}${h}`;
    }
    navigate(target, { replace: true });
  };

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div style={s.appShell}>
      <nav style={s.nav}>
        <div style={s.navInner}>
          <Link to="/" aria-label="Voca Drink" style={s.brandWrap}>
            <div style={s.brandBadge} />
            <span>Voca Drink</span>
          </Link>
          <div style={s.navButtons}>
            <Link
              to="/decks"
              style={s.button}
              aria-current={location.pathname === "/decks" ? "page" : undefined}
            >
              Decks
            </Link>
            <Link
              to="/vocab?deck=japanese"
              style={s.button}
              aria-current={
                location.pathname.startsWith("/vocab") ? "page" : undefined
              }
            >
              Vocabulary
            </Link>
            <Link
              to="/learn"
              style={s.button}
              aria-current={location.pathname === "/learn" ? "page" : undefined}
            >
              Learn
            </Link>
            <Link
              to="/review"
              style={s.button}
              aria-current={
                location.pathname === "/review" ? "page" : undefined
              }
            >
              Review
            </Link>
            {isLoading ? (
              <div style={s.button} aria-busy>
                Loading
              </div>
            ) : user ? (
              <button style={s.button} onClick={onLogout}>
                Sign out
              </button>
            ) : (
              <button
                style={{ ...s.button, ...s.buttonBrand }}
                onClick={onLogin}
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </nav>
      <main style={{ ...s.container, ...s.main }}>
        <Outlet />
      </main>
      <footer style={s.footer}>
        <div style={s.container}>© {new Date().getFullYear()} Voca Drink</div>
      </footer>
    </div>
  );
}

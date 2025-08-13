import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { s } from "../ui/layout";
import defaultUser from "../assets/default_user.jpg";
import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export function RootLayout() {
  const { user, logout, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) {
      setPhotoURL(null);
      return;
    }
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.data() as any;
      setPhotoURL((d?.photoURL as string) ?? user.photoURL ?? null);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    window.addEventListener("click", onClickOutside);
    return () => window.removeEventListener("click", onClickOutside);
  }, []);

  // onLogin removed; logged-out users navigate to /login

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  // Full-bleed pages (e.g., /login) render without the app chrome
  if (location.pathname === "/login") {
    return <Outlet />;
  }

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
              {t("nav.decks")}
            </Link>
            <Link
              to="/vocab?deck=japanese"
              style={s.button}
              aria-current={
                location.pathname.startsWith("/vocab") ? "page" : undefined
              }
            >
              {t("nav.vocab")}
            </Link>
            <Link
              to="/learn"
              style={s.button}
              aria-current={location.pathname === "/learn" ? "page" : undefined}
            >
              {t("nav.learn")}
            </Link>
            <Link
              to="/review"
              style={s.button}
              aria-current={
                location.pathname === "/review" ? "page" : undefined
              }
            >
              {t("nav.review")}
            </Link>
            {/* Profile button removed; access via avatar dropdown */}
            {isLoading ? (
              <div style={s.button} aria-busy>
                {t("nav.loading")}
              </div>
            ) : user ? (
              <div style={{ position: "relative" }} ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup
                  aria-expanded={menuOpen}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 999,
                    padding: 0,
                    width: 36,
                    height: 36,
                    background: "#fff",
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={photoURL || user.photoURL || defaultUser}
                    alt="avatar"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    style={{
                      position: "absolute",
                      top: 44,
                      right: 0,
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      background: "#fff",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      minWidth: 160,
                      zIndex: 10,
                    }}
                  >
                    <Link
                      to="/profile"
                      style={{
                        display: "block",
                        padding: "10px 12px",
                        textDecoration: "none",
                        color: "#0f172a",
                        fontSize: 14,
                      }}
                      onClick={() => setMenuOpen(false)}
                    >
                      {t("nav.profile")}
                    </Link>
                    <button
                      style={{
                        display: "block",
                        padding: "10px 12px",
                        width: "100%",
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#ef4444",
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                      onClick={onLogout}
                    >
                      {t("nav.signOut")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  background: "#0f172a",
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                {t("nav.signInShort")}
              </Link>
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

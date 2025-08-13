import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { s, colSpan } from "../ui/layout";
import { useI18n } from "../i18n/I18nContext";

export function HomePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  return (
    <div style={{ ...s.container, padding: "48px 0" }}>
      <div style={s.grid12}>
        <div style={colSpan(12)}>
          <h1
            style={{
              fontSize: 40,
              lineHeight: 1.1,
              margin: "0 0 12px",
              letterSpacing: "-0.02em",
              ...s.gradientTitle,
            }}
          >
            Master Japanese vocabulary with spaced repetition
          </h1>
          <p style={{ color: "#475569", margin: 0 }}>
            A YC-style focused tool for memorizing counters, grammar particles,
            and everyday words — sourced from your Firestore database.
          </p>
        </div>
        <div
          style={{ ...colSpan(12), marginTop: 24, display: "flex", gap: 12 }}
        >
          <Link to="/decks" style={{ ...s.button, ...s.buttonBrand }}>
            {t("home.browseDecks")}
          </Link>
          {user && (
            <Link to="/dashboard" style={s.button}>
              {t("nav.dashboard")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

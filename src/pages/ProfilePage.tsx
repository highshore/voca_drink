import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { s } from "../ui/layout";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "../i18n/messages";
import {
  getUserProfile,
  updateUserProfile,
  uploadAndSetUserAvatar,
} from "../services/userService";
import defaultUser from "../assets/default_user.jpg";

export function ProfilePage() {
  const { user } = useAuth();
  const { t, lang, setLanguage } = useI18n();
  const [displayName, setDisplayName] = useState<string>("");
  const [dailyGoal, setDailyGoal] = useState<number>(20);
  const [language, setLangState] = useState<LanguageCode>(lang);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarURL, setAvatarURL] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      const profile = await getUserProfile(user.uid);
      if (profile && !cancelled) {
        setDisplayName(profile.displayName ?? "");
        setDailyGoal(Number(profile.dailyGoal ?? 20));
        if (profile.language) setLangState(profile.language);
        setAvatarURL(profile.photoURL ?? user.photoURL ?? null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateUserProfile(user.uid, {
        displayName: displayName || null,
        dailyGoal: Math.max(1, Math.min(200, Math.round(dailyGoal))),
        language,
      });
      await setLanguage(language);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const { url } = await uploadAndSetUserAvatar(user.uid, file);
      setAvatarURL(url);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div style={{ ...s.container }}>
      <h2 style={{ margin: 0, marginBottom: 16, ...s.gradientTitle }}>
        {t("profile.title")}
      </h2>
      <div style={{ ...s.card, maxWidth: 560 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <img
            src={avatarURL || defaultUser}
            alt="avatar"
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              objectFit: "cover",
              border: "1px solid #e2e8f0",
            }}
          />
          <div>
            <label
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "8px 12px",
                background: uploading ? "#f8fafc" : "#fff",
                cursor: uploading ? "default" : "pointer",
                display: "inline-block",
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={onAvatarChange}
                style={{ display: "none" }}
              />
              {uploading ? t("common.loading") : t("profile.changePhoto")}
            </label>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              {t("profile.displayName")}
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
              }}
              placeholder="Your name"
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              {t("profile.dailyGoal")}
            </span>
            <input
              type="number"
              min={1}
              max={200}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
                width: 120,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              {t("profile.language")}
            </span>
            <select
              value={language}
              onChange={(e) => setLangState(e.target.value as LanguageCode)}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
                width: 200,
                background: "#fff",
              }}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={onSave}
              disabled={saving}
              style={{ ...s.button, ...(saving ? {} : s.buttonBrand) }}
            >
              {t("profile.save")}
            </button>
            {saved && (
              <span style={{ color: "#16a34a", fontWeight: 600 }}>
                {t("profile.saved")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

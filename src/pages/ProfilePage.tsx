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
import {
  getAccountabilityBuddies,
  addAccountabilityBuddy,
  removeAccountabilityBuddy,
} from "../services/userService";
import { RecaptchaVerifier, linkWithPhoneNumber } from "firebase/auth";
import { auth } from "../firebase";

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
  const [buddies, setBuddies] = useState<string[]>([]);
  const [newBuddy, setNewBuddy] = useState("");
  const [countryDial, setCountryDial] = useState<string>("+82");
  const [phone, setPhone] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const COUNTRY_CODES: Array<{ label: string; dial: string; iso: string }> = [
    { label: "Korea (+82)", dial: "+82", iso: "KR" },
    { label: "United States (+1)", dial: "+1", iso: "US" },
    { label: "Japan (+81)", dial: "+81", iso: "JP" },
    { label: "Canada (+1)", dial: "+1", iso: "CA" },
    { label: "United Kingdom (+44)", dial: "+44", iso: "GB" },
  ];

  function buildE164(inputDigits: string, dial: string): string {
    const digits = (inputDigits || "").replace(/\D/g, "");
    if (dial === "+82" && digits.startsWith("0"))
      return `${dial}${digits.slice(1)}`;
    return `${dial}${digits}`;
  }

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
      if (user && !cancelled) {
        const list = await getAccountabilityBuddies(user.uid);
        setBuddies(list);
        if (user.phoneNumber) {
          try {
            // Try to prefill country code if it matches known codes
            const match = COUNTRY_CODES.find((c) =>
              user.phoneNumber!.startsWith(c.dial)
            );
            if (match) {
              setCountryDial(match.dial);
              setPhone(user.phoneNumber!.slice(match.dial.length));
            } else {
              setPhone(user.phoneNumber);
            }
          } catch (_) {
            setPhone(user.phoneNumber);
          }
        }
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

  const onAddBuddy = async () => {
    if (!user) return;
    const uidToAdd = newBuddy.trim();
    if (!uidToAdd) return;
    await addAccountabilityBuddy(user.uid, uidToAdd);
    setBuddies((b) => (b.includes(uidToAdd) ? b : [...b, uidToAdd]));
    setNewBuddy("");
  };

  const onRemoveBuddy = async (b: string) => {
    if (!user) return;
    await removeAccountabilityBuddy(user.uid, b);
    setBuddies((list) => list.filter((x) => x !== b));
  };

  const onStartPhoneVerification = async () => {
    if (!user) return;
    setVerifyError(null);
    try {
      const w = window as any;
      // Reuse or create Recaptcha
      let appVerifier = w._recaptchaVerifier as RecaptchaVerifier | undefined;
      if (!appVerifier) {
        appVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
        try {
          await appVerifier.render();
        } catch (_) {}
        w._recaptchaVerifier = appVerifier;
      }
      const e164 = buildE164(phone, countryDial);
      const confirmation = await linkWithPhoneNumber(user, e164, appVerifier);
      w._phoneConfirm = confirmation;
      setVerifying(true);
    } catch (err: any) {
      setVerifyError(err?.message || "Verification failed");
    }
  };

  const onConfirmCode = async () => {
    if (!user) return;
    const confirmation = (window as any)._phoneConfirm as
      | { confirm: (code: string) => Promise<any> }
      | undefined;
    if (!confirmation) return;
    await confirmation.confirm(code);
    setVerifying(false);
    setCode("");
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

          {user && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Your UID</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={user.uid}
                  readOnly
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 14,
                    background: "#f8fafc",
                    flex: 1,
                  }}
                />
                <button
                  style={{ ...s.button }}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(user.uid);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    } catch (_) {}
                  }}
                >
                  Copy
                </button>
                {copied && (
                  <span style={{ color: "#16a34a", fontWeight: 600 }}>
                    Copied
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              Accountability buddies
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={newBuddy}
                onChange={(e) => setNewBuddy(e.target.value)}
                placeholder="Enter buddy UID"
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 14,
                  flex: 1,
                }}
              />
              <button style={{ ...s.button }} onClick={onAddBuddy}>
                Add
              </button>
            </div>
            {buddies.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {buddies.map((b) => (
                  <div
                    key={b}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                  >
                    <span style={{ fontFamily: "monospace" }}>{b}</span>
                    <button
                      style={{ ...s.button }}
                      onClick={() => onRemoveBuddy(b)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>Phone number</span>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={countryDial}
                onChange={(e) => setCountryDial(e.target.value)}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 14,
                  background: "#fff",
                }}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.iso} value={c.dial}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 14,
                  flex: 1,
                }}
              />
              {!verifying ? (
                <button
                  style={{ ...s.button }}
                  onClick={onStartPhoneVerification}
                  disabled={!phone}
                >
                  Verify
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Code"
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 14,
                      width: 120,
                    }}
                  />
                  <button
                    style={{ ...s.button }}
                    onClick={onConfirmCode}
                    disabled={!code}
                  >
                    Confirm
                  </button>
                </>
              )}
            </div>
            {verifyError && (
              <div style={{ color: "#b91c1c", fontSize: 13 }}>
                {verifyError}
              </div>
            )}
            <div id="recaptcha-container" />
          </div>

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

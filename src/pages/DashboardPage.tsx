import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase";

type UserDoc = {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  dailyGoal: number;
  reviewsToday: number;
  reviewsTodayDate: string | null;
  streakDays: number;
};

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      setData((snap.data() as UserDoc) || null);
      setLoading(false);
    }
    load();
  }, [user]);

  const remaining = useMemo(() => {
    if (!data) return 0;
    return Math.max(0, (data.dailyGoal || 0) - (data.reviewsToday || 0));
  }, [data]);

  async function updateGoal(newGoal: number) {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, { dailyGoal: newGoal });
    setData((prev) => (prev ? { ...prev, dailyGoal: newGoal } : prev));
  }

  return (
    <div className="stack">
      <h2>Your Dashboard</h2>
      {loading || !data ? (
        <div className="card">Loading…</div>
      ) : (
        <div className="grid">
          <div className="col-6">
            <div
              className="card"
              style={{ display: "flex", gap: 10, alignItems: "center" }}
            >
              {data.photoURL && (
                <img
                  src={data.photoURL}
                  alt="avatar"
                  width={40}
                  height={40}
                  style={{ borderRadius: 8 }}
                />
              )}
              <div>
                <div style={{ fontWeight: 700 }}>
                  {data.displayName || "Anonymous"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {data.email}
                </div>
              </div>
            </div>
          </div>
          <div className="col-6">
            <div
              className="card"
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Daily goal</div>
                <div style={{ fontWeight: 700 }}>{data.dailyGoal} reviews</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="button"
                  onClick={() =>
                    updateGoal(Math.max(5, (data.dailyGoal || 0) - 5))
                  }
                >
                  -5
                </button>
                <button
                  className="button"
                  onClick={() => updateGoal((data.dailyGoal || 0) + 5)}
                >
                  +5
                </button>
              </div>
            </div>
          </div>
          <div className="col-6">
            <div
              className="card"
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Today</div>
                <div style={{ fontWeight: 700 }}>{data.reviewsToday} done</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Remaining</div>
                <div style={{ fontWeight: 700 }}>{remaining}</div>
              </div>
            </div>
          </div>
          <div className="col-6">
            <div
              className="card"
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Streak</div>
                <div style={{ fontWeight: 700 }}>{data.streakDays} days</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

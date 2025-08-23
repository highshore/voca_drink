import { useEffect, useMemo, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
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
  const [reports, setReports] = useState<any[]>([]);

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

  useEffect(() => {
    async function loadReports() {
      try {
        const qref = query(
          collection(db, "reports"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(qref);
        const arr: any[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setReports(arr);
      } catch (_) {}
    }
    loadReports();
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
          <div className="col-12">
            <div className="card">
              <div style={{ fontWeight: 700 }}>Recent Reports</div>
              {reports.length === 0 ? (
                <div style={{ paddingTop: 8, color: "#64748b" }}>
                  No reports
                </div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  {reports.slice(0, 20).map((r) => (
                    <div
                      key={r.id}
                      style={{ padding: 8, borderTop: "1px solid #f1f5f9" }}
                    >
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {r.createdAt?.toDate?.().toLocaleString?.() || ""}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "baseline",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{r.deck}</div>
                        <div style={{ color: "#0f172a" }}>{r.vocabId}</div>
                      </div>
                      {r.reason && (
                        <div style={{ fontSize: 12, color: "#334155" }}>
                          {r.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { db } from "../../firebase-config";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { useAuth } from "../../AuthContext";
import { useRouter } from "next/navigation";

type PageView = {
  id: string;
  email: string;
  page: string;
  timestamp: { seconds: number } | null;
  userId: string;
};

type UserSummary = {
  email: string;
  visits: number;
  lastSeen: string;
  lastSeenSeconds: number;
  pages: Record<string, number>;
};

const ADMIN_EMAIL = "andrewbrantner@gmail.com";

export default function PageViewsAdmin() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pageViews, setPageViews] = useState<PageView[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"users" | "pages" | "recent">("users");

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;

    async function fetchData() {
      try {
        const q = query(
          collection(db, "pageViews"),
          orderBy("timestamp", "desc"),
          limit(500)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PageView[];
        setPageViews(data);
      } catch {
        setError("Failed to load page views. Check Firestore rules.");
      } finally {
        setFetching(false);
      }
    }

    fetchData();
  }, [user]);

  const userSummary: Record<string, UserSummary> = {};
  pageViews.forEach((pv) => {
    if (!userSummary[pv.email]) {
      userSummary[pv.email] = { email: pv.email, visits: 0, lastSeen: "", lastSeenSeconds: 0, pages: {} };
    }
    userSummary[pv.email].visits++;
    userSummary[pv.email].pages[pv.page] = (userSummary[pv.email].pages[pv.page] || 0) + 1;
    if (pv.timestamp) {
  const ts = new Date(pv.timestamp.seconds * 1000).toLocaleString();
  if (!userSummary[pv.email].lastSeen || pv.timestamp.seconds > (userSummary[pv.email].lastSeenSeconds ?? 0)) {
    userSummary[pv.email].lastSeen = ts;
    userSummary[pv.email].lastSeenSeconds = pv.timestamp.seconds;
  }
}
  });
  const userList = Object.values(userSummary).sort((a, b) => b.visits - a.visits);

  const pageSummary: Record<string, number> = {};
  pageViews.forEach((pv) => {
    pageSummary[pv.page] = (pageSummary[pv.page] || 0) + 1;
  });
  const pageList = Object.entries(pageSummary).sort((a, b) => b[1] - a[1]);

  const formatDate = (seconds: number) => new Date(seconds * 1000).toLocaleString();

  if (loading || fetching) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f5f4f2" }}>
        <p style={{ color: "#57534e", fontSize: "0.95rem" }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f5f4f2" }}>
        <p style={{ color: "#dc2626", fontSize: "0.95rem" }}>{error}</p>
      </div>
    );
  }

  const tabs = ["users", "pages", "recent"] as const;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f4f2", padding: "2.5rem 1rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
          borderRadius: 12, padding: "1.75rem 2rem",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.08)",
          marginBottom: "1.5rem",
        }}>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ffffff", margin: "0 0 0.35rem", letterSpacing: "-0.02em" }}>
            Page Views Dashboard
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "0.88rem", margin: "0 0 1.25rem" }}>
            {pageViews.length} total views · {userList.length} unique users
          </p>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "0.45rem 1.1rem",
                  borderRadius: 6,
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  textTransform: "capitalize",
                  cursor: "pointer",
                  border: "none",
                  backgroundColor: tab === t ? "#facc15" : "rgba(255,255,255,0.1)",
                  color: tab === t ? "#0a1a2f" : "#94a3b8",
                  transition: "all 0.15s",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Users Tab */}
        {tab === "users" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {userList.map((u) => (
              <div key={u.email} style={{
                backgroundColor: "#ffffff",
                borderRadius: 10,
                padding: "1.25rem 1.5rem",
                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                border: "1px solid #e2e0de",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div>
                    <p style={{ fontWeight: 700, color: "#0a1a2f", margin: "0 0 0.2rem", fontSize: "0.95rem" }}>{u.email}</p>
                    <p style={{ fontSize: "0.78rem", color: "#78716c", margin: 0 }}>Last seen: {u.lastSeen}</p>
                  </div>
                  <span style={{
                    backgroundColor: "#0a1a2f", color: "#facc15",
                    fontSize: "0.78rem", fontWeight: 700,
                    padding: "0.25rem 0.75rem", borderRadius: 999,
                    whiteSpace: "nowrap",
                  }}>
                    {u.visits} visits
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {Object.entries(u.pages)
                    .sort((a, b) => b[1] - a[1])
                    .map(([page, count]) => (
                      <span key={page} style={{
                        backgroundColor: "#f5f4f2", color: "#57534e",
                        fontSize: "0.72rem", fontWeight: 600,
                        padding: "0.2rem 0.6rem", borderRadius: 5,
                        border: "1px solid #e2e0de",
                        fontFamily: "monospace",
                      }}>
                        {page} ({count})
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pages Tab */}
        {tab === "pages" && (
          <div style={{
            backgroundColor: "#ffffff", borderRadius: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
            border: "1px solid #e2e0de", overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)" }}>
                  <th style={{ textAlign: "left", padding: "0.85rem 1.5rem", fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" }}>Page</th>
                  <th style={{ textAlign: "right", padding: "0.85rem 1.5rem", fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" }}>Views</th>
                </tr>
              </thead>
              <tbody>
                {pageList.map(([page, count], i) => (
                  <tr key={page} style={{ borderTop: "1px solid #e2e0de", backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafaf9" }}>
                    <td style={{ padding: "0.85rem 1.5rem", color: "#0a1a2f", fontFamily: "monospace", fontSize: "0.85rem" }}>{page}</td>
                    <td style={{ padding: "0.85rem 1.5rem", textAlign: "right", fontWeight: 700, color: "#facc15", fontSize: "0.9rem",
                      textShadow: "0 0 0 #0a1a2f",
                      WebkitTextStroke: "0.5px #0a1a2f",
                    }}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent Tab */}
        {tab === "recent" && (
          <div style={{
            backgroundColor: "#ffffff", borderRadius: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
            border: "1px solid #e2e0de", overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)" }}>
                  <th style={{ textAlign: "left", padding: "0.85rem 1.5rem", fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" }}>Time</th>
                  <th style={{ textAlign: "left", padding: "0.85rem 1.5rem", fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" }}>Email</th>
                  <th style={{ textAlign: "left", padding: "0.85rem 1.5rem", fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" }}>Page</th>
                </tr>
              </thead>
              <tbody>
                {pageViews.slice(0, 100).map((pv, i) => (
                  <tr key={pv.id} style={{ borderTop: "1px solid #e2e0de", backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafaf9" }}>
                    <td style={{ padding: "0.75rem 1.5rem", color: "#78716c", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                      {pv.timestamp ? formatDate(pv.timestamp.seconds) : "Unknown"}
                    </td>
                    <td style={{ padding: "0.75rem 1.5rem", color: "#0a1a2f", fontSize: "0.82rem" }}>{pv.email}</td>
                    <td style={{ padding: "0.75rem 1.5rem", color: "#57534e", fontFamily: "monospace", fontSize: "0.82rem" }}>{pv.page}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}

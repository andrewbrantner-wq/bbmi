"use client";

/**
 * AUTH DIAGNOSTICS — drop this into your app temporarily to track
 * exactly what's happening with Firebase auth state.
 *
 * Usage:
 *   1. Import and render <AuthDiagnostics /> inside your AuthProvider
 *      (e.g., in your root layout, right after <AuthProvider>)
 *   2. Open the browser console and reproduce the issue
 *   3. Look for the [AUTH-DIAG] entries to see exactly what's happening
 *   4. Remove this component once the issue is diagnosed
 *
 * It also writes events to Firestore (collection: auth_diagnostics)
 * so you can review them remotely without needing console access.
 */

import { useEffect, useRef } from "react";
import { onAuthStateChanged, onIdTokenChanged } from "firebase/auth";
import { auth, db } from "./firebase-config";
import { collection, addDoc } from "firebase/firestore";
import { usePathname } from "next/navigation";

// Set to true to also write events to Firestore for remote review
const WRITE_TO_FIRESTORE = true;

function logEvent(event: Record<string, unknown>) {
  const entry = {
    ...event,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "ssr",
  };
  console.log("[AUTH-DIAG]", JSON.stringify(entry, null, 2));

  if (WRITE_TO_FIRESTORE) {
    addDoc(collection(db, "auth_diagnostics"), entry).catch(() => {
      // Silently fail — diagnostics should never break the app
    });
  }
}

export default function AuthDiagnostics() {
  const pathname = usePathname();
  const mountCount = useRef(0);
  const authStateCount = useRef(0);
  const tokenChangeCount = useRef(0);
  const lastUser = useRef<string | null>(null);

  // Track component mounts — if this fires more than once,
  // the AuthProvider is being re-mounted (likely a layout issue)
  useEffect(() => {
    mountCount.current += 1;
    logEvent({
      type: "PROVIDER_MOUNT",
      mountNumber: mountCount.current,
      note:
        mountCount.current > 1
          ? "⚠️ AuthProvider re-mounted! This will reset auth state."
          : "Initial mount — normal",
    });

    return () => {
      logEvent({
        type: "PROVIDER_UNMOUNT",
        mountNumber: mountCount.current,
        note: "⚠️ AuthProvider unmounting — will lose auth state",
      });
    };
  }, []);

  // Track route changes — does navigating trigger auth loss?
  useEffect(() => {
    logEvent({
      type: "ROUTE_CHANGE",
      pathname,
      currentUser: auth.currentUser?.uid ?? "null",
    });
  }, [pathname]);

  // Track onAuthStateChanged — the main auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      authStateCount.current += 1;
      const uid = user?.uid ?? "null";
      const wasNull = lastUser.current === null || lastUser.current === "null";
      const isNull = uid === "null";

      let note = "Normal state update";
      if (wasNull && !isNull) {
        note = "✅ Session restored / user logged in";
      } else if (!wasNull && isNull) {
        note = "🚨 USER LOST — was authenticated, now null. This is the logout bug.";
      } else if (wasNull && isNull) {
        note = "Still no user (initial load or confirmed logout)";
      }

      logEvent({
        type: "AUTH_STATE_CHANGED",
        callNumber: authStateCount.current,
        uid,
        previousUid: lastUser.current,
        email: user?.email ?? "null",
        note,
      });

      lastUser.current = uid;
    });

    return () => unsub();
  }, []);

  // Track token changes — these fire on token refresh (~60 min)
  // and are a common source of spurious null events
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (user) => {
      tokenChangeCount.current += 1;
      logEvent({
        type: "TOKEN_CHANGED",
        callNumber: tokenChangeCount.current,
        uid: user?.uid ?? "null",
        email: user?.email ?? "null",
        note:
          user === null
            ? "⚠️ Token refresh returned null — may cause redirect"
            : "Token refreshed normally",
      });
    });

    return () => unsub();
  }, []);

  // Track visibility changes — does backgrounding the tab cause issues?
  useEffect(() => {
    function handleVisibility() {
      logEvent({
        type: "VISIBILITY_CHANGE",
        state: document.visibilityState,
        currentUser: auth.currentUser?.uid ?? "null",
        note:
          document.visibilityState === "visible" && !auth.currentUser
            ? "⚠️ Tab became visible but no user — may trigger re-auth"
            : "Normal visibility change",
      });
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Invisible component — only logs
  return null;
}

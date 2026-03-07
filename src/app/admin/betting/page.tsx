"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/app/firebase-config";
import BBMIBettingTool from "@/components/BBMIBettingTool";

const ALLOWED_UID = "QoBPCNoZfjWEAglQdwcGCCHyHm12";

export default function BettingAdminPage() {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user?.uid === ALLOWED_UID) setStatus("allowed");
      else setStatus("denied");
    });
  }, []);

  if (status === "loading") return <div style={{ background: "#060e1a", minHeight: "100vh" }} />;
  if (status === "denied")  return <div style={{ background: "#060e1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontFamily: "monospace" }}>Access denied.</div>;
  return <BBMIBettingTool />;
}
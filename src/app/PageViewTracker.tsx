"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";
import logPageView from "./logPageview";

export default function PageViewTracker() {
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (user) {
      logPageView(user, pathname);
    }
  }, [user, pathname]);

  return null; // renders nothing
}
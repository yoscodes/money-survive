"use client";

import { useEffect } from "react";

export function PwaBootstrap() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration();
        if (existing) return;
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // PWA 未対応や登録失敗はアプリ自体を止めない。
      }
    };

    void register();
  }, []);

  return null;
}

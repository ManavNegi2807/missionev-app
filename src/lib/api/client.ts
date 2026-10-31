"use client";

import { useEffect, useState } from "react";
import type { IntegrationStatus } from "@/server/config";

/** Typed fetch helpers for the app's own /api routes. Responses are data: nothing from them is executed or trusted blindly. */
export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

let cached: IntegrationStatus | null = null;
let inflight: Promise<IntegrationStatus | null> | null = null;

export function loadStatus(force = false): Promise<IntegrationStatus | null> {
  if (cached && !force) return Promise.resolve(cached);
  inflight ??= fetch("/api/status", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<IntegrationStatus>) : null))
    .then((s) => (cached = s))
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** What the server has configured: LIVE needs the contract, an RPC and the oracle key; otherwise the app is DEMO. */
export function useIntegrationStatus(): { status: IntegrationStatus | null; loading: boolean; refresh: () => void } {
  const [status, setStatus] = useState<IntegrationStatus | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  useEffect(() => {
    let live = true;
    void loadStatus().then((s) => {
      if (live) {
        setStatus(s);
        setLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, []);
  return {
    status,
    loading,
    refresh: () => {
      setLoading(true);
      void loadStatus(true).then((s) => {
        setStatus(s);
        setLoading(false);
      });
    },
  };
}

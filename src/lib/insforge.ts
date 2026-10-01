"use client";

import { createClient } from "@insforge/sdk";

export const INSFORGE_BASE_URL =
  process.env.NEXT_PUBLIC_INSFORGE_URL || "https://gcj3agx8.us-west.insforge.app";

export const INSFORGE_ANON_KEY =
  process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ||
  "anon_fe9d1abcef3173c9e111eebe321163961260701c2425c7b6ffa509e80de3c86f";

export const insforge = createClient({
  baseUrl: INSFORGE_BASE_URL,
  anonKey: INSFORGE_ANON_KEY,
});

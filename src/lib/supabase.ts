"use client";

import { insforge } from "./insforge";

export const supabase = {
  auth: {
    signInWithPassword: async ({ email, password }: { email?: string; password?: string }) => {
      if (!email || !password) {
        return { data: { user: null, session: null }, error: new Error("Email and password are required.") };
      }
      const res = await insforge.auth.signInWithPassword({ email, password });
      if (res.error) {
        return { data: { user: null, session: null }, error: new Error(res.error.message || "Invalid login credentials.") };
      }
      const token = res.data?.accessToken;
      if (typeof window !== "undefined" && token) {
        localStorage.setItem("eaws_insforge_token", token);
      }
      return {
        data: {
          user: res.data?.user || null,
          session: token ? { access_token: token, user: res.data?.user } : null,
        },
        error: null,
      };
    },
    signOut: async () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("eaws_insforge_token");
        localStorage.removeItem("eaws_mock_token");
      }
      const res = await insforge.auth.signOut();
      return { error: res.error ? new Error(res.error.message) : null };
    },
    getSession: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("eaws_insforge_token") : null;
      return {
        data: {
          session: token ? { access_token: token } : null,
        },
        error: null,
      };
    },
    getUser: async () => {
      const res = await insforge.auth.getCurrentUser();
      return { data: { user: res.data?.user || null }, error: res.error ? new Error(res.error.message) : null };
    },
    channel: (_name: string) => {
      const ch: any = {
        on: (_event: any, _config: any, _callback?: () => void) => ch,
        subscribe: () => ({ unsubscribe: () => {} }),
      };
      return ch;
    },
  },
  from: (table: string) => insforge.database.from(table),
  channel: (_name: string) => {
    const ch: any = {
      on: (_event: any, _config: any, _callback?: () => void) => ch,
      subscribe: () => ({ unsubscribe: () => {} }),
    };
    return ch;
  },
  removeChannel: (_channel: any) => {},
};

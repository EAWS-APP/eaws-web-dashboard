"use client";

import { insforge, INSFORGE_ANON_KEY } from "./insforge";

// Proxy for legacy Supabase client to InsForge BaaS
export const supabase = {
  auth: {
    signInWithPassword: async ({ email, password }: any) => {
      const res = await insforge.auth.signInWithPassword({ email, password });
      if (res.error) return { error: res.error, data: null };
      return { 
        data: { 
          user: res.data?.user, 
          session: { access_token: res.data?.accessToken } 
        }, 
        error: null 
      };
    },
    getSession: async () => {
      return { data: { session: { access_token: "insforge-managed-token" } }, error: null };
    },
    signOut: async () => {
      await insforge.auth.signOut();
      return { error: null };
    }
  },
  channel: (name: string) => {
    const chain: any = {
      on: (event: string, filter: any, callback: () => void) => {
        if (typeof window !== "undefined") {
          setInterval(callback, 10000);
        }
        return chain;
      },
      subscribe: () => {
        return chain;
      }
    };
    return chain;
  },
  removeChannel: (channel: any) => {
    // no-op
  },
  from: (table: string) => {
    let method = "GET";
    let isSingle = false;
    let bodyData: any = null;
    let queryParams: string[] = [];

    const execute = async () => {
      let url = `https://gcj3agx8.us-west.insforge.app/api/database/records/${table}`;
      if (queryParams.length > 0) {
        url += `?${queryParams.join("&")}`;
      }
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${INSFORGE_ANON_KEY}` 
        },
        body: bodyData ? JSON.stringify(Array.isArray(bodyData) ? bodyData : [bodyData]) : undefined
      });
      const data = await res.json();
      const finalData = isSingle ? (data?.[0] || null) : data;
      return { data: finalData, error: null };
    };

    const chain: any = {
      select: (fields: string) => { return chain; },
      eq: (col: string, val: any) => { queryParams.push(`${col}=eq.${val}`); return chain; },
      order: (col: string, opts: any) => { queryParams.push(`order=${col}.${opts?.ascending ? 'asc' : 'desc'}`); return chain; },
      single: () => { isSingle = true; queryParams.push("limit=1"); return chain; },
      insert: (data: any) => { method = "POST"; bodyData = data; return chain; },
      upsert: (data: any) => { method = "PATCH"; bodyData = data; return chain; }, // simple mock
      then: (resolve: any, reject: any) => {
        execute().then(resolve).catch(reject);
      }
    };
    return chain;
  }
};

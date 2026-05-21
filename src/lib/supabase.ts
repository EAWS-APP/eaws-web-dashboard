"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://sswwdizgwctfwirhmroj.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzd3dkaXpnd2N0Zndpcmhtcm9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDg1MjcsImV4cCI6MjA5MjUyNDUyN30.QS9S21U3d2fX2OTvO79dPKxFryyolw3HonOaMecd-50";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Radio, Shield, ShieldAlert, UserCog } from "lucide-react";
import { supabase } from "@/lib/supabase";

const PORTALS = [
  {
    id: "dispatcher",
    name: "Dispatcher",
    icon: Radio,
    idLabel: "Operator ID / Email",
    idPlaceholder: "DISP-4920",
    buttonColor: "bg-red-600 hover:bg-red-700",
    ringColor: "focus:ring-red-500",
    textColor: "text-red-500 hover:text-red-400",
    account: { identifier: "DISP-4920", email: "dispatcher@eaws.gov.gh", password: "Dispatch@2026" },
    dashboardPath: "/dashboard",
  },
  {
    id: "police",
    name: "Police",
    icon: Shield,
    idLabel: "Badge Number / Email",
    idPlaceholder: "POL-0021",
    buttonColor: "bg-blue-600 hover:bg-blue-700",
    ringColor: "focus:ring-blue-500",
    textColor: "text-blue-500 hover:text-blue-400",
    account: { identifier: "POL-0021", email: "police@eaws.gov.gh", password: "Police@2026" },
    dashboardPath: "/police",
  },
  {
    id: "fire",
    name: "Fire",
    icon: Flame,
    idLabel: "Unit ID / Email",
    idPlaceholder: "FIRE-119",
    buttonColor: "bg-orange-600 hover:bg-orange-700",
    ringColor: "focus:ring-orange-500",
    textColor: "text-orange-500 hover:text-orange-400",
    account: { identifier: "FIRE-119", email: "fire@eaws.gov.gh", password: "Fire@2026" },
    dashboardPath: "/fire",
  },
  {
    id: "admin",
    name: "Admin",
    icon: UserCog,
    idLabel: "Admin Username",
    idPlaceholder: "admin@eaws.gov.gh",
    buttonColor: "bg-purple-600 hover:bg-purple-700",
    ringColor: "focus:ring-purple-500",
    textColor: "text-purple-500 hover:text-purple-400",
    account: { identifier: "admin@eaws.gov.gh", email: "admin@eaws.gov.gh", password: "Admin@2026" },
    dashboardPath: "/admin",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [activePortal, setActivePortal] = useState(PORTALS[0]);
  const [credentials, setCredentials] = useState({
    identifier: PORTALS[0].account.identifier,
    password: PORTALS[0].account.password,
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function selectPortal(portal: (typeof PORTALS)[number]) {
    setActivePortal(portal);
    setCredentials({
      identifier: portal.account.identifier,
      password: portal.account.password,
    });
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const expected = activePortal.account;

    if (credentials.identifier.trim().toLowerCase() !== expected.identifier.toLowerCase()) {
      setError(`Use the created ${activePortal.name.toLowerCase()} account ID shown below.`);
      setIsSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: expected.email,
      password: credentials.password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push(activePortal.dashboardPath);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col md:flex-row font-sans">
      <div className="relative w-full md:w-1/2 bg-neutral-900 flex flex-col justify-between p-8 lg:p-16 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-red-600/10 blur-[100px]" />
          <div className="absolute bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 text-red-500 mb-12">
            <ShieldAlert size={36} />
            <span className="text-2xl font-bold tracking-wider text-white">
              EAWS <span className="font-light text-neutral-400">Control</span>
            </span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
            National Digital Emergency Response Platform
          </h1>
          <p className="text-neutral-400 text-lg max-w-md leading-relaxed">
            Centralized coordination layer integrating citizens, dispatchers, and national
            agencies into a single, data-driven ecosystem.
          </p>
        </div>

        <div className="relative z-10 mt-12 md:mt-0">
          <div className="flex items-center gap-4 text-sm text-neutral-500">
            <span>Secure connection</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>System operational</span>
          </div>
        </div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-neutral-950">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold text-white mb-2">{activePortal.name} Portal</h2>
            <p className="text-neutral-400">
              Enter your credentials to access the {activePortal.name.toLowerCase()} dashboard.
            </p>
          </div>

          <div className="flex p-1 bg-neutral-900 rounded-lg mt-6">
            {PORTALS.map((portal) => (
              <button
                key={portal.id}
                type="button"
                onClick={() => selectPortal(portal)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                  activePortal.id === portal.id
                    ? "bg-neutral-800 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
                }`}
              >
                <portal.icon size={16} />
                <span className="hidden sm:inline">{portal.name}</span>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm">
            <p className="font-medium text-neutral-200">{activePortal.name} account created</p>
            <div className="mt-3 grid gap-2 text-neutral-400">
              <p className="flex items-center justify-between gap-3">
                <span>ID</span>
                <span className="font-mono text-neutral-100">{activePortal.account.identifier}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span>Auth email</span>
                <span className="font-mono text-neutral-100">{activePortal.account.email}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span>Passcode</span>
                <span className="font-mono text-neutral-100">{activePortal.account.password}</span>
              </p>
            </div>
          </div>

          <form className="space-y-6 mt-8" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300" htmlFor="operator-id">
                {activePortal.idLabel}
              </label>
              <input
                id="operator-id"
                type="text"
                className={`w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 ${activePortal.ringColor} focus:border-transparent transition-all text-white placeholder-neutral-600`}
                placeholder={activePortal.idPlaceholder}
                value={credentials.identifier}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, identifier: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-300" htmlFor="password">
                  Security Passcode
                </label>
                <a href="#" className={`text-xs ${activePortal.textColor} transition-colors`}>
                  Emergency Reset?
                </a>
              </div>
              <input
                id="password"
                type="password"
                className={`w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 ${activePortal.ringColor} focus:border-transparent transition-all text-white placeholder-neutral-600`}
                placeholder="Security passcode"
                value={credentials.password}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, password: event.target.value }))
                }
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full group flex items-center justify-center gap-2 ${activePortal.buttonColor} text-white font-semibold py-3.5 px-4 rounded-lg transition-all active:scale-[0.98]`}
            >
              <span>{isSubmitting ? "Authorizing..." : "Authorize & Connect"}</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="pt-8 border-t border-neutral-800 text-center text-xs text-neutral-500">
            <p>Protected by the Data Protection Act 2012 (Ghana)</p>
            <p className="mt-1">Unauthorized access is strictly prohibited.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

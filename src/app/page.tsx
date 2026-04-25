import Image from "next/image";
import Link from "next/link";
import { ShieldAlert, ArrowRight } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col md:flex-row font-sans">
      {/* Left side - Branding & Info */}
      <div className="relative w-full md:w-1/2 bg-neutral-900 flex flex-col justify-between p-8 lg:p-16 overflow-hidden">
        {/* Abstract background gradient */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-red-600/10 blur-[100px]" />
          <div className="absolute bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 text-red-500 mb-12">
            <ShieldAlert size={36} />
            <span className="text-2xl font-bold tracking-wider text-white">EAWS <span className="font-light text-neutral-400">Control</span></span>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
            National Digital Emergency Response Platform
          </h1>
          <p className="text-neutral-400 text-lg max-w-md leading-relaxed">
            Centralized coordination layer integrating citizens, dispatchers, and national agencies into a single, data-driven ecosystem.
          </p>
        </div>

        <div className="relative z-10 mt-12 md:mt-0">
          <div className="flex items-center gap-4 text-sm text-neutral-500">
            <span>Secure connection</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <span>System operational</span>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-neutral-950">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold text-white mb-2">Dispatcher Portal</h2>
            <p className="text-neutral-400">Enter your credentials to access the control room.</p>
          </div>

          <form className="space-y-6 mt-8">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300" htmlFor="operator-id">
                Operator ID / Email
              </label>
              <input 
                id="operator-id"
                type="text" 
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-white placeholder-neutral-600"
                placeholder="DISP-4920"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-300" htmlFor="password">
                  Security Passcode
                </label>
                <a href="#" className="text-xs text-red-500 hover:text-red-400 transition-colors">Emergency Reset?</a>
              </div>
              <input 
                id="password"
                type="password" 
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-white placeholder-neutral-600"
                placeholder="••••••••"
              />
            </div>

            <Link href="/dashboard" className="block w-full">
              <button 
                type="button"
                className="w-full group flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 px-4 rounded-lg transition-all active:scale-[0.98]"
              >
                <span>Authorize & Connect</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
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

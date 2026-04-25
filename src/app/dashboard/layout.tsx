import Link from "next/link";
import { ShieldAlert, Map as MapIcon, Users, Activity, Settings, LogOut, Bell } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-800 bg-neutral-900 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-neutral-800">
            <ShieldAlert className="text-red-500 mr-3" size={24} />
            <span className="font-bold tracking-wide">EAWS CONTROL</span>
          </div>
          
          <nav className="p-4 space-y-1">
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 bg-red-600/10 text-red-500 rounded-md font-medium">
              <MapIcon size={18} />
              Live Map
            </Link>
            <Link href="#" className="flex items-center gap-3 px-3 py-2.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-md font-medium transition-colors">
              <Activity size={18} />
              Active Incidents
            </Link>
            <Link href="#" className="flex items-center gap-3 px-3 py-2.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-md font-medium transition-colors">
              <Users size={18} />
              Agencies
            </Link>
            <Link href="#" className="flex items-center gap-3 px-3 py-2.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-md font-medium transition-colors">
              <Settings size={18} />
              Settings
            </Link>
          </nav>
        </div>
        
        <div className="p-4 border-t border-neutral-800">
          <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-neutral-950 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-bold border border-neutral-700">
              D1
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">Dispatcher 1</p>
              <p className="text-xs text-neutral-500 truncate">Online</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-3 px-3 py-2 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-md text-sm font-medium transition-colors">
            <LogOut size={16} />
            Secure Logout
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 z-10 relative">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Live Incident Map</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium border border-green-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Live Data
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-neutral-400 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500"></span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </main>
    </div>
  );
}

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  Flame,
  MapPin,
  Radio,
  Shield,
  UserCog,
  Users,
} from "lucide-react";

type Tone = "blue" | "orange" | "purple";

type Stat = {
  label: string;
  value: string;
  detail: string;
};

type QueueItem = {
  title: string;
  location: string;
  priority: string;
  time: string;
};

type PortalDashboardProps = {
  tone: Tone;
  portal: string;
  subtitle: string;
  operator: string;
  badge: string;
  stats: Stat[];
  queueTitle: string;
  queue: QueueItem[];
  actions: string[];
};

const toneStyles = {
  blue: {
    accent: "text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    button: "bg-blue-600 hover:bg-blue-700",
    icon: Shield,
  },
  orange: {
    accent: "text-orange-400",
    border: "border-orange-500/30",
    bg: "bg-orange-500/10",
    button: "bg-orange-600 hover:bg-orange-700",
    icon: Flame,
  },
  purple: {
    accent: "text-purple-400",
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    button: "bg-purple-600 hover:bg-purple-700",
    icon: UserCog,
  },
};

export default function PortalDashboard({
  tone,
  portal,
  subtitle,
  operator,
  badge,
  stats,
  queueTitle,
  queue,
  actions,
}: PortalDashboardProps) {
  const styles = toneStyles[tone];
  const PortalIcon = styles.icon;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      <header className="border-b border-neutral-800 bg-neutral-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg border ${styles.border} ${styles.bg}`}>
              <PortalIcon className={styles.accent} size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">EAWS Control</p>
              <h1 className="text-xl font-bold text-white">{portal} Dashboard</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-neutral-400 transition-colors hover:text-white">
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white"
            >
              <ArrowLeft size={16} />
              Logout
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6">
        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles.border} ${styles.bg} ${styles.accent}`}>
                  {badge}
                </p>
                <h2 className="text-2xl font-bold text-white">{subtitle}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                  Monitor assigned incidents, coordinate field resources, and report response readiness
                  back to the national dispatch room.
                </p>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
                <p className="text-xs text-neutral-500">Signed in as</p>
                <p className="mt-1 font-semibold text-white">{operator}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <div className="flex items-center gap-3">
              <Radio className={styles.accent} size={22} />
              <div>
                <p className="text-sm font-semibold text-white">Agency Link</p>
                <p className="text-sm text-neutral-400">Connected to dispatch relay</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-neutral-950 p-3">
                <p className="text-neutral-500">Signal</p>
                <p className="mt-1 font-semibold text-green-400">Stable</p>
              </div>
              <div className="rounded-lg bg-neutral-950 p-3">
                <p className="text-neutral-500">Mode</p>
                <p className="mt-1 font-semibold text-white">Live</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
              <p className="text-sm text-neutral-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
              <p className="mt-2 text-sm text-neutral-400">{stat.detail}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div>
                <h2 className="font-semibold text-white">{queueTitle}</h2>
                <p className="text-sm text-neutral-500">Newest assignments from dispatch</p>
              </div>
              <Activity className={styles.accent} size={20} />
            </div>
            <div className="divide-y divide-neutral-800">
              {queue.map((item) => (
                <div key={`${item.title}-${item.time}`} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">{item.title}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${styles.border} ${styles.bg} ${styles.accent}`}>
                        {item.priority}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-sm text-neutral-400">
                      <MapPin size={15} />
                      {item.location}
                    </p>
                  </div>
                  <p className="flex items-center gap-2 text-sm text-neutral-500">
                    <Clock size={15} />
                    {item.time}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
              <h2 className="font-semibold text-white">Quick Actions</h2>
              <div className="mt-4 grid gap-3">
                {actions.map((action) => (
                  <button
                    key={action}
                    className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors ${styles.button}`}
                  >
                    <CheckCircle2 size={17} />
                    {action}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
              <h2 className="font-semibold text-white">Readiness Snapshot</h2>
              <div className="mt-4 grid gap-3 text-sm">
                <p className="flex items-center justify-between rounded-lg bg-neutral-950 p-3">
                  <span className="flex items-center gap-2 text-neutral-400">
                    <Users size={16} />
                    Active teams
                  </span>
                  <span className="font-semibold text-white">12</span>
                </p>
                <p className="flex items-center justify-between rounded-lg bg-neutral-950 p-3">
                  <span className="flex items-center gap-2 text-neutral-400">
                    <Building2 size={16} />
                    Stations linked
                  </span>
                  <span className="font-semibold text-white">5</span>
                </p>
                <p className="flex items-center justify-between rounded-lg bg-neutral-950 p-3">
                  <span className="flex items-center gap-2 text-neutral-400">
                    <AlertTriangle size={16} />
                    Escalations
                  </span>
                  <span className="font-semibold text-yellow-400">2</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

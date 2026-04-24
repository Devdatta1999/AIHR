import { Outlet, Link, useLocation } from "react-router";
import {
  Home,
  FileText,
  ClipboardCheck,
  ClipboardList,
  CalendarDays,
  Video,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

type NavLeaf = {
  kind: "leaf";
  name: string;
  icon: React.ComponentType<any>;
  path: string;
};

type NavGroup = {
  kind: "group";
  name: string;
  icon: React.ComponentType<any>;
  basePath: string;
  children: { name: string; icon: React.ComponentType<any>; path: string }[];
};

const nav: (NavLeaf | NavGroup)[] = [
  { kind: "leaf", name: "Home", icon: Home, path: "/employee" },
  { kind: "leaf", name: "Offer Letter", icon: FileText, path: "/employee/offer" },
  {
    kind: "leaf",
    name: "Onboarding",
    icon: ClipboardCheck,
    path: "/employee/onboarding",
  },
  {
    kind: "group",
    name: "Interview",
    icon: Video,
    basePath: "/employee/interviews",
    children: [
      {
        name: "Upcoming Interviews",
        icon: CalendarDays,
        path: "/employee/interviews/upcoming",
      },
      {
        name: "Interview Kits",
        icon: ClipboardList,
        path: "/employee/interviews/kits",
      },
    ],
  },
];

export function EmployeeLayout() {
  const loc = useLocation();
  const { identity, logout } = useAuth();

  const isActive = (path: string) =>
    path === "/employee"
      ? loc.pathname === "/employee"
      : loc.pathname.startsWith(path);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <aside className="w-64 bg-white/80 backdrop-blur border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Employee Portal</h1>
              <p className="text-xs text-gray-500">Nimbus Labs</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            if (item.kind === "leaf") {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            }
            const GroupIcon = item.icon;
            const groupActive = loc.pathname.startsWith(item.basePath);
            return (
              <div key={item.basePath} className="pt-1">
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                    groupActive ? "text-indigo-700" : "text-gray-600"
                  }`}
                >
                  <GroupIcon className="w-5 h-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {item.name}
                  </span>
                </div>
                <div className="ml-3 pl-3 border-l border-gray-200 space-y-1">
                  {item.children.map((c) => {
                    const active = isActive(c.path);
                    const CIcon = c.icon;
                    return (
                      <Link
                        key={c.path}
                        to={c.path}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                          active
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <CIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">{c.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {(identity?.name || identity?.email || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {identity?.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{identity?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}

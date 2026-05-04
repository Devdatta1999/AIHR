import { Outlet, Link, useLocation } from "react-router";
import {
  UserPlus,
  Briefcase,
  BarChart3,
  Users,
  DollarSign,
  Sparkles,
  Home,
  LogOut,
  MessageCircleQuestion,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const navigation = [
  { name: "Dashboard", icon: Home, path: "/" },
  { name: "Onboarding", icon: UserPlus, path: "/onboarding" },
  { name: "Hiring", icon: Briefcase, path: "/hiring" },
  { name: "Interview Kit", icon: ClipboardList, path: "/interview-kit" },
  { name: "HR Analytics", icon: BarChart3, path: "/analytics" },
  { name: "Team Formation", icon: Users, path: "/team-formation" },
  { name: "Compensation", icon: DollarSign, path: "/compensation" },
  { name: "HR Queries", icon: MessageCircleQuestion, path: "/hr-queries" },
];

export function MainLayout() {
  const location = useLocation();
  const { identity, logout } = useAuth();
  const displayName = identity?.name || identity?.email || "HR Admin";
  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">ECH-AR</h1>
              <p className="text-xs text-gray-500">AI-Powered Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-900">
                AI Upgrade
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Unlock advanced AI insights and automation
            </p>
            <button className="w-full bg-blue-600 text-white text-xs font-medium py-2 rounded-md hover:bg-blue-700 transition-colors">
              Upgrade Plan
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">HR Admin</p>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                {initials}
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
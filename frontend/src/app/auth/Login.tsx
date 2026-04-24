import { useState } from "react";
import { useNavigate, Navigate } from "react-router";
import { Sparkles } from "lucide-react";
import { Role, useAuth } from "./AuthContext";

const PORTAL_MODE = (import.meta.env.VITE_PORTAL_MODE as Role | undefined) || null;

export function Login() {
  const { login, identity } = useAuth();
  const navigate = useNavigate();
  const defaultRole: Role = PORTAL_MODE === "employee" ? "employee" : "hr";
  const [role, setRole] = useState<Role>(defaultRole);
  const [email, setEmail] = useState(
    defaultRole === "hr" ? "hr@nimbuslabs.ai" : "",
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (identity) {
    return (
      <Navigate to={identity.role === "hr" ? "/" : "/employee"} replace />
    );
  }

  const onRoleChange = (next: Role) => {
    setRole(next);
    setError(null);
    if (next === "hr") {
      setEmail("hr@nimbuslabs.ai");
    } else {
      setEmail("");
    }
    setPassword("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await login(role, email, password);
      navigate(id.role === "hr" ? "/" : "/employee", { replace: true });
    } catch (err: any) {
      setError("Invalid credentials. Check role, email, and password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h1 className="font-semibold text-gray-900">Nimbus Labs</h1>
            <p className="text-xs text-gray-500">AI-Powered HR Platform</p>
          </div>
          {PORTAL_MODE && (
            <span
              className={`ml-2 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                PORTAL_MODE === "hr"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {PORTAL_MODE === "hr" ? "HR Portal" : "Employee Portal"}
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex bg-gray-100 p-1 rounded-lg mb-5">
            <button
              type="button"
              onClick={() => onRoleChange("hr")}
              className={`flex-1 text-sm py-2 rounded-md transition-colors ${
                role === "hr"
                  ? "bg-white shadow text-gray-900 font-medium"
                  : "text-gray-600"
              }`}
            >
              HR
            </button>
            <button
              type="button"
              onClick={() => onRoleChange("employee")}
              className={`flex-1 text-sm py-2 rounded-md transition-colors ${
                role === "employee"
                  ? "bg-white shadow text-gray-900 font-medium"
                  : "text-gray-600"
              }`}
            >
              Employee
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  role === "hr" ? "hr@nimbuslabs.ai" : "you@example.com"
                }
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-xs text-gray-500 mt-4 text-center">
            {role === "hr"
              ? "HR default: hr@nimbuslabs.ai / hr-admin-2026"
              : "Employee accounts are created when HR sends an offer letter."}
          </p>
        </div>
      </div>
    </div>
  );
}

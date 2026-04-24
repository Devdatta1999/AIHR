import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type Role = "hr" | "employee";

export type Identity = {
  role: Role;
  email: string;
  name?: string;
  applicant_id?: number | null;
  employee_id?: number | null;
  exp?: number;
};

type AuthState = {
  token: string | null;
  identity: Identity | null;
  login: (role: Role, email: string, password: string) => Promise<Identity>;
  logout: () => void;
};

const KEY_TOKEN = "nimbus_token";
const KEY_IDENT = "nimbus_identity";

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(KEY_TOKEN),
  );
  const [identity, setIdentity] = useState<Identity | null>(() => {
    const raw = localStorage.getItem(KEY_IDENT);
    return raw ? (JSON.parse(raw) as Identity) : null;
  });

  useEffect(() => {
    if (token) localStorage.setItem(KEY_TOKEN, token);
    else localStorage.removeItem(KEY_TOKEN);
  }, [token]);

  useEffect(() => {
    if (identity) localStorage.setItem(KEY_IDENT, JSON.stringify(identity));
    else localStorage.removeItem(KEY_IDENT);
  }, [identity]);

  const login = async (role: Role, email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, email, password }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "login failed");
    }
    const data = await res.json();
    setToken(data.token);
    setIdentity(data.identity);
    return data.identity as Identity;
  };

  const logout = () => {
    setToken(null);
    setIdentity(null);
  };

  return (
    <Ctx.Provider value={{ token, identity, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function authHeader(): Record<string, string> {
  const t = localStorage.getItem(KEY_TOKEN);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

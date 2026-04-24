import { Navigate, Outlet } from "react-router";
import { Role, useAuth } from "./AuthContext";

type Props = { role?: Role };

export function RequireAuth({ role }: Props) {
  const { identity } = useAuth();
  if (!identity) return <Navigate to="/login" replace />;
  if (role && identity.role !== role) {
    return (
      <Navigate to={identity.role === "hr" ? "/" : "/employee"} replace />
    );
  }
  return <Outlet />;
}

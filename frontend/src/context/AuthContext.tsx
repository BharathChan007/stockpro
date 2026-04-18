import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "../api.js";

export type Role = "ADMIN" | "SALES_MANAGER";

export type User = {
  id: string;
  loginId: string;
  role: Role;
  fullName: string;
  branch: { id: string; name: string; location: string } | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setLoading(false);
      return;
    }
    api<{ id: string; loginId: string; role: Role; fullName: string; branch: User["branch"] }>("/auth/me")
      .then((u) =>
        setUser({
          id: u.id,
          loginId: u.loginId,
          role: u.role,
          fullName: u.fullName,
          branch: u.branch,
        })
      )
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (loginId: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ loginId, password }),
    });
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}

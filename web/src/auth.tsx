import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { ApiClient } from "./api";
import type { TokenResponse, UserProfile } from "./types";

const sessionKey = "projectpack.workbench.session.v1";

type StoredSession = Pick<TokenResponse, "access_token" | "user_id" | "username" | "display_name">;

type AuthState = {
  user: UserProfile | null;
  isRestoring: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(sessionKey);
    return raw ? JSON.parse(raw) as StoredSession : null;
  } catch {
    sessionStorage.removeItem(sessionKey);
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [stored, setStored] = useState<StoredSession | null>(loadSession);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const client = useMemo(() => new ApiClient({ getToken: () => stored?.access_token ?? null }), [stored]);

  const clear = useCallback(() => {
    sessionStorage.removeItem(sessionKey);
    setStored(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    if (!stored) {
      setIsRestoring(false);
      return () => { active = false; };
    }
    client.getCurrentUser()
      .then((currentUser) => { if (active) setUser(currentUser); })
      .catch(() => { if (active) clear(); })
      .finally(() => { if (active) setIsRestoring(false); });
    return () => { active = false; };
  }, [client, clear, stored]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await new ApiClient().login(username, password);
    const next: StoredSession = response;
    sessionStorage.setItem(sessionKey, JSON.stringify(next));
    setStored(next);
    setUser({ user_id: response.user_id, username: response.username, display_name: response.display_name, is_active: true });
  }, []);

  const value = useMemo<AuthState>(() => ({ user, isRestoring, login, logout: clear }), [clear, isRestoring, login, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth must be used inside AuthProvider");
  return state;
}

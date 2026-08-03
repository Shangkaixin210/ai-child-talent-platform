import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, ssoLogin, type User } from '../api/endpoints';
import { ApiError } from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: () => {},
  logout: async () => {},
  setUser: () => {},
});

// React StrictMode mounts effects twice in development. Keep one in-flight
// exchange per platform token so both mounts share the same backend request.
let pendingSSOLogin: {
  token: string;
  promise: ReturnType<typeof ssoLogin>;
} | null = null;

function exchangePlatformToken(token: string) {
  if (pendingSSOLogin?.token === token) return pendingSSOLogin.promise;

  const promise = ssoLogin(token);
  pendingSSOLogin = { token, promise };
  const clearPending = () => {
    if (pendingSSOLogin?.promise === promise) pendingSSOLogin = null;
  };
  promise.then(clearPending, clearPending);
  return promise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const url = new URL(window.location.href);
      const platformToken = url.searchParams.get('sso_token');

      try {
        if (platformToken) {
          const result = await exchangePlatformToken(platformToken);
          if (!active) return;
          localStorage.setItem('auth_token', result.token);
          setUser(result.user);
          if (result.show_onboarding) {
            sessionStorage.setItem('ai_bole_show_onboarding', 'true');
          } else {
            sessionStorage.removeItem('ai_bole_show_onboarding');
          }
          // The short-lived platform token has served its purpose. Remove it
          // from the address bar/history and use the story token from now on.
          url.searchParams.delete('sso_token');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          return;
        }

        if (!localStorage.getItem('auth_token')) return;
        const restoredUser = await getMe();
        if (active) setUser(restoredUser);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
          localStorage.removeItem('auth_token');
        }
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();
    return () => { active = false; };
  }, []);

  function login(token: string, user: User) {
    localStorage.setItem('auth_token', token);
    setUser(user);
  }

  async function logout() {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('ai_bole_show_onboarding');
    setUser(null);
    try {
      await fetch('/api/platform/logout', { method: 'POST' });
    } catch {
      // Local story state is already cleared. The platform login page can
      // recover even when its logout service is temporarily unavailable.
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

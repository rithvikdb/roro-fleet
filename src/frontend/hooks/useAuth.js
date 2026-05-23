import { createContext, useContext, useEffect, useState } from 'react';
import { getSessionUser, login, logout, register } from '../api/auth';
import { migrateLocalStorageOnce } from '../api/migration';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const { user } = await withTimeout(
          getSessionUser(),
          5000,
          'Timed out while checking auth session'
        );

        if (!mounted) return;
        setUser(user ?? null);
        setRole(user?.role ?? null);
        if (user) migrateLocalStorageOnce().catch(() => {});
        setLoading(false);
      } catch {
        if (!mounted) return;
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    }

    loadSession();
    return () => {
      mounted = false;
    };
  }, []);

  async function signIn(email, password) {
    const { user } = await login(email, password);
    setUser(user);
    setRole(user?.role ?? 'viewer');
    migrateLocalStorageOnce().catch(() => {});
  }

  async function signOut() {
    await logout();
    setUser(null);
    setRole(null);
  }

  async function signUp(email, password, fullName) {
    const { user } = await register(email, password, fullName);
    setUser(user);
    setRole(user?.role ?? 'viewer');
    migrateLocalStorageOnce().catch(() => {});
  }

  const canEdit = ['admin', 'fleet_manager'].includes(role);
  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signOut, signUp, canEdit, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

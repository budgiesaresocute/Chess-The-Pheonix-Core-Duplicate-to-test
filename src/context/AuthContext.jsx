import React, { createContext, useContext, useState, useEffect } from 'react';

const SERVER_URL = 'https://phoenix-chess-server.onrender.com';
const TOKEN_KEY = 'phoenix_chess_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // On app load, verify token and restore user
  useEffect(() => {
    const savedToken = token;
    if (!savedToken) { setLoading(false); return; }

    fetch(`${SERVER_URL}/profile/me`, {
      headers: { Authorization: `Bearer ${savedToken}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.username) {
          setUser(data);
        } else {
          // Token invalid, clear it
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .catch(() => {
        // Server might be sleeping, keep token and try again later
      })
      .finally(() => setLoading(false));
  }, []);

  const saveToken = (t) => {
    setToken(t);
    try { localStorage.setItem(TOKEN_KEY, t); } catch {}
  };

  const clearToken = () => {
    setToken(null);
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  };

  const register = async (username, password, email, phone) => {
    const res = await fetch(`${SERVER_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email, phone }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    saveToken(data.token);
    setUser(data.user);
    return data;
  };

  const login = async (usernameOrEmail, password) => {
    const res = await fetch(`${SERVER_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameOrEmail, password }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    saveToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await fetch(`${SERVER_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    clearToken();
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${SERVER_URL}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.username) setUser(data);
    } catch {}
  };

  const updateProfile = async (updates) => {
    if (!token) return;
    const res = await fetch(`${SERVER_URL}/profile/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.username) setUser(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      register, login, logout,
      refreshUser, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
  }

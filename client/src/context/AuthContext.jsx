import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('b2y_token') || null);
  const [loading, setLoading] = useState(true);

  // Initialize auth from token if available
  useEffect(() => {
    async function initAuth() {
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error('Failed to fetch user', e);
        }
      }
      // No valid session: leave user null so login screen displays
      setUser(null);
      setLoading(false);
    }
    initAuth();
  }, []);

  const switchPersona = async (personaId) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('b2y_token', data.token);
        return data.user;
      }
    } catch (e) {
      console.error('Persona switch failed', e);
    } finally {
      setLoading(false);
    }
  };

  const loginWithToken = (newUser, newToken) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem('b2y_token', newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('b2y_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, switchPersona, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

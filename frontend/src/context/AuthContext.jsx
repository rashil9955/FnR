import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
      apiClient.get('/auth/me').then((res) => setUser(res.data.user)).catch(() => logout());
    }
  }, [token]);

  const login = (tokenValue, userInfo) => {
    setToken(tokenValue);
    setUser(userInfo);
    localStorage.setItem('token', tokenValue);
    apiClient.defaults.headers.common.Authorization = `Bearer ${tokenValue}`;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete apiClient.defaults.headers.common.Authorization;
  };

  return <AuthContext.Provider value={{ token, user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

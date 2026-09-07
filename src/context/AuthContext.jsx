import React, { createContext, useState, useEffect, useContext } from 'react';
import { fetchSession, getUserAccounts, logoutUser } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const session = await fetchSession();
      setIsAuthenticated(session.authenticated);

      if (session.authenticated) {
        const accData = await getUserAccounts();
        const list = accData.accounts || [];
        setAccounts(list);
        if (list.length > 0) setSelectedAccount(list[0]);
      }
    } catch (err) {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    setIsAuthenticated(false);
    setAccounts([]);
    setSelectedAccount(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        accounts,
        selectedAccount,
        setSelectedAccount,
        loading,
        checkAuth,
        handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
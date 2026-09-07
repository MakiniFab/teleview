import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Callback() {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  useEffect(() => {
    const completeLogin = async () => {
      await checkAuth();
      navigate('/account');
    };
    completeLogin();
  }, [checkAuth, navigate]);

  return <div style={{ textAlign: 'center', marginTop: '100px' }}>Authenticating server session...</div>;
}
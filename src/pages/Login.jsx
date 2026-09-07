import React from 'react';

const APP_ID = '34kDVSDirzMLgl26cdX7N';
const REDIRECT_URI = 'https://deriv-backend-api.onrender.com/api/auth/callback';

export default function Login() {
  const handleLogin = () => {
    const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&l=EN&brand=deriv`;
    window.location.href = authUrl;
  };

  return (
    <div style={styles.container}>
      <h2>Options Trader</h2>
      <p>Connect your account to access real-time trading.</p>
      <button onClick={handleLogin} style={styles.button}>
        Login with Deriv
      </button>
    </div>
  );
}

const styles = {
  container: { padding: '40px', maxWidth: '400px', margin: '100px auto', textAlign: 'center', fontFamily: 'sans-serif', border: '1px solid #ccc', borderRadius: '8px' },
  button: { padding: '12px 24px', fontSize: '16px', backgroundColor: '#ff444f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '15px' }
};
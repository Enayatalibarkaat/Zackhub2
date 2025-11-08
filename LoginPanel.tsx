import React, { useState } from 'react';
import { getAdmins } from './utils';
import { CurrentUser, AdminUser } from './types';

interface LoginPanelProps {
  onLoginSuccess: (user: CurrentUser) => void;
  onCancel: () => void;
}

const LoginPanel: React.FC<LoginPanelProps> = ({ onLoginSuccess, onCancel }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for Super Admin
    // call Netlify function to validate super admin
try {
  setError(""); // clear previous error
  const res = await fetch("/.netlify/functions/adminLogin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim(), password: password.trim() })
  });

  const data = await res.json();

  if (res.ok && data.success) {
    // success — call existing handler
    onLoginSuccess({ username: data.user.username, role: data.user.role });
    return;
  } else {
    setError(data.error || "Invalid credentials");
    return;
  }
} catch (err) {
  console.error("Login request failed", err);
  setError("Login failed. Try again.");
  return;
}

    // Check for other admins
    const admins = getAdmins();
    const foundAdmin = admins.find(admin => admin.username === username && admin.password === password);

    if (foundAdmin) {
      setError('');
      onLoginSuccess(foundAdmin);
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-light-card dark:bg-brand-card p-8 rounded-xl shadow-2xl w-full max-w-sm">
        <h2 className="text-2xl font-bold text-center text-brand-primary mb-6">Owner Panel Login</h2>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-light-text-secondary dark:text-brand-text-secondary text-sm font-bold mb-2" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-light-bg dark:bg-brand-bg border border-gray-300 dark:border-gray-700 rounded py-2 px-3 text-light-text dark:text-brand-text leading-tight focus:outline-none focus:ring-2 focus:ring-brand-primary"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-light-text-secondary dark:text-brand-text-secondary text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-light-bg dark:bg-brand-bg border border-gray-300 dark:border-gray-700 rounded py-2 px-3 text-light-text dark:text-brand-text leading-tight focus:outline-none focus:ring-2 focus:ring-brand-primary"
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="bg-brand-primary hover:bg-opacity-80 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-block align-baseline font-bold text-sm text-gray-500 dark:text-gray-400 hover:text-light-text dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPanel;

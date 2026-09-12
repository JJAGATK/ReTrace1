import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const DEMO_ACCOUNTS = [
  {
    id: 'user-maya',
    name: 'Maya Lin',
    roleName: 'Student (Finder)',
    role: 'student',
    email: 'maya.lin@harvard.edu',
    affiliation: "Harvard College Undergrad '25",
    trustScore: 100,
    returnsCount: 14,
    avatar: 'https://lh3.googleusercontent.com/aida/AEtjO1VKdmUxVG-N5A5XZLSCGGS6rtwjUGLfaVH3Dp0s6J0SaP324w1jGNJ0D2s8k6BIldEAtdKQdNSIEwtW7-xZAXZhyLIpW2kjsdNTzscC5WRFrvvmYNILvyIwyaaNHG2Y6RBXECtF1wbgoy9N4Uhwf7RhsHJPYtE0z2DZ_0fI5XouhJcRzEUf011ylXziLJHY9Xs2KI_ttBi07vd51-KNZzTBuFs2Rl9CUzH4xXAg4aCSStxwHZ3hvRXVSzo',
    description: 'Reported AirPods found at Cabot Library, submits sightings for classmates.'
  },
  {
    id: 'user-julian',
    name: 'Julian Vance',
    roleName: 'Student (Claimant)',
    role: 'student',
    email: 'julian.vance@harvard.edu',
    affiliation: "Harvard SEAS Computer Science '26",
    trustScore: 98,
    returnsCount: 4,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    description: 'Lost MacBook Air at Student Union, claiming verified AirPods Pro.'
  },
  {
    id: 'user-admin',
    name: 'Officer Marcus Vance',
    roleName: 'Security Desk Administrator',
    role: 'admin',
    email: 'm.vance@campus.harvard.edu',
    affiliation: 'Campus Police & Cabot Circulation Desk',
    trustScore: 100,
    returnsCount: 98,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    description: 'Desk-level authority: approves claims, coordinates physical pickups, and can delete posts.'
  }
];

export default function AccountLoginScreen({ onLoggedIn }) {
  const { switchPersona, loginWithToken } = useAuth();
  const [selectedAccountId, setSelectedAccountId] = useState('user-maya');
  const [loggingIn, setLoggingIn] = useState(false);
  const [showEduOtp, setShowEduOtp] = useState(false);

  // OTP Form State
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState('request'); // 'request' or 'verify'
  const [demoCode, setDemoCode] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const selectedAccount = DEMO_ACCOUNTS.find(a => a.id === selectedAccountId) || DEMO_ACCOUNTS[0];

  const handleLoginSelected = async () => {
    setLoggingIn(true);
    try {
      await switchPersona(selectedAccountId);
      if (onLoggedIn) onLoggedIn();
    } catch (e) {
      console.error(e);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleQuickLogin = async (accId) => {
    setSelectedAccountId(accId);
    setLoggingIn(true);
    try {
      await switchPersona(accId);
      if (onLoggedIn) onLoggedIn();
    } catch (e) {
      console.error(e);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email.toLowerCase().endsWith('.edu')) {
      setFeedback('Error: Institutional policy requires an official university .edu email address.');
      return;
    }

    setLoggingIn(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        setStep('verify');
        setDemoCode(data.demoCode);
        setFeedback(`✓ 6-digit code dispatched to ${email}`);
      } else {
        setFeedback(data.error || 'Failed to request OTP');
      }
    } catch (err) {
      setFeedback('Network error requesting OTP');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode })
      });
      const data = await res.json();
      if (res.ok) {
        loginWithToken(data.user, data.token);
        if (onLoggedIn) onLoggedIn();
      } else {
        setFeedback(data.error || 'Invalid OTP code');
      }
    } catch (err) {
      setFeedback('Network error during verification');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 sm:p-6 relative text-slate-900 selection:bg-indigo-500/20 selection:text-indigo-600">
      
      {/* Subtle ambient light */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-[450px] h-[450px] rounded-full bg-indigo-100/30 blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-200 flex flex-col gap-6">
        
        {/* Brand & Title */}
        <div className="flex flex-col items-center text-center gap-2">
          <Logo size="md" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Campus Lost & Found
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xs">
            Sign in to claim lost property, report found items, or coordinate safe handovers.
          </p>
        </div>

        {!showEduOtp ? (
          <div className="flex flex-col gap-4">
            
            {/* Account Selection Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select Account:
              </label>
              <div className="relative">
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer appearance-none transition-colors"
                >
                  <option value="user-maya">Maya Lin — Student (Finder)</option>
                  <option value="user-julian">Julian Vance — Student (Claimant)</option>
                  <option value="user-admin">Officer Marcus Vance — Security Desk Admin</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">
                  expand_more
                </span>
              </div>
            </div>

            {/* Selected Account Profile Preview Card */}
            <div className={`p-4 rounded-2xl border transition-all ${
              selectedAccount.role === 'admin'
                ? 'bg-purple-50/40 border-purple-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-start gap-3">
                <img
                  src={selectedAccount.avatar}
                  alt={selectedAccount.name}
                  className="w-11 h-11 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {selectedAccount.name}
                    </h3>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-semibold ${
                      selectedAccount.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedAccount.roleName}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedAccount.email}
                  </p>

                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {selectedAccount.description}
                  </p>

                  <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-slate-600">
                    <span>★ {selectedAccount.trustScore}% Trust</span>
                    <span>• {selectedAccount.returnsCount} Returns</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Persona Buttons */}
            <div>
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Quick Select:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleQuickLogin(acc.id)}
                      className={`p-2 rounded-xl flex flex-col items-center text-center transition-colors cursor-pointer border ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <img
                        src={acc.avatar}
                        alt={acc.name}
                        className="w-7 h-7 rounded-full object-cover mb-1 ring-1 ring-slate-200"
                      />
                      <span className={`text-xs truncate w-full ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {acc.name.split(' ')[0]}
                      </span>
                      <span className={`text-[9px] truncate w-full ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                        {acc.role === 'admin' ? 'Desk Admin' : 'Student'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary Submit Button */}
            <button
              type="button"
              disabled={loggingIn}
              onClick={handleLoginSelected}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-1"
            >
              <span>{loggingIn ? 'Signing in...' : `Sign in as ${selectedAccount.name.split(' ')[0]}`}</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>

            {/* .edu SSO Toggle */}
            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setShowEduOtp(true)}
                className="text-xs text-indigo-600 font-medium hover:underline cursor-pointer flex items-center justify-center gap-1 mx-auto"
              >
                <span className="material-symbols-outlined text-sm">mail</span>
                <span>Sign in with university .edu email</span>
              </button>
            </div>

          </div>
        ) : (
          <div className="flex flex-col gap-4">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900">University .edu Login</span>
              <button
                type="button"
                onClick={() => setShowEduOtp(false)}
                className="text-xs text-indigo-600 font-medium hover:underline cursor-pointer"
              >
                ← Demo Accounts
              </button>
            </div>

            {step === 'request' ? (
              <form onSubmit={handleRequestOtp} className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    University Email (.edu)
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@harvard.edu"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-xs text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {feedback && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                    {feedback}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loggingIn ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Enter 6-Digit Code
                    </label>
                    {demoCode && (
                      <button
                        type="button"
                        onClick={() => setOtpCode(demoCode)}
                        className="text-[10px] text-indigo-600 font-bold underline cursor-pointer"
                      >
                        Use Demo Code: {demoCode}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="441920"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-center tracking-widest text-base font-mono text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {feedback && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
                    {feedback}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('request')}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loggingIn}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {loggingIn ? 'Verifying...' : 'Authenticate'}
                  </button>
                </div>
              </form>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

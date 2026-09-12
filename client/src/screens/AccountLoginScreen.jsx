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
    <div className="min-h-screen bg-[#fbf8ff] flex flex-col items-center justify-center p-4 sm:p-6 relative selection:bg-indigo-500/20 selection:text-indigo-600 text-[#1a1b25]">
      
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[360px] md:w-[650px] h-[360px] md:h-[650px] rounded-full bg-indigo-200/40 blur-3xl opacity-80"></div>
        <div className="absolute top-1/3 -right-24 w-[300px] md:w-[550px] h-[300px] md:h-[550px] rounded-full bg-violet-200/35 blur-3xl opacity-70"></div>
        <div className="absolute bottom-10 left-10 w-[320px] md:w-[600px] h-[320px] md:h-[600px] rounded-full bg-purple-100/45 blur-3xl opacity-60"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg bg-white/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-indigo-200/80 flex flex-col gap-5">
        
        {/* Brand & Title */}
        <div className="flex flex-col items-center text-center gap-2">
          <Logo size="md" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1a1b25] mt-1">
            University Campus Lost & Found
          </h1>
          <p className="text-xs sm:text-sm text-[#464554] max-w-sm">
            Sign in to claim lost property, report found items, or access the security desk console.
          </p>
        </div>

        {!showEduOtp ? (
          <div className="flex flex-col gap-4">
            
            {/* Account Selection Dropdown */}
            <div>
              <label className="block text-xs font-bold text-[#1a1b25] mb-2">
                Select Account to Log In:
              </label>
              <div className="relative">
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 rounded-2xl bg-indigo-50/70 hover:bg-indigo-50 border-2 border-indigo-200/80 text-sm font-bold text-[#1a1b25] focus:outline-none focus:ring-2 focus:ring-[#4648d4] focus:border-[#4648d4] shadow-xs cursor-pointer appearance-none transition-all"
                >
                  <option value="user-maya">Maya Lin — Student (Finder)</option>
                  <option value="user-julian">Julian Vance — Student (Claimant)</option>
                  <option value="user-admin">Officer Marcus Vance — Security Administrator Desk</option>
                </select>
                <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none text-xl">
                  expand_more
                </span>
              </div>
            </div>

            {/* Selected Account Profile Preview Card */}
            <div className={`p-4 rounded-2xl border-2 transition-all ${
              selectedAccount.role === 'admin'
                ? 'bg-purple-50/70 border-purple-300/80 shadow-xs'
                : 'bg-indigo-50/40 border-indigo-200/80 shadow-xs'
            }`}>
              <div className="flex items-start gap-3.5">
                <div className="relative shrink-0">
                  <img
                    src={selectedAccount.avatar}
                    alt={selectedAccount.name}
                    className="w-13 h-13 rounded-2xl object-cover ring-2 ring-indigo-200 shadow-sm"
                  />
                  <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center text-[10px] ring-2 ring-white ${
                    selectedAccount.role === 'admin' ? 'bg-purple-600' : 'bg-emerald-500'
                  }`}>
                    <span className="material-symbols-outlined text-[11px]">
                      {selectedAccount.role === 'admin' ? 'shield' : 'check'}
                    </span>
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <h3 className="text-sm font-bold text-[#1a1b25] truncate">
                      {selectedAccount.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedAccount.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedAccount.roleName}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedAccount.email} • {selectedAccount.affiliation}
                  </p>

                  <p className="text-xs text-[#464554] mt-2 leading-relaxed bg-white/80 p-2 rounded-xl border border-indigo-100/70">
                    {selectedAccount.description}
                  </p>

                  <div className="mt-2 flex items-center gap-3 text-[11px] font-bold text-indigo-700">
                    <span>★ {selectedAccount.trustScore}% Trust Score</span>
                    <span>• {selectedAccount.returnsCount} Verified Returns</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick 1-Click Cards Selector */}
            <div>
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Or Quick Choose Persona:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleQuickLogin(acc.id)}
                      className={`p-2.5 rounded-2xl flex flex-col items-center text-center transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-indigo-100/90 border-[#4648d4] ring-2 ring-indigo-500/30 font-bold'
                          : 'bg-white hover:bg-indigo-50/60 border-indigo-100 text-slate-600'
                      }`}
                    >
                      <img
                        src={acc.avatar}
                        alt={acc.name}
                        className="w-8 h-8 rounded-full object-cover mb-1 ring-1 ring-indigo-200"
                      />
                      <span className="text-xs font-bold text-[#1a1b25] truncate w-full">
                        {acc.name.split(' ')[0]}
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold truncate w-full">
                        {acc.role === 'admin' ? 'Security Desk' : 'Student'}
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
              className="w-full py-3.5 px-6 rounded-full btn-gradient-indigo text-white text-sm font-bold shadow-lg shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
            >
              <span>{loggingIn ? 'Logging in...' : `Log In as ${selectedAccount.name}`}</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>

            {/* .edu SSO Toggle */}
            <div className="pt-2 border-t border-indigo-100/70 text-center">
              <button
                type="button"
                onClick={() => setShowEduOtp(true)}
                className="text-xs text-[#4648d4] font-semibold hover:underline cursor-pointer flex items-center justify-center gap-1 mx-auto"
              >
                <span className="material-symbols-outlined text-sm">mail</span>
                <span>Log in with university .edu email</span>
              </button>
            </div>

          </div>
        ) : (
          <div className="flex flex-col gap-4">
            
            <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
              <span className="text-xs font-bold text-[#1a1b25]">University .edu Single Sign-On</span>
              <button
                type="button"
                onClick={() => setShowEduOtp(false)}
                className="text-xs text-[#4648d4] font-semibold hover:underline cursor-pointer"
              >
                ← Back to Demo Accounts
              </button>
            </div>

            {step === 'request' ? (
              <form onSubmit={handleRequestOtp} className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1a1b25] mb-1">
                    University Email (.edu only)
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student.id@harvard.edu"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-indigo-50/40 text-xs text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
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
                  className="w-full py-2.5 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loggingIn ? 'Sending Code...' : 'Send 6-Digit Campus OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#1a1b25]">
                      Enter 6-Digit OTP Code
                    </label>
                    {demoCode && (
                      <button
                        type="button"
                        onClick={() => setOtpCode(demoCode)}
                        className="text-[10px] text-[#4648d4] font-bold underline cursor-pointer"
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-indigo-50/40 text-center tracking-widest text-base font-mono text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
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
                    className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#1a1b25] text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loggingIn}
                    className="flex-1 py-2.5 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
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

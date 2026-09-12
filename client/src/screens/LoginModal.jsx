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
    avatar: 'https://lh3.googleusercontent.com/aida/AEtjO1VKdmUxVG-N5A5XZLSCGGS6rtwjUGLfaVH3Dp0s6J0SaP324w1jGNJ0D2s8k6BIldEAtdKQdNSIEwtW7-xZAXZhyLIpW2kjsdNTzscC5WRFrvvmYNILvyIwyaaNHG2Y6RBXECtF1wbgoy9N4Uhwf7RhsHJPYtE0z2DZ_0fI5XouhJcRzEUf011ylXziLJHY9Xs2KI_ttBi07vd51-KNZzTBuFs2Rl9CUzH4xXAg4aCSStxwHZ3hvRXVSzo'
  },
  {
    id: 'user-julian',
    name: 'Julian Vance',
    roleName: 'Student (Claimant)',
    role: 'student',
    email: 'julian.vance@harvard.edu',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
  },
  {
    id: 'user-admin',
    name: 'Officer Marcus Vance',
    roleName: 'Security Desk Administrator',
    role: 'admin',
    email: 'm.vance@campus.harvard.edu',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80'
  }
];

export default function LoginModal({ isOpen, onClose }) {
  const { switchPersona, loginWithToken } = useAuth();
  const [selectedAccountId, setSelectedAccountId] = useState('user-maya');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [mode, setMode] = useState('accounts'); // 'accounts' or 'edu'
  const [step, setStep] = useState('request');
  const [demoCode, setDemoCode] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSelectLogin = async () => {
    setLoading(true);
    try {
      await switchPersona(selectedAccountId);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (accId) => {
    setSelectedAccountId(accId);
    setLoading(true);
    try {
      await switchPersona(accId);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email.toLowerCase().endsWith('.edu')) {
      setFeedback('Error: Institutional policy requires an official university .edu email address.');
      return;
    }

    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
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
        onClose();
      } else {
        setFeedback(data.error || 'Invalid OTP verification code');
      }
    } catch (err) {
      setFeedback('Network error during verification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1b25]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-indigo-200/80 flex flex-col gap-4 text-[#1a1b25]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Logo size="xs" showText={false} />
            <div>
              <h3 className="font-bold text-base text-[#1a1b25]">Switch or Log In Account</h3>
              <p className="text-[11px] text-slate-400">ReTrace Campus Network</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {mode === 'accounts' ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1a1b25] mb-2">
                Choose Account from Dropdown:
              </label>
              <div className="relative">
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-indigo-50/70 border-2 border-indigo-200/80 text-xs font-bold text-[#1a1b25] focus:outline-none focus:ring-2 focus:ring-[#4648d4] cursor-pointer appearance-none"
                >
                  <option value="user-maya">Maya Lin — Student (Finder)</option>
                  <option value="user-julian">Julian Vance — Student (Claimant)</option>
                  <option value="user-admin">Officer Marcus Vance — Security Administrator Desk</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none text-lg">
                  expand_more
                </span>
              </div>
            </div>

            {/* Quick 1-click accounts */}
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleQuickLogin(acc.id)}
                  className={`p-2 rounded-xl flex flex-col items-center text-center transition-all cursor-pointer border ${
                    selectedAccountId === acc.id
                      ? 'bg-indigo-100 border-[#4648d4] font-bold'
                      : 'bg-white hover:bg-indigo-50/50 border-indigo-100 text-slate-600'
                  }`}
                >
                  <img src={acc.avatar} alt="" className="w-7 h-7 rounded-full object-cover mb-1 ring-1 ring-indigo-200" />
                  <span className="text-[11px] font-bold text-[#1a1b25] truncate w-full">{acc.name.split(' ')[0]}</span>
                  <span className="text-[9px] text-slate-400 truncate w-full">{acc.role === 'admin' ? 'Security' : 'Student'}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleSelectLogin}
              className="w-full py-2.5 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Switching...' : 'Switch to Selected Account'}
            </button>

            <div className="pt-2 border-t border-indigo-100 text-center">
              <button
                type="button"
                onClick={() => setMode('edu')}
                className="text-xs text-[#4648d4] font-semibold hover:underline cursor-pointer"
              >
                Or sign in with .edu OTP
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-[#1a1b25]">Official University .edu Email</span>
              <button
                type="button"
                onClick={() => setMode('accounts')}
                className="text-xs text-[#4648d4] font-semibold hover:underline cursor-pointer"
              >
                ← Back to Accounts
              </button>
            </div>

            {step === 'request' ? (
              <form onSubmit={handleRequestOtp} className="flex flex-col gap-3">
                <div>
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
                  disabled={loading}
                  className="w-full py-2.5 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Sending Code...' : 'Send 6-Digit Campus OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#1a1b25]">Enter 6-Digit OTP Code</label>
                    {demoCode && (
                      <button
                        type="button"
                        onClick={() => setOtpCode(demoCode)}
                        className="text-[10px] text-[#4648d4] font-bold underline cursor-pointer"
                      >
                        Demo Code: {demoCode}
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Authenticate'}
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

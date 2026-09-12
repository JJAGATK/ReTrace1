import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function LoginModal({ isOpen, onClose }) {
  const { switchPersona, loginWithToken } = useAuth();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState('request'); // 'request' or 'verify'
  const [demoCode, setDemoCode] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

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
        setFeedback(`✓ 6-digit security code dispatched to ${email}`);
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
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-indigo-200/80 flex flex-col gap-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Logo size="xs" showText={false} />
            <div>
              <h3 className="font-bold text-base text-[#1a1b25]">Campus Single Sign-On</h3>
              <p className="text-[11px] text-slate-400">ReTrace University Hub</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Info */}
        <p className="text-xs text-[#464554] leading-relaxed">
          Log in with your official university credentials to claim items, coordinate safe-zone handoffs, or report items found on campus.
        </p>

        {/* Form */}
        {step === 'request' ? (
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1a1b25] mb-1">
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
                disabled={loading}
                className="flex-1 py-2.5 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Authenticate'}
              </button>
            </div>
          </form>
        )}

        {/* Quick Demo Personas */}
        <div className="border-t border-indigo-100 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 text-center">
            Or Click to Switch Instant Persona
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => { switchPersona('user-maya'); onClose(); }}
              className="p-2 rounded-xl bg-indigo-50/60 hover:bg-indigo-100 text-center text-xs font-bold text-[#4648d4] border border-indigo-100 cursor-pointer"
            >
              Maya (Finder)
            </button>
            <button
              type="button"
              onClick={() => { switchPersona('user-julian'); onClose(); }}
              className="p-2 rounded-xl bg-indigo-50/60 hover:bg-indigo-100 text-center text-xs font-bold text-[#F43F5E] border border-indigo-100 cursor-pointer"
            >
              Julian (Claimant)
            </button>
            <button
              type="button"
              onClick={() => { switchPersona('user-admin'); onClose(); }}
              className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-center text-xs font-bold text-purple-700 border border-purple-200 cursor-pointer"
            >
              Officer (Admin)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

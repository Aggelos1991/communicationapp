import React, { useState } from 'react';
import { Activity, Mail, Lock, LogIn, ShieldCheck, User, UserPlus, Key, Smartphone } from 'lucide-react';
import { authService, type AuthUser } from '../services/authService';
import { verifyTOTP } from '../services/totpService';

interface SignInProps {
  onSignIn: (user: AuthUser) => void;
}

export const SignIn: React.FC<SignInProps> = ({ onSignIn }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Operations Manager');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TOTP states
  const [requiresTOTP, setRequiresTOTP] = useState(false);
  const [totpToken, setTotpToken] = useState('');
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        await authService.signUp(email, password, name, role);
        setError('Sign up successful! Please check your email to confirm your account, then sign in.');
        setIsSignUp(false);
        setPassword('');
      } else {
        const { user } = await authService.signIn(email, password);
        if (user) {
          const authUser = authService.transformUser(user);
          if (authUser) {
            // Store user for TOTP verification
            setPendingUser(authUser);
            // Show TOTP form - don't call onSignIn yet
            setRequiresTOTP(true);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const isValid = verifyTOTP(totpToken);

      if (isValid && pendingUser) {
        // TOTP verified successfully - allow sign in
        onSignIn(pendingUser);
      } else {
        setError('Invalid authentication code. Please try again.');
        setTotpToken('');
      }
    } catch (err: any) {
      setError('Failed to verify authentication code.');
      setTotpToken('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative z-10 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-brand-600 p-4 rounded-2xl shadow-xl shadow-brand-900/30 mb-4">
            <Activity className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-white" style={{letterSpacing: '-0.03em'}}>FinComms</h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-wide font-semibold">Enterprise Finance Hub</p>
        </div>

        {/* TOTP Input Form */}
        {requiresTOTP ? (
          <form onSubmit={handleTOTPSubmit} className="space-y-6">
            {error && (
              <div className="p-3 rounded-lg text-sm bg-red-900/30 border border-red-700 text-red-300">
                {error}
              </div>
            )}

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600/20 rounded-2xl mb-3">
                <Smartphone className="text-brand-400" size={32} />
              </div>
              <h2 className="text-lg font-bold text-white">Two-Factor Authentication</h2>
              <p className="text-sm text-slate-400 mt-1">Enter the 6-digit code from Google Authenticator</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide ml-1">Authentication Code</label>
              <div className="relative">
                <Key className="absolute left-4 top-3.5 text-slate-500" size={18} />
                <input
                  type="text"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all placeholder-slate-700"
                  placeholder="000000"
                  value={totpToken}
                  onChange={e => setTotpToken(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || totpToken.length !== 6}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-900/40 transition-all flex items-center justify-center gap-2 group active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Verify & Sign In <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={async () => {
                // Sign out when going back
                await authService.signOut();
                setRequiresTOTP(false);
                setPendingUser(null);
                setTotpToken('');
                setError(null);
              }}
              className="w-full text-sm text-slate-400 hover:text-brand-400 transition-colors py-2"
            >
              ← Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className={`p-3 rounded-lg text-sm ${error.includes('successful') ? 'bg-emerald-900/30 border border-emerald-700 text-emerald-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
                {error}
              </div>
            )}

          {isSignUp && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 text-slate-500" size={18} />
                <input
                  type="text"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all placeholder-slate-700"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input
                type="email"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all placeholder-slate-700"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input
                type="password"
                required
                minLength={6}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all placeholder-slate-700"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {isSignUp && (
              <p className="text-[10px] text-slate-500 mt-1 pl-1">Password must be at least 6 characters.</p>
            )}
          </div>

          {isSignUp && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide ml-1">Role</label>
              <select
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                <option value="Operations Manager">Operations Manager</option>
                <option value="AP Processor">AP Processor</option>
                <option value="Reconciliation Specialist">Reconciliation Specialist</option>
                <option value="Payment Approver">Payment Approver</option>
                <option value="Finance Manager">Finance Manager</option>
              </select>
            </div>
          )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-900/40 transition-all flex items-center justify-center gap-2 group active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isSignUp ? (
                    <>Create Account <UserPlus size={20} className="group-hover:translate-x-1 transition-transform" /></>
                  ) : (
                    <>Continue <LogIn size={20} className="group-hover:translate-x-1 transition-transform" /></>
                  )}
                </>
              )}
            </button>
          </form>
        )}

        {!requiresTOTP && (
          <>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="text-sm text-slate-400 hover:text-brand-400 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-center gap-2 text-slate-500 text-xs">
              <ShieldCheck size={14} />
              <span>Secured by Supabase + 2FA</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
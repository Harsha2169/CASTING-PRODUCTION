import React, { useState } from 'react';
import { useApp } from './AppContext';
import {
  Building2,
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Users,
  HardHat,
  Sparkles
} from 'lucide-react';

type LoginPortalMode = 'SUPERVISOR' | 'ADMIN';

export const LoginPage: React.FC = () => {
  const { login, supervisors } = useApp();
  const [activePortal, setActivePortal] = useState<LoginPortalMode>('SUPERVISOR');
  const [username, setUsername] = useState('VIJAY');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active supervisors from supervisor master
  const activeSupervisors = supervisors.filter(s => s.status === 'ACTIVE');

  // Handle portal switch
  const handleSwitchPortal = (portal: LoginPortalMode) => {
    setActivePortal(portal);
    setErrorMessage(null);
    if (portal === 'ADMIN') {
      setUsername('ADMIN');
    } else {
      setUsername('VIJAY');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim()) {
      setErrorMessage('Please enter your User Name (e.g. VIJAY, KARTHIK, or ADMIN).');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Please enter your Password (DSPL@123).');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(username, password);
      if (!result.success) {
        setErrorMessage(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred during login. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (u: string) => {
    setUsername(u);
    setPassword('DSPL@123');
    setErrorMessage(null);
    if (u === 'ADMIN') {
      setActivePortal('ADMIN');
    } else {
      setActivePortal('SUPERVISOR');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans antialiased">
      {/* Top Facility Branding Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 text-white font-black text-base">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wider text-white">DSPL DIE CASTING</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold border border-blue-500/30">
                8-GDC MIS
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live Hourly Manufacturing Execution &amp; Control Tower
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="font-mono text-[11px]">System Online &bull; Cloud Synced</span>
        </div>
      </header>

      {/* Main Authentication Center Card */}
      <main className="w-full max-w-lg mx-auto my-auto py-4">
        <div className="bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Card Top Title Banner */}
          <div className="bg-slate-900 text-white p-6 pb-4 border-b border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Authorized Plant Access</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">DSPL Manufacturing</span>
            </div>

            <h1 className="text-xl font-black tracking-tight text-white">
              {activePortal === 'SUPERVISOR' ? 'Shift Supervisor Login' : 'Admin Authentication'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {activePortal === 'SUPERVISOR'
                ? 'Dedicated live hourly production entry portal for shift supervisors.'
                : 'PPC Management, Master Settings, and Plant Configuration portal.'}
            </p>

            {/* Portal Tab Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-xl mt-4 border border-slate-800">
              <button
                type="button"
                id="tab-login-supervisor"
                onClick={() => handleSwitchPortal('SUPERVISOR')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activePortal === 'SUPERVISOR'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <HardHat className="w-4 h-4" />
                <span>Supervisor (Vijay / Karthik)</span>
              </button>

              <button
                type="button"
                id="tab-login-admin"
                onClick={() => handleSwitchPortal('ADMIN')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activePortal === 'ADMIN'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Admin (Vishwaraj)</span>
              </button>
            </div>
          </div>

          {/* Quick-Fill Helper Cards for Supervisors & Admin */}
          <div className="bg-slate-50 border-b border-slate-200 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>Authorized Accounts (Password: <code className="bg-blue-100 text-blue-900 px-1 py-0.5 rounded font-mono font-black">DSPL@123</code>)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Click to auto-fill</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-quickfill-vijay"
                onClick={() => handleQuickFill('VIJAY')}
                className={`p-2 rounded-xl text-left border transition-all ${
                  username.toUpperCase() === 'VIJAY'
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400/30'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                }`}
              >
                <div className="text-[10px] font-bold text-blue-600 uppercase">Supervisor</div>
                <div className="text-xs font-black text-slate-900">VIJAY</div>
                <div className="text-[10px] text-slate-500 font-mono">DSPL@123</div>
              </button>

              <button
                type="button"
                id="btn-quickfill-karthik"
                onClick={() => handleQuickFill('KARTHIK')}
                className={`p-2 rounded-xl text-left border transition-all ${
                  username.toUpperCase() === 'KARTHIK'
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400/30'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                }`}
              >
                <div className="text-[10px] font-bold text-blue-600 uppercase">Supervisor</div>
                <div className="text-xs font-black text-slate-900">KARTHIK</div>
                <div className="text-[10px] text-slate-500 font-mono">DSPL@123</div>
              </button>

              <button
                type="button"
                id="btn-quickfill-admin"
                onClick={() => handleQuickFill('ADMIN')}
                className={`p-2 rounded-xl text-left border transition-all ${
                  username.toUpperCase() === 'ADMIN'
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400/30'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                }`}
              >
                <div className="text-[10px] font-bold text-slate-600 uppercase">Manager</div>
                <div className="text-xs font-black text-slate-900">ADMIN</div>
                <div className="text-[10px] text-slate-500 font-mono">DSPL@123</div>
              </button>
            </div>
          </div>

          {/* Login Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error Alert Message */}
            {errorMessage && (
              <div
                id="login-error-alert"
                className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5 animate-shake"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-snug">{errorMessage}</div>
              </div>
            )}

            {/* Quick Supervisor Selector Chips if in Supervisor portal */}
            {activePortal === 'SUPERVISOR' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Supervisor Account:
                </label>
                <div className="flex flex-wrap gap-2">
                  {['VIJAY', 'KARTHIK', ...activeSupervisors.map(s => s.supervisor_name.toUpperCase()).filter(n => n !== 'VIJAY' && n !== 'KARTHIK')].map(supName => (
                    <button
                      key={supName}
                      type="button"
                      onClick={() => {
                        setUsername(supName);
                        setPassword('DSPL@123');
                        setErrorMessage(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                        username.toUpperCase() === supName
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <HardHat className="w-3.5 h-3.5" />
                      <span>{supName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label
                htmlFor="login-username-input"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                {activePortal === 'SUPERVISOR' ? 'Supervisor User Name' : 'Admin User Name'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-username-input"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={activePortal === 'SUPERVISOR' ? 'VIJAY or KARTHIK' : 'ADMIN'}
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-mono font-bold tracking-wider rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none transition-all uppercase"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="login-password-input"
                  className="block text-xs font-bold text-slate-700"
                >
                  Password
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Required: DSPL@123</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="DSPL@123"
                  className="w-full pl-9 pr-10 py-2.5 text-xs font-mono rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              id="login-submit-btn"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/30 shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-70 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>
                    Sign In as {username.toUpperCase() || (activePortal === 'SUPERVISOR' ? 'Supervisor' : 'Admin')}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Card Info Footer */}
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Supervisor Master Linked</span>
            </span>
            <span>Vijay &bull; Karthik &bull; Admin</span>
          </div>
        </div>

        {/* Security Compliance Footer Note */}
        <div className="text-center text-xs text-slate-400 mt-6 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-slate-300 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Role-Based Access Control &bull; Live Audit Trail</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Shift supervisor entries and admin master configurations are committed directly to Firestore database.
          </p>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-500 py-3 border-t border-slate-800/60">
        <div>&copy; DSPL Die Casting &bull; 8 GDC Production MIS &amp; Control Tower</div>
      </footer>
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Shield, Mail, ChevronRight } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillCredentials = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-sky-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />

      <div className="w-full max-w-md relative z-10 space-y-4">
        {/* Main Card */}
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-slate-700/50">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-sky-500/20 border border-sky-500/30 p-3 rounded-xl">
                <Shield size={32} className="text-sky-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">
              CrowdNexis <span className="text-sky-400">AI</span>
            </h1>
            <p className="text-slate-400 text-sm">Sign in to the surveillance dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400/30 transition-all"
                />
              </div>
            </div>

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all mt-6 shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-center text-slate-400 text-sm mb-2">
              Don't have an account?{' '}
              <Link to="/signup" className="text-sky-400 hover:text-sky-300 font-semibold transition-colors">
                Sign up
              </Link>
            </p>
            <p className="text-center text-slate-500 text-xs">
              Admin?{' '}
              <Link to="/admin/login" className="text-slate-400 hover:text-slate-300 font-semibold transition-colors">
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Credentials Card */}
        <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl border border-sky-500/20 p-4">
          <p className="text-sky-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Shield size={12} />
            Demo Credentials — Click to auto-fill
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fillCredentials('admin@crowdsafe.com', 'Admin@123')}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-sky-500/30 rounded-lg transition-all group"
            >
              <div className="text-left">
                <p className="text-white text-sm font-medium">👑 Admin Account</p>
                <p className="text-slate-400 text-xs">admin@crowdsafe.com · Full access + Delete</p>
              </div>
              <ChevronRight size={14} className="text-slate-500 group-hover:text-sky-400 transition-colors" />
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('operator@crowdnexis.ai', 'operator123')}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-sky-500/30 rounded-lg transition-all group"
            >
              <div className="text-left">
                <p className="text-white text-sm font-medium">🔰 Operator Account</p>
                <p className="text-slate-400 text-xs">operator@crowdnexis.ai · Standard access</p>
              </div>
              <ChevronRight size={14} className="text-slate-500 group-hover:text-sky-400 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

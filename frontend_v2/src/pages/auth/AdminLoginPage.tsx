import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Mail, Lock } from 'lucide-react';

export function AdminLoginPage() {
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
      const { role } = await login(email, password);

      // Verify admin role
      if (role !== 'ADMIN') {
        setError('This account does not have admin privileges.');
        return;
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Admin login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />

      {/* Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
          {/* Admin Badge */}
          <div className="flex justify-center mb-4">
            <span className="inline-block px-3 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-full">
              ADMIN ACCESS
            </span>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-amber-500 p-3 rounded-lg">
                <Lock size={32} className="text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Administrator</h1>
            <p className="text-slate-400">Sign in to admin dashboard</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all mt-6"
            >
              {isLoading ? 'Verifying...' : 'Sign In as Admin'}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-center text-slate-400 text-sm">
              <Link to="/login" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">
                Back to user login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLoginPage;

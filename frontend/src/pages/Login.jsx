import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../services/authService';
import arthaLogo from '../artha-logo.png';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      const { token, ...user } = data;
      login(user, token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-gradient-to-br from-ocean via-blueberry to-bluebird p-12 relative overflow-hidden">
        
        {/* Animated floating circles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-64 h-64 rounded-full bg-white/5 -top-16 -left-16 animate-float1" />
          <div className="absolute w-48 h-48 rounded-full bg-white/5 top-1/3 -right-12 animate-float2" />
          <div className="absolute w-32 h-32 rounded-full bg-white/10 bottom-24 left-1/4 animate-float3" />
          <div className="absolute w-20 h-20 rounded-full bg-skylight/20 top-1/4 left-1/3 animate-float2" />
        </div>

        {/* Floating stat cards */}
        <div className="absolute top-1/4 right-8 animate-float1">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 w-48">
            <p className="text-skylight text-xs mb-1">Total Inflow</p>
            <p className="text-white text-xl font-bold">₹2,40,000</p>
            <p className="text-green-300 text-xs mt-1">↑ 12% this month</p>
          </div>
        </div>

        <div className="absolute bottom-1/3 right-12 animate-float3">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 w-44">
            <p className="text-skylight text-xs mb-1">Available Cash</p>
            <p className="text-white text-xl font-bold">₹1,85,000</p>
            <p className="text-skylight text-xs mt-1">After all expenses</p>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">Artha</h1>
          <p className="text-skylight text-sm mt-1">Personal finance, simplified</p>
        </div>

        <div className="relative z-10">
          <p className="text-white/80 text-2xl font-light leading-relaxed">
            "Track every rupee.<br />Own every decision."
          </p>
        </div>

        <div className="relative z-10 flex gap-2">
          <span className="w-2 h-2 rounded-full bg-white/40" />
          <span className="w-2 h-2 rounded-full bg-white" />
          <span className="w-2 h-2 rounded-full bg-white/40" />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 bg-clouds">
        <div className="w-full max-w-sm animate-scaleIn">
          <div className="md:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-ocean">Artha</h1>
            <p className="text-bluebird text-sm mt-1">Personal finance, simplified</p>
          </div>

        <div className="w-16 h-16 rounded-2xl bg-blueberry flex items-center justify-center mb-6 shadow-md">
        <img src={arthaLogo} alt="Artha" className="h-15 w-auto brightness-0 invert" />
        </div>
<h2 className="text-2xl font-semibold text-ocean mb-1">Welcome back</h2>
<p className="text-bluebird text-sm mb-8">Sign in to your account</p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ocean/60 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                required placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-skylight/40 bg-white text-ocean text-sm placeholder-bluebird/40 focus:outline-none focus:ring-2 focus:ring-blueberry focus:border-transparent shadow-sm transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ocean/60 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-skylight/40 bg-white text-ocean text-sm placeholder-bluebird/40 focus:outline-none focus:ring-2 focus:ring-blueberry focus:border-transparent shadow-sm transition-all duration-200"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit" disabled={loading}
                className="w-full py-3 bg-blueberry hover:bg-ocean text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-60"
              >
                {loading ? 'Signing in...' : 'Sign in →'}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-bluebird mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-blueberry font-semibold hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
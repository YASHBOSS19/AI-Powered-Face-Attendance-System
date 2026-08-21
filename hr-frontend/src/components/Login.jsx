import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiCall } from '../api';
import { Lock, User, Eye, EyeOff, ShieldCheck, Camera, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const autoFillDemo = () => {
    setUsername('admin');
    setPassword('password123');
    setError('');
  };

  return (
    <div className="w-full min-h-[100dvh] bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none font-sans">
      
      {/* Animated Ambient Glowing Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-teal/20 rounded-full blur-[120px] pointer-events-none animate-float-slow"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-blue/20 rounded-full blur-[120px] pointer-events-none animate-float-reverse"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-navy/30 rounded-full blur-[150px] pointer-events-none animate-pulse-glow"></div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"></div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl border border-slate-800/80 shadow-[0_20px_60px_rgba(0,0,0,0.6)] relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Brand Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative mb-4 inline-block">
            <img src="/logo.png" alt="IdentiFi Logo" className="h-24 w-auto object-contain rounded-full drop-shadow-[0_0_15px_rgba(20,184,166,0.3)]" />
            <div className="absolute top-0 right-0 h-4 w-4 rounded-full bg-emerald-400 border-2 border-slate-900 animate-ping"></div>
            <div className="absolute top-0 right-0 h-4 w-4 rounded-full bg-emerald-400 border-2 border-slate-900"></div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
            IdentiFi <span className="text-brand-teal">HR</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Enterprise Facial Attendance Portal</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3.5 rounded-xl mb-6 text-xs font-semibold animate-in fade-in duration-200 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400 shrink-0"></span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:bg-slate-800 focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal outline-none transition duration-200"
                placeholder="Enter admin username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-slate-800/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:bg-slate-800 focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal outline-none transition duration-200"
                placeholder="Enter admin password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-brand-teal hover:bg-teal-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-teal/20 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <><RefreshCw className="animate-spin" size={18} /> Authenticating...</>
            ) : (
              <><span>Sign In to Dashboard</span> <ArrowRight size={18} /></>
            )}
          </button>
        </form>

        {/* Quick Autofill & Gate Kiosk Link */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col gap-3">

          <a
            href="/gate"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-3 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 rounded-xl text-xs text-teal-300 font-semibold transition flex items-center justify-center gap-2"
          >
            <Camera size={14} />
            <span>Open Standalone Gate Terminal</span>
          </a>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
          <ShieldCheck size={14} className="text-brand-teal" />
          <span>Secured by IdentiFi Biometric Framework</span>
        </div>

      </div>

    </div>
  );
}

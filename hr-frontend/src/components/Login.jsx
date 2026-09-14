import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../api';
import { Lock, User, Eye, EyeOff, ShieldCheck, Camera, ArrowRight, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyName] = useState('IdentiFi');
  const [logoUrl] = useState('/logo.png');
  const [showKioskModal, setShowKioskModal] = useState(false);
  const [kioskUsername, setKioskUsername] = useState('');
  const [kioskPassword, setKioskPassword] = useState('');
  const [kioskLoading, setKioskLoading] = useState(false);
  const [kioskError, setKioskError] = useState('');
  
  const navigate = useNavigate();

  React.useEffect(() => {
    document.title = 'IdentiFi - Sign In';
  }, []);

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
        if (data.role === 'SUPER_ADMIN') {
          navigate('/super-admin');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleKioskAuth = async (e) => {
    e.preventDefault();
    setKioskLoading(true);
    setKioskError('');

    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: kioskUsername, password: kioskPassword })
      });
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        // Navigate directly to the gate instead of the dashboard
        navigate('/gate');
      }
    } catch (err) {
      setKioskError(err.message || 'Authorization failed. Please check credentials.');
    } finally {
      setKioskLoading(false);
    }
  };

  const autoFillDemo = () => {
    setUsername('admin');
    setPassword('password123');
    setError('');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 bg-sky-50 font-sans overflow-hidden relative select-none">
      
      {/* --- Animated Mesh Background (Light Mode) --- */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Animated Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-brand-teal/20 rounded-full blur-[120px] mix-blend-multiply animate-float"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-brand-blue/20 rounded-full blur-[150px] mix-blend-multiply animate-float-delayed"></div>
        <div className="absolute top-[20%] left-[30%] w-[40vw] h-[40vw] bg-sky-400/20 rounded-full blur-[100px] mix-blend-multiply animate-pulse-glow"></div>
        
        {/* Light Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      </div>

      {/* --- Light Glassmorphic Container --- */}
      <div className="relative z-10 w-full max-w-6xl rounded-3xl bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] flex flex-col lg:flex-row overflow-hidden animate-in zoom-in-95 duration-700">
        
        {/* Left Side - Brand & Visuals */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 lg:p-16 border-r border-white/60 relative">
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 text-brand-teal text-xs font-bold tracking-widest uppercase mb-8 backdrop-blur-md shadow-sm">
              <Sparkles size={14} className="animate-pulse" />
              Ultimate Edition
            </div>
            <h1 className="text-5xl font-black text-slate-900 leading-[1.1] tracking-tight mb-6">
              The Future of <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-500">
                Attendance.
              </span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed font-medium max-w-md">
              Secure, lightning-fast facial recognition powered by deep learning. Welcome to your intelligent workspace.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-5 p-5 rounded-2xl bg-white/60 border border-white/80 backdrop-blur-md mt-12 group hover:bg-white/80 transition-colors shadow-sm">
            <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-brand-teal to-blue-500 flex items-center justify-center shrink-0 shadow-[0_4px_15px_rgba(14,165,233,0.3)] group-hover:shadow-[0_6px_25px_rgba(14,165,233,0.4)] transition-all">
              <ShieldCheck size={28} className="text-white" />
            </div>
            <div>
              <p className="text-slate-900 font-bold tracking-wide">Military-Grade Security</p>
              <p className="text-sm text-slate-500 mt-1 font-medium">Encrypted biometric processing</p>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-center relative bg-white/20">
          
          <div className="w-full max-w-md mx-auto">
            {/* Dynamic Logo & Name */}
            <div className="text-center mb-10">
              <div className="inline-block relative mb-6 group">
                <div className="absolute inset-0 bg-brand-teal/20 blur-2xl rounded-full scale-110 group-hover:scale-150 transition-transform duration-700 opacity-60"></div>
                <img 
                  src={logoUrl} 
                  alt="Company Logo" 
                  className="h-24 w-auto object-contain relative z-10 drop-shadow-sm"
                />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                {companyName}
              </h2>
              <p className="text-slate-500 font-medium">Please sign in to continue</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-8 text-sm font-medium animate-in slide-in-from-top-2 duration-300 flex items-center gap-3 shadow-sm">
                <AlertTriangle size={18} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-teal transition-colors">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-white/70 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-4 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all duration-300 shadow-sm"
                    placeholder="Enter admin username"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-teal transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-4 bg-white/70 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-4 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all duration-300 shadow-sm"
                    placeholder="Enter admin password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <><RefreshCw className="animate-spin" size={20} /> Authenticating...</>
                ) : (
                  <>Sign In to Dashboard <ArrowRight size={20} /></>
                )}
              </button>
            </form>

            {/* Quick Actions */}
            <div className="mt-10 pt-8 border-t border-slate-200/60">
              <button
                type="button"
                onClick={() => setShowKioskModal(true)}
                className="w-full py-4 px-4 bg-white/60 hover:bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:text-slate-900 font-semibold transition-all shadow-sm flex items-center justify-center gap-2 group"
              >
                <Camera size={18} className="text-brand-teal group-hover:scale-110 transition-transform" />
                <span>Open Standalone Gate Terminal</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Kiosk Authorization Modal */}
      {showKioskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200 relative border border-slate-100">
            <button 
              onClick={() => setShowKioskModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-blue-100">
                <Camera size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Authorize Kiosk</h3>
              <p className="text-sm text-slate-500 mt-2 font-medium">Enter your admin credentials to authorize this tablet as a Standalone Gate Terminal.</p>
            </div>

            {kioskError && (
              <div className="mb-6 bg-red-50 text-red-600 text-sm font-semibold p-4 rounded-xl border border-red-100 text-center">
                {kioskError}
              </div>
            )}

            <form onSubmit={handleKioskAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Admin Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    value={kioskUsername}
                    onChange={(e) => setKioskUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all"
                    placeholder="Enter HR username"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5 pb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Admin Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input
                    type="password"
                    required
                    value={kioskPassword}
                    onChange={(e) => setKioskPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all"
                    placeholder="Enter HR password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={kioskLoading}
                className="w-full bg-brand-teal hover:bg-brand-blue text-white font-bold py-3.5 rounded-xl transition shadow-md hover:shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {kioskLoading ? <RefreshCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                {kioskLoading ? 'Authorizing...' : 'Authorize & Open Gate'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

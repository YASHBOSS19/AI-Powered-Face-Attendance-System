import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall } from '../api';
import { 
  Lock, FileQuestion, User, Eye, EyeOff, ShieldCheck, Camera, 
  ArrowRight, RefreshCw, Sparkles, AlertTriangle, Building2, 
  UserCheck, BadgeCheck, HelpCircle, CheckCircle2 
} from 'lucide-react';

export default function Login() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'employee' ? 'EMPLOYEE' : 'HR';
  const [loginMode, setLoginMode] = useState(initialTab); // 'HR' | 'EMPLOYEE'

  // HR Admin States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Employee Portal States
  const [employeeId, setEmployeeId] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState('');

  const [companyName] = useState('IdentiFi');
  const [logoUrl] = useState('/logo.png');
  const [showKioskModal, setShowKioskModal] = useState(false);
  const [kioskUsername, setKioskUsername] = useState('');
  const [kioskPassword, setKioskPassword] = useState('');
  const [kioskLoading, setKioskLoading] = useState(false);
  const [kioskError, setKioskError] = useState('');
  
  const navigate = useNavigate();

  React.useEffect(() => {
    document.title = loginMode === 'EMPLOYEE' 
      ? 'IdentiFi - Employee Portal Sign In' 
      : 'IdentiFi - HR & Admin Sign In';
  }, [loginMode]);

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

  const handleEmployeeLogin = async (e) => {
    e.preventDefault();
    setEmpLoading(true);
    setEmpError('');

    try {
      const data = await apiCall('/auth/employee-login', {
        method: 'POST',
        body: JSON.stringify({ 
          employee_id: employeeId.trim(), 
          password: empPassword 
        })
      });

      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', 'EMPLOYEE');
        if (data.employee) {
          localStorage.setItem('employee_info', JSON.stringify(data.employee));
        }
        navigate('/employee/portal');
      }
    } catch (err) {
      setEmpError(err.message || 'Employee authentication failed. Check your Employee ID and password.');
    } finally {
      setEmpLoading(false);
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
        navigate('/gate');
      }
    } catch (err) {
      setKioskError(err.message || 'Authorization failed. Please check credentials.');
    } finally {
      setKioskLoading(false);
    }
  };

  const autoFillAdminDemo = () => {
    setUsername('admin');
    setPassword('password123');
    setError('');
  };

  const autoFillSuperAdminDemo = () => {
    setUsername('superadmin');
    setPassword('superadmin123');
    setError('');
  };

  const autoFillEmpDemo102 = () => {
    setEmployeeId('102');
    setEmpPassword('password123');
    setEmpError('');
  };

  const autoFillEmpDemo101 = () => {
    setEmployeeId('101');
    setEmpPassword('password123');
    setEmpError('');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 bg-sky-50 font-sans overflow-hidden relative select-none">
      
      {/* --- Animated Mesh Background --- */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-brand-teal/20 rounded-full blur-[120px] mix-blend-multiply animate-float"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-brand-blue/20 rounded-full blur-[150px] mix-blend-multiply animate-float-delayed"></div>
        <div className="absolute top-[20%] left-[30%] w-[40vw] h-[40vw] bg-indigo-400/20 rounded-full blur-[100px] mix-blend-multiply animate-pulse-glow"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      </div>

      {/* --- Light Glassmorphic Container --- */}
      <div className="relative z-10 w-full max-w-6xl rounded-3xl bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] flex flex-col lg:flex-row overflow-hidden animate-in zoom-in-95 duration-700">
        
        {/* Left Side - Brand & Visuals */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 lg:p-16 border-r border-white/60 relative">
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-slate-200 text-brand-teal text-xs font-bold tracking-widest uppercase mb-8 backdrop-blur-md shadow-sm">
              <Sparkles size={14} className="animate-pulse" />
              Next-Gen Biometric Attendance
            </div>
            
            <h1 className="text-5xl font-black text-slate-900 leading-[1.1] tracking-tight mb-6">
              Smart Attendance, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-indigo-600 to-blue-600">
                Empowered Teams.
              </span>
            </h1>
            
            <p className="text-lg text-slate-600 leading-relaxed font-medium max-w-md">
              Fast, anti-spoof facial recognition and complete employee self-service. View your daily punches, attendance analytics, and manage leaves seamlessly.
            </p>

            {/* Feature Highlights */}
            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                <span>Anti-Spoofing 3D/Texture Facial Recognition</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <CheckCircle2 size={18} className="text-indigo-500 shrink-0" />
                <span>Real-Time Employee Self-Service & Punch Tracking</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <CheckCircle2 size={18} className="text-blue-500 shrink-0" />
                <span>Automated Leave Requests & Instant Status Sync</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-5 p-5 rounded-2xl bg-white/70 border border-white/80 backdrop-blur-md mt-12 group hover:bg-white/90 transition-colors shadow-sm">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-brand-teal to-indigo-600 flex items-center justify-center shrink-0 shadow-[0_4px_15px_rgba(14,165,233,0.3)] group-hover:scale-105 transition-all">
              <ShieldCheck size={28} className="text-white" />
            </div>
            <div>
              <p className="text-slate-900 font-bold tracking-wide">Enterprise Biometric Privacy</p>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Encrypted tokenization & ISO-standard audit logs</p>
            </div>
          </div>
        </div>

        {/* Right Side - Form Container */}
        <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-14 flex flex-col justify-center relative bg-white/30">
          
          <div className="w-full max-w-md mx-auto">
            {/* Dynamic Logo & Name */}
            <div className="text-center mb-6">
              <div className="inline-block relative mb-4 group">
                <div className="absolute inset-0 bg-brand-teal/20 blur-2xl rounded-full scale-110 group-hover:scale-150 transition-transform duration-700 opacity-60"></div>
                <img 
                  src={logoUrl} 
                  alt="Company Logo" 
                  className="h-20 w-auto object-contain relative z-10 drop-shadow-sm mx-auto"
                />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {companyName}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Select your portal role to continue
              </p>
            </div>

            {/* --- Role Switcher Pill Tabs --- */}
            <div className="flex bg-slate-100/90 p-1.5 rounded-2xl mb-6 border border-slate-200/80 shadow-inner">
              <button
                type="button"
                onClick={() => { setLoginMode('EMPLOYEE'); setError(''); setEmpError(''); }}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                  loginMode === 'EMPLOYEE'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck size={16} />
                <span>Employee Portal</span>
              </button>
              
              <button
                type="button"
                onClick={() => { setLoginMode('HR'); setError(''); setEmpError(''); }}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                  loginMode === 'HR'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 size={16} />
                <span>HR & Admin</span>
              </button>
            </div>

            {/* ---------------- EMPLOYEE LOGIN FORM ---------------- */}
            {loginMode === 'EMPLOYEE' && (
              <div className="animate-in fade-in duration-300">
                {empError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-3.5 rounded-xl mb-5 text-xs sm:text-sm font-medium flex items-center gap-2.5 shadow-sm">
                    <AlertTriangle size={18} className="shrink-0 text-red-500" />
                    <span>{empError}</span>
                  </div>
                )}

                <form onSubmit={handleEmployeeLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 ml-1">
                      Employee ID / Badge No
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                        <BadgeCheck size={18} />
                      </div>
                      <input
                        type="text"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-white/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all duration-200 text-sm font-medium shadow-sm"
                        placeholder="e.g. 102 or EMP_001"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Password
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={autoFillEmpDemo102}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                          Demo (ID: 102)
                        </button>
                        <span className="text-slate-300">&bull;</span>
                        <button
                          type="button"
                          onClick={autoFillEmpDemo101}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline"
                        >
                          Demo (ID: 101)
                        </button>
                      </div>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                        <Lock size={18} />
                      </div>
                      <input
                        type={showEmpPassword ? 'text' : 'password'}
                        value={empPassword}
                        onChange={(e) => setEmpPassword(e.target.value)}
                        className="w-full pl-11 pr-12 py-3.5 bg-white/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all duration-200 text-sm font-medium shadow-sm"
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmpPassword(!showEmpPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showEmpPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Password helper note */}
                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 flex items-start gap-2">
                    <HelpCircle size={15} className="shrink-0 text-indigo-600 mt-0.5" />
                    <div>
                      <span className="font-bold">First time logging in?</span> Default password is <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200 text-indigo-700">password123</code> or your <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200 text-indigo-700">{'{ID}@123'}</code>. You can change it anytime in your portal.
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={empLoading}
                    className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    {empLoading ? (
                      <><RefreshCw className="animate-spin" size={18} /> Authenticating Employee...</>
                    ) : (
                      <>Sign In to Employee Portal <ArrowRight size={18} /></>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ---------------- HR / ADMIN LOGIN FORM ---------------- */}
            {loginMode === 'HR' && (
              <div className="animate-in fade-in duration-300">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-3.5 rounded-xl mb-5 text-xs sm:text-sm font-medium flex items-center gap-2.5 shadow-sm">
                    <AlertTriangle size={18} className="shrink-0 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 ml-1">
                      Admin Username
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-teal transition-colors">
                        <User size={18} />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-white/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-4 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all duration-200 text-sm font-medium shadow-sm"
                        placeholder="Enter admin username"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Password
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={autoFillAdminDemo}
                          className="text-[11px] font-semibold text-brand-teal hover:text-brand-blue hover:underline"
                        >
                          HR Admin Demo
                        </button>
                        <span className="text-slate-300">&bull;</span>
                        <button
                          type="button"
                          onClick={autoFillSuperAdminDemo}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          Super Admin Demo
                        </button>
                      </div>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-teal transition-colors">
                        <Lock size={18} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-11 pr-12 py-3.5 bg-white/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-4 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all duration-200 text-sm font-medium shadow-sm"
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
                    className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    {loading ? (
                      <><RefreshCw className="animate-spin" size={18} /> Authenticating Admin...</>
                    ) : (
                      <>Sign In to HR Dashboard <ArrowRight size={18} /></>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Quick Actions Footer */}
            <div className="mt-8 pt-6 border-t border-slate-200/60 space-y-2">
              <button
                type="button"
                onClick={() => setShowKioskModal(true)}
                className="w-full py-3 px-4 bg-white/70 hover:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 hover:text-slate-900 font-semibold transition-all shadow-sm flex items-center justify-center gap-2 group"
              >
                <Camera size={16} className="text-brand-teal group-hover:scale-110 transition-transform" />
                <span>Open Standalone Gate Terminal</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/attendance-query')}
                className="w-full py-3 px-4 bg-amber-50/80 hover:bg-amber-100 border border-amber-200/80 rounded-xl text-xs sm:text-sm text-amber-900 font-bold transition-all shadow-sm flex items-center justify-center gap-2 group"
              >
                <FileQuestion size={16} className="text-amber-600 group-hover:scale-110 transition-transform" />
                <span>Marked Absent by Mistake? Employee Dispute Desk</span>
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

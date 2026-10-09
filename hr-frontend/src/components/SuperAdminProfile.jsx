import React, { useState, useEffect } from 'react';
import { 
  Key, Lock, Eye, EyeOff, Save, CheckCircle2, 
  AlertCircle, Clock, Globe, ShieldCheck, User, Mail, 
  Phone, RefreshCw, Activity, Terminal, AlertTriangle, LogOut
} from 'lucide-react';
import { apiCall } from '../api';

export default function SuperAdminProfile() {
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [securityData, setSecurityData] = useState(null);
  const [error, setError] = useState(null);

  // Profile Form state
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    phone: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);

  // Password Form state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall('/super-admin/profile');
      if (res.status === 'success') {
        setProfileData(res.profile);
        setSessionData(res.session);
        setSecurityData(res.security);
        setProfileForm({
          full_name: res.profile.full_name || '',
          email: res.profile.email || '',
          phone: res.profile.phone || ''
        });
      }
    } catch (err) {
      console.error('Failed to load super admin profile:', err);
      setError(err.message || 'Unable to fetch profile details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(null);
    setError(null);

    try {
      const res = await apiCall('/super-admin/profile', {
        method: 'PUT',
        body: JSON.stringify(profileForm)
      });
      setProfileData(prev => ({ ...prev, ...res.profile }));
      setProfileSuccess('Super Admin profile updated successfully!');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (passwordForm.current_password === passwordForm.new_password) {
      setPasswordError('New password must be different from current password.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await apiCall('/super-admin/change-password', {
        method: 'PUT',
        body: JSON.stringify(passwordForm)
      });

      if (res.token) {
        localStorage.setItem('token', res.token);
      }

      setPasswordSuccess('Super Admin password updated successfully! Your active session has been renewed.');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      setTimeout(() => setPasswordSuccess(null), 5000);
      fetchProfile();
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  // Helper to format remaining time
  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds <= 0) return 'Expired';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  if (loading && !profileData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[460px] bg-white rounded-2xl border border-gray-200 p-12">
        <div className="w-12 h-12 rounded-2xl bg-brand-navy/10 text-brand-navy flex items-center justify-center animate-spin mb-4">
          <RefreshCw size={24} />
        </div>
        <h3 className="text-base font-bold text-gray-800">Verifying Security Session...</h3>
        <p className="text-xs text-gray-400 mt-1">Retrieving root profile credentials and active session token parameters.</p>
      </div>
    );
  }

  const isPasswordLengthOk = passwordForm.new_password.length >= 8;
  const isPasswordMatch = passwordForm.new_password && passwordForm.new_password === passwordForm.confirm_password;
  const isDifferentFromCurrent = passwordForm.new_password && passwordForm.new_password !== passwordForm.current_password;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">

      {/* TOP HEADER */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-navy to-brand-dark text-white flex items-center justify-center shadow-md">
            <ShieldCheck size={24} className="text-brand-teal" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              Super Admin Profile & Security
              <span className="text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Root Access
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 font-medium">
              Manage root administrator account credentials, update contact information, and inspect active session integrity.
            </p>
          </div>
        </div>

        <button
          onClick={fetchProfile}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors w-full sm:w-auto"
        >
          <RefreshCw size={14} />
          Refresh Session
        </button>
      </div>

      {/* ERROR / SUCCESS ALERTS */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm shadow-sm">
          <AlertCircle size={18} className="flex-shrink-0 text-red-500" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {profileSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm shadow-sm animate-in slide-in-from-top-2">
          <CheckCircle2 size={18} className="flex-shrink-0 text-emerald-600" />
          <span className="font-semibold">{profileSuccess}</span>
        </div>
      )}

      {/* MAIN 2-COLUMN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* LEFT COLUMN: PROFILE CARD & PASSWORD CHANGE (7 COLS) */}
        <div className="xl:col-span-7 space-y-6">

          {/* 1. ROOT ACCOUNT IDENTITY & PROFILE FORM */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <User size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Account Identity & Information</h3>
                <p className="text-xs text-gray-500">Root credentials and system administrator contact information.</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Username (Read Only) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Root Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <span className="font-mono text-xs font-bold">@</span>
                    </div>
                    <input
                      type="text"
                      disabled
                      value={profileData?.username || ''}
                      className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-gray-600 cursor-not-allowed select-none"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">Root system identifier is permanent.</span>
                </div>

                {/* Display Full Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Administrator Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.full_name}
                    onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="e.g. System Super Admin"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all font-medium"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Contact Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Mail size={14} />
                    </div>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                      placeholder="superadmin@example.com"
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Emergency Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Phone size={14} />
                    </div>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all font-medium"
                    />
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-navy to-brand-dark text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-sm active:scale-95 disabled:opacity-60"
                >
                  {savingProfile ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {savingProfile ? 'Saving Changes...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>

          {/* 2. PASSWORD CHANGE FORM */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Key size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Change Super Admin Password</h3>
                <p className="text-xs text-gray-500">Update your root master password to prevent unauthorized administrative access.</p>
              </div>
            </div>

            {passwordError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={15} className="flex-shrink-0 text-red-500" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-600" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock size={14} />
                  </div>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={passwordForm.current_password}
                    onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    placeholder="Enter existing password"
                    className="w-full pl-9 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* New Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* New Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    New Master Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Key size={14} />
                    </div>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.new_password}
                      onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      placeholder="At least 8 characters"
                      className="w-full pl-9 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Key size={14} />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.confirm_password}
                      onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      placeholder="Re-enter new password"
                      className="w-full pl-9 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

              </div>

              {/* Password Requirement Checklist */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                <span className="font-bold text-gray-700 text-[11px] uppercase tracking-wide block">Password Requirements:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className={`flex items-center gap-1.5 ${isPasswordLengthOk ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                    <CheckCircle2 size={13} />
                    <span>8+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${isPasswordMatch ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                    <CheckCircle2 size={13} />
                    <span>Passwords match</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${isDifferentFromCurrent ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                    <CheckCircle2 size={13} />
                    <span>Different from current</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingPassword || !passwordForm.current_password || !passwordForm.new_password}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-teal hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {savingPassword ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                  {savingPassword ? 'Updating Password...' : 'Update Master Password'}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: ACTIVE SESSION & SECURITY INSPECTOR (5 COLS) */}
        <div className="xl:col-span-5 space-y-6">

          {/* ACTIVE SESSION INSPECTOR CARD */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <Clock size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Active Session Telemetry</h3>
                <p className="text-xs text-gray-500">Live JSON Web Token (JWT) session status and client footprint.</p>
              </div>
            </div>

            {/* Session Expiry Meter */}
            <div className="p-4 bg-gradient-to-br from-slate-900 to-brand-navy rounded-2xl text-white space-y-3 shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-brand-teal/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300">Session Status</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Token
                </span>
              </div>

              <div>
                <span className="text-2xl font-black text-white tracking-tight block">
                  {formatTimeRemaining(sessionData?.time_remaining_seconds)}
                </span>
                <span className="text-[11px] text-slate-400">
                  Remaining until automatic expiration and mandatory re-authentication
                </span>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Algorithm: {sessionData?.algorithm || 'HS256'}</span>
                <span>Role: {sessionData?.role || 'SUPER_ADMIN'}</span>
              </div>
            </div>

            {/* Client Footprint Details */}
            <div className="space-y-3 text-xs">
              
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <Globe size={15} className="text-slate-400" />
                  <span className="font-semibold">Client Origin IP</span>
                </div>
                <span className="font-mono font-bold text-gray-900">{sessionData?.client_ip || 'Unknown'}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2 text-slate-600">
                  <Terminal size={15} className="text-slate-400" />
                  <span className="font-semibold">User-Agent Signature</span>
                </div>
                <p className="text-[11px] font-mono text-slate-500 break-all leading-relaxed">
                  {sessionData?.user_agent || 'Unknown'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock size={15} className="text-slate-400" />
                  <span className="font-semibold">Token Expires At</span>
                </div>
                <span className="font-mono text-gray-800 text-[11px]">
                  {sessionData?.expires_at ? new Date(sessionData.expires_at).toLocaleString() : 'N/A'}
                </span>
              </div>

            </div>
          </div>

          {/* AUDIT & SECURITY REPUTATION */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Activity size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Administrative Audit Footprint</h3>
                <p className="text-xs text-gray-500">Actions executed by this Super Admin ID (#{profileData?.id}).</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Actions</span>
                <span className="text-2xl font-black text-gray-900 mt-1 block">
                  {securityData?.total_audit_actions ?? 0}
                </span>
                <span className="text-[10px] text-slate-500">logged in audit vault</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Account Status</span>
                <span className="text-sm font-bold text-emerald-600 mt-2 block capitalize">
                  {profileData?.status || 'Active'}
                </span>
                <span className="text-[10px] text-slate-500">Full system authority</span>
              </div>
            </div>

            {securityData?.last_action_type && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-700 text-[11px]">Most Recent Audit Event:</span>
                  <span className="px-2 py-0.2 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">
                    {securityData.last_action_type}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed truncate">
                  {securityData.last_action_details}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {securityData.last_action_time ? new Date(securityData.last_action_time).toLocaleString() : ''}
                </p>
              </div>
            )}
          </div>

          {/* LOGOUT / SESSION TERMINATION */}
          <div className="bg-red-50/50 rounded-2xl border border-red-200/80 p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle size={16} className="text-red-500" />
              <h4 className="font-bold text-xs uppercase tracking-wider">Session Termination</h4>
            </div>
            <p className="text-xs text-red-700 leading-relaxed">
              Logging out will invalidate your client-stored authentication token on this device.
            </p>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to end your Super Admin session and log out?')) {
                  localStorage.removeItem('token');
                  localStorage.removeItem('role');
                  window.location.href = '/login';
                }
              }}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <LogOut size={14} />
              Terminate Super Admin Session
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}

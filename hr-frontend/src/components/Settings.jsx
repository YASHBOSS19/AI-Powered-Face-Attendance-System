import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Image as ImageIcon, Clock, Save, Upload, Sparkles, CheckCircle2, 
  AlertCircle, Briefcase, Mail, Phone, Calendar, ShieldCheck, UserCheck, ExternalLink, 
  Camera, RefreshCw, X, Key, Eye, EyeOff, Check, Layers, ArrowUpRight, HelpCircle,
  Lock, Laptop, Shield
} from 'lucide-react';
import { apiCall } from '../api';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('branding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Organization / Profile states
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('Technology & IT');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('HR');
  const [status, setStatus] = useState('active');
  const [createdAt, setCreatedAt] = useState('');
  const [modules, setModules] = useState(['overview', 'employees', 'kiosk', 'reports', 'unknown_identity']);
  
  // Logo & Schedule states
  const [logoUrl, setLogoUrl] = useState('');
  const [workingDays, setWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [lateThresholdTime, setLateThresholdTime] = useState('10:00');
  
  // Security / Password update states
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const fileInputRef = useRef(null);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const industriesList = [
    'Technology & IT',
    'Education & University',
    'Healthcare & Medical',
    'Manufacturing & Industrial',
    'Finance & Banking',
    'Retail & Commerce',
    'Professional Services',
    'Government & Public',
    'Hospitality & Tourism',
    'Other'
  ];

  const availableModulesList = [
    { id: 'overview', name: 'Dashboard Overview', desc: 'Real-time metrics, live stats, and charts', icon: <Building2 size={16} /> },
    { id: 'employees', name: 'Employee Directory & Biometrics', desc: 'Face enrollment and staff records', icon: <UserCheck size={16} /> },
    { id: 'kiosk', name: 'Live Face Recognition Kiosk & Gate', desc: 'Biometric AI face scanning terminal', icon: <Camera size={16} /> },
    { id: 'reports', name: 'Attendance Reports & Analytics', desc: 'Monthly logs, PDF & Excel export', icon: <Calendar size={16} /> },
    { id: 'unknown_identity', name: 'Unknown Face Intrusion Alerts', desc: 'Unregistered face real-time alerts', icon: <Shield size={16} /> },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/settings/');
      if (data.companyName) setCompanyName(data.companyName);
      if (data.industry) setIndustry(data.industry);
      if (data.email) setEmail(data.email);
      if (data.phone) setPhone(data.phone);
      if (data.username) setUsername(data.username);
      if (data.role) setRole(data.role);
      if (data.status) setStatus(data.status);
      if (data.createdAt) setCreatedAt(data.createdAt);
      if (data.logoUrl) setLogoUrl(data.logoUrl);
      if (data.workingDays) setWorkingDays(data.workingDays);
      if (data.lateThresholdTime) setLateThresholdTime(data.lateThresholdTime);
      if (data.modules) setModules(data.modules);
    } catch (err) {
      console.error("Failed to load settings", err);
      setError(err.message || 'Failed to load organization settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const data = {
        companyName: companyName.trim(),
        industry,
        email: email.trim(),
        phone: phone.trim(),
        logoUrl,
        workingDays,
        lateThresholdTime,
        modules
      };

      if (newPassword.trim()) {
        data.new_password = newPassword.trim();
      }

      await apiCall('/settings/', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      // Clear password field after successful update
      setNewPassword('');

      // Dispatch global event so header and title update immediately
      window.dispatchEvent(new CustomEvent('settingsUpdated', { 
        detail: { companyName, logoUrl } 
      }));

      // Update document title
      document.title = `${companyName} Portal`;

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error("Failed to save settings", err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDayToggle = (day) => {
    setWorkingDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleModuleToggle = (modId) => {
    setModules(prev => 
      prev.includes(modId) ? prev.filter(m => m !== modId) : [...prev, modId]
    );
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Logo file size should be under 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await apiCall('/settings/logo', {
        method: 'POST',
        body: formData
      });
      if (data.logoUrl) {
        setLogoUrl(data.logoUrl);
        window.dispatchEvent(new CustomEvent('settingsUpdated', { 
          detail: { companyName, logoUrl: data.logoUrl } 
        }));
      }
    } catch (err) {
      console.error('Error uploading logo:', err);
      alert(err.message || 'Error uploading logo');
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setShowPassword(true);
  };

  if (loading) {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <RefreshCw className="animate-spin text-brand-teal" size={22} />
          Loading workspace profile & rules...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Top Banner & Header with Integrated Logo & Upload Controls */}
      <div className="bg-gradient-to-r from-brand-navy via-brand-dark to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-brand-teal/20">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-brand-teal/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-brand-blue/15 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          
          {/* Logo + Company Title & Subtitle + Upload Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Logo Avatar Box */}
            <div className="relative group">
              <div className="h-20 w-20 md:h-24 md:w-24 rounded-2xl bg-white p-2 flex items-center justify-center overflow-hidden shrink-0 shadow-lg border-2 border-white/20">
                {logoUrl ? (
                  <img src={logoUrl} alt="Company Logo" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Building2 size={32} />
                    <span className="text-[9px] font-bold uppercase mt-1">No Logo</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                title="Change Logo"
              >
                <Upload size={18} />
                <span className="text-[10px] font-bold mt-1">Change</span>
              </button>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              className="hidden"
            />

            {/* Text and Quick Actions */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-0.5 bg-brand-teal/20 border border-brand-teal/30 text-brand-teal rounded-full text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5">
                  <Sparkles size={11} />
                  Admin Workspace
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-full text-[11px] font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Tenant
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                {companyName || 'Organization Configuration'}
              </h1>

              <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-normal leading-relaxed">
                Configure your organization branding, biometrics policy, operating shifts, contact info, and admin security credentials.
              </p>

              {/* Action Buttons below text */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-cyan-300 hover:text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Upload size={13} />
                  {logoUrl ? 'Change Brand Logo' : 'Upload Brand Logo'}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrl('');
                      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { companyName, logoUrl: '' } }));
                    }}
                    className="px-3 py-1.5 text-red-300 hover:text-red-100 hover:bg-red-500/20 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Remove Logo
                  </button>
                )}
                <span className="text-[11px] text-slate-400 hidden sm:inline-block">
                  (PNG / SVG / JPG, Max 5MB)
                </span>
              </div>
            </div>
          </div>

          {/* Right Top Action */}
          <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-teal to-emerald-500 hover:from-brand-teal hover:to-emerald-400 text-slate-950 font-black rounded-xl shadow-lg hover:shadow-cyan-500/25 transition-all active:scale-[0.98] disabled:opacity-60 text-sm tracking-wide cursor-pointer"
            >
              {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="relative z-10 flex flex-wrap gap-2 mt-6 pt-5 border-t border-white/10">
          {[
            { id: 'branding', label: 'Company Profile & Branding', icon: <Building2 size={15} /> },
            { id: 'attendance', label: 'Attendance & Operating Shifts', icon: <Clock size={15} /> },
            { id: 'modules', label: 'Enabled Features & Modules', icon: <Layers size={15} /> },
            { id: 'security', label: 'Account Credentials & Security', icon: <ShieldCheck size={15} /> },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-md font-extrabold scale-100'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Notifications */}
      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-4 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold">Settings Saved Successfully!</p>
              <p className="text-xs text-emerald-600">All portal headers, branding assets, and attendance calculations have been synchronized.</p>
            </div>
          </div>
          <button onClick={() => setSavedSuccess(false)} className="text-emerald-500 hover:text-emerald-700">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-500 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold">Failed to Save</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Grid: Settings Content (8 Cols) + Live Portal Sticky Card (4 Cols) */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 Cols): Tab Panels */}
        <div className="lg:col-span-8 space-y-6">

          {/* TAB 1: Company Profile & Branding */}
          {activeTab === 'branding' && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
                <div className="w-11 h-11 rounded-2xl bg-cyan-50 text-cyan-700 flex items-center justify-center shadow-xs">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Organization Profile Details</h3>
                  <p className="text-xs text-slate-500 font-medium">Update company name, sector domain, email, and contact phone.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Company / Organization Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Building2 size={16} />
                    </div>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all shadow-xs"
                      placeholder="e.g. KVON TECHNOLOGIES"
                    />
                  </div>
                </div>

                {/* Industry / Domain */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Industry / Domain</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Briefcase size={16} />
                    </div>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all cursor-pointer shadow-xs"
                    >
                      {industriesList.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Official Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Official Contact Email</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all shadow-xs"
                      placeholder="admin@kvontech.com"
                    />
                  </div>
                </div>

                {/* Contact Phone Number */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Support / Phone Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone size={16} />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all shadow-xs"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Attendance & Operating Shifts */}
          {activeTab === 'attendance' && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shadow-xs">
                  <Clock size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Attendance Policies & Operating Schedule</h3>
                  <p className="text-xs text-slate-500 font-medium">Define weekly working days, weekend exclusions, and late arrival threshold.</p>
                </div>
              </div>

              {/* Working Days Selector */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Weekly Operational Working Days
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])}
                      className="text-xs font-bold text-slate-600 hover:text-brand-teal bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition-colors"
                    >
                      5-Day (Mon–Fri)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])}
                      className="text-xs font-bold text-slate-600 hover:text-brand-teal bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition-colors"
                    >
                      6-Day (Mon–Sat)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
                  {daysOfWeek.map(day => {
                    const isSelected = workingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayToggle(day)}
                        className={`py-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-gradient-to-b from-brand-teal to-brand-blue text-white shadow-md scale-100'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        <span>{day}</span>
                        <span className={`text-[10px] font-normal ${isSelected ? 'text-cyan-100' : 'text-slate-400'}`}>
                          {isSelected ? 'Work' : 'Off'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400">
                  Unselected days are automatically treated as holidays / weekends and excluded from absenteeism penalties.
                </p>
              </div>

              {/* Late Threshold */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Late Check-In Cutoff Time
                </label>
                <div className="relative w-full sm:w-[320px]">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Clock size={16} />
                  </div>
                  <input
                    type="time"
                    value={lateThresholdTime}
                    onChange={(e) => setLateThresholdTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all shadow-xs font-mono"
                  />
                </div>
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-800 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    Staff checking in via facial recognition after <strong className="font-bold font-mono">{lateThresholdTime}</strong> will automatically be tagged with the <span className="font-bold text-amber-900">"Late"</span> status badge in daily logs and monthly summaries.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Enabled Modules */}
          {activeTab === 'modules' && (
            <div className="bg-white border border-slate-200/90 p-6 md:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
                <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shadow-xs">
                  <Layers size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Workspace Features & Modules</h3>
                  <p className="text-xs text-slate-500 font-medium">Manage enabled features for your organization workspace.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableModulesList.map(mod => {
                  const isChecked = modules.includes(mod.id);
                  return (
                    <div
                      key={mod.id}
                      onClick={() => handleModuleToggle(mod.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isChecked 
                          ? 'border-brand-teal bg-cyan-50/40 shadow-xs' 
                          : 'border-slate-200 bg-slate-50/60 opacity-60'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-lg ${isChecked ? 'bg-brand-teal text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {mod.icon}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900">{mod.name}</h4>
                        </div>
                        <p className="text-[11px] text-slate-500">{mod.desc}</p>
                      </div>

                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                        isChecked ? 'bg-brand-teal border-brand-teal text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isChecked && <Check size={14} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Security & Account Credentials */}
          {activeTab === 'security' && (
            <div className="bg-white border border-slate-200/90 p-6 md:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shadow-xs">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Admin Account & Security Credentials</h3>
                  <p className="text-xs text-slate-500 font-medium">Manage your login username, password credentials, and security profile.</p>
                </div>
              </div>

              {/* Account Metadata Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Login Username</span>
                  <p className="text-sm font-black text-slate-900 mt-1 font-mono">@{username || 'admin'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Account Role</span>
                  <p className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                    <UserCheck size={14} className="text-brand-teal" />
                    {role} Administrator
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Account Health</span>
                  <p className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {status === 'active' ? 'Active & Healthy' : status}
                  </p>
                </div>
              </div>

              {/* Change Password Section */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Key size={16} className="text-brand-teal" />
                      Update Account Password
                    </h4>
                    <p className="text-xs text-slate-500">Leave blank if you do not wish to change your current password.</p>
                  </div>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-xs font-bold text-brand-navy hover:text-brand-teal bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Sparkles size={13} />
                    Generate Strong Password
                  </button>
                </div>

                <div className="relative w-full sm:w-[380px]">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="w-full pl-10 pr-12 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {newPassword && (
                  <div className="p-3 bg-cyan-50 border border-brand-teal/30 rounded-xl text-xs text-cyan-900 font-medium">
                    New password entered. Click <strong>"Save All Settings"</strong> to apply changes.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Column (4 Cols): Live Workspace Preview Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-6 space-y-4">
            
            <div className="bg-gradient-to-br from-slate-900 via-brand-navy to-slate-950 text-white rounded-3xl p-6 shadow-2xl border border-slate-800 space-y-6 relative overflow-hidden">
              
              {/* Background Glow */}
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-brand-teal/20 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10 flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold tracking-wider uppercase text-cyan-300">
                  <Sparkles size={12} />
                  Live Portal Preview
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Online
                </span>
              </div>

              {/* Live Brand Card */}
              <div className="relative z-10 bg-white/10 backdrop-blur-lg border border-white/15 rounded-2xl p-5 space-y-4 shadow-inner">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white p-1.5 flex items-center justify-center flex-shrink-0 shadow-md">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 size={30} className="text-slate-700" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-base font-black text-white tracking-tight truncate">
                      {companyName || 'Your Organization'}
                    </h4>
                    <p className="text-xs text-cyan-300 font-medium truncate">
                      {industry || 'Technology & IT'}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Shift Cutoff Time:</span>
                    <strong className="text-white font-mono">{lateThresholdTime}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Operating Schedule:</span>
                    <strong className="text-cyan-300">{workingDays.length} Working Days</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Active Days:</span>
                    <span className="text-slate-300 font-medium text-[11px] truncate max-w-[140px]">{workingDays.join(', ')}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Enabled Modules:</span>
                    <span className="text-emerald-300 font-bold">{modules.length} Active</span>
                  </div>
                </div>
              </div>

              {/* Quick Launch Terminal Link */}
              <div className="relative z-10 pt-1">
                <a
                  href="/gate"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl text-xs text-cyan-300 font-bold transition-all flex items-center justify-center gap-2 group shadow-sm"
                >
                  <Camera size={15} className="group-hover:scale-110 transition-transform" />
                  <span>Launch Live Attendance Gate</span>
                  <ArrowUpRight size={14} className="text-slate-400 group-hover:text-cyan-300" />
                </a>
              </div>

              {/* Save Trigger in Sticky Card */}
              <div className="relative z-10 pt-2 border-t border-white/10">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-gradient-to-r from-brand-teal to-emerald-500 hover:from-brand-teal hover:to-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                  {saving ? 'Saving...' : 'Apply & Save Settings'}
                </button>
              </div>

            </div>

          </div>
        </div>

      </form>
    </div>
  );
}
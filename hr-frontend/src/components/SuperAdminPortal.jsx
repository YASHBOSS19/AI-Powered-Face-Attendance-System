import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, Plus, Trash2, LogIn, Activity, AlertCircle, X, ArrowLeft, 
  Building2, Calendar, Clock, ShieldCheck, UserCheck, Eye, EyeOff, Sparkles, CheckCircle2, ChevronRight,
  Ban, CheckCircle, AlertTriangle, Key, Mail, Phone, Upload, RefreshCw, Briefcase, Layers, Check, Image as ImageIcon,
  Edit3, Save, Sliders, Crown, Zap, CreditCard, Award, ArrowUpRight
} from 'lucide-react';
import { apiCall } from '../api';
import GlobalAnalyticsDashboard from './GlobalAnalyticsDashboard';
import AuditLogViewer from './AuditLogViewer';
import SuperAdminProfile from './SuperAdminProfile';
import AlertsCenter from './AlertsCenter';
import PlanSettingsManager from './PlanSettingsManager';

export const subscriptionPlansList = [
  {
    id: 'free',
    name: 'Free Plan',
    tagline: 'Essential biometric attendance for small teams & testing',
    seats: 10,
    price: '$0',
    price_monthly: 0,
    price_annual: 0,
    period: 'forever',
    color: 'slate',
    badge: 'Free Starter',
    accentColor: 'border-slate-300 text-slate-700 bg-slate-50',
    pillBg: 'bg-slate-100 text-slate-700 border-slate-200',
    features: ['Up to 10 Employee Seats', 'Real-Time Face Kiosk Check-In', 'Core Staff Profiles & Directory', 'Daily Check-In & Out Logs', 'Standard Community Support'],
    defaultModules: ['overview', 'employees', 'kiosk']
  },
  {
    id: 'basic',
    name: 'Basic Plan',
    tagline: 'Full biometric tracking & reporting for growing businesses',
    seats: 50,
    price: '$49',
    price_monthly: 49,
    price_annual: 470,
    period: '/month',
    color: 'blue',
    badge: 'Most Popular',
    isPopular: true,
    accentColor: 'border-blue-400 text-blue-700 bg-blue-50/70',
    pillBg: 'bg-blue-50 text-blue-700 border-blue-200',
    features: ['Up to 50 Employee Seats (Configurable)', 'Face Biometric AI Vector Recognition', 'Interactive Kiosk + Gate Access', 'Department Attendance Reports & CSV Export', 'Unknown Identity Intruder Capture & Alerts', 'Automatic Headcount Limit Warnings (≥80%)'],
    defaultModules: ['overview', 'employees', 'kiosk', 'reports', 'unknown_identity']
  },
  {
    id: 'enterprise',
    name: 'Enterprise Plan',
    tagline: 'Unlimited scale, turnstile hardware relay, audit trail & dedicated SLA',
    seats: 500,
    price: '$299',
    price_monthly: 299,
    price_annual: 2870,
    period: '/month',
    color: 'amber',
    badge: 'Enterprise Scale',
    isRecommended: true,
    accentColor: 'border-amber-400 text-amber-800 bg-amber-50/70',
    pillBg: 'bg-amber-50 text-amber-800 border-amber-200',
    features: ['500+ Employee Seats (Custom Expandable)', 'Dedicated Biometric Vector Indexing', 'Hardware Turnstile Gate Relay Control', 'Advanced System Thresholds & Settings', 'Complete Platform Audit Trail Logs', 'Custom Late Thresholds & 24/7 Priority SLA'],
    defaultModules: ['overview', 'employees', 'kiosk', 'reports', 'unknown_identity', 'gate', 'settings']
  }
];

export default function SuperAdminPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const activeTab = search.get('tab') || 'analytics';
  const selectedUserId = search.get('id');
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  
  // Dynamic Global Subscription Plans State
  const [livePlans, setLivePlans] = useState(subscriptionPlansList);

  // Data states
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Form states for Create HR Admin
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    company_name: '',
    email: '',
    phone: '',
    industry: 'Technology & IT',
    logo_base64: '',
    working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    late_threshold_time: '10:00',
    status: 'active',
    plan_id: 'basic',
    plan_name: 'Basic Plan',
    billing_cycle: 'monthly',
    max_employees: 50,
    modules: ['overview', 'employees', 'kiosk', 'reports', 'unknown_identity']
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Edit Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    username: '',
    company_name: '',
    email: '',
    phone: '',
    industry: 'Technology & IT',
    logo_base64: '',
    current_logo_url: '',
    working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    late_threshold_time: '10:00',
    status: 'active',
    new_password: '',
    plan_id: 'basic',
    plan_name: 'Basic Plan',
    billing_cycle: 'monthly',
    subscription_status: 'active',
    max_employees: 50,
    modules: ['overview', 'employees', 'kiosk', 'reports', 'unknown_identity']
  });

  const daysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const industriesList = [
    'Technology & IT',
    'Education & University',
    'Healthcare & Medical',
    'Manufacturing & Industrial',
    'Finance & Banking',
    'Retail & Commerce',
    'Professional Services',
    'Government & Public',
    'Other'
  ];

  const availableModules = [
    { id: 'overview', name: 'Dashboard Overview', desc: 'Real-time metrics & summaries' },
    { id: 'employees', name: 'Employee Directory', desc: 'Face enrollment & staff profiles' },
    { id: 'kiosk', name: 'Live Face Kiosk & Gate', desc: 'Biometric face scan check-in' },
    { id: 'reports', name: 'Reports & Analytics', desc: 'Monthly logs, PDF/Excel export' },
    { id: 'unknown_identity', name: 'Unknown Face Alert', desc: 'Unregistered intruder alerts' },
    { id: 'gate', name: 'Gate Relay Control', desc: 'Turnstile & door hardware unlock' },
    { id: 'settings', name: 'Advanced Settings', desc: 'System thresholds & configurations' },
  ];

  const fetchGlobalPlans = async () => {
    try {
      const data = await apiCall('/super-admin/plans');
      if (data.status === 'success' && data.plans && data.plans.length >= 3) {
        const mapped = data.plans.map(p => {
          const fallback = subscriptionPlansList.find(f => f.id === p.id) || {};
          return {
            ...fallback,
            ...p,
            seats: Number(p.max_employees) || fallback.seats || 50,
            price: `$${p.price_monthly}`,
            period: p.price_monthly === 0 ? 'forever' : '/month',
            defaultModules: p.default_modules || fallback.defaultModules || ['overview', 'employees', 'kiosk']
          };
        });
        setLivePlans(mapped);
      }
    } catch (e) {
      console.warn('Failed to fetch live global plans:', e);
    }
  };

  useEffect(() => {
    fetchGlobalPlans();
  }, []);

  const getPlanMeta = (planId, maxEmployees) => {
    const listToSearch = livePlans.length > 0 ? livePlans : subscriptionPlansList;
    if (planId) {
      const found = listToSearch.find(p => p.id === planId);
      if (found) return found;
    }
    const maxEmp = maxEmployees || 50;
    if (maxEmp >= 500) return listToSearch.find(p => p.id === 'enterprise') || listToSearch[2];
    if (maxEmp >= 50) return listToSearch.find(p => p.id === 'basic') || listToSearch[1];
    return listToSearch.find(p => p.id === 'free') || listToSearch[0];
  };

  useEffect(() => {
    if (activeTab === 'user-detail' && selectedUserId) {
      fetchUserDetails(selectedUserId);
    } else {
      fetchData();
    }
  }, [activeTab, selectedUserId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'users') {
        const data = await apiCall('/super-admin/users');
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId) => {
    setDetailLoading(true);
    setError(null);
    try {
      const data = await apiCall(`/super-admin/users/${userId}`);
      setSelectedUser(data.user);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch admin details');
    } finally {
      setDetailLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUser(prev => ({ ...prev, password: pwd }));
    setShowPassword(true);
  };

  const generateEditPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEditForm(prev => ({ ...prev, new_password: pwd }));
    setShowEditPassword(true);
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Logo file size should be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewUser(prev => ({ ...prev, logo_base64: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleEditLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Logo file size should be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditForm(prev => ({ ...prev, logo_base64: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleDayToggle = (day) => {
    setNewUser(prev => {
      const exists = prev.working_days.includes(day);
      return {
        ...prev,
        working_days: exists 
          ? prev.working_days.filter(d => d !== day)
          : [...prev.working_days, day]
      };
    });
  };

  const handleEditDayToggle = (day) => {
    setEditForm(prev => {
      const exists = prev.working_days.includes(day);
      return {
        ...prev,
        working_days: exists 
          ? prev.working_days.filter(d => d !== day)
          : [...prev.working_days, day]
      };
    });
  };

  const handleModuleToggle = (modId) => {
    setNewUser(prev => {
      const exists = prev.modules.includes(modId);
      return {
        ...prev,
        modules: exists
          ? prev.modules.filter(m => m !== modId)
          : [...prev.modules, modId]
      };
    });
  };

  const handleEditModuleToggle = (modId) => {
    setEditForm(prev => {
      const exists = prev.modules.includes(modId);
      return {
        ...prev,
        modules: exists
          ? prev.modules.filter(m => m !== modId)
          : [...prev.modules, modId]
      };
    });
  };

  const openEditModal = (user) => {
    const userSettings = user.settings || {};
    const maxEmp = user.max_employees || userSettings.maxEmployees || 50;
    const planId = user.plan_id || userSettings.planId || (maxEmp >= 500 ? 'enterprise' : maxEmp >= 50 ? 'basic' : 'free');
    const matched = livePlans.find(p => p.id === planId) || subscriptionPlansList.find(p => p.id === planId);
    const planName = user.plan_name || userSettings.planName || (matched ? matched.name : 'Basic Plan');

    setEditForm({
      id: user.id,
      username: user.username,
      company_name: user.company_name || user.full_name || '',
      email: user.email || '',
      phone: user.phone || userSettings.phone || '',
      industry: user.industry || userSettings.industry || 'Technology & IT',
      logo_base64: '',
      current_logo_url: user.logo_url || userSettings.logoUrl || '',
      working_days: user.working_days || userSettings.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      late_threshold_time: user.late_threshold_time || userSettings.lateThresholdTime || '10:00',
      status: user.status || 'active',
      new_password: '',
      plan_id: planId,
      plan_name: planName,
      billing_cycle: user.billing_cycle || userSettings.billingCycle || 'monthly',
      subscription_status: user.subscription_status || userSettings.subscriptionStatus || 'active',
      max_employees: maxEmp,
      modules: user.permissions || userSettings.modules || (matched?.defaultModules || ['overview', 'employees', 'kiosk', 'reports', 'unknown_identity'])
    });
    setEditModalOpen(true);
  };

  const handleSelectPlanForEdit = (plan) => {
    setEditForm(prev => ({
      ...prev,
      plan_id: plan.id,
      plan_name: plan.name,
      max_employees: plan.seats || plan.max_employees || 50,
      modules: plan.defaultModules ? [...plan.defaultModules] : (plan.default_modules ? [...plan.default_modules] : prev.modules)
    }));
  };

  const handleSelectPlanForNew = (plan) => {
    setNewUser(prev => ({
      ...prev,
      plan_id: plan.id,
      plan_name: plan.name,
      max_employees: plan.seats || plan.max_employees || 50,
      modules: plan.defaultModules ? [...plan.defaultModules] : (plan.default_modules ? [...plan.default_modules] : prev.modules)
    }));
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setEditing(true);
    setError(null);
    try {
      const payload = {
        company_name: editForm.company_name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        industry: editForm.industry,
        logo_base64: editForm.logo_base64 || null,
        working_days: editForm.working_days,
        late_threshold_time: editForm.late_threshold_time,
        status: editForm.status,
        plan_id: editForm.plan_id,
        plan_name: editForm.plan_name,
        billing_cycle: editForm.billing_cycle,
        subscription_status: editForm.subscription_status,
        max_employees: parseInt(editForm.max_employees) || 50,
        permissions: editForm.modules
      };

      if (editForm.new_password && editForm.new_password.trim()) {
        payload.password = editForm.new_password.trim();
      }

      await apiCall(`/super-admin/users/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      setSuccessMessage(`Organization & subscription details for "${editForm.company_name}" updated successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);

      setEditModalOpen(false);
      if (activeTab === 'user-detail') {
        fetchUserDetails(editForm.id);
      } else {
        fetchData();
      }
    } catch (err) {
      setError(err.message || 'Failed to update organization details');
    } finally {
      setEditing(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.email) {
      setError('Please fill in all required fields (Username, Password, Email)');
      return;
    }
    
    setCreating(true);
    setError(null);
    try {
      const payload = {
        username: newUser.username.trim(),
        password: newUser.password,
        full_name: newUser.company_name.trim() || newUser.full_name.trim() || 'HR Admin',
        company_name: newUser.company_name.trim() || newUser.full_name.trim(),
        email: newUser.email.trim(),
        phone: newUser.phone.trim(),
        industry: newUser.industry,
        logo_base64: newUser.logo_base64,
        working_days: newUser.working_days,
        late_threshold_time: newUser.late_threshold_time,
        status: newUser.status,
        plan_id: newUser.plan_id,
        plan_name: newUser.plan_name,
        billing_cycle: newUser.billing_cycle,
        max_employees: parseInt(newUser.max_employees) || 50,
        permissions: newUser.modules
      };

      await apiCall('/super-admin/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Reset form
      setNewUser({
        username: '',
        password: '',
        full_name: '',
        company_name: '',
        email: '',
        phone: '',
        industry: 'Technology & IT',
        logo_base64: '',
        working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        late_threshold_time: '10:00',
        status: 'active',
        plan_id: 'basic',
        plan_name: 'Growth / Basic',
        billing_cycle: 'monthly',
        max_employees: 50,
        modules: ['overview', 'employees', 'kiosk', 'reports', 'unknown_identity']
      });

      navigate('?tab=users');
    } catch (err) {
      setError(err.message || 'Failed to create HR admin workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (userId, currentStatus, e) => {
    if (e) e.stopPropagation();
    const isCurrentlyDisabled = currentStatus === 'disabled';
    const newStatus = isCurrentlyDisabled ? 'active' : 'disabled';
    const actionWord = isCurrentlyDisabled ? 'enable' : 'disable';

    if (!window.confirm(`Are you sure you want to ${actionWord} this HR Admin account? ${!isCurrentlyDisabled ? 'The admin will be immediately blocked from logging into the portal.' : 'The admin will regain access to login.'}`)) return;

    try {
      await apiCall(`/super-admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (activeTab === 'user-detail') {
        fetchUserDetails(userId);
      } else {
        fetchData();
      }
    } catch (err) {
      alert(err.message || `Failed to ${actionWord} admin account`);
    }
  };

  const handleDeleteUser = async (userId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this HR Admin? This cannot be undone.")) return;
    
    try {
      await apiCall(`/super-admin/users/${userId}`, { method: 'DELETE' });
      if (activeTab === 'user-detail') {
        navigate('?tab=users');
      } else {
        fetchData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleImpersonate = async (userId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("You are about to impersonate this HR Admin. Your Super Admin session will be temporarily replaced. Continue?")) return;
    
    try {
      const data = await apiCall(`/super-admin/impersonate/${userId}`, { method: 'POST' });
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      window.location.href = '/'; 
    } catch (err) {
      alert(err.message || 'Failed to impersonate user');
    }
  };

  return (
    <div className="w-full">
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm transition-all duration-300 animate-in slide-in-from-top-2">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm transition-all duration-300 animate-in slide-in-from-top-2">
          <CheckCircle2 size={18} className="flex-shrink-0 text-emerald-600" />
          <span className="text-sm font-semibold">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="ml-auto text-emerald-400 hover:text-emerald-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* GLOBAL ANALYTICS DASHBOARD */}
      {activeTab === 'analytics' && (
        <GlobalAnalyticsDashboard />
      )}

      {/* SYSTEM AUDIT LOGS */}
      {activeTab === 'logs' && (
        <AuditLogViewer />
      )}

      {/* SUPER ADMIN PROFILE & SECURITY */}
      {activeTab === 'profile' && (
        <SuperAdminProfile />
      )}

      {/* NOTIFICATION & LIMIT ALERTS CENTER */}
      {activeTab === 'alerts' && (
        <AlertsCenter />
      )}

      {/* SUBSCRIPTION TIERS & PLAN MANAGER */}
      {activeTab === 'plans' && (
        <PlanSettingsManager onPlansUpdated={() => {
          fetchGlobalPlans();
          fetchData();
        }} />
      )}

      {/* OTHER TABS */}
      {activeTab !== 'analytics' && activeTab !== 'logs' && activeTab !== 'profile' && activeTab !== 'alerts' && activeTab !== 'plans' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[600px] transition-all duration-300">
          
          {/* USERS LIST TAB */}
          {activeTab === 'users' && (
          <div className="flex flex-col h-full">
            <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">HR Administrators</h2>
                <p className="text-sm text-gray-500 mt-1">Manage tenant accounts, edit organization details, view company logos & stats.</p>
              </div>
              <button 
                onClick={() => navigate('?tab=create-user')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-teal hover:bg-brand-blue text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow active:scale-[0.98]"
              >
                <Plus size={18} />
                New HR Admin
              </button>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-slate-50/70 text-slate-500 text-xs uppercase tracking-wider border-b border-gray-100">
                    <th className="p-5 font-semibold">Company / Workspace</th>
                    <th className="p-5 font-semibold">Subscription Plan</th>
                    <th className="p-5 font-semibold">Seat Quota & Utilization</th>
                    <th className="p-5 font-semibold">Email</th>
                    <th className="p-5 font-semibold">Status</th>
                    <th className="p-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {loading ? (
                    <tr><td colSpan="6" className="p-12 text-center text-gray-400">Loading administrators...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan="6" className="p-12 text-center text-gray-400">No HR Admins found.</td></tr>
                  ) : (
                    users.map(u => {
                      const planMeta = getPlanMeta(u.plan_id, u.max_employees);
                      const maxSeats = u.max_employees || 50;
                      const empCount = u.employee_count ?? 0;
                      const availableSeats = Math.max(0, maxSeats - empCount);
                      const usedPct = Math.round(u.capacity_used_pct || (empCount / maxSeats * 100));

                      return (
                        <tr 
                          key={u.id} 
                          onClick={() => navigate(`?tab=user-detail&id=${u.id}`)}
                          className={`hover:bg-slate-50/90 transition-colors group cursor-pointer ${
                            u.status === 'disabled' ? 'bg-slate-50/50 opacity-80' : ''
                          }`}
                        >
                          {/* Company / Admin Column */}
                          <td className="p-5">
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                                {u.logo_url ? (
                                  <img src={u.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                                ) : (
                                  <Building2 size={20} className="text-slate-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 group-hover:text-brand-teal transition-colors flex items-center gap-2">
                                  {u.company_name || u.full_name || 'Admin Workspace'}
                                  {u.status === 'disabled' && (
                                    <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded">Disabled</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-400 font-mono">ID #{u.id} • @{u.username}</p>
                              </div>
                            </div>
                          </td>

                          {/* Subscription Plan Column */}
                          <td className="p-5">
                            <div className="space-y-1">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${planMeta.pillBg}`}>
                                <Crown size={12} className={planMeta.color === 'amber' ? 'text-amber-600' : planMeta.color === 'purple' ? 'text-purple-600' : 'text-blue-600'} />
                                {u.plan_name || planMeta.name}
                              </span>
                              <div className="text-[11px] text-slate-400 font-medium capitalize flex items-center gap-1.5">
                                <span>{planMeta.price} {planMeta.period}</span>
                                <span>•</span>
                                <span className="uppercase text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {u.billing_cycle || 'monthly'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Seat Quota & Utilization Column */}
                          <td className="p-5">
                            <div className="space-y-1.5 min-w-[160px]">
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-slate-700 flex items-center gap-1">
                                  <Users size={13} className="text-slate-400" />
                                  <span className="font-bold text-slate-900">{empCount}</span> / {maxSeats} Seats
                                </span>
                                <span className={`text-[11px] font-bold ${u.is_limit_exceeded ? 'text-rose-600 font-black' : u.is_limit_warning ? 'text-amber-600 font-black' : 'text-slate-500'}`}>
                                  {usedPct}%
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    u.is_limit_exceeded ? 'bg-rose-500' : u.is_limit_warning ? 'bg-amber-500' : 'bg-brand-teal'
                                  }`}
                                  style={{ width: `${Math.min(100, usedPct)}%` }}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                {u.is_limit_exceeded ? (
                                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                    Full (0 Left)
                                  </span>
                                ) : u.is_limit_warning ? (
                                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                    Nearing Cap ({availableSeats} Left)
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-slate-400">
                                    {availableSeats} seats remaining
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Email Column */}
                          <td className="p-5 text-gray-500 font-mono text-xs">{u.email || '-'}</td>

                          {/* Status Column */}
                          <td className="p-5">
                            {u.status === 'disabled' ? (
                              <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Disabled
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-xs font-semibold inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Active
                              </span>
                            )}
                          </td>

                          {/* Actions Column */}
                          <td className="p-5 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {/* Edit Button */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); openEditModal(u); }}
                                className="flex items-center gap-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors"
                                title="Edit Organization & Subscription Plan"
                              >
                                <Edit3 size={14} />
                                Edit Plan
                              </button>
                              
                              {/* Toggle Disable / Enable */}
                              <button 
                                onClick={(e) => handleToggleStatus(u.id, u.status, e)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                  u.status === 'disabled'
                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                                }`}
                                title={u.status === 'disabled' ? 'Enable Admin Account' : 'Disable Admin Account'}
                              >
                                {u.status === 'disabled' ? <CheckCircle size={14} /> : <Ban size={14} />}
                                {u.status === 'disabled' ? 'Enable' : 'Disable'}
                              </button>

                              <button 
                                onClick={(e) => handleImpersonate(u.id, e)}
                                disabled={u.status === 'disabled'}
                                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 disabled:pointer-events-none px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                                title={u.status === 'disabled' ? 'Cannot impersonate disabled user' : 'Log in as this user'}
                              >
                                <LogIn size={14} />
                                Impersonate
                              </button>
                              <button 
                                onClick={(e) => handleDeleteUser(u.id, e)}
                                className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-md transition-colors"
                                title="Delete user"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ADMIN DETAILS VIEW TAB */}
        {activeTab === 'user-detail' && (
          <div className="flex flex-col h-full">
            {/* Header / Nav */}
            <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('?tab=users')}
                  className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back to Users"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Admin & Company Overview</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Full profile, company branding, and registered employee metrics.</p>
                </div>
              </div>
              {selectedUser && (
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  
                  {/* Edit Organization Button */}
                  <button 
                    onClick={() => openEditModal(selectedUser)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-semibold transition-all shadow-sm"
                    title="Edit company name, logo, schedule, and settings"
                  >
                    <Edit3 size={16} />
                    Edit Organization
                  </button>

                  {/* Disable / Enable Button */}
                  <button 
                    onClick={(e) => handleToggleStatus(selectedUser.id, selectedUser.status, e)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                      selectedUser.status === 'disabled'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                    title={selectedUser.status === 'disabled' ? "Enable account so admin can log in" : "Disable account to block login"}
                  >
                    {selectedUser.status === 'disabled' ? (
                      <>
                        <CheckCircle size={16} />
                        Enable Account
                      </>
                    ) : (
                      <>
                        <Ban size={16} />
                        Disable Account
                      </>
                    )}
                  </button>

                  {/* Impersonate Button */}
                  <button 
                    onClick={() => handleImpersonate(selectedUser.id)}
                    disabled={selectedUser.status === 'disabled'}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-brand-teal hover:bg-brand-blue disabled:opacity-40 disabled:pointer-events-none text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow"
                    title={selectedUser.status === 'disabled' ? "Enable account first to impersonate" : "Log in as this HR Admin"}
                  >
                    <LogIn size={16} />
                    Impersonate Portal
                  </button>

                  {/* Delete Button */}
                  <button 
                    onClick={() => handleDeleteUser(selectedUser.id)}
                    className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                    title="Delete Administrator"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>

            {detailLoading ? (
              <div className="p-16 text-center text-gray-400">Loading admin details...</div>
            ) : !selectedUser ? (
              <div className="p-16 text-center text-gray-400">Admin not found.</div>
            ) : (
              <div className="p-6 md:p-8 space-y-8 flex-1 bg-slate-50/40">
                
                {/* Account Disabled Banner if disabled */}
                {selectedUser.status === 'disabled' && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                    <AlertTriangle size={22} className="text-amber-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm text-amber-900">This HR Admin account is currently Disabled</h4>
                      <p className="text-xs text-amber-700 mt-0.5">
                        This administrator is currently blocked from signing in to the HR Portal. Click "Enable Account" above to restore access.
                      </p>
                    </div>
                  </div>
                )}

                {/* Profile Card with Logo Banner */}
                {(() => {
                  const planMeta = getPlanMeta(selectedUser.plan_id, selectedUser.max_employees);
                  const maxSeats = selectedUser.max_employees || 50;
                  const empCount = selectedUser.employee_count ?? 0;
                  const availableSeats = Math.max(0, maxSeats - empCount);
                  const usedPct = Math.round(selectedUser.capacity_used_pct || (empCount / maxSeats * 100));

                  return (
                    <>
                      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                          {/* Logo Display */}
                          <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center flex-shrink-0 shadow-inner relative group overflow-hidden">
                            {selectedUser.logo_url ? (
                              <img 
                                src={selectedUser.logo_url} 
                                alt="Company Logo" 
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-slate-400">
                                <Building2 size={36} />
                                <span className="text-[10px] uppercase font-bold mt-1 tracking-wider">No Logo</span>
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                                {selectedUser.company_name || selectedUser.full_name || 'HR Workspace'}
                              </h3>
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${planMeta.pillBg}`}>
                                <Crown size={13} className={planMeta.color === 'amber' ? 'text-amber-600' : planMeta.color === 'purple' ? 'text-purple-600' : 'text-blue-600'} />
                                {selectedUser.plan_name || planMeta.name}
                              </span>
                              {selectedUser.status === 'disabled' ? (
                                <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">
                                  Disabled
                                </span>
                              ) : (
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-xs font-bold">
                                  Active
                                </span>
                              )}
                              {selectedUser.industry && (
                                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                                  {selectedUser.industry}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-1 font-medium flex flex-wrap items-center gap-2">
                              <span>Username: <strong className="text-gray-800 font-mono">@{selectedUser.username}</strong></span>
                              <span>•</span>
                              <span>Email: <strong className="text-gray-800">{selectedUser.email || 'N/A'}</strong></span>
                              {selectedUser.phone && (
                                <>
                                  <span>•</span>
                                  <span>Phone: <strong className="text-gray-800">{selectedUser.phone}</strong></span>
                                </>
                              )}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Tenant ID: #{selectedUser.id} | Billing: <strong className="text-gray-700 capitalize">{selectedUser.billing_cycle || 'monthly'}</strong> | Created: {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => openEditModal(selectedUser)}
                          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                          <Edit3 size={14} />
                          Edit Details & Plan
                        </button>
                      </div>

                      {/* SUBSCRIPTION & PLAN TIER OVERVIEW CARD */}
                      <div className="bg-gradient-to-br from-white via-slate-50/50 to-teal-50/20 rounded-2xl border border-slate-200 p-6 md:p-7 shadow-sm space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs border ${planMeta.accentColor}`}>
                              <Crown size={24} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-gray-900 tracking-tight">
                                  Subscription Plan: {selectedUser.plan_name || planMeta.name}
                                </h3>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full capitalize">
                                  {selectedUser.billing_cycle || 'monthly'} billing
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {planMeta.tagline} • <strong className="text-slate-800">{planMeta.price} {planMeta.period}</strong>
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => openEditModal(selectedUser)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-teal to-brand-blue text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all"
                          >
                            <Zap size={14} />
                            Upgrade / Change Plan
                          </button>
                        </div>

                        {/* Seat Meter & Quota Visual */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Allocated Plan Limit</span>
                            <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1">
                              {maxSeats} <span className="text-xs text-slate-400 font-semibold">Total Seats</span>
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Enrolled Employees</span>
                            <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1">
                              {empCount} <span className="text-xs text-slate-400 font-semibold">Utilized ({usedPct}%)</span>
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Available Headcount</span>
                            <div className={`text-2xl font-black mt-1 flex items-baseline gap-1 ${
                              selectedUser.is_limit_exceeded ? 'text-rose-600' : selectedUser.is_limit_warning ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                              {availableSeats} <span className="text-xs text-slate-400 font-semibold">Seats Left</span>
                            </div>
                          </div>
                        </div>

                        {/* Capacity Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-600">Headcount Capacity Quota</span>
                            <span className={selectedUser.is_limit_exceeded ? 'text-rose-600 font-bold' : selectedUser.is_limit_warning ? 'text-amber-600 font-bold' : 'text-brand-teal'}>
                              {empCount} of {maxSeats} seats filled ({usedPct}%)
                            </span>
                          </div>
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                selectedUser.is_limit_exceeded ? 'bg-rose-500' : selectedUser.is_limit_warning ? 'bg-amber-500' : 'bg-gradient-to-r from-brand-teal to-brand-blue'
                              }`}
                              style={{ width: `${Math.min(100, usedPct)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                            <span>0 seats</span>
                            {selectedUser.is_limit_exceeded && (
                              <span className="text-rose-600 font-black uppercase text-[10px] bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                Maximum Limit Reached — New Registrations Blocked
                              </span>
                            )}
                            {selectedUser.is_limit_warning && !selectedUser.is_limit_exceeded && (
                              <span className="text-amber-600 font-black uppercase text-[10px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                Warning: 80%+ Plan Capacity Reached
                              </span>
                            )}
                            <span>{maxSeats} seats</span>
                          </div>
                        </div>

                        {/* Plan Features Preview */}
                        <div className="pt-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Included Plan Features</p>
                          <div className="flex flex-wrap gap-2">
                            {planMeta.features.map(f => (
                              <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs">
                                <Check size={12} className="text-emerald-500" strokeWidth={3} />
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>

                      </div>
                    </>
                  );
                })()}

                {/* Stat Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Staff Headcount</span>
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Users size={20} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-gray-900">{selectedUser.employee_count ?? 0}</span>
                      <span className="text-sm font-semibold text-slate-400">/ {selectedUser.max_employees || 50} Seats</span>
                    </div>
                    {/* Capacity Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          selectedUser.is_limit_exceeded ? 'bg-rose-500' : selectedUser.is_limit_warning ? 'bg-amber-500' : 'bg-brand-teal'
                        }`}
                        style={{ width: `${Math.min(100, selectedUser.capacity_used_pct || 0)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 flex items-center justify-between pt-1">
                      <span>{selectedUser.capacity_used_pct || 0}% capacity used</span>
                      {selectedUser.is_limit_exceeded ? (
                        <span className="text-[10px] font-black text-rose-600 uppercase">Limit Reached</span>
                      ) : selectedUser.is_limit_warning ? (
                        <span className="text-[10px] font-black text-amber-600 uppercase">Nearing Limit</span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Healthy</span>
                      )}
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Attendance Logs</span>
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 size={20} />
                      </div>
                    </div>
                    <p className="text-3xl font-black text-gray-900 mt-3">{selectedUser.attendance_count ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Total check-in / check-outs</p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Face Embeddings</span>
                      <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                        <ShieldCheck size={20} />
                      </div>
                    </div>
                    <p className="text-3xl font-black text-gray-900 mt-3">{selectedUser.face_count ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Biometric face models enrolled</p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Late Threshold</span>
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Clock size={20} />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-gray-900 mt-3">{selectedUser.late_threshold_time || selectedUser.settings?.lateThresholdTime || '10:00'}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Working days: {(selectedUser.working_days || selectedUser.settings?.workingDays)?.join(', ') || 'Mon-Fri'}
                    </p>
                  </div>
                </div>

                {/* Recent Registered Employees Table */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Registered Employees for this Admin</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Sample list of staff members under this tenant workspace.</p>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                      Showing {selectedUser.recent_employees?.length || 0} of {selectedUser.employee_count || 0}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 text-slate-500 text-xs uppercase tracking-wider border-b border-gray-100">
                          <th className="p-4 font-semibold">Employee ID</th>
                          <th className="p-4 font-semibold">Name</th>
                          <th className="p-4 font-semibold">Domain</th>
                          <th className="p-4 font-semibold">Department</th>
                          <th className="p-4 font-semibold">Position</th>
                          <th className="p-4 font-semibold">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-sm">
                        {(!selectedUser.recent_employees || selectedUser.recent_employees.length === 0) ? (
                          <tr><td colSpan="6" className="p-8 text-center text-gray-400">No employees registered yet for this admin.</td></tr>
                        ) : (
                          selectedUser.recent_employees.map(emp => (
                            <tr key={emp.employee_id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-4 font-mono text-xs font-semibold text-brand-teal">{emp.employee_id}</td>
                              <td className="p-4 font-medium text-gray-900">{emp.name}</td>
                              <td className="p-4 text-gray-600">{emp.domain || '-'}</td>
                              <td className="p-4 text-gray-600">{emp.department || '-'}</td>
                              <td className="p-4 text-gray-600">{emp.position || '-'}</td>
                              <td className="p-4 text-gray-400 text-xs">
                                {emp.registered_date ? new Date(emp.registered_date).toLocaleDateString() : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* CREATE HR ADMIN TAB (REDESIGNED & EXPANDED) */}
        {activeTab === 'create-user' && (
          <div className="flex flex-col h-full bg-slate-50/30">
            {/* Header */}
            <div className="p-6 md:p-8 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('?tab=users')}
                  className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                  title="Back to Administrators"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    Create HR Administrator Workspace
                    <span className="text-xs bg-brand-teal/10 text-brand-teal px-2.5 py-0.5 rounded-full font-bold border border-brand-teal/20">
                      Multi-Tenant
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5 font-medium">
                    Configure tenant credentials, organization branding, attendance policies, and platform features.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                  type="button" 
                  onClick={() => navigate('?tab=users')}
                  className="w-full sm:w-auto px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateUser} 
                  disabled={creating}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-brand-teal to-brand-blue hover:opacity-90 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95"
                >
                  {creating ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />}
                  {creating ? 'Provisioning...' : 'Create HR Admin'}
                </button>
              </div>
            </div>

            {/* Main Form Content & Live Preview Grid */}
            <div className="p-4 sm:p-6 md:p-8 flex-1">
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                
                {/* Left Side: Form Sections (8 Cols) */}
                <div className="xl:col-span-8 space-y-6">
                  
                  {/* Section 1: Organization & Company Profile */}
                  <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-5">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Organization & Branding</h3>
                        <p className="text-xs text-gray-500">Company identity and customized portal display settings.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                          Company / Organization Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <Building2 size={16} />
                          </div>
                          <input 
                            type="text" 
                            required 
                            value={newUser.company_name} 
                            onChange={e => setNewUser({...newUser, company_name: e.target.value, full_name: e.target.value})}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all" 
                            placeholder="e.g. Acme Technologies Ltd."
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Industry / Domain</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <Briefcase size={16} />
                          </div>
                          <select
                            value={newUser.industry}
                            onChange={e => setNewUser({...newUser, industry: e.target.value})}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all cursor-pointer"
                          >
                            {industriesList.map(ind => (
                              <option key={ind} value={ind}>{ind}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Logo Upload Box */}
                    <div className="space-y-2 pt-1">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Company Logo <span className="text-xs font-normal text-gray-400 capitalize">(Optional, will be displayed in HR portal & Kiosk)</span>
                      </label>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleLogoFileChange} 
                        accept="image/*" 
                        className="hidden" 
                      />

                      <div className="flex items-center gap-4">
                        {/* Logo Preview */}
                        <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 p-1.5 flex items-center justify-center flex-shrink-0 shadow-inner overflow-hidden">
                          {newUser.logo_base64 ? (
                            <img src={newUser.logo_base64} alt="Preview" className="w-full h-full object-contain" />
                          ) : (
                            <ImageIcon size={24} className="text-gray-300" />
                          )}
                        </div>

                        {/* Upload Button */}
                        <div className="flex-1 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                          >
                            <Upload size={14} />
                            {newUser.logo_base64 ? 'Change Logo Image' : 'Upload Company Logo'}
                          </button>
                          {newUser.logo_base64 && (
                            <button
                              type="button"
                              onClick={() => setNewUser(prev => ({ ...prev, logo_base64: '' }))}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Subscription Plan Tier & Seat Allocation */}
                  <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                          <Crown size={18} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">Subscription Plan Tier & Seat Capacity</h3>
                          <p className="text-xs text-gray-500">Choose tenant tier, employee seat limits, and billing terms.</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-brand-teal bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
                        Enforced Server-Side Cap
                      </span>
                    </div>

                    {/* Subscription Plan Cards Grid (3 Core Tiers) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {livePlans.map(plan => {
                        const isSelected = newUser.plan_id === plan.id;
                        return (
                          <div
                            key={plan.id}
                            onClick={() => handleSelectPlanForNew(plan)}
                            className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${
                              isSelected
                                ? `${plan.accentColor || 'border-brand-teal text-slate-900 bg-teal-50/20'} border-brand-teal ring-2 ring-brand-teal/20 shadow-md scale-[1.01]`
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
                            }`}
                          >
                            {/* Badges */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                isSelected ? 'bg-brand-teal text-white border-brand-teal' : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {plan.badge || (plan.id === 'free' ? 'Free Starter' : plan.id === 'basic' ? 'Most Popular' : 'Enterprise Scale')}
                              </span>

                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-brand-teal text-white flex items-center justify-center shadow-xs">
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              )}
                            </div>

                            {/* Plan Name & Price */}
                            <div className="space-y-1">
                              <h4 className="text-sm font-black text-slate-900">{plan.name}</h4>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-slate-900">{plan.price || `$${plan.price_monthly || 0}`}</span>
                                <span className="text-xs text-slate-500 font-medium">{plan.period || '/month'}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{plan.tagline}</p>
                            </div>

                            {/* Seat Cap Pill */}
                            <div className="mt-3 pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-medium">Headcount Limit</span>
                              <span className={`font-black font-mono px-2 py-0.5 rounded-md ${
                                isSelected ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {plan.seats || plan.max_employees || 50} Seats
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Billing Cycle & Custom Seat Fine-Tuning */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-100">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                          Billing Cycle / Contract Model
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <CreditCard size={16} />
                          </div>
                          <select
                            value={newUser.billing_cycle}
                            onChange={e => setNewUser({ ...newUser, billing_cycle: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all cursor-pointer font-medium"
                          >
                            <option value="monthly">Monthly Recurring ($)</option>
                            <option value="annual">Annual Billing (15% Savings)</option>
                            <option value="lifetime">Enterprise Lifetime / One-Time</option>
                            <option value="trial">14-Day Free Evaluation Trial</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                            Employee Seat Capacity Cap
                          </label>
                          <span className="text-[11px] text-slate-400 font-medium">Synced from Plan Tier</span>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <Users size={16} />
                          </div>
                          <input
                            type="number"
                            min="1"
                            max="10000"
                            value={newUser.max_employees || 50}
                            onChange={e => setNewUser({ ...newUser, max_employees: parseInt(e.target.value) || 50 })}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all font-mono font-bold"
                            placeholder="e.g. 50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Account Credentials & Contact */}
                  <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                          <Key size={18} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">Account Credentials & Login Access</h3>
                          <p className="text-xs text-gray-500">Admin login username, strong password, and primary contact details.</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-xs font-bold text-brand-teal hover:text-brand-blue bg-cyan-50 hover:bg-cyan-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Sparkles size={13} />
                        Generate Password
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Username */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                          Admin Username <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <span className="font-mono text-xs font-bold">@</span>
                          </div>
                          <input 
                            type="text" 
                            required 
                            value={newUser.username} 
                            onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all font-mono" 
                            placeholder="e.g. acme_admin"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                          Login Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <Key size={16} />
                          </div>
                          <input 
                            type={showPassword ? 'text' : 'password'} 
                            required 
                            value={newUser.password} 
                            onChange={e => setNewUser({...newUser, password: e.target.value})}
                            className="w-full pl-10 pr-11 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all font-mono" 
                            placeholder="Enter password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <Mail size={16} />
                          </div>
                          <input 
                            type="email" 
                            required 
                            value={newUser.email} 
                            onChange={e => setNewUser({...newUser, email: e.target.value})}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all" 
                            placeholder="admin@acme.com"
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Contact Phone Number</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <Phone size={16} />
                          </div>
                          <input 
                            type="tel" 
                            value={newUser.phone} 
                            onChange={e => {
                              const val = e.target.value.replace(/[^0-9+\-() ]/g, '');
                              if (val.length <= 20) {
                                setNewUser({...newUser, phone: val});
                              }
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all" 
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Attendance Policy & Schedule */}
                  <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-5">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center">
                        <Clock size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Attendance Policies & Operating Schedule</h3>
                        <p className="text-xs text-gray-500">Configure default shift cutoff time, working days, and status.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Working Days */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                            Operating Working Days
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setNewUser(prev => ({ ...prev, working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }))}
                              className="text-[11px] font-bold text-slate-500 hover:text-brand-teal bg-slate-100 px-2 py-0.5 rounded transition-colors"
                            >
                              5-Day (Mon-Fri)
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewUser(prev => ({ ...prev, working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }))}
                              className="text-[11px] font-bold text-slate-500 hover:text-brand-teal bg-slate-100 px-2 py-0.5 rounded transition-colors"
                            >
                              6-Day (Mon-Sat)
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {daysList.map(day => {
                            const isSelected = newUser.working_days.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => handleDayToggle(day)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                  isSelected
                                    ? 'bg-brand-teal text-white shadow-sm scale-100'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Late Threshold & Account Status */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                            Late Cutoff Threshold Time
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                              <Clock size={16} />
                            </div>
                            <input 
                              type="time" 
                              value={newUser.late_threshold_time} 
                              onChange={e => setNewUser({...newUser, late_threshold_time: e.target.value})}
                              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all" 
                            />
                          </div>
                          <p className="text-[11px] text-gray-400">Check-ins after this time are marked as Late.</p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                            Initial Account Status
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setNewUser({...newUser, status: 'active'})}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                                newUser.status === 'active'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              <CheckCircle size={14} />
                              Active
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewUser({...newUser, status: 'disabled'})}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                                newUser.status === 'disabled'
                                  ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              <Ban size={14} />
                              Disabled
                            </button>
                          </div>
                          <p className="text-[11px] text-gray-400">Controls whether the admin can immediately log in.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 5: Module Access & Capabilities */}
                  <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <Layers size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Platform Modules Access</h3>
                        <p className="text-xs text-gray-500">Enable or disable specific features for this admin workspace.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {availableModules.map(mod => {
                        const isChecked = newUser.modules.includes(mod.id);
                        return (
                          <div 
                            key={mod.id} 
                            onClick={() => handleModuleToggle(mod.id)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                              isChecked
                                ? 'bg-teal-50/60 border-brand-teal/40 shadow-xs'
                                : 'bg-slate-50/50 border-slate-200 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                              isChecked ? 'bg-brand-teal text-white' : 'border border-slate-300 bg-white'
                            }`}>
                              {isChecked && <Check size={13} strokeWidth={3} />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-900">{mod.name}</p>
                              <p className="text-[11px] text-gray-500">{mod.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Right Side: Live Workspace Preview Card (4 Cols) */}
                <div className="xl:col-span-4 space-y-6">
                  <div className="sticky top-6">
                    {(() => {
                      const selectedPlanMeta = getPlanMeta(newUser.plan_id, newUser.max_employees);

                      return (
                        <div className="bg-gradient-to-br from-slate-900 via-brand-dark to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-6 relative overflow-hidden">
                          
                          {/* Background Glow */}
                          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-brand-teal/20 rounded-full blur-3xl pointer-events-none"></div>
                          
                          <div className="relative z-10 flex items-center justify-between">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold tracking-wider uppercase text-cyan-300">
                              <Sparkles size={12} />
                              Live Workspace Preview
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border ${
                              newUser.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}>
                              {newUser.status}
                            </span>
                          </div>

                          {/* Live Brand Card */}
                          <div className="relative z-10 bg-white/10 backdrop-blur-lg border border-white/15 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-xl bg-white/90 p-1 flex items-center justify-center flex-shrink-0 shadow-md">
                                {newUser.logo_base64 ? (
                                  <img src={newUser.logo_base64} alt="Company Logo" className="w-full h-full object-contain" />
                                ) : (
                                  <Building2 size={26} className="text-slate-700" />
                                )}
                              </div>
                              <div>
                                <h4 className="text-base font-black text-white tracking-tight line-clamp-1">
                                  {newUser.company_name || 'Organization Name'}
                                </h4>
                                <p className="text-xs text-cyan-300 font-medium">
                                  {newUser.industry || 'Domain'}
                                </p>
                              </div>
                            </div>

                            {/* Plan Tier Badge in Preview */}
                            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Crown size={14} className="text-amber-400" />
                                <span className="text-xs font-bold text-white">{selectedPlanMeta.name}</span>
                              </div>
                              <span className="text-[11px] font-bold text-cyan-300 capitalize bg-white/10 px-2 py-0.5 rounded-md">
                                {newUser.billing_cycle}
                              </span>
                            </div>

                            {/* Quota breakdown */}
                            <div className="bg-black/25 rounded-xl p-3 border border-white/10 space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-300">Seat Capacity Limit</span>
                                <span className="font-mono font-bold text-white">{newUser.max_employees || 50} Seats</span>
                              </div>
                              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-teal rounded-full w-0" />
                              </div>
                              <div className="text-[10px] text-slate-400 flex justify-between">
                                <span>0 Enrolled</span>
                                <span>{newUser.max_employees || 50} Available</span>
                              </div>
                            </div>

                            <div className="pt-2 space-y-2 text-xs">
                              <div className="flex items-center justify-between text-slate-300">
                                <span>Admin Username</span>
                                <strong className="text-white font-mono">@{newUser.username || 'username'}</strong>
                              </div>
                              <div className="flex items-center justify-between text-slate-300">
                                <span>Admin Email</span>
                                <strong className="text-white truncate max-w-[150px]">{newUser.email || 'email@company.com'}</strong>
                              </div>
                              <div className="flex items-center justify-between text-slate-300">
                                <span>Late Cutoff</span>
                                <strong className="text-white font-mono">{newUser.late_threshold_time}</strong>
                              </div>
                              <div className="flex items-center justify-between text-slate-300">
                                <span>Working Days</span>
                                <strong className="text-cyan-300">{newUser.working_days.length} Days/Week</strong>
                              </div>
                            </div>
                          </div>

                          {/* Active Modules Pill Preview */}
                          <div className="relative z-10 space-y-2">
                            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Enabled Modules ({newUser.modules.length})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {newUser.modules.map(m => (
                                <span key={m} className="px-2.5 py-1 bg-white/10 border border-white/15 rounded-lg text-[10px] font-semibold text-slate-200">
                                  {availableModules.find(item => item.id === m)?.name || m}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Bottom action reminder */}
                          <div className="relative z-10 pt-2 border-t border-white/10">
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              Once created, tenant database partition, biometric vector space, and {newUser.max_employees || 50} seats quota will be immediately provisioned.
                            </p>
                          </div>

                        </div>
                      );
                    })()}
                  </div>
                </div>

              </form>
            </div>
          </div>
        )}
      </div>
    )}

      {/* EDIT ORGANIZATION MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-8 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 md:p-8 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-teal/10 text-brand-teal border border-brand-teal/20 flex items-center justify-center">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Edit Organization & Admin Details</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Modifying tenant: <strong className="text-gray-800">@{editForm.username}</strong> (ID #{editForm.id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
              <form id="edit-org-form" onSubmit={handleUpdateUser} className="space-y-6">
                
                {/* Section: Subscription Plan Tier Switcher */}
                <div className="p-5 bg-gradient-to-br from-slate-50 via-teal-50/20 to-white rounded-2xl border border-slate-200/90 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                        <Crown size={16} />
                      </div>
                      <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Subscription Plan Tier</h4>
                    </div>
                    <span className="text-[11px] font-bold text-brand-teal bg-white border border-brand-teal/30 px-2.5 py-0.5 rounded-full">
                      Instant Upgrade / Downgrade
                    </span>
                  </div>

                  {/* Plan Cards (3 Core Tiers) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {livePlans.map(plan => {
                      const isSelected = editForm.plan_id === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => handleSelectPlanForEdit(plan)}
                          className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${
                            isSelected
                              ? `${plan.accentColor || 'border-brand-teal text-slate-900 bg-teal-50/30'} border-brand-teal ring-2 ring-brand-teal/20 shadow-md scale-[1.02]`
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-xs'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isSelected ? 'bg-brand-teal text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {plan.badge || (plan.id === 'free' ? 'Free Starter' : plan.id === 'basic' ? 'Most Popular' : 'Enterprise Scale')}
                              </span>
                              {isSelected && <Check size={13} className="text-brand-teal" strokeWidth={3} />}
                            </div>
                            <h5 className="text-xs font-black text-slate-900 mt-2">{plan.name}</h5>
                            <p className="text-sm font-black text-brand-blue mt-0.5">
                              {plan.price || `$${plan.price_monthly || 0}`} <span className="font-normal text-[10px] text-slate-400">{plan.period || '/month'}</span>
                            </p>
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] font-mono font-bold text-slate-700 flex items-center justify-between">
                            <span>Capacity Quota</span>
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-900">
                              {plan.seats || plan.max_employees || 50} Seats
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Subscription Status & Billing Cycle Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wide">Billing Cycle</label>
                      <select
                        value={editForm.billing_cycle}
                        onChange={e => setEditForm({ ...editForm, billing_cycle: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none font-medium"
                      >
                        <option value="monthly">Monthly ($)</option>
                        <option value="annual">Annual (15% off)</option>
                        <option value="lifetime">Lifetime Enterprise</option>
                        <option value="trial">Evaluation Trial</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wide">Subscription Status</label>
                      <select
                        value={editForm.subscription_status}
                        onChange={e => setEditForm({ ...editForm, subscription_status: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                      >
                        <option value="active" className="text-emerald-700">Active</option>
                        <option value="trial" className="text-blue-700">Trial</option>
                        <option value="suspended" className="text-amber-700">Suspended</option>
                        <option value="cancelled" className="text-rose-700">Cancelled</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wide">Employee Seat Limit</label>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={editForm.max_employees || 50}
                        onChange={e => setEditForm({ ...editForm, max_employees: parseInt(e.target.value) || 50 })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Company Name & Industry */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Company / Organization Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.company_name}
                      onChange={e => setEditForm({ ...editForm, company_name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Industry / Domain</label>
                    <select
                      value={editForm.industry}
                      onChange={e => setEditForm({ ...editForm, industry: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all cursor-pointer"
                    >
                      {industriesList.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Admin Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Phone Number</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9+\-() ]/g, '');
                        if (val.length <= 20) {
                          setEditForm({ ...editForm, phone: val });
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                {/* Company Logo Update */}
                <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Company Logo
                  </label>
                  <input
                    type="file"
                    ref={editFileInputRef}
                    onChange={handleEditLogoChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                      {editForm.logo_base64 ? (
                        <img src={editForm.logo_base64} alt="New Logo" className="w-full h-full object-contain" />
                      ) : editForm.current_logo_url ? (
                        <img src={editForm.current_logo_url} alt="Current Logo" className="w-full h-full object-contain" />
                      ) : (
                        <Building2 size={24} className="text-gray-300" />
                      )}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <Upload size={13} />
                        {editForm.logo_base64 ? 'Change Selected Logo' : 'Upload New Logo'}
                      </button>
                      {editForm.logo_base64 && (
                        <p className="text-[11px] text-emerald-600 font-medium mt-1">New logo ready to save</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Working Days Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Operating Working Days
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditForm(prev => ({ ...prev, working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }))}
                        className="text-[11px] font-bold text-slate-500 hover:text-brand-teal bg-slate-100 px-2 py-0.5 rounded transition-colors"
                      >
                        5-Day
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditForm(prev => ({ ...prev, working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }))}
                        className="text-[11px] font-bold text-slate-500 hover:text-brand-teal bg-slate-100 px-2 py-0.5 rounded transition-colors"
                      >
                        6-Day
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {daysList.map(day => {
                      const isSelected = editForm.working_days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleEditDayToggle(day)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-brand-teal text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Late Cutoff & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Late Cutoff Threshold Time
                    </label>
                    <input
                      type="time"
                      value={editForm.late_threshold_time}
                      onChange={e => setEditForm({ ...editForm, late_threshold_time: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Account Status</label>
                    <select
                      value={editForm.status}
                      onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all cursor-pointer font-bold"
                    >
                      <option value="active" className="text-emerald-700">Active (Allowed to Sign In)</option>
                      <option value="disabled" className="text-amber-700">Disabled (Blocked from Sign In)</option>
                    </select>
                  </div>
                </div>

                {/* Reset Password (Optional) */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Reset Password (Optional)</h4>
                      <p className="text-[11px] text-gray-500">Leave blank to keep current password unchanged.</p>
                    </div>
                    <button
                      type="button"
                      onClick={generateEditPassword}
                      className="text-[11px] font-bold text-brand-teal hover:text-brand-blue bg-white border border-slate-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Sparkles size={12} />
                      Generate
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      value={editForm.new_password}
                      onChange={e => setEditForm({ ...editForm, new_password: e.target.value })}
                      className="w-full pr-10 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                      placeholder="Enter new password if resetting"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Module Access */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Platform Module Access
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availableModules.map(mod => {
                      const isChecked = editForm.modules.includes(mod.id);
                      return (
                        <div
                          key={mod.id}
                          onClick={() => handleEditModuleToggle(mod.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                            isChecked
                              ? 'bg-teal-50/60 border-brand-teal/40'
                              : 'bg-slate-50/50 border-slate-200 opacity-60'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center ${
                            isChecked ? 'bg-brand-teal text-white' : 'border border-slate-300 bg-white'
                          }`}>
                            {isChecked && <Check size={11} strokeWidth={3} />}
                          </div>
                          <span className="text-xs font-bold text-gray-800">{mod.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-5 py-2.5 text-gray-600 hover:bg-gray-200/60 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-org-form"
                disabled={editing}
                className="px-6 py-2.5 bg-gradient-to-r from-brand-teal to-brand-blue hover:opacity-90 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
              >
                {editing ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                {editing ? 'Saving Changes...' : 'Save Organization Details'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

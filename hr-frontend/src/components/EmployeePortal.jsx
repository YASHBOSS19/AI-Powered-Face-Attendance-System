import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, User, LogOut, CheckCircle2, AlertCircle, AlertTriangle, 
  FileText, ChevronRight, ChevronLeft, Sparkles, TrendingUp, ShieldCheck, 
  Plus, RefreshCw, X, Download, Lock, Phone, Mail, Building, Briefcase, 
  Award, ArrowUpRight, BarChart3, PieChart, Check, XCircle, FileQuestion,
  CalendarDays, Umbrella, HelpCircle, Eye, EyeOff
} from 'lucide-react';
import { apiCall, getProfileImageUrl } from '../api';

export default function EmployeePortal() {
  const navigate = useNavigate();

  // Navigation tabs: 'overview', 'attendance', 'analytics', 'leaves', 'queries', 'profile'
  const [activeTab, setActiveTab] = useState('overview');

  // Core Data States
  const [profile, setProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [leavesData, setLeavesData] = useState(null);
  const [queriesData, setQueriesData] = useState([]);
  
  // Controls & Filters
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Modal States
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  const [showQueryModal, setShowQueryModal] = useState(false);
  const [queryDate, setQueryDate] = useState('');
  const [queryCategory, setQueryCategory] = useState('Missed Face Scan');
  const [queryExplanation, setQueryExplanation] = useState('');
  const [queryCheckin, setQueryCheckin] = useState('09:00:00');
  const [queryCheckout, setQueryCheckout] = useState('18:00:00');

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // Profile Edit State
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Initial Load
  useEffect(() => {
    document.title = 'Employee Self-Service Portal';
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [dashRes, profileRes] = await Promise.all([
        apiCall('/employee/dashboard'),
        apiCall('/employee/profile')
      ]);

      if (dashRes.status === 'success') {
        setDashboardData(dashRes);
        setProfile(dashRes.employee);
      }
      if (profileRes.status === 'success') {
        setProfile(profileRes.employee);
        setEditEmail(profileRes.employee.email || '');
        setEditPhone(profileRes.employee.phone || '');
      }

      // Fetch active tab specific data
      await loadTabData(activeTab);
    } catch (err) {
      console.error('Portal init error:', err);
      if (err.message && err.message.toLowerCase().includes('token')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async (tab) => {
    try {
      if (tab === 'attendance') {
        const attRes = await apiCall(`/employee/attendance?month=${selectedMonth}`);
        if (attRes.status === 'success') setAttendanceData(attRes);
      } else if (tab === 'analytics') {
        const anaRes = await apiCall('/employee/analytics');
        if (anaRes.status === 'success') setAnalyticsData(anaRes);
      } else if (tab === 'leaves') {
        const lRes = await apiCall('/employee/leaves');
        if (lRes.status === 'success') setLeavesData(lRes);
      } else if (tab === 'queries') {
        const qRes = await apiCall('/employee/queries');
        if (qRes.status === 'success') setQueriesData(qRes.queries || []);
      }
    } catch (err) {
      console.error(`Error loading ${tab} data:`, err);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    loadTabData(tab);
  };

  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    apiCall(`/employee/attendance?month=${newMonth}`).then(res => {
      if (res.status === 'success') setAttendanceData(res);
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('employee');
    navigate('/login');
  };

  // Submit Leave Request
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate || !leaveReason.trim()) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiCall('/employee/leaves/apply', {
        method: 'POST',
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: leaveStartDate,
          end_date: leaveEndDate,
          reason: leaveReason
        })
      });

      if (res.status === 'success') {
        showToast(res.message || 'Leave applied successfully!');
        setShowLeaveModal(false);
        setLeaveReason('');
        setLeaveStartDate('');
        setLeaveEndDate('');
        // Refresh dashboard and leaves
        fetchInitialData();
        loadTabData('leaves');
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit leave.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Leave Request
  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this leave application?')) return;
    try {
      const res = await apiCall(`/employee/leaves/${leaveId}`, { method: 'DELETE' });
      if (res.status === 'success') {
        showToast('Leave request cancelled.');
        loadTabData('leaves');
        fetchInitialData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to cancel leave.', 'error');
    }
  };

  // Submit Attendance Query / Dispute
  const handleSubmitQuery = async (e) => {
    e.preventDefault();
    if (!queryDate || !queryExplanation.trim()) {
      showToast('Please provide date and explanation.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiCall('/employee/queries/submit', {
        method: 'POST',
        body: JSON.stringify({
          date: queryDate,
          reason_category: queryCategory,
          explanation: queryExplanation,
          checkin_time: queryCheckin,
          checkout_time: queryCheckout
        })
      });

      if (res.status === 'success') {
        showToast('Attendance dispute query submitted to HR.');
        setShowQueryModal(false);
        setQueryExplanation('');
        setQueryDate('');
        loadTabData('queries');
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit query.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiCall('/employee/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (res.status === 'success') {
        showToast('Password updated successfully!');
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      showToast(err.message || 'Failed to change password.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Profile
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await apiCall('/employee/profile', {
        method: 'PUT',
        body: JSON.stringify({ email: editEmail, phone: editPhone })
      });
      if (res.status === 'success') {
        showToast('Profile contact updated.');
        setIsEditingProfile(false);
        fetchInitialData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate day difference for leave modal
  const leaveDaysCalc = useMemo(() => {
    if (!leaveStartDate || !leaveEndDate) return 0;
    try {
      const s = new Date(leaveStartDate);
      const e = new Date(leaveEndDate);
      const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 ? diff : 0;
    } catch {
      return 0;
    }
  }, [leaveStartDate, leaveEndDate]);

  // Printable Attendance Slip Generator
  const printAttendanceSlip = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-teal-500 selection:text-white">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold border backdrop-blur-md animate-in slide-in-from-top-4 duration-300 ${
          toastMessage.type === 'error' 
            ? 'bg-rose-50/95 border-rose-200 text-rose-800' 
            : 'bg-emerald-50/95 border-emerald-200 text-emerald-800'
        }`}>
          {toastMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* --- Top Navigation Header --- */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Brand & Employee Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-900 to-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-500/10">
              <Sparkles size={22} className="text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
                  {profile?.company_name || 'IdentiFi HR'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  Employee Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Self-Service Biometric & Attendance Suite</p>
            </div>
          </div>

          {/* User Profile Pill & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3 bg-slate-100/80 border border-slate-200/60 rounded-2xl p-1.5 pr-4">
              {profile?.profile_picture ? (
                <img 
                  src={getProfileImageUrl(profile.profile_picture)} 
                  alt={profile.name} 
                  className="w-9 h-9 rounded-xl object-cover border border-white shadow-sm"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  {profile?.name ? profile.name.charAt(0).toUpperCase() : 'E'}
                </div>
              )}
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight">{profile?.name || 'Employee'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                    ID: {profile?.employee_id}
                  </span>
                  <span className="text-[10px] text-slate-500">{profile?.department}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPasswordModal(true)}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shadow-sm"
              title="Change Password"
            >
              <Lock size={18} />
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition shadow-sm"
              title="Sign Out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>

        </div>

        {/* --- Tab Navigation Bar --- */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-2 no-scrollbar">
          {[
            { id: 'overview', label: 'Activity & Overview', icon: Sparkles },
            { id: 'attendance', label: 'Attendance & Calendar', icon: CalendarDays },
            { id: 'analytics', label: 'Analysis & Track Record', icon: TrendingUp },
            { id: 'leaves', label: 'Leave Management', icon: Umbrella, badge: dashboardData?.leave_summary?.pending },
            { id: 'queries', label: 'Disputes & Queries', icon: HelpCircle },
            { id: 'profile', label: 'My Profile & Security', icon: User }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-teal-400' : 'text-slate-400'} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* --- Main Body --- */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-teal-600">
            <RefreshCw className="animate-spin mb-4" size={36} />
            <p className="text-sm font-semibold text-slate-500">Loading your biometric activity & attendance profile...</p>
          </div>
        ) : (
          <>
            {/* ============================================================== */}
            {/* 1. ACTIVITY & OVERVIEW TAB */}
            {/* ============================================================== */}
            {activeTab === 'overview' && dashboardData && (
              <div className="space-y-8 animate-in fade-in duration-300">
                
                {/* Hero Greeting & Today Status Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-700/50">
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold mb-3">
                      <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span>
                      Active Employee Session • ID: {dashboardData.employee.employee_id}
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                      Welcome back, {dashboardData.employee.name.split(' ')[0]} 👋
                    </h2>
                    <p className="text-slate-300 text-xs sm:text-sm mt-1.5 max-w-xl font-medium">
                      Your real-time biometric scan record, monthly attendance KPIs, and leave balances are up to date.
                    </p>
                  </div>

                  {/* Today's Punch Card Widget */}
                  <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 min-w-[280px]">
                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                      <span className="text-xs uppercase tracking-wider font-bold text-slate-300">Today's Attendance</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        dashboardData.today.status === 'present' ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50' :
                        dashboardData.today.status === 'late' ? 'bg-amber-500/30 text-amber-300 border border-amber-400/50' :
                        dashboardData.today.status === 'weekend' ? 'bg-slate-500/30 text-slate-300' : 'bg-rose-500/30 text-rose-300 border border-rose-400/50'
                      }`}>
                        {dashboardData.today.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-black/20 p-2.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-semibold">Check-In</span>
                        <span className="text-base sm:text-lg font-mono font-bold text-teal-300">
                          {dashboardData.today.checkin || '--:--'}
                        </span>
                      </div>
                      <div className="bg-black/20 p-2.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-semibold">Check-Out</span>
                        <span className="text-base sm:text-lg font-mono font-bold text-teal-300">
                          {dashboardData.today.checkout || '--:--'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 text-center text-xs text-slate-300 font-medium">
                      Worked Today: <strong className="text-white">{dashboardData.today.duration}</strong>
                    </div>
                  </div>

                  {/* Decorative background glow */}
                  <div className="absolute top-0 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
                </div>

                {/* 4 Stat KPI Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  
                  {/* Metric 1: Monthly Attendance Rate */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attendance Rate</span>
                      <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                        <TrendingUp size={20} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900">{dashboardData.monthly_summary.attendance_rate}%</span>
                      <span className="text-xs font-bold text-emerald-600">This Month</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                      <div 
                        className="bg-teal-500 h-2 rounded-full transition-all duration-700" 
                        style={{ width: `${dashboardData.monthly_summary.attendance_rate}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Present {dashboardData.monthly_summary.present_days} of {dashboardData.monthly_summary.working_days} working days
                    </p>
                  </div>

                  {/* Metric 2: Punctuality Score */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Punctuality Score</span>
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <Clock size={20} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900">{dashboardData.monthly_summary.punctuality_rate}%</span>
                      <span className="text-xs font-bold text-blue-600">On Time</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-700" 
                        style={{ width: `${dashboardData.monthly_summary.punctuality_rate}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      {dashboardData.monthly_summary.late_days} late arrival(s) recorded this month
                    </p>
                  </div>

                  {/* Metric 3: Total Working Hours */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Working Hours</span>
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Award size={20} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900">{dashboardData.monthly_summary.total_hours}h</span>
                      <span className="text-xs font-bold text-slate-500">Logged</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-2 rounded-full transition-all duration-700" 
                        style={{ width: `${Math.min(100, (dashboardData.monthly_summary.total_hours / 160) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Daily average: {dashboardData.monthly_summary.avg_hours_per_day} hours/day
                    </p>
                  </div>

                  {/* Metric 4: Leave Balance */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Leaves</span>
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                        <Umbrella size={20} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900">{dashboardData.leave_summary.balance}</span>
                      <span className="text-xs font-bold text-purple-600">/ {dashboardData.leave_summary.total_quota} Days</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                      <div 
                        className="bg-purple-500 h-2 rounded-full transition-all duration-700" 
                        style={{ width: `${(dashboardData.leave_summary.balance / dashboardData.leave_summary.total_quota) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      {dashboardData.leave_summary.taken} taken • {dashboardData.leave_summary.pending} pending approval
                    </p>
                  </div>

                </div>

                {/* Quick Actions Row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setShowLeaveModal(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold text-xs sm:text-sm hover:opacity-95 shadow-lg shadow-teal-500/10 transition active:scale-95"
                  >
                    <Plus size={18} /> Apply for Leave
                  </button>
                  <button
                    onClick={() => setShowQueryModal(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-50 shadow-sm transition active:scale-95"
                  >
                    <FileQuestion size={18} className="text-amber-500" /> File Attendance Query / Dispute
                  </button>
                  <button
                    onClick={printAttendanceSlip}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-50 shadow-sm transition active:scale-95"
                  >
                    <Download size={18} className="text-blue-500" /> Print Monthly Slip
                  </button>
                </div>

                {/* Recent Activity Log & Company Notice Board */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Left 2 Cols: Recent Biometric Scans */}
                  <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">Recent Biometric Scan Activity</h3>
                        <p className="text-xs text-slate-500">Your latest facial recognition attendance events</p>
                      </div>
                      <button 
                        onClick={() => handleTabChange('attendance')}
                        className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                      >
                        View Full History <ChevronRight size={16} />
                      </button>
                    </div>

                    {dashboardData.recent_activity.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm">
                        No biometric scans recorded yet this month.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead>
                            <tr className="text-slate-400 text-[11px] uppercase tracking-wider border-b">
                              <th className="pb-3 font-semibold">Date</th>
                              <th className="pb-3 font-semibold">Check-In</th>
                              <th className="pb-3 font-semibold">Check-Out</th>
                              <th className="pb-3 font-semibold">Hours</th>
                              <th className="pb-3 font-semibold text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dashboardData.recent_activity.map(row => (
                              <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3.5 font-medium text-slate-900">
                                  {row.date} <span className="text-[11px] text-slate-400">({row.day})</span>
                                </td>
                                <td className="py-3.5 font-mono text-teal-600 font-semibold">{row.checkin || '--'}</td>
                                <td className="py-3.5 font-mono text-slate-600 font-semibold">{row.checkout || '--'}</td>
                                <td className="py-3.5 font-semibold text-slate-700">{row.duration}</td>
                                <td className="py-3.5 text-right">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                    row.status === 'present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    row.status === 'late' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {row.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Right Col: Anti-Spoof Security & Organization Guidelines */}
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">Security & Policy Policy</h4>
                          <span className="text-[10px] font-bold text-emerald-600">Anti-Proxy Shield Active</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed mb-4">
                        Our terminal uses deep-learning <strong>Silent Face Anti-Spoofing</strong>. Attempting to scan hard copies, printed photos, or mobile screens for proxy attendance is forbidden and flagged automatically.
                      </p>

                      <div className="space-y-2.5 text-xs text-slate-600 border-t pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Official Shift:</span>
                          <strong className="text-slate-800">09:00 AM – 06:00 PM</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Grace Arrival:</span>
                          <strong className="text-slate-800">Until 09:30 AM</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Late Penalty:</span>
                          <strong className="text-amber-600">Marked after 09:30 AM</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Leave Balance:</span>
                          <strong className="text-teal-600 font-bold">{dashboardData.leave_summary.balance} Days Left</strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t">
                      <button
                        onClick={() => handleTabChange('queries')}
                        className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <FileQuestion size={14} className="text-amber-500" />
                        Dispute a Missed Punch
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* ============================================================== */}
            {/* 2. ATTENDANCE & CALENDAR TAB */}
            {/* ============================================================== */}
            {activeTab === 'attendance' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {/* Header Controls */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Monthly Attendance Record & Calendar</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Comprehensive calendar heatmap and daily check-in / check-out times</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={handleMonthChange}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                    <button
                      onClick={printAttendanceSlip}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Download size={16} /> Print Slip
                    </button>
                  </div>
                </div>

                {attendanceData && (
                  <>
                    {/* Monthly Metric Highlights */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/70 text-center shadow-sm">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Present Days</span>
                        <p className="text-2xl font-black text-emerald-600 mt-1">{attendanceData.summary.present_days}</p>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/70 text-center shadow-sm">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Late Arrivals</span>
                        <p className="text-2xl font-black text-amber-600 mt-1">{attendanceData.summary.late_days}</p>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/70 text-center shadow-sm">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Absences</span>
                        <p className="text-2xl font-black text-rose-600 mt-1">{attendanceData.summary.absent_days}</p>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/70 text-center shadow-sm">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Total Hours</span>
                        <p className="text-2xl font-black text-teal-600 mt-1">{attendanceData.summary.total_hours}h</p>
                      </div>
                    </div>

                    {/* Interactive Calendar Grid */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="font-bold text-slate-900 text-base">{attendanceData.month_label} Heatmap</h4>
                        <div className="flex items-center gap-3 text-xs font-semibold flex-wrap">
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Present</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Late</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500"></span> Absent</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500"></span> Leave</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-300"></span> Weekend</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase mb-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                          <div key={day} className="py-1">{day}</div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {attendanceData.days.map(d => {
                          const isPresent = d.status === 'present';
                          const isLate = d.status === 'late';
                          const isAbsent = d.status === 'absent';
                          const isLeave = d.status === 'on_leave';
                          const isWeekend = d.is_weekend;
                          const isFuture = d.is_future;

                          return (
                            <div 
                              key={d.date}
                              className={`aspect-square rounded-2xl p-2 flex flex-col justify-between border transition-all ${
                                isPresent ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' :
                                isLate ? 'bg-amber-50/80 border-amber-200 text-amber-950' :
                                isAbsent ? 'bg-rose-50/80 border-rose-200 text-rose-950' :
                                isLeave ? 'bg-purple-50/80 border-purple-200 text-purple-950' :
                                isWeekend ? 'bg-slate-100/60 border-slate-200 text-slate-400' :
                                'bg-slate-50 border-slate-100 text-slate-300'
                              }`}
                              title={`${d.date}: ${d.status} (${d.checkin || ''} - ${d.checkout || ''})`}
                            >
                              <div className="flex justify-between items-center text-[11px] font-bold">
                                <span>{d.day_number}</span>
                                {isPresent && <Check size={12} className="text-emerald-600" />}
                                {isLate && <Clock size={12} className="text-amber-600" />}
                                {isAbsent && <X size={12} className="text-rose-600" />}
                              </div>

                              <div className="text-[10px] truncate font-mono">
                                {d.checkin ? d.checkin.slice(0, 5) : (isLeave ? 'LEAVE' : isWeekend ? 'OFF' : '--')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Detailed Tabular Log */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
                      <h4 className="font-bold text-slate-900 text-base mb-4">Detailed Daily Punch Times</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead>
                            <tr className="text-slate-400 text-[11px] uppercase tracking-wider border-b">
                              <th className="pb-3 font-semibold">Date</th>
                              <th className="pb-3 font-semibold">Day</th>
                              <th className="pb-3 font-semibold">In Time</th>
                              <th className="pb-3 font-semibold">Out Time</th>
                              <th className="pb-3 font-semibold">Hours</th>
                              <th className="pb-3 font-semibold">Status</th>
                              <th className="pb-3 font-semibold text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {attendanceData.days.filter(d => !d.is_future).map(d => (
                              <tr key={d.date} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 font-medium text-slate-900">{d.date}</td>
                                <td className="py-3 text-slate-500">{d.day_of_week}</td>
                                <td className="py-3 font-mono font-bold text-teal-600">{d.checkin || '--:--'}</td>
                                <td className="py-3 font-mono font-semibold text-slate-600">{d.checkout || '--:--'}</td>
                                <td className="py-3 font-medium text-slate-700">{d.duration}</td>
                                <td className="py-3">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    d.status === 'present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    d.status === 'late' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    d.status === 'on_leave' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                    d.status === 'weekend' ? 'bg-slate-100 text-slate-500' :
                                    'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {d.status}
                                  </span>
                                </td>
                                <td className="py-3 text-right">
                                  {d.status === 'absent' && (
                                    <button
                                      onClick={() => {
                                        setQueryDate(d.date);
                                        setShowQueryModal(true);
                                      }}
                                      className="text-xs text-amber-600 hover:text-amber-700 font-bold"
                                    >
                                      Report Issue
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

              </div>
            )}

            {/* ============================================================== */}
            {/* 3. ANALYSIS & TRACK RECORD TAB */}
            {/* ============================================================== */}
            {activeTab === 'analytics' && analyticsData && (
              <div className="space-y-8 animate-in fade-in duration-300">
                
                {/* Performance Rating Card */}
                <div className="bg-gradient-to-r from-slate-900 to-teal-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-400/20 border border-teal-300/30 text-teal-300 text-xs font-bold mb-2">
                      <Award size={14} /> Biometric Reliability Score
                    </div>
                    <h3 className="text-3xl font-extrabold">{analyticsData.summary.performance_badge}</h3>
                    <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-lg">
                      Based on {analyticsData.summary.total_records_analyzed} check-ins analyzed over the past 90 days.
                    </p>
                  </div>

                  <div className="text-center bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 min-w-[200px]">
                    <span className="text-xs text-slate-300 uppercase tracking-wider font-bold">Punctuality Score</span>
                    <p className="text-4xl font-black text-teal-300 mt-1">{analyticsData.summary.punctuality_score}%</p>
                  </div>
                </div>

                {/* 6-Month Trend Chart */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">6-Month Attendance Percentage Trajectory</h3>
                  <p className="text-xs text-slate-500 mb-8">Long-term consistency and attendance rate history</p>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                    {analyticsData.monthly_trends.map(m => (
                      <div key={m.month} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between h-48">
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{m.month_name}</span>
                          <span className="text-2xl font-black text-teal-600 block mt-1">{m.attendance_rate}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden my-2">
                          <div className="bg-teal-600 h-2 rounded-full" style={{ width: `${m.attendance_rate}%` }}></div>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          <span>{m.present} days present</span><br/>
                          <span>{m.total_hours}h worked</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Punctuality Breakdown & Day of Week Consistency */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* Punctuality Spread */}
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Check-in Punctuality Spread</h3>
                    <p className="text-xs text-slate-500 mb-6">Arrival time distribution relative to standard 09:00 AM shift</p>

                    <div className="space-y-4">
                      {[
                        { label: 'Early Birds (< 09:00 AM)', count: analyticsData.punctuality_breakdown.early, color: 'bg-emerald-500' },
                        { label: 'On Time (09:00 - 09:30 AM)', count: analyticsData.punctuality_breakdown.on_time, color: 'bg-teal-500' },
                        { label: 'Grace Late (09:30 - 10:00 AM)', count: analyticsData.punctuality_breakdown.grace_late, color: 'bg-amber-500' },
                        { label: 'Severe Late (> 10:00 AM)', count: analyticsData.punctuality_breakdown.severe_late, color: 'bg-rose-500' }
                      ].map(item => {
                        const total = analyticsData.summary.total_records_analyzed || 1;
                        const pct = Math.round((item.count / total) * 100);
                        return (
                          <div key={item.label}>
                            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                              <span>{item.label}</span>
                              <span>{item.count} times ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                              <div className={`${item.color} h-3 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Day of Week Attendance Consistency */}
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Weekly Day-by-Day Consistency</h3>
                    <p className="text-xs text-slate-500 mb-6">Attendance check-in frequency by weekday</p>

                    <div className="space-y-3.5">
                      {Object.entries(analyticsData.day_of_week_distribution).map(([day, cnt]) => {
                        return (
                          <div key={day} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-sm font-bold text-slate-800">{day}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-teal-600">{cnt} Scans</span>
                              <CheckCircle2 size={16} className="text-emerald-500" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* ============================================================== */}
            {/* 4. LEAVE MANAGEMENT TAB */}
            {/* ============================================================== */}
            {activeTab === 'leaves' && leavesData && (
              <div className="space-y-8 animate-in fade-in duration-300">
                
                {/* Header & Apply CTA */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Leave Balance & Requests</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Track your annual leave quotas, applied leaves, and approval status</p>
                  </div>
                  <button
                    onClick={() => setShowLeaveModal(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold text-sm shadow-md hover:opacity-95 transition active:scale-95 shrink-0"
                  >
                    <Plus size={18} /> Apply for Leave
                  </button>
                </div>

                {/* 4 Leave Category Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {leavesData.categories.map(cat => (
                    <div key={cat.type} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{cat.type}</span>
                        <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                          <Umbrella size={18} />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-slate-900">{cat.balance}</span>
                        <span className="text-xs font-bold text-slate-400">/ {cat.quota} Days Left</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                        <div 
                          className="bg-teal-500 h-2 rounded-full" 
                          style={{ width: `${cat.quota > 0 ? (cat.balance / cat.quota) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2 font-medium">
                        <span>Taken: {cat.taken}d</span>
                        {cat.pending > 0 && <span className="text-amber-600 font-bold">{cat.pending}d pending</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Leave Applications History Table */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
                  <h4 className="font-bold text-slate-900 text-base mb-4">Your Leave Applications</h4>
                  
                  {leavesData.requests.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      No leave requests filed yet. Click "Apply for Leave" to request time off.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="text-slate-400 text-[11px] uppercase tracking-wider border-b">
                            <th className="pb-3 font-semibold">Type</th>
                            <th className="pb-3 font-semibold">Dates</th>
                            <th className="pb-3 font-semibold">Duration</th>
                            <th className="pb-3 font-semibold">Reason</th>
                            <th className="pb-3 font-semibold">Status</th>
                            <th className="pb-3 font-semibold">HR Remarks</th>
                            <th className="pb-3 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {leavesData.requests.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 font-bold text-slate-900">{r.leave_type}</td>
                              <td className="py-3.5 font-mono text-slate-700">{r.start_date} to {r.end_date}</td>
                              <td className="py-3.5 font-bold text-slate-800">{r.days_count} Day(s)</td>
                              <td className="py-3.5 text-slate-600 max-w-xs truncate">{r.reason}</td>
                              <td className="py-3.5">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                  r.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  r.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-3.5 text-xs text-slate-500 italic">
                                {r.review_notes || '--'}
                              </td>
                              <td className="py-3.5 text-right">
                                {r.status === 'pending' && (
                                  <button
                                    onClick={() => handleCancelLeave(r.id)}
                                    className="text-xs text-rose-600 hover:text-rose-800 font-bold"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ============================================================== */}
            {/* 5. ATTENDANCE DISPUTES & QUERIES TAB */}
            {/* ============================================================== */}
            {activeTab === 'queries' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Attendance Disputes & Correction Requests</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Missed a scan, biometric camera issue, or marked absent? Submit a query to HR.</p>
                  </div>
                  <button
                    onClick={() => setShowQueryModal(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md transition active:scale-95 shrink-0"
                  >
                    <Plus size={18} /> New Attendance Dispute
                  </button>
                </div>

                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
                  <h4 className="font-bold text-slate-900 text-base mb-4">Your Filed Attendance Queries</h4>
                  
                  {queriesData.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      No attendance queries filed. All your biometric punches are in order!
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="text-slate-400 text-[11px] uppercase tracking-wider border-b">
                            <th className="pb-3 font-semibold">Date</th>
                            <th className="pb-3 font-semibold">Issue Category</th>
                            <th className="pb-3 font-semibold">Proposed Times</th>
                            <th className="pb-3 font-semibold">Explanation</th>
                            <th className="pb-3 font-semibold">Status</th>
                            <th className="pb-3 font-semibold">HR Response</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {queriesData.map(q => (
                            <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 font-bold text-slate-900">{q.date}</td>
                              <td className="py-3.5 font-semibold text-slate-700">{q.reason_category}</td>
                              <td className="py-3.5 font-mono text-slate-600">{q.checkin_time} – {q.checkout_time || '--'}</td>
                              <td className="py-3.5 text-slate-600 max-w-xs truncate">{q.explanation}</td>
                              <td className="py-3.5">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                  q.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  q.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {q.status}
                                </span>
                              </td>
                              <td className="py-3.5 text-xs text-slate-500 italic">
                                {q.hr_notes || (q.status === 'pending' ? 'Pending HR Review' : '--')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* 6. PROFILE & SECURITY TAB */}
            {/* ============================================================== */}
            {activeTab === 'profile' && profile && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
                
                {/* Profile Card */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100">
                    {profile.profile_picture ? (
                      <img 
                        src={getProfileImageUrl(profile.profile_picture)} 
                        alt={profile.name} 
                        className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-md ring-2 ring-slate-100"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-3xl bg-teal-600 text-white font-extrabold flex items-center justify-center text-3xl shadow-md">
                        {profile.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="text-center sm:text-left">
                      <h3 className="text-2xl font-black text-slate-900">{profile.name}</h3>
                      <p className="text-sm font-semibold text-teal-600">{profile.position || 'Staff'}</p>
                      <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start flex-wrap">
                        <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg font-bold border border-slate-200">
                          Employee ID: {profile.employee_id}
                        </span>
                        <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-lg font-bold border border-teal-200">
                          {profile.department}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact & Meta Form */}
                  <form onSubmit={handleUpdateProfile} className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1.5">Email Address</label>
                        <div className="relative">
                          <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => { setEditEmail(e.target.value); setIsEditingProfile(true); }}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                            placeholder="Enter your email"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1.5">Phone Number</label>
                        <div className="relative">
                          <Phone size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => { setEditPhone(e.target.value); setIsEditingProfile(true); }}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                            placeholder="Enter your phone number"
                          />
                        </div>
                      </div>
                    </div>

                    {isEditingProfile && (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
                        >
                          {actionLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    )}
                  </form>
                </div>

                {/* Password & Security Card */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">Portal Password & Security</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Keep your credentials updated to safeguard your personal dashboard access.</p>
                  </div>
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center gap-1.5"
                  >
                    <Lock size={16} /> Change Password
                  </button>
                </div>

              </div>
            )}
          </>
        )}

      </main>

      {/* ============================================================== */}
      {/* MODAL: APPLY FOR LEAVE */}
      {/* ============================================================== */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowLeaveModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full transition"
            >
              <X size={18} />
            </button>

            <div className="mb-6">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                <Umbrella size={24} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">Apply for Leave</h3>
              <p className="text-xs text-slate-500 mt-1">Submit your time-off request for HR review & approval</p>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Leave Category</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="Casual Leave">Casual Leave (Balance: 10d)</option>
                  <option value="Sick Leave">Sick Leave (Balance: 8d)</option>
                  <option value="Paid / Annual Leave">Paid / Annual Leave (Balance: 6d)</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>

              {leaveDaysCalc > 0 && (
                <div className="p-3 bg-teal-50 text-teal-800 rounded-xl text-xs font-bold flex items-center justify-between border border-teal-200">
                  <span>Total Duration:</span>
                  <span className="font-extrabold text-sm">{leaveDaysCalc} Day(s)</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Leave</label>
                <textarea
                  required
                  rows={3}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                  placeholder="Explain reason for time-off..."
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="animate-spin" size={16} /> : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: SUBMIT ATTENDANCE DISPUTE */}
      {/* ============================================================== */}
      {showQueryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowQueryModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full transition"
            >
              <X size={18} />
            </button>

            <div className="mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                <FileQuestion size={24} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">File Attendance Query</h3>
              <p className="text-xs text-slate-500 mt-1">Dispute an incorrect absence or request a punch correction</p>
            </div>

            <form onSubmit={handleSubmitQuery} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Date of Issue</label>
                <input
                  type="date"
                  required
                  value={queryDate}
                  onChange={(e) => setQueryDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                <select
                  value={queryCategory}
                  onChange={(e) => setQueryCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="Missed Face Scan">Missed Biometric Camera Scan</option>
                  <option value="Forgot Check-Out">Forgot to Scan Check-Out</option>
                  <option value="On Duty / Client Visit">On Duty / Client Visit Outside</option>
                  <option value="System Glitch">Camera / Terminal Glitch</option>
                  <option value="Other">Other Discrepancy</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Claimed In Time</label>
                  <input
                    type="time"
                    step="1"
                    value={queryCheckin}
                    onChange={(e) => setQueryCheckin(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Claimed Out Time</label>
                  <input
                    type="time"
                    step="1"
                    value={queryCheckout}
                    onChange={(e) => setQueryCheckout(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Explanation to HR</label>
                <textarea
                  required
                  rows={3}
                  value={queryExplanation}
                  onChange={(e) => setQueryExplanation(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                  placeholder="Provide context on why the punch was missed or disputed..."
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowQueryModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="animate-spin" size={16} /> : 'Submit Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CHANGE PASSWORD */}
      {/* ============================================================== */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full transition"
            >
              <X size={18} />
            </button>

            <div className="mb-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mb-3">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">Change Portal Password</h3>
              <p className="text-xs text-slate-500 mt-1">Set a personal password for signing in with Employee ID</p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Current Password</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">New Password</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Confirm New Password</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="showpwd" 
                  checked={showPwd} 
                  onChange={() => setShowPwd(!showPwd)} 
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="showpwd" className="text-xs text-slate-600 cursor-pointer select-none">Show passwords</label>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="animate-spin" size={16} /> : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

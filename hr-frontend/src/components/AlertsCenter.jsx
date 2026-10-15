import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Bell, AlertTriangle, AlertOctagon, CheckCircle2, UserPlus, 
  Trash2, Check, RefreshCw, Search, ShieldAlert, ArrowRight,
  TrendingUp, Users, Building2, ExternalLink, Info, Clock,
  Flame, CheckCircle, Calendar, Shield, Sparkles, ChevronRight, ChevronLeft, X
} from 'lucide-react';
import { apiCall, getWebSocketUrl, getProfileImageUrl } from '../api';

export default function AlertsCenter() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({
    total_alerts: 0,
    unread_count: 0,
    critical_count: 0,
    warning_count: 0,
    attendance_alerts_count: 0,
    late_alerts_count: 0,
    limits_alerts_count: 0,
    attendance_rate: 100,
    present_today: 0,
    total_employees: 0,
    habitual_late_count: 0,
    seat_usage: { current: 0, limit: 50, pct: 0, plan: 'Basic Plan', remaining: 50 }
  });
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, unread, attendance, late, limits, critical
  const [toast, setToast] = useState(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/alerts');
      if (data.status === 'success') {
        setAlerts(data.alerts || []);
        setSummary(data.summary || {});
        setWatchlist(data.watchlist || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Listen to WebSocket for live gate & attendance events
    let ws = null;
    let isSubscribed = true;

    try {
      ws = new WebSocket(getWebSocketUrl('/ws/attendance'));
      ws.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ATTENDANCE_MARKED' || msg.type === 'CHECKOUT_MARKED' || msg.type === 'UNKNOWN_FACE' || msg.type === 'SPOOF_ATTACK_DETECTED') {
            fetchAlerts();
          }
        } catch (err) {}
      };
    } catch (e) {
      console.warn('WS Init failed:', e);
    }

    return () => {
      isSubscribed = false;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      }
    };
  }, []);

  const handleMarkAsRead = async (alertId) => {
    try {
      await apiCall(`/alerts/${alertId}/read`, { method: 'PUT' });
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
      setSummary(prev => ({
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1)
      }));
      setToast({ type: 'success', message: 'Alert marked as read' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to mark alert as read');
    }
  };

  const handleMarkAllRead = async () => {
    setActionLoading(true);
    try {
      await apiCall('/alerts/mark-all-read', { method: 'PUT' });
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
      setSummary(prev => ({ ...prev, unread_count: 0 }));
      setToast({ type: 'success', message: 'All alerts marked as read' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to mark all alerts as read');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async (alertId) => {
    try {
      await apiCall(`/alerts/${alertId}`, { method: 'DELETE' });
      const removed = alerts.find(a => a.id === alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      if (removed && !removed.is_read) {
        setSummary(prev => ({
          ...prev,
          unread_count: Math.max(0, prev.unread_count - 1),
          total_alerts: Math.max(0, prev.total_alerts - 1)
        }));
      }
      setToast({ type: 'info', message: 'Alert dismissed' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to dismiss alert');
    }
  };

  // Format relative time
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = 
      (alert.title && alert.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (alert.message && alert.message.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (alert.type && alert.type.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'unread') return !alert.is_read;
    if (filterType === 'attendance') return alert.type === 'LOW_ATTENDANCE';
    if (filterType === 'late') return alert.type === 'HABITUAL_LATE';
    if (filterType === 'limits') return alert.type === 'LIMIT_WARNING' || alert.type === 'LIMIT_EXCEEDED';
    if (filterType === 'critical') return alert.severity === 'critical';
    return true;
  });

  // Severity styles helper
  const getSeverityBadge = (severity, type) => {
    if (type === 'PROXY_ATTACK_ATTEMPT') {
      return {
        bg: 'bg-rose-50 border-rose-200 text-rose-700',
        dot: 'bg-rose-600',
        icon: <ShieldAlert size={16} className="text-rose-600" />,
        label: 'Photo Proxy Blocked'
      };
    }
    if (type === 'LOW_ATTENDANCE') {
      return {
        bg: severity === 'critical' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700',
        dot: severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500',
        icon: <Users size={16} className={severity === 'critical' ? 'text-rose-600' : 'text-amber-600'} />,
        label: severity === 'critical' ? 'Critical Attendance' : 'Attendance Warning'
      };
    }
    if (type === 'HABITUAL_LATE') {
      return {
        bg: severity === 'critical' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700',
        dot: 'bg-amber-500',
        icon: <Clock size={16} className="text-amber-600" />,
        label: 'Habitual Late'
      };
    }
    if (type === 'LIMIT_EXCEEDED' || type === 'LIMIT_WARNING') {
      return {
        bg: type === 'LIMIT_EXCEEDED' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700',
        dot: type === 'LIMIT_EXCEEDED' ? 'bg-rose-500' : 'bg-amber-500',
        icon: <ShieldAlert size={16} className={type === 'LIMIT_EXCEEDED' ? 'text-rose-600' : 'text-amber-600'} />,
        label: type === 'LIMIT_EXCEEDED' ? 'Seat Limit Reached' : 'Capacity Warning'
      };
    }

    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-700',
          dot: 'bg-rose-500',
          icon: <AlertOctagon size={16} className="text-rose-600" />,
          label: 'Critical'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-700',
          dot: 'bg-amber-500',
          icon: <AlertTriangle size={16} className="text-amber-600" />,
          label: 'Warning'
        };
      case 'success':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
          dot: 'bg-emerald-500',
          icon: <CheckCircle2 size={16} className="text-emerald-600" />,
          label: 'Success'
        };
      default:
        return {
          bg: 'bg-sky-50 border-sky-200 text-sky-700',
          dot: 'bg-sky-500',
          icon: <Info size={16} className="text-sky-600" />,
          label: 'Information'
        };
    }
  };

  const getActionDetails = (alert) => {
    if (alert.type === 'LOW_ATTENDANCE') {
      return {
        label: 'View Live Gate Logs',
        link: '/',
        icon: <Users size={13} />
      };
    }
    if (alert.type === 'HABITUAL_LATE') {
      return {
        label: 'Inspect Late Records in Reports',
        link: '/reports',
        icon: <Clock size={13} />
      };
    }
    if (alert.type === 'LIMIT_WARNING' || alert.type === 'LIMIT_EXCEEDED') {
      return {
        label: 'View Plan & Seat Limits',
        link: '/settings',
        icon: <Shield size={13} />
      };
    }
    return {
      label: 'View Employee Directory',
      link: '/employees',
      icon: <ArrowRight size={13} />
    };
  };

  const attRate = summary.attendance_rate !== undefined ? summary.attendance_rate : 100;
  const isAttRateLow = attRate < 70 && summary.total_employees > 0;
  const isAttRateCritical = attRate < 50 && summary.total_employees > 0;
  const seatUsage = summary.seat_usage || { current: 0, limit: 50, pct: 0, plan: 'Basic Plan', remaining: 50 };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 animate-in slide-in-from-top duration-300">
          <div className={`w-2.5 h-2.5 rounded-full ${toast.type === 'success' ? 'bg-emerald-400' : 'bg-sky-400'}`} />
          <span className="text-xs font-bold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-white/60 hover:text-white ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* HEADER HERO SECTION */}
      <div className="bg-gradient-to-r from-brand-navy via-slate-900 to-brand-dark rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-white/10">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-brand-teal/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-80 h-40 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <button
              onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
              className="w-10 h-10 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shadow-sm shrink-0 mt-1"
              title="Back to Previous Page"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/15 rounded-full text-xs font-semibold text-brand-teal uppercase tracking-wider backdrop-blur-sm">
                <ShieldAlert size={14} />
                Intelligent Workforce Monitoring
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                Smart Alerts Center
                {summary.unread_count > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white shadow-sm animate-pulse">
                    {summary.unread_count} Unread
                  </span>
                )}
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                Automated real-time anomaly detection for low workforce attendance rates (&lt;70%), habitual late arrivals (&ge;3 times/month), and plan seat limits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={fetchAlerts}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-sm font-semibold transition border border-white/10 backdrop-blur-sm shadow-sm"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            {summary.unread_count > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand-teal hover:bg-emerald-500 active:scale-95 text-slate-900 rounded-xl text-sm font-bold transition shadow-lg shadow-teal-500/20"
              >
                <Check size={16} />
                Mark All Read
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4 CORE KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Active / Unread Alerts */}
        <div 
          onClick={() => setFilterType('unread')}
          className={`cursor-pointer bg-white rounded-2xl p-5 border transition-all duration-200 shadow-sm hover:shadow-md ${
            filterType === 'unread' ? 'border-brand-teal ring-2 ring-brand-teal/20' : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Unread Alerts</span>
            <div className={`p-2.5 rounded-xl ${summary.unread_count > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
              <Bell size={20} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-3">{summary.unread_count}</p>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span>Total stored: {summary.total_alerts}</span>
            {summary.critical_count > 0 && (
              <span className="text-rose-600 font-bold ml-auto">{summary.critical_count} critical</span>
            )}
          </p>
        </div>

        {/* Card 2: Today's Attendance Health (<70% Threshold) */}
        <div 
          onClick={() => setFilterType('attendance')}
          className={`cursor-pointer bg-white rounded-2xl p-5 border transition-all duration-200 shadow-sm hover:shadow-md ${
            filterType === 'attendance' 
              ? 'border-amber-500 ring-2 ring-amber-500/20' 
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Attendance Rate</span>
            <div className={`p-2.5 rounded-xl ${
              isAttRateCritical ? 'bg-rose-50 text-rose-600' : isAttRateLow ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <Users size={20} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <p className={`text-3xl font-black ${
              isAttRateCritical ? 'text-rose-600' : isAttRateLow ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              {attRate}%
            </p>
            <span className="text-xs text-slate-400 font-medium">({summary.present_today}/{summary.total_employees})</span>
          </div>
          <p className="text-xs font-semibold mt-1">
            {isAttRateCritical ? (
              <span className="text-rose-600">⚠️ Critical drop (&lt;50%)</span>
            ) : isAttRateLow ? (
              <span className="text-amber-600">⚠️ Below 70% threshold</span>
            ) : (
              <span className="text-emerald-600">✓ Healthy attendance level</span>
            )}
          </p>
        </div>

        {/* Card 3: Habitual Late-Comers */}
        <div 
          onClick={() => setFilterType('late')}
          className={`cursor-pointer bg-white rounded-2xl p-5 border transition-all duration-200 shadow-sm hover:shadow-md ${
            filterType === 'late' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Late-Comers (&ge;3x)</span>
            <div className={`p-2.5 rounded-xl ${summary.habitual_late_count > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
              <Clock size={20} />
            </div>
          </div>
          <p className={`text-3xl font-black mt-3 ${summary.habitual_late_count > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {summary.habitual_late_count}
          </p>
          <p className="text-xs text-slate-500 mt-1">Flagged in last 30 days</p>
        </div>

        {/* Card 4: Seat / Plan Capacity */}
        <div 
          onClick={() => setFilterType('limits')}
          className={`cursor-pointer bg-white rounded-2xl p-5 border transition-all duration-200 shadow-sm hover:shadow-md ${
            filterType === 'limits' ? 'border-brand-teal ring-2 ring-brand-teal/20' : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Seat Capacity</span>
            <div className={`p-2.5 rounded-xl ${
              seatUsage.pct >= 100 ? 'bg-rose-50 text-rose-600' : seatUsage.pct >= 80 ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
            }`}>
              <Shield size={20} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <p className="text-3xl font-black text-slate-900">{seatUsage.current}/{seatUsage.limit}</p>
            <span className={`text-xs font-bold ${
              seatUsage.pct >= 100 ? 'text-rose-600' : seatUsage.pct >= 80 ? 'text-amber-600' : 'text-slate-500'
            }`}>
              {seatUsage.pct}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{seatUsage.remaining} seats remaining ({seatUsage.plan})</p>
        </div>

      </div>

      {/* HABITUAL LATE-COMERS WATCHLIST SECTION */}
      {watchlist.length > 0 && (
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Clock size={20} className="text-amber-500" />
                Habitual Late-Comers Watchlist
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  {watchlist.length} Flagged
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Employees who have checked in late 3 or more times during the past 30 days.
              </p>
            </div>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-teal hover:text-brand-blue transition"
            >
              Open Full Attendance Reports <ExternalLink size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map((emp) => {
              const isCrit = emp.late_count >= 5;
              return (
                <div 
                  key={emp.employee_id} 
                  className={`p-4 rounded-xl border transition-all ${
                    isCrit 
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300' 
                      : 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {emp.profile_picture ? (
                        <img
                          src={getProfileImageUrl(emp.profile_picture)}
                          alt={emp.name}
                          className="w-10 h-10 rounded-full object-cover shadow-xs border border-white flex-shrink-0"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-tr from-brand-navy to-brand-teal text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0 ${emp.profile_picture ? 'hidden' : 'flex'}`}>
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{emp.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">{emp.employee_id} • {emp.department}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shrink-0 ${
                      isCrit ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {emp.late_count}x Late
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Latest Late Check-in:</span>
                      <span className="font-mono font-semibold text-slate-800">{emp.latest_late_date} ({emp.latest_checkin || 'N/A'})</span>
                    </div>
                    {emp.recent_dates && emp.recent_dates.length > 0 && (
                      <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
                        {emp.recent_dates.slice(0, 4).map((d, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-white text-[10px] font-mono text-slate-600 border border-slate-200">
                            {d.date.split('-').slice(1).join('/')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 flex justify-end">
                    <button
                      onClick={() => navigate(`/reports?employee=${encodeURIComponent(emp.name)}`)}
                      className="text-xs font-bold text-brand-teal hover:text-brand-blue flex items-center gap-1 hover:underline"
                    >
                      View Log History <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ALERT FEED AND FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        
        {/* CONTROLS HEADER */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          
          {/* FILTER TABS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All Alerts' },
              { id: 'unread', label: `Unread (${summary.unread_count})` },
              { id: 'attendance', label: 'Low Attendance (<70%)' },
              { id: 'late', label: `Late Arrivals (${summary.late_alerts_count || 0})` },
              { id: 'limits', label: 'Plan & Seat Limits' },
              { id: 'critical', label: 'Critical Only' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  filterType === tab.id
                    ? 'bg-brand-navy text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* SEARCH BOX */}
          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search alerts or staff..."
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl text-xs sm:text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

        </div>

        {/* ALERTS LIST */}
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <RefreshCw size={28} className="animate-spin text-brand-teal mx-auto" />
              <p className="text-sm font-semibold text-slate-500">Scanning workforce alerts & operational thresholds...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-base font-bold text-slate-800">No Alerts Found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {filterType === 'all' 
                  ? 'All workforce metrics, attendance levels, and seat capacity limits are operating smoothly.' 
                  : `No matching alerts for filter "${filterType}".`}
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const badge = getSeverityBadge(alert.severity, alert.type);
              const action = getActionDetails(alert);

              return (
                <div 
                  key={alert.id}
                  className={`p-5 sm:p-6 transition-all duration-200 flex flex-col md:flex-row md:items-start justify-between gap-4 ${
                    !alert.is_read ? 'bg-sky-50/30 hover:bg-sky-50/60' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="pt-0.5 flex-shrink-0">
                      <div className={`p-2.5 rounded-xl border ${badge.bg}`}>
                        {badge.icon}
                      </div>
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {!alert.is_read && (
                          <span className="w-2 h-2 rounded-full bg-sky-500 ring-4 ring-sky-100" />
                        )}
                        <span className="text-[11px] text-slate-400 font-medium">
                          {formatTimeAgo(alert.created_at)}
                        </span>
                      </div>

                      <h3 className={`text-sm sm:text-base font-bold tracking-tight ${!alert.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                        {alert.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {alert.message}
                      </p>

                      {/* Structured alert tags/data */}
                      {alert.data && (
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          {alert.data.rate !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono text-slate-700 font-semibold">
                              Rate: {alert.data.rate}% (Threshold: {alert.data.threshold || 70}%)
                            </span>
                          )}
                          {alert.data.present !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono text-slate-700">
                              Present: {alert.data.present}/{alert.data.total}
                            </span>
                          )}
                          {alert.data.flagged_count !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                              {alert.data.flagged_count} Staff Flagged
                            </span>
                          )}
                          {alert.data.pct !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono text-slate-700">
                              Seats: {alert.data.current}/{alert.data.limit} ({alert.data.pct}%)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ACTION CONTROLS */}
                  <div className="flex items-center gap-2 self-end md:self-start flex-shrink-0 pt-2 md:pt-0">
                    <Link
                      to={action.link}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                    >
                      {action.icon}
                      {action.label}
                    </Link>

                    {!alert.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(alert.id)}
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-brand-teal rounded-lg transition"
                        title="Mark as read"
                      >
                        <Check size={16} />
                      </button>
                    )}

                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      title="Dismiss alert"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

    </div>
  );
}

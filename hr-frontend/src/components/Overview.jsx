import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiCall, getWebSocketUrl, getProfileImageUrl } from '../api';
import { 
  Users, FileQuestion, 
  UserCheck, 
  Clock, 
  AlertTriangle, 
  Search, 
  ArrowUpRight, 
  CheckCircle2, 
  LogOut, 
  UserPlus, 
  FileText, 
  Camera,
  X, 
  Filter, 
  Bell, 
  ShieldAlert, 
  Shield, 
  ChevronRight, 
  TrendingUp,
  Sparkles,
  RefreshCw,
  Download,
  Building2,
  Zap,
  Award,
  Activity,
  Check,
  BarChart3,
  PieChart,
  Layers,
  ArrowDownRight,
  Radio
} from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { generateGranularEmployeePDF } from '../utils/pdfGenerator';
import GranularReportModal from './GranularReportModal';

export default function Overview() {
  const outletContext = useOutletContext() || {};
  const { alertsSummary } = outletContext;

  const [summary, setSummary] = useState(null);
  const [trendsData, setTrendsData] = useState([]);
  const [companyName, setCompanyName] = useState('Enterprise Attendance');
  const [logoUrl, setLogoUrl] = useState('');
  const [downloadingEmpId, setDownloadingEmpId] = useState(null);
  const [reportModalEmp, setReportModalEmp] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptSearchQuery, setDeptSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, present, late, checkout, in_office
  const [chartMode, setChartMode] = useState('rate'); // 'rate' or 'count'
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState(null);
  const [toast, setToast] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const handleDownloadEmployeePDF = (row) => {
    if (!row) return;
    setReportModalEmp({
      employee_id: row.employee_id,
      name: row.name,
      department: row.department || row.domain,
      position: row.position,
      profile_picture: row.profile_picture
    });
    setIsReportModalOpen(true);
  };

  // Load Company Settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await apiCall('/settings/');
        if (data) {
          if (data.companyName) setCompanyName(data.companyName);
          if (data.logoUrl) setLogoUrl(data.logoUrl);
        }
      } catch {
        const saved = localStorage.getItem('companyName');
        const savedLogo = localStorage.getItem('logoUrl');
        if (saved) setCompanyName(saved);
        if (savedLogo) setLogoUrl(savedLogo);
      }
    };
    loadSettings();
  }, []);

  // Live Digital Clock (ticking every second)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today summary & 7-day trend data
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [todayRes, analyticsRes] = await Promise.allSettled([
        apiCall('/attendance/today'),
        apiCall('/analytics/overview?range_filter=7d')
      ]);

      if (todayRes.status === 'fulfilled' && todayRes.value?.summary) {
        setSummary(todayRes.value.summary);
      }

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.trends) {
        setTrendsData(analyticsRes.value.trends);
      }
    } catch (err) {
      console.error('Failed to load command center data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    let ws = null;
    let isSubscribed = true;

    try {
      ws = new WebSocket(getWebSocketUrl('/ws/attendance'));

      ws.onopen = () => {
        if (isSubscribed) setLiveConnected(true);
      };

      ws.onclose = () => {
        if (isSubscribed) setLiveConnected(false);
      };

      ws.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ATTENDANCE_MARKED' || msg.type === 'CHECKOUT_MARKED') {
            fetchData(true);
            const rawName = msg.name || 'Employee';
            const cleanName = rawName.includes('_') ? rawName.split('_').slice(1).join(' ') : rawName;
            const actionText = msg.type === 'CHECKOUT_MARKED' ? 'CHECKED OUT' : `CHECKED IN (${(msg.status || 'present').toUpperCase()})`;
            
            setToast({
              title: 'Live Gate Event',
              message: `${cleanName} ${actionText} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            });
            setTimeout(() => setToast(null), 5000);
          }
        } catch (err) {
          console.error('WS Message Error:', err);
        }
      };

      ws.onerror = () => {
        if (isSubscribed) setLiveConnected(false);
      };
    } catch (e) {
      console.warn('WebSocket init failed:', e);
    }

    return () => {
      isSubscribed = false;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => ws.close();
        }
      }
    };
  }, [fetchData]);

  const getCleanName = (rawName) => {
    if (!rawName) return 'Employee';
    return rawName.includes('_') ? rawName.split('_').slice(1).join(' ') : rawName;
  };

  // Filtered Today Attendance Logs
  const filteredRecords = useMemo(() => {
    const records = summary?.today_records || [];
    return records.filter(rec => {
      const nameMatch = getCleanName(rec.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (rec.employee_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (rec.department || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!nameMatch) return false;
      if (statusFilter === 'present') return rec.status === 'present';
      if (statusFilter === 'late') return rec.status === 'late';
      if (statusFilter === 'checkout') return Boolean(rec.checkout);
      if (statusFilter === 'in_office') return !rec.checkout;
      return true;
    });
  }, [summary, searchQuery, statusFilter]);

  // Filtered Department List
  const filteredDepartments = useMemo(() => {
    return (summary?.department_summary || []).filter(dept =>
      (dept.department || '').toLowerCase().includes(deptSearchQuery.toLowerCase())
    );
  }, [summary, deptSearchQuery]);

  // Hourly Arrival Distribution Histogram Data (6AM - 12PM+)
  const hourlyDistribution = useMemo(() => {
    const slots = [
      { label: '< 8 AM', range: [0, 7], onTime: 0, late: 0, total: 0 },
      { label: '8-9 AM', range: [8, 8], onTime: 0, late: 0, total: 0 },
      { label: '9-10 AM', range: [9, 9], onTime: 0, late: 0, total: 0 },
      { label: '10-11 AM', range: [10, 10], onTime: 0, late: 0, total: 0 },
      { label: '11-12 PM', range: [11, 11], onTime: 0, late: 0, total: 0 },
      { label: '> 12 PM', range: [12, 23], onTime: 0, late: 0, total: 0 }
    ];

    (summary?.today_records || []).forEach(r => {
      if (!r.checkin) return;
      const parts = r.checkin.split(':');
      const hour = parseInt(parts[0], 10);
      if (isNaN(hour)) return;

      const slot = slots.find(s => hour >= s.range[0] && hour <= s.range[1]);
      if (slot) {
        if (r.status === 'present') slot.onTime += 1;
        else if (r.status === 'late') slot.late += 1;
        slot.total += 1;
      }
    });

    const maxCount = Math.max(...slots.map(s => s.total), 1);
    return { slots, maxCount };
  }, [summary]);

  // Core Computed Metrics
  const totalEmployees = summary?.total_employees || 0;
  const presentToday = summary?.present_today || 0;
  const onTimeCount = summary?.on_time_count || 0;
  const lateCount = summary?.late_count || 0;
  const absentCount = Math.max(0, totalEmployees - presentToday);
  const inOfficeCount = (summary?.today_records || []).filter(r => !r.checkout).length;
  const checkedOutCount = (summary?.today_records || []).filter(r => r.checkout).length;

  const attendanceRate = totalEmployees > 0 
    ? Math.round((presentToday / totalEmployees) * 100) 
    : 0;

  const punctualityRate = presentToday > 0 
    ? Math.round((onTimeCount / presentToday) * 100) 
    : 100;

  // Operational Highlights
  const bestDepartment = useMemo(() => {
    const list = summary?.department_summary || [];
    if (!list.length) return null;
    return [...list].sort((a, b) => b.rate - a.rate)[0];
  }, [summary]);

  const firstCheckIn = useMemo(() => {
    const records = summary?.today_records || [];
    if (!records.length) return null;
    const sorted = [...records].filter(r => r.checkin).sort((a, b) => a.checkin.localeCompare(b.checkin));
    return sorted[0] || null;
  }, [summary]);

  // 7-Day Trend Chart Coordinate Math
  const chartWidth = 650;
  const chartHeight = 220;
  const padding = { top: 20, right: 25, bottom: 35, left: 40 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const validTrends = useMemo(() => {
    if (trendsData && trendsData.length > 0) return trendsData;
    // Fallback 7-day dummy curve structure if network analytics is loading
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((d, i) => ({
      date: `Day ${i + 1}`,
      day: d,
      present: i === 6 ? presentToday : Math.round(totalEmployees * 0.85),
      late: i === 6 ? lateCount : Math.round(totalEmployees * 0.1),
      absent: i === 6 ? absentCount : Math.round(totalEmployees * 0.05),
      rate: i === 6 ? attendanceRate : 85,
      is_working_day: i < 5
    }));
  }, [trendsData, totalEmployees, presentToday, lateCount, absentCount, attendanceRate]);

  const maxWorkforceValue = useMemo(() => {
    if (chartMode === 'rate') return 100;
    const maxVal = Math.max(...validTrends.map(t => (t.present || 0) + (t.late || 0) + (t.absent || 0)), totalEmployees);
    return Math.max(maxVal, 10);
  }, [validTrends, chartMode, totalEmployees]);

  const trendPoints = useMemo(() => {
    if (!validTrends.length) return [];
    return validTrends.map((d, index) => {
      const val = chartMode === 'rate' ? (d.rate || 0) : (d.present || 0);
      const x = padding.left + (index / Math.max(1, validTrends.length - 1)) * graphWidth;
      const y = padding.top + graphHeight - (val / maxWorkforceValue) * graphHeight;
      return { x, y, data: d, val };
    });
  }, [validTrends, chartMode, maxWorkforceValue, graphWidth, graphHeight]);

  // Smooth Bézier Curve Generator
  const getSmoothPath = (points) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const getSmoothAreaPath = (points, bottomY) => {
    if (!points || points.length === 0) return '';
    const linePath = getSmoothPath(points);
    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    return `${linePath} L ${lastX} ${bottomY.toFixed(1)} L ${firstX} ${bottomY.toFixed(1)} Z`;
  };


  // Export Today Logs CSV
  const handleExportTodayCSV = () => {
    const records = summary?.today_records || [];
    if (!records.length) {
      window.alert('No attendance records available for export today.');
      return;
    }
    const rows = [
      ['Employee ID', 'Name', 'Department', 'Date', 'Check-In', 'Check-Out', 'Status'],
      ...records.map(r => [
        r.employee_id || 'N/A',
        getCleanName(r.name),
        r.department || 'General',
        r.date,
        r.checkin || 'N/A',
        r.checkout || 'In Office',
        (r.status || 'present').toUpperCase()
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gate_attendance_${summary?.today_date || 'today'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-slate-500 animate-pulse">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-brand-navy to-brand-teal text-white flex items-center justify-center shadow-lg mb-4">
          <Activity className="animate-spin" size={28} />
        </div>
        <p className="font-black text-slate-800 text-base tracking-tight">Initializing HR Command Hub...</p>
        <p className="text-xs text-slate-400 mt-1">Aggregating live biometric biometric streams & daily telemetry</p>
      </div>
    );
  }

  // Radial Gauge Calculations
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (attendanceRate / 100) * circumference;

  return (
    <div className="space-y-6 mx-auto pb-10">
      
      {/* 1. EXECUTIVE COMMAND HEADER & LIVE ACTION HUB */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-navy to-brand-dark p-6 rounded-2xl text-white shadow-xl relative overflow-hidden border border-white/10">
        {/* Subtle decorative glow */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-brand-teal/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-60 h-60 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          
          {/* Left: Title, Live Clock & Status Pulse */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-brand-teal/20 text-brand-teal border border-brand-teal/30 flex items-center gap-1.5">
                <Sparkles size={13} /> HR Command Center
              </span>
              
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-slate-200 border border-white/10">
                <span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{liveConnected ? 'Live Gate Stream Connected' : 'Telemetry Sync Active'}</span>
              </div>
            </div>

            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Biometric Attendance Command Hub
              </h1>
              <div className="text-xs sm:text-sm font-mono font-semibold text-teal-300/90 flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg border border-white/5">
                <Clock size={14} />
                <span>{currentTime.toLocaleTimeString()}</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-medium leading-relaxed">
              Real-time gate recognition stream, workforce velocity analytics, and departmental punctuality telemetry.
            </p>
          </div>

          {/* Right: Modern Action Launcher Bar */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full xl:w-auto shrink-0">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-slate-100 font-bold text-xs rounded-xl transition flex items-center gap-2 backdrop-blur-md border border-white/10 active:scale-95 cursor-pointer"
              title="Refresh Telemetry"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin text-brand-teal' : ''} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <Link 
              to="/employees?tab=register" 
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 backdrop-blur-md border border-white/10 shadow-xs active:scale-95"
            >
              <UserPlus size={15} className="text-teal-300" />
              <span>Add Staff</span>
            </Link>

            <Link 
              to="/reports" 
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 backdrop-blur-md border border-white/10 shadow-xs active:scale-95"
            >
              <FileText size={15} className="text-blue-300" />
              <span>Reports</span>
            </Link>

            <Link 
              to="/analytics" 
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 backdrop-blur-md border border-white/10 shadow-xs active:scale-95"
            >
              <TrendingUp size={15} className="text-emerald-300" />
              <span>Trends Hub</span>
            </Link>

            <Link 
              to="/queries" 
              className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-xs rounded-xl transition flex items-center gap-2 backdrop-blur-md border border-amber-400/30 shadow-xs active:scale-95"
            >
              <FileQuestion size={15} className="text-amber-400" />
              <span>Attendance Queries</span>
            </Link>

            <a 
              href="/gate" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-gradient-to-r from-brand-teal to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95"
            >
              <Camera size={16} />
              <span>Gate Terminal</span>
            </a>
          </div>

        </div>
      </div>

      {/* Live Toast Notification */}
      {toast && (
        <div className="p-4 bg-gradient-to-r from-slate-900 via-brand-navy to-brand-teal text-white rounded-2xl shadow-xl flex justify-between items-center animate-in slide-in-from-top duration-300 border border-white/15">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
            <div>
              <span className="font-bold text-xs uppercase tracking-wider block text-teal-300">{toast.title}</span>
              <span className="font-medium text-sm">{toast.message}</span>
            </div>
          </div>
          <button onClick={() => setToast(null)} className="text-white/70 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Smart Operational Alerts Banner */}
      {((totalEmployees > 0 && attendanceRate < 70) || (alertsSummary?.unread_count > 0)) && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-300 ${
          attendanceRate < 50 
            ? 'bg-rose-50 border-rose-200 text-rose-900' 
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${attendanceRate < 50 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-xs uppercase tracking-wider">
                  {attendanceRate < 50 ? 'Critical Capacity Alert' : 'Operational Punctuality Alert'}
                </span>
                {alertsSummary?.unread_count > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                    {alertsSummary.unread_count} Unread
                  </span>
                )}
              </div>
              <p className="text-xs font-medium mt-0.5">
                {attendanceRate < 70 && totalEmployees > 0 
                  ? `Today's attendance rate is currently ${attendanceRate}% (${presentToday}/${totalEmployees} present), below the 70% threshold.`
                  : alertsSummary?.habitual_late_count > 0
                    ? `${alertsSummary.habitual_late_count} staff members have been flagged for repeated late arrivals this month.`
                    : `Active capacity or workforce notifications require administrative attention.`}
              </p>
            </div>
          </div>

          <Link
            to="/alerts"
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 self-end sm:self-auto shadow-xs ${
              attendanceRate < 50 
                ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            <span>Review Alerts</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* 2. 5 EXECUTIVE METRIC KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Total Workforce */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Total Workforce</span>
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">{totalEmployees}</div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Registered Staff</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">Active</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full w-full" />
          </div>
        </div>

        {/* Card 2: Present Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Present Today</span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-emerald-600 tracking-tight">{presentToday}</div>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs">
              {attendanceRate}%
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-emerald-700 font-semibold">
            <span>Turnout Rate</span>
            <span className="text-[10px] text-slate-400 font-mono">{presentToday}/{totalEmployees}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>

        {/* Card 3: On-Time Arrivals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">On-Time Arrivals</span>
            <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-teal-600 tracking-tight">{onTimeCount}</div>
            <span className="px-2 py-0.5 rounded-lg bg-teal-100 text-teal-800 font-black text-xs">
              {punctualityRate}%
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Punctual Turnout</span>
            <span className="text-[10px] text-teal-700 font-bold">&lt; 10:00 AM</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
            <div 
              className="h-full bg-teal-500 rounded-full transition-all duration-700"
              style={{ width: `${punctualityRate}%` }}
            />
          </div>
        </div>

        {/* Card 4: Late Arrivals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Late Arrivals</span>
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-amber-600 tracking-tight">{lateCount}</div>
            <span className={`px-2 py-0.5 rounded-lg font-black text-xs ${lateCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
              {lateCount > 0 ? `${Math.round((lateCount / (presentToday || 1)) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>After Threshold</span>
            <span className="text-[10px] text-amber-700 font-bold">&gt; 10:00 AM</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
            <div 
              className="h-full bg-amber-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (lateCount / (presentToday || 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Card 5: In Office Now */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group relative overflow-hidden sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Currently In Office</span>
            <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 size={18} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-indigo-600 tracking-tight">{inOfficeCount}</div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>On-Site</span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Checked Out: {checkedOutCount}</span>
            <span className="text-[10px] text-slate-400 font-mono">Absent: {absentCount}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-700"
              style={{ width: `${(inOfficeCount / (totalEmployees || 1)) * 100}%` }}
            />
          </div>
        </div>

      </div>

      {/* 3. DUAL INTERACTIVE VISUAL ANALYTICS & CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left (2 Cols): 7-Day Attendance Trend & Velocity Curve */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
                    <TrendingUp size={16} />
                  </div>
                  <h3 className="font-black text-base text-slate-900 tracking-tight">
                    7-Day Attendance Velocity & Trend
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Day-by-day workforce attendance rate and presence distribution.
                </p>
              </div>

              {/* Toggle metric modes */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 shrink-0">
                <button
                  onClick={() => setChartMode('rate')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    chartMode === 'rate' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'hover:text-slate-900 text-slate-500'
                  }`}
                >
                  Rate (%)
                </button>
                <button
                  onClick={() => setChartMode('count')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    chartMode === 'count' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'hover:text-slate-900 text-slate-500'
                  }`}
                >
                  Headcount
                </button>
              </div>
            </div>

            {/* Interactive SVG Chart */}
            <div className="relative w-full h-[220px] select-none">
              <svg 
                viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                className="w-full h-full overflow-visible"
              >
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#21c4c9" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#21c4c9" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                {[0, 25, 50, 75, 100].map((pct, idx) => {
                  const yVal = padding.top + graphHeight - (pct / 100) * graphHeight;
                  return (
                    <g key={idx}>
                      <line 
                        x1={padding.left} 
                        y1={yVal} 
                        x2={chartWidth - padding.right} 
                        y2={yVal} 
                        stroke="#f1f5f9" 
                        strokeWidth="1"
                        strokeDasharray={pct === 0 ? 'none' : '3 3'}
                      />
                      <text 
                        x={padding.left - 8} 
                        y={yVal + 3} 
                        textAnchor="end" 
                        fontSize="10" 
                        fill="#94a3b8" 
                        fontWeight="600"
                        fontFamily="sans-serif"
                      >
                        {chartMode === 'rate' ? `${pct}%` : Math.round((pct / 100) * maxWorkforceValue)}
                      </text>
                    </g>
                  );
                })}

                {/* Gradient Area Fill */}
                <path 
                  d={getSmoothAreaPath(trendPoints, padding.top + graphHeight)} 
                  fill="url(#areaGradient)" 
                />

                {/* Main Trend Line */}
                <path 
                  d={getSmoothPath(trendPoints)} 
                  fill="none" 
                  stroke="#1a4751" 
                  strokeWidth="3.5" 
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Active / Hover Interactive Points */}
                {trendPoints.map((pt, i) => {
                  const isHovered = hoveredTrendPoint?.index === i;
                  return (
                    <g key={i}>
                      {/* Invisible hover capture target */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="14"
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredTrendPoint({ ...pt, index: i })}
                        onMouseLeave={() => setHoveredTrendPoint(null)}
                      />

                      {/* Visible circle marker */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 6 : 4}
                        fill="#ffffff"
                        stroke="#21c4c9"
                        strokeWidth={isHovered ? 3 : 2.5}
                        className="transition-all duration-200 pointer-events-none"
                      />

                      {/* X-axis Day labels */}
                      <text
                        x={pt.x}
                        y={chartHeight - 10}
                        textAnchor="middle"
                        fontSize="11"
                        fill={isHovered ? '#1a4751' : '#64748b'}
                        fontWeight={isHovered ? '800' : '600'}
                      >
                        {pt.data.day || pt.data.date?.slice(5) || `D${i + 1}`}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Hover Tooltip Card */}
              {hoveredTrendPoint && (
                <div 
                  className="absolute z-30 pointer-events-none bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-white/10 text-xs space-y-1 transform -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    left: `${(hoveredTrendPoint.x / chartWidth) * 100}%`,
                    top: `${(hoveredTrendPoint.y / chartHeight) * 100 - 12}%`
                  }}
                >
                  <div className="font-bold text-teal-300 border-b border-white/10 pb-1 flex justify-between gap-4">
                    <span>{hoveredTrendPoint.data.date || hoveredTrendPoint.data.day}</span>
                    <span>{hoveredTrendPoint.data.rate}% Rate</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[9px]">Present</span>
                      <span className="font-bold text-emerald-400">{hoveredTrendPoint.data.present}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">Late</span>
                      <span className="font-bold text-amber-400">{hoveredTrendPoint.data.late}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">Absent</span>
                      <span className="font-bold text-rose-400">{hoveredTrendPoint.data.absent}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold mt-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-teal" />
                <span>Present Velocity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>On-Time</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Late Arrival</span>
              </div>
            </div>

            <Link to="/analytics" className="text-brand-navy hover:text-brand-teal font-bold flex items-center gap-1">
              <span>Deep Trends</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {/* Right (1 Col): Today's Radial Attendance Gauge & Hourly Wave */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <PieChart size={16} />
                </div>
                <h3 className="font-black text-base text-slate-900 tracking-tight">
                  Turnout & Hourly Arrival Wave
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px]">
                Today
              </span>
            </div>

            {/* Radial Gauge Centerpiece */}
            <div className="flex items-center justify-center my-2">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                  {/* Background Track */}
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    stroke="#f1f5f9"
                    strokeWidth="12"
                    fill="transparent"
                  />
                  {/* Animated Progress Ring */}
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    stroke="url(#radialGradient)"
                    strokeWidth="12"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="radialGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#1a4751" />
                      <stop offset="100%" stopColor="#21c4c9" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Center Percentage Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-slate-900 tracking-tight">{attendanceRate}%</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Attendance</span>
                </div>
              </div>
            </div>

            {/* Hourly Arrival Wave Histogram */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                <span>Arrival Peak Wave</span>
                <span className="text-brand-teal font-mono">{presentToday} check-ins</span>
              </div>

              <div className="grid grid-cols-6 gap-1.5 items-end h-16 pt-2 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                {hourlyDistribution.slots.map((slot, idx) => {
                  const heightPct = Math.round((slot.total / hourlyDistribution.maxCount) * 100);
                  const onTimePct = slot.total > 0 ? (slot.onTime / slot.total) * 100 : 0;
                  return (
                    <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                      <div className="w-full bg-slate-200/80 rounded-t-md overflow-hidden flex flex-col-reverse transition-all duration-500" style={{ height: `${Math.max(8, heightPct)}%` }}>
                        <div className="w-full bg-emerald-500" style={{ height: `${onTimePct}%` }} />
                        <div className="w-full bg-amber-500" style={{ height: `${100 - onTimePct}%` }} />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 mt-1 truncate w-full text-center">
                        {slot.label}
                      </span>

                      {/* Mini slot hover pill */}
                      <div className="absolute -top-7 hidden group-hover:flex bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap z-20">
                        {slot.total} check-ins ({slot.onTime} on-time)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 text-center text-xs mt-3">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">On-Time</span>
              <span className="font-black text-emerald-600 text-sm">{onTimeCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Late</span>
              <span className="font-black text-amber-600 text-sm">{lateCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Absent</span>
              <span className="font-black text-rose-500 text-sm">{absentCount}</span>
            </div>
          </div>

        </div>

      </div>

      {/* 4. MAIN TELEMETRY: TODAY'S LIVE GATE ATTENDANCE TABLE & DEPARTMENT CAPACITY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left (2 Cols): Gate Attendance Logs Stream */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-black text-base text-slate-900 tracking-tight">
                  Today's Gate Recognition Logs
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Biometric entry & exit timestamps recorded at the gate terminal.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Search input */}
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search name, ID or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-none transition font-medium"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Quick CSV Export */}
              <button
                onClick={handleExportTodayCSV}
                className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition shadow-xs flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
                title="Export today's logs to CSV"
              >
                <Download size={15} className="text-brand-teal" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="px-6 py-2.5 bg-white border-b border-slate-100 flex gap-1.5 overflow-x-auto text-xs font-bold">
            <button 
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'all' 
                  ? 'bg-brand-navy text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Logs ({summary?.today_records?.length || 0})
            </button>
            <button 
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'present' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              On-Time ({onTimeCount})
            </button>
            <button 
              onClick={() => setStatusFilter('late')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'late' 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Late ({lateCount})
            </button>
            <button 
              onClick={() => setStatusFilter('in_office')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'in_office' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              On-Site ({inOfficeCount})
            </button>
            <button 
              onClick={() => setStatusFilter('checkout')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'checkout' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Checked Out ({checkedOutCount})
            </button>
          </div>

          {/* Table Body */}
          <div className="overflow-x-auto overflow-y-auto flex-1 max-h-[460px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-wider">ID</th>
                  <th className="px-5 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-wider">Employee</th>
                  <th className="px-5 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-wider">Department</th>
                  <th className="px-5 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-wider">Check-In</th>
                  <th className="px-5 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-wider">Check-Out</th>
                  <th className="px-5 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-[11px] font-black text-slate-400 uppercase tracking-wider">Dossier</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredRecords.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition group">
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono font-bold text-slate-700">
                      {row.employee_id || 'N/A'}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {row.profile_picture ? (
                          <img
                            src={getProfileImageUrl(row.profile_picture)}
                            alt={getCleanName(row.name)}
                            className="h-8 w-8 rounded-full object-cover shadow-xs border border-slate-200 shrink-0"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`h-8 w-8 rounded-full bg-gradient-to-tr from-brand-navy to-brand-teal text-white flex items-center justify-center font-bold text-xs shrink-0 ${row.profile_picture ? 'hidden' : 'flex'}`}>
                          {getCleanName(row.name).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 group-hover:text-brand-teal transition-colors">
                            {getCleanName(row.name)}
                          </div>
                          {row.position && (
                            <span className="text-[10px] text-slate-400 block">{row.position}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600 font-semibold">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                        {row.department || row.domain || 'General'}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono font-bold text-slate-800">
                      {row.checkin ? (
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-teal-500" />
                          <span>{row.checkin}</span>
                        </div>
                      ) : '-'}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono">
                      {row.checkout ? (
                        <span className="font-bold text-blue-600">{row.checkout}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          In Office
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-[10px] leading-4 font-black uppercase rounded-lg border ${
                        row.status === 'present' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {row.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadEmployeePDF(row);
                        }}
                        disabled={downloadingEmpId === (row.employee_id || row.name)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition shadow-xs inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer active:scale-95"
                        title="Download Individual Granular PDF Report"
                      >
                        <FileText size={13} className={downloadingEmpId === (row.employee_id || row.name) ? "animate-spin text-rose-500" : "text-rose-600"} />
                        <span className="hidden sm:inline">{downloadingEmpId === (row.employee_id || row.name) ? 'PDF...' : 'PDF'}</span>
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center text-slate-400 text-xs">
                      <div className="space-y-2">
                        <Users size={28} className="mx-auto text-slate-300" />
                        <p className="font-bold text-slate-600">
                          {searchQuery ? `No records matching "${searchQuery}"` : 'No gate attendance activity recorded yet today.'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Live gate recognitions will appear here in real-time.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Right (1 Col): Department Capacity Matrix & Operational Highlights */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-base text-slate-900 tracking-tight">
                  Department Breakdown
                </h3>
                <p className="text-xs text-slate-500 font-medium">Turnout by team division.</p>
              </div>

              {/* Dept search */}
              <div className="relative w-32 shrink-0">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="text"
                  placeholder="Filter dept..."
                  value={deptSearchQuery}
                  onChange={(e) => setDeptSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-brand-teal outline-none transition"
                />
                {deptSearchQuery && (
                  <button 
                    onClick={() => setDeptSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>

            {/* Department Capacity Bars */}
            <div className="space-y-3.5 max-h-[280px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-1">
              {filteredDepartments.map((dept, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100/80 space-y-2 hover:bg-slate-100/70 transition">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-800 truncate pr-2">{dept.department}</span>
                    <span className={`font-mono text-xs font-black ${
                      dept.rate >= 80 ? 'text-emerald-600' : dept.rate >= 50 ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      {dept.present} / {dept.total} ({dept.rate}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ${
                        dept.rate >= 80 
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-500' 
                          : dept.rate >= 50 
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                            : 'bg-slate-400'
                      }`}
                      style={{ width: `${dept.rate}%` }}
                    />
                  </div>
                </div>
              ))}

              {filteredDepartments.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8 font-medium">
                  {deptSearchQuery ? `No departments matching "${deptSearchQuery}"` : 'No department data available.'}
                </p>
              )}
            </div>
          </div>

          {/* Today's Operational Highlights Widget */}
          <div className="mt-6 pt-4 border-t border-slate-100 space-y-2.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Today's Highlights
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 uppercase">
                  <Award size={12} />
                  <span>Top Dept</span>
                </div>
                <div className="font-black text-slate-800 text-xs truncate mt-0.5">
                  {bestDepartment ? bestDepartment.department : 'N/A'}
                </div>
                <span className="text-[10px] text-emerald-700 font-mono font-bold">
                  {bestDepartment ? `${bestDepartment.rate}% present` : '-'}
                </span>
              </div>

              <div className="p-2.5 bg-teal-50/70 border border-teal-100 rounded-xl">
                <div className="flex items-center gap-1 text-[10px] font-bold text-teal-800 uppercase">
                  <Zap size={12} />
                  <span>First In</span>
                </div>
                <div className="font-black text-slate-800 text-xs truncate mt-0.5">
                  {firstCheckIn ? getCleanName(firstCheckIn.name) : 'None yet'}
                </div>
                <span className="text-[10px] text-teal-700 font-mono font-bold">
                  {firstCheckIn ? firstCheckIn.checkin : '-'}
                </span>
              </div>
            </div>

            <div className="pt-2 text-center">
              <Link 
                to="/reports" 
                className="text-xs font-bold text-brand-navy hover:text-brand-teal transition flex items-center justify-center gap-1"
              >
                <span>Generate Detailed Attendance Reports</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

        </div>

      </div>

      {/* Granular Report Modal */}
      {isReportModalOpen && reportModalEmp && (
        <GranularReportModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            setReportModalEmp(null);
          }}
          employee={reportModalEmp}
          companyName={companyName}
          logoUrl={logoUrl}
        />
      )}

    </div>
  );
}

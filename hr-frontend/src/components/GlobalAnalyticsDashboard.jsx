import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Users, ShieldCheck, Activity, Clock, 
  TrendingUp, RefreshCw, Download, Search, 
  XCircle, ArrowRight, Calendar, Layers, ChevronRight, Crown
} from 'lucide-react';
import { apiCall } from '../api';

export default function GlobalAnalyticsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rangeFilter, setRangeFilter] = useState('all'); // '7d', '14d', '30d', 'all'
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Search & filter for tenant leaderboard
  const [tenantSearch, setTenantSearch] = useState('');
  const [sortBy, setSortBy] = useState('employee_count');
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const fetchAnalytics = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await apiCall(`/super-admin/analytics/overview?range_filter=${rangeFilter}`);
      setData(res);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load global analytics:', err);
      setError(err.message || 'Unable to load platform analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rangeFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Filtered & sorted tenants
  const sortedTenants = useMemo(() => {
    if (!data?.tenants) return [];
    let list = [...data.tenants];
    if (tenantSearch.trim()) {
      const q = tenantSearch.toLowerCase();
      list = list.filter(t => 
        (t.company_name || '').toLowerCase().includes(q) ||
        (t.username || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0));
    return list;
  }, [data?.tenants, tenantSearch, sortBy]);

  // Max value in attendance trends for dynamic SVG scaling
  const maxTrendTotal = useMemo(() => {
    if (!data?.trends || data.trends.length === 0) return 10;
    const maxVal = Math.max(...data.trends.map(t => t.total || 0));
    return maxVal > 0 ? maxVal : 10;
  }, [data?.trends]);

  // Max count in hourly checkins
  const maxHourlyCount = useMemo(() => {
    if (!data?.hourly_distribution || data.hourly_distribution.length === 0) return 5;
    const maxVal = Math.max(...data.hourly_distribution.map(h => h.count || 0));
    return maxVal > 0 ? maxVal : 5;
  }, [data?.hourly_distribution]);

  // Peak checkin hour
  const peakHour = useMemo(() => {
    if (!data?.hourly_distribution || data.hourly_distribution.length === 0) return null;
    let peak = data.hourly_distribution[0];
    for (const h of data.hourly_distribution) {
      if (h.count > peak.count) peak = h;
    }
    return peak.count > 0 ? peak : null;
  }, [data?.hourly_distribution]);

  // Export CSV summary
  const handleExportCSV = () => {
    if (!data) return;
    const summaryRows = [
      ["Metric", "Value"],
      ["Total Tenants", data.summary.total_tenants],
      ["Active Tenants", data.summary.active_tenants],
      ["Disabled Tenants", data.summary.disabled_tenants],
      ["Total Employees", data.summary.total_employees],
      ["Total Attendance Records", data.summary.total_attendance],
      ["Enrolled Face Embeddings", data.summary.total_faces],
      ["Biometric Adoption Rate", `${data.summary.biometric_adoption_pct}%`],
      ["Global Punctuality Rate", `${data.summary.punctuality_rate}%`],
      ["Today Present", data.summary.today_present],
      ["Today Late", data.summary.today_late],
      ["Today Absent", data.summary.today_absent],
      ["Today Total", data.summary.today_total],
      [],
      ["Tenant Comparison Leaderboard"],
      ["Tenant ID", "Company Name", "Username", "Status", "Employees", "Face Profiles", "Total Attendance", "On-Time %", "Biometric %"]
    ];

    (data.tenants || []).forEach(t => {
      summaryRows.push([
        t.id,
        `"${(t.company_name || '').replace(/"/g, '""')}"`,
        t.username,
        t.status,
        t.employee_count,
        t.face_count,
        t.attendance_count,
        `${t.punctuality_pct}%`,
        `${t.biometric_enrollment_pct}%`
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + summaryRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Global_Attendance_Analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] bg-white rounded-2xl border border-gray-200 p-12">
        <div className="w-12 h-12 rounded-2xl bg-brand-teal/10 text-brand-teal flex items-center justify-center animate-spin mb-4">
          <RefreshCw size={24} />
        </div>
        <h3 className="text-base font-bold text-gray-800">Aggregating Global Platform Intelligence...</h3>
        <p className="text-xs text-gray-400 mt-1">Crunching multi-tenant headcount, attendance, and biometric metrics.</p>
      </div>
    );
  }

  const s = data?.summary || {
    total_tenants: 0,
    active_tenants: 0,
    disabled_tenants: 0,
    total_employees: 0,
    total_attendance: 0,
    total_faces: 0,
    today_present: 0,
    today_late: 0,
    today_absent: 0,
    today_total: 0,
    punctuality_rate: 100,
    biometric_adoption_pct: 0
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* ERROR ALERT */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <XCircle size={18} className="text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchAnalytics(true)} className="font-bold underline text-xs">Retry</button>
        </div>
      )}

      {/* TOP HEADER CONTROLS BAR */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-teal to-brand-blue text-white flex items-center justify-center shadow-md">
              <TrendingUp size={22} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                Global Platform Analytics
                <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Live System
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 font-medium flex flex-wrap items-center gap-2">
                <span>Comprehensive executive oversight across all organizations, staff headcounts, biometric coverage, and daily attendance logs.</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  • Synced: {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Time Filter Pills & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Range Selector */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold text-slate-600">
            {[
              { id: '7d', label: '7 Days' },
              { id: '14d', label: '14 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'all', label: 'All-Time' },
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => setRangeFilter(pill.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  rangeFilter === pill.id 
                    ? 'bg-white text-gray-900 shadow-sm font-black' 
                    : 'hover:text-gray-900'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            title="Export CSV Summary"
          >
            <Download size={15} />
            Export CSV
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* EXECUTIVE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* Card 1: Organizations */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-blue-100/50 transition-colors pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Workspaces</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 tracking-tight">{s.total_tenants}</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {s.active_tenants} active
            </span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{s.disabled_tenants} disabled accounts</span>
          </div>
        </div>

        {/* Card 2: Employees */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-50/50 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-cyan-100/50 transition-colors pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Global Headcount</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 tracking-tight">{s.total_employees}</span>
            <span className="text-xs font-medium text-slate-500">staff registered</span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            <span>Avg {s.total_tenants > 0 ? (s.total_employees / s.total_tenants).toFixed(1) : 0} staff / tenant</span>
          </div>
        </div>

        {/* Card 3: Biometric Face Profiles */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-emerald-100/50 transition-colors pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Biometric Coverage</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 tracking-tight">{s.total_faces}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {s.biometric_adoption_pct}% enrolled
            </span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>AI Recognition Model Ready</span>
          </div>
        </div>

        {/* Card 4: Total Attendance Logs */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50/50 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-purple-100/50 transition-colors pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Check-Ins</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Activity size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 tracking-tight">{s.total_attendance}</span>
            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
              {s.punctuality_rate}% on-time
            </span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>Cumulative across all tenants</span>
          </div>
        </div>

        {/* Card 5: Today's Live Attendance */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/50 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-amber-100/50 transition-colors pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Today's Check-Ins</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 tracking-tight">{s.today_present + s.today_late}</span>
            <span className="text-xs font-medium text-slate-500">marked today</span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between">
            <span className="text-emerald-600 font-semibold">{s.today_present} On-Time</span>
            <span className="text-amber-600 font-semibold">{s.today_late} Late</span>
            <span className="text-slate-400">{s.today_absent} Absent</span>
          </div>
        </div>

      </div>

      {/* MIDDLE SECTION: ATTENDANCE TREND CHART & HOURLY LOAD */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT: ATTENDANCE VOLUME & ON-TIME TRENDS (8 Cols) */}
        <div className="xl:col-span-8 bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                Multi-Tenant Attendance Trajectory
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                  {rangeFilter.toUpperCase()}
                </span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Aggregate daily attendance volume across all tenants. Hover over bars to view daily breakdowns.
              </p>
            </div>

            {/* Chart Legend */}
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500" />
                <span className="text-gray-700">On-Time (Present)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-amber-400" />
                <span className="text-gray-700">Late Arrivals</span>
              </div>
            </div>
          </div>

          {/* Interactive Chart Container */}
          <div className="relative pt-6 pb-2 min-h-[260px] flex flex-col justify-end">
            {(!data?.trends || data.trends.length === 0) ? (
              <div className="h-52 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-gray-200">
                <Calendar size={32} className="text-gray-300 mb-2" />
                <p className="text-sm font-bold text-gray-600">No attendance records in selected window</p>
                <p className="text-xs text-gray-400 mt-0.5">Switch filter to "All-Time" to view historical records.</p>
              </div>
            ) : (
              <div className="w-full">
                {/* SVG/Bar Chart Container */}
                <div className="h-48 w-full flex items-end gap-2 sm:gap-3 px-2 border-b border-gray-200 relative">
                  
                  {/* Subtle Y-Axis Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
                    <div className="border-b border-dashed border-gray-200 w-full" />
                    <div className="border-b border-dashed border-gray-200 w-full" />
                    <div className="border-b border-dashed border-gray-200 w-full" />
                  </div>

                  {data.trends.map((item, idx) => {
                    const total = item.total || 0;
                    const present = item.present || 0;
                    const late = item.late || 0;
                    const heightPct = Math.max(8, (total / maxTrendTotal) * 100);
                    const presentPct = total > 0 ? (present / total) * 100 : 100;
                    const isHovered = hoveredPoint?.date === item.date;

                    return (
                      <div 
                        key={item.date || idx}
                        className="flex-1 flex flex-col items-center h-full justify-end relative group cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(item)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        {/* Tooltip on hover */}
                        {isHovered && (
                          <div className="absolute -top-20 z-30 bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-xl min-w-[140px] pointer-events-none transform -translate-x-1/2 left-1/2 animate-in fade-in zoom-in-95 duration-150">
                            <p className="font-bold border-b border-slate-700 pb-1 mb-1 flex items-center justify-between">
                              <span>{item.date}</span>
                              <span className="text-[10px] text-slate-400">{item.day_name}</span>
                            </p>
                            <div className="space-y-0.5 text-[11px]">
                              <p className="flex justify-between text-emerald-400 font-medium">
                                <span>Present:</span>
                                <span>{present}</span>
                              </p>
                              <p className="flex justify-between text-amber-300 font-medium">
                                <span>Late:</span>
                                <span>{late}</span>
                              </p>
                              <p className="flex justify-between text-slate-300 font-bold border-t border-slate-800 pt-1">
                                <span>Total:</span>
                                <span>{total}</span>
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Stacked Bar with smooth rounded top */}
                        <div 
                          className={`w-full max-w-[48px] rounded-t-lg overflow-hidden transition-all duration-200 flex flex-col justify-end shadow-sm ${
                            isHovered ? 'ring-2 ring-brand-teal scale-105' : 'hover:opacity-90'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        >
                          {late > 0 && (
                            <div 
                              className="w-full bg-amber-400 transition-all"
                              style={{ height: `${100 - presentPct}%` }}
                            />
                          )}
                          <div 
                            className="w-full bg-emerald-500 transition-all"
                            style={{ height: `${presentPct}%` }}
                          />
                        </div>

                        {/* Date Label under bar */}
                        <span className="text-[10px] font-semibold text-slate-500 mt-2 truncate w-full text-center">
                          {item.label || item.date?.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Chart Metrics Summary Strip */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-700">{data.trends.length} Recorded Days</span>
                    <span>•</span>
                    <span>Max Single Day: <strong className="text-gray-800">{maxTrendTotal} check-ins</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-semibold">● On-Time Standard</span>
                    <span className="text-amber-500 font-semibold">● Late Arrival</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: PEAK HOURLY DISTRIBUTION & DEPARTMENT BREAKDOWN (4 Cols) */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* Hourly Traffic Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Clock size={16} className="text-brand-teal" />
                  Peak Check-in Hours
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5">Distribution of check-in times (06:00 - 20:00)</p>
              </div>
              {peakHour && (
                <span className="text-[10px] font-bold bg-brand-teal/10 text-brand-teal px-2 py-0.5 rounded-md border border-brand-teal/20">
                  Peak: {peakHour.hour}
                </span>
              )}
            </div>

            {/* Hourly Bars */}
            <div className="mt-4 space-y-2">
              {(data?.hourly_distribution || []).filter(h => h.count > 0).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No check-in timestamps recorded yet.</p>
              ) : (
                (data?.hourly_distribution || []).filter(h => h.count > 0).map(h => {
                  const pct = (h.count / maxHourlyCount) * 100;
                  return (
                    <div key={h.hour} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-gray-700">
                        <span className="font-mono text-[11px]">{h.hour}</span>
                        <span className="text-slate-500">{h.count} check-ins</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-brand-teal to-brand-blue rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(6, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Department Breakdown Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Layers size={16} className="text-blue-600" />
                  Workforce by Department
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5">Headcount distribution across all clients</p>
              </div>
              <span className="text-[11px] font-bold text-gray-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {data?.departments?.length || 0} Depts
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {(!data?.departments || data.departments.length === 0) ? (
                <p className="text-xs text-gray-400 text-center py-4">No department data assigned.</p>
              ) : (
                data.departments.slice(0, 5).map(dept => (
                  <div key={dept.department} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-gray-700">
                      <span className="font-semibold text-gray-800">{dept.department}</span>
                      <span className="text-gray-500 font-mono">{dept.count} staff ({dept.percentage}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, dept.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* BOTTOM SECTION: MULTI-TENANT LEADERBOARD & RECENT EVENT FEED */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT: TENANT PERFORMANCE & COMPARISON LEADERBOARD (8 Cols) */}
        <div className="xl:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-5 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                Tenant Organizations Leaderboard
                <span className="text-xs bg-cyan-50 text-cyan-700 font-bold px-2.5 py-0.5 rounded-full border border-cyan-100">
                  {sortedTenants.length} Workspaces
                </span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Comparative metrics across tenants for headcount scale, biometric adoption, and attendance discipline.
              </p>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Filter tenant..."
                  value={tenantSearch}
                  onChange={e => setTenantSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
              </div>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="employee_count">Sort: Most Employees</option>
                <option value="attendance_count">Sort: Total Logs</option>
                <option value="punctuality_pct">Sort: Punctuality %</option>
                <option value="biometric_enrollment_pct">Sort: Biometric %</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 text-[11px] uppercase tracking-wider border-b border-gray-100 font-bold">
                  <th className="p-4">Tenant / Company</th>
                  <th className="p-4">Subscription Plan</th>
                  <th className="p-4 text-center">Seat Quota</th>
                  <th className="p-4">Biometric Coverage</th>
                  <th className="p-4 text-center">Total Check-Ins</th>
                  <th className="p-4 text-center">Punctuality</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {sortedTenants.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-400">
                      No tenant workspaces found.
                    </td>
                  </tr>
                ) : (
                  sortedTenants.map((tenant) => {
                    const maxEmp = tenant.max_employees || 50;
                    const empCount = tenant.employee_count ?? 0;
                    const usedPct = Math.round((empCount / maxEmp) * 100);

                    return (
                      <tr 
                        key={tenant.id}
                        className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                        onClick={() => navigate(`?tab=user-detail&id=${tenant.id}`)}
                      >
                        {/* Company Info */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {tenant.logo_url ? (
                                <img src={tenant.logo_url} alt="Logo" className="w-full h-full object-contain" />
                              ) : (
                                <Building2 size={18} className="text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 group-hover:text-brand-teal transition-colors flex items-center gap-1.5">
                                {tenant.company_name}
                                {tenant.status === 'disabled' && (
                                  <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded border border-amber-200">
                                    Disabled
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-gray-400 font-mono">@{tenant.username}</span>
                            </div>
                          </div>
                        </td>

                        {/* Subscription Plan */}
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <Crown size={11} className="text-amber-600" />
                            {tenant.plan_name || (maxEmp >= 500 ? 'Enterprise' : maxEmp >= 150 ? 'Business Pro' : maxEmp >= 50 ? 'Growth / Basic' : 'Free Starter')}
                          </span>
                        </td>

                        {/* Seat Quota & Headcount */}
                        <td className="p-4 text-center">
                          <div className="space-y-1 inline-block min-w-[90px]">
                            <span className="font-bold text-gray-900 text-xs">{empCount} / {maxEmp}</span>
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${usedPct >= 100 ? 'bg-rose-500' : usedPct >= 80 ? 'bg-amber-500' : 'bg-brand-teal'}`}
                                style={{ width: `${Math.min(100, usedPct)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Biometric Coverage Bar */}
                        <td className="p-4">
                          <div className="space-y-1 max-w-[130px]">
                            <div className="flex justify-between text-[11px] font-semibold">
                              <span className="text-gray-700">{tenant.face_count} faces</span>
                              <span className="text-brand-teal">{tenant.biometric_enrollment_pct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-brand-teal rounded-full"
                                style={{ width: `${tenant.biometric_enrollment_pct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Total Attendance */}
                        <td className="p-4 text-center font-bold text-gray-800">
                          {tenant.attendance_count}
                        </td>

                        {/* Punctuality */}
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            tenant.punctuality_pct >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            tenant.punctuality_pct >= 75 ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {tenant.punctuality_pct}%
                          </span>
                        </td>

                        {/* Action */}
                        <td className="p-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`?tab=user-detail&id=${tenant.id}`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-brand-teal hover:text-white text-slate-700 font-bold text-[11px] transition-all inline-flex items-center gap-1"
                          >
                            Details
                            <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: RECENT MULTI-TENANT ACTIVITY FEED (4 Cols) */}
        <div className="xl:col-span-4 bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Activity size={16} className="text-brand-blue" />
                  Recent Check-In Activity
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5">Live multi-tenant biometric check-ins</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>

            <div className="mt-4 space-y-3">
              {(!data?.recent_activity || data.recent_activity.length === 0) ? (
                <p className="text-xs text-gray-400 text-center py-8">No recent check-in events recorded.</p>
              ) : (
                data.recent_activity.slice(0, 8).map(event => (
                  <div 
                    key={event.id}
                    className="p-2.5 rounded-xl bg-slate-50/80 border border-gray-100 hover:bg-slate-100/70 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
                        event.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                        event.status === 'late' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {event.name?.charAt(0)?.toUpperCase() || 'E'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{event.name}</p>
                        <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                          <span className="font-medium text-gray-600">{event.company_name}</span>
                          <span>•</span>
                          <span className="font-mono">{event.employee_id}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        event.status === 'present' ? 'bg-emerald-50 text-emerald-700' :
                        event.status === 'late' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {event.status}
                      </span>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {event.checkin || event.date}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 text-center">
            <button
              onClick={() => navigate('?tab=users')}
              className="text-xs font-bold text-brand-teal hover:text-brand-blue flex items-center justify-center gap-1 mx-auto"
            >
              Manage All HR Organizations
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

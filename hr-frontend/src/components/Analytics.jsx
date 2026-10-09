import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  TrendingUp, Calendar, Users, Clock, AlertTriangle, CheckCircle2, 
  RefreshCw, Download, ArrowUpRight, Filter, ShieldCheck, Flame, 
  Award, AlertOctagon, Sparkles, ChevronRight, ChevronLeft, BarChart3, Activity,
  Layers, Info, ExternalLink, Zap
} from 'lucide-react';
import { apiCall, getProfileImageUrl } from '../api';

export default function Analytics() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rangeFilter, setRangeFilter] = useState('30d'); // '7d', '14d', '30d', 'month', '90d'
  const [deptFilter, setDeptFilter] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState(null);
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState(null);
  const [visibleSeries, setVisibleSeries] = useState({ present: true, late: true, absent: true });

  const fetchAnalytics = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await apiCall(`/analytics/overview?range_filter=${rangeFilter}&dept=${encodeURIComponent(deptFilter)}`);
      if (res.status === 'success') {
        setData(res);
      }
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rangeFilter, deptFilter]);

  const fetchDepartments = async () => {
    try {
      const empData = await apiCall('/employees');
      if (empData && empData.employees) {
        const depts = new Set();
        empData.employees.forEach(e => {
          if (e.department) depts.add(e.department);
          else if (e.domain) depts.add(e.domain);
        });
        setDepartments(Array.from(depts));
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Export Analytics Summary CSV
  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ["Operational Metric", "Value"],
      ["Period Range", `${data.date_range?.start} to ${data.date_range?.end} (${data.range_filter})`],
      ["Total Workforce", data.summary?.total_employees],
      ["Total Attendance Records", data.summary?.total_records],
      ["Overall Attendance Rate", `${data.summary?.overall_attendance_rate}%`],
      ["Overall Punctuality Rate", `${data.summary?.overall_punctuality_rate}%`],
      ["Total On-Time Arrivals", data.summary?.total_present],
      ["Total Late Arrivals", data.summary?.total_late],
      ["Total Absences", data.summary?.total_absent],
      ["Average Working Hours / Shift", `${data.summary?.company_avg_hours} hrs`],
      ["Total Company Hours Logged", `${data.summary?.total_company_hours} hrs`],
      ["Peak Arrival Window", `${data.summary?.peak_arrival?.range} (${data.summary?.peak_arrival?.pct}%)`],
      ["Best Attendance Day", `${data.summary?.best_day?.day || 'N/A'} (${data.summary?.best_day?.avg_rate || 0}%)`],
      [],
      ["Date", "Day", "Working Day", "Present (On-Time)", "Late", "Absent", "Attendance Rate (%)"]
    ];

    (data.trends || []).forEach(t => {
      rows.push([
        t.date,
        t.day,
        t.is_working_day ? "Yes" : "No",
        t.present,
        t.late,
        t.absent,
        `${t.rate}%`
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics_report_${data.range_filter}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic SVG Scaling calculations for 30-Day Trend Chart
  const trendsData = data?.trends || [];
  const maxWorkforce = useMemo(() => {
    if (!trendsData.length) return 10;
    const maxVal = Math.max(
      ...trendsData.map(t => Math.max(t.total_employees || 0, t.present + t.late + t.absent || 0))
    );
    return Math.max(maxVal, 5);
  }, [trendsData]);

  // SVG Chart Dimensions
  const chartWidth = 900;
  const chartHeight = 260;
  const padding = { top: 20, right: 30, bottom: 35, left: 45 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  // Build SVG Points
  const getCoordinates = (index, value) => {
    const x = padding.left + (index / Math.max(1, trendsData.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - (value / maxWorkforce) * graphHeight;
    return { x, y };
  };

  const generatePath = (dataKey) => {
    if (!trendsData.length) return '';
    return trendsData.map((d, i) => {
      const { x, y } = getCoordinates(i, d[dataKey] || 0);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  const generateAreaPath = (dataKey) => {
    if (!trendsData.length) return '';
    const linePath = generatePath(dataKey);
    const firstX = getCoordinates(0, 0).x.toFixed(1);
    const lastX = getCoordinates(trendsData.length - 1, 0).x.toFixed(1);
    const bottomY = (padding.top + graphHeight).toFixed(1);
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  // Heatmap helper color
  const getHeatmapColor = (rate, isWorkingDay) => {
    if (!isWorkingDay) return 'bg-slate-100 text-slate-400 border-slate-200/60';
    if (rate >= 90) return 'bg-emerald-600 text-white border-emerald-700 shadow-xs font-bold';
    if (rate >= 75) return 'bg-emerald-500 text-white border-emerald-600 font-semibold';
    if (rate >= 60) return 'bg-teal-400 text-white border-teal-500';
    if (rate >= 40) return 'bg-amber-400 text-slate-900 border-amber-500 font-semibold';
    if (rate > 0) return 'bg-rose-400 text-white border-rose-500 font-semibold';
    return 'bg-slate-100 text-slate-500 border-slate-200';
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-slate-500 animate-pulse space-y-3">
        <div className="w-12 h-12 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center">
          <RefreshCw className="animate-spin" size={24} />
        </div>
        <p className="font-bold text-slate-700">Loading Workforce Analytics & Trends Engine...</p>
      </div>
    );
  }

  const summary = data?.summary || {};
  const heatmap = data?.weekly_heatmap || { dow_summary: [], weeks_grid: [] };
  const topPerformers = data?.top_performers || [];
  const chronicAbsentees = data?.chronic_absentees || [];
  const arrivalHistogram = data?.arrival_histogram || [];
  const workingHoursLeaderboard = data?.working_hours_leaderboard || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* HERO HEADER WITH FILTERS */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-navy to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-white/10">
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
                <TrendingUp size={14} />
                Workforce Intelligence & Historical Trends
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                Advanced Analytics & Trends
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                In-depth trend analysis, attendance heatmaps, employee punctuality rankings, arrival distribution, and working duration analytics.
              </p>
            </div>
          </div>

          {/* CONTROLS */}
          <div className="flex items-center gap-2.5 flex-wrap">
            
            {/* Department Filter */}
            {departments.length > 0 && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/15 backdrop-blur-sm outline-none transition"
              >
                <option value="all" className="text-slate-900">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d} className="text-slate-900">{d}</option>
                ))}
              </select>
            )}

            {/* Range Selector */}
            <div className="flex items-center bg-black/30 p-1 rounded-xl border border-white/10 backdrop-blur-sm text-xs font-bold">
              {[
                { id: '7d', label: '7D' },
                { id: '14d', label: '14D' },
                { id: '30d', label: '30D' },
                { id: 'month', label: 'Month' },
                { id: '90d', label: '90D' }
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() => setRangeFilter(r.id)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    rangeFilter === r.id ? 'bg-brand-teal text-slate-900 shadow-sm font-black' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchAnalytics(true)}
              disabled={refreshing}
              className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-semibold transition border border-white/10 backdrop-blur-sm"
              title="Refresh Analytics"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-teal hover:bg-emerald-500 text-slate-900 font-bold rounded-xl text-xs transition shadow-lg shadow-teal-500/20 active:scale-95"
            >
              <Download size={14} /> Export CSV
            </button>

          </div>
        </div>
      </div>

      {/* 4 CORE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Attendance Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Attendance Rate</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Users size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2.5">
            <p className="text-3xl font-black text-slate-900">{summary.overall_attendance_rate}%</p>
            <span className="text-xs text-slate-500 font-medium">({summary.total_present + summary.total_late} records)</span>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px] font-semibold">
            <span className="text-emerald-600">{summary.total_present} On-time</span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-600">{summary.total_late} Late</span>
            <span className="text-slate-300">•</span>
            <span className="text-rose-500">{summary.total_absent} Absent</span>
          </div>
        </div>

        {/* Card 2: Punctuality Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Punctuality Score</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2.5">
            <p className="text-3xl font-black text-teal-600">{summary.overall_punctuality_rate}%</p>
            <span className="text-xs text-slate-400 font-medium">on-time arrival ratio</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 font-medium">
            Checked in before 10:00 AM threshold
          </p>
        </div>

        {/* Card 3: Avg Working Hours */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Working Hours</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Clock size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2.5">
            <p className="text-3xl font-black text-slate-900">{summary.company_avg_hours} <span className="text-sm font-bold text-slate-500">hrs/day</span></p>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">{summary.total_company_hours} total hrs logged</span>
            <span className="font-bold text-sky-600">{summary.overtime_shifts_count} OT shifts</span>
          </div>
        </div>

        {/* Card 4: Peak Arrival Window */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Peak Check-In Window</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Zap size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2.5">
            <p className="text-2xl font-black text-slate-900">{summary.peak_arrival?.range || 'N/A'}</p>
          </div>
          <p className="text-[11px] text-amber-700 font-bold mt-2 pt-2 border-t border-slate-100">
            {summary.peak_arrival?.pct}% of total gate arrivals
          </p>
        </div>

      </div>

      {/* FEATURE 1: 30-DAY ATTENDANCE TREND LINE CHART */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
        
        {/* CHART HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 size={20} className="text-brand-teal" />
              Attendance Trend Curve (Present vs Late vs Absent)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Daily workforce attendance levels, punctuality volumes, and absence patterns over time.
            </p>
          </div>

          {/* SERIES TOGGLES */}
          <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
            <button
              onClick={() => setVisibleSeries(p => ({ ...p, present: !p.present }))}
              className={`px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                visibleSeries.present ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Present (On-Time)
            </button>

            <button
              onClick={() => setVisibleSeries(p => ({ ...p, late: !p.late }))}
              className={`px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                visibleSeries.late ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Late Arrivals
            </button>

            <button
              onClick={() => setVisibleSeries(p => ({ ...p, absent: !p.absent }))}
              className={`px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                visibleSeries.absent ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Absent Staff
            </button>
          </div>
        </div>

        {/* SVG INTERACTIVE LINE CHART */}
        <div className="relative w-full overflow-x-auto">
          <div className="min-w-[650px]">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              className="w-full h-64 overflow-visible select-none"
            >
              <defs>
                <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="lateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="absentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = padding.top + graphHeight * (1 - ratio);
                const val = Math.round(maxWorkforce * ratio);
                return (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                      strokeDasharray={ratio === 0 ? "0" : "4 4"}
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fill="#94a3b8"
                      fontFamily="monospace"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* AREA FILLS */}
              {visibleSeries.present && (
                <path d={generateAreaPath('present')} fill="url(#presentGradient)" />
              )}
              {visibleSeries.late && (
                <path d={generateAreaPath('late')} fill="url(#lateGradient)" />
              )}
              {visibleSeries.absent && (
                <path d={generateAreaPath('absent')} fill="url(#absentGradient)" />
              )}

              {/* LINES */}
              {visibleSeries.present && (
                <path
                  d={generatePath('present')}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {visibleSeries.late && (
                <path
                  d={generatePath('late')}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {visibleSeries.absent && (
                <path
                  d={generatePath('absent')}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* X-Axis Date Labels & Hover Targets */}
              {trendsData.map((d, i) => {
                const { x, y } = getCoordinates(i, d.present);
                const step = Math.max(1, Math.floor(trendsData.length / 8));
                const showLabel = i % step === 0 || i === trendsData.length - 1;

                return (
                  <g key={i}>
                    {showLabel && (
                      <text
                        x={x}
                        y={chartHeight - 10}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#94a3b8"
                        fontWeight="600"
                      >
                        {d.display_date}
                      </text>
                    )}

                    {/* Interactive Column Hover Hitbox */}
                    <rect
                      x={x - (graphWidth / trendsData.length) / 2}
                      y={padding.top}
                      width={graphWidth / trendsData.length}
                      height={graphHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredTrendPoint({ ...d, x, y })}
                      onMouseLeave={() => setHoveredTrendPoint(null)}
                    />

                    {/* Data Points on Hover */}
                    {hoveredTrendPoint?.date === d.date && (
                      <g>
                        <line
                          x1={x}
                          y1={padding.top}
                          x2={x}
                          y2={padding.top + graphHeight}
                          stroke="#0ea5e9"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                        {visibleSeries.present && (
                          <circle cx={x} cy={getCoordinates(i, d.present).y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                        )}
                        {visibleSeries.late && (
                          <circle cx={x} cy={getCoordinates(i, d.late).y} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                        )}
                        {visibleSeries.absent && (
                          <circle cx={x} cy={getCoordinates(i, d.absent).y} r="5" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
                        )}
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Tooltip Overlay */}
            {hoveredTrendPoint && (
              <div 
                className="absolute z-20 bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 pointer-events-none border border-white/10"
                style={{
                  left: `${Math.min(chartWidth - 180, Math.max(20, hoveredTrendPoint.x - 70))}px`,
                  top: '15px'
                }}
              >
                <div className="font-bold flex items-center justify-between gap-3 border-b border-white/10 pb-1">
                  <span>{hoveredTrendPoint.date} ({hoveredTrendPoint.day})</span>
                  <span className="text-brand-teal font-mono">{hoveredTrendPoint.rate}% Rate</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-0.5">
                  <div className="text-emerald-400">
                    <span className="block text-[9px] text-slate-400 uppercase">Present</span>
                    {hoveredTrendPoint.present}
                  </div>
                  <div className="text-amber-400">
                    <span className="block text-[9px] text-slate-400 uppercase">Late</span>
                    {hoveredTrendPoint.late}
                  </div>
                  <div className="text-rose-400">
                    <span className="block text-[9px] text-slate-400 uppercase">Absent</span>
                    {hoveredTrendPoint.absent}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* FEATURE 2: WEEKLY HEATMAP CALENDAR & DAY DISTRIBUTION */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar size={20} className="text-brand-teal" />
              Weekly Attendance Density Heatmap
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Attendance density and consistency mapped across days of the week.
            </p>
          </div>

          {/* LEGEND */}
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
            <span>Low</span>
            <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200" />
            <span className="w-3.5 h-3.5 rounded bg-amber-400" />
            <span className="w-3.5 h-3.5 rounded bg-teal-400" />
            <span className="w-3.5 h-3.5 rounded bg-emerald-500" />
            <span className="w-3.5 h-3.5 rounded bg-emerald-600" />
            <span>High (90%+)</span>
          </div>
        </div>

        {/* DAY OF WEEK SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {(heatmap.dow_summary || []).map((dow) => {
            const isBest = summary.best_day?.day === dow.day;
            const isLowest = summary.lowest_day?.day === dow.day && dow.days_recorded > 0;

            return (
              <div 
                key={dow.day}
                className={`p-3.5 rounded-xl border transition-all text-center ${
                  isBest 
                    ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20' 
                    : isLowest 
                      ? 'bg-amber-50/50 border-amber-200' 
                      : 'bg-slate-50/50 border-slate-200/70'
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="font-black text-xs uppercase tracking-wider text-slate-700">{dow.day}</span>
                  {isBest && <span className="text-[10px]" title="Most Active Day">🏆</span>}
                </div>
                <p className={`text-xl font-black ${
                  dow.avg_rate >= 80 ? 'text-emerald-600' : dow.avg_rate >= 50 ? 'text-amber-600' : 'text-slate-600'
                }`}>
                  {dow.avg_rate}%
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {dow.total_present} check-ins ({dow.days_recorded}d)
                </p>
              </div>
            );
          })}
        </div>

        {/* DENSITY CALENDAR GRID */}
        <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/40">
          <p className="text-xs font-bold text-slate-700 mb-3">Daily Attendance Density Grid ({data?.range_filter}):</p>
          <div className="grid grid-cols-7 gap-2">
            {(heatmap.weeks_grid || []).map((dayRec, idx) => {
              const colorClass = getHeatmapColor(dayRec.rate, dayRec.is_working_day);
              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredHeatmapCell(dayRec)}
                  onMouseLeave={() => setHoveredHeatmapCell(null)}
                  className={`h-12 sm:h-14 p-1.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all duration-200 hover:scale-105 relative ${colorClass}`}
                >
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold">{dayRec.display_date}</span>
                    <span className="text-[9px] uppercase font-mono opacity-80">{dayRec.day}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black font-mono">
                      {dayRec.is_working_day ? `${dayRec.rate}%` : 'Off'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* HEATMAP HOVER DETAILS */}
          {hoveredHeatmapCell && (
            <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-800">{hoveredHeatmapCell.date} ({hoveredHeatmapCell.day})</span>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-600 font-bold">{hoveredHeatmapCell.present} On-time</span>
                <span className="text-slate-300">•</span>
                <span className="text-amber-600 font-bold">{hoveredHeatmapCell.late} Late</span>
                <span className="text-slate-300">•</span>
                <span className="text-rose-600 font-bold">{hoveredHeatmapCell.absent} Absent</span>
              </div>
              <span className="font-mono font-black text-brand-teal text-sm">{hoveredHeatmapCell.rate}% Attendance</span>
            </div>
          )}
        </div>

      </div>

      {/* FEATURE 3: TOP PERFORMERS & CHRONIC ABSENTEES WIDGETS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* WIDGET 1: TOP PERFORMERS */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Award size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Top Performers & Punctuality Champions</h3>
                <p className="text-xs text-slate-500">Highest attendance streaks & zero late records</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Top {topPerformers.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {topPerformers.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs">No attendance data logged yet for this period.</p>
            ) : (
              topPerformers.map((emp, i) => (
                <div key={emp.employee_id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 rounded-xl px-2 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
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
                      <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                        #{i + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{emp.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{emp.employee_id} • {emp.department}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-emerald-600 block">{emp.attendance_pct}%</span>
                    <span className="text-[10px] font-semibold text-slate-400 block">
                      {emp.days_present} on-time ({emp.punctuality_pct}% punctuality)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* WIDGET 2: CHRONIC ABSENTEES / ATTENDANCE AT RISK */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <AlertOctagon size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Chronic Absentees & Attendance At-Risk</h3>
                <p className="text-xs text-slate-500">Staff members with low attendance or high late counts</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
              Needs Review
            </span>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {chronicAbsentees.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs">No at-risk employees detected.</p>
            ) : (
              chronicAbsentees.map((emp) => {
                const isHighRisk = emp.days_absent >= 5 || emp.days_late >= 4;
                return (
                  <div key={emp.employee_id} className="py-3 flex items-center justify-between gap-3 hover:bg-rose-50/30 rounded-xl px-2 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      {emp.profile_picture ? (
                        <img
                          src={getProfileImageUrl(emp.profile_picture)}
                          alt={emp.name}
                          className="w-10 h-10 rounded-full object-cover shadow-xs border border-slate-200 flex-shrink-0"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm flex-shrink-0 ${emp.profile_picture ? 'hidden' : 'flex'}`}>
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm truncate">{emp.name}</p>
                          {isHighRisk && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                              High Risk
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono truncate">{emp.employee_id} • {emp.department}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <span className="text-xs font-bold text-rose-600 block">{emp.days_absent} Days Absent</span>
                        <span className="text-[10px] text-amber-600 font-semibold block">{emp.days_late} Days Late</span>
                      </div>
                      <button
                        onClick={() => navigate(`/reports?employee=${encodeURIComponent(emp.name)}`)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-teal transition"
                        title="Inspect Attendance Records"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* FEATURE 4 & 5: PEAK ARRIVAL HISTOGRAM & AVG WORKING HOURS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* FEATURE 4: PEAK ARRIVAL TIME HISTOGRAM */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Clock size={18} className="text-amber-500" />
                Peak Arrival Time Histogram
              </h3>
              <p className="text-xs text-slate-500">Distribution of employee check-in times during morning hours</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Peak: {summary.peak_arrival?.range || 'N/A'}
            </span>
          </div>

          <div className="space-y-3.5 pt-2">
            {arrivalHistogram.map((slot) => {
              const isPeak = summary.peak_arrival?.range === slot.range;
              const isLateSlot = slot.status === 'late';

              return (
                <div key={slot.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      {slot.range}
                      {isPeak && <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-black">PEAK</span>}
                    </span>
                    <span className="font-mono text-slate-600">
                      {slot.count} arrivals ({slot.pct}%)
                    </span>
                  </div>

                  <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLateSlot 
                          ? 'bg-gradient-to-r from-amber-500 to-rose-500' 
                          : 'bg-gradient-to-r from-brand-navy to-brand-teal'
                      }`}
                      style={{ width: `${Math.max(3, slot.pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FEATURE 5: AVERAGE WORKING HOURS & DURATION LEADERBOARD */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Zap size={18} className="text-sky-500" />
                Working Hours & Duration Leaderboard
              </h3>
              <p className="text-xs text-slate-500">Calculated shift duration (Checkout − Checkin)</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
              Avg {summary.company_avg_hours}h
            </span>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[290px] pr-1">
            {workingHoursLeaderboard.length === 0 ? (
              <p className="text-center py-10 text-slate-400 text-xs">
                No checkout logs recorded yet. Employees need to scan at gate checkout terminal to compute durations.
              </p>
            ) : (
              workingHoursLeaderboard.map((emp) => (
                <div key={emp.employee_id} className="py-2.5 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-xl transition text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{emp.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{emp.department} • {emp.checkout_count} completed shifts</p>
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <span className="font-black text-sky-600 text-sm block">{emp.avg_hours} hrs/day</span>
                    <span className="text-[10px] text-slate-400 block">{emp.total_hours} hrs total</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

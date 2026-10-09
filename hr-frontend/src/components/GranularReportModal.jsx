import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, FileText, Calendar, Download, RefreshCw, CheckCircle2, 
  Clock, AlertTriangle, ShieldCheck, User, Building, FileSpreadsheet,
  Sparkles, Check, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiCall, getProfileImageUrl } from '../api';
import { generateGranularEmployeePDF, formatDateOnly } from '../utils/pdfGenerator';

export default function GranularReportModal({
  isOpen,
  onClose,
  employee,
  companyName = 'Enterprise Attendance',
  logoUrl = null,
  initialDateFrom = '',
  initialDateTo = ''
}) {
  if (!isOpen || !employee) return null;

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // Scope Modes: 'single', 'month', 'range', 'all'
  const [scopeMode, setScopeMode] = useState(
    initialDateFrom && initialDateTo && initialDateFrom === initialDateTo 
      ? 'single' 
      : initialDateFrom || initialDateTo 
        ? 'range' 
        : 'month'
  );

  const [singleDate, setSingleDate] = useState(initialDateFrom || todayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [dateFrom, setDateFrom] = useState(initialDateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(initialDateTo || todayStr);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Compute effective date_from and date_to based on scope mode
  const { effectiveFrom, effectiveTo, scopeLabel } = useMemo(() => {
    if (scopeMode === 'single') {
      let formattedDay = singleDate;
      try {
        const d = new Date(singleDate);
        formattedDay = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      } catch {}
      return {
        effectiveFrom: singleDate,
        effectiveTo: singleDate,
        scopeLabel: `Single Day (${formattedDay})`
      };
    }

    if (scopeMode === 'month') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      const monthName = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return {
        effectiveFrom: formatDateOnly(start),
        effectiveTo: formatDateOnly(end),
        scopeLabel: `Month of ${monthName}`
      };
    }

    if (scopeMode === 'range') {
      return {
        effectiveFrom: dateFrom,
        effectiveTo: dateTo,
        scopeLabel: `${dateFrom || 'Start'} to ${dateTo || 'Present'}`
      };
    }

    // 'all'
    return {
      effectiveFrom: '',
      effectiveTo: '',
      scopeLabel: 'Complete Lifetime History (All Records)'
    };
  }, [scopeMode, singleDate, selectedMonth, dateFrom, dateTo]);

  // Fetch records whenever effective date window changes
  const fetchScopeRecords = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (employee.employee_id) query.append('employee_id', employee.employee_id);
      if (employee.name) query.append('name', employee.name);
      if (effectiveFrom) query.append('date_from', effectiveFrom);
      if (effectiveTo) query.append('date_to', effectiveTo);

      const res = await apiCall(`/attendance/detail?${query.toString()}`);
      setRecords(res.records || []);
    } catch (err) {
      console.error('Failed to load scope records:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [employee, effectiveFrom, effectiveTo]);

  useEffect(() => {
    fetchScopeRecords();
  }, [fetchScopeRecords]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Quick range presets
  const applyPreset = (preset) => {
    const now = new Date();
    if (preset === 'today') {
      setScopeMode('single');
      setSingleDate(todayStr);
    } else if (preset === 'yesterday') {
      setScopeMode('single');
      const y = new Date();
      y.setDate(y.getDate() - 1);
      setSingleDate(y.toISOString().slice(0, 10));
    } else if (preset === 'this_month') {
      setScopeMode('month');
      setSelectedMonth(currentMonthStr);
    } else if (preset === 'last_month') {
      setScopeMode('month');
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const yStr = lm.getFullYear();
      const mStr = String(lm.getMonth() + 1).padStart(2, '0');
      setSelectedMonth(`${yStr}-${mStr}`);
    } else if (preset === 'last_7d') {
      setScopeMode('range');
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      setDateFrom(d7.toISOString().slice(0, 10));
      setDateTo(todayStr);
    } else if (preset === 'last_14d') {
      setScopeMode('range');
      const d14 = new Date();
      d14.setDate(d14.getDate() - 13);
      setDateFrom(d14.toISOString().slice(0, 10));
      setDateTo(todayStr);
    } else if (preset === 'last_30d') {
      setScopeMode('range');
      const d30 = new Date();
      d30.setDate(d30.getDate() - 29);
      setDateFrom(d30.toISOString().slice(0, 10));
      setDateTo(todayStr);
    } else if (preset === 'this_year') {
      setScopeMode('range');
      const yStart = new Date(now.getFullYear(), 0, 1);
      setDateFrom(yStart.toISOString().slice(0, 10));
      setDateTo(todayStr);
    } else if (preset === 'all_time') {
      setScopeMode('all');
    }
  };

  // Metrics calculation for the preview
  const presentCount = records.filter(r => r.status === 'present' || r.status === 'late').length;
  const onTimeCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const totalCount = records.length;
  const ratePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;
  const punctualityPct = presentCount > 0 ? Math.round((onTimeCount / presentCount) * 100) : 100;

  // Handle PDF Generation
  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      await generateGranularEmployeePDF({
        employee,
        attendanceRecords: records,
        companyName,
        logoUrl,
        dateFrom: effectiveFrom,
        dateTo: effectiveTo
      });
      setToastMsg('Executive PDF Dossier successfully generated & downloaded!');
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      window.alert('PDF Generation error: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Excel Export
  const handleExportExcel = () => {
    if (!records.length) {
      window.alert('No records to export in the selected period.');
      return;
    }

    const dataToExport = records.map((r, i) => ({
      "#": i + 1,
      "Employee ID": employee.employee_id || '',
      "Employee Name": employee.name || '',
      "Department": employee.department || employee.domain || '',
      "Date": r.date || '',
      "Check-In": r.checkin || '',
      "Check-Out": r.checkout || '',
      "Status": (r.status || 'present').toUpperCase(),
      "Remarks": r.reason || (r.status === 'late' ? 'Late Arrival' : r.status === 'absent' ? 'Unexcused Absence' : 'Biometric Scan')
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Dossier");
    
    const cleanName = (employee.name || 'Employee').replace(/\s+/g, '_');
    XLSX.writeFile(workbook, `${cleanName}_${scopeMode}_attendance.xlsx`);
  };

  const getCleanName = (rawName) => {
    if (!rawName) return 'Employee';
    return rawName.includes('_') ? rawName.split('_').slice(1).join(' ') : rawName;
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { 
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          onClose?.(); 
        }
      }}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* MODAL HEADER WITH EMPLOYEE PROFILE CARD */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-brand-navy to-brand-dark text-white shrink-0 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-52 h-52 bg-brand-teal/20 rounded-full blur-2xl pointer-events-none" />

          {/* Close X Button with high z-index and explicit click handler */}
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }} 
            className="absolute top-5 right-5 z-50 text-white/80 hover:text-white bg-white/10 hover:bg-white/25 p-2 rounded-full transition-all backdrop-blur-sm cursor-pointer shadow-sm active:scale-90"
            title="Close modal (Esc)"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-4 relative z-10">
            {employee.profile_picture ? (
              <img
                src={getProfileImageUrl(employee.profile_picture)}
                alt={getCleanName(employee.name)}
                className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white/80 shrink-0"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div className={`w-16 h-16 bg-gradient-to-tr from-brand-teal to-blue-500 rounded-2xl text-white flex items-center justify-center text-2xl font-black shadow-lg border border-white/20 shrink-0 ${employee.profile_picture ? 'hidden' : 'flex'}`}>
              {getCleanName(employee.name).charAt(0).toUpperCase()}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-black tracking-tight text-white">{getCleanName(employee.name)}</h3>
                <span className="px-2.5 py-0.5 rounded-md bg-teal-400/20 text-teal-300 border border-teal-400/30 text-xs font-mono font-bold">
                  {employee.employee_id}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1">
                {employee.department || employee.domain || 'General'} {employee.position ? `• ${employee.position}` : ''}
              </p>
              <p className="text-[11px] text-teal-200/80 font-medium mt-0.5">
                Granular Attendance & Biometric Audit Report Exporter
              </p>
            </div>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Toast Notification */}
          {toastMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Scope Selector Tabs */}
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-brand-teal" />
                <span>1. Select Report Period & Granularity</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setScopeMode('single')}
                className={`py-3 px-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  scopeMode === 'single'
                    ? 'bg-brand-navy text-white border-brand-navy shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Clock size={16} className={scopeMode === 'single' ? 'text-teal-300' : 'text-slate-400'} />
                <span>Single Day</span>
              </button>

              <button
                type="button"
                onClick={() => setScopeMode('month')}
                className={`py-3 px-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  scopeMode === 'month'
                    ? 'bg-brand-navy text-white border-brand-navy shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Calendar size={16} className={scopeMode === 'month' ? 'text-teal-300' : 'text-slate-400'} />
                <span>Specific Month</span>
              </button>

              <button
                type="button"
                onClick={() => setScopeMode('range')}
                className={`py-3 px-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  scopeMode === 'range'
                    ? 'bg-brand-navy text-white border-brand-navy shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Sparkles size={16} className={scopeMode === 'range' ? 'text-teal-300' : 'text-slate-400'} />
                <span>Custom Range</span>
              </button>

              <button
                type="button"
                onClick={() => setScopeMode('all')}
                className={`py-3 px-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  scopeMode === 'all'
                    ? 'bg-brand-navy text-white border-brand-navy shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <FileText size={16} className={scopeMode === 'all' ? 'text-teal-300' : 'text-slate-400'} />
                <span>Entire Record</span>
              </button>
            </div>
          </div>

          {/* Scope Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            
            {/* Mode 1: Single Day */}
            {scopeMode === 'single' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block">Choose Date</label>
                    <span className="text-[11px] text-slate-400">Generate a granular timeline of all scans on this specific date.</span>
                  </div>
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                  />
                </div>

                <div className="flex gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => applyPreset('today')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('yesterday')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Yesterday
                  </button>
                </div>
              </div>
            )}

            {/* Mode 2: Specific Month */}
            {scopeMode === 'month' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block">Choose Month & Year</label>
                    <span className="text-[11px] text-slate-400">Export the entire monthly roster dossier for audit & payroll.</span>
                  </div>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                  />
                </div>

                <div className="flex gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => applyPreset('this_month')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Current Month
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('last_month')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Previous Month
                  </button>
                </div>
              </div>
            )}

            {/* Mode 3: Custom Date Range */}
            {scopeMode === 'range' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">From Date (Start)</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">To Date (End)</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-teal"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => applyPreset('last_7d')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    Last 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('last_14d')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    Last 14 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('last_30d')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    Last 30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('this_month')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('this_year')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    This Year
                  </button>
                </div>
              </div>
            )}

            {/* Mode 4: Entire Record */}
            {scopeMode === 'all' && (
              <div className="p-3 text-xs text-slate-600 font-medium">
                <p className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                  <ShieldCheck size={16} className="text-teal-600" />
                  Full Lifetime Dossier Selected
                </p>
                <span>Generates the complete historical attendance trajectory from the day of registration to the latest biometric scan.</span>
              </div>
            )}

          </div>

          {/* Scope Telemetry Preview */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-black text-slate-700 uppercase tracking-wider">2. Period Telemetry Preview</span>
              <span className="font-bold text-brand-teal font-mono">{scopeLabel}</span>
            </div>

            {loading ? (
              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-brand-teal" />
                <span>Aggregating biometric logs for selected period...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">Present</span>
                  <span className="text-lg font-black text-emerald-600">{presentCount} Days</span>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">Late</span>
                  <span className="text-lg font-black text-amber-600">{lateCount} Days</span>
                </div>
                <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                  <span className="text-[10px] font-bold text-rose-800 uppercase block">Absent</span>
                  <span className="text-lg font-black text-rose-600">{absentCount} Days</span>
                </div>
                <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-100">
                  <span className="text-[10px] font-bold text-teal-800 uppercase block">Turnout</span>
                  <span className="text-lg font-black text-teal-700">{ratePct}%</span>
                </div>
              </div>
            )}

            {!loading && records.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium">
                No attendance scans found in this specific period. The generated report will show 0 logged entries.
              </p>
            )}
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || isGenerating || records.length === 0}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="Export filtered records to Excel spreadsheet"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={loading || isGenerating}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-95"
            >
              <FileText size={16} className={isGenerating ? 'animate-spin' : ''} />
              <span>{isGenerating ? 'Generating Dossier...' : 'Download PDF Dossier'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

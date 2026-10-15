import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  AlertCircle, CheckCircle2, Clock, Camera, HelpCircle, 
  Send, Search, RefreshCw, ArrowLeft, ShieldAlert, 
  UserCheck, Calendar, ChevronRight, Sparkles, Building2,
  FileQuestion, ShieldCheck, Check, Info, AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { apiCall, getProfileImageUrl } from '../api';

const REASON_CATEGORIES = [
  {
    id: 'Model Failed to Scan',
    label: 'Model Failed to Scan',
    icon: '🤖',
    desc: 'AI face engine did not recognize or detect face properly'
  },
  {
    id: 'Camera / Hardware Glitch',
    label: 'Camera / Hardware Glitch',
    icon: '📷',
    desc: 'Camera feed was blank, lagging, frozen, or device offline'
  },
  {
    id: 'Lighting / Visibility Issue',
    label: 'Lighting / Visibility Issue',
    icon: '💡',
    desc: 'Direct glare, backlight, or low ambient light at the entrance'
  },
  {
    id: 'Unrecognized Face Alert',
    label: 'Unrecognized Face Alert',
    icon: '❓',
    desc: 'System marked you as an unknown person or rejected identity'
  },
  {
    id: 'Other Attendance Dispute',
    label: 'Other Attendance Dispute',
    icon: '📝',
    desc: 'Any other valid reason for missed physical camera scan'
  }
];

export default function EmployeeDisputePortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('submit'); // 'submit' | 'track'
  
  // Form State
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkinTime, setCheckinTime] = useState('09:00:00');
  const [checkoutTime, setCheckoutTime] = useState('');
  const [reasonCategory, setReasonCategory] = useState(REASON_CATEGORIES[0].id);
  const [explanation, setExplanation] = useState('');
  
  // Verification & Status State
  const [verifying, setVerifying] = useState(false);
  const [verifiedEmployee, setVerifiedEmployee] = useState(null);
  const [attendanceOnDate, setAttendanceOnDate] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState(null);
  const [submitError, setSubmitError] = useState('');

  // Tracking State
  const [trackIdInput, setTrackIdInput] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackedQueries, setTrackedQueries] = useState(null);
  const [trackError, setTrackError] = useState('');

  // Branding
  const [companyName, setCompanyName] = useState('Enterprise Attendance');
  const [logoUrl, setLogoUrl] = useState('/logo.png');

  useEffect(() => {
    document.title = 'Employee Attendance Dispute Portal';
    const loadSettings = async () => {
      try {
        const res = await apiCall('/settings/');
        if (res.companyName) setCompanyName(res.companyName);
        if (res.logoUrl) setLogoUrl(res.logoUrl);
      } catch {
        const savedName = localStorage.getItem('companyName');
        const savedLogo = localStorage.getItem('logoUrl');
        if (savedName) setCompanyName(savedName);
        if (savedLogo) setLogoUrl(savedLogo);
      }
    };
    loadSettings();
  }, []);

  // Debounced Employee Verification
  useEffect(() => {
    if (!employeeIdInput.trim()) {
      setVerifiedEmployee(null);
      setAttendanceOnDate(null);
      setVerifyError('');
      return;
    }

    const timer = setTimeout(async () => {
      setVerifying(true);
      setVerifyError('');
      try {
        const dateParam = selectedDate ? `&date=${selectedDate}` : '';
        const res = await apiCall(`/attendance-queries/verify-employee?query=${encodeURIComponent(employeeIdInput.trim())}${dateParam}`);
        if (res.status === 'success' && res.employee) {
          setVerifiedEmployee(res.employee);
          setAttendanceOnDate(res.attendance);
        }
      } catch (err) {
        setVerifiedEmployee(null);
        setAttendanceOnDate(null);
        setVerifyError(err.message || 'Employee not found. Please check your ID.');
      } finally {
        setVerifying(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [employeeIdInput, selectedDate]);

  // Handle Query Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!verifiedEmployee) {
      setSubmitError('Please enter a valid Employee ID before submitting.');
      return;
    }
    if (!explanation.trim()) {
      setSubmitError('Please provide a short explanation of what happened.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await apiCall('/attendance-queries', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: verifiedEmployee.employee_id,
          date: selectedDate,
          checkin_time: checkinTime || '09:00:00',
          checkout_time: checkoutTime || null,
          reason_category: reasonCategory,
          explanation: explanation.trim()
        })
      });

      if (res.status === 'success' && res.query) {
        setSubmittedQuery(res.query);
        // Reset form
        setExplanation('');
      } else {
        throw new Error(res.message || 'Failed to submit query');
      }
    } catch (err) {
      setSubmitError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Track Queries
  const handleTrackQueries = async (e) => {
    if (e) e.preventDefault();
    const queryId = (trackIdInput || (verifiedEmployee?.employee_id) || '').trim();
    if (!queryId) {
      setTrackError('Please enter your Employee ID to track queries.');
      return;
    }

    setTrackingLoading(true);
    setTrackError('');
    try {
      const res = await apiCall(`/attendance-queries/employee/${encodeURIComponent(queryId)}`);
      if (res.status === 'success') {
        setTrackedQueries(res.queries || []);
      }
    } catch (err) {
      setTrackedQueries([]);
      setTrackError(err.message || 'Failed to load queries.');
    } finally {
      setTrackingLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-brand-teal selection:text-white relative overflow-x-hidden">
      
      {/* Background Glow Elements */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-brand-teal/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-brand-navy/30 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Logo" className="h-9 w-9 object-contain rounded-full bg-white/10 p-1" />
          <div>
            <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-white flex items-center gap-2">
              <span>{companyName}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-teal/20 text-brand-teal border border-brand-teal/30">
                Self-Service
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Attendance Dispute & Regularization Desk</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/gate"
            className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
          >
            <Camera size={14} className="text-brand-teal" />
            <span className="hidden sm:inline">Gate Terminal</span>
          </Link>
          <Link
            to="/login"
            className="px-3.5 py-1.5 rounded-xl bg-brand-teal hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <ShieldCheck size={14} />
            <span className="hidden sm:inline">HR Login</span>
          </Link>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col justify-center">

        {/* Hero Title */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold mb-1">
            <AlertCircle size={14} />
            <span>Marked Absent Due to Failed Face Scan or Camera Glitch?</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Attendance Regularization Query
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            If you were physically present at the office but the camera or AI model didn't record your check-in, 
            submit your query below. HR will review and mark your attendance as <strong>Present</strong>.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-center mb-6">
          <div className="bg-slate-950/90 border border-slate-800 p-1 rounded-2xl flex max-w-md w-full shadow-lg">
            <button
              onClick={() => {
                setActiveTab('submit');
                setSubmittedQuery(null);
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'submit'
                  ? 'bg-gradient-to-r from-brand-navy to-slate-800 text-white shadow-md border border-brand-teal/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Send size={15} className={activeTab === 'submit' ? 'text-brand-teal' : ''} />
              <span>Submit Query</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('track');
                if (verifiedEmployee && !trackIdInput) {
                  setTrackIdInput(verifiedEmployee.employee_id);
                  handleTrackQueries();
                }
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'track'
                  ? 'bg-gradient-to-r from-brand-navy to-slate-800 text-white shadow-md border border-brand-teal/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search size={15} className={activeTab === 'track' ? 'text-brand-teal' : ''} />
              <span>Track Resolution Status</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            TAB 1: SUBMIT ATTENDANCE QUERY
           ======================================================== */}
        {activeTab === 'submit' && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-5 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            
            {/* SUBMITTED SUCCESS VIEW */}
            {submittedQuery ? (
              <div className="text-center py-8 space-y-5 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-400/40 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.3)] animate-bounce">
                  <CheckCircle2 size={44} />
                </div>

                <div className="space-y-2">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">
                    Query Reference #{submittedQuery.id}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">
                    Query Successfully Sent to HR!
                  </h3>
                  <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                    Thank you <strong>{submittedQuery.employee_name}</strong>. Your query for date <strong>{submittedQuery.date}</strong> has been forwarded to the HR Admin team.
                  </p>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 max-w-md mx-auto text-left space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Employee ID:</span>
                    <span className="font-mono font-bold text-white">{submittedQuery.employee_id}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Disputed Date:</span>
                    <span className="font-bold text-white">{submittedQuery.date}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Requested Check-in:</span>
                    <span className="font-mono font-bold text-brand-teal">{submittedQuery.checkin_time || '09:00:00'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Reason Category:</span>
                    <span className="font-bold text-amber-300">{submittedQuery.reason_category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Status:</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                      <Clock size={11} /> Pending HR Approval
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => {
                      setTrackIdInput(submittedQuery.employee_id);
                      setActiveTab('track');
                      handleTrackQueries();
                    }}
                    className="px-6 py-3 rounded-xl bg-brand-teal hover:bg-emerald-400 text-slate-950 font-bold text-sm transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <span>Track Status Live</span>
                    <ArrowRight size={16} />
                  </button>

                  <button
                    onClick={() => setSubmittedQuery(null)}
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition"
                  >
                    Submit Another Query
                  </button>
                </div>
              </div>
            ) : (
              /* THE FORM */
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {submitError && (
                  <div className="bg-rose-500/15 border border-rose-500/40 text-rose-300 px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-3 animate-in shake">
                    <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* STEP 1: EMPLOYEE IDENTIFICATION */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-brand-teal text-slate-950 flex items-center justify-center text-[10px] font-black">1</span>
                    <span>Identify Yourself (Employee ID or Name)</span>
                  </label>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Search size={16} />
                    </div>
                    <input
                      type="text"
                      required
                      value={employeeIdInput}
                      onChange={(e) => setEmployeeIdInput(e.target.value)}
                      placeholder="Enter your Employee ID (e.g. 101, 102) or full name..."
                      className="w-full pl-10 pr-10 py-3 bg-slate-900 border border-slate-700/80 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition"
                    />
                    {verifying && (
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-brand-teal">
                        <RefreshCw size={16} className="animate-spin" />
                      </div>
                    )}
                  </div>

                  {verifyError && (
                    <p className="text-xs text-rose-400 flex items-center gap-1.5 pl-1">
                      <AlertCircle size={13} /> {verifyError}
                    </p>
                  )}

                  {/* VERIFIED EMPLOYEE CARD */}
                  {verifiedEmployee && (
                    <div className="bg-gradient-to-r from-brand-navy/60 to-slate-900/90 border border-brand-teal/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-3 min-w-0">
                        {verifiedEmployee.profile_picture ? (
                          <img
                            src={getProfileImageUrl(verifiedEmployee.profile_picture)}
                            alt={verifiedEmployee.name}
                            className="w-12 h-12 rounded-xl object-cover border-2 border-brand-teal shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-brand-teal/20 text-brand-teal font-extrabold flex items-center justify-center border border-brand-teal/40 shrink-0 text-base">
                            {verifiedEmployee.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-sm sm:text-base truncate">{verifiedEmployee.name}</h4>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                              <Check size={10} /> Verified
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-brand-teal">ID: {verifiedEmployee.employee_id}</span>
                            <span>&bull;</span>
                            <span>{verifiedEmployee.department}</span>
                            {verifiedEmployee.position && <span>&bull; {verifiedEmployee.position}</span>}
                          </p>
                        </div>
                      </div>

                      {/* Attendance status badge for the date */}
                      {attendanceOnDate && (
                        <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 ${
                          attendanceOnDate.has_record
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                        }`}>
                          {attendanceOnDate.has_record ? (
                            <span>Current: {attendanceOnDate.status?.toUpperCase()} (Check-in {attendanceOnDate.checkin})</span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <AlertCircle size={13} /> Marked Absent (No Scan Found)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* STEP 2: DATE & TIME */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-brand-teal text-slate-950 flex items-center justify-center text-[10px] font-black">2</span>
                    <span>Date of Missed Attendance & Arrival Time</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Disputed Date</label>
                      <input
                        type="date"
                        required
                        value={selectedDate}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-brand-teal"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Arrival / Check-in Time</label>
                      <input
                        type="time"
                        step="1"
                        required
                        value={checkinTime}
                        onChange={(e) => setCheckinTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-brand-teal font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Check-out Time (Optional)</label>
                      <input
                        type="time"
                        step="1"
                        value={checkoutTime}
                        onChange={(e) => setCheckoutTime(e.target.value)}
                        placeholder="18:00:00"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-brand-teal font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* STEP 3: REASON CATEGORY */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-brand-teal text-slate-950 flex items-center justify-center text-[10px] font-black">3</span>
                    <span>Reason for Attendance Scan Failure</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {REASON_CATEGORIES.map((cat) => {
                      const isSelected = reasonCategory === cat.id;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => setReasonCategory(cat.id)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                            isSelected
                              ? 'bg-brand-navy/60 border-brand-teal text-white shadow-[0_0_15px_rgba(33,196,201,0.2)]'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{cat.icon}</span>
                            <span className="text-xs font-bold">{cat.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {cat.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* STEP 4: DETAILED EXPLANATION */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-brand-teal text-slate-950 flex items-center justify-center text-[10px] font-black">4</span>
                    <span>Explanation & Details for HR Admin</span>
                  </label>
                  
                  <textarea
                    required
                    rows={3}
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Describe what occurred (e.g., 'I arrived at 9:05 AM and stood before the main gate tablet. The camera showed Unrecognized Face even after 3 attempts. Rahul from IT was present as witness. Please approve my attendance.')"
                    className="w-full p-3.5 bg-slate-900 border border-slate-700/80 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition resize-none leading-relaxed"
                  />
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting || !verifiedEmployee}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-teal to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-sm sm:text-base transition shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {submitting ? (
                      <><RefreshCw className="animate-spin" size={18} /> Submitting Dispute to HR...</>
                    ) : (
                      <><Send size={18} /> Submit Attendance Query to HR</>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-slate-500 mt-2">
                    Once submitted, your query will notify HR instantly and will appear on their attendance review board.
                  </p>
                </div>

              </form>
            )}

          </div>
        )}

        {/* ========================================================
            TAB 2: TRACK STATUS OF PREVIOUS QUERIES
           ======================================================== */}
        {activeTab === 'track' && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-5 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            
            {/* Search Bar for Employee ID */}
            <form onSubmit={handleTrackQueries} className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  required
                  value={trackIdInput}
                  onChange={(e) => setTrackIdInput(e.target.value)}
                  placeholder="Enter your Employee ID to view your queries..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700/80 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal"
                />
              </div>

              <button
                type="submit"
                disabled={trackingLoading}
                className="px-6 py-3 rounded-2xl bg-brand-teal hover:bg-emerald-400 text-slate-950 font-bold text-sm transition shrink-0 flex items-center gap-1.5"
              >
                {trackingLoading ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                <span>Track</span>
              </button>
            </form>

            {trackError && (
              <div className="bg-rose-500/15 border border-rose-500/40 text-rose-300 p-4 rounded-2xl text-xs sm:text-sm">
                {trackError}
              </div>
            )}

            {/* Queries List */}
            {trackedQueries !== null && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-300">
                    Query History for {trackIdInput}: {trackedQueries.length} found
                  </h3>
                  <button
                    onClick={() => handleTrackQueries()}
                    className="text-xs font-semibold text-brand-teal hover:text-emerald-300 flex items-center gap-1"
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>

                {trackedQueries.length === 0 ? (
                  <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800/80 text-slate-400 space-y-2">
                    <FileQuestion size={40} className="mx-auto text-slate-500 opacity-60" />
                    <p className="font-semibold text-sm text-slate-300">No Queries Found</p>
                    <p className="text-xs">No attendance dispute queries have been filed for Employee ID "{trackIdInput}".</p>
                  </div>
                ) : (
                  trackedQueries.map((q) => {
                    const isPending = q.status === 'pending';
                    const isApproved = q.status === 'approved';
                    const isRejected = q.status === 'rejected';

                    return (
                      <div
                        key={q.id}
                        className={`rounded-2xl border p-4 sm:p-5 transition-all space-y-3 ${
                          isPending 
                            ? 'bg-amber-500/5 border-amber-500/30' 
                            : isApproved 
                              ? 'bg-emerald-500/5 border-emerald-500/30'
                              : 'bg-rose-500/5 border-rose-500/30'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-brand-teal">
                              Query #{q.id}
                            </span>
                            <span className="text-slate-600">&bull;</span>
                            <span className="font-bold text-white text-sm">
                              Date: {q.date}
                            </span>
                            <span className="text-slate-600">&bull;</span>
                            <span className="text-xs text-amber-300 font-semibold">
                              {q.reason_category}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            {isPending && (
                              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-extrabold flex items-center gap-1.5 animate-pulse">
                                <Clock size={12} /> Pending HR Review
                              </span>
                            )}
                            {isApproved && (
                              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold flex items-center gap-1.5">
                                <CheckCircle2 size={12} /> Approved & Marked Present
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-extrabold flex items-center gap-1.5">
                                <AlertTriangle size={12} /> Rejected by HR
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Explanation */}
                        <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                          <span className="text-slate-400 font-bold block mb-1">Your Explanation:</span>
                          <p className="italic leading-relaxed">{q.explanation}</p>
                          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-3">
                            <span>Requested check-in: <strong className="text-white font-mono">{q.checkin_time}</strong></span>
                            {q.checkout_time && <span>Check-out: <strong className="text-white font-mono">{q.checkout_time}</strong></span>}
                            <span>Submitted: {q.created_at ? new Date(q.created_at).toLocaleString() : '-'}</span>
                          </div>
                        </div>

                        {/* HR Resolution Feedback */}
                        {(isApproved || isRejected) && (
                          <div className={`text-xs p-3 rounded-xl border flex items-start gap-2.5 ${
                            isApproved 
                              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' 
                              : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                          }`}>
                            {isApproved ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />}
                            <div className="space-y-1">
                              <span className="font-bold block">
                                {isApproved ? 'HR Approved Attendance:' : 'HR Feedback / Remarks:'}
                              </span>
                              <p>{q.hr_notes || (isApproved ? 'Marked Present in attendance system.' : 'No notes provided.')}</p>
                              {q.resolved_by && (
                                <p className="text-[10px] opacity-75">
                                  Resolved by {q.resolved_by} {q.resolved_at ? `on ${new Date(q.resolved_at).toLocaleString()}` : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })
                )}

              </div>
            )}

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-4 text-center text-xs text-slate-500 bg-slate-950">
        &copy; {new Date().getFullYear()} {companyName} &bull; Biometric Face Attendance System &bull; Employee Dispute & Regularization Desk
      </footer>

    </div>
  );
}

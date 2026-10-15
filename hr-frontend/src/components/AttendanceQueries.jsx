import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, CheckCircle2, Clock, AlertTriangle, Search, 
  Filter, RefreshCw, Check, X, ShieldAlert, ArrowRight,
  Calendar, FileText, Sparkles, Building2, Eye, UserCheck,
  ChevronDown, ExternalLink, HelpCircle, MessageSquare,
  ThumbsUp, ThumbsDown, Trash2
} from 'lucide-react';
import { apiCall, getWebSocketUrl, getProfileImageUrl } from '../api';

export default function AttendanceQueries() {
  const [queries, setQueries] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, approved, rejected
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Approval Modal State
  const [approvingQuery, setApprovingQuery] = useState(null);
  const [approvedCheckin, setApprovedCheckin] = useState('09:00:00');
  const [approvedCheckout, setApprovedCheckout] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState('present');
  const [hrApproveNotes, setHrApproveNotes] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Reject Modal State
  const [rejectingQuery, setRejectingQuery] = useState(null);
  const [hrRejectNotes, setHrRejectNotes] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Leave Requests State for HR
  const [mainTab, setMainTab] = useState('disputes'); // 'disputes' | 'leaves'
  const [leaves, setLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('all');
  const [leaveSearch, setLeaveSearch] = useState('');
  const [reviewingLeave, setReviewingLeave] = useState(null); // { leave, action: 'approve'|'reject' }
  const [leaveReviewNotes, setLeaveReviewNotes] = useState('');
  const [isSubmittingLeaveReview, setIsSubmittingLeaveReview] = useState(false);

  // Fetch Leaves
  const fetchLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const endpoint = leaveStatusFilter !== 'all' 
        ? `/employee/hr/leaves?status=${leaveStatusFilter}` 
        : '/employee/hr/leaves';
      const res = await apiCall(endpoint);
      if (res.status === 'success') {
        setLeaves(res.leaves || []);
      }
    } catch (err) {
      console.error('Failed to load leaves for HR:', err);
    } finally {
      setLeavesLoading(false);
    }
  }, [leaveStatusFilter]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleConfirmLeaveReview = async () => {
    if (!reviewingLeave?.leave) return;
    setIsSubmittingLeaveReview(true);
    try {
      const res = await apiCall(`/employee/hr/leaves/${reviewingLeave.leave.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action: reviewingLeave.action,
          review_notes: leaveReviewNotes.trim() || (reviewingLeave.action === 'approve' ? 'Leave approved by HR.' : 'Leave rejected by HR.')
        })
      });
      if (res.status === 'success') {
        setToast({ type: 'success', message: res.message });
        setReviewingLeave(null);
        setLeaveReviewNotes('');
        fetchLeaves();
      }
    } catch (err) {
      setToast({ type: 'warning', message: err.message || 'Failed to review leave.' });
    } finally {
      setIsSubmittingLeaveReview(false);
    }
  };

  // Fetch Queries
  const fetchQueries = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      let endpoint = `/attendance-queries?`;
      if (statusFilter && statusFilter !== 'all') endpoint += `status=${statusFilter}&`;
      if (searchQuery.trim()) endpoint += `search=${encodeURIComponent(searchQuery.trim())}&`;
      if (dateFrom) endpoint += `date_from=${dateFrom}&`;
      if (dateTo) endpoint += `date_to=${dateTo}&`;

      const res = await apiCall(endpoint);
      if (res.status === 'success') {
        setQueries(res.queries || []);
        if (res.counts) setCounts(res.counts);
      }
    } catch (err) {
      console.error('Failed to load attendance queries:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  // Live WebSocket Integration
  useEffect(() => {
    let ws = null;
    let isSubscribed = true;

    try {
      ws = new WebSocket(getWebSocketUrl('/ws/attendance'));

      ws.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'NEW_ATTENDANCE_QUERY') {
            fetchQueries(true);
            setToast({
              type: 'info',
              message: `New Attendance Query from ${msg.employee_name || 'an employee'} (${msg.reason_category})`
            });
          }
          if (msg.type === 'ATTENDANCE_QUERY_RESOLVED' || msg.type === 'ATTENDANCE_QUERY_UPDATED') {
            fetchQueries(true);
          }
        } catch (err) {}
      };
    } catch (e) {
      console.warn('WS init failed:', e);
    }

    return () => {
      isSubscribed = false;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) ws.close();
        else if (ws.readyState === WebSocket.CONNECTING) ws.onopen = () => ws.close();
      }
    };
  }, [fetchQueries]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Open Approval Modal
  const openApproveModal = (q) => {
    setApprovingQuery(q);
    setApprovedCheckin(q.checkin_time || '09:00:00');
    setApprovedCheckout(q.checkout_time || '');
    setAttendanceStatus('present');
    setHrApproveNotes(`Approved by HR: Regularized missed scan (${q.reason_category}).`);
  };

  // Submit Approval
  const handleConfirmApproval = async () => {
    if (!approvingQuery) return;
    setIsSubmittingApproval(true);

    try {
      const res = await apiCall(`/attendance-queries/${approvingQuery.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          approved_checkin: approvedCheckin,
          approved_checkout: approvedCheckout || null,
          status: attendanceStatus,
          hr_notes: hrApproveNotes
        })
      });

      if (res.status === 'success') {
        setToast({
          type: 'success',
          message: `Attendance marked as ${attendanceStatus.toUpperCase()} for ${approvingQuery.employee_name}!`
        });
        setApprovingQuery(null);
        fetchQueries(true);
      }
    } catch (err) {
      alert('Failed to approve query: ' + err.message);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Open Reject Modal
  const openRejectModal = (q) => {
    setRejectingQuery(q);
    setHrRejectNotes('');
  };

  // Submit Rejection
  const handleConfirmReject = async () => {
    if (!rejectingQuery) return;
    if (!hrRejectNotes.trim()) {
      alert('Please provide a reason / remark for rejecting.');
      return;
    }
    setIsSubmittingReject(true);

    try {
      const res = await apiCall(`/attendance-queries/${rejectingQuery.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          hr_notes: hrRejectNotes.trim()
        })
      });

      if (res.status === 'success') {
        setToast({
          type: 'warning',
          message: `Query rejected. Reason recorded for employee.`
        });
        setRejectingQuery(null);
        fetchQueries(true);
      }
    } catch (err) {
      alert('Failed to reject query: ' + err.message);
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Delete query
  const handleDeleteQuery = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this query record?')) return;
    try {
      await apiCall(`/attendance-queries/${id}`, { method: 'DELETE' });
      setQueries(prev => prev.filter(q => q.id !== id));
      setToast({ type: 'info', message: 'Query record deleted.' });
    } catch (err) {
      alert('Failed to delete query: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-200 ${
          toast.type === 'success' 
            ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500/50 backdrop-blur-md'
            : toast.type === 'warning'
              ? 'bg-amber-900/90 text-amber-100 border-amber-500/50 backdrop-blur-md'
              : 'bg-slate-900/90 text-white border-slate-700 backdrop-blur-md'
        }`}>
          {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
          {toast.type === 'warning' && <AlertTriangle size={18} className="text-amber-400" />}
          {toast.type === 'info' && <Sparkles size={18} className="text-brand-teal" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ShieldAlert size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Attendance Disputes & Regularization</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Review and resolve queries submitted by employees whose face scans failed or camera malfunctioned.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => fetchQueries(true)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-brand-teal' : ''} />
            <span>Refresh</span>
          </button>
          
          <a
            href="/attendance-query"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-blue text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <span>Open Employee Portal</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Switcher: Disputes vs Leave Requests */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200 shadow-inner">
        <button
          type="button"
          onClick={() => setMainTab('disputes')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
            mainTab === 'disputes' 
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert size={16} className={mainTab === 'disputes' ? 'text-amber-500' : 'text-slate-400'} />
          <span>Attendance Disputes</span>
          {counts.pending > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse">
              {counts.pending}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab('leaves')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
            mainTab === 'leaves' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar size={16} className={mainTab === 'leaves' ? 'text-white' : 'text-slate-400'} />
          <span>Employee Leave Requests</span>
          {leaves.filter(l => l.status === 'pending').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
              {leaves.filter(l => l.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {mainTab === 'disputes' && (
        <div className="space-y-6">
          {/* KPI METRIC CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Queries */}
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'all' 
              ? 'bg-slate-900 text-white border-slate-800 shadow-md ring-2 ring-brand-teal/40' 
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>
              Total Queries
            </span>
            <div className={`p-2 rounded-xl ${statusFilter === 'all' ? 'bg-white/10 text-brand-teal' : 'bg-slate-100 text-slate-700'}`}>
              <FileText size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black">{counts.total}</p>
          <span className={`text-[11px] mt-1 block ${statusFilter === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>
            All time submitted
          </span>
        </div>

        {/* Pending Resolution */}
        <div 
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'pending' 
              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400' 
              : 'bg-amber-50/60 text-slate-800 border-amber-200/80 hover:bg-amber-100/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${statusFilter === 'pending' ? 'text-slate-950' : 'text-amber-800'}`}>
              Pending Review
            </span>
            <div className={`p-2 rounded-xl ${statusFilter === 'pending' ? 'bg-black/10 text-slate-950' : 'bg-amber-200/60 text-amber-800'}`}>
              <Clock size={16} className={counts.pending > 0 ? "animate-spin-slow" : ""} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-black">{counts.pending}</p>
            {counts.pending > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse ${
                statusFilter === 'pending' ? 'bg-slate-950 text-amber-300' : 'bg-amber-500 text-white'
              }`}>
                Action Needed
              </span>
            )}
          </div>
          <span className={`text-[11px] mt-1 block font-medium ${statusFilter === 'pending' ? 'text-slate-900' : 'text-amber-700'}`}>
            Awaiting HR attendance mark
          </span>
        </div>

        {/* Approved & Marked */}
        <div 
          onClick={() => setStatusFilter('approved')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'approved' 
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400' 
              : 'bg-emerald-50/60 text-slate-800 border-emerald-200/80 hover:bg-emerald-100/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'approved' ? 'text-emerald-100' : 'text-emerald-800'}`}>
              Approved & Present
            </span>
            <div className={`p-2 rounded-xl ${statusFilter === 'approved' ? 'bg-white/10 text-white' : 'bg-emerald-200/60 text-emerald-800'}`}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black">{counts.approved}</p>
          <span className={`text-[11px] mt-1 block font-medium ${statusFilter === 'approved' ? 'text-emerald-100' : 'text-emerald-700'}`}>
            Attendance regularized
          </span>
        </div>

        {/* Rejected Queries */}
        <div 
          onClick={() => setStatusFilter('rejected')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'rejected' 
              ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-400' 
              : 'bg-rose-50/60 text-slate-800 border-rose-200/80 hover:bg-rose-100/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'rejected' ? 'text-rose-100' : 'text-rose-800'}`}>
              Rejected
            </span>
            <div className={`p-2 rounded-xl ${statusFilter === 'rejected' ? 'bg-white/10 text-white' : 'bg-rose-200/60 text-rose-800'}`}>
              <X size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black">{counts.rejected}</p>
          <span className={`text-[11px] mt-1 block font-medium ${statusFilter === 'rejected' ? 'text-rose-100' : 'text-rose-700'}`}>
            Disputes dismissed
          </span>
        </div>

      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by employee name, ID, department or reason..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: `Pending (${counts.pending})` },
            { id: 'approved', label: `Approved (${counts.approved})` },
            { id: 'rejected', label: `Rejected (${counts.rejected})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-brand-navy text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none"
            title="From date"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none"
            title="To date"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg text-xs"
              title="Clear date filter"
            >
              <X size={14} />
            </button>
          )}
        </div>

      </div>

      {/* QUERIES FEED */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-3">
          <RefreshCw size={28} className="animate-spin mx-auto text-brand-teal" />
          <p className="text-sm font-bold text-slate-700">Loading Attendance Queries...</p>
        </div>
      ) : queries.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-3">
          <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-1" />
          <h3 className="text-base font-bold text-slate-700">No Attendance Queries Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {statusFilter === 'pending' 
              ? 'Great! There are no pending attendance queries awaiting review.' 
              : 'No queries match your search or filter parameters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queries.map((q) => {
            const isPending = q.status === 'pending';
            const isApproved = q.status === 'approved';
            const isRejected = q.status === 'rejected';

            return (
              <div
                key={q.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 bg-white shadow-xs hover:shadow-md ${
                  isPending 
                    ? 'border-amber-300 ring-1 ring-amber-100' 
                    : isApproved 
                      ? 'border-emerald-200/80' 
                      : 'border-slate-200'
                }`}
              >
                
                {/* Top Row: Employee Details & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  
                  {/* Left: Employee Info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-navy to-brand-dark text-white font-extrabold flex items-center justify-center shrink-0 text-sm shadow-xs">
                      {q.employee_name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-sm sm:text-base text-slate-800">{q.employee_name}</h3>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {q.employee_id}
                        </span>
                        <span className="text-xs text-slate-500 hidden sm:inline">&bull; {q.department}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        <span>Disputed Date: <strong className="text-slate-700">{q.date}</strong></span>
                        <span>&bull;</span>
                        <span>Check-in: <strong className="text-brand-navy font-mono">{q.checkin_time || '09:00:00'}</strong></span>
                        {q.checkout_time && (
                          <>
                            <span>&bull;</span>
                            <span>Check-out: <strong className="text-brand-navy font-mono">{q.checkout_time}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Status Tag & Reason */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                      <span>Reason:</span>
                      <strong className="text-slate-800">{q.reason_category}</strong>
                    </span>

                    {isPending && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 animate-pulse">
                        <Clock size={12} /> Pending Review
                      </span>
                    )}
                    {isApproved && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Approved & Present
                      </span>
                    )}
                    {isRejected && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                        <X size={12} /> Rejected
                      </span>
                    )}
                  </div>

                </div>

                {/* Middle Row: Employee's Explanation */}
                <div className="my-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs sm:text-sm text-slate-700">
                  <span className="text-slate-400 font-bold block text-[11px] uppercase mb-1">
                    Employee Explanation:
                  </span>
                  <p className="italic leading-relaxed">
                    "{q.explanation}"
                  </p>
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-2">
                    <span>Submitted on: {q.created_at ? new Date(q.created_at).toLocaleString() : '-'}</span>
                    <span>&bull;</span>
                    <span>Query ID #{q.id}</span>
                  </div>
                </div>

                {/* Resolution Details for Resolved Queries */}
                {(isApproved || isRejected) && (
                  <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 mb-2 ${
                    isApproved ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-rose-50/70 border-rose-200 text-rose-900'
                  }`}>
                    {isApproved ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" /> : <X size={15} className="text-rose-600 shrink-0 mt-0.5" />}
                    <div className="space-y-0.5">
                      <span className="font-bold block">
                        {isApproved ? 'HR Approval Note:' : 'HR Rejection Reason:'}
                      </span>
                      <p>{q.hr_notes || 'No remarks recorded.'}</p>
                      <p className="text-[10px] text-slate-500">
                        Resolved by <strong>{q.resolved_by || 'HR Admin'}</strong> {q.resolved_at ? `on ${new Date(q.resolved_at).toLocaleString()}` : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* Bottom Row: Actions for Pending Queries */}
                {isPending && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <p className="text-xs text-amber-700 font-medium">
                      Confirming will immediately update the database and mark <strong>{q.employee_name}</strong> as Present.
                    </p>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => openApproveModal(q)}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs hover:shadow-sm"
                      >
                        <Check size={14} />
                        <span>Approve & Mark Present</span>
                      </button>

                      <button
                        onClick={() => openRejectModal(q)}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 hover:text-rose-700 font-bold text-xs transition flex items-center justify-center gap-1.5"
                      >
                        <X size={14} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  )}

      {/* ========================================================
          LEAVE APPLICATIONS MANAGEMENT (HR DESK)
         ======================================================== */}
      {mainTab === 'leaves' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* KPI METRICS FOR LEAVES */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Total Leaves */}
            <div 
              onClick={() => setLeaveStatusFilter('all')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                leaveStatusFilter === 'all' 
                  ? 'bg-slate-900 text-white border-slate-800 shadow-md ring-2 ring-indigo-400/40' 
                  : 'bg-white text-slate-800 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${leaveStatusFilter === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Total Requests
                </span>
                <div className={`p-2 rounded-xl ${leaveStatusFilter === 'all' ? 'bg-white/10 text-indigo-300' : 'bg-slate-100 text-slate-700'}`}>
                  <FileText size={16} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black">{leaves.length}</p>
              <span className={`text-[11px] mt-1 block ${leaveStatusFilter === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>
                All leave applications
              </span>
            </div>

            {/* Pending Approval */}
            <div 
              onClick={() => setLeaveStatusFilter('pending')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                leaveStatusFilter === 'pending' 
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400' 
                  : 'bg-amber-50/60 text-slate-800 border-amber-200/80 hover:bg-amber-100/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${leaveStatusFilter === 'pending' ? 'text-amber-950' : 'text-amber-800'}`}>
                  Pending Review
                </span>
                <div className={`p-2 rounded-xl ${leaveStatusFilter === 'pending' ? 'bg-white/20 text-slate-950' : 'bg-amber-200/60 text-amber-800'}`}>
                  <Clock size={16} />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-black">{leaves.filter(l => l.status === 'pending').length}</p>
                {leaves.filter(l => l.status === 'pending').length > 0 && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                    Action Needed
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 block font-medium ${leaveStatusFilter === 'pending' ? 'text-slate-900' : 'text-amber-700'}`}>
                Awaiting approval / rejection
              </span>
            </div>

            {/* Approved Leaves */}
            <div 
              onClick={() => setLeaveStatusFilter('approved')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                leaveStatusFilter === 'approved' 
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400' 
                  : 'bg-emerald-50/60 text-slate-800 border-emerald-200/80 hover:bg-emerald-100/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${leaveStatusFilter === 'approved' ? 'text-emerald-100' : 'text-emerald-800'}`}>
                  Approved Leaves
                </span>
                <div className={`p-2 rounded-xl ${leaveStatusFilter === 'approved' ? 'bg-white/10 text-white' : 'bg-emerald-200/60 text-emerald-800'}`}>
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black">{leaves.filter(l => l.status === 'approved').length}</p>
              <span className={`text-[11px] mt-1 block font-medium ${leaveStatusFilter === 'approved' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                Authorized time-off
              </span>
            </div>

            {/* Rejected Leaves */}
            <div 
              onClick={() => setLeaveStatusFilter('rejected')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                leaveStatusFilter === 'rejected' 
                  ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-400' 
                  : 'bg-rose-50/60 text-slate-800 border-rose-200/80 hover:bg-rose-100/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${leaveStatusFilter === 'rejected' ? 'text-rose-100' : 'text-rose-800'}`}>
                  Rejected Leaves
                </span>
                <div className={`p-2 rounded-xl ${leaveStatusFilter === 'rejected' ? 'bg-white/10 text-white' : 'bg-rose-200/60 text-rose-800'}`}>
                  <X size={16} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black">{leaves.filter(l => l.status === 'rejected').length}</p>
              <span className={`text-[11px] mt-1 block font-medium ${leaveStatusFilter === 'rejected' ? 'text-rose-100' : 'text-rose-700'}`}>
                Declined requests
              </span>
            </div>

          </div>

          {/* SEARCH & FILTER BAR FOR LEAVES */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={leaveSearch}
                onChange={(e) => setLeaveSearch(e.target.value)}
                placeholder="Search leaves by employee name, ID, department, or leave type..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchLeaves}
                disabled={leavesLoading}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition flex items-center gap-1.5"
              >
                <RefreshCw size={14} className={leavesLoading ? 'animate-spin' : ''} />
                <span>Refresh Leaves</span>
              </button>
            </div>
          </div>

          {/* LEAVES LIST */}
          {leavesLoading ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <RefreshCw className="animate-spin text-indigo-600 mx-auto mb-3" size={32} />
              <p className="text-sm font-bold text-slate-700">Loading leave applications...</p>
            </div>
          ) : leaves.filter(l => {
              if (leaveStatusFilter !== 'all' && l.status !== leaveStatusFilter) return false;
              if (leaveSearch.trim()) {
                const term = leaveSearch.toLowerCase();
                const matchName = l.employee_name?.toLowerCase().includes(term);
                const matchId = String(l.employee_id).toLowerCase().includes(term);
                const matchDept = l.department?.toLowerCase().includes(term);
                const matchType = l.leave_type?.toLowerCase().includes(term);
                if (!matchName && !matchId && !matchDept && !matchType) return false;
              }
              return true;
            }).length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Calendar size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-800">No leave requests found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No leave requests match the current filters. Employee leave applications will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaves.filter(l => {
                if (leaveStatusFilter !== 'all' && l.status !== leaveStatusFilter) return false;
                if (leaveSearch.trim()) {
                  const term = leaveSearch.toLowerCase();
                  const matchName = l.employee_name?.toLowerCase().includes(term);
                  const matchId = String(l.employee_id).toLowerCase().includes(term);
                  const matchDept = l.department?.toLowerCase().includes(term);
                  const matchType = l.leave_type?.toLowerCase().includes(term);
                  if (!matchName && !matchId && !matchDept && !matchType) return false;
                }
                return true;
              }).map((leave) => {
                const isPending = leave.status === 'pending';
                const isApproved = leave.status === 'approved';
                const isRejected = leave.status === 'rejected';

                return (
                  <div 
                    key={leave.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-500 text-white font-black flex items-center justify-center text-sm shadow-sm shrink-0">
                          {leave.employee_name ? leave.employee_name.charAt(0).toUpperCase() : 'E'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-sm">{leave.employee_name}</h4>
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                              #{leave.employee_id}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              &bull; {leave.department || 'Operations'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Applied: {leave.applied_at || '-'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {leave.leave_type} Leave
                        </span>

                        <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                          isPending 
                            ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                            : isApproved 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {isPending && <Clock size={12} className="animate-pulse" />}
                          {isApproved && <Check size={12} />}
                          {isRejected && <X size={12} />}
                          <span>{leave.status}</span>
                        </span>
                      </div>
                    </div>

                    {/* Dates & Duration Banner */}
                    <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Calendar size={14} className="text-indigo-600" />
                        <span>Duration:</span>
                        <span className="font-bold">{leave.start_date}</span>
                        <span>to</span>
                        <span className="font-bold">{leave.end_date}</span>
                      </div>
                      <div className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[11px]">
                        {leave.days_count} {leave.days_count === 1 ? 'day' : 'days'}
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                      <span className="text-slate-400 font-bold block text-[11px] uppercase mb-1">
                        Employee Reason:
                      </span>
                      <p className="italic leading-relaxed">
                        "{leave.reason}"
                      </p>
                    </div>

                    {/* HR Review Note if already resolved */}
                    {(isApproved || isRejected) && (
                      <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                        isApproved ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-rose-50/70 border-rose-200 text-rose-900'
                      }`}>
                        {isApproved ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" /> : <X size={15} className="text-rose-600 shrink-0 mt-0.5" />}
                        <div className="space-y-0.5">
                          <span className="font-bold block">
                            {isApproved ? 'HR Approval Note:' : 'HR Rejection Reason:'}
                          </span>
                          <p>{leave.review_notes || 'No notes provided.'}</p>
                          <p className="text-[10px] text-slate-500">
                            Reviewed by <strong>{leave.reviewed_by || 'HR Admin'}</strong> {leave.reviewed_at ? `on ${leave.reviewed_at}` : ''}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action buttons if Pending */}
                    {isPending && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setReviewingLeave({ leave, action: 'approve' });
                            setLeaveReviewNotes('Approved by HR.');
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                        >
                          <Check size={14} />
                          <span>Approve Leave</span>
                        </button>

                        <button
                          onClick={() => {
                            setReviewingLeave({ leave, action: 'reject' });
                            setLeaveReviewNotes('');
                          }}
                          className="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 hover:text-rose-700 font-bold text-xs transition flex items-center gap-1.5"
                        >
                          <X size={14} />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================
          APPROVE & MARK PRESENT MODAL
         ======================================================== */}
      {approvingQuery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Approve Attendance Query</h3>
                  <p className="text-xs text-slate-500">Regularize missed scan & mark employee present</p>
                </div>
              </div>
              <button 
                onClick={() => setApprovingQuery(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Employee Preview Strip */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 text-sm block">{approvingQuery.employee_name}</span>
                <span className="text-slate-500">ID: {approvingQuery.employee_id} &bull; {approvingQuery.department}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-800 block">Date: {approvingQuery.date}</span>
                <span className="text-amber-600 font-semibold">{approvingQuery.reason_category}</span>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Check-in Time</label>
                  <input
                    type="time"
                    step="1"
                    value={approvedCheckin}
                    onChange={(e) => setApprovedCheckin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Check-out Time (Optional)</label>
                  <input
                    type="time"
                    step="1"
                    value={approvedCheckout}
                    onChange={(e) => setApprovedCheckout(e.target.value)}
                    placeholder="18:00:00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-brand-teal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status to Record</label>
                <div className="flex gap-2">
                  {['present', 'late'].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setAttendanceStatus(st)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold capitalize transition border ${
                        attendanceStatus === st 
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">HR Approval Remarks / Note</label>
                <textarea
                  rows={2}
                  value={hrApproveNotes}
                  onChange={(e) => setHrApproveNotes(e.target.value)}
                  placeholder="e.g., Verified attendance with department manager."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-brand-teal"
                />
              </div>

            </div>

            {/* Modal Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApprovingQuery(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={isSubmittingApproval}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingApproval ? <RefreshCw className="animate-spin" size={15} /> : <Check size={15} />}
                <span>Confirm & Mark Attendance</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          REJECT QUERY MODAL
         ======================================================== */}
      {rejectingQuery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <X size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Reject Attendance Query</h3>
                  <p className="text-xs text-slate-500">Provide reason for rejection to employee</p>
                </div>
              </div>
              <button 
                onClick={() => setRejectingQuery(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Rejecting query from <strong>{rejectingQuery.employee_name}</strong> for date <strong>{rejectingQuery.date}</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Rejection <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={hrRejectNotes}
                onChange={(e) => setHrRejectNotes(e.target.value)}
                placeholder="e.g. CCTV showed employee was not present at the specified time, or insufficient verification provided."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRejectingQuery(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isSubmittingReject || !hrRejectNotes.trim()}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingReject ? <RefreshCw className="animate-spin" size={15} /> : <X size={15} />}
                <span>Confirm Rejection</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          REVIEW LEAVE REQUEST MODAL (APPROVE / REJECT)
         ======================================================== */}
      {reviewingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  reviewingLeave.action === 'approve' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {reviewingLeave.action === 'approve' ? <CheckCircle2 size={22} /> : <X size={22} />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    {reviewingLeave.action === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {reviewingLeave.action === 'approve' ? 'Authorize employee time off' : 'Decline employee time off'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setReviewingLeave(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400">Employee:</span>
                <span className="font-bold text-slate-900">{reviewingLeave.leave.employee_name} (#{reviewingLeave.leave.employee_id})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Leave Type:</span>
                <span className="font-bold text-indigo-700">{reviewingLeave.leave.leave_type} Leave</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dates:</span>
                <span className="font-bold">{reviewingLeave.leave.start_date} to {reviewingLeave.leave.end_date} ({reviewingLeave.leave.days_count} days)</span>
              </div>
              <div className="pt-1 border-t border-slate-200/60">
                <span className="text-slate-400 block text-[11px] mb-0.5">Reason:</span>
                <p className="italic text-slate-600">"{reviewingLeave.leave.reason}"</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                HR Review Notes {reviewingLeave.action === 'reject' && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                rows={3}
                value={leaveReviewNotes}
                onChange={(e) => setLeaveReviewNotes(e.target.value)}
                placeholder={reviewingLeave.action === 'approve' ? 'e.g. Approved as per leave balance.' : 'e.g. High workload during this sprint, please reschedule.'}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setReviewingLeave(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmLeaveReview}
                disabled={isSubmittingLeaveReview || (reviewingLeave.action === 'reject' && !leaveReviewNotes.trim())}
                className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                  reviewingLeave.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingLeaveReview ? <RefreshCw className="animate-spin" size={15} /> : (reviewingLeave.action === 'approve' ? <Check size={15} /> : <X size={15} />)}
                <span>{reviewingLeave.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

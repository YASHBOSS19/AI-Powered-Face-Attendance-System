import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Activity, Search, Download, RefreshCw, X, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Shield, 
  Clock, ArrowUpDown, CheckCircle2, AlertTriangle, Trash2, 
  Plus, Edit3, Eye, Copy, Check, Ban, Layers
} from 'lucide-react';
import { apiCall } from '../api';

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
    has_prev: false,
    has_next: false
  });

  // Filter states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [adminFilter, setAdminFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // Metadata from backend (available actions, admins, counts)
  const [meta, setMeta] = useState({
    available_actions: [],
    available_admins: [],
    total_all_time: 0,
    today_count: 0,
    action_breakdown: {}
  });

  // Modal inspection state
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch logs when filters or pagination change
  const fetchLogs = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      params.append('sort_order', sortOrder);

      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (actionFilter && actionFilter !== 'ALL') params.append('action', actionFilter);
      if (adminFilter && adminFilter !== 'ALL') params.append('admin_username', adminFilter);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const res = await apiCall(`/super-admin/audit-logs?${params.toString()}`);

      setLogs(res.logs || []);
      if (res.pagination) setPagination(res.pagination);
      if (res.meta) setMeta(res.meta);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setError(err.message || 'Unable to fetch audit logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, sortOrder, debouncedSearch, actionFilter, adminFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      debouncedSearch.trim() !== '' ||
      actionFilter !== 'ALL' ||
      adminFilter !== 'ALL' ||
      dateFrom !== '' ||
      dateTo !== '' ||
      sortOrder !== 'desc'
    );
  }, [debouncedSearch, actionFilter, adminFilter, dateFrom, dateTo, sortOrder]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setActionFilter('ALL');
    setAdminFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setSortOrder('desc');
    setPage(1);
  };

  // Date Presets
  const setDatePreset = (preset) => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === '7d') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setDateFrom(past.toISOString().slice(0, 10));
      setDateTo(todayStr);
    } else if (preset === '30d') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setDateFrom(past.toISOString().slice(0, 10));
      setDateTo(todayStr);
    } else if (preset === 'clear') {
      setDateFrom('');
      setDateTo('');
    }
    setPage(1);
  };

  // Export current filtered logs to CSV
  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.append('export', 'true');
      params.append('sort_order', sortOrder);

      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (actionFilter && actionFilter !== 'ALL') params.append('action', actionFilter);
      if (adminFilter && adminFilter !== 'ALL') params.append('admin_username', adminFilter);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const res = await apiCall(`/super-admin/audit-logs?${params.toString()}`);
      const exportLogs = res.logs || [];

      if (exportLogs.length === 0) {
        alert('No audit logs available to export with current filters.');
        return;
      }

      const rows = [
        ["Log ID", "Timestamp", "Admin Username", "Admin ID", "Action", "Resource", "Details"]
      ];

      exportLogs.forEach(l => {
        rows.push([
          l.id,
          l.timestamp || '',
          l.admin_username,
          l.admin_id,
          l.action,
          `"${(l.resource || '').replace(/"/g, '""')}"`,
          `"${(l.details || '').replace(/"/g, '""')}"`
        ]);
      });

      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Audit_Logs_Export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Helper for action badges styling & icon
  const getActionBadge = (action) => {
    switch (action) {
      case 'CREATE_USER':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          icon: <Plus size={11} className="mr-1" />
        };
      case 'UPDATE_USER':
        return {
          bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          dot: 'bg-cyan-500',
          icon: <Edit3 size={11} className="mr-1" />
        };
      case 'DELETE_USER':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500',
          icon: <Trash2 size={11} className="mr-1" />
        };
      case 'DISABLE_USER':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          icon: <Ban size={11} className="mr-1" />
        };
      case 'ENABLE_USER':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          icon: <CheckCircle2 size={11} className="mr-1" />
        };
      case 'IMPERSONATE':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          dot: 'bg-purple-500',
          icon: <Shield size={11} className="mr-1" />
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          icon: <Activity size={11} className="mr-1" />
        };
    }
  };

  // Page Numbers Array generation with Ellipsis
  const pageNumbers = useMemo(() => {
    const total = pagination.total_pages;
    const current = pagination.page;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  }, [pagination.total_pages, pagination.page]);

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-200">
      
      {/* ERROR BANNER */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchLogs(true)} className="font-bold underline text-xs">
            Retry
          </button>
        </div>
      )}

      {/* TOP HEADER & STATS STRIP */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-navy to-brand-dark text-white flex items-center justify-center shadow-md">
              <Activity size={22} className="text-brand-teal" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                System Audit Logs
                <span className="text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Compliance & Security
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 font-medium">
                Immutable chronological trail of administrative actions, credential updates, status alterations, and user impersonations.
              </p>
            </div>
          </div>
        </div>

        {/* Global Stats Counter & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-center flex-1 sm:flex-initial min-w-[100px]">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">All-Time</span>
            <span className="text-base sm:text-lg font-black text-gray-900">{meta.total_all_time}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-center flex-1 sm:flex-initial min-w-[100px]">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Today</span>
            <span className="text-base sm:text-lg font-black text-emerald-600">{meta.today_count}</span>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            title="Export Matching Logs to CSV"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-2.5 bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            title="Refresh Logs"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* QUICK ACTION FILTER CHIPS */}
      {meta.available_actions && meta.available_actions.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex-shrink-0 mr-1 flex items-center gap-1">
            <Layers size={12} />
            Filter By Action:
          </span>
          <button
            onClick={() => { setActionFilter('ALL'); setPage(1); }}
            className={`px-3 py-1 rounded-lg font-bold transition-all flex-shrink-0 ${
              actionFilter === 'ALL'
                ? 'bg-brand-navy text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-slate-50'
            }`}
          >
            All Actions ({meta.total_all_time})
          </button>
          {meta.available_actions.map(act => {
            const count = meta.action_breakdown?.[act] ?? 0;
            const isSelected = actionFilter === act;
            return (
              <button
                key={act}
                onClick={() => { setActionFilter(act); setPage(1); }}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex-shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-brand-teal text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-slate-50'
                }`}
              >
                <span>{act}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* COMPREHENSIVE FILTER TOOLBAR */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          
          {/* 1. Search Input (5 Cols) */}
          <div className="lg:col-span-5 relative">
            <Search size={15} className="absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search details, target resource, username, action..."
              className="w-full pl-9 pr-9 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 2. Admin Dropdown (2 Cols) */}
          <div className="lg:col-span-2">
            <select
              value={adminFilter}
              onChange={e => { setAdminFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 outline-none cursor-pointer"
            >
              <option value="ALL">All Operators</option>
              {meta.available_admins.map(adm => (
                <option key={adm} value={adm}>@{adm}</option>
              ))}
            </select>
          </div>

          {/* 3. Date From (2 Cols) */}
          <div className="lg:col-span-2 relative">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              title="Date From"
              className="w-full px-3 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 outline-none cursor-pointer"
            />
          </div>

          {/* 4. Date To (2 Cols) */}
          <div className="lg:col-span-2 relative">
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              title="Date To"
              className="w-full px-3 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-brand-teal/20 outline-none cursor-pointer"
            />
          </div>

          {/* 5. Sort Order & Quick Reset (1 Col) */}
          <div className="lg:col-span-1 flex items-center gap-1.5">
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className={`w-full py-2 flex items-center justify-center rounded-xl border text-xs font-bold transition-colors ${
                sortOrder === 'asc' 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
              title={`Sort order: ${sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}`}
            >
              <ArrowUpDown size={14} className="mr-1" />
              {sortOrder.toUpperCase()}
            </button>
          </div>

        </div>

        {/* Date presets & active filters bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="font-semibold text-[11px] text-slate-400 uppercase tracking-wider">Quick Dates:</span>
            <button 
              onClick={() => setDatePreset('today')}
              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors"
            >
              Today
            </button>
            <button 
              onClick={() => setDatePreset('7d')}
              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors"
            >
              Last 7 Days
            </button>
            <button 
              onClick={() => setDatePreset('30d')}
              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors"
            >
              Last 30 Days
            </button>
            {(dateFrom || dateTo) && (
              <button 
                onClick={() => setDatePreset('clear')}
                className="px-2 py-0.5 text-red-600 hover:bg-red-50 rounded-md text-[11px] font-semibold transition-colors"
              >
                Clear Dates
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-red-600 hover:text-red-700 font-bold text-xs flex items-center gap-1 hover:underline"
              >
                <X size={13} />
                Reset All Filters
              </button>
            )}
            <span className="text-slate-400 font-medium text-[11px]">
              Found <strong className="text-gray-900">{pagination.total}</strong> matching events
            </span>
          </div>
        </div>

      </div>

      {/* LOGS TABLE CONTAINER */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[460px]">
        
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[11px] uppercase tracking-wider border-b border-gray-100 font-bold">
                <th className="p-4 w-44">Timestamp</th>
                <th className="p-4 w-36">Operator</th>
                <th className="p-4 w-40">Action</th>
                <th className="p-4 w-36">Resource</th>
                <th className="p-4">Event Details</th>
                <th className="p-4 text-right w-24">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-16 text-center text-gray-400">
                    <RefreshCw className="animate-spin mx-auto mb-2 text-brand-teal" size={24} />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-16 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Activity size={24} />
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">No Audit Logs Match Your Query</h4>
                      <p className="text-xs text-gray-400">
                        {hasActiveFilters 
                          ? 'Try adjusting your search terms, date ranges, or action filters.'
                          : 'No audit records have been captured yet.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const badge = getActionBadge(log.action);
                  const parsedTime = log.timestamp ? new Date(log.timestamp) : null;

                  return (
                    <tr 
                      key={log.id} 
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-gray-400 flex-shrink-0" />
                          <div>
                            <span className="font-semibold text-gray-800 block text-xs">
                              {parsedTime ? parsedTime.toLocaleDateString() : 'N/A'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {parsedTime ? parsedTime.toLocaleTimeString() : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Admin */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-brand-navy/10 text-brand-navy flex items-center justify-center text-[10px] font-bold">
                            {log.admin_username?.charAt(0)?.toUpperCase() || 'A'}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block text-xs">@{log.admin_username}</span>
                            <span className="text-[10px] text-gray-400">ID #{log.admin_id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider border ${badge.bg}`}>
                          {badge.icon}
                          {log.action}
                        </span>
                      </td>

                      {/* Resource */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200/70">
                          {log.resource}
                        </span>
                      </td>

                      {/* Details */}
                      <td className="p-4 text-gray-700 font-medium">
                        <p className="line-clamp-2 text-xs leading-relaxed">
                          {log.details || <span className="text-gray-400 italic">No details recorded</span>}
                        </p>
                      </td>

                      {/* Action: Inspect */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand-teal hover:text-white text-slate-700 text-[11px] font-bold transition-all inline-flex items-center gap-1"
                        >
                          <Eye size={12} />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM PAGINATION CONTROLS BAR */}
        <div className="p-4 border-t border-gray-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          
          {/* Left: Summary and Page Size */}
          <div className="flex items-center gap-3 text-slate-500">
            <span>
              Showing <strong className="text-gray-900">{logs.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}</strong> to{' '}
              <strong className="text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of{' '}
              <strong className="text-gray-900">{pagination.total}</strong> entries
            </span>

            <span>•</span>

            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Right: Page Navigation Buttons */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="First Page"
            >
              <ChevronsLeft size={15} />
            </button>

            {/* Prev Page */}
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={15} />
            </button>

            {/* Numbered Page Buttons */}
            <div className="flex items-center gap-1 mx-1">
              {pageNumbers.map((p, idx) => {
                if (p === '...') {
                  return <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">...</span>;
                }
                const isCurrent = page === p;
                return (
                  <button
                    key={`page-${p}`}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-brand-teal text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => setPage(prev => Math.min(pagination.total_pages, prev + 1))}
              disabled={page >= pagination.total_pages}
              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Next Page"
            >
              <ChevronRight size={15} />
            </button>

            {/* Last Page */}
            <button
              onClick={() => setPage(pagination.total_pages)}
              disabled={page >= pagination.total_pages}
              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Last Page"
            >
              <ChevronsRight size={15} />
            </button>
          </div>

        </div>

      </div>

      {/* EVENT INSPECTION MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-8 flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-navy/10 text-brand-navy flex items-center justify-center font-bold">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    Audit Event Details
                    <span className="font-mono text-xs text-gray-400 font-normal">#{selectedLog.id}</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Recorded at {selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs">
              
              {/* Top Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Action Type</span>
                  <span className="text-xs font-bold text-gray-900 mt-0.5 block">{selectedLog.action}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Operator</span>
                  <span className="text-xs font-bold text-gray-900 mt-0.5 block">@{selectedLog.admin_username} (ID {selectedLog.admin_id})</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Target Resource</span>
                  <span className="text-xs font-mono font-bold text-brand-teal mt-0.5 block">{selectedLog.resource}</span>
                </div>
              </div>

              {/* Event Description */}
              <div className="space-y-1.5">
                <span className="font-bold text-gray-700 text-xs uppercase tracking-wide">Event Description</span>
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-gray-800 font-medium leading-relaxed">
                  {selectedLog.details || 'No event details payload recorded.'}
                </div>
              </div>

              {/* Raw JSON Payload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-700 text-xs uppercase tracking-wide">Structured Event JSON</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    className="text-[11px] font-bold text-brand-teal hover:text-brand-blue flex items-center gap-1"
                  >
                    {copiedId ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copiedId ? 'Copied!' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-gray-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

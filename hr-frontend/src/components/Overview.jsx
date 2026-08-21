import React, { useState, useEffect } from 'react';
import { apiCall, getWebSocketUrl } from '../api';
import { 
  Users, 
  UserCheck, 
  Clock, 
  AlertTriangle, 
  Radio, 
  Search, 
  Building, 
  ArrowUpRight, 
  CheckCircle2, 
  LogOut, 
  UserPlus, 
  FileText, 
  Camera,
  X,
  Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Overview() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, present, late, checkout
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchTodaySummary();

    let ws = null;
    let isSubscribed = true;

    try {
      ws = new WebSocket(getWebSocketUrl('/ws/attendance'));

      ws.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ATTENDANCE_MARKED' || msg.type === 'CHECKOUT_MARKED') {
            fetchTodaySummary();
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
        // Silently handle websocket connection errors during unmount or server reloads
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
  }, []);


  const fetchTodaySummary = async () => {
    try {
      const data = await apiCall('/attendance/today');
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Failed to fetch today summary', err);
    } finally {
      setLoading(false);
    }
  };

  const getCleanName = (rawName) => {
    if (!rawName) return 'Employee';
    return rawName.includes('_') ? rawName.split('_').slice(1).join(' ') : rawName;
  };

  const filteredRecords = (summary?.today_records || []).filter(rec => {
    const nameMatch = getCleanName(rec.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (rec.employee_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (rec.department || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!nameMatch) return false;
    if (statusFilter === 'present') return rec.status === 'present';
    if (statusFilter === 'late') return rec.status === 'late';
    if (statusFilter === 'checkout') return Boolean(rec.checkout);
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 animate-pulse">
        <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
          <Clock className="animate-spin" size={24} />
        </div>
        <p className="font-semibold">Loading HR Command Center...</p>
      </div>
    );
  }

  const attendanceRate = summary?.total_employees > 0 
    ? Math.round((summary.present_today / summary.total_employees) * 100) 
    : 0;

  return (
    <div className="space-y-8 mx-auto">
      
      {/* Header & Quick Action Launcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">HR Command Center</h2>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <Radio size={14} className="animate-pulse text-emerald-600" /> LIVE GATE SYNC
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">Real-time gate attendance monitoring, analytics & workforce status for today ({summary?.today_date}).</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link 
            to="/employees" 
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5"
          >
            <UserPlus size={16} /> Register Profile
          </Link>
          <Link 
            to="/reports" 
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5"
          >
            <FileText size={16} /> Reports
          </Link>
          <a 
            href="/gate" 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-4 py-2.5 bg-gradient-to-r from-brand-navy to-brand-teal text-white font-bold text-xs rounded-xl hover:shadow-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <Camera size={16} /> Launch Gate Terminal
          </a>
        </div>
      </div>

      {/* Live Toast Notification */}
      {toast && (
        <div className="p-4 bg-gradient-to-r from-slate-900 via-brand-navy to-brand-teal text-white rounded-2xl shadow-xl flex justify-between items-center animate-in slide-in-from-top duration-300 border border-white/10">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full animate-ping ${toast.title.includes('Alert') ? 'bg-red-400' : 'bg-emerald-400'}`}></div>
            <div>
              <span className={`font-bold text-xs uppercase tracking-wider block ${toast.title.includes('Alert') ? 'text-red-300' : 'text-teal-300'}`}>{toast.title}</span>
              <span className="font-medium text-sm">{toast.message}</span>
            </div>
          </div>
          <button onClick={() => setToast(null)} className="text-white/70 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>
      )}

      {/* 4 Core KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Employees */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Workforce</span>
            <div className="text-3xl font-black text-gray-900">{summary?.total_employees || 0}</div>
            <span className="text-xs text-gray-500 font-medium mt-1 block">Registered Active Profiles</span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
            <Users size={24} />
          </div>
        </div>

        {/* Card 2: Present Today */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Present Today</span>
            <div className="text-3xl font-black text-emerald-600">{summary?.present_today || 0}</div>
            <span className="text-xs text-emerald-700 font-bold mt-1 block">{attendanceRate}% Attendance Rate</span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
            <UserCheck size={24} />
          </div>
        </div>

        {/* Card 3: On-Time Arrivals */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">On-Time Arrivals</span>
            <div className="text-3xl font-black text-teal-600">{summary?.on_time_count || 0}</div>
            <span className="text-xs text-gray-500 font-medium mt-1 block">Checked in before 10:00 AM</span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shadow-inner">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Card 4: Late Arrivals */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Late Arrivals</span>
            <div className="text-3xl font-black text-amber-600">{summary?.late_count || 0}</div>
            <span className="text-xs text-amber-700 font-medium mt-1 block">Checked in after 10:00 AM</span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
            <AlertTriangle size={24} />
          </div>
        </div>

      </div>

      {/* Main Grid: Today's Live Attendance Table & Department Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2 Cols): Today's Attendance Activity Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Clock size={20} className="text-brand-teal" /> Today's Gate Attendance Logs
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Real-time records logged from the entrance kiosk</p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search name, ID or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition"
              />
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100 flex gap-2 overflow-x-auto text-xs font-semibold">
            <button 
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'all' ? 'bg-brand-navy text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200/60'}`}
            >
              All Today ({summary?.today_records?.length || 0})
            </button>
            <button 
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'present' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200/60'}`}
            >
              On-Time ({summary?.on_time_count || 0})
            </button>
            <button 
              onClick={() => setStatusFilter('late')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'late' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200/60'}`}
            >
              Late ({summary?.late_count || 0})
            </button>
            <button 
              onClick={() => setStatusFilter('checkout')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'checkout' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200/60'}`}
            >
              Checked Out ({summary?.today_records?.filter(r => r.checkout).length || 0})
            </button>
          </div>

          {/* Records Table */}
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-In</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-Out</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredRecords.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/40 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-brand-navy to-brand-teal text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          {getCleanName(row.name).charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-semibold text-gray-900">{getCleanName(row.name)}</div>
                          <div className="text-xs text-gray-400 font-mono">{row.employee_id || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium">
                      {row.department || row.domain}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-semibold text-gray-800">
                      {row.checkin || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-600">
                      {row.checkout ? (
                        <span className="font-semibold text-blue-600">{row.checkout}</span>
                      ) : (
                        <span className="text-gray-400 italic">In Office</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold uppercase rounded-full shadow-sm ${
                        row.status === 'present' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 text-sm">
                      No matching attendance records found for today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Right Column (1 Col): Department Breakdown Progress */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <Building size={20} className="text-blue-600" /> Department Breakdown
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Today's attendance percentage per group</p>
          </div>

          <div className="space-y-5 flex-1">
            {(summary?.department_summary || []).map((dept, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-800">{dept.department}</span>
                  <span className="text-brand-teal font-mono">{dept.present} / {dept.total} ({dept.rate}%)</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-brand-navy to-brand-teal rounded-full transition-all duration-500"
                    style={{ width: `${dept.rate}%` }}
                  ></div>
                </div>
              </div>
            ))}

            {(summary?.department_summary || []).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">No department data available.</p>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-gray-100 text-center">
            <Link 
              to="/reports" 
              className="text-xs font-bold text-brand-teal hover:underline flex items-center justify-center gap-1"
            >
              <span>View Comprehensive Reports</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

      </div>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall, getWebSocketUrl } from '../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  X, Radio, Edit, Trash2, RefreshCw, Download, 
  Search, Filter, ChevronLeft, ChevronRight, 
  ChevronUp, ChevronDown, Calendar, Users, 
  CheckCircle, Clock 
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateMode, setDateMode] = useState('range'); // 'single' or 'range'

  // Sort and pagination state
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Details Modal State
  const [selectedEmployeeName, setSelectedEmployeeName] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailDateFilter, setDetailDateFilter] = useState('');

  const [editingAttendance, setEditingAttendance] = useState(null);
  const [attForm, setAttForm] = useState({ checkin: '', checkout: '', status: 'present' });
  const [isUpdatingAtt, setIsUpdatingAtt] = useState(false);

  // Get summary stats for selected employee
  const selectedEmpData = reports.find(r => r.employee_id === selectedEmployeeId) || {};

  useEffect(() => {
    fetchReports();

    let ws = null;
    let isSubscribed = true;

    try {
      ws = new WebSocket(getWebSocketUrl('/ws/attendance'));

      ws.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ATTENDANCE_MARKED' || msg.type === 'CHECKOUT_MARKED') {
            fetchReports();
            const rawName = msg.name || 'Employee';
            const cleanName = rawName.includes('_') ? rawName.split('_').slice(1).join(' ') : rawName;
            const actionText = msg.type === 'CHECKOUT_MARKED' ? 'CHECKED OUT' : `CHECKED IN (${msg.status.toUpperCase()})`;
            setToast(`Live Gate Sync: ${cleanName} ${actionText}!`);
            setTimeout(() => setToast(null), 5000);
          }
        } catch (err) {
          console.error('WS Error:', err);
        }
      };

      ws.onerror = () => {};
    } catch (e) {
      console.warn('WS Init error:', e);
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
  }, [dateFrom, dateTo]); // Refetch if dates change


  const fetchReports = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.append('date_from', dateFrom);
      if (dateTo) query.append('date_to', dateTo);
      const data = await apiCall(`/attendance/report?${query.toString()}`);
      setReports(data.report || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, deptFilter, dateFrom, dateTo]);

  // Derived state: filtering & sorting
  const departments = [...new Set(reports.map(r => r.department || r.domain).filter(Boolean))];

  const filteredReports = reports.filter(r => {
    const matchesSearch = (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (r.employee_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if (deptFilter !== 'all' && (r.department || r.domain) !== deptFilter) return false;
    
    return true;
  }).sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') {
      cmp = (a.name || '').localeCompare(b.name || '');
    } else if (sortField === 'employee_id') {
      cmp = (a.employee_id || '').localeCompare(b.employee_id || '');
    } else if (sortField === 'department') {
      cmp = (a.department || a.domain || '').localeCompare(b.department || b.domain || '');
    } else if (sortField === 'days_present') {
      cmp = (a.days_present || 0) - (b.days_present || 0);
    } else if (sortField === 'days_late') {
      cmp = (a.days_late || 0) - (b.days_late || 0);
    } else if (sortField === 'days_absent') {
      cmp = (a.days_absent || 0) - (b.days_absent || 0);
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage));
  const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Summary Metrics
  const totalEmployees = filteredReports.length;
  const totalPresentDays = filteredReports.reduce((sum, r) => sum + (r.days_present || 0), 0);
  const totalLateDays = filteredReports.reduce((sum, r) => sum + (r.days_late || 0), 0);

  const viewDetails = async (employee_id, name) => {
    setSelectedEmployeeName(name);
    setSelectedEmployeeId(employee_id);
    setDetailDateFilter('');
    setDetailsLoading(true);
    try {
      const query = new URLSearchParams();
      if (employee_id) query.append('employee_id', employee_id);
      if (name) query.append('name', name);
      if (dateFrom) query.append('date_from', dateFrom);
      if (dateTo) query.append('date_to', dateTo);
      const data = await apiCall(`/attendance/detail?${query.toString()}`);
      setEmployeeDetails(data.records || []);
    } catch (err) {
      console.error(err);
      setEmployeeDetails([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedEmployeeName(null);
    setSelectedEmployeeId(null);
    setEmployeeDetails([]);
  };

  const handleDeleteAttendance = async (recordId) => {
    if (!window.confirm("Are you sure you want to delete this attendance record?")) return;
    try {
      await apiCall(`/attendance/${recordId}`, { method: 'DELETE' });
      viewDetails(selectedEmployeeId, selectedEmployeeName);
      fetchReports();
    } catch (err) {
      alert("Failed to delete record: " + err.message);
    }
  };

  const handleEditAttClick = (detail) => {
    setEditingAttendance(detail);
    setAttForm({ 
      checkin: detail.checkin || '', 
      checkout: detail.checkout || '', 
      status: detail.status || 'present' 
    });
  };

  const submitEditAttendance = async (e) => {
    e.preventDefault();
    setIsUpdatingAtt(true);
    try {
      await apiCall(`/attendance/${editingAttendance.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          checkin: attForm.checkin || null,
          checkout: attForm.checkout || null,
          status: attForm.status
        })
      });
      setEditingAttendance(null);
      viewDetails(selectedEmployeeId, selectedEmployeeName);
      fetchReports();
    } catch (err) {
      alert("Failed to update record: " + err.message);
    } finally {
      setIsUpdatingAtt(false);
    }
  };

  const downloadAllReportsExcel = () => {
    if (!filteredReports.length) return;
    const dataToExport = filteredReports.map(r => ({
      "Employee ID": r.employee_id || '',
      "Name": r.name || '',
      "Department": r.department || r.domain || '',
      "Days Present": r.days_present || 0,
      "Days Late": r.days_late || 0,
      "Days Absent": r.days_absent || 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");
    
    XLSX.writeFile(workbook, `attendance_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadEmployeeReportPDF = () => {
    if (!employeeDetails.length) return;
    
    const doc = new jsPDF();
    
    // Add Header
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text("Attendance Report", 14, 22);
    
    // Add Subheader
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(`Employee: ${selectedEmployeeName}`, 14, 32);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 38);
    
    const tableColumn = ["Date", "Check-in", "Check-out", "Status"];
    const tableRows = [];
    
    employeeDetails.forEach(d => {
      const rowData = [
        d.date || '-',
        d.checkin || '-',
        d.checkout || '-',
        d.status ? d.status.toUpperCase() : '-'
      ];
      tableRows.push(rowData);
    });
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.raw === 'PRESENT') {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'LATE') {
            data.cell.styles.textColor = [202, 138, 4];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'ABSENT') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    
    const cleanName = selectedEmployeeName.replace(/\s+/g, '_');
    doc.save(`${cleanName}_Attendance_Report.pdf`);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={14} className="opacity-20 group-hover:opacity-50 transition-opacity" />;
    return sortOrder === 'asc' ? <ChevronUp size={14} className="text-brand-teal" /> : <ChevronDown size={14} className="text-brand-teal" />;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (loading && reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="animate-spin text-brand-teal" size={32} />
        <p className="text-gray-500 font-medium">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div onClick={() => navigate('/')} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors shrink-0 text-gray-500 hover:text-brand-navy shadow-sm bg-white" title="Back to Dashboard">
            <ChevronLeft size={20} />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-navy whitespace-nowrap">Attendance Reports</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3.5 sm:px-4 py-2 rounded-xl border border-emerald-200 shadow-sm whitespace-nowrap shrink-0">
            <Radio size={14} className="animate-pulse shrink-0" /> <span>Live Gate Sync Active</span>
          </div>
          <button 
            onClick={downloadAllReportsExcel} 
            className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-brand-navy/5 text-brand-navy hover:bg-brand-navy/10 font-semibold text-sm rounded-xl border border-brand-navy/10 shadow-sm transition-all whitespace-nowrap shrink-0"
          >
            <Download size={16} className="shrink-0" /> <span>Export Excel</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-6 p-4 bg-gradient-to-r from-brand-navy to-brand-teal text-white rounded-xl shadow-lg flex justify-between items-center animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-semibold text-sm">{toast}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-white/70 hover:text-white">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Employees</p>
            <p className="text-2xl font-bold text-gray-800">{totalEmployees}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Days Present</p>
            <p className="text-2xl font-bold text-gray-800">{totalPresentDays}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Days Late</p>
            <p className="text-2xl font-bold text-gray-800">{totalLateDays}</p>
          </div>
        </div>
      </div>
      
      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col w-full min-w-0">
        
        {/* Filters */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col lg:flex-row gap-4 items-center justify-between bg-gray-50/30">
          
          <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-4">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all shadow-sm"
              />
            </div>
            
            {/* Department Dropdown */}
            <div className="relative w-full sm:w-48 group">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-brand-teal transition-colors" size={16} />
              <select 
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all shadow-sm cursor-pointer"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>
          </div>

          {/* Date Range / Specific Date */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
              <button 
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${dateMode === 'single' ? 'bg-white shadow-sm text-brand-teal ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => { setDateMode('single'); setDateTo(dateFrom); }}
              >Single Day</button>
              <button 
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${dateMode === 'range' ? 'bg-white shadow-sm text-brand-teal ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setDateMode('range')}
              >Date Range</button>
            </div>
            
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
              <Calendar size={16} className="text-gray-400" />
              {dateMode === 'single' ? (
                <input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setDateTo(e.target.value);
                  }} 
                  className="text-sm bg-transparent border-none outline-none text-gray-700 w-32"
                  title="Specific Date"
                />
              ) : (
                <>
                  <input 
                    type="date" 
                    value={dateFrom} 
                    onChange={(e) => setDateFrom(e.target.value)} 
                    className="text-sm bg-transparent border-none outline-none text-gray-700 w-32"
                    title="Start Date"
                  />
                  <span className="text-gray-300">-</span>
                  <input 
                    type="date" 
                    value={dateTo} 
                    onChange={(e) => setDateTo(e.target.value)} 
                    className="text-sm bg-transparent border-none outline-none text-gray-700 w-32"
                    title="End Date"
                  />
                </>
              )}
            </div>
            
            {(dateFrom || dateTo) && (
              <button 
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-xs text-brand-teal hover:text-brand-navy font-bold underline px-2"
              >
                Clear
              </button>
            )}
          </div>

        </div>

        {/* Data Table */}
        <div className="overflow-x-auto w-full min-h-[400px]">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th 
                  className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('employee_id')}
                >
                  <div className="flex items-center gap-2">Employee ID <SortIcon field="employee_id" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">Name <SortIcon field="name" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('department')}
                >
                  <div className="flex items-center gap-2">Department <SortIcon field="department" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('days_present')}
                >
                  <div className="flex items-center gap-2">Days Present <SortIcon field="days_present" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('days_late')}
                >
                  <div className="flex items-center gap-2">Days Late <SortIcon field="days_late" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('days_absent')}
                >
                  <div className="flex items-center gap-2">Days Absent <SortIcon field="days_absent" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {paginatedReports.map((row) => (
                <tr 
                  key={row.employee_id} 
                  className="hover:bg-brand-navy/5 transition-colors cursor-pointer"
                  onClick={() => viewDetails(row.employee_id, row.name)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium font-mono">
                    {row.employee_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-bold shadow-sm">
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-gray-900">{row.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                    {row.department || row.domain || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 inline-flex text-xs font-bold rounded-lg bg-green-50 text-green-700 border border-green-200 shadow-sm">
                      {row.days_present || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs font-bold rounded-lg border shadow-sm ${row.days_late > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {row.days_late || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs font-bold rounded-lg border shadow-sm ${row.days_absent > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {row.days_absent || 0}
                    </span>
                  </td>
                </tr>
              ))}
              
              {paginatedReports.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                        <Search size={24} />
                      </div>
                      <p className="text-lg font-medium text-gray-800">No records found</p>
                      <p className="text-sm text-gray-500">Try adjusting your filters or search query.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50">
            <span className="text-sm text-gray-500 font-medium">
              Showing <span className="font-bold text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-gray-900">{Math.min(currentPage * itemsPerPage, filteredReports.length)}</span> of <span className="font-bold text-gray-900">{filteredReports.length}</span> results
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm text-gray-600"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="px-4 text-sm font-semibold text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm text-gray-600"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Side Panel */}
      {selectedEmployeeName && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white shadow-2xl w-full max-w-2xl h-full flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-100 overflow-hidden">
            
            {/* Panel Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-gray-100 gap-4 bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-brand-navy rounded-2xl text-white flex items-center justify-center text-xl font-bold shadow-sm border border-brand-navy/10">
                  {selectedEmployeeName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{selectedEmployeeName}</h3>
                  <p className="text-sm font-medium text-gray-500 mt-1">ID: {selectedEmployeeId} • {selectedEmpData.department || selectedEmpData.domain || 'No Dept'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button onClick={downloadEmployeeReportPDF} className="flex items-center gap-2 px-4 py-2.5 bg-brand-teal text-white hover:bg-brand-teal/90 text-sm font-bold rounded-xl transition shadow-sm" title="Download PDF Report">
                  <Download size={16} /> PDF
                </button>
                <button 
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2.5 rounded-full transition-colors border border-transparent hover:border-gray-200"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
              
              {/* Employee Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Present</p>
                  <p className="text-2xl font-black text-green-600">{selectedEmpData.days_present || 0}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Late</p>
                  <p className="text-2xl font-black text-orange-500">{selectedEmpData.days_late || 0}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Absent</p>
                  <p className="text-2xl font-black text-red-500">{selectedEmpData.days_absent || 0}</p>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4 px-1">
                <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Detailed Log</h4>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <input 
                    type="date"
                    value={detailDateFilter}
                    onChange={e => setDetailDateFilter(e.target.value)}
                    className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand-teal shadow-sm cursor-pointer"
                    title="Filter details by date"
                  />
                  {detailDateFilter && (
                    <button onClick={() => setDetailDateFilter('')} className="text-xs text-brand-teal hover:underline font-bold">Clear</button>
                  )}
                </div>
              </div>

              {detailsLoading ? (
                <div className="flex flex-col justify-center items-center py-20 space-y-4">
                  <RefreshCw className="animate-spin text-brand-teal" size={32} />
                  <span className="font-medium text-gray-500">Fetching detailed records...</span>
                </div>
              ) : (
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Check-in</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Check-out</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {employeeDetails
                        .filter(d => !detailDateFilter || d.date === detailDateFilter)
                        .map((detail, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{detail.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{detail.checkin || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{detail.checkout || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs font-bold rounded-lg border shadow-sm ${
                              detail.status === 'present' ? 'bg-green-50 text-green-700 border-green-200' : 
                              detail.status === 'late' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {detail.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleEditAttClick(detail)} className="p-2 text-brand-teal hover:bg-brand-teal/10 rounded-lg transition-colors" title="Edit">
                                <Edit size={16} />
                              </button>
                              <button onClick={() => handleDeleteAttendance(detail.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {employeeDetails.filter(d => !detailDateFilter || d.date === detailDateFilter).length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                            <p className="font-medium text-lg text-gray-700 mb-1">No detailed records</p>
                            <p className="text-sm text-gray-500">There is no attendance data available for this employee.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {editingAttendance && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col animate-in zoom-in-95 border border-gray-100 overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">Edit Record</h3>
              <button onClick={() => setEditingAttendance(null)} className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 p-1.5 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitEditAttendance} className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Check-in Time</label>
                  <input type="time" step="1" value={attForm.checkin} onChange={e => setAttForm({...attForm, checkin: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Check-out Time</label>
                  <input type="time" step="1" value={attForm.checkout} onChange={e => setAttForm({...attForm, checkout: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Status</label>
                  <select value={attForm.status} onChange={e => setAttForm({...attForm, status: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all shadow-sm">
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingAttendance(null)} className="px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-100 font-bold rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={isUpdatingAtt} className="px-5 py-2.5 bg-brand-teal hover:bg-brand-teal/90 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm transition-colors">
                  {isUpdatingAtt && <RefreshCw className="animate-spin" size={16} />} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

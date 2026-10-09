import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiCall, getWebSocketUrl, getProfileImageUrl } from '../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  X, Radio, Edit, Trash2, RefreshCw, Download, 
  Search, Filter, ChevronLeft, ChevronRight, 
  ChevronUp, ChevronDown, Calendar, Users, 
  CheckCircle, Clock, UserPlus, Plus, Check,
  Sparkles, FileCheck, CheckCircle2, ShieldAlert,
  Info, AlertCircle, FileText, Printer, Building2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateGranularEmployeePDF } from '../utils/pdfGenerator';
import GranularReportModal from './GranularReportModal';

export default function Reports() {
  const navigate = useNavigate();
  const location = useLocation();
  const [reports, setReports] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [companyName, setCompanyName] = useState('IdentiFi HR');
  const [logoUrl, setLogoUrl] = useState('');
  const [downloadingEmpId, setDownloadingEmpId] = useState(null);
  const [reportModalEmp, setReportModalEmp] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const handledDeepLinkRef = useRef(null);
  
  // Manual Regularization State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    employee_id: '',
    date: new Date().toISOString().slice(0, 10),
    checkin: '09:00:00',
    checkout: '18:00:00',
    status: 'present',
    reason: 'Forgot to Scan',
    customReason: ''
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateMode, setDateMode] = useState('range'); // 'single' or 'range'
  const [activePreset, setActivePreset] = useState('all');

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

  // Helper to format Date objects to YYYY-MM-DD
  const formatDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to calculate shift duration
  const calculateDuration = (checkin, checkout) => {
    if (!checkin || !checkout) return '-';
    try {
      const [h1, m1] = checkin.split(':').map(Number);
      const [h2, m2] = checkout.split(':').map(Number);
      let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diffMinutes < 0) diffMinutes += 24 * 60; // In case checkout is past midnight
      const hrs = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return `${hrs}h ${mins}m`;
    } catch {
      return '-';
    }
  };

  // 1-Click Date Range Presets
  const applyPreset = (preset) => {
    const now = new Date();
    let from = '';
    let to = '';

    if (preset === 'today') {
      from = formatDateStr(now);
      to = formatDateStr(now);
      setDateMode('single');
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      from = formatDateStr(y);
      to = formatDateStr(y);
      setDateMode('single');
    } else if (preset === 'this_week') {
      const start = new Date(now);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      start.setDate(diff);
      from = formatDateStr(start);
      to = formatDateStr(now);
      setDateMode('range');
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      from = formatDateStr(start);
      to = formatDateStr(now);
      setDateMode('range');
    } else if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      from = formatDateStr(start);
      to = formatDateStr(end);
      setDateMode('range');
    } else if (preset === 'all') {
      from = '';
      to = '';
      setDateMode('range');
    }

    setDateFrom(from);
    setDateTo(to);
    setActivePreset(preset);
  };

  // Fetch Company Settings
  useEffect(() => {
    const loadCompanySettings = async () => {
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
    loadCompanySettings();
  }, []);

  // Fetch employees list for dropdown
  const fetchEmployeesList = async () => {
    try {
      const data = await apiCall('/employees');
      if (data && data.employees) {
        setEmployeesList(data.employees);
      }
    } catch (err) {
      console.error("Failed to load employees list for regularization:", err);
    }
  };

  useEffect(() => {
    fetchEmployeesList();
  }, []);

  // Parse Deep Link URL parameters on mount / location change
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const empParam = params.get('employee') || params.get('employee_id');
    const deptParam = params.get('dept') || params.get('department');
    const fromParam = params.get('date_from');
    const toParam = params.get('date_to');

    if (deptParam && deptParam !== 'all') {
      setDeptFilter(deptParam);
    }
    if (fromParam) {
      setDateFrom(fromParam);
      setActivePreset('custom');
    }
    if (toParam) {
      setDateTo(toParam);
      setActivePreset('custom');
    }

    if (empParam) {
      const decodedEmp = decodeURIComponent(empParam);
      setSearchQuery(decodedEmp);
    }
  }, [location.search]);

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
            const actionText = msg.type === 'CHECKOUT_MARKED' ? 'CHECKED OUT' : `CHECKED IN (${(msg.status || 'PRESENT').toUpperCase()})`;
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
  const totalAbsentDays = filteredReports.reduce((sum, r) => sum + (r.days_absent || 0), 0);

  // Get summary stats for selected employee
  const selectedEmpData = reports.find(r => 
    (selectedEmployeeId && r.employee_id === selectedEmployeeId) || 
    (selectedEmployeeName && r.name === selectedEmployeeName)
  ) || {};

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

  // Auto-open detailed view if employee parameter was passed via deep-link (e.g. from Alerts or Analytics)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const empParam = params.get('employee') || params.get('employee_id');

    if (empParam && reports.length > 0 && handledDeepLinkRef.current !== empParam) {
      handledDeepLinkRef.current = empParam;
      const cleanEmp = decodeURIComponent(empParam).toLowerCase();
      
      const match = reports.find(r => 
        (r.employee_id && r.employee_id.toLowerCase() === cleanEmp) ||
        (r.name && r.name.toLowerCase() === cleanEmp) ||
        (r.name && r.name.toLowerCase().includes(cleanEmp))
      );

      if (match) {
        viewDetails(match.employee_id, match.name);
      } else {
        viewDetails(empParam, empParam);
      }
    }
  }, [reports, location.search]);

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

  // Open manual modal prefilled
  const handleOpenManualModal = (empId = '', empName = '') => {
    let targetEmpId = empId;
    if (!targetEmpId && employeesList.length > 0) {
      targetEmpId = employeesList[0].employee_id;
    }
    setManualForm({
      employee_id: targetEmpId,
      date: dateFrom || new Date().toISOString().slice(0, 10),
      checkin: '09:00:00',
      checkout: '18:00:00',
      status: 'present',
      reason: 'Forgot to Scan',
      customReason: ''
    });
    setIsManualModalOpen(true);
  };

  // Submit manual regularization
  const submitManualAttendance = async (e) => {
    e.preventDefault();
    if (!manualForm.employee_id) {
      alert("Please select an employee.");
      return;
    }
    if (!manualForm.date) {
      alert("Please select an attendance date.");
      return;
    }

    setIsSubmittingManual(true);
    const finalReason = manualForm.reason === 'Other' && manualForm.customReason 
      ? manualForm.customReason 
      : (manualForm.customReason ? `${manualForm.reason} (${manualForm.customReason})` : manualForm.reason);

    try {
      const res = await apiCall('/attendance/manual', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: manualForm.employee_id,
          date: manualForm.date,
          checkin: manualForm.status === 'absent' ? null : (manualForm.checkin ? (manualForm.checkin.length === 5 ? `${manualForm.checkin}:00` : manualForm.checkin) : null),
          checkout: manualForm.status === 'absent' ? null : (manualForm.checkout ? (manualForm.checkout.length === 5 ? `${manualForm.checkout}:00` : manualForm.checkout) : null),
          status: manualForm.status,
          reason: finalReason
        })
      });

      setIsManualModalOpen(false);
      setToast(`Attendance regularized for ${res.record?.name || manualForm.employee_id}!`);
      setTimeout(() => setToast(null), 5000);
      
      // Refresh reports list & details drawer if open
      fetchReports();
      if (selectedEmployeeId && (selectedEmployeeId === manualForm.employee_id || selectedEmployeeName === manualForm.employee_id)) {
        viewDetails(selectedEmployeeId, selectedEmployeeName);
      }
    } catch (err) {
      alert("Failed to regularize attendance: " + err.message);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // Export to Excel
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

  const openReportModal = (employeeId, employeeName) => {
    let empObj = employeesList.find(e => 
      (employeeId && e.employee_id === employeeId) || 
      (employeeName && e.name === employeeName)
    );

    if (!empObj) {
      empObj = reports.find(r => 
        (employeeId && r.employee_id === employeeId) || 
        (employeeName && r.name === employeeName)
      ) || { employee_id: employeeId, name: employeeName };
    }

    setReportModalEmp(empObj);
    setIsReportModalOpen(true);
  };

  // 1. Advanced Granular Branded PDF for Single Employee Report
  const downloadSingleEmployeeReport = async (employeeId, employeeName) => {
    openReportModal(employeeId, employeeName);
  };

  const downloadEmployeeReportPDF = () => {
    if (selectedEmployeeId || selectedEmployeeName) {
      openReportModal(selectedEmployeeId, selectedEmployeeName);
    }
  };

  // 2. Branded PDF for Master Company Attendance Report
  const downloadAllReportsPDF = () => {
    if (!filteredReports.length) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Top Brand Navy Banner
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, pageWidth, 28, 'F');
    
    // Teal Accent Strip
    doc.setFillColor(13, 148, 136); // #0d9488
    doc.rect(0, 28, pageWidth, 2, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text((companyName || 'Enterprise Attendance').toUpperCase(), 14, 12);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text("ORGANIZATION ATTENDANCE SUMMARY & ROSTER REPORT", 14, 19);

    // Meta right
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    const nowStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    doc.text(`Generated: ${nowStr}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Period: ${dateFrom || 'All Time'} to ${dateTo || 'Current'}`, pageWidth - 14, 19, { align: 'right' });

    // Summary Scorecard Boxes
    const cardY = 35;
    const cardWidth = (pageWidth - 28 - 9) / 4;
    const cardHeight = 15;
    
    const cards = [
      { label: 'TOTAL EMPLOYEES', value: String(filteredReports.length), color: [15, 23, 42], bg: [241, 245, 249] },
      { label: 'TOTAL PRESENT', value: String(totalPresentDays), color: [22, 163, 74], bg: [240, 253, 244] },
      { label: 'TOTAL LATE', value: String(totalLateDays), color: [217, 119, 6], bg: [254, 243, 199] },
      { label: 'TOTAL ABSENT', value: String(totalAbsentDays), color: [225, 29, 72], bg: [255, 241, 242] },
    ];

    cards.forEach((c, i) => {
      const cx = 14 + i * (cardWidth + 3);
      doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cx, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(c.label, cx + cardWidth / 2, cardY + 5, { align: 'center' });

      doc.setFontSize(10.5);
      doc.setTextColor(c.color[0], c.color[1], c.color[2]);
      doc.text(c.value, cx + cardWidth / 2, cardY + 11.5, { align: 'center' });
    });

    // Table
    const tableColumn = ["Employee ID", "Employee Name", "Department", "Days Present", "Days Late", "Days Absent"];
    const tableRows = filteredReports.map(r => [
      r.employee_id || '-',
      r.name || '-',
      r.department || r.domain || 'General',
      String(r.days_present || 0),
      String(r.days_late || 0),
      String(r.days_absent || 0)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: cardY + cardHeight + 6,
      margin: { left: 14, right: 14, bottom: 18 },
      theme: 'grid',
      styles: { 
        fontSize: 8.5, 
        cellPadding: 3, 
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      headStyles: { 
        fillColor: [15, 23, 42], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: function (data) {
        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`Confidential • Generated by ${companyName} Biometric Attendance System`, 14, pageHeight - 7);
        doc.text(`Page ${data.pageNumber}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
      }
    });

    doc.save(`${companyName.replace(/\s+/g, '_')}_Master_Attendance_Report.pdf`);
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

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div 
            onClick={handleBack} 
            className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors shrink-0 text-gray-500 hover:text-brand-navy shadow-sm bg-white" 
            title="Back to Previous Page"
          >
            <ChevronLeft size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-brand-navy tracking-tight whitespace-nowrap">Attendance Reports</h2>
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                <Building2 size={12} /> {companyName}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">Audit scan history, export branded payroll sheets & regularize manual scans</p>
          </div>
        </div>
        
        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200 shadow-sm whitespace-nowrap shrink-0">
            <Radio size={14} className="animate-pulse shrink-0" /> <span>Live Gate Sync</span>
          </div>

          <button 
            onClick={() => handleOpenManualModal()}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-brand-teal to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all whitespace-nowrap shrink-0"
            title="Create manual check-in or regularize a missed scan"
          >
            <Plus size={16} className="shrink-0" /> <span>+ Regularize</span>
          </button>

          <button 
            onClick={downloadAllReportsPDF} 
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs sm:text-sm rounded-xl border border-rose-200 shadow-sm transition-all whitespace-nowrap shrink-0"
            title="Export Branded PDF Report"
          >
            <FileText size={15} className="shrink-0 text-rose-600" /> <span>PDF</span>
          </button>

          <button 
            onClick={downloadAllReportsExcel} 
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-navy/5 text-brand-navy hover:bg-brand-navy/10 font-bold text-xs sm:text-sm rounded-xl border border-brand-navy/10 shadow-sm transition-all whitespace-nowrap shrink-0"
            title="Export Excel Payroll Spreadsheet"
          >
            <Download size={15} className="shrink-0" /> <span>Excel</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Employees</p>
            <p className="text-2xl font-black text-gray-800">{totalEmployees}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Days Present</p>
            <p className="text-2xl font-black text-emerald-600">{totalPresentDays}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Days Late</p>
            <p className="text-2xl font-black text-amber-600">{totalLateDays}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <ShieldAlert size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Days Absent</p>
            <p className="text-2xl font-black text-rose-600">{totalAbsentDays}</p>
          </div>
        </div>
      </div>
      
      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col w-full min-w-0">
        
        {/* Quick Date Range Presets Toolbar */}
        <div className="px-4 sm:px-6 py-2.5 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-gray-400 mr-1 text-[11px] uppercase tracking-wider font-extrabold">
              <Sparkles size={13} className="text-amber-500" /> Presets:
            </span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'all', label: 'All Records' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                  activePreset === p.id 
                    ? 'bg-brand-navy text-white border-brand-navy shadow-xs' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {(dateFrom || dateTo) && (
            <button 
              onClick={() => applyPreset('all')}
              className="text-[11px] text-rose-600 hover:text-rose-800 font-bold hover:underline"
            >
              Clear Date Filter
            </button>
          )}
        </div>

        {/* Detailed Search & Manual Date Selectors */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col lg:flex-row gap-4 items-center justify-between bg-white">
          
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

          {/* Date Range / Specific Date Inputs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
              <button 
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${dateMode === 'single' ? 'bg-white shadow-sm text-brand-teal ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => { setDateMode('single'); setDateTo(dateFrom); setActivePreset('custom'); }}
              >Single Day</button>
              <button 
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${dateMode === 'range' ? 'bg-white shadow-sm text-brand-teal ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => { setDateMode('range'); setActivePreset('custom'); }}
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
                    setActivePreset('custom');
                  }} 
                  className="text-sm bg-transparent border-none outline-none text-gray-700 w-32"
                  title="Specific Date"
                />
              ) : (
                <>
                  <input 
                    type="date" 
                    value={dateFrom} 
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setActivePreset('custom');
                    }} 
                    className="text-sm bg-transparent border-none outline-none text-gray-700 w-32"
                    title="Start Date"
                  />
                  <span className="text-gray-300">-</span>
                  <input 
                    type="date" 
                    value={dateTo} 
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setActivePreset('custom');
                    }} 
                    className="text-sm bg-transparent border-none outline-none text-gray-700 w-32"
                    title="End Date"
                  />
                </>
              )}
            </div>
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
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {paginatedReports.map((row) => (
                <tr 
                  key={row.employee_id} 
                  className="hover:bg-brand-navy/5 transition-colors cursor-pointer group"
                  onClick={() => viewDetails(row.employee_id, row.name)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium font-mono">
                    {row.employee_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {row.profile_picture ? (
                        <img
                          src={getProfileImageUrl(row.profile_picture)}
                          alt={row.name}
                          className="h-10 w-10 rounded-full object-cover shadow-sm border border-gray-100 shrink-0"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`h-10 w-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-bold shadow-sm shrink-0 ${row.profile_picture ? 'hidden' : 'flex'}`}>
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-gray-900 group-hover:text-brand-teal transition-colors">{row.name}</div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openReportModal(row.employee_id, row.name);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 transition-all shadow-xs cursor-pointer active:scale-95"
                        title="Download Granular PDF Report (Single Day, Month, Custom Range, or All-Time)"
                      >
                        <FileText size={13} className="text-rose-600" />
                        <span>PDF Dossier</span>
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenManualModal(row.employee_id, row.name);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg border border-teal-200 transition-all opacity-80 group-hover:opacity-100 shadow-sm cursor-pointer active:scale-95"
                        title="Regularize attendance for this employee"
                      >
                        <Plus size={13} /> Regularize
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {paginatedReports.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                        <Search size={24} />
                      </div>
                      <p className="text-lg font-medium text-gray-800">No records found</p>
                      <p className="text-sm text-gray-500">Try adjusting your filters, quick preset, or search query.</p>
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
                {selectedEmpData.profile_picture ? (
                  <img
                    src={getProfileImageUrl(selectedEmpData.profile_picture)}
                    alt={selectedEmployeeName}
                    className="w-14 h-14 rounded-2xl object-cover shadow-sm border border-gray-100 shrink-0"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`w-14 h-14 bg-brand-navy rounded-2xl text-white flex items-center justify-center text-xl font-bold shadow-sm border border-brand-navy/10 shrink-0 ${selectedEmpData.profile_picture ? 'hidden' : 'flex'}`}>
                  {selectedEmployeeName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{selectedEmployeeName}</h3>
                  <p className="text-sm font-medium text-gray-500 mt-1">ID: {selectedEmployeeId} • {selectedEmpData.department || selectedEmpData.domain || 'No Dept'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                <button 
                  onClick={() => handleOpenManualModal(selectedEmployeeId, selectedEmployeeName)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 text-xs font-bold rounded-xl transition shadow-sm"
                  title="Add Missing Scan / Regularize"
                >
                  <Plus size={14} /> Add Record
                </button>
                <button onClick={downloadEmployeeReportPDF} className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold rounded-xl transition shadow-sm" title="Download Branded PDF Report">
                  <FileText size={14} className="text-rose-600" /> PDF Report
                </button>
                <button 
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full transition-colors border border-transparent hover:border-gray-200"
                >
                  <X size={18} />
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
                <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Attendance Log History</h4>
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
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Check-in</th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Check-out</th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {employeeDetails
                        .filter(d => !detailDateFilter || d.date === detailDateFilter)
                        .map((detail, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-gray-900">{detail.date}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600 font-medium font-mono">{detail.checkin || '-'}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600 font-medium font-mono">{detail.checkout || '-'}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500 font-semibold">
                            {calculateDuration(detail.checkin, detail.checkout)}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs font-bold rounded-lg border shadow-sm ${
                              detail.status === 'present' ? 'bg-green-50 text-green-700 border-green-200' : 
                              detail.status === 'late' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {(detail.status || 'present').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => handleEditAttClick(detail)} className="p-1.5 text-brand-teal hover:bg-brand-teal/10 rounded-lg transition-colors" title="Edit">
                                <Edit size={15} />
                              </button>
                              <button onClick={() => handleDeleteAttendance(detail.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {employeeDetails.filter(d => !detailDateFilter || d.date === detailDateFilter).length === 0 && (
                        <tr>
                          <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                            <p className="font-medium text-lg text-gray-700 mb-1">No attendance records found</p>
                            <p className="text-sm text-gray-500 mb-4">No scan data exists for this period.</p>
                            <button 
                              onClick={() => handleOpenManualModal(selectedEmployeeId, selectedEmployeeName)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-teal text-white text-xs font-bold rounded-xl shadow-sm hover:brightness-105"
                            >
                              <Plus size={14} /> Add Manual Record for {selectedEmployeeName}
                            </button>
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

      {/* Manual Regularization Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-in zoom-in-95 border border-gray-100 overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-teal-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center font-bold">
                  <FileCheck size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Manual Attendance Regularization</h3>
                  <p className="text-xs text-gray-500 font-medium">Record attendance for missed scan, field duty or travel</p>
                </div>
              </div>
              <button 
                onClick={() => setIsManualModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 p-2 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={submitManualAttendance} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Select Employee <span className="text-red-500">*</span>
                </label>
                <select
                  value={manualForm.employee_id}
                  onChange={(e) => setManualForm({ ...manualForm, employee_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all shadow-sm"
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {employeesList.map(emp => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.name} ({emp.employee_id}) — {emp.department || emp.domain || 'General'}
                    </option>
                  ))}
                  {/* If employee not in list (e.g. from table report rows) */}
                  {manualForm.employee_id && !employeesList.some(e => e.employee_id === manualForm.employee_id) && (
                    <option value={manualForm.employee_id}>
                      {selectedEmployeeName ? `${selectedEmployeeName} (${manualForm.employee_id})` : manualForm.employee_id}
                    </option>
                  )}
                </select>
              </div>

              {/* Date & Quick Buttons */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Date of Attendance <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setManualForm({ ...manualForm, date: new Date().toISOString().slice(0, 10) })}
                      className="text-[11px] font-bold text-brand-teal bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-md transition-colors"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        setManualForm({ ...manualForm, date: d.toISOString().slice(0, 10) });
                      }}
                      className="text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-md transition-colors"
                    >
                      Yesterday
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                  <input
                    type="date"
                    value={manualForm.date}
                    onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all shadow-sm"
                    required
                  />
                </div>
              </div>

              {/* Status Select Pills */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Attendance Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'present', label: 'Present', color: 'peer-checked:bg-emerald-500 peer-checked:text-white border-emerald-200 text-emerald-700 bg-emerald-50/50' },
                    { id: 'late', label: 'Late', color: 'peer-checked:bg-amber-500 peer-checked:text-white border-amber-200 text-amber-700 bg-amber-50/50' },
                    { id: 'absent', label: 'Absent', color: 'peer-checked:bg-rose-500 peer-checked:text-white border-rose-200 text-rose-700 bg-rose-50/50' }
                  ].map(st => (
                    <label key={st.id} className="relative cursor-pointer">
                      <input
                        type="radio"
                        name="manualStatus"
                        value={st.id}
                        checked={manualForm.status === st.id}
                        onChange={() => setManualForm({ ...manualForm, status: st.id })}
                        className="peer sr-only"
                      />
                      <div className={`text-center py-2 px-3 rounded-xl border text-xs font-bold transition-all ${st.color} shadow-sm peer-checked:shadow-md`}>
                        {st.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Checkin and Checkout Time */}
              {manualForm.status !== 'absent' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Check-in Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
                      <input
                        type="time"
                        step="1"
                        value={manualForm.checkin}
                        onChange={(e) => setManualForm({ ...manualForm, checkin: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Check-out Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
                      <input
                        type="time"
                        step="1"
                        value={manualForm.checkout}
                        onChange={(e) => setManualForm({ ...manualForm, checkout: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Reason Category Quick Chips */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Reason for Regularization <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Forgot to Scan',
                    'On-Duty / Client Visit',
                    'Device / Gate Camera Issue',
                    'Remote / WFH',
                    'Medical / Emergency',
                    'Other'
                  ].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setManualForm({ ...manualForm, reason: r })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        manualForm.reason === r 
                          ? 'bg-brand-navy text-white border-brand-navy shadow-sm' 
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                
                {/* Additional Note / Explanation */}
                <textarea
                  rows={2}
                  placeholder={manualForm.reason === 'Other' ? 'Specify custom regularization reason...' : 'Add optional note or approver reference...'}
                  value={manualForm.customReason}
                  onChange={(e) => setManualForm({ ...manualForm, customReason: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all shadow-sm placeholder:text-gray-400"
                />
              </div>

              {/* Audit Notice */}
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  <strong>Audit Compliance:</strong> Manual attendance entries are logged under your tenant account and broadcast live to synced dashboards. Existing records on this date will be updated.
                </p>
              </div>

              {/* Actions */}
              <div className="pt-2 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-100 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="px-5 py-2.5 bg-brand-teal hover:bg-brand-teal/90 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all hover:shadow active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingManual ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                  <span>Save Regularization</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Granular Report Exporter Modal */}
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
          initialDateFrom={dateFrom}
          initialDateTo={dateTo}
        />
      )}

    </div>
  );
}

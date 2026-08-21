import React, { useState, useEffect } from 'react';
import { apiCall, getWebSocketUrl } from '../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { X, Radio, Edit, Trash2, RefreshCw, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  // Details Modal State
  const [selectedEmployeeName, setSelectedEmployeeName] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [editingAttendance, setEditingAttendance] = useState(null);
  const [attForm, setAttForm] = useState({ checkin: '', checkout: '', status: 'present' });
  const [isUpdatingAtt, setIsUpdatingAtt] = useState(false);

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
  }, []);


  const fetchReports = async () => {
    try {
      const data = await apiCall('/attendance/report');
      setReports(data.report || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = async (employee_id, name) => {
    setSelectedEmployeeName(name);
    setSelectedEmployeeId(employee_id);
    setDetailsLoading(true);
    try {
      const query = new URLSearchParams();
      if (employee_id) query.append('employee_id', employee_id);
      if (name) query.append('name', name);
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
    if (!reports.length) return;
    const dataToExport = reports.map(r => ({
      "Employee ID": r.employee_id || '',
      "Name": r.name || '',
      "Department": r.department || r.domain || '',
      "Days Present": r.days_present || 0,
      "Days Late": r.days_late || 0,
      "Days Absent": r.days_absent || 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Global Attendance");
    
    XLSX.writeFile(workbook, `attendance_summary_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadEmployeeReportPDF = () => {
    if (!employeeDetails.length) return;
    
    const doc = new jsPDF();
    
    // Add Header
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text("Attendance Report", 14, 22);
    
    // Add Subheader / Employee Name
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`Employee: ${selectedEmployeeName}`, 14, 32);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 38);
    
    // Data Table
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
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [15, 23, 42], // Slate 900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // Slate 50
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.raw === 'PRESENT') {
            data.cell.styles.textColor = [22, 163, 74]; // Green 600
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'LATE') {
            data.cell.styles.textColor = [202, 138, 4]; // Yellow 600
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'ABSENT') {
            data.cell.styles.textColor = [220, 38, 38]; // Red 600
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    
    const cleanName = selectedEmployeeName.replace(/\\s+/g, '_');
    doc.save(`${cleanName}_Attendance_Report.pdf`);
  };

  if (loading) {
    return <div className="animate-pulse text-gray-500">Loading reports...</div>;
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Attendance Reports</h2>
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={downloadAllReportsExcel} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 font-semibold text-sm rounded-xl border border-gray-200 hover:bg-gray-50 shadow-sm transition">
            <Download size={16} /> Export Excel
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <Radio size={14} className="animate-pulse" /> Live Gate Sync Active
          </div>
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

      
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Days Present</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Days Late</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Days Absent</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.map((row) => (
              <tr 
                key={row.employee_id} 
                className="hover:bg-blue-50 transition-colors cursor-pointer"
                onClick={() => viewDetails(row.employee_id, row.name)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                      {row.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{row.name}</div>
                      <div className="text-sm text-gray-500">{row.employee_id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {row.department || row.domain}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {row.days_present}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${row.days_late > 0 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                    {row.days_late}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${row.days_absent > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                    {row.days_absent || 0}
                  </span>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  No attendance records found for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedEmployeeName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-gray-100 gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <h3 className="text-xl font-bold text-gray-800">Attendance Details: {selectedEmployeeName}</h3>
                <button onClick={downloadEmployeeReportPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-navy text-white hover:bg-brand-blue text-xs font-bold rounded-lg transition shadow-sm" title="Download PDF Report">
                  <Download size={14} /> Download PDF
                </button>
              </div>
              <button 
                onClick={closeModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors sm:static"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {detailsLoading ? (
                <div className="flex justify-center items-center py-12 text-blue-500">
                  <span className="animate-pulse font-medium">Fetching details...</span>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-in</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-out</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {employeeDetails.map((detail, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{detail.date}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{detail.checkin || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{detail.checkout || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${detail.status === 'present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {detail.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <button onClick={() => handleEditAttClick(detail)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full" title="Edit">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDeleteAttendance(detail.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-full ml-1" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {employeeDetails.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                            No detailed records found.
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

      {editingAttendance && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col animate-in zoom-in-95">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Edit Attendance</h3>
              <button onClick={() => setEditingAttendance(null)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitEditAttendance} className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Check-in Time</label>
                  <input type="time" step="1" value={attForm.checkin} onChange={e => setAttForm({...attForm, checkin: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Check-out Time</label>
                  <input type="time" step="1" value={attForm.checkout} onChange={e => setAttForm({...attForm, checkout: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                  <select value={attForm.status} onChange={e => setAttForm({...attForm, status: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none">
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingAttendance(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 font-semibold rounded-lg">Cancel</button>
                <button type="submit" disabled={isUpdatingAtt} className="px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5">
                  {isUpdatingAtt && <RefreshCw className="animate-spin" size={14} />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

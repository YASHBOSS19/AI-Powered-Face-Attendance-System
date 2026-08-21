import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, UserPlus, Clock, X, Trash2 } from 'lucide-react';
import { apiCall } from '../api';

export default function UnknownIdentity() {
  const context = useOutletContext();
  const unknownAlerts = context?.unknownAlerts || [];
  const setUnknownAlerts = context?.setUnknownAlerts || (() => {});
  const handleEnroll = context?.handleEnroll || (() => {});
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    apiCall('/employees').then(data => setEmployees(data.employees || [])).catch(console.error);
  }, []);

  return (
    <div className="space-y-8 mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Unknown Identity Alerts</h2>
            {unknownAlerts.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                <AlertTriangle size={14} className="animate-pulse" /> {unknownAlerts.length} PENDING
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">Review unrecognized faces captured by the gate kiosk and enroll them into the system.</p>
        </div>
        {unknownAlerts.length > 0 && (
          <button 
            onClick={() => setUnknownAlerts([])}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5"
          >
            <X size={16} /> Clear All Alerts
          </button>
        )}
      </div>

      {unknownAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm border-dashed">
          <AlertTriangle size={48} className="mb-4 text-gray-300" />
          <h3 className="text-xl font-bold text-gray-500 mb-1">No Unknown Identities</h3>
          <p className="text-sm">The system hasn't detected any unrecognized faces recently.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {unknownAlerts.map(alert => (
            <div key={alert.id} className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden flex flex-col relative group hover:shadow-md transition">
              <button 
                onClick={() => setUnknownAlerts(prev => prev.filter(a => a.id !== alert.id))}
                className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white rounded-full p-2 opacity-0 group-hover:opacity-100 hover:bg-black/70 z-10 transition duration-200"
                title="Dismiss"
              >
                <X size={16} />
              </button>
              <div className="h-64 bg-gray-100 relative border-b border-gray-100">
                <img src={alert.image} alt="Unknown Face" className="w-full h-full object-cover" />
                <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-t-2xl pointer-events-none"></div>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Employee Name or ID</label>
                  <input 
                    type="text" 
                    list={`employees-list-${alert.id}`}
                    placeholder="e.g. EMP01_John" 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-teal focus:bg-white focus:ring-2 focus:ring-brand-teal/20 transition"
                    value={alert.enrollName || ''}
                    onChange={(e) => setUnknownAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, enrollName: e.target.value } : a))}
                  />
                  <datalist id={`employees-list-${alert.id}`}>
                    {employees.map(emp => (
                      <option key={emp.employee_id} value={`${emp.employee_id}_${emp.name.replace(/\\s+/g, '_')}`}>
                        {emp.name} ({emp.employee_id})
                      </option>
                    ))}
                  </datalist>
                </div>
                <div className="flex gap-2">
                  <button 
                    disabled={!alert.enrollName || alert.enrolling}
                    onClick={() => handleEnroll(alert)}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2 transition"
                  >
                    {alert.enrolling ? <Clock size={18} className="animate-spin" /> : <UserPlus size={18} />}
                    {alert.enrolling ? 'Enrolling...' : 'Enroll'}
                  </button>
                  <button 
                    onClick={() => setUnknownAlerts(prev => prev.filter(a => a.id !== alert.id))}
                    className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition flex justify-center items-center shrink-0"
                    title="Delete Image"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Type, Image as ImageIcon, Clock, Save } from 'lucide-react';
import { apiCall } from '../api';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [companyName, setCompanyName] = useState('Vivekananda Global University');
  const [logoUrl, setLogoUrl] = useState('');
  const [workingDays, setWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [lateThresholdTime, setLateThresholdTime] = useState('10:00');
  
  const fileInputRef = useRef(null);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await apiCall('/settings/');
      if (data.companyName) setCompanyName(data.companyName);
      if (data.logoUrl) setLogoUrl(data.logoUrl);
      if (data.workingDays) setWorkingDays(data.workingDays);
      if (data.lateThresholdTime) setLateThresholdTime(data.lateThresholdTime);
    } catch (error) {
      console.error("Failed to load settings", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        companyName,
        logoUrl,
        workingDays,
        lateThresholdTime
      };
      await apiCall('/settings/', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: data }));
    } catch (error) {
      console.error("Failed to save settings", error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDayToggle = (day) => {
    setWorkingDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://127.0.0.1:8000/api/settings/logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (response.ok) {
        setLogoUrl(data.logoUrl);
      } else {
        alert(data.detail || 'Failed to upload logo');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Error uploading logo');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm">
        <div className="flex-1 overflow-auto p-6 sm:p-10">
          <div className="mb-8">
            <h1 className="text-xl font-bold text-gray-900">Application Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Customize the branding and appearance of your dashboard.</p>
          </div>

          <form onSubmit={handleSave} className="space-y-8 max-w-full">
          
          {/* Branding Section */}
          <div className="space-y-6">
            {/* Company Name */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <Type size={14} className="text-gray-400" />
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full sm:w-[400px] px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-sm transition text-gray-800"
                placeholder="Enter company name"
              />
            </div>

            {/* Company Logo */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <ImageIcon size={14} className="text-gray-400" />
                Company Logo
              </label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full border border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                  {logoUrl ? (
                    <img src={`http://127.0.0.1:8000${logoUrl}`} alt="Logo" className="h-full w-full object-contain p-1" />
                  ) : (
                    <span className="text-gray-400 text-xs">No Logo</span>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-1.5 border border-gray-200 text-gray-700 bg-white rounded-lg text-sm hover:bg-gray-50 transition font-medium shadow-sm"
                  >
                    Upload New Logo
                  </button>
                  <p className="text-[11px] text-gray-400 mt-1.5">Recommended: Square image, transparent background (PNG).</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100"></div>

          {/* Attendance Rules Section */}
          <div className="space-y-6 pt-2">
            <h3 className="flex items-center gap-2 text-md font-bold text-gray-800">
              <Clock size={16} className="text-[#14b8a6]" />
              Attendance Rules
            </h3>

            {/* Working Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Working Days</label>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {daysOfWeek.map(day => {
                  const isSelected = workingDays.includes(day);
                  return (
                    <label 
                      key={day} 
                      className={`flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer transition ${
                        isSelected ? 'border-blue-500 bg-white' : 'border-gray-200 bg-white text-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleDayToggle(day)}
                        className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span className={`text-sm font-medium ${isSelected ? 'text-gray-800' : 'text-gray-500'}`}>{day}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Days not selected will be considered weekends/holidays and won't be marked absent.</p>
            </div>

            {/* Late Threshold Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Late Threshold Time</label>
              <div className="relative w-full sm:w-[400px]">
                <input
                  type="time"
                  value={lateThresholdTime}
                  onChange={(e) => setLateThresholdTime(e.target.value)}
                  className="w-full pl-4 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-sm transition text-gray-800"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Employees checking in after this time will be marked as "Late".</p>
            </div>
          </div>
          
          <div className="border-t border-gray-100 mt-8 mb-6"></div>

          {/* Footer Actions */}
          <div className="pb-8">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-teal hover:bg-brand-blue text-white font-medium rounded-lg transition disabled:opacity-70 disabled:cursor-not-allowed text-sm shadow-sm"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </form>
      </div>
      </div>
    </div>
  );
}
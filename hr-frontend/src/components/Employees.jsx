import React, { useState, useEffect, useRef } from 'react';
import { apiCall } from '../api';
import { 
  Users, 
  UserPlus, 
  Camera, 
  Building, 
  Briefcase, 
  Hash, 
  User, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  FlipHorizontal,
  UploadCloud,
  FileText,
  Settings2,
  ArrowRight,
  Edit,
  Trash2,
  X,
  Download
} from 'lucide-react';


export default function Employees() {
  const [activeTab, setActiveTab] = useState('list'); // list, register, face
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Registration Form State
  const [regForm, setRegForm] = useState({ employee_id: '', name: '', domain: '', department: '', position: '' });
  const [regMsg, setRegMsg] = useState({ type: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerMethod, setRegisterMethod] = useState('manual');
  const [csvFile, setCsvFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvMapping, setCsvMapping] = useState({ employee_id: '', name: '', domain: '', department: '', position: '' });
  const [bulkMsg, setBulkMsg] = useState({ type: '', text: '' });
  const [isUploading, setIsUploading] = useState(false);
  
  const [sqlFile, setSqlFile] = useState(null);
  const [sqlMsg, setSqlMsg] = useState({ type: '', text: '' });

  // Face Link State
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [faceMsg, setFaceMsg] = useState({ type: '', text: '' });
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState([]); 
  const [isProcessingFace, setIsProcessingFace] = useState(false);
  const [isFlipped, setIsFlipped] = useState(true);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', domain: '', department: '', position: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm("Are you sure you want to delete this employee? This will also remove their face embeddings and attendance logs.")) return;
    try {
      await apiCall(`/employees/${employeeId}`, { method: 'DELETE' });
      fetchEmployees();
    } catch (err) {
      alert("Failed to delete employee: " + err.message);
    }
  };

  const handleEditClick = (emp) => {
    setEditingEmployee(emp);
    setEditForm({ name: emp.name, domain: emp.domain, department: emp.department, position: emp.position });
  };

  const submitEditEmployee = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await apiCall(`/employees/${editingEmployee.employee_id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err) {
      alert("Failed to update employee: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'list' || activeTab === 'face') {
      fetchEmployees();
    }
    return () => stopWebcam();
  }, [activeTab]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/employees');
      setEmployees(data.employees || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegMsg({ type: '', text: '' });
    setIsSubmitting(true);
    try {
      await apiCall('/employees/register', {
        method: 'POST',
        body: JSON.stringify(regForm)
      });
      setRegMsg({ type: 'success', text: 'Employee registered successfully!' });
      setRegForm({ employee_id: '', name: '', domain: '', department: '', position: '' });
      fetchEmployees();
    } catch (err) {
      setRegMsg({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setBulkMsg({ type: 'error', text: 'Please upload a valid CSV file.' });
      return;
    }
    setCsvFile(file);
    setBulkMsg({ type: '', text: '' });
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const firstLine = text.split('\n')[0];
      if (firstLine) {
        const headers = firstLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        setCsvHeaders(headers);
        const newMap = { employee_id: '', name: '', domain: '', department: '', position: '' };
        headers.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('id') || lower.includes('no')) newMap.employee_id = h;
          else if (lower.includes('name')) newMap.name = h;
          else if (lower.includes('domain') || lower.includes('group')) newMap.domain = h;
          else if (lower.includes('dept') || lower.includes('department')) newMap.department = h;
          else if (lower.includes('pos') || lower.includes('role')) newMap.position = h;
        });
        setCsvMapping(newMap);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (!csvMapping.employee_id || !csvMapping.name) {
      setBulkMsg({ type: 'error', text: 'Please map at least Employee ID and Full Name.' });
      return;
    }
    
    setIsUploading(true);
    setBulkMsg({ type: 'info', text: 'Uploading and processing CSV...' });
    
    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('mapping', JSON.stringify(csvMapping));

    try {
      const response = await apiCall('/employees/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      setBulkMsg({ type: 'success', text: response.message });
      setCsvFile(null);
      setCsvHeaders([]);
      fetchEmployees();
    } catch (err) {
      setBulkMsg({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSqlFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.sql') && !file.name.endsWith('.db')) {
      setSqlMsg({ type: 'error', text: 'Please upload a valid .sql or .db file.' });
      return;
    }
    setSqlFile(file);
    setSqlMsg({ type: '', text: '' });
  };

  const handleSqlUpload = async () => {
    if (!sqlFile) return;
    
    setIsUploading(true);
    setSqlMsg({ type: 'info', text: 'Uploading and parsing database dump...' });
    
    const formData = new FormData();
    formData.append('file', sqlFile);

    try {
      const response = await apiCall('/employees/sql-upload', {
        method: 'POST',
        body: formData
      });
      
      setSqlMsg({ type: 'success', text: response.message });
      setSqlFile(null);
      fetchEmployees();
    } catch (err) {
      setSqlMsg({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsCapturing(true);
      setFaceMsg({ type: '', text: '' });
    } catch (err) {
      setFaceMsg({ type: 'error', text: 'Error accessing webcam. Please check permissions.' });
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsCapturing(false);
    setCapturedImages([]);
  };

  const handleManualCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isFlipped) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setCapturedImages([...capturedImages, dataUrl]);
  };


  const removeImage = (index) => {
    const newImages = [...capturedImages];
    newImages.splice(index, 1);
    setCapturedImages(newImages);
  };

  const submitImages = async () => {
    if (!selectedEmployee) {
      setFaceMsg({ type: 'error', text: 'Please select an employee first' });
      return;
    }
    if (capturedImages.length === 0) {
      setFaceMsg({ type: 'error', text: 'Please capture at least one image' });
      return;
    }

    setFaceMsg({ type: 'info', text: 'Processing and training AI model...' });
    setIsProcessingFace(true);
    
    const base64Images = capturedImages.map(img => img.split(',')[1]);
    const emp = employees.find(e => e.employee_id === selectedEmployee);
    const embeddingName = `${emp.employee_id}_${emp.name.replace(/\s+/g, '')}`;

    try {
      await apiCall('/dataset/create', {
        method: 'POST',
        body: JSON.stringify({ name: embeddingName, images: base64Images })
      });

      await apiCall('/enroll', {
        method: 'POST',
        body: JSON.stringify({ name: embeddingName, images: base64Images })
      });

      await apiCall('/employees/link-face', {
        method: 'POST',
        body: JSON.stringify({ employee_id: selectedEmployee, embedding_name: embeddingName })
      });

      setFaceMsg({ type: 'success', text: 'Face successfully linked and trained!' });
      stopWebcam();
      fetchEmployees();
    } catch (err) {
      setFaceMsg({ type: 'error', text: err.message });
    } finally {
      setIsProcessingFace(false);
    }
  };

  const handleExportJson = () => {
    // We can just redirect to the endpoint to trigger the native browser download
    window.location.href = 'http://localhost:8000/api/employees/export-json';
  };

  return (
    <div className="mx-auto animate-in fade-in duration-500">
      
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-brand-navy">Employee Directory</h2>
          <p className="text-gray-500 mt-1">Manage personnel, roles, and biometric data.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={handleExportJson}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-navy/5 text-brand-navy hover:bg-brand-navy/10 rounded-xl font-medium text-sm transition-all border border-brand-navy/10 shadow-sm"
          >
            <Download size={16} />
            Export Data
          </button>
          
          <div className="flex p-1 bg-gray-100 rounded-xl shadow-inner border border-gray-200">
            <button 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
              activeTab === 'list' 
                ? 'bg-white shadow-sm text-brand-blue ring-1 ring-black/5' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
            onClick={() => { setActiveTab('list'); stopWebcam(); }}
          >
            <Users size={16} />
            Directory
          </button>
          <button 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
              activeTab === 'register' 
                ? 'bg-white shadow-sm text-brand-blue ring-1 ring-black/5' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
            onClick={() => { setActiveTab('register'); stopWebcam(); }}
          >
            <UserPlus size={16} />
            Add New
          </button>
          <button 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
              activeTab === 'face' 
                ? 'bg-white shadow-sm text-brand-blue ring-1 ring-black/5' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
            onClick={() => setActiveTab('face')}
          >
            <Camera size={16} />
            Face Data
          </button>
        </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[600px] overflow-hidden">
        
        {/* LIST TAB */}
        {activeTab === 'list' && (
          <div className="animate-in fade-in duration-300">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-brand-blue">
                <RefreshCw className="animate-spin mb-4" size={32} />
                <p className="font-medium text-gray-500">Loading directory...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest">Employee</th>
                      <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest">Department</th>
                      <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest">Biometric Status</th>
                      <th className="px-8 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employees.map((emp) => (
                      <tr key={emp.employee_id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-blue/20 to-brand-teal/20 flex items-center justify-center text-brand-navy font-bold text-lg shadow-sm border border-white group-hover:scale-105 transition-transform">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">{emp.name}</div>
                              <div className="text-xs text-gray-400 font-mono mt-0.5">{emp.employee_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="text-sm text-gray-700 font-medium">{emp.department || emp.domain}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{emp.position || 'Employee'}</div>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                          {emp.embedding_name ? (
                            <div className="flex items-center gap-1.5 text-brand-teal bg-brand-teal/10 px-3 py-1.5 rounded-full w-fit border border-brand-teal/20">
                              <CheckCircle2 size={16} />
                              <span className="text-xs font-bold uppercase tracking-wider">Face Linked</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full w-fit border border-orange-200">
                              <XCircle size={16} />
                              <span className="text-xs font-bold uppercase tracking-wider">Pending Link</span>
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap text-right">
                          <button onClick={() => handleEditClick(emp)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Edit Employee">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => handleDeleteEmployee(emp.employee_id)} className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors ml-2" title="Delete Employee">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-8 py-20 text-center">
                          <div className="flex flex-col items-center text-gray-400">
                            <Users size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium text-gray-500">No employees found.</p>
                            <p className="text-sm mt-1">Switch to the "Add New" tab to get started.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* REGISTER TAB */}
        {activeTab === 'register' && (
          <div className="p-8 md:p-12 animate-in fade-in duration-300 flex justify-center">
            <div className="w-full max-w-4xl">
              <div className="flex justify-center mb-8">
                <div className="flex p-1 bg-gray-100 rounded-xl shadow-inner border border-gray-200">
                  <button 
                    className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${registerMethod === 'manual' ? 'bg-white shadow-sm text-brand-blue ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900'}`}
                    onClick={() => setRegisterMethod('manual')}
                  >Manual Entry</button>
                  <button 
                    className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${registerMethod === 'csv' ? 'bg-white shadow-sm text-brand-blue ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900'}`}
                    onClick={() => setRegisterMethod('csv')}
                  ><UploadCloud size={16}/> CSV Import</button>
                  <button 
                    className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${registerMethod === 'sql' ? 'bg-white shadow-sm text-brand-blue ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900'}`}
                    onClick={() => setRegisterMethod('sql')}
                  ><FileText size={16}/> DB Import</button>
                </div>
              </div>

              {registerMethod === 'manual' ? (
                <div className="animate-in slide-in-from-bottom-2 duration-300 mx-auto">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-brand-navy/5 text-brand-navy rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3">
                      <UserPlus size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800">Onboard Employee</h3>
                    <p className="text-gray-500 mt-2">Enter the staff details to create a new profile.</p>
                  </div>

                  {regMsg.text && (
                    <div className={`p-4 rounded-xl mb-6 text-sm flex items-center gap-3 border ${
                      regMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {regMsg.type === 'error' ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
                      <span className="font-medium">{regMsg.text}</span>
                    </div>
                  )}
                  
                  <form onSubmit={handleRegister} className="space-y-5 bg-gray-50/50 p-8 rounded-2xl border border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Employee ID</label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input required type="text" className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="EMP-001" value={regForm.employee_id} onChange={(e) => setRegForm({...regForm, employee_id: e.target.value})} />
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input required type="text" className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="John Doe" value={regForm.name} onChange={(e) => setRegForm({...regForm, name: e.target.value})} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Domain / Group</label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input list="domain-list" required type="text" className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="e.g. Engineering, Sales" value={regForm.domain} onChange={(e) => setRegForm({...regForm, domain: e.target.value})} />
                        <datalist id="domain-list">
                          {[...new Set(employees.map(e => e.domain).filter(Boolean))].map(dom => (
                            <option key={dom} value={dom} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Department</label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input list="dept-list" type="text" className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="e.g. Frontend Team" value={regForm.department} onChange={(e) => setRegForm({...regForm, department: e.target.value})} />
                        <datalist id="dept-list">
                          {[...new Set(employees.map(e => e.department).filter(Boolean))].map(dept => (
                            <option key={dept} value={dept} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Position</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input list="pos-list" type="text" className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="e.g. Senior Developer" value={regForm.position} onChange={(e) => setRegForm({...regForm, position: e.target.value})} />
                        <datalist id="pos-list">
                          {[...new Set(employees.map(e => e.position).filter(Boolean))].map(pos => (
                            <option key={pos} value={pos} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-brand-navy to-brand-dark text-white font-bold py-3.5 rounded-xl hover:shadow-lg transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <UserPlus size={20} />}
                      {isSubmitting ? 'Registering...' : 'Create Employee Profile'}
                    </button>
                  </form>
                </div>
              ) : registerMethod === 'csv' ? (
                <div className="animate-in slide-in-from-bottom-2 duration-300 mx-auto bg-gray-50/50 p-8 rounded-2xl border border-gray-100">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-brand-teal/10 text-brand-teal rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileText size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800">Bulk Import CSV</h3>
                    <p className="text-gray-500 mt-2">Upload a CSV file and map your columns to our system.</p>
                  </div>

                  {bulkMsg.text && (
                    <div className={`p-4 rounded-xl mb-6 text-sm flex items-center gap-3 border ${
                      bulkMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 
                      bulkMsg.type === 'info' ? 'bg-blue-50 text-brand-blue border-blue-200' : 
                      'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {bulkMsg.type === 'error' ? <XCircle size={20} /> : 
                       bulkMsg.type === 'info' ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                      <span className="font-medium">{bulkMsg.text}</span>
                    </div>
                  )}

                  {!csvFile ? (
                    <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl p-12 text-center hover:bg-gray-50 hover:border-brand-blue transition-colors cursor-pointer relative">
                      <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <UploadCloud size={48} className="mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-700 font-medium text-lg">Click or drag CSV file to upload</p>
                      <p className="text-gray-400 text-sm mt-1">Only .csv files are supported</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                            <FileText size={24} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{csvFile.name}</p>
                            <p className="text-xs text-gray-500">{(csvFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button onClick={() => { setCsvFile(null); setCsvHeaders([]); }} className="text-sm text-red-500 hover:text-red-700 font-medium">
                          Remove File
                        </button>
                      </div>

                      <div className="mb-4">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-1">
                          <Settings2 size={18} className="text-brand-teal"/> Column Mapping
                        </h4>
                        <p className="text-sm text-gray-500 mb-4">Match your CSV headers to the system fields below.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {['employee_id', 'name', 'domain', 'department', 'position'].map(field => (
                            <div key={field} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                              <span className="text-sm font-semibold text-gray-700 capitalize w-1/3">
                                {field.replace('_', ' ')}
                                {['employee_id', 'name'].includes(field) && <span className="text-red-500 ml-1">*</span>}
                              </span>
                              <ArrowRight size={14} className="text-gray-400" />
                              <select 
                                className="w-1/2 p-2 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-brand-blue outline-none"
                                value={csvMapping[field]}
                                onChange={(e) => setCsvMapping({...csvMapping, [field]: e.target.value})}
                              >
                                <option value="">-- Ignore --</option>
                                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={handleBulkUpload}
                        disabled={isUploading}
                        className="w-full bg-brand-teal hover:bg-teal-600 text-white font-bold py-3.5 rounded-xl shadow-md shadow-brand-teal/20 transition-all mt-6 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isUploading ? <RefreshCw className="animate-spin" size={20} /> : <UploadCloud size={20} />}
                        {isUploading ? 'Uploading...' : 'Confirm & Import Data'}
                      </button>
                    </div>
                  )}
                </div>
              ) : registerMethod === 'sql' ? (
                <div className="animate-in slide-in-from-bottom-2 duration-300 mx-auto bg-gray-50/50 p-8 rounded-2xl border border-gray-100">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-brand-navy/10 text-brand-navy rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileText size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800">Database Dump Import</h3>
                    <p className="text-gray-500 mt-2">Upload a MySQL .sql or SQLite .db dump file to import employees securely.</p>
                  </div>

                  {sqlMsg.text && (
                    <div className={`p-4 rounded-xl mb-6 text-sm flex items-center gap-3 border ${
                      sqlMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 
                      sqlMsg.type === 'info' ? 'bg-blue-50 text-brand-blue border-blue-200' : 
                      'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {sqlMsg.type === 'error' ? <XCircle size={20} /> : 
                       sqlMsg.type === 'info' ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                      <span className="font-medium">{sqlMsg.text}</span>
                    </div>
                  )}

                  {!sqlFile ? (
                    <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl p-12 text-center hover:bg-gray-50 hover:border-brand-blue transition-colors cursor-pointer relative">
                      <input type="file" accept=".sql,.db" onChange={handleSqlFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <UploadCloud size={48} className="mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-700 font-medium text-lg">Click or drag a database file to upload</p>
                      <p className="text-gray-400 text-sm mt-1">Only .sql or .db files are supported</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                            <FileText size={24} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{sqlFile.name}</p>
                            <p className="text-xs text-gray-500">{(sqlFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button onClick={() => setSqlFile(null)} className="text-sm text-red-500 hover:text-red-700 font-medium">
                          Remove File
                        </button>
                      </div>

                      <div className="mb-4">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-1">
                          <Settings2 size={18} className="text-brand-navy"/> Secure Parsing Enabled
                        </h4>
                        <p className="text-sm text-gray-500">Our system will safely parse the dump file and extract only the <code className="bg-gray-100 px-1 py-0.5 rounded">employees</code> records, ignoring everything else to ensure your database stays secure.</p>
                      </div>

                      <button 
                        onClick={handleSqlUpload}
                        disabled={isUploading}
                        className="w-full bg-brand-navy hover:bg-blue-900 text-white font-bold py-3.5 rounded-xl shadow-md transition-all mt-6 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isUploading ? <RefreshCw className="animate-spin" size={20} /> : <UploadCloud size={20} />}
                        {isUploading ? 'Importing...' : 'Parse & Import Database'}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* FACE DATA TAB */}
        {activeTab === 'face' && (
          <div className="p-8 animate-in fade-in duration-300">
            <div className=" mx-auto flex flex-col lg:flex-row gap-10">
              
              {/* Left Column: Form & Actions */}
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Camera className="text-brand-teal" size={28} />
                    Biometric Enrollment
                  </h3>
                  <p className="text-gray-500 mt-2">Link facial recognition data to an existing employee profile.</p>
                </div>

                {faceMsg.text && (
                  <div className={`p-4 rounded-xl mb-6 text-sm flex items-start gap-3 border animate-in slide-in-from-top-2 ${
                    faceMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 
                    faceMsg.type === 'info' ? 'bg-blue-50 text-brand-blue border-blue-200' :
                    'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {faceMsg.type === 'error' ? <XCircle size={20} className="shrink-0 mt-0.5" /> : 
                     faceMsg.type === 'info' ? <RefreshCw size={20} className="shrink-0 mt-0.5 animate-spin" /> :
                     <CheckCircle2 size={20} className="shrink-0 mt-0.5" />}
                    <span className="font-medium leading-tight">{faceMsg.text}</span>
                  </div>
                )}

                <div className="space-y-2 mb-8">
                  <label className="text-sm font-semibold text-gray-700">Select Employee</label>
                  <select 
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all outline-none font-medium text-gray-700 shadow-sm"
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    disabled={isCapturing || isProcessingFace}
                  >
                    <option value="">-- Choose pending employee --</option>
                    {employees.filter(e => !e.embedding_name).map(emp => (
                      <option key={emp.employee_id} value={emp.employee_id}>{emp.name} ({emp.employee_id})</option>
                    ))}
                  </select>
                  {employees.filter(e => !e.embedding_name).length === 0 && (
                    <p className="text-xs text-brand-teal font-medium mt-2">All current employees have linked face data!</p>
                  )}
                </div>

                {/* Captured Thumbnails Grid */}
                <div className="flex-1">
                  <label className="text-sm font-semibold text-gray-700 flex justify-between">
                    <span>Captured Dataset</span>
                    <span className="text-brand-blue font-bold">{capturedImages.length} images</span>
                  </label>
                  
                  <div className="mt-3 bg-gray-50 border border-gray-100 rounded-xl p-4 min-h-[140px] flex gap-3 flex-wrap items-start content-start">
                    {capturedImages.length === 0 ? (
                      <p className="text-gray-400 text-sm w-full text-center py-8">No images captured yet.</p>
                    ) : (
                      capturedImages.map((imgUrl, index) => (
                        <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden shadow-sm border border-gray-200 group animate-in zoom-in-95 duration-200">
                          <img src={imgUrl} alt={`Snap ${index+1}`} className="w-full h-full object-cover" />
                          <button 
                            onClick={() => removeImage(index)}
                            className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                          >
                            <XCircle size={24} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Camera Viewfinder */}
              <div className="w-full lg:w-[480px] shrink-0 flex flex-col gap-4">
                <div className="w-full aspect-video md:aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden relative shadow-inner border-8 border-gray-100/50">
                  {!isCapturing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 to-gray-900 z-10">
                      <Camera size={48} className="mb-3 opacity-30" />
                      <p className="font-medium tracking-wide">CAMERA INACTIVE</p>
                    </div>
                  )}
                  
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ transform: isFlipped ? 'scaleX(-1)' : 'none' }}
                    className={`w-full h-full object-cover ${isCapturing ? 'block' : 'hidden'}`} 
                  />
                  
                  {/* Viewfinder overlay */}
                  {isCapturing && (
                    <div className="absolute inset-0 pointer-events-none border-2 border-brand-teal/30 m-8 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-brand-teal -translate-x-0.5 -translate-y-0.5"></div>
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-brand-teal translate-x-0.5 -translate-y-0.5"></div>
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-brand-teal -translate-x-0.5 translate-y-0.5"></div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-brand-teal translate-x-0.5 translate-y-0.5"></div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  {!isCapturing ? (
                    <button 
                      onClick={startWebcam}
                      disabled={!selectedEmployee}
                      className="col-span-2 bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-all active:scale-[0.98] shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Camera size={20} /> Start Viewfinder
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={stopWebcam}
                        className="bg-gray-200 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-300 transition-all active:scale-[0.98]"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => setIsFlipped(!isFlipped)}
                        title="Toggle Mirror View"
                        className="bg-gray-100 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-1"
                      >
                        <FlipHorizontal size={18} /> Mirror
                      </button>
                      <button 
                        onClick={handleManualCapture}
                        className="col-span-2 bg-brand-blue text-white font-bold py-4 rounded-xl hover:bg-blue-600 transition-all active:scale-[0.98] shadow-md shadow-brand-blue/30"
                      >
                        Capture Photo
                      </button>
                      <button 
                        onClick={submitImages}
                        disabled={capturedImages.length === 0 || isProcessingFace}
                        className="col-span-2 bg-gradient-to-r from-brand-teal to-emerald-600 text-white font-bold py-4 rounded-xl hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      >
                        {isProcessingFace ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                        {isProcessingFace ? 'Training Model...' : 'Save & Compile Dataset'}
                      </button>
                    </>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">Edit Employee</h3>
              <button onClick={() => setEditingEmployee(null)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitEditEmployee} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                  <input type="text" required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Domain</label>
                  <input type="text" required value={editForm.domain} onChange={e => setEditForm({...editForm, domain: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Department</label>
                  <input type="text" value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Position</label>
                  <input type="text" value={editForm.position} onChange={e => setEditForm({...editForm, position: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all" />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingEmployee(null)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 font-semibold rounded-xl transition">Cancel</button>
                <button type="submit" disabled={isUpdating} className="px-5 py-2.5 bg-brand-blue hover:bg-blue-600 text-white font-semibold rounded-xl transition flex items-center gap-2">
                  {isUpdating ? <RefreshCw className="animate-spin" size={18} /> : null} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

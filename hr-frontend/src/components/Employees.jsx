import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
    Download,
    Search,
    Filter,
    Copy,
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Check,
    Mail,
    Phone,
    Plus
} from 'lucide-react';


export default function Employees() {
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const activeTab = searchParams.get('tab') || 'list';
    const setActiveTab = (tab) => navigate(`?tab=${tab}`);

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [viewingEmployee, setViewingEmployee] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('all');

    const [sortField, setSortField] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [copiedId, setCopiedId] = useState(null);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, deptFilter]);

    const handleCopyId = (id) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    // Registration Form State
    const initialRegForm = { employee_id: '', name: '', domain: '', department: '', position: '', email: '', phone: '' };
    const [regForm, setRegForm] = useState(initialRegForm);
    const [basicCustomFields, setBasicCustomFields] = useState([]);
    const [orgCustomFields, setOrgCustomFields] = useState([]);
    const [showSuccess, setShowSuccess] = useState(false);
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

    const [editForm, setEditForm] = useState({ name: '', domain: '', department: '', position: '', email: '', phone: '' });
    const [editBasicCustomFields, setEditBasicCustomFields] = useState([]);
    const [editOrgCustomFields, setEditOrgCustomFields] = useState([]);
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
        setEditForm({ name: emp.name, domain: emp.domain, department: emp.department, position: emp.position, email: emp.email || '', phone: emp.phone || '' });

        const custom = emp.custom_fields || {};

        // Flatten nested objects (like {"BASIC": {"Blood Group": "O+"}}) so they can be edited as flat fields
        const flattenCustomFields = (ob) => {
            let result = {};
            for (const i in ob) {
                if (typeof ob[i] === 'object' && ob[i] !== null) {
                    const temp = flattenCustomFields(ob[i]);
                    for (const j in temp) {
                        // Keep the inner key and discard the arbitrary grouping (e.g. 'BASIC')
                        result[j] = temp[j];
                    }
                } else {
                    result[i] = ob[i];
                }
            }
            return result;
        };

        const flatCustom = flattenCustomFields(custom);
        const existingFields = Object.entries(flatCustom).map(([k, v]) => ({ key: k, value: String(v) }));
        setEditBasicCustomFields(existingFields);
        setEditOrgCustomFields([]);

        setActiveTab('edit');
    };

    const submitEditEmployee = async (e) => {
        e.preventDefault();
        setIsUpdating(true);

        const customFieldsDict = {};
        [...editBasicCustomFields, ...editOrgCustomFields].forEach(f => {
            if (f.key.trim() && f.value.trim()) {
                customFieldsDict[f.key.trim()] = f.value.trim();
            }
        });

        const payload = {
            ...editForm,
            custom_fields: Object.keys(customFieldsDict).length > 0 ? customFieldsDict : null
        };

        try {
            await apiCall(`/employees/${editingEmployee.employee_id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            setEditingEmployee(null);
            setActiveTab('list');
            fetchEmployees();
        } catch (err) {
            alert("Failed to update employee: " + err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    useEffect(() => {
        const initTab = async () => {
            if (activeTab === 'list' || activeTab === 'face') {
                fetchEmployees();
            } else if (activeTab === 'edit' && !editingEmployee) {
                setActiveTab('list');
            } else if (activeTab === 'register') {
                let currentEmps = employees;
                if (currentEmps.length === 0) {
                    setLoading(true);
                    try {
                        const data = await apiCall('/employees');
                        currentEmps = data.employees || [];
                        setEmployees(currentEmps);
                    } catch (err) { console.error(err); }
                    setLoading(false);
                }

                let maxId = 0;
                currentEmps.forEach(emp => {
                    if (emp.employee_id && emp.employee_id.startsWith('EMP_')) {
                        const numPart = parseInt(emp.employee_id.replace('EMP_', ''), 10);
                        if (!isNaN(numPart) && numPart > maxId) {
                            maxId = numPart;
                        }
                    }
                });
                const nextIdStr = `EMP_${String(maxId + 1).padStart(3, '0')}`;
                setRegForm(prev => ({ ...prev, employee_id: nextIdStr }));
            }
        };
        initTab();
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

        const customFieldsDict = {};
        [...basicCustomFields, ...orgCustomFields].forEach(f => {
            if (f.key.trim() && f.value.trim()) {
                customFieldsDict[f.key.trim()] = f.value.trim();
            }
        });

        const payload = {
            ...regForm,
            custom_fields: Object.keys(customFieldsDict).length > 0 ? customFieldsDict : null
        };

        try {
            await apiCall('/employees/register', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            setRegMsg({ type: 'success', text: 'Employee registered successfully!' });
            setShowSuccess(true);
            fetchEmployees();
        } catch (err) {
            setRegMsg({ type: 'error', text: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setRegForm(initialRegForm);
        setBasicCustomFields([]);
        setOrgCustomFields([]);
        setShowSuccess(false);
        setRegMsg({ type: '', text: '' });
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

    const departments = [...new Set(employees.map(e => e.department || e.domain).filter(Boolean))];

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (emp.employee_id || '').toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        if (statusFilter === 'linked' && !emp.embedding_name) return false;
        if (statusFilter === 'pending' && emp.embedding_name) return false;

        if (deptFilter !== 'all' && (emp.department || emp.domain) !== deptFilter) return false;

        return true;
    }).sort((a, b) => {
        let cmp = 0;
        if (sortField === 'name') {
            cmp = (a.name || '').localeCompare(b.name || '');
        } else if (sortField === 'department') {
            cmp = (a.department || a.domain || '').localeCompare(b.department || b.domain || '');
        } else if (sortField === 'status') {
            const valA = a.embedding_name ? 'linked' : 'pending';
            const valB = b.embedding_name ? 'linked' : 'pending';
            cmp = valA.localeCompare(valB);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
    });

    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / itemsPerPage));
    const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <ChevronDown size={14} className="opacity-20 group-hover:opacity-50 transition-opacity" />;
        return sortOrder === 'asc' ? <ChevronUp size={14} className="text-brand-teal" /> : <ChevronDown size={14} className="text-brand-teal" />;
    };

    return (
        <div className="mx-auto animate-in fade-in duration-500">

            {/* Header & Navigation */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <div onClick={() => navigate('/')} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors shrink-0 text-gray-500 hover:text-brand-navy shadow-sm bg-white" title="Back to Dashboard">
                        <ChevronLeft size={20} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-brand-navy">
                            {activeTab === 'list' ? 'Employee Directory' :
                                activeTab === 'register' ? 'Add New Employee' :
                                    activeTab === 'view' ? 'Employee Profile' :
                                        activeTab === 'edit' ? 'Edit Profile' :
                                            'Face Data Registration'}
                        </h2>
                        <p className="text-gray-500 mt-1">
                            {activeTab === 'list' ? 'Manage personnel, roles, and biometric data.' :
                                activeTab === 'register' ? 'Register a new employee profile.' :
                                    activeTab === 'view' ? 'Detailed view of employee information.' :
                                        activeTab === 'edit' ? 'Modify employee organizational details.' :
                                            'Manage face biometric data for employees.'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {activeTab === 'list' && (
                        <button
                            onClick={handleExportJson}
                            className="flex items-center gap-2 px-4 py-2.5 bg-brand-navy/5 text-brand-navy hover:bg-brand-navy/10 rounded-xl font-medium text-sm transition-all border border-brand-navy/10 shadow-sm"
                        >
                            <Download size={16} />
                            Export Data
                        </button>
                    )}
                    {activeTab === 'register' && (
                        <div className="flex p-1 bg-gray-100 rounded-xl shadow-inner border border-gray-200">
                            <button
                                className={`px-4 sm:px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${registerMethod === 'manual' ? 'bg-white shadow-sm text-brand-blue ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900'}`}
                                onClick={() => setRegisterMethod('manual')}
                            >Manual Entry</button>
                            <button
                                className={`px-4 sm:px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${registerMethod === 'csv' ? 'bg-white shadow-sm text-brand-blue ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900'}`}
                                onClick={() => setRegisterMethod('csv')}
                            ><UploadCloud size={16} /> CSV Import</button>
                            <button
                                className={`px-4 sm:px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${registerMethod === 'sql' ? 'bg-white shadow-sm text-brand-blue ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900'}`}
                                onClick={() => setRegisterMethod('sql')}
                            ><FileText size={16} /> DB Import</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[600px] overflow-hidden">

                {/* LIST TAB */}
                {activeTab === 'list' && (
                    <div className="animate-in fade-in duration-300 flex flex-col h-full">

                        {/* Filter Bar */}
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col lg:flex-row gap-4 items-center justify-between bg-gray-50/30">
                            <div className="relative w-full lg:w-96">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search name or ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none text-sm shadow-sm"
                                />
                            </div>

                            <div className="flex w-full lg:w-auto items-center gap-3 overflow-x-auto">
                                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm shadow-sm">
                                    <Filter size={16} className="text-gray-400" />
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="bg-transparent outline-none text-gray-700 font-medium min-w-[120px]"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="linked">Face Linked</option>
                                        <option value="pending">Pending Link</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm shadow-sm">
                                    <Building size={16} className="text-gray-400" />
                                    <select
                                        value={deptFilter}
                                        onChange={(e) => setDeptFilter(e.target.value)}
                                        className="bg-transparent outline-none text-gray-700 font-medium min-w-[140px]"
                                    >
                                        <option value="all">All Departments</option>
                                        {departments.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-[500px] text-brand-blue">
                                <RefreshCw className="animate-spin mb-4" size={32} />
                                <p className="font-medium text-gray-500">Loading directory...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col flex-1 w-full min-w-0">
                                <div className="overflow-x-auto w-full flex-1">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <thead className="bg-gray-50/50">
                                            <tr>
                                                <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer group hover:bg-gray-100/50 transition-colors" onClick={() => toggleSort('employee_id')}>
                                                    <div className="flex items-center gap-1.5">ID <SortIcon field="employee_id" /></div>
                                                </th>
                                                <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer group hover:bg-gray-100/50 transition-colors" onClick={() => toggleSort('name')}>
                                                    <div className="flex items-center gap-1.5">Employee <SortIcon field="name" /></div>
                                                </th>
                                                <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer group hover:bg-gray-100/50 transition-colors" onClick={() => toggleSort('phone')}>
                                                    <div className="flex items-center gap-1.5">Contact <SortIcon field="phone" /></div>
                                                </th>
                                                <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer group hover:bg-gray-100/50 transition-colors" onClick={() => toggleSort('email')}>
                                                    <div className="flex items-center gap-1.5">Email <SortIcon field="email" /></div>
                                                </th>
                                                <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer group hover:bg-gray-100/50 transition-colors" onClick={() => toggleSort('department')}>
                                                    <div className="flex items-center gap-1.5">Department <SortIcon field="department" /></div>
                                                </th>
                                                <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer group hover:bg-gray-100/50 transition-colors" onClick={() => toggleSort('status')}>
                                                    <div className="flex items-center gap-1.5">Biometric Status <SortIcon field="status" /></div>
                                                </th>
                                                <th className="px-8 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-widest">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {paginatedEmployees.map((emp) => (
                                                <tr key={emp.employee_id} className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => setViewingEmployee(emp)}>
                                                    <td className="px-8 py-5 whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm text-gray-600 font-mono font-medium">{emp.employee_id}</span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCopyId(emp.employee_id); }}
                                                                className="text-gray-400 hover:text-brand-teal transition-colors focus:opacity-100"
                                                                title="Copy ID"
                                                            >
                                                                {copiedId === emp.employee_id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 whitespace-nowrap hover:bg-blue-50/50 transition-colors" title="View Employee Profile">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-blue/20 to-brand-teal/20 flex items-center justify-center text-brand-navy font-bold text-lg shadow-sm border border-white group-hover:scale-105 transition-transform">
                                                                {emp.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="text-sm font-bold text-gray-900">{emp.name}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 whitespace-nowrap">
                                                        <div className="text-sm text-gray-700 font-medium">{emp.phone || '-'}</div>
                                                    </td>
                                                    <td className="px-8 py-5 whitespace-nowrap">
                                                        <div className="text-sm text-gray-500">{emp.email || '-'}</div>
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
                                                        <button onClick={(e) => { e.stopPropagation(); handleEditClick(emp); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Edit Employee">
                                                            <Edit size={18} />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp.employee_id); }} className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors ml-2" title="Delete Employee">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredEmployees.length === 0 && (
                                                <tr>
                                                    <td colSpan="7" className="px-8 py-20 text-center">
                                                        <div className="flex flex-col items-center text-gray-400">
                                                            <Users size={48} className="mb-4 opacity-20" />
                                                            {employees.length === 0 ? (
                                                                <>
                                                                    <p className="text-lg font-medium text-gray-500">No employees found.</p>
                                                                    <p className="text-sm mt-1">Switch to the "Add New" tab to get started.</p>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <p className="text-lg font-medium text-gray-500">No employees match your filters.</p>
                                                                    <button
                                                                        onClick={() => { setSearchQuery(''); setStatusFilter('all'); setDeptFilter('all'); }}
                                                                        className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm"
                                                                    >
                                                                        Clear Filters
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
                                        <span className="text-sm text-gray-500">
                                            Showing <span className="font-semibold text-gray-700">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-gray-700">{Math.min(currentPage * itemsPerPage, filteredEmployees.length)}</span> of <span className="font-semibold text-gray-700">{filteredEmployees.length}</span> employees
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* REGISTER TAB */}
                {activeTab === 'register' && (
                    <div className="p-8 md:p-12 animate-in fade-in duration-300 flex justify-center">
                        <div className="w-full ">
                            {registerMethod === 'manual' ? (
                                <div className="animate-in slide-in-from-bottom-2 duration-300 mx-auto">
                                    {regMsg.text && !showSuccess && (
                                        <div className={`p-4 rounded-xl mb-6 text-sm flex items-center gap-3 border shadow-sm ${regMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                                            }`}>
                                            {regMsg.type === 'error' ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
                                            <span className="font-medium">{regMsg.text}</span>
                                        </div>
                                    )}

                                    {showSuccess ? (
                                        <div className="bg-white p-10 rounded-2xl border border-green-100 shadow-xl text-center flex flex-col items-center">
                                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                                <CheckCircle2 size={40} />
                                            </div>
                                            <h3 className="text-2xl font-bold text-gray-800 mb-2">Profile Created Successfully!</h3>
                                            <p className="text-gray-500 mb-8 max-w-md">
                                                {regForm.name} ({regForm.employee_id}) has been added to the directory. You can now register their face data for biometric attendance.
                                            </p>

                                            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                                                <button
                                                    onClick={() => {
                                                        setSelectedEmployee(regForm.employee_id);
                                                        setActiveTab('face');
                                                        resetForm();
                                                    }}
                                                    className="px-6 py-3.5 bg-brand-teal text-white font-bold rounded-xl hover:shadow-lg hover:shadow-brand-teal/30 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Camera size={18} />
                                                    Register Face Data Now
                                                </button>
                                                <button
                                                    onClick={resetForm}
                                                    className="px-6 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <UserPlus size={18} />
                                                    Add Another Employee
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleRegister} className="space-y-8 w-full mx-auto">

                                            {/* Section 1: Basic Info */}
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                                    <User size={18} className="text-brand-blue" /> Basic Information
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-semibold text-gray-700">Employee ID <span className="text-red-500">*</span></label>
                                                        <div className="relative">
                                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                            <input required type="text" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="EMP-001" value={regForm.employee_id} onChange={(e) => setRegForm({ ...regForm, employee_id: e.target.value })} />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-semibold text-gray-700">Full Name <span className="text-red-500">*</span></label>
                                                        <div className="relative">
                                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                            <input required type="text" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="John Doe" value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-semibold text-gray-700">Email Address</label>
                                                        <div className="relative">
                                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                            <input type="email" pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}" title="Please enter a valid email address" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="john@example.com" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-semibold text-gray-700">Phone Number</label>
                                                        <div className="relative">
                                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                            <input type="tel" pattern="^\d{10}$" maxLength="10" title="Please enter exactly a 10-digit phone number" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="9999999999" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value.replace(/\D/g, '') })} />
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Basic Info Custom Fields */}
                                                <div className="mt-4 space-y-3">
                                                    {basicCustomFields.map((field, index) => (
                                                        <div key={`basic-${index}`} className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                            <input type="text" placeholder="Field Name (e.g. Blood Group)" className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none text-sm" value={field.key} onChange={(e) => { const newF = [...basicCustomFields]; newF[index].key = e.target.value; setBasicCustomFields(newF); }} />
                                                            <input type="text" placeholder="Value" className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none text-sm" value={field.value} onChange={(e) => { const newF = [...basicCustomFields]; newF[index].value = e.target.value; setBasicCustomFields(newF); }} />
                                                            <button type="button" onClick={() => setBasicCustomFields(basicCustomFields.filter((_, i) => i !== index))} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18} /></button>
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={() => setBasicCustomFields([...basicCustomFields, { key: '', value: '' }])} className="text-brand-blue font-semibold text-sm flex items-center gap-1 hover:text-brand-navy transition-colors bg-brand-blue/5 px-3 py-1.5 rounded-lg w-fit">
                                                        <Plus size={16} /> Add Custom Field
                                                    </button>
                                                </div>
                                            </div>

                                            <hr className="border-gray-100" />

                                            {/* Section 2: Organization */}
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                                    <Building size={18} className="text-brand-blue" /> Organization
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                    <div className="space-y-1.5 md:col-span-2">
                                                        <label className="text-sm font-semibold text-gray-700">Domain / Group <span className="text-red-500">*</span></label>
                                                        <div className="relative">
                                                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                            <input list="domain-list" required type="text" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="e.g. Engineering, Sales" value={regForm.domain} onChange={(e) => setRegForm({ ...regForm, domain: e.target.value })} />
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
                                                            <input list="dept-list" type="text" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="e.g. Frontend Team" value={regForm.department} onChange={(e) => setRegForm({ ...regForm, department: e.target.value })} />
                                                            <datalist id="dept-list">
                                                                {[...new Set(employees.map(e => e.department).filter(Boolean))].map(dept => (
                                                                    <option key={dept} value={dept} />
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-semibold text-gray-700">Position / Role</label>
                                                        <div className="relative">
                                                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                            <input list="pos-list" type="text" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="e.g. Senior Developer" value={regForm.position} onChange={(e) => setRegForm({ ...regForm, position: e.target.value })} />
                                                            <datalist id="pos-list">
                                                                {[...new Set(employees.map(e => e.position).filter(Boolean))].map(pos => (
                                                                    <option key={pos} value={pos} />
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Organization Custom Fields */}
                                                <div className="mt-4 space-y-3">
                                                    {orgCustomFields.map((field, index) => (
                                                        <div key={`org-${index}`} className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                            <input type="text" placeholder="Field Name (e.g. Desk Number)" className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none text-sm" value={field.key} onChange={(e) => { const newF = [...orgCustomFields]; newF[index].key = e.target.value; setOrgCustomFields(newF); }} />
                                                            <input type="text" placeholder="Value" className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none text-sm" value={field.value} onChange={(e) => { const newF = [...orgCustomFields]; newF[index].value = e.target.value; setOrgCustomFields(newF); }} />
                                                            <button type="button" onClick={() => setOrgCustomFields(orgCustomFields.filter((_, i) => i !== index))} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18} /></button>
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={() => setOrgCustomFields([...orgCustomFields, { key: '', value: '' }])} className="text-brand-blue font-semibold text-sm flex items-center gap-1 hover:text-brand-navy transition-colors bg-brand-blue/5 px-3 py-1.5 rounded-lg w-fit">
                                                        <Plus size={16} /> Add Custom Field
                                                    </button>
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="w-full bg-gradient-to-r from-brand-navy to-brand-dark text-white font-bold py-4 rounded-xl hover:shadow-lg transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md"
                                            >
                                                {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <UserPlus size={20} />}
                                                {isSubmitting ? 'Processing...' : 'Create Employee Profile'}
                                            </button>
                                        </form>
                                    )}
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
                                        <div className={`p-4 rounded-xl mb-6 text-sm flex items-center gap-3 border ${bulkMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
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
                                                    <Settings2 size={18} className="text-brand-teal" /> Column Mapping
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
                                                                onChange={(e) => setCsvMapping({ ...csvMapping, [field]: e.target.value })}
                                                            >
                                                                <option value="">-- Ignore --</option>
                                                                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                            </select>
                                                        </div>
                                                    ))}
                                                </div>

                                                {csvHeaders.filter(h => !Object.values(csvMapping).includes(h)).length > 0 && (
                                                    <div className="mt-4 p-4 bg-brand-blue/5 border border-brand-blue/20 rounded-xl">
                                                        <h5 className="text-sm font-bold text-brand-blue flex items-center gap-2 mb-2">
                                                            Automatically Imported as Custom Fields:
                                                        </h5>
                                                        <div className="flex flex-wrap gap-2">
                                                            {csvHeaders.filter(h => !Object.values(csvMapping).includes(h)).map(h => (
                                                                <span key={h} className="px-3 py-1.5 bg-white text-gray-700 text-xs font-bold rounded-lg shadow-sm border border-gray-200">
                                                                    {h}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-2">These columns will be added to each employee's profile as custom data.</p>
                                                    </div>
                                                )}
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
                                        <div className={`p-4 rounded-xl mb-6 text-sm flex items-center gap-3 border ${sqlMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
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
                                                    <Settings2 size={18} className="text-brand-navy" /> Secure Parsing Enabled
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
                                    <div className={`p-4 rounded-xl mb-6 text-sm flex items-start gap-3 border animate-in slide-in-from-top-2 ${faceMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
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
                                                    <img src={imgUrl} alt={`Snap ${index + 1}`} className="w-full h-full object-cover" />
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

                {/* (View tab moved to side panel at bottom) */}

                {/* EDIT TAB */}
                {activeTab === 'edit' && editingEmployee && (
                    <div className="p-8 md:p-12 animate-in fade-in duration-300 flex justify-center">
                        <div className="w-full">
                            <div className="animate-in slide-in-from-bottom-2 duration-300 mx-auto">
                                <div className="text-center mb-8 relative">
                                    <button onClick={() => setActiveTab('list')} className="absolute left-0 top-0 text-gray-400 hover:text-gray-700 bg-white hover:bg-gray-100 p-3 rounded-full transition-colors shadow-sm border border-gray-200/50">
                                        <X size={24} />
                                    </button>
                                    <div className="w-16 h-16 bg-brand-blue/5 text-brand-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-brand-blue/10">
                                        <Edit size={32} />
                                    </div>
                                    <h3 className="text-3xl font-bold text-gray-800 tracking-tight">Edit Profile: {editingEmployee.name}</h3>
                                    <p className="text-gray-500 mt-2 text-lg">Update staff details for ID: {editingEmployee.employee_id}.</p>
                                </div>

                                <form onSubmit={submitEditEmployee} className="space-y-8 w-full mx-auto">

                                    {/* Section 1: Basic Info */}
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                            <User size={18} className="text-brand-blue" /> Basic Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-semibold text-gray-700">Employee ID</label>
                                                <div className="relative">
                                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <input readOnly type="text" className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed outline-none" value={editingEmployee.employee_id} />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-semibold text-gray-700">Full Name <span className="text-red-500">*</span></label>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <input required type="text" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="John Doe" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-semibold text-gray-700">Email Address</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <input type="email" pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}" title="Please enter a valid email address" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="john@example.com" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-semibold text-gray-700">Phone Number</label>
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <input type="tel" pattern="^\d{10}$" maxLength="10" title="Please enter exactly a 10-digit phone number" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="9999999999" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '') })} />
                                                </div>
                                            </div>
                                        </div>
                                        {/* Edit Basic Info Custom Fields */}
                                        <div className="mt-4 space-y-3">
                                            {editBasicCustomFields.map((field, index) => (
                                                <div key={`edit-basic-${index}`} className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <input type="text" placeholder="Field Name (e.g. Blood Group)" className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none text-sm" value={field.key} onChange={(e) => { const newF = [...editBasicCustomFields]; newF[index].key = e.target.value; setEditBasicCustomFields(newF); }} />
                                                    <input type="text" placeholder="Value" className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none text-sm" value={field.value} onChange={(e) => { const newF = [...editBasicCustomFields]; newF[index].value = e.target.value; setEditBasicCustomFields(newF); }} />
                                                    <button type="button" onClick={() => setEditBasicCustomFields(editBasicCustomFields.filter((_, i) => i !== index))} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18} /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => setEditBasicCustomFields([...editBasicCustomFields, { key: '', value: '' }])} className="text-brand-blue font-semibold text-sm flex items-center gap-1 hover:text-brand-navy transition-colors bg-brand-blue/5 px-3 py-1.5 rounded-lg w-fit">
                                                <Plus size={16} /> Add Custom Field
                                            </button>
                                        </div>
                                    </div>

                                    <hr className="border-gray-100" />

                                    {/* Section 2: Organization */}
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                            <Building size={18} className="text-brand-blue" /> Organization
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-1.5 md:col-span-2">
                                                <label className="text-sm font-semibold text-gray-700">Domain / Group <span className="text-red-500">*</span></label>
                                                <div className="relative">
                                                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <input list="edit-domain-list" required type="text" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="e.g. Engineering, Sales" value={editForm.domain} onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })} />
                                                    <datalist id="edit-domain-list">
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
                                                    <input list="edit-dept-list" type="text" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="e.g. Frontend Team" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
                                                    <datalist id="edit-dept-list">
                                                        {[...new Set(employees.map(e => e.department).filter(Boolean))].map(dept => (
                                                            <option key={dept} value={dept} />
                                                        ))}
                                                    </datalist>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-semibold text-gray-700">Position / Role</label>
                                                <div className="relative">
                                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <input list="edit-pos-list" type="text" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none" placeholder="e.g. Senior Developer" value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} />
                                                    <datalist id="edit-pos-list">
                                                        {[...new Set(employees.map(e => e.position).filter(Boolean))].map(pos => (
                                                            <option key={pos} value={pos} />
                                                        ))}
                                                    </datalist>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Edit Organization Custom Fields */}
                                        <div className="mt-4 space-y-3">
                                            {editOrgCustomFields.map((field, index) => (
                                                <div key={`edit-org-${index}`} className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <input type="text" placeholder="Field Name (e.g. Desk Number)" className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none text-sm" value={field.key} onChange={(e) => { const newF = [...editOrgCustomFields]; newF[index].key = e.target.value; setEditOrgCustomFields(newF); }} />
                                                    <input type="text" placeholder="Value" className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none text-sm" value={field.value} onChange={(e) => { const newF = [...editOrgCustomFields]; newF[index].value = e.target.value; setEditOrgCustomFields(newF); }} />
                                                    <button type="button" onClick={() => setEditOrgCustomFields(editOrgCustomFields.filter((_, i) => i !== index))} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18} /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => setEditOrgCustomFields([...editOrgCustomFields, { key: '', value: '' }])} className="text-brand-blue font-semibold text-sm flex items-center gap-1 hover:text-brand-navy transition-colors bg-brand-blue/5 px-3 py-1.5 rounded-lg w-fit">
                                                <Plus size={16} /> Add Custom Field
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-6 flex justify-end gap-4 border-t border-gray-100">
                                        <button type="button" onClick={() => setActiveTab('list')} className="px-8 py-3.5 text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold rounded-xl transition-colors text-base">Cancel</button>
                                        <button type="submit" disabled={isUpdating} className="px-8 py-3.5 bg-brand-teal hover:bg-teal-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-3 text-base">
                                            {isUpdating ? <RefreshCw className="animate-spin" size={18} /> : <Check size={18} />} Save Changes
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* View Employee Side Panel */}
            {viewingEmployee && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={(e) => { if (e.target === e.currentTarget) setViewingEmployee(null); }}>
                    <div className="bg-white shadow-2xl w-full max-w-md h-full flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-100 overflow-hidden relative">

                        {/* Header */}
                        <div className="p-8 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white shrink-0 relative">
                            <button onClick={() => setViewingEmployee(null)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 bg-white hover:bg-gray-100 p-2 rounded-full transition-colors shadow-sm border border-gray-200/50">
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-5 mt-4">
                                <div className="w-20 h-20 bg-brand-navy text-white rounded-3xl flex items-center justify-center text-3xl font-bold shadow-lg shadow-brand-navy/20 border border-brand-navy/10 shrink-0">
                                    {viewingEmployee.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 leading-tight">{viewingEmployee.name}</h3>
                                    <p className="text-sm font-medium text-gray-500 mt-1 font-mono">ID: {viewingEmployee.employee_id}</p>
                                    {viewingEmployee.registered_date && (
                                        <p className="text-xs font-medium text-gray-400 mt-1">Registered: {new Date(viewingEmployee.registered_date).toLocaleDateString()}</p>
                                    )}

                                    <div className="mt-3">
                                        {viewingEmployee.embedding_name ? (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-teal bg-brand-teal/10 px-2.5 py-1 rounded-lg border border-brand-teal/20">
                                                <CheckCircle2 size={14} /> Biometrics Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                                                <XCircle size={14} /> Biometrics Pending
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-8 overflow-y-auto flex-1 bg-white">

                            <div className="space-y-8">

                                {/* Organization Details */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Building size={14} /> Organization
                                    </h4>
                                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Domain / Group</span>
                                            <span className="text-sm font-medium text-gray-900 mt-1">{viewingEmployee.domain || '-'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Department</span>
                                            <span className="text-sm font-medium text-gray-900 mt-1">{viewingEmployee.department || '-'}</span>
                                        </div>
                                        <div className="flex flex-col col-span-2">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Position / Role</span>
                                            <span className="text-sm font-medium text-gray-900 mt-1">{viewingEmployee.position || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-gray-100" />

                                {/* Contact Info */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Mail size={14} /> Contact Information
                                    </h4>
                                    {(viewingEmployee.email || viewingEmployee.phone) ? (
                                        <div className="space-y-4">
                                            {viewingEmployee.email && (
                                                <div className="flex items-center gap-3 text-sm font-medium text-gray-900 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                                                    <Mail size={16} className="text-gray-400" /> {viewingEmployee.email}
                                                </div>
                                            )}
                                            {viewingEmployee.phone && (
                                                <div className="flex items-center gap-3 text-sm font-medium text-gray-900 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                                                    <Phone size={16} className="text-gray-400" /> {viewingEmployee.phone}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-xl text-center border border-dashed border-gray-200">No contact information available.</p>
                                    )}
                                </div>

                                {viewingEmployee.custom_fields && Object.keys(viewingEmployee.custom_fields).length > 0 && (
                                    <>
                                        <hr className="border-gray-100" />
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <FileText size={14} /> Additional Information
                                            </h4>
                                            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                                {Object.entries(viewingEmployee.custom_fields).map(([key, value]) => (
                                                    <div key={key} className="flex flex-col">
                                                        <span className="text-xs font-bold text-gray-500 uppercase">{key}</span>
                                                        {typeof value === 'object' && value !== null ? (
                                                            <div className="flex flex-col gap-3 mt-2 border-l-2 border-brand-teal/30 pl-3">
                                                                {Object.entries(value).map(([subKey, subVal]) => (
                                                                    <div key={subKey} className="flex flex-col">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">{subKey}</span>
                                                                        <span className="text-sm font-medium text-gray-800">{String(subVal)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm font-medium text-gray-900 mt-1">{String(value)}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                            </div>

                            <div className="pt-8 pb-4 flex justify-end gap-3 sticky bottom-0 bg-white border-t border-white mt-8 shadow-[0_-10px_20px_white]">
                                <button
                                    onClick={() => {
                                        const emp = viewingEmployee;
                                        setViewingEmployee(null);
                                        handleEditClick(emp);
                                    }}
                                    className="w-full py-3.5 bg-brand-navy hover:bg-blue-900 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    <Edit size={16} /> Edit Employee Profile
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

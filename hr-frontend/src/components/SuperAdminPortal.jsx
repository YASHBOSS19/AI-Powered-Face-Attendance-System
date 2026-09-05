import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Plus, Trash2, LogIn, Activity, AlertCircle } from 'lucide-react';
import { apiCall } from '../api';

export default function SuperAdminPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  
  // Data states
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', email: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'users') {
        const data = await apiCall('/super-admin/users');
        setUsers(data.users || []);
      } else {
        const data = await apiCall('/super-admin/audit-logs');
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiCall('/super-admin/users', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      setShowCreateModal(false);
      setNewUser({ username: '', password: '', full_name: '', email: '' });
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this HR Admin?")) return;
    
    try {
      await apiCall(`/super-admin/users/${userId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleImpersonate = async (userId) => {
    if (!window.confirm("You are about to impersonate this HR Admin. Your Super Admin session will be temporarily replaced. Continue?")) return;
    
    try {
      const data = await apiCall(`/super-admin/impersonate/${userId}`, { method: 'POST' });
      // Store the impersonated token and role
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      
      // Redirect to the standard HR dashboard
      window.location.href = '/'; 
    } catch (err) {
      alert(err.message || 'Failed to impersonate user');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors relative ${
            activeTab === 'users' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={18} />
          HR Admin Management
          {activeTab === 'users' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-md"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors relative ${
            activeTab === 'logs' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity size={18} />
          Audit Logs
          {activeTab === 'logs' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-md"></span>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
        
        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900">HR Administrators</h2>
                <p className="text-sm text-gray-500 mt-1">Manage accounts that have access to the HR Panel.</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-brand-teal hover:bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                <Plus size={16} />
                New HR Admin
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">ID</th>
                    <th className="p-4 font-semibold">Username</th>
                    <th className="p-4 font-semibold">Full Name</th>
                    <th className="p-4 font-semibold">Email</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {loading ? (
                    <tr><td colSpan="6" className="p-8 text-center text-gray-400">Loading users...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-gray-400">No HR Admins found.</td></tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50 transition">
                        <td className="p-4 text-gray-500">#{u.id}</td>
                        <td className="p-4 font-medium text-gray-900">{u.username}</td>
                        <td className="p-4 text-gray-700">{u.full_name || '-'}</td>
                        <td className="p-4 text-gray-500">{u.email || '-'}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            {u.status || 'Active'}
                          </span>
                        </td>
                        <td className="p-4 flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleImpersonate(u.id)}
                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded text-xs font-medium transition"
                            title="Log in as this user"
                          >
                            <LogIn size={14} />
                            Impersonate
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition"
                            title="Delete user"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div>
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">System Audit Logs</h2>
              <p className="text-sm text-gray-500 mt-1">Immutable record of sensitive actions performed by Super Admins.</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Timestamp</th>
                    <th className="p-4 font-semibold">Admin</th>
                    <th className="p-4 font-semibold">Action</th>
                    <th className="p-4 font-semibold">Resource</th>
                    <th className="p-4 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {loading ? (
                    <tr><td colSpan="5" className="p-8 text-center text-gray-400">Loading logs...</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan="5" className="p-8 text-center text-gray-400">No logs recorded yet.</td></tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 transition">
                        <td className="p-4 text-gray-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-4 font-medium text-gray-700">{log.admin_username}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            log.action === 'CREATE_USER' ? 'bg-green-100 text-green-700' :
                            log.action === 'DELETE_USER' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-gray-500 font-mono text-xs">{log.resource}</td>
                        <td className="p-4 text-gray-700">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">Create HR Admin</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Username</label>
                <input 
                  type="text" required 
                  value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition" 
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Password</label>
                <input 
                  type="password" required 
                  value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Full Name</label>
                <input 
                  type="text" required 
                  value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Email</label>
                <input 
                  type="email" required 
                  value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition" 
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-70">
                  {creating ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

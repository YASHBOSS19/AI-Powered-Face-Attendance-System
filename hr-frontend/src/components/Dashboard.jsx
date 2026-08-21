import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Users, FileText, LogOut, LayoutDashboard, Camera, ExternalLink, AlertTriangle, X, UserPlus, Clock, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { apiCall, getWebSocketUrl } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unknownAlerts, setUnknownAlerts] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { path: '/employees', label: 'Employees', icon: <Users size={20} /> },
    { path: '/reports', label: 'Reports', icon: <FileText size={20} /> },
    { path: '/unknown-identity', label: 'Unknown Identity', icon: <AlertTriangle size={20} /> },
    { path: '/kiosk', label: 'Live Recognition', icon: <Camera size={20} /> },
  ];

  useEffect(() => {
    let ws = null;
    let isSubscribed = true;

    try {
      ws = new WebSocket(getWebSocketUrl('/ws/attendance'));

      ws.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'UNKNOWN_FACE') {
             setUnknownAlerts(prev => {
                if (prev.find(a => a.image === msg.image)) return prev;
                return [{ id: Date.now(), image: msg.image, box: msg.box, enrolling: false, enrollName: '' }, ...prev];
             });
          }
        } catch (err) {}
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

  const handleEnroll = async (alert) => {
    setUnknownAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, enrolling: true } : a));
    try {
      await apiCall('/dataset/create', {
        method: 'POST',
        body: JSON.stringify({
          name: alert.enrollName,
          images: [alert.image]
        })
      });
      await apiCall('/enroll', {
        method: 'POST',
        body: JSON.stringify({
          name: alert.enrollName,
          images: [alert.image]
        })
      });
      
      const parts = alert.enrollName.split('_');
      if (parts.length >= 2) {
        const empId = parts[0];
        try {
          await apiCall('/employees/link-face', {
            method: 'POST',
            body: JSON.stringify({ employee_id: empId, embedding_name: alert.enrollName })
          });
        } catch (linkErr) {
          console.warn("Could not automatically link face to DB record:", linkErr);
        }
      }
      
      setUnknownAlerts(prev => prev.filter(a => a.id !== alert.id));
    } catch (err) {
      console.error('Failed to enroll:', err);
      window.alert('Failed to enroll: ' + err.message);
      setUnknownAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, enrolling: false } : a));
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 relative overflow-hidden">
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Hamburger Button */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="md:hidden absolute top-4 left-4 z-30 bg-brand-navy text-white p-2 rounded-xl shadow-lg hover:bg-brand-blue transition-colors"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Sidebar */}
      <aside className={`bg-gradient-to-b from-brand-navy to-brand-dark text-white flex flex-col shadow-xl z-50 transition-all duration-300 absolute md:relative h-full ${
        isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-20'
      }`}>
        
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:block absolute -right-3 top-6 bg-brand-teal text-white p-1 rounded-full shadow-lg z-50 hover:bg-emerald-500 transition-colors border border-white/20"
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className={`h-16 flex items-center px-4 border-b border-brand-dark/50 bg-black/10 flex-shrink-0 ${isSidebarOpen ? 'justify-center' : 'justify-center'}`}>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="IdentiFi Logo" className={`w-auto object-contain rounded-full transition-all duration-300 ${isSidebarOpen ? 'h-12' : 'h-10'}`} />
            {isSidebarOpen && (
              <h1 className="text-2xl font-black tracking-tight text-white flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden animate-in fade-in zoom-in duration-300">
                IdentiFi <span className="text-brand-teal text-xl">HR</span>
              </h1>
            )}
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 rounded-lg transition-colors overflow-hidden ${
                isSidebarOpen ? 'justify-between' : 'justify-center'
              } ${
                location.pathname === item.path 
                  ? 'bg-brand-teal text-white shadow-md' 
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
              title={!isSidebarOpen ? item.label : ""}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">{item.icon}</div>
                {isSidebarOpen && <span className="font-medium tracking-wide whitespace-nowrap animate-in fade-in duration-300">{item.label}</span>}
              </div>
              {item.path === '/unknown-identity' && unknownAlerts.length > 0 && (
                <span className={`bg-red-500 text-white font-bold rounded-full animate-pulse shadow-sm flex items-center justify-center ${
                  isSidebarOpen ? 'text-[10px] px-2 py-0.5' : 'absolute top-2 right-2 h-4 w-4 text-[9px]'
                }`}>
                  {unknownAlerts.length}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className={`p-4 border-t border-brand-dark/50 bg-black/10 space-y-2 flex-shrink-0 overflow-hidden`}>
          <a
            href="/gate"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center py-2.5 bg-brand-navy hover:bg-brand-blue text-brand-teal hover:text-white rounded-lg transition border border-brand-teal/30 hover:border-brand-teal group ${isSidebarOpen ? 'px-4' : 'px-0'}`}
            title="Open Gate Kiosk"
          >
            <ExternalLink size={18} className={isSidebarOpen ? "mr-2 group-hover:scale-110 transition-transform flex-shrink-0" : ""} />
            {isSidebarOpen && <span className="font-bold text-sm whitespace-nowrap animate-in fade-in duration-300">Gate Kiosk</span>}
          </a>
          
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center justify-center py-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition border border-red-500/20 hover:border-red-500 group ${isSidebarOpen ? 'px-4' : 'px-0'}`}
            title="Logout"
          >
            <LogOut size={18} className={isSidebarOpen ? "mr-2 group-hover:-translate-x-1 transition-transform flex-shrink-0" : ""} />
            {isSidebarOpen && <span className="font-bold text-sm whitespace-nowrap animate-in fade-in duration-300">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto w-full">
        <div className="p-4 pt-16 md:pt-8 md:p-8 mx-auto w-full">
          <Outlet context={{ unknownAlerts, setUnknownAlerts, handleEnroll }} />
        </div>
      </main>
    </div>
  );
}

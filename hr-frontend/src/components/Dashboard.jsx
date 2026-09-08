import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Users, FileText, LogOut, LayoutDashboard, Camera, ExternalLink, AlertTriangle, X, UserPlus, Clock, ChevronLeft, ChevronRight, ChevronDown, Menu, Settings as SettingsIcon, Calendar } from 'lucide-react';
import { apiCall, getWebSocketUrl } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unknownAlerts, setUnknownAlerts] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(location.pathname.startsWith('/employees') ? '/employees' : '');
  const [companyName, setCompanyName] = useState('IdentiFi HR');
  const [logoUrl, setLogoUrl] = useState('/logo.png');

  const loadSettings = async () => {
    try {
      const data = await apiCall('/settings/');
      if (data.companyName) {
        setCompanyName(data.companyName);
        document.title = `${data.companyName} Portal`;
      }
      if (data.logoUrl) setLogoUrl(data.logoUrl);
    } catch (err) {
      console.error("Failed to load settings:", err);
      const savedName = localStorage.getItem('companyName');
      const savedLogo = localStorage.getItem('logoUrl');
      if (savedName) {
        setCompanyName(savedName);
        document.title = `${savedName} Portal`;
      }
      if (savedLogo) setLogoUrl(savedLogo);
    }
  };

  useEffect(() => {
    loadSettings();
    const handleSettingsUpdate = (e) => {
      if (e.detail) {
        if (e.detail.companyName) {
          setCompanyName(e.detail.companyName);
          document.title = `${e.detail.companyName} Portal`;
        }
        if (e.detail.logoUrl) setLogoUrl(e.detail.logoUrl);
      } else {
        loadSettings();
      }
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    {
      path: '/employees',
      label: 'Employees',
      icon: <Users size={20} />,
      subItems: [
        { path: '/employees?tab=list', label: 'Directory', icon: <Users size={16} /> },
        { path: '/employees?tab=register', label: 'Add New', icon: <UserPlus size={16} /> },
        { path: '/employees?tab=face', label: 'Face Data', icon: <Camera size={16} /> },
      ]
    },
    { path: '/reports', label: 'Reports', icon: <FileText size={20} /> },
    { path: '/unknown-identity', label: 'Unknown Identity', icon: <AlertTriangle size={20} /> },
    { path: '/kiosk', label: 'Live Recognition', icon: <Camera size={20} /> },
    { path: '/settings', label: 'Settings', icon: <SettingsIcon size={20} /> },
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
      
      const parts = alert.enrollName.split(/[_ ]/);
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

        <div className="h-16 flex items-center px-4 border-b border-brand-dark/50 bg-black/10 flex-shrink-0 justify-center">
          <div className="flex items-center justify-center w-full overflow-hidden">
            <img src={logoUrl} alt="Logo" className={`w-auto object-contain rounded-full flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'h-12' : 'h-10'}`} />
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const hasSub = !!item.subItems;
            const isExpanded = expandedMenu === item.path;
            const isEmployeesTab = location.pathname.startsWith('/employees') && item.path === '/employees';
            const isActive = location.pathname === item.path || isEmployeesTab;

            const handleParentClick = (e) => {
              if (hasSub) {
                setExpandedMenu(isExpanded ? '' : item.path);
              } else {
                setExpandedMenu('');
                if (window.innerWidth < 768) {
                  setIsSidebarOpen(false);
                }
              }
            };

            return (
              <div key={item.path} className="space-y-1">
                <Link
                  to={item.path}
                  onClick={handleParentClick}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors overflow-hidden ${
                    isSidebarOpen ? 'justify-between' : 'justify-center'
                  } ${
                    isActive
                      ? 'bg-brand-navy/50 text-white shadow-inner'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                  title={!isSidebarOpen ? item.label : ""}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">{item.icon}</div>
                    {isSidebarOpen && <span className="font-medium tracking-wide whitespace-nowrap animate-in fade-in duration-300">{item.label}</span>}
                  </div>

                  <div className="flex items-center space-x-2">
                    {item.path === '/unknown-identity' && unknownAlerts.length > 0 && (
                      <span className={`bg-red-500 text-white font-bold rounded-full animate-pulse shadow-sm flex items-center justify-center ${
                        isSidebarOpen ? 'text-[10px] px-2 py-0.5' : 'absolute top-2 right-2 h-4 w-4 text-[9px]'
                      }`}>
                        {unknownAlerts.length}
                      </span>
                    )}
                    {isSidebarOpen && item.subItems && (
                      <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-white' : 'text-gray-400'}`}>
                        <ChevronDown size={16} />
                      </div>
                    )}
                  </div>
                </Link>

                {isExpanded && item.subItems && (
                  <div className={`${isSidebarOpen ? 'pl-12 pr-4' : 'px-2'} py-2 space-y-1 animate-in slide-in-from-top-2 duration-300`}>
                    {item.subItems.map(sub => {
                      const search = new URLSearchParams(location.search);
                      const tab = search.get('tab') || 'list';
                      const subTab = new URLSearchParams(sub.path.split('?')[1]).get('tab');
                      const isSubActive = tab === subTab;
                      return (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          onClick={() => {
                            if (window.innerWidth < 768) {
                              setIsSidebarOpen(false);
                            }
                          }}
                          className={`flex items-center ${isSidebarOpen ? 'space-x-3 px-3' : 'justify-center'} py-2 rounded-lg transition-colors text-sm ${
                            isSubActive ? 'bg-brand-teal text-white shadow-md font-semibold' : 'text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                          title={!isSidebarOpen ? sub.label : ""}
                        >
                          <div className="flex-shrink-0">{sub.icon}</div>
                          {isSidebarOpen && <span>{sub.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
      <main className="flex-1 overflow-auto w-full relative min-w-0">

        {/* Mobile Top Bar */}
        <div className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-brand-navy p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-gray-800 tracking-tight">{companyName}</span>
        </div>

        <div className="px-4 py-3 md:px-8 md:pt-4 md:pb-6 mx-auto flex flex-col min-h-full">
          {location.pathname === '/' && (
            <header className="mb-4 animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                  Welcome <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-teal to-brand-blue">{companyName}</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">Manage your workforce efficiently.</p>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 text-xs sm:text-sm font-bold text-gray-700 hidden md:flex items-center gap-2 w-full md:w-auto shrink-0 justify-center">
                <Calendar size={16} className="text-brand-teal" />
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </header>
          )}

          <div className="flex-1">
            <Outlet context={{ unknownAlerts, setUnknownAlerts, handleEnroll }} />
          </div>
        </div>
      </main>
    </div>
  );
}

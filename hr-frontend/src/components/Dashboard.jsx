import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, FileText, LogOut, LayoutDashboard, Camera, ExternalLink, 
  AlertTriangle, X, UserPlus, Clock, ChevronLeft, ChevronRight, 
  ChevronDown, Menu, Settings as SettingsIcon, Calendar, Bell, 
  ShieldAlert, Check, ArrowRight, Shield, AlertOctagon, CheckCircle2,
  Info, Sparkles, RefreshCw, TrendingUp, FileQuestion, HelpCircle
} from 'lucide-react';
import { apiCall, getWebSocketUrl } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unknownAlerts, setUnknownAlerts] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(location.pathname.startsWith('/employees') ? '/employees' : '');
  const [companyName, setCompanyName] = useState('IdentiFi HR');
  const [logoUrl, setLogoUrl] = useState('/logo.png');

  // Smart Alerts State for Notification Bell
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [alertsSummary, setAlertsSummary] = useState({
    unread_count: 0,
    critical_count: 0,
    total_count: 0,
    attendance_rate: 100,
    habitual_late_count: 0,
    seat_usage: { current: 0, limit: 50, pct: 0, plan: 'Basic Plan', remaining: 50 },
    latest_alerts: []
  });
  const [pendingQueriesCount, setPendingQueriesCount] = useState(0);
  const bellRef = useRef(null);

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

  const fetchPendingQueriesCount = async () => {
    try {
      const res = await apiCall('/attendance-queries?status=pending');
      if (res.status === 'success' && res.counts) {
        setPendingQueriesCount(res.counts.pending || 0);
      }
    } catch (err) {
      console.warn("Could not fetch pending queries count:", err);
    }
  };

  const fetchAlertsSummary = async () => {
    try {
      const res = await apiCall('/alerts/summary');
      if (res.status === 'success') {
        setAlertsSummary(res);
      }
    } catch (err) {
      console.warn("Could not fetch alerts summary:", err);
    }
  };

  useEffect(() => {
    loadSettings();
    fetchAlertsSummary();
    fetchPendingQueriesCount();

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

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setIsBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // WebSocket for Live Attendance & Smart Alerts Sync
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
          if (msg.type === 'ATTENDANCE_MARKED' || msg.type === 'CHECKOUT_MARKED' || msg.type === 'UNKNOWN_FACE' || msg.type === 'NEW_ATTENDANCE_QUERY' || msg.type === 'ATTENDANCE_QUERY_RESOLVED' || msg.type === 'ATTENDANCE_QUERY_UPDATED') {
            fetchAlertsSummary();
            fetchPendingQueriesCount();
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const handleQuickMarkRead = async (alertId, e) => {
    e.stopPropagation();
    try {
      await apiCall(`/alerts/${alertId}/read`, { method: 'PUT' });
      setAlertsSummary(prev => ({
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1),
        latest_alerts: prev.latest_alerts.map(a => a.id === alertId ? { ...a, is_read: true } : a)
      }));
    } catch (err) {
      console.error("Failed to mark alert as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiCall('/alerts/mark-all-read', { method: 'PUT' });
      setAlertsSummary(prev => ({
        ...prev,
        unread_count: 0,
        latest_alerts: prev.latest_alerts.map(a => ({ ...a, is_read: true }))
      }));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const navItems = [
    { path: '/', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { path: '/analytics', label: 'Analytics', icon: <TrendingUp size={20} /> },
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
    { 
      path: '/queries', 
      label: 'Attendance Queries', 
      icon: <FileQuestion size={20} />,
      badge: pendingQueriesCount > 0 ? pendingQueriesCount : null,
      badgeColor: 'bg-amber-500'
    },
    { 
      path: '/alerts', 
      label: 'Alerts Center', 
      icon: <Bell size={20} />,
      badge: alertsSummary.unread_count > 0 ? alertsSummary.unread_count : null,
      badgeColor: alertsSummary.critical_count > 0 ? 'bg-rose-500' : 'bg-amber-500'
    },
    { path: '/unknown-identity', label: 'Unknown Identity', icon: <AlertTriangle size={20} /> },
    { path: '/kiosk', label: 'Live Recognition', icon: <Camera size={20} /> },
    { path: '/settings', label: 'Settings', icon: <SettingsIcon size={20} /> },
  ];

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
      <aside 
        onMouseEnter={() => window.innerWidth >= 768 && setIsSidebarOpen(true)}
        onMouseLeave={() => window.innerWidth >= 768 && setIsSidebarOpen(false)}
        className={`bg-gradient-to-b from-brand-navy to-brand-dark text-white flex flex-col shadow-xl z-50 transition-all duration-300 ease-in-out absolute md:relative h-full ${
          isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-20'
        }`}
      >
        
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
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors overflow-hidden relative ${
                    isSidebarOpen ? 'justify-between' : 'justify-center'
                  } ${
                    isActive
                      ? 'bg-brand-navy/50 text-white shadow-inner'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                  title={!isSidebarOpen ? item.label : ""}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="flex-shrink-0 relative">
                      {item.icon}
                      {!isSidebarOpen && item.badge && (
                        <span className={`absolute -top-1 -right-1.5 ${item.badgeColor || 'bg-rose-500'} text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center animate-pulse`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
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

                    {isSidebarOpen && item.badge && (
                      <span className={`${item.badgeColor || 'bg-rose-500'} text-white font-bold text-[10px] px-2 py-0.5 rounded-full animate-pulse shadow-xs`}>
                        {item.badge}
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

        {/* Top Navbar with Notification Bell and Breadcrumb */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200/80 px-4 md:px-8 py-2.5 flex items-center justify-between shadow-xs">
          
          {/* Left: Mobile Toggle & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-brand-navy p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-800 tracking-tight text-sm sm:text-base">{companyName}</span>
              <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                Admin Portal
              </span>
            </div>
          </div>

          {/* Right: Notification Bell & Quick Info */}
          <div className="flex items-center gap-3">
            
            {/* Notification Bell Dropdown Launcher */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setIsBellOpen(!isBellOpen)}
                className={`relative p-2 rounded-xl border transition-all duration-200 ${
                  isBellOpen 
                    ? 'bg-brand-navy text-white border-brand-navy shadow-sm' 
                    : alertsSummary.unread_count > 0 
                      ? 'bg-amber-50/80 text-slate-700 border-amber-200/80 hover:bg-amber-100/80' 
                      : 'bg-white text-slate-600 border-gray-200 hover:bg-gray-100'
                }`}
                title="Smart Alerts & Notifications"
              >
                <Bell size={18} className={alertsSummary.unread_count > 0 ? "animate-wiggle" : ""} />
                
                {/* Unread Badge */}
                {alertsSummary.unread_count > 0 && (
                  <span className={`absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-sm ${
                    alertsSummary.critical_count > 0 ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                  }`}>
                    {alertsSummary.unread_count}
                  </span>
                )}
              </button>

              {/* FLOATING NOTIFICATION DROPDOWN */}
              {isBellOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  
                  {/* DROPDOWN HEADER */}
                  <div className="p-4 bg-gradient-to-r from-brand-navy to-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={18} className="text-brand-teal" />
                      <div>
                        <h4 className="font-bold text-sm tracking-tight">Smart Alerts</h4>
                        <p className="text-[11px] text-slate-300">
                          {alertsSummary.unread_count} unread alert{alertsSummary.unread_count === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    
                    {alertsSummary.unread_count > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-bold text-brand-teal hover:text-emerald-400 flex items-center gap-1 transition"
                      >
                        <Check size={12} /> Mark all read
                      </button>
                    )}
                  </div>

                  {/* QUICK STATS STRIP */}
                  <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-100 text-center py-2 px-3 text-[11px] font-bold">
                    <div className="border-r border-slate-200/60">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Attendance</span>
                      <span className={alertsSummary.attendance_rate < 70 ? 'text-amber-600' : 'text-emerald-600'}>
                        {alertsSummary.attendance_rate}%
                      </span>
                    </div>
                    <div className="border-r border-slate-200/60">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Late (&ge;3x)</span>
                      <span className={alertsSummary.habitual_late_count > 0 ? 'text-amber-600' : 'text-slate-700'}>
                        {alertsSummary.habitual_late_count} staff
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Seat Limit</span>
                      <span className={alertsSummary.seat_usage?.pct >= 80 ? 'text-rose-600' : 'text-slate-700'}>
                        {alertsSummary.seat_usage?.pct || 0}%
                      </span>
                    </div>
                  </div>

                  {/* ALERTS FEED IN DROPDOWN */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {alertsSummary.latest_alerts && alertsSummary.latest_alerts.length > 0 ? (
                      alertsSummary.latest_alerts.map((alert) => {
                        const isCritical = alert.severity === 'critical';
                        const isWarning = alert.severity === 'warning';
                        return (
                          <div 
                            key={alert.id}
                            onClick={() => {
                              setIsBellOpen(false);
                              navigate('/alerts');
                            }}
                            className={`p-3.5 transition cursor-pointer flex items-start gap-3 hover:bg-slate-50 ${
                              !alert.is_read ? 'bg-sky-50/40' : ''
                            }`}
                          >
                            <div className="pt-0.5 flex-shrink-0">
                              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                                isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-sky-500'
                              }`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <p className={`text-xs font-bold truncate ${!alert.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                                  {alert.title}
                                </p>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                  {formatTimeAgo(alert.created_at)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                {alert.message}
                              </p>
                            </div>

                            {!alert.is_read && (
                              <button
                                onClick={(e) => handleQuickMarkRead(alert.id, e)}
                                className="p-1 hover:bg-slate-200/60 rounded text-slate-400 hover:text-brand-teal transition shrink-0"
                                title="Mark read"
                              >
                                <Check size={13} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-slate-400 space-y-1">
                        <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                        <p className="text-xs font-bold text-slate-700">All Systems Operational</p>
                        <p className="text-[11px]">No pending operational alerts.</p>
                      </div>
                    )}
                  </div>

                  {/* DROPDOWN FOOTER */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      to="/alerts"
                      onClick={() => setIsBellOpen(false)}
                      className="w-full text-center py-1.5 bg-brand-navy hover:bg-brand-blue text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>Open Full Alerts Center</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>

                </div>
              )}
            </div>

            {/* Date Widget */}
            <div className="bg-white px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hidden sm:flex items-center gap-2">
              <Calendar size={14} className="text-brand-teal" />
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>

        </div>

        <div className="px-4 py-4 md:px-8 md:pt-6 md:pb-8 mx-auto flex flex-col min-h-full">
          <div className="flex-1">
            <Outlet context={{ unknownAlerts, setUnknownAlerts, handleEnroll, alertsSummary, refreshAlerts: fetchAlertsSummary }} />
          </div>
        </div>
      </main>
    </div>
  );
}

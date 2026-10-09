import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Shield, LogOut, Users, Activity, ChevronLeft, ChevronRight, 
  Menu, BarChart3, ShieldCheck, Bell, AlertTriangle, AlertOctagon, 
  UserPlus, ArrowRight, Crown
} from 'lucide-react';
import { apiCall } from '../api';

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [isAlertMenuOpen, setIsAlertMenuOpen] = useState(false);
  const alertMenuRef = useRef(null);

  // get tab from url
  const search = new URLSearchParams(location.search);
  const activeTab = search.get('tab') || 'analytics';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const fetchAlertsSummary = async () => {
    try {
      const data = await apiCall('/super-admin/alerts');
      if (data.status === 'success') {
        setUnreadCount(data.unread_count || 0);
        setRecentAlerts((data.alerts || []).slice(0, 5));
      }
    } catch {
      // Background poll silently fails if token expires
    }
  };

  useEffect(() => {
    fetchAlertsSummary();
    const interval = setInterval(fetchAlertsSummary, 25000);
    return () => clearInterval(interval);
  }, [location.search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (alertMenuRef.current && !alertMenuRef.current.contains(e.target)) {
        setIsAlertMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { path: '?tab=analytics', id: 'analytics', label: 'Global Analytics', icon: <BarChart3 size={20} /> },
    { path: '?tab=users', id: 'users', label: 'HR Admin Management', icon: <Users size={20} /> },
    { path: '?tab=plans', id: 'plans', label: 'Subscription Tiers', icon: <Crown size={20} /> },
    { path: '?tab=alerts', id: 'alerts', label: 'Alerts & Limits', icon: <Bell size={20} />, badge: unreadCount },
    { path: '?tab=logs', id: 'logs', label: 'Audit Logs', icon: <Activity size={20} /> },
    { path: '?tab=profile', id: 'profile', label: 'Profile & Security', icon: <ShieldCheck size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-50 relative overflow-hidden super-admin-scope">
      
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
          <div className="flex items-center justify-center w-full overflow-hidden text-brand-teal">
             <Shield size={isSidebarOpen ? 28 : 24} className="flex-shrink-0 transition-all duration-300" />
             {isSidebarOpen && <span className="ml-3 font-bold text-lg whitespace-nowrap animate-in fade-in duration-300">Super Admin</span>}
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <div key={item.id} className="space-y-1">
                <Link
                  to={`/super-admin${item.path}`}
                  onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors overflow-hidden ${
                    isSidebarOpen ? 'justify-between' : 'justify-center'
                  } ${
                    isActive
                      ? 'bg-white/15 text-white shadow-inner font-medium'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                  title={!isSidebarOpen ? item.label : ""}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="flex-shrink-0 relative">
                      {item.icon}
                      {!isSidebarOpen && item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-brand-navy" />
                      )}
                    </div>
                    {isSidebarOpen && (
                      <span className="font-medium tracking-wide whitespace-nowrap animate-in fade-in duration-300">
                        {item.label}
                      </span>
                    )}
                  </div>

                  {isSidebarOpen && item.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-in fade-in duration-300">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className={`p-3 border-t border-brand-dark/50 bg-black/10 space-y-2 flex-shrink-0 overflow-hidden`}>
          <Link
            to="/super-admin?tab=profile"
            onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
            className={`flex items-center p-2 rounded-xl transition-all ${
              activeTab === 'profile' ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-slate-300'
            } ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}
            title="Super Admin Profile"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-brand-teal text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
                SA
              </div>
              {isSidebarOpen && (
                <div className="min-w-0 animate-in fade-in duration-200">
                  <p className="text-xs font-bold text-white truncate">Super Admin</p>
                  <p className="text-[10px] text-brand-teal font-mono truncate">Root Security</p>
                </div>
              )}
            </div>
          </Link>

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
      <main className="flex-1 overflow-auto w-full relative min-w-0 bg-gray-50 flex flex-col">

        {/* Top Header Bar for Desktop & Mobile */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 md:px-8 py-3 flex items-center justify-between shadow-xs">
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-brand-navy p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="hidden sm:block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Governance Platform</span>
              <h2 className="text-sm md:text-base font-black text-slate-800 tracking-tight">Super Admin Portal</h2>
            </div>
          </div>

          {/* Right Header Utilities (Notification Bell + Profile quick jump) */}
          <div className="flex items-center gap-3">
            
            {/* NOTIFICATION BELL DROPDOWN */}
            <div className="relative" ref={alertMenuRef}>
              <button
                onClick={() => setIsAlertMenuOpen(!isAlertMenuOpen)}
                className={`relative p-2 rounded-xl transition-all ${
                  isAlertMenuOpen 
                    ? 'bg-slate-100 text-brand-navy ring-2 ring-brand-teal/30' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="Notifications & Limit Alerts"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* DROPDOWN POPUP */}
              {isAlertMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        <Bell size={16} className="text-brand-teal" />
                        System Notifications
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {unreadCount} unread system & capacity alerts
                      </p>
                    </div>
                    <Link
                      to="/super-admin?tab=alerts"
                      onClick={() => setIsAlertMenuOpen(false)}
                      className="text-xs text-brand-teal hover:underline font-bold"
                    >
                      View All
                    </Link>
                  </div>

                  {/* QUICK ALERTS LIST */}
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {recentAlerts.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No recent notifications.
                      </div>
                    ) : (
                      recentAlerts.map(alert => (
                        <div 
                          key={alert.id}
                          onClick={() => {
                            setIsAlertMenuOpen(false);
                            navigate('/super-admin?tab=alerts');
                          }}
                          className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex items-start gap-3 ${
                            !alert.is_read ? 'bg-sky-50/30' : ''
                          }`}
                        >
                          <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            alert.severity === 'critical' ? 'bg-rose-100 text-rose-600' :
                            alert.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
                            alert.type === 'NEW_TENANT' ? 'bg-teal-100 text-teal-600' :
                            'bg-sky-100 text-sky-600'
                          }`}>
                            {alert.type === 'NEW_TENANT' ? (
                              <UserPlus size={14} />
                            ) : alert.severity === 'critical' ? (
                              <AlertOctagon size={14} />
                            ) : (
                              <AlertTriangle size={14} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{alert.title}</p>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{alert.message}</p>
                            {alert.tenant_name && (
                              <p className="text-[10px] text-brand-teal font-semibold mt-1 truncate">
                                {alert.tenant_name}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                    <button
                      onClick={() => {
                        setIsAlertMenuOpen(false);
                        navigate('/super-admin?tab=alerts');
                      }}
                      className="text-xs font-bold text-brand-navy hover:text-brand-teal flex items-center justify-center gap-1 w-full"
                    >
                      Open Alert & Limits Center <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar Quick Jump */}
            <Link
              to="/super-admin?tab=profile"
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition"
              title="Super Admin Profile"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-navy text-brand-teal flex items-center justify-center font-black text-xs shadow-xs">
                SA
              </div>
            </Link>

          </div>
        </header>

        {/* Content Body - Responsive and Dynamic fitting to screen */}
        <div className="px-3 sm:px-6 md:px-8 py-4 md:py-6 mx-auto flex flex-col flex-1 w-full max-w-[1920px]">
          {activeTab !== 'create-user' && activeTab !== 'analytics' && activeTab !== 'logs' && activeTab !== 'profile' && activeTab !== 'alerts' && (
            <header className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                Super Admin <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-teal to-brand-blue">Portal</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">System Administration and Audit</p>
            </header>
          )}

          <div className="flex-1 w-full min-w-0">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

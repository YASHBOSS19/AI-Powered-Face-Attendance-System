import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, LogOut, Users, Activity, ChevronLeft, ChevronRight, Menu } from 'lucide-react';

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // get tab from url
  const search = new URLSearchParams(location.search);
  const activeTab = search.get('tab') || 'users';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const navItems = [
    { path: '?tab=users', id: 'users', label: 'HR Admin Management', icon: <Users size={20} /> },
    { path: '?tab=logs', id: 'logs', label: 'Audit Logs', icon: <Activity size={20} /> },
  ];

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
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">{item.icon}</div>
                    {isSidebarOpen && <span className="font-medium tracking-wide whitespace-nowrap animate-in fade-in duration-300">{item.label}</span>}
                  </div>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className={`p-4 border-t border-brand-dark/50 bg-black/10 space-y-2 flex-shrink-0 overflow-hidden`}>
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
      <main className="flex-1 overflow-auto w-full relative min-w-0 bg-gray-50">

        {/* Mobile Top Bar */}
        <div className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-brand-navy p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-gray-800 tracking-tight">Super Admin Portal</span>
        </div>

        <div className="px-4 py-6 md:px-8 md:py-8 mx-auto flex flex-col min-h-full">
          {activeTab !== 'create-user' && (
            <header className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                Super Admin <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-teal to-brand-blue">Portal</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">System Administration and Audit</p>
            </header>
          )}

          <div className="flex-1">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

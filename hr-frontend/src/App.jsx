import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Reports from './components/Reports';
import Overview from './components/Overview';
import Employees from './components/Employees';
import Kiosk from './components/Kiosk';
import GateKiosk from './components/GateKiosk';

import UnknownIdentity from './components/UnknownIdentity';
import Settings from './components/Settings';
import AlertsCenter from './components/AlertsCenter';
import Analytics from './components/Analytics';
import SuperAdminLayout from './components/SuperAdminLayout';
import SuperAdminPortal from './components/SuperAdminPortal';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  
  if (!token) return <Navigate to="/login" />;
  if (role === 'SUPER_ADMIN') return <Navigate to="/super-admin" />;
  
  return children;
};

const SuperAdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  
  if (!token) return <Navigate to="/login" />;
  if (role !== 'SUPER_ADMIN') return <Navigate to="/" />;
  
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/gate" element={<GateKiosk />} />
        
        {/* Super Admin Routes */}
        <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminLayout /></SuperAdminRoute>}>
          <Route index element={<SuperAdminPortal />} />
        </Route>
        
        {/* Standard HR Routes */}
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>}>
          <Route index element={<Overview />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="employees" element={<Employees />} />
          <Route path="reports" element={<Reports />} />
          <Route path="alerts" element={<AlertsCenter />} />
          <Route path="unknown-identity" element={<UnknownIdentity />} />
          <Route path="kiosk" element={<Kiosk />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}




export default App; // Force HMR

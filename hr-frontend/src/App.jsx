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

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/gate" element={<GateKiosk />} />
        
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>}>
          <Route index element={<Overview />} />
          <Route path="employees" element={<Employees />} />
          <Route path="reports" element={<Reports />} />
          <Route path="unknown-identity" element={<UnknownIdentity />} />
          <Route path="kiosk" element={<Kiosk />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}




export default App; // Force HMR

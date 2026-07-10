import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login         from './pages/Login';
import Dashboard     from './pages/Dashboard';
import Quotations    from './pages/Quotations';
import Inventory     from './pages/Inventory';
import Labour        from './pages/Labour';
import Attendance    from './pages/Attendance';
import Settings      from './pages/Settings';
import Projects      from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/"                element={<ProtectedRoute pageKey="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="/projects"        element={<ProtectedRoute pageKey="projects"><Projects /></ProtectedRoute>} />
          <Route path="/projects/:id"    element={<ProtectedRoute pageKey="projects"><ProjectDetail /></ProtectedRoute>} />
          <Route path="/quotations"      element={<ProtectedRoute pageKey="quotations"><Quotations /></ProtectedRoute>} />
          <Route path="/inventory"       element={<ProtectedRoute pageKey="inventory"><Inventory /></ProtectedRoute>} />
          <Route path="/labour"          element={<ProtectedRoute pageKey="labour"><Labour /></ProtectedRoute>} />
          <Route path="/attendance"      element={<ProtectedRoute pageKey="attendance"><Attendance /></ProtectedRoute>} />
          <Route path="/settings"        element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
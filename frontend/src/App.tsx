import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import IncidentList from './pages/IncidentList';
import IncidentNew from './pages/IncidentNew';
import IncidentDetail from './pages/IncidentDetail';
import EntityDetail from './pages/EntityDetail';
import SSOCallback from './pages/SSOCallback';
import AuditLog from './pages/AuditLog';
import UserManagement from './pages/UserManagement';
import ProtectedRoute from './components/ProtectedRoute';
import NavBar from './components/NavBar';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { user } = useAuth();
  return (
    <>
      {user && <NavBar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/sso-callback" element={<SSOCallback />} />
        <Route path="/incidents" element={<ProtectedRoute><IncidentList /></ProtectedRoute>} />
        <Route path="/incidents/new" element={<ProtectedRoute><IncidentNew /></ProtectedRoute>} />
        <Route path="/incidents/:id" element={<ProtectedRoute><IncidentDetail /></ProtectedRoute>} />
        <Route path="/incidents/:id/entities/:entityId" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
        <Route path="/admin/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={user ? '/incidents' : '/login'} replace />} />
      </Routes>
    </>
  );
}

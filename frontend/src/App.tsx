import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import OrgSettings from './pages/OrgSettings';
import SuperAdmin from './pages/SuperAdmin';
import IncidentList from './pages/IncidentList';
import IncidentNew from './pages/IncidentNew';
import IncidentDetail from './pages/IncidentDetail';
import EntityDetail from './pages/EntityDetail';
import ExecutiveSummary from './pages/ExecutiveSummary';
import MyTasks from './pages/MyTasks';
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
        <Route path="/register" element={<Register />} />
        <Route path="/sso-callback" element={<SSOCallback />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/settings/org" element={<ProtectedRoute><OrgSettings /></ProtectedRoute>} />
        <Route path="/superadmin" element={<ProtectedRoute><SuperAdmin /></ProtectedRoute>} />
        <Route path="/incidents" element={<ProtectedRoute><IncidentList /></ProtectedRoute>} />
        <Route path="/incidents/new" element={<ProtectedRoute><IncidentNew /></ProtectedRoute>} />
        <Route path="/incidents/:id" element={<ProtectedRoute><IncidentDetail /></ProtectedRoute>} />
        <Route path="/incidents/:id/executive-summary" element={<ProtectedRoute><ExecutiveSummary /></ProtectedRoute>} />
        <Route path="/incidents/:id/entities/:entityId" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
        <Route path="/admin/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
        <Route path="/tasks/mine" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={user ? '/incidents' : '/login'} replace />} />
      </Routes>
    </>
  );
}

import { Routes, Route, Navigate, useParams } from 'react-router-dom';
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
import LicenseActivation from './pages/LicenseActivation';
import LicenseAdmin from './pages/LicenseAdmin';
import ProtectedRoute from './components/ProtectedRoute';
import NavBar from './components/NavBar';
import TopBar from './components/TopBar';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import { useAuth } from './context/AuthContext';

// Force full remount of IncidentDetail when the incident ID changes.
// Without this, navigating between incidents reuses the mounted component
// instance and can leave stale state that causes a blank render.
function IncidentDetailKeyed() {
  const { id } = useParams<{ id: string }>();
  return <IncidentDetail key={id} />;
}
function EntityDetailKeyed() {
  const { entityId } = useParams<{ entityId: string }>();
  return <EntityDetail key={entityId} />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <>
      {user && <NavBar />}
      {user && <TopBar />}
      <ToastContainer />
      <div style={user ? { marginLeft: '220px', paddingTop: '48px', minHeight: '100vh' } : undefined}>
        <ErrorBoundary>
          <Routes>
            <Route path="/activate" element={<LicenseActivation />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/sso-callback" element={<SSOCallback />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/settings/org" element={<ProtectedRoute><OrgSettings /></ProtectedRoute>} />
            <Route path="/superadmin" element={<ProtectedRoute><SuperAdmin /></ProtectedRoute>} />
            <Route path="/incidents" element={<ProtectedRoute><IncidentList /></ProtectedRoute>} />
            <Route path="/incidents/new" element={<ProtectedRoute><IncidentNew /></ProtectedRoute>} />
            <Route path="/incidents/:id" element={<ProtectedRoute><IncidentDetailKeyed /></ProtectedRoute>} />
            <Route path="/incidents/:id/executive-summary" element={<ProtectedRoute><ExecutiveSummary /></ProtectedRoute>} />
            <Route path="/incidents/:id/entities/:entityId" element={<ProtectedRoute><EntityDetailKeyed /></ProtectedRoute>} />
            <Route path="/admin/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/license" element={<ProtectedRoute><LicenseAdmin /></ProtectedRoute>} />
            <Route path="/tasks/mine" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to={user ? '/incidents' : '/login'} replace />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </>
  );
}

import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import Profile from './pages/Profile';
import Onboarding from './pages/Onboarding';
import OrgSettings from './pages/OrgSettings';
import SuperAdmin from './pages/SuperAdmin';
import IncidentList from './pages/IncidentList';
import IncidentNew from './pages/IncidentNew';
import IncidentDetail from './pages/IncidentDetail';
import EntityDetail from './pages/EntityDetail';
import ExecutiveSummary from './pages/ExecutiveSummary';
import WarRoom from './pages/WarRoom';
import MyTasks from './pages/MyTasks';
import SSOCallback from './pages/SSOCallback';
import AuditLog from './pages/AuditLog';
import UserManagement from './pages/UserManagement';
import LicenseActivation from './pages/LicenseActivation';
import LicenseAdmin from './pages/LicenseAdmin';
import Search from './pages/Search';
import TabletopExercises from './pages/TabletopExercises';
import TabletopDetail from './pages/TabletopDetail';
import PcapAnalysis from './pages/PcapAnalysis';
import ProtectedRoute from './components/ProtectedRoute';
import NavBar from './components/NavBar';
import TopBar from './components/TopBar';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import PcapAnalysisFrame from './components/PcapAnalysisFrame';
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

// Modules that embed a self-contained tool with its own full navigation UI get
// the whole viewport instead of sitting inside the platform's sidebar + top bar
// chrome, which would otherwise leave the tool squeezed between two side navs.
const FULL_BLEED_PREFIXES = ['/pcap-analysis'];

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  const fullBleed = FULL_BLEED_PREFIXES.some((p) => location.pathname.startsWith(p));
  const showChrome = !!user && !fullBleed;
  const onPcap = location.pathname.startsWith('/pcap-analysis');
  return (
    <>
      {showChrome && <NavBar />}
      {showChrome && <TopBar />}
      <ToastContainer />
      {/* Mounted once regardless of route, visibility toggled by CSS, so the
          embedded tool keeps whatever capture an analyst loaded while they
          step away to the rest of Fission Ops and come back. */}
      {!!user && <PcapAnalysisFrame visible={onPcap} />}
      <div style={showChrome ? { marginLeft: '220px', paddingTop: '48px', minHeight: '100vh' } : undefined}>
        <ErrorBoundary>
          <Routes>
            <Route path="/activate" element={<LicenseActivation />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/sso-callback" element={<SSOCallback />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/settings/org" element={<ProtectedRoute><OrgSettings /></ProtectedRoute>} />
            <Route path="/superadmin" element={<ProtectedRoute><SuperAdmin /></ProtectedRoute>} />
            <Route path="/incidents" element={<ProtectedRoute><IncidentList /></ProtectedRoute>} />
            <Route path="/incidents/new" element={<ProtectedRoute><IncidentNew /></ProtectedRoute>} />
            <Route path="/incidents/:id" element={<ProtectedRoute><IncidentDetailKeyed /></ProtectedRoute>} />
            <Route path="/incidents/:id/executive-summary" element={<ProtectedRoute><ExecutiveSummary /></ProtectedRoute>} />
            <Route path="/incidents/:id/war-room" element={<ProtectedRoute><WarRoom /></ProtectedRoute>} />
            <Route path="/incidents/:id/entities/:entityId" element={<ProtectedRoute><EntityDetailKeyed /></ProtectedRoute>} />
            <Route path="/admin/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/license" element={<ProtectedRoute><LicenseAdmin /></ProtectedRoute>} />
            <Route path="/tasks/mine" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
            <Route path="/tabletop" element={<ProtectedRoute><TabletopExercises /></ProtectedRoute>} />
            <Route path="/tabletop/:id" element={<ProtectedRoute><TabletopDetail /></ProtectedRoute>} />
            {/* Renders nothing visible — the actual tool is the always-mounted
                PcapAnalysisFrame above, so this route only needs to exist for
                auth-gating and so direct links/bookmarks to it work. */}
            <Route path="/pcap-analysis" element={<ProtectedRoute><PcapAnalysis /></ProtectedRoute>} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to={user ? '/incidents' : '/login'} replace />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </>
  );
}

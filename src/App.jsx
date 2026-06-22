import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import CustomerPortal from './pages/CustomerPortal';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';

import KPI from './pages/KPI';
import ChatbotConfig from './pages/ChatbotConfig';
import Settings from './pages/Settings';
import TestAccounts from './pages/TestAccounts';
import MyTickets from './pages/MyTickets';
import UserManagement from './pages/UserManagement';
import Customers from './pages/Customers';
import RolePermissions from './pages/RolePermissions';
import ReplyingCenter from './pages/ReplyingCenter';
import ConversationTags from './pages/ConversationTags';
import SubmitTicket from './pages/SubmitTicket';
import SubmitInternalTicket from './pages/SubmitInternalTicket';
import StaffRatings from './pages/StaffRatings';
import GroupChat from './pages/GroupChat';
import VIPTickets from './pages/VIPTickets';
import EmailLogin from './pages/EmailLogin';
import InternalTicketsDashboard from './pages/InternalTicketsDashboard';
import InternalEscalations from './pages/InternalEscalations';
import SLASettings from './pages/SLASettings';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated, authChecked } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // In preview, allow all routes; in published, enforce auth
  const isPreview = window.location.hostname.includes('preview');
  
  if (!isPreview && authChecked && !isAuthenticated) {
    navigateToLogin();
    return null;
  }

  if (!isPreview && !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -24, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{ display: 'contents' }}
        >
        <Routes location={location}>
          {/* Public customer portal - customers & unauthenticated */}
          <Route path="/" element={<ErrorBoundary><CustomerPortal /></ErrorBoundary>} />
          <Route path="/my-tickets" element={<ErrorBoundary><MyTickets /></ErrorBoundary>} />
          <Route path="/submit-ticket" element={<ErrorBoundary><SubmitTicket /></ErrorBoundary>} />
          <Route path="/submit-internal-ticket" element={<ErrorBoundary><SubmitInternalTicket /></ErrorBoundary>} />

          {/* Staff portal with layout - role-gated in Layout */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="/tickets" element={<ErrorBoundary><Tickets /></ErrorBoundary>} />
            <Route path="/kpi" element={<ErrorBoundary><KPI /></ErrorBoundary>} />
            <Route path="/chatbot-config" element={<ErrorBoundary><ChatbotConfig /></ErrorBoundary>} />
            <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
            <Route path="/test-accounts" element={<ErrorBoundary><TestAccounts /></ErrorBoundary>} />
            <Route path="/users" element={<ErrorBoundary><UserManagement /></ErrorBoundary>} />
            <Route path="/role-permissions" element={<ErrorBoundary><RolePermissions /></ErrorBoundary>} />
            <Route path="/customers" element={<ErrorBoundary><Customers /></ErrorBoundary>} />
            <Route path="/replying-center" element={<ErrorBoundary><ReplyingCenter /></ErrorBoundary>} />
            <Route path="/conversation-tags" element={<ErrorBoundary><ConversationTags /></ErrorBoundary>} />
            <Route path="/staff-ratings" element={<ErrorBoundary><StaffRatings /></ErrorBoundary>} />
            <Route path="/group-chat" element={<ErrorBoundary><GroupChat /></ErrorBoundary>} />
            <Route path="/vip-tickets" element={<ErrorBoundary><VIPTickets /></ErrorBoundary>} />
            <Route path="/internal-tickets" element={<ErrorBoundary><InternalTicketsDashboard /></ErrorBoundary>} />
            <Route path="/escalations" element={<ErrorBoundary><InternalEscalations /></ErrorBoundary>} />
            <Route path="/sla-settings" element={<ErrorBoundary><SLASettings /></ErrorBoundary>} />
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
        </motion.div>
      </AnimatePresence>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
          <Toaster />
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
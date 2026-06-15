import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import CustomerPortal from './pages/CustomerPortal';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
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
import StaffRatings from './pages/StaffRatings';
import GroupChat from './pages/GroupChat';
import VIPTickets from './pages/VIPTickets';
import EmailLogin from './pages/EmailLogin';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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

  return (
    <Routes>
      {/* Email login - shown first if not authenticated */}
      <Route path="/login" element={<EmailLogin />} />

      {/* Public customer portal - customers & unauthenticated */}
      <Route path="/" element={<CustomerPortal />} />
      <Route path="/my-tickets" element={<MyTickets />} />
      <Route path="/submit-ticket" element={<SubmitTicket />} />

      {/* Staff portal with layout - role-gated in Layout */}
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route path="/kpi" element={<KPI />} />
        <Route path="/chatbot-config" element={<ChatbotConfig />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/test-accounts" element={<TestAccounts />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/role-permissions" element={<RolePermissions />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/replying-center" element={<ReplyingCenter />} />
        <Route path="/conversation-tags" element={<ConversationTags />} />
        <Route path="/staff-ratings" element={<StaffRatings />} />
        <Route path="/group-chat" element={<GroupChat />} />
        <Route path="/vip-tickets" element={<VIPTickets />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
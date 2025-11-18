import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import AuthPage from "@/pages/auth-page";
import RecruiterAuth from "@/pages/recruiter-auth";
import CandidateAuth from "@/pages/candidate-auth";
import JobsPage from "@/pages/jobs-page";
import JobDetailsPage from "@/pages/job-details-page";
import JobPostPage from "@/pages/job-post-page";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminSuperDashboard from "@/pages/admin-super-dashboard";
import AdminTestingPage from "@/pages/admin-testing-page";
import AdminFormsPage from "@/pages/admin-forms-page";
import FormEditorPage from "@/pages/form-editor-page";
import UnifiedAdminDashboard from "@/pages/unified-admin-dashboard";
import ApplicationManagementPage from "@/pages/application-management-page";
import CandidateDashboard from "@/pages/candidate-dashboard";
import JobAnalyticsDashboard from "@/pages/job-analytics-dashboard";
import RecruiterDashboard from "@/pages/recruiter-dashboard";
import ApplicationsPage from "@/pages/applications-page";
import MyJobsPage from "@/pages/my-jobs-page";
import ConsultantsPage from "@/pages/consultants-page";
import PublicFormPage from "@/pages/public-form-page";
import PrivacyPolicyPage from "@/pages/privacy-policy-page";
import TermsOfServicePage from "@/pages/terms-of-service-page";
import CookiePolicyPage from "@/pages/cookie-policy-page";
import { CookieConsent, AnalyticsOnConsent } from "@/components/CookieConsent";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/recruiter-auth" component={RecruiterAuth} />
      <Route path="/candidate-auth" component={CandidateAuth} />
      <Route path="/consultants" component={ConsultantsPage} />
      <Route path="/form/:token" component={PublicFormPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/terms-of-service" component={TermsOfServicePage} />
      <Route path="/cookie-policy" component={CookiePolicyPage} />
      <Route path="/jobs" component={JobsPage} />
      <ProtectedRoute path="/jobs/post" component={JobPostPage} requiredRole={['recruiter', 'admin']} />
      <ProtectedRoute path="/jobs/:id/applications" component={ApplicationManagementPage} requiredRole={['recruiter', 'admin']} />
      <Route path="/jobs/:id" component={JobDetailsPage} />
      <ProtectedRoute path="/my-dashboard" component={CandidateDashboard} requiredRole={['candidate']} />
      <ProtectedRoute path="/recruiter-dashboard" component={RecruiterDashboard} requiredRole={['recruiter', 'admin']} />
      <ProtectedRoute path="/applications" component={ApplicationsPage} requiredRole={['recruiter', 'admin']} />
      <ProtectedRoute path="/my-jobs" component={MyJobsPage} requiredRole={['recruiter', 'admin']} />
      <ProtectedRoute path="/admin" component={UnifiedAdminDashboard} requiredRole={['admin']} />
      <ProtectedRoute path="/admin/super" component={AdminSuperDashboard} requiredRole={['admin']} />
      <ProtectedRoute path="/admin/testing" component={AdminTestingPage} requiredRole={['admin']} />
      <ProtectedRoute path="/admin/forms/editor/:id?" component={FormEditorPage} requiredRole={['admin', 'recruiter']} />
      <ProtectedRoute path="/admin/forms" component={AdminFormsPage} requiredRole={['admin', 'recruiter']} />
      <ProtectedRoute path="/analytics" component={JobAnalyticsDashboard} requiredRole={['recruiter', 'admin']} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          {/* Inject analytics only after consent */}
          <AnalyticsOnConsent />
          <CookieConsent />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

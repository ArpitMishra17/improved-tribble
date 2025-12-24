import { Switch, Route, Redirect } from "wouter";
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
import AdminSuperDashboard from "@/pages/admin-super-dashboard";
import AdminFormsPage from "@/pages/admin-forms-page";
import AdminEmailTemplatesPage from "@/pages/admin-email-templates-page";
import FormEditorPage from "@/pages/form-editor-page";
import AdminFormResponsesPage from "@/pages/admin-form-responses-page";
import AdminConsultantsPage from "@/pages/admin-consultants-page";
import AdminAIUsagePage from "@/pages/admin-ai-usage-page";
import AdminFeedbackPage from "@/pages/admin-feedback-page";
import ApplicationManagementPage from "@/pages/application-management-page";
import JobEditPage from "@/pages/job-edit-page";
import JobPipelinePage from "@/pages/job-pipeline-page";
import JobAnalyticsPage from "@/pages/job-analytics-page";
import CandidateDashboard from "@/pages/candidate-dashboard";
import JobAnalyticsDashboard from "@/pages/job-analytics-dashboard";
import RecruiterDashboard from "@/pages/recruiter-dashboard";
import HiringManagerDashboard from "@/pages/hiring-manager-dashboard";
import ApplicationsPage from "@/pages/applications-page";
import MyJobsPage from "@/pages/my-jobs-page";
import CandidatesPage from "@/pages/candidates-page";
import ConsultantsPage from "@/pages/consultants-page";
import ClientsPage from "@/pages/clients-page";
import ClientShortlistPage from "@/pages/client-shortlist-page";
import PublicFormPage from "@/pages/public-form-page";
import PrivacyPolicyPage from "@/pages/privacy-policy-page";
import TermsOfServicePage from "@/pages/terms-of-service-page";
import CookiePolicyPage from "@/pages/cookie-policy-page";
import BrandAssetsPage from "@/pages/brand-assets-page";
import VerifyEmailPage from "@/pages/verify-email-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import ProfileSettingsPage from "@/pages/profile-settings-page";
import RecruiterProfilePage from "@/pages/recruiter-profile-page";
import { CookieConsent, AnalyticsOnConsent } from "@/components/CookieConsent";
import { lazy, Suspense } from "react";

// Dev-only UI gallery (lazy loaded, tree-shaken in production)
const DevUIGallery = import.meta.env.DEV
  ? lazy(() => import("@/pages/dev-ui-gallery"))
  : null;
import { TourProvider } from "@/components/TourProvider";
import { TourLauncher } from "@/components/TourLauncher";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/recruiter-auth" component={RecruiterAuth} />
      <Route path="/candidate-auth" component={CandidateAuth} />
      <Route path="/consultants" component={ConsultantsPage} />
      <Route path="/form/:token" component={PublicFormPage} />
      <Route path="/client-shortlist/:token" component={ClientShortlistPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/terms-of-service" component={TermsOfServicePage} />
      <Route path="/cookie-policy" component={CookiePolicyPage} />
      <Route path="/brand" component={BrandAssetsPage} />
      <Route path="/verify-email/:token" component={VerifyEmailPage} />
      <Route path="/reset-password/:token" component={ResetPasswordPage} />
      <Route path="/recruiters/:id" component={RecruiterProfilePage} />
      <Route path="/jobs" component={JobsPage} />
      <ProtectedRoute path="/jobs/post" component={JobPostPage} requiredRole={['recruiter', 'super_admin']} />
      <ProtectedRoute path="/jobs/:id/applications" component={ApplicationManagementPage} requiredRole={['recruiter', 'super_admin']} />
      <ProtectedRoute path="/jobs/:id/edit" component={JobEditPage} requiredRole={['recruiter', 'super_admin']} />
      <ProtectedRoute path="/jobs/:id/pipeline" component={JobPipelinePage} requiredRole={['recruiter', 'super_admin']} />
      <ProtectedRoute path="/jobs/:id/analytics" component={JobAnalyticsPage} requiredRole={['recruiter', 'super_admin']} />
      <Route path="/jobs/:id" component={JobDetailsPage} />
      <ProtectedRoute path="/my-dashboard" component={CandidateDashboard} requiredRole={['candidate']} />
      <ProtectedRoute path="/recruiter-dashboard" component={RecruiterDashboard} requiredRole={['recruiter', 'super_admin']} />
      <ProtectedRoute path="/hiring-manager" component={HiringManagerDashboard} requiredRole={['hiring_manager']} />
      <ProtectedRoute path="/applications" component={ApplicationsPage} requiredRole={['recruiter', 'super_admin']} />
      <ProtectedRoute path="/candidates" component={CandidatesPage} requiredRole={['recruiter', 'super_admin']} />
      <ProtectedRoute path="/my-jobs" component={MyJobsPage} requiredRole={['recruiter', 'super_admin']} />
      <ProtectedRoute path="/clients" component={ClientsPage} requiredRole={['recruiter', 'super_admin']} />
      <ProtectedRoute path="/profile/settings" component={ProfileSettingsPage} requiredRole={['recruiter', 'super_admin']} />
      <ProtectedRoute path="/admin" component={AdminSuperDashboard} requiredRole={['super_admin']} />
      <Route path="/admin/legacy">{() => <Redirect to="/admin" />}</Route>
      <Route path="/admin/super">{() => <Redirect to="/admin" />}</Route>
      <Route path="/admin/dashboard">{() => <Redirect to="/admin" />}</Route>
      <ProtectedRoute path="/admin/forms/editor/:id?" component={FormEditorPage} requiredRole={['super_admin', 'recruiter']} />
      <ProtectedRoute path="/admin/forms/responses" component={AdminFormResponsesPage} requiredRole={['super_admin']} />
      <ProtectedRoute path="/admin/forms" component={AdminFormsPage} requiredRole={['super_admin', 'recruiter']} />
      <ProtectedRoute path="/admin/email-templates" component={AdminEmailTemplatesPage} requiredRole={['super_admin', 'recruiter']} />
      <ProtectedRoute path="/admin/consultants" component={AdminConsultantsPage} requiredRole={['super_admin']} />
      <ProtectedRoute path="/admin/ai-usage" component={AdminAIUsagePage} requiredRole={['super_admin']} />
      <ProtectedRoute path="/admin/feedback" component={AdminFeedbackPage} requiredRole={['super_admin']} />
      <ProtectedRoute path="/analytics" component={JobAnalyticsDashboard} requiredRole={['recruiter', 'super_admin']} />
      {/* Dev-only UI gallery route */}
      {DevUIGallery && (
        <Route path="/dev/ui-gallery">
          {() => (
            <Suspense fallback={<div className="p-8 text-center">Loading UI Gallery...</div>}>
              <DevUIGallery />
            </Suspense>
          )}
        </Route>
      )}
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
          <TourProvider>
            <Toaster />
            {/* Inject analytics only after consent */}
            <AnalyticsOnConsent />
            <CookieConsent />
            <Router />
            <TourLauncher />
          </TourProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

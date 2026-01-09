import { Step } from "react-joyride";

export type UserRole = "super_admin" | "recruiter" | "candidate" | "hiring_manager";

export interface TourStep extends Step {
  route?: string; // Navigate to this route before showing step
  roles?: UserRole[]; // Only show for these roles (undefined = all roles)
  tourId?: string; // Group steps by tour ID for quick-jump menu
}

export interface TourConfig {
  id: string;
  title: string;
  description: string;
  roles?: UserRole[];
  steps: TourStep[];
}

// Individual tour configurations
export const tourConfigs: TourConfig[] = [
  // ==================== RECRUITER TOURS ====================
  {
    id: "dashboard-overview",
    title: "Recruiter Dashboard",
    description: "Master your recruiting command center",
    roles: ["super_admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="dashboard-metrics"]',
        content: "Your dashboard shows key metrics at a glance: open positions you're managing, candidates actively in your pipeline, applications awaiting review, and recent hiring activity. These update in real-time as you work.",
        disableBeacon: true,
        route: "/recruiter-dashboard",
        tourId: "dashboard-overview",
      },
      {
        target: '[data-tour="stage-funnel"]',
        content: "The hiring funnel visualizes your entire pipeline at once. Each bar represents a stage - click any stage to instantly filter your view to just those candidates. The width shows relative volume, helping you spot bottlenecks.",
        route: "/recruiter-dashboard",
        tourId: "dashboard-overview",
      },
      {
        target: '[data-tour="pipeline-checklist"]',
        content: "AI-powered action checklist prioritizes your next moves. Items are ranked by urgency and impact - overdue reviews, stalled candidates, and scheduling needs bubble to the top. Check items off as you complete them.",
        route: "/recruiter-dashboard",
        tourId: "dashboard-overview",
      },
      {
        target: '[data-tour="recent-activity"]',
        content: "The AI summary analyzes your current pipeline health, highlighting risks like candidates stuck too long in a stage or upcoming SLA deadlines. It adapts based on your active filters.",
        route: "/recruiter-dashboard",
        tourId: "dashboard-overview",
      },
    ],
  },
  {
    id: "applications-management",
    title: "Application Management",
    description: "Review, filter, and manage candidate applications",
    roles: ["super_admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="applications-filters"]',
        content: "Powerful filters help you find exactly who you're looking for. Filter by job, application status, pipeline stage, date range, or combine multiple filters. Your filter selections persist across sessions.",
        disableBeacon: true,
        route: "/applications",
        tourId: "applications-management",
      },
      {
        target: '[data-tour="applications-list"]',
        content: "Each application row shows candidate details, current stage, AI match score, and time in pipeline. Click any row to open the full candidate profile with resume preview, notes, and action buttons.",
        route: "/applications",
        tourId: "applications-management",
      },
      {
        target: '[data-tour="kanban-toggle"]',
        content: "Switch to Kanban board view for a visual pipeline. Drag and drop candidates between stages, see stage counts at a glance, and identify bottlenecks where candidates are piling up.",
        route: "/applications",
        tourId: "applications-management",
      },
      {
        target: '[data-tour="bulk-actions"]',
        content: "Select multiple candidates using checkboxes for bulk actions - move to next stage, send emails, add tags, or reject with a single click. Perfect for processing high-volume applications.",
        route: "/applications",
        tourId: "applications-management",
      },
    ],
  },
  {
    id: "job-management",
    title: "Job Management",
    description: "Create, edit, and manage job postings",
    roles: ["super_admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="post-job-button"]',
        content: "Create a new job posting with our guided wizard. Set job details, requirements, salary range, and customize application questions. Jobs require admin approval before going live.",
        disableBeacon: true,
        route: "/my-jobs",
        tourId: "job-management",
      },
      {
        target: '[data-tour="jobs-list"]',
        content: "View all your job postings with key metrics: application count, candidates in pipeline, average time to fill, and posting status. Active jobs show a green indicator.",
        route: "/my-jobs",
        tourId: "job-management",
      },
      {
        target: '[data-tour="job-actions"]',
        content: "Each job has quick actions: Edit details, view pipeline/analytics, pause applications, close the position, or duplicate as a template. Click the three-dot menu to access all options.",
        route: "/my-jobs",
        tourId: "job-management",
      },
      {
        target: '[data-tour="job-analytics"]',
        content: "Job analytics show application sources, conversion rates through each stage, time-to-fill metrics, and candidate quality scores. Use this data to optimize your job postings.",
        route: "/my-jobs",
        tourId: "job-management",
      },
    ],
  },
  {
    id: "forms-builder",
    title: "Forms & Templates",
    description: "Create custom application forms and email templates",
    roles: ["super_admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="create-form-button"]',
        content: "Build custom forms for any purpose: job applications, candidate intake, reference checks, or interview feedback. Drag-and-drop form builder with multiple field types.",
        disableBeacon: true,
        route: "/admin/forms",
        tourId: "forms-builder",
      },
      {
        target: '[data-tour="forms-list"]',
        content: "Manage all your forms here. See response counts, last submission date, and form status. Edit, duplicate, or archive forms. Link forms to specific jobs for custom applications.",
        route: "/admin/forms",
        tourId: "forms-builder",
      },
      {
        target: '[data-tour="form-responses"]',
        content: "View and export form responses. Filter by date range, search by respondent, and download as CSV for analysis. Responses are linked to candidate profiles when available.",
        route: "/admin/forms",
        tourId: "forms-builder",
      },
    ],
  },
  {
    id: "client-management",
    title: "Client Management",
    description: "Manage client relationships and assignments",
    roles: ["super_admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="add-client-button"]',
        content: "Add new clients to organize your recruiting. Set company details, contact information, and billing preferences. Each client gets their own dashboard view of their jobs.",
        disableBeacon: true,
        route: "/clients",
        tourId: "client-management",
      },
      {
        target: '[data-tour="clients-list"]',
        content: "View all clients with active job counts, candidates in pipeline, and recent activity. Click a client to see their dedicated jobs and candidates. Perfect for agency recruiters.",
        route: "/clients",
        tourId: "client-management",
      },
      {
        target: '[data-tour="client-shortlist"]',
        content: "Create shortlists for clients - curated candidate selections they can review and provide feedback on. Share via secure link without requiring client login.",
        route: "/clients",
        tourId: "client-management",
      },
    ],
  },
  {
    id: "email-templates",
    title: "Email Communication",
    description: "Set up automated and manual email templates",
    roles: ["super_admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="email-templates-list"]',
        content: "Pre-built templates for common emails: application received, interview invitations, rejections, and offers. Each template uses variables like {{candidate_name}} for personalization.",
        disableBeacon: true,
        route: "/admin/email-templates",
        tourId: "email-templates",
      },
      {
        target: '[data-tour="create-template-button"]',
        content: "Create new templates with our rich text editor. Set subject lines, body content, and choose which variables to include. Templates can be triggered manually or automatically.",
        route: "/admin/email-templates",
        tourId: "email-templates",
      },
      {
        target: '[data-tour="email-preview"]',
        content: "Preview how your email will look with sample data. Test send to yourself before activating. Check the audit log to see all sent emails and delivery status.",
        route: "/admin/email-templates",
        tourId: "email-templates",
      },
    ],
  },
  {
    id: "analytics-reporting",
    title: "Analytics & Reporting",
    description: "Track recruiting metrics and team performance",
    roles: ["super_admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="analytics-overview"]',
        content: "The analytics dashboard shows your recruiting performance: time-to-fill, source effectiveness, stage conversion rates, and hiring velocity. Filter by date range and job.",
        disableBeacon: true,
        route: "/analytics",
        tourId: "analytics-reporting",
      },
      {
        target: '[data-tour="source-metrics"]',
        content: "See which sources bring the best candidates. Compare job boards, referrals, and direct applications by volume, quality score, and hire rate. Optimize your sourcing spend.",
        route: "/analytics",
        tourId: "analytics-reporting",
      },
      {
        target: '[data-tour="team-performance"]',
        content: "Track recruiter and hiring manager performance: response times, candidates processed, and interview-to-hire ratios. Identify bottlenecks and coaching opportunities.",
        route: "/analytics",
        tourId: "analytics-reporting",
      },
    ],
  },
  {
    id: "co-recruiter-collaboration",
    title: "Co-Recruiter Collaboration",
    description: "Invite teammates to collaborate on job postings",
    roles: ["super_admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="co-recruiter-panel"]',
        content: "The Co-Recruiters panel lets you invite colleagues to collaborate on this job posting. Co-recruiters get full access to view applications, update candidate stages, and manage the hiring process alongside you.",
        disableBeacon: true,
        tourId: "co-recruiter-collaboration",
      },
      {
        target: '[data-tour="co-recruiter-invite-btn"]',
        content: "Click 'Invite' to add a co-recruiter. Enter their email - if they already have an account, they're added instantly. Otherwise, they'll receive an email invitation to join and collaborate.",
        tourId: "co-recruiter-collaboration",
      },
      {
        target: '[data-tour="co-recruiter-list"]',
        content: "Active co-recruiters are listed here with their role. The primary recruiter (job owner) is marked with a crown. You can remove co-recruiters at any time - they'll lose access to this job's applications.",
        tourId: "co-recruiter-collaboration",
      },
    ],
  },
  {
    id: "hiring-manager-invitations",
    title: "Hiring Manager Invitations",
    description: "Invite hiring managers to review candidates",
    roles: ["super_admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="invite-hiring-manager-btn"]',
        content: "Invite hiring managers to collaborate on candidate reviews. They'll receive an email with a registration link to create their account and access the hiring manager portal.",
        disableBeacon: true,
        route: "/recruiter-dashboard",
        tourId: "hiring-manager-invitations",
      },
      {
        target: '[data-tour="dashboard-metrics"]',
        content: "Once hiring managers join, they can review candidates, provide feedback, and help make hiring decisions. You'll see their activity reflected in your dashboard metrics and pipeline progress.",
        route: "/recruiter-dashboard",
        tourId: "hiring-manager-invitations",
      },
    ],
  },

  // ==================== SUPER ADMIN TOURS ====================
  {
    id: "admin-features",
    title: "Admin Command Center",
    description: "Complete platform control and operations monitoring",
    roles: ["super_admin"],
    steps: [
      {
        target: '[data-tour="admin-stats"]',
        content: "Platform-wide statistics: total jobs across all recruiters, application volume, user counts by role, and system status. These are aggregate metrics for the entire organization.",
        disableBeacon: true,
        route: "/admin",
        tourId: "admin-features",
      },
      {
        target: '[data-tour="admin-tabs"]',
        content: "Seven main sections: Operations (default view with real-time KPIs), Pending Approvals, Jobs, Applications, Users, Analytics, and System Logs. Each gives you full platform visibility.",
        route: "/admin",
        tourId: "admin-features",
      },
      {
        target: '[data-tour="ops-kpis"]',
        content: "Real-time Operations KPIs: hires this period, offers extended, total candidates in active pipelines, and SLA warnings requiring attention. These update automatically every minute.",
        route: "/admin",
        tourId: "admin-features",
      },
      {
        target: '[data-tour="ops-subtabs"]',
        content: "Dive deeper with sub-tabs: Pipeline Funnel shows conversion visualization, SLA tracks response times, Automation monitors email automation, Health shows system status, Quality analyzes rejection patterns, and Clients shows per-client metrics.",
        route: "/admin",
        tourId: "admin-features",
      },
      {
        target: '[data-tour="pending-jobs"]',
        content: "Job moderation queue: Review recruiter-submitted jobs before they go live. Approve with one click, decline with feedback, or request changes. Keeps job quality consistent.",
        route: "/admin",
        tourId: "admin-features",
      },
      {
        target: '[data-tour="user-management"]',
        content: "Full user management: View all accounts, change roles (candidate, recruiter, hiring_manager, super_admin), see activity metrics, and manage permissions. Critical for access control.",
        route: "/admin",
        tourId: "admin-features",
      },
    ],
  },
  {
    id: "admin-automation",
    title: "Automation Settings",
    description: "Configure platform-wide automation rules",
    roles: ["super_admin"],
    steps: [
      {
        target: '[data-tour="ops-subtabs"]',
        content: "Navigate to the Automation sub-tab to manage all automated workflows. See which automations are enabled, their success rates, and recent activity.",
        disableBeacon: true,
        route: "/admin",
        tourId: "admin-automation",
      },
      {
        target: '[data-tour="automation-settings"]',
        content: "Toggle automation rules: auto-send application confirmations, interview reminders, rejection emails, and offer letters. Each can be enabled/disabled independently.",
        route: "/admin",
        tourId: "admin-automation",
      },
      {
        target: '[data-tour="automation-events"]',
        content: "Automation activity log shows every triggered action: success, failure, or skipped (when disabled). Failed automations show error details for troubleshooting.",
        route: "/admin",
        tourId: "admin-automation",
      },
    ],
  },
  {
    id: "admin-system-health",
    title: "System Health Monitoring",
    description: "Monitor email delivery and system status",
    roles: ["super_admin"],
    steps: [
      {
        target: '[data-tour="ops-subtabs"]',
        content: "Navigate to the Health sub-tab to monitor system-wide health metrics and identify issues before they impact users.",
        disableBeacon: true,
        route: "/admin",
        tourId: "admin-system-health",
      },
      {
        target: '[data-tour="email-health"]',
        content: "Email delivery dashboard: sent count, failed count, and success rate. Failed emails are listed with recipient, subject, and error message for quick debugging.",
        route: "/admin",
        tourId: "admin-system-health",
      },
      {
        target: '[data-tour="system-status"]',
        content: "Overall system status indicator and last refresh timestamp. Green = healthy. Automated monitoring alerts you to issues before users report them.",
        route: "/admin",
        tourId: "admin-system-health",
      },
    ],
  },

  // ==================== HIRING MANAGER TOURS ====================
  {
    id: "hiring-manager-portal",
    title: "Hiring Manager Portal",
    description: "Review candidates and provide feedback",
    roles: ["hiring_manager"],
    steps: [
      {
        target: '[data-tour="hm-dashboard"]',
        content: "Your hiring manager dashboard shows candidates awaiting your feedback, upcoming interviews, and recent hiring activity for your jobs. Focus on what needs your attention.",
        disableBeacon: true,
        route: "/hiring-manager",
        tourId: "hiring-manager-portal",
      },
      {
        target: '[data-tour="pending-feedback"]',
        content: "Candidates needing your input are highlighted here. Click to review their profile, interview notes, and provide your hire/no-hire recommendation with detailed feedback.",
        route: "/hiring-manager",
        tourId: "hiring-manager-portal",
      },
      {
        target: '[data-tour="my-jobs"]',
        content: "Jobs you own as hiring manager. See pipeline progress, upcoming interviews, and time-in-stage metrics. You can't edit job postings, but you control hiring decisions.",
        route: "/hiring-manager",
        tourId: "hiring-manager-portal",
      },
      {
        target: '[data-tour="interview-calendar"]',
        content: "Your interview schedule with candidate details. Click any interview to see the candidate profile, job requirements, and suggested questions based on the role.",
        route: "/hiring-manager",
        tourId: "hiring-manager-portal",
      },
    ],
  },

  // ==================== CANDIDATE TOURS ====================
  {
    id: "candidate-portal",
    title: "Candidate Portal",
    description: "Track your applications and find opportunities",
    roles: ["candidate"],
    steps: [
      {
        target: '[data-tour="my-applications"]',
        content: "Track all your job applications in one place. See which stage each application is in, whether it's been viewed, and any scheduled interviews. Updates appear in real-time.",
        disableBeacon: true,
        route: "/my-dashboard",
        tourId: "candidate-portal",
      },
      {
        target: '[data-tour="application-status"]',
        content: "Each application shows its journey: Applied → Under Review → Interview → Offer. The current stage is highlighted. Click for more details including any messages from the recruiter.",
        route: "/my-dashboard",
        tourId: "candidate-portal",
      },
      {
        target: '[data-tour="upcoming-interviews"]',
        content: "Scheduled interviews appear here with date, time, location (or video link), and interviewer details. You'll receive email reminders before each interview.",
        route: "/my-dashboard",
        tourId: "candidate-portal",
      },
      {
        target: '[data-tour="job-search"]',
        content: "Browse open positions that match your profile. Filter by location, job type, salary range, and skills. Save jobs to apply later or apply directly with one click.",
        route: "/jobs",
        tourId: "candidate-portal",
      },
      {
        target: '[data-tour="profile-settings"]',
        content: "Keep your profile updated: resume, skills, work history, and contact preferences. A complete profile helps recruiters find you and speeds up applications.",
        route: "/my-dashboard",
        tourId: "candidate-portal",
      },
    ],
  },
];

// Get full tour (all steps for user's role)
export function getFullTour(userRole?: UserRole): TourStep[] {
  const allSteps: TourStep[] = [];

  tourConfigs.forEach((config) => {
    // Filter by role
    if (config.roles && userRole && !config.roles.includes(userRole)) {
      return;
    }

    config.steps.forEach((step) => {
      // Filter individual steps by role
      if (step.roles && userRole && !step.roles.includes(userRole)) {
        return;
      }
      allSteps.push(step);
    });
  });

  return allSteps;
}

// Get specific tour by ID
export function getTourById(tourId: string, userRole?: UserRole): TourStep[] {
  const config = tourConfigs.find((c) => c.id === tourId);
  if (!config) return [];

  // Check role access
  if (config.roles && userRole && !config.roles.includes(userRole)) {
    return [];
  }

  return config.steps.filter((step) => {
    if (step.roles && userRole && !step.roles.includes(userRole)) {
      return false;
    }
    return true;
  });
}

// Get available tours for a role
export function getAvailableTours(userRole?: UserRole): TourConfig[] {
  return tourConfigs.filter((config) => {
    if (config.roles && userRole && !config.roles.includes(userRole)) {
      return false;
    }
    return true;
  });
}

// Tour storage keys
export const TOUR_STORAGE_KEYS = {
  COMPLETED_TOURS: "vantahire_completed_tours",
  TOUR_DISMISSED: "vantahire_tour_dismissed",
  FIRST_VISIT: "vantahire_first_visit",
};

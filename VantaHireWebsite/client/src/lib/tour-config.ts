import { Step } from "react-joyride";

export type UserRole = "admin" | "recruiter" | "candidate" | "hiring_manager";

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
  {
    id: "dashboard-overview",
    title: "Dashboard Overview",
    description: "Learn about your recruiter dashboard",
    roles: ["admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="dashboard-metrics"]',
        content: "Your dashboard shows key metrics at a glance - open positions, active candidates, pending reviews, and recent activity.",
        disableBeacon: true,
        route: "/recruiter-dashboard",
        tourId: "dashboard-overview",
      },
      {
        target: '[data-tour="stage-funnel"]',
        content: "The stage funnel visualizes your hiring pipeline. Click any stage to filter and view candidates at that stage.",
        route: "/recruiter-dashboard",
        tourId: "dashboard-overview",
      },
      {
        target: '[data-tour="recent-activity"]',
        content: "Recent activity shows the latest updates across all your job postings - new applications, status changes, and more.",
        route: "/recruiter-dashboard",
        tourId: "dashboard-overview",
      },
      {
        target: '[data-tour="quick-actions"]',
        content: "Quick actions let you jump to common tasks like posting a new job, reviewing applications, or managing candidates.",
        route: "/recruiter-dashboard",
        tourId: "dashboard-overview",
      },
    ],
  },
  {
    id: "applications-management",
    title: "Managing Applications",
    description: "Learn to review and manage candidate applications",
    roles: ["admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="applications-filters"]',
        content: "Use filters to narrow down applications by job, status, stage, or date range.",
        disableBeacon: true,
        route: "/applications",
        tourId: "applications-management",
      },
      {
        target: '[data-tour="applications-list"]',
        content: "The applications list shows all candidates. Click any row to view detailed information and take action.",
        route: "/applications",
        tourId: "applications-management",
      },
      {
        target: '[data-tour="kanban-toggle"]',
        content: "Switch between list and Kanban board view to visualize your pipeline stages.",
        route: "/applications",
        tourId: "applications-management",
      },
    ],
  },
  {
    id: "job-management",
    title: "Job Management",
    description: "Create and manage job postings",
    roles: ["admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="post-job-button"]',
        content: "Click here to create a new job posting. You can set requirements, salary ranges, and application questions.",
        disableBeacon: true,
        route: "/my-jobs",
        tourId: "job-management",
      },
      {
        target: '[data-tour="jobs-list"]',
        content: "View all your job postings here. Each card shows key metrics like application count and status.",
        route: "/my-jobs",
        tourId: "job-management",
      },
      {
        target: '[data-tour="job-actions"]',
        content: "Use the actions menu to edit, pause, close, or view applications for any job.",
        route: "/my-jobs",
        tourId: "job-management",
      },
    ],
  },
  {
    id: "forms-builder",
    title: "Forms Builder",
    description: "Create custom application forms",
    roles: ["admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="create-form-button"]',
        content: "Create custom forms for job applications, candidate intake, or feedback collection.",
        disableBeacon: true,
        route: "/admin/forms",
        tourId: "forms-builder",
      },
      {
        target: '[data-tour="forms-list"]',
        content: "Manage your existing forms here. View responses, edit forms, or duplicate templates.",
        route: "/admin/forms",
        tourId: "forms-builder",
      },
    ],
  },
  {
    id: "client-management",
    title: "Client Management",
    description: "Manage client relationships",
    roles: ["admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="add-client-button"]',
        content: "Add new clients to organize your job postings and track relationships.",
        disableBeacon: true,
        route: "/clients",
        tourId: "client-management",
      },
      {
        target: '[data-tour="clients-list"]',
        content: "View all your clients with their associated jobs and key contacts.",
        route: "/clients",
        tourId: "client-management",
      },
    ],
  },
  {
    id: "email-templates",
    title: "Email Templates",
    description: "Set up automated email communications",
    roles: ["admin", "recruiter"],
    steps: [
      {
        target: '[data-tour="email-templates-list"]',
        content: "Email templates help you send consistent, professional communications to candidates.",
        disableBeacon: true,
        route: "/admin/email-templates",
        tourId: "email-templates",
      },
      {
        target: '[data-tour="create-template-button"]',
        content: "Create new templates for interview invitations, rejections, offers, and more.",
        route: "/admin/email-templates",
        tourId: "email-templates",
      },
    ],
  },
  {
    id: "admin-features",
    title: "Admin Features",
    description: "Advanced administrative controls",
    roles: ["admin"],
    steps: [
      {
        target: '[data-tour="admin-control-center"]',
        content: "The Admin Control Center gives you access to user management, system settings, and advanced configurations.",
        disableBeacon: true,
        route: "/admin",
        tourId: "admin-features",
      },
      {
        target: '[data-tour="user-management"]',
        content: "Manage user accounts, assign roles, and control permissions across your organization.",
        route: "/admin",
        tourId: "admin-features",
      },
    ],
  },
  {
    id: "candidate-portal",
    title: "Candidate Portal",
    description: "Navigate your candidate dashboard",
    roles: ["candidate"],
    steps: [
      {
        target: '[data-tour="my-applications"]',
        content: "Track all your job applications here. See status updates and next steps for each application.",
        disableBeacon: true,
        route: "/my-applications",
        tourId: "candidate-portal",
      },
      {
        target: '[data-tour="application-status"]',
        content: "Each application shows its current stage - Applied, Under Review, Interview, Offer, etc.",
        route: "/my-applications",
        tourId: "candidate-portal",
      },
      {
        target: '[data-tour="job-search"]',
        content: "Browse and search for new job opportunities that match your skills and interests.",
        route: "/jobs",
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

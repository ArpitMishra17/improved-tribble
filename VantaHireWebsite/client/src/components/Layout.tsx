import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAIFeatures } from "@/hooks/use-ai-features";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Menu, X, User, LogOut, Briefcase, Plus, ChevronDown, Settings, BarChart3, Shield, TestTube, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import Footer from "@/components/Footer";
import QuickAccessBar from "@/components/QuickAccessBar";
import FloatingActionButton from "@/components/FloatingActionButton";
import type { User as SelectUser } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { resumeAdvisor, fitScoring } = useAIFeatures();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Type guard to help TypeScript narrow the user type
  const isRecruiter = user?.role === 'recruiter';
  const isAdmin = user?.role === 'admin';
  const isCandidate = user?.role === 'candidate';
  const isHiringManager = user?.role === 'hiring_manager';
  const displayName = user?.firstName || user?.username || 'User';
  const aiEnabled = resumeAdvisor || fitScoring;

  // Get role display label
  const getRoleLabel = (role: string | undefined) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'recruiter': return 'Recruiter';
      case 'hiring_manager': return 'Hiring Manager';
      case 'candidate': return 'Candidate';
      default: return null;
    }
  };

  // ATS context detection - determines if we should use light ATS theme
  const atsUser = isRecruiter || isAdmin;

  const isAtsRoute = (path: string): boolean => {
    const atsRoutes = [
      '/recruiter-dashboard',
      '/applications',
      '/my-jobs',
      '/jobs/post',
      '/admin',
      '/analytics',
      '/clients',
    ];

    // Check exact matches first
    if (atsRoutes.some(route => path === route || path.startsWith(route + '/'))) {
      return true;
    }

    // Check for job applications route pattern: /jobs/:id/applications
    if (path.match(/^\/jobs\/\d+\/applications/)) {
      return true;
    }

    return false;
  };

  const atsContext = atsUser && isAtsRoute(location);

  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isJobsRoute = location.startsWith('/jobs') || location === '/auth';

  return (
    <div className={cn(
      "min-h-screen",
      atsContext
        ? "ats-theme bg-slate-50 text-slate-900"
        : "bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
    )}>
      {/* Quick Access Bar for authenticated users (not in ATS context) */}
      {user && !atsContext && <QuickAccessBar />}

      {/* ATS Header - Light theme for recruiter/admin dashboards */}
      {atsContext && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200/80 shadow-sm">
          <nav className="container mx-auto px-4 py-3 flex items-center justify-between">
            {/* Logo */}
            <div className="text-xl font-bold">
              <Link
                href="/"
                className="text-primary font-extrabold tracking-wide hover:text-primary/80 transition-colors"
              >
                VantaHire
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {(isRecruiter || isAdmin) && (
                <>
                  <Link
                    href="/recruiter-dashboard"
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      location === '/recruiter-dashboard'
                        ? "text-primary bg-primary/5"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/applications"
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      location === '/applications'
                        ? "text-primary bg-primary/5"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    Applications
                  </Link>
                  <Link
                    href="/my-jobs"
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      location === '/my-jobs'
                        ? "text-primary bg-primary/5"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    My Jobs
                  </Link>
                  <Link
                    href="/admin/forms"
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      location.startsWith('/admin/forms')
                        ? "text-primary bg-primary/5"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    Forms
                  </Link>
                  <Link
                    href="/clients"
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      location.startsWith('/clients')
                        ? "text-primary bg-primary/5"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    Clients
                  </Link>
                  <Link
                    href="/admin/email-templates"
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      location.startsWith('/admin/email-templates')
                        ? "text-primary bg-primary/5"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    Email
                  </Link>
                </>
              )}
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-3">
              {/* Post Job CTA */}
              {(isRecruiter || isAdmin) && (
                <Button
                  onClick={() => setLocation("/jobs/post")}
                  size="sm"
                  className="hidden md:flex"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Post Job
                </Button>
              )}

              {/* Role Badge - visible next to username */}
              {getRoleLabel(user?.role) && (
                <Badge variant="outline" className="text-xs capitalize border-slate-300 text-slate-600 hidden sm:inline-flex">
                  {getRoleLabel(user?.role)}
                </Badge>
              )}

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{displayName}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white">
                  <div className="px-2 py-1.5 text-sm font-medium text-slate-900">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="px-2 py-1 text-xs text-slate-500">
                    @{user?.username}
                  </div>
                  <div className="px-2 py-1.5 flex items-center gap-2">
                    {getRoleLabel(user?.role) && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {getRoleLabel(user?.role)}
                      </Badge>
                    )}
                    {aiEnabled && (
                      <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-100">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI Beta
                      </Badge>
                    )}
                  </div>
                  <DropdownMenuSeparator />

                  {isAdmin && (
                    <>
                      <DropdownMenuItem onClick={() => setLocation("/admin")} className="cursor-pointer">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin Control Center
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation("/admin/super")} className="cursor-pointer">
                        <Settings className="h-4 w-4 mr-2" />
                        Super Admin Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation("/admin/testing")} className="cursor-pointer">
                        <TestTube className="h-4 w-4 mr-2" />
                        Testing Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation("/analytics")} className="cursor-pointer">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Job Analytics
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>
        </header>
      )}

      {/* Header (for public pages or as fallback) */}
      {!user && (
        <header className={`fixed top-0 left-0 right-0 transition-all duration-500 z-50
          ${scrollPosition > 50
            ? 'bg-gradient-to-r from-[#1E0B40]/90 to-[#2D1B69]/90 backdrop-blur-lg shadow-lg py-3 border-b border-white/5'
            : 'py-6'}`}
        >
        {/* Premium background glow effects */}
        <div className={`absolute inset-0 -z-10 transition-opacity duration-700 ${scrollPosition > 50 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute left-1/4 w-48 h-12 bg-[#7B38FB]/10 rounded-full blur-[50px] animate-pulse-slow"></div>
          <div className="absolute right-1/4 w-48 h-12 bg-[#2D81FF]/10 rounded-full blur-[50px] animate-pulse-slow" 
               style={{ animationDelay: '1.2s' }}></div>
        </div>
        
        {/* Bottom accent line */}
        <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#7B38FB]/40 to-transparent animate-shine 
                        transition-opacity duration-500 ${scrollPosition > 50 ? 'opacity-100' : 'opacity-0'}`}>
        </div>
        
        <nav className="container mx-auto px-4 flex items-center justify-between">
          {/* Logo */}
          <div className="text-2xl font-bold relative group">
            <Link 
              href="/" 
              className="animate-gradient-text font-extrabold tracking-wide"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              VantaHire
            </Link>
            <div className="absolute -inset-1 rounded-full blur-md bg-gradient-to-r from-[#7B38FB]/0 via-[#7B38FB]/0 to-[#FF5BA8]/0 
                          group-hover:from-[#7B38FB]/10 group-hover:via-[#7B38FB]/20 group-hover:to-[#FF5BA8]/10 
                          opacity-0 group-hover:opacity-100 transition-all duration-700 -z-10"></div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {isJobsRoute ? (
              <>
                <a 
                  href="/jobs" 
                  className={`relative px-3 py-2 hover:text-white transition-all duration-300 overflow-hidden group ${
                    location === "/jobs" ? 'text-white font-medium' : 'text-white/70'
                  }`}
                  onClick={(e) => { e.preventDefault(); setLocation("/jobs"); }}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Jobs
                  </span>
                  <span 
                    className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] w-full transform origin-left transition-transform duration-300 
                              ${location === "/jobs" ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
                  ></span>
                </a>

                {user && (isRecruiter || isAdmin) && (
                  <a
                    href="/jobs/post"
                    className={`relative px-3 py-2 hover:text-white transition-all duration-300 overflow-hidden group ${
                      location === "/jobs/post" ? 'text-white font-medium' : 'text-white/70'
                    }`}
                    onClick={(e) => { e.preventDefault(); setLocation("/jobs/post"); }}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Post Job
                    </span>
                    <span
                      className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] w-full transform origin-left transition-transform duration-300
                                ${location === "/jobs/post" ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
                    ></span>
                  </a>
                )}
              </>
            ) : (
              <>
                <a 
                  href="/#about" 
                  className="relative px-3 py-2 hover:text-white transition-all duration-300 overflow-hidden group text-white/70"
                  onClick={(e) => {
                    e.preventDefault();
                    if (window.location.pathname === '/') {
                      document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
                    } else {
                      window.location.href = '/#about';
                    }
                  }}
                >
                  <span className="relative z-10">About</span>
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] w-full transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></span>
                </a>
                
                <a 
                  href="/#services" 
                  className="relative px-3 py-2 hover:text-white transition-all duration-300 overflow-hidden group text-white/70"
                  onClick={(e) => {
                    e.preventDefault();
                    if (window.location.pathname === '/') {
                      document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
                    } else {
                      window.location.href = '/#services';
                    }
                  }}
                >
                  <span className="relative z-10">Services</span>
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] w-full transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></span>
                </a>

                <a
                  href="/jobs"
                  className="relative px-3 py-2 hover:text-white transition-all duration-300 overflow-hidden group text-white/70"
                  onClick={(e) => { e.preventDefault(); setLocation("/jobs"); }}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Jobs
                  </span>
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] w-full transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></span>
                </a>

                <a
                  href="/consultants"
                  className="relative px-3 py-2 hover:text-white transition-all duration-300 overflow-hidden group text-white/70"
                  onClick={(e) => { e.preventDefault(); setLocation("/consultants"); }}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Consultants
                  </span>
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] w-full transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></span>
                </a>
              </>
            )}


            {/* User Actions */}
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-white/70 text-sm">
                  Welcome, {displayName}
                </span>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <a 
                  href="/candidate-auth" 
                  className="relative px-3 py-2 hover:text-white transition-all duration-300 overflow-hidden group text-white/70"
                  onClick={(e) => { e.preventDefault(); setLocation("/candidate-auth"); }}
                >
                  <span className="relative z-10">Job Seekers</span>
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] w-full transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></span>
                </a>
                <a 
                  href="/recruiter-auth" 
                  className="relative px-3 py-2 hover:text-white transition-all duration-300 overflow-hidden group text-white/70"
                  onClick={(e) => { e.preventDefault(); setLocation("/recruiter-auth"); }}
                >
                  <span className="relative z-10">Recruiters</span>
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] w-full transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></span>
                </a>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              onClick={toggleMenu}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </nav>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 p-6 transition-all duration-500 flex flex-col" style={{ backgroundColor: '#0A0A0F' }}>
            <div className="flex justify-between items-center mb-8">
              <div className="text-2xl font-bold">
                <Link 
                  href="/" 
                  className="animate-gradient-text font-extrabold"
                  onClick={() => {
                    setIsMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  VantaHire
                </Link>
              </div>
              <button
                onClick={toggleMenu}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex flex-col space-y-6">
              {isJobsRoute ? (
                <>
                  <a 
                    href="/jobs" 
                    className="text-xl relative px-2 py-1 text-white transition-all duration-300 border-l-2 pl-4 border-transparent hover:border-[#7B38FB]"
                    onClick={(e) => { e.preventDefault(); setLocation("/jobs"); setIsMenuOpen(false); }}
                  >
                    Jobs
                  </a>
                  {user && (isRecruiter || isAdmin) && (
                    <a 
                      href="/jobs/post" 
                      className="text-xl relative px-2 py-1 text-white transition-all duration-300 border-l-2 pl-4 border-transparent hover:border-[#7B38FB]"
                      onClick={(e) => { e.preventDefault(); setLocation("/jobs/post"); setIsMenuOpen(false); }}
                    >
                      Post Job
                    </a>
                  )}
                </>
              ) : (
                <>
                  <a 
                    href="/#about" 
                    className="text-xl relative px-2 py-1 text-white transition-all duration-300 border-l-2 pl-4 border-transparent hover:border-[#7B38FB]"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMenuOpen(false);
                      if (window.location.pathname === '/') {
                        document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
                      } else {
                        window.location.href = '/#about';
                      }
                    }}
                  >
                    About
                  </a>
                  <a 
                    href="/#services" 
                    className="text-xl relative px-2 py-1 text-white transition-all duration-300 border-l-2 pl-4 border-transparent hover:border-[#7B38FB]"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMenuOpen(false);
                      if (window.location.pathname === '/') {
                        document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
                      } else {
                        window.location.href = '/#services';
                      }
                    }}
                  >
                    Services
                  </a>
                  <a 
                    href="/jobs" 
                    className="text-xl relative px-2 py-1 text-white transition-all duration-300 border-l-2 pl-4 border-transparent hover:border-[#7B38FB]"
                    onClick={(e) => { e.preventDefault(); setLocation("/jobs"); setIsMenuOpen(false); }}
                  >
                    Jobs
                  </a>
                </>
              )}
              

              {user ? (
                <Button
                  onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  Logout
                </Button>
              ) : (
                <div className="space-y-6">
                  <a 
                    href="/candidate-auth" 
                    className="text-xl relative px-2 py-1 text-white transition-all duration-300 border-l-2 pl-4 border-transparent hover:border-[#7B38FB]"
                    onClick={(e) => { e.preventDefault(); setLocation("/candidate-auth"); setIsMenuOpen(false); }}
                  >
                    Job Seekers
                  </a>
                  <a 
                    href="/recruiter-auth" 
                    className="text-xl relative px-2 py-1 text-white transition-all duration-300 border-l-2 pl-4 border-transparent hover:border-[#7B38FB]"
                    onClick={(e) => { e.preventDefault(); setLocation("/recruiter-auth"); setIsMenuOpen(false); }}
                  >
                    Recruiters
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
      )}

      {/* Main Content */}
      <main className={user ? "pt-20" : "pt-20"}>
        {children}
      </main>

      {/* Floating Action Button */}
      {user && <FloatingActionButton />}

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Layout;

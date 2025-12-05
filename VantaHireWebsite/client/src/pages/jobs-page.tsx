import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Helmet } from "react-helmet-async";
import { Search, MapPin, Clock, Filter, Briefcase, ArrowUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Job } from "@shared/schema";
import Layout from "@/components/Layout";
import { FilterPanel, MobileFilterSheet } from "@/components/FilterPanel";

interface JobsResponse {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function JobsPage() {
  const searchParams = new URLSearchParams(useSearch());
  const [, setUrlLocation] = useLocation();
  const queryClient = useQueryClient();

  // Initialize state from URL params
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1", 10));
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [location, setLocationFilter] = useState(searchParams.get("location") || "");
  const [type, setType] = useState(searchParams.get("type") || "all");
  const [skills, setSkills] = useState(searchParams.get("skills") || "");
  const [sortBy, setSortBy] = useState<string>(searchParams.get("sortBy") || "recent");
  const [isVisible, setIsVisible] = useState(false);

  // Fade-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Fetch AI feature flag
  const { data: aiFeatures } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/features/ai"],
    queryFn: async () => {
      const response = await fetch("/api/features/ai");
      if (!response.ok) return { enabled: false };
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch jobs from API (server only supports: search, location, type, skills)
  const { data, isLoading, error } = useQuery<JobsResponse>({
    queryKey: ["/api/jobs", { page, search, location, type, skills }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      if (search) params.set("search", search);
      if (location) params.set("location", location);
      if (type && type !== "all") params.set("type", type);
      if (skills) params.set("skills", skills);

      const response = await fetch(`/api/jobs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch jobs");
      return response.json();
    },
  });

  // Client-side sorting (server doesn't support sortBy yet)
  const sortedJobs = useMemo(() => {
    if (!data?.jobs) return [];

    const jobs = [...data.jobs];

    switch (sortBy) {
      case "recent":
        return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "deadline":
        return jobs.sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
      case "relevant":
      default:
        return jobs;
    }
  }, [data?.jobs, sortBy]);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (location) params.set("location", location);
    if (type && type !== "all") params.set("type", type);
    if (skills) params.set("skills", skills);
    if (sortBy && sortBy !== "recent") params.set("sortBy", sortBy);
    if (page > 1) params.set("page", page.toString());

    const queryString = params.toString();
    setUrlLocation(`/jobs${queryString ? `?${queryString}` : ''}`, { replace: true });
  }, [search, location, type, skills, sortBy, page, setUrlLocation]);

  // Scroll to top on pagination change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const handleApplyFilters = () => {
    setPage(1); // Reset to first page when applying filters
  };

  const handleResetFilters = () => {
    setSearch("");
    setLocationFilter("");
    setType("all");
    setSkills("");
    setSortBy("recent");
    setPage(1);
  };

  const handleJobCardHover = (jobId: number) => {
    queryClient.prefetchQuery({
      queryKey: ["/api/jobs", jobId.toString()],
      queryFn: async () => {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) throw new Error("Failed to fetch job");
        return response.json();
      },
    });
  };

  // Count active filters (excluding page and default sort)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (location) count++;
    if (type && type !== "all") count++;
    if (skills) count++;
    return count;
  }, [search, location, type, skills]);

  // Generate dynamic meta tags based on filters and results
  const metaData = useMemo(() => {
    const baseUrl = window.location.origin;
    const count = data?.pagination.total || 0;

    // Build title with filters
    let title = "Find Jobs";
    if (location) title += ` in ${location}`;
    if (type && type !== "all") {
      const typeLabel = type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      title += ` - ${typeLabel}`;
    }
    title += " | VantaHire";

    // Build description
    let description = `Browse ${count} open roles across IT, Telecom, Automotive, Fintech, Healthcare.`;
    if (location) description += ` Find opportunities in ${location}.`;
    if (search) description += ` Search: ${search}.`;
    description += " AI-powered matching with specialist recruiters.";

    // Build canonical URL with query params (include all active filters)
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (location) params.set("location", location);
    if (type && type !== "all") params.set("type", type);
    if (skills) params.set("skills", skills);
    if (sortBy && sortBy !== "recent") params.set("sortBy", sortBy);
    if (page > 1) params.set("page", page.toString());

    const canonicalUrl = `${baseUrl}/jobs${params.toString() ? `?${params.toString()}` : ''}`;

    return { title, description, canonicalUrl, baseUrl };
  }, [location, type, search, skills, sortBy, page, data?.pagination.total]);

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Layout>
      <Helmet>
        <title>{metaData.title}</title>
        <meta name="description" content={metaData.description} />
        <link rel="canonical" href={metaData.canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:title" content={metaData.title} />
        <meta property="og:description" content={metaData.description} />
        <meta property="og:url" content={metaData.canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${metaData.baseUrl}/og-image.jpg`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaData.title} />
        <meta name="twitter:description" content={metaData.description} />
        <meta name="twitter:image" content={`${metaData.baseUrl}/twitter-image.jpg`} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Premium background effects */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1.2s' }}></div>
        
        <div className={`container mx-auto px-4 py-8 relative z-10 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          {/* Premium Header */}
          <div className="text-center mb-12 pt-16">
            <div className="w-20 h-1.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] rounded-full mx-auto mb-6 animate-slide-right"></div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              <span className="animate-gradient-text">Find Your Next</span>
              <br />
              <span className="text-white">Dream Opportunity</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.3s' }}>
              Discover exciting career opportunities with leading companies powered by AI-driven matching
            </p>
          </div>

          {/* Two-column layout: Filters + Results */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
            {/* Left Sidebar - Desktop Only */}
            <aside className="hidden lg:block">
              <FilterPanel
                search={search}
                setSearch={setSearch}
                location={location}
                setLocation={setLocationFilter}
                type={type}
                setType={setType}
                skills={skills}
                setSkills={setSkills}
                onApplyFilters={handleApplyFilters}
                onResetFilters={handleResetFilters}
              />
            </aside>

            {/* Main Content */}
            <main>
              {/* Mobile Filter + Sort Bar */}
              <div className="flex items-center justify-between mb-6 gap-4">
                <div className="lg:hidden flex items-center gap-2">
                  <MobileFilterSheet
                    search={search}
                    setSearch={setSearch}
                    location={location}
                    setLocation={setLocationFilter}
                    type={type}
                    setType={setType}
                    skills={skills}
                    setSkills={setSkills}
                    onApplyFilters={handleApplyFilters}
                    onResetFilters={handleResetFilters}
                  />
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                      {activeFilterCount}
                    </Badge>
                  )}
                </div>

                {/* Sort Dropdown + Reset */}
                <div className="flex items-center gap-2 ml-auto">
                  <ArrowUpDown className="h-4 w-4 text-gray-400" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px] bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Most Recent</SelectItem>
                      <SelectItem value="deadline">Deadline: Soonest</SelectItem>
                      {aiFeatures?.enabled && (
                        <SelectItem value="relevant">Most Relevant (AI)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetFilters}
                      className="text-gray-400 hover:text-white hover:bg-white/10"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Active Filter Chips */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {search && (
                    <Badge variant="secondary" className="bg-white/10 text-white gap-1">
                      Search: {search}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-red-400"
                        onClick={() => setSearch("")}
                      />
                    </Badge>
                  )}
                  {location && (
                    <Badge variant="secondary" className="bg-white/10 text-white gap-1">
                      Location: {location}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-red-400"
                        onClick={() => setLocationFilter("")}
                      />
                    </Badge>
                  )}
                  {type && type !== "all" && (
                    <Badge variant="secondary" className="bg-white/10 text-white gap-1">
                      Type: {type.replace('-', ' ')}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-red-400"
                        onClick={() => setType("all")}
                      />
                    </Badge>
                  )}
                  {skills && (
                    <Badge variant="secondary" className="bg-white/10 text-white gap-1">
                      Skills: {skills}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-red-400"
                        onClick={() => setSkills("")}
                      />
                    </Badge>
                  )}
                </div>
              )}

              {/* Results */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto"></div>
            <p className="text-white mt-4">Loading jobs...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">Error loading jobs. Please try again.</p>
          </div>
        ) : data?.jobs.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-white text-xl mb-2">No jobs found</p>
            <p className="text-gray-400">Try adjusting your search criteria</p>
          </div>
        ) : (
          <>
            {/* Job Count */}
            <div className="mb-6">
              <p className="text-white">
                Showing {sortedJobs.length} of {data?.pagination.total} jobs
                {sortBy !== "recent" && <span className="text-gray-400 ml-2">(sorted by {sortBy === "deadline" ? "deadline" : "AI relevance"})</span>}
              </p>
            </div>

            {/* Job Cards */}
            <div className="grid gap-6 mb-8">
              {sortedJobs.map((job) => (
                <Card
                  key={job.id}
                  data-testid="job-card"
                  className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-all duration-300"
                  onMouseEnter={() => handleJobCardHover(job.id)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-white text-xl mb-2">
                          <Link href={`/jobs/${job.id}`} className="hover:text-purple-400 transition-colors">
                            {job.title}
                          </Link>
                        </CardTitle>
                        <CardDescription className="text-gray-300 flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {job.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Posted {formatDate(job.createdAt)}
                          </span>
                        </CardDescription>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className="bg-purple-500/20 text-purple-300 border-purple-500/30"
                      >
                        {job.type.replace('-', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-300 mb-4 line-clamp-3">
                      {job.description.substring(0, 200)}...
                    </p>
                    
                    {job.skills && job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {job.skills.slice(0, 5).map((skill, index) => (
                          <Badge key={index} variant="outline" className="text-xs border-blue-400/50 text-blue-300">
                            {skill}
                          </Badge>
                        ))}
                        {job.skills.length > 5 && (
                          <Badge variant="outline" className="text-xs border-gray-400/50 text-gray-300">
                            +{job.skills.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      {job.deadline && (
                        <p className="text-sm text-gray-400">
                          Deadline: {formatDate(job.deadline)}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Link href={`/jobs/${job.id}`}>
                          <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Previous
                </Button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        onClick={() => setPage(pageNum)}
                        className={page === pageNum 
                          ? "bg-gradient-to-r from-purple-500 to-blue-500" 
                          : "border-white/20 text-white hover:bg-white/10"
                        }
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={page === data.pagination.totalPages}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
            </main>
          </div>
        </div>
      </div>
    </Layout>
  );
}

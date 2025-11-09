import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Mail, Briefcase, Clock } from "lucide-react";

interface ApplicationItem {
  id: number;
  name: string;
  email: string;
  jobTitle?: string;
  appliedAt: Date | string;
  status?: string;
}

interface RecentApplicationsListProps {
  title: string;
  description?: string;
  applications: ApplicationItem[];
  limit?: number;
  isLoading?: boolean;
  onApplicationClick?: (id: number) => void;
}

export function RecentApplicationsList({
  title,
  description,
  applications,
  limit = 5,
  isLoading,
  onApplicationClick,
}: RecentApplicationsListProps) {
  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">{title}</CardTitle>
          {description && <CardDescription className="text-slate-400">{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                <Skeleton className="h-10 w-10 rounded-full bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 bg-slate-700" />
                  <Skeleton className="h-3 w-48 bg-slate-700" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedApps = applications.slice(0, limit);

  if (displayedApps.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">{title}</CardTitle>
          {description && <CardDescription className="text-slate-400">{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <p className="text-slate-500">No applications yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">{title}</CardTitle>
        {description && <CardDescription className="text-slate-400">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayedApps.map((app) => {
            const appliedDate = typeof app.appliedAt === 'string' ? new Date(app.appliedAt) : app.appliedAt;
            const timeAgo = formatDistanceToNow(appliedDate, { addSuffix: true });

            return (
              <div
                key={app.id}
                className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => onApplicationClick?.(app.id)}
              >
                <div className="bg-purple-500/20 p-2 rounded-full">
                  <Mail className="w-5 h-5 text-purple-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{app.name}</p>
                      <p className="text-slate-400 text-sm truncate">{app.email}</p>
                    </div>
                    {app.status && (
                      <Badge variant="outline" className="text-xs border-blue-400/50 text-blue-300">
                        {app.status}
                      </Badge>
                    )}
                  </div>
                  {app.jobTitle && (
                    <div className="flex items-center gap-1 mt-1 text-slate-500 text-xs">
                      <Briefcase className="w-3 h-3" />
                      <span className="truncate">{app.jobTitle}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-slate-500 text-xs">
                    <Clock className="w-3 h-3" />
                    <span>{timeAgo}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {applications.length > limit && (
          <p className="text-center text-slate-500 text-sm mt-3">
            Showing {limit} of {applications.length} applications
          </p>
        )}
      </CardContent>
    </Card>
  );
}

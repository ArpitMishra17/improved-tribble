import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Application, PipelineStage } from "@shared/schema";
import { ApplicationCard } from "./ApplicationCard";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface StageColumnProps {
  stage: PipelineStage;
  applications: Application[];
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onOpenDetails: (application: Application) => void;
  pipelineStages?: PipelineStage[] | undefined;
  onQuickMoveStage?: ((applicationId: number, stageId: number) => void) | undefined;
  onQuickEmail?: ((applicationId: number) => void) | undefined;
  onQuickInterview?: ((applicationId: number) => void) | undefined;
  onQuickDownload?: ((applicationId: number) => void) | undefined;
}

// Categorize applications into sub-sections
function categorizeApplications(applications: Application[]) {
  const active: Application[] = [];
  const advanced: Application[] = [];
  const archived: Application[] = [];

  applications.forEach(app => {
    // Archived: rejected or explicitly marked
    if (app.status === 'rejected') {
      archived.push(app);
    }
    // Advanced: shortlisted or downloaded (showing strong interest)
    else if (app.status === 'shortlisted' || app.status === 'downloaded') {
      advanced.push(app);
    }
    // Active: submitted, reviewed, or any other active status
    else {
      active.push(app);
    }
  });

  return { active, advanced, archived };
}

// Sub-section component
function SubSection({
  label,
  applications,
  selectedIds,
  onToggleSelect,
  onOpenDetails,
  pipelineStages,
  onQuickMoveStage,
  onQuickEmail,
  onQuickInterview,
  onQuickDownload,
  colorClass,
  defaultExpanded = true,
}: {
  label: string;
  applications: Application[];
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onOpenDetails: (application: Application) => void;
  pipelineStages?: PipelineStage[] | undefined;
  onQuickMoveStage?: ((applicationId: number, stageId: number) => void) | undefined;
  onQuickEmail?: ((applicationId: number) => void) | undefined;
  onQuickInterview?: ((applicationId: number) => void) | undefined;
  onQuickDownload?: ((applicationId: number) => void) | undefined;
  colorClass: string;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (applications.length === 0) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-colors",
          colorClass
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span>{label}</span>
        <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0 h-5">
          {applications.length}
        </Badge>
      </button>
      {isExpanded && (
        <div className="mt-1.5 space-y-2">
          {applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              isSelected={selectedIds.includes(application.id)}
              onToggleSelect={onToggleSelect}
              onOpenDetails={onOpenDetails}
              pipelineStages={pipelineStages}
              onQuickMoveStage={onQuickMoveStage}
              onQuickEmail={onQuickEmail}
              onQuickInterview={onQuickInterview}
              onQuickDownload={onQuickDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StageColumn({
  stage,
  applications,
  selectedIds,
  onToggleSelect,
  onOpenDetails,
  pipelineStages = [],
  onQuickMoveStage,
  onQuickEmail,
  onQuickInterview,
  onQuickDownload,
}: StageColumnProps) {
  // Make Unassigned column (id === 0) read-only - server requires positive stageId
  const isUnassigned = stage.id === 0;

  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: {
      type: "stage",
      stageId: stage.id,
    },
    disabled: isUnassigned,
  });

  // Categorize applications into sub-sections
  const { active, advanced, archived } = categorizeApplications(applications);
  const hasMultipleCategories = [active, advanced, archived].filter(arr => arr.length > 0).length > 1;

  return (
    <div className="flex flex-col h-full">
      <Card
        className={cn(
          "flex flex-col h-full",
          isOver && !isUnassigned && "ring-2 ring-primary/60",
          isUnassigned && "opacity-75"
        )}
      >
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-900 text-base font-semibold flex items-center gap-2">
              {stage.name}
              {isUnassigned && (
                <span className="text-xs text-slate-500 font-normal">(read-only)</span>
              )}
            </CardTitle>
            <Badge
              variant="secondary"
              className="bg-slate-100 text-slate-700 border-slate-200"
            >
              {applications.length}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto min-h-[200px] p-3">
          <div ref={setNodeRef} className="min-h-full">
            {applications.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                No applications
              </div>
            ) : hasMultipleCategories ? (
              // Show sub-sections when there are multiple categories
              <>
                <SubSection
                  label="Active"
                  applications={active}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                  onOpenDetails={onOpenDetails}
                  pipelineStages={pipelineStages}
                  onQuickMoveStage={onQuickMoveStage}
                  onQuickEmail={onQuickEmail}
                  onQuickInterview={onQuickInterview}
                  onQuickDownload={onQuickDownload}
                  colorClass="bg-blue-50 text-blue-700 hover:bg-blue-100"
                />
                <SubSection
                  label="Advanced"
                  applications={advanced}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                  onOpenDetails={onOpenDetails}
                  pipelineStages={pipelineStages}
                  onQuickMoveStage={onQuickMoveStage}
                  onQuickEmail={onQuickEmail}
                  onQuickInterview={onQuickInterview}
                  onQuickDownload={onQuickDownload}
                  colorClass="bg-green-50 text-green-700 hover:bg-green-100"
                />
                <SubSection
                  label="Archived"
                  applications={archived}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                  onOpenDetails={onOpenDetails}
                  pipelineStages={pipelineStages}
                  onQuickMoveStage={onQuickMoveStage}
                  onQuickEmail={onQuickEmail}
                  onQuickInterview={onQuickInterview}
                  onQuickDownload={onQuickDownload}
                  colorClass="bg-slate-100 text-slate-600 hover:bg-slate-200"
                  defaultExpanded={false}
                />
              </>
            ) : (
              // Show flat list when only one category
              <div className="space-y-2">
                {applications.map((application) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    isSelected={selectedIds.includes(application.id)}
                    onToggleSelect={onToggleSelect}
                    onOpenDetails={onOpenDetails}
                    pipelineStages={pipelineStages}
                    onQuickMoveStage={onQuickMoveStage}
                    onQuickEmail={onQuickEmail}
                    onQuickInterview={onQuickInterview}
                    onQuickDownload={onQuickDownload}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

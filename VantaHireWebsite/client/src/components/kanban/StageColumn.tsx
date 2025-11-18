import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Application, PipelineStage } from "@shared/schema";
import { ApplicationCard } from "./ApplicationCard";
import { cn } from "@/lib/utils";

interface StageColumnProps {
  stage: PipelineStage;
  applications: Application[];
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onOpenDetails: (application: Application) => void;
}

export function StageColumn({
  stage,
  applications,
  selectedIds,
  onToggleSelect,
  onOpenDetails,
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
            ) : (
              applications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  isSelected={selectedIds.includes(application.id)}
                  onToggleSelect={onToggleSelect}
                  onOpenDetails={onOpenDetails}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

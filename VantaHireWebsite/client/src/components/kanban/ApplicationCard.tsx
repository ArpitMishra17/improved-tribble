import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Mail, Phone, Star, MoreHorizontal, ArrowRight, Calendar, Download, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Application, PipelineStage } from "@shared/schema";
import { cn } from "@/lib/utils";

export interface ApplicationCardProps {
  application: Application;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onOpenDetails: (application: Application) => void;
  pipelineStages?: PipelineStage[] | undefined;
  onQuickMoveStage?: ((applicationId: number, stageId: number) => void) | undefined;
  onQuickEmail?: ((applicationId: number) => void) | undefined;
  onQuickInterview?: ((applicationId: number) => void) | undefined;
  onQuickDownload?: ((applicationId: number) => void) | undefined;
}

export function ApplicationCard({
  application,
  isSelected,
  onToggleSelect,
  onOpenDetails,
  pipelineStages = [],
  onQuickMoveStage,
  onQuickEmail,
  onQuickInterview,
  onQuickDownload,
}: ApplicationCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: application.id,
    data: {
      type: "application",
      application,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "mb-3",
        isDragging && "opacity-50"
      )}
    >
      <Card
        className={cn(
          "group bg-card border border-border hover:shadow-md transition-all cursor-pointer shadow-sm",
          isSelected && "ring-2 ring-primary/60"
        )}
        onClick={() => onOpenDetails(application)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 mt-1 focus:outline-none focus:ring-2 focus:ring-primary rounded"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Drag to move ${application.name}'s application`}
              aria-describedby={`drag-help-${application.id}`}
              role="button"
              tabIndex={0}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <span id={`drag-help-${application.id}`} className="sr-only">
              Use Space or Enter to pick up, Arrow keys to move, Space or Enter to drop, Escape to cancel
            </span>

            {/* Checkbox */}
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(application.id)}
                aria-label={`Select ${application.name}`}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-slate-900 font-medium text-sm truncate">
                    {application.name}
                  </h4>
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Mail className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{application.email}</span>
                    </div>
                    {application.phone && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span>{application.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Rating */}
                  {application.rating !== null && application.rating !== undefined && (
                    <div className="flex items-center gap-1 text-yellow-400 mr-1">
                      <Star className="h-3 w-3 fill-current" />
                      <span className="text-xs font-medium">{application.rating}</span>
                    </div>
                  )}

                  {/* Quick Actions Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Quick actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {onQuickEmail && (
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onQuickEmail(application.id);
                        }}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                      )}
                      {onQuickInterview && (
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onQuickInterview(application.id);
                        }}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule Interview
                        </DropdownMenuItem>
                      )}
                      {onQuickDownload && application.resumeUrl && (
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onQuickDownload(application.id);
                        }}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Resume
                        </DropdownMenuItem>
                      )}
                      {onQuickMoveStage && pipelineStages.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Move to Stage
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {pipelineStages
                                .filter(stage => stage.id !== application.currentStage)
                                .map((stage) => (
                                  <DropdownMenuItem
                                    key={stage.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onQuickMoveStage(application.id, stage.id);
                                    }}
                                  >
                                    <div
                                      className="w-2 h-2 rounded-full mr-2"
                                      style={{ backgroundColor: stage.color || '#6b7280' }}
                                    />
                                    {stage.name}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mt-2">
                {application.status && (
                  <Badge
                    variant="outline"
                    className="text-xs border-blue-200 bg-blue-50 text-blue-700"
                  >
                    {application.status}
                  </Badge>
                )}
                {application.interviewDate && (
                  <Badge
                    variant="outline"
                    className="text-xs border-green-200 bg-green-50 text-green-700"
                  >
                    Interview
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

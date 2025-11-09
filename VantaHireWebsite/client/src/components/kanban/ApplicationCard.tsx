import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Mail, Phone, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Application } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ApplicationCardProps {
  application: Application;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onOpenDetails: (application: Application) => void;
}

export function ApplicationCard({
  application,
  isSelected,
  onToggleSelect,
  onOpenDetails,
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
          "bg-white/5 backdrop-blur-sm border-white/20 hover:bg-white/10 transition-all cursor-pointer",
          isSelected && "ring-2 ring-purple-400"
        )}
        onClick={() => onOpenDetails(application)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-white mt-1 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded"
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
                  <h4 className="text-white font-medium text-sm truncate">
                    {application.name}
                  </h4>
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Mail className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{application.email}</span>
                    </div>
                    {application.phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span>{application.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rating */}
                {application.rating !== null && application.rating !== undefined && (
                  <div className="flex items-center gap-1 text-yellow-400 flex-shrink-0">
                    <Star className="h-3 w-3 fill-current" />
                    <span className="text-xs font-medium">{application.rating}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mt-2">
                {application.status && (
                  <Badge variant="outline" className="text-xs border-blue-400/50 text-blue-300">
                    {application.status}
                  </Badge>
                )}
                {application.interviewDate && (
                  <Badge variant="outline" className="text-xs border-green-400/50 text-green-300">
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

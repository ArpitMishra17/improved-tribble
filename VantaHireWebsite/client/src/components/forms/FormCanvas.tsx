import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Trash2, Copy, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldData } from "@/pages/form-editor-page";

const FIELD_TYPE_LABELS: Record<string, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  email: "Email",
  yes_no: "Yes/No",
  select: "Dropdown",
  date: "Date",
  file: "File Upload",
};

interface FieldCardProps {
  field: FieldData;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  hasError: boolean;
}

function SortableFieldCard({ field, isSelected, onSelect, onRemove, onDuplicate, hasError }: FieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("mb-3", isDragging && "opacity-50")}>
      <Card
        className={cn(
          "bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer",
          isSelected && "ring-2 ring-purple-400",
          hasError && "border-red-400/50"
        )}
        onClick={onSelect}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-white mt-1 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Drag to reorder ${field.label || 'field'}`}
            >
              <GripVertical className="h-5 w-5" />
            </button>

            {/* Field Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-purple-400/50 text-purple-300">
                      {FIELD_TYPE_LABELS[field.type] || field.type}
                    </Badge>
                    {field.required && (
                      <Badge variant="outline" className="text-xs border-blue-400/50 text-blue-300">
                        Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-white text-sm font-medium mt-1 truncate">
                    {field.label || <span className="text-slate-500 italic">Untitled field</span>}
                  </p>
                  {field.type === "select" && field.options && (
                    <p className="text-slate-400 text-xs mt-1 truncate">
                      Options: {field.options}
                    </p>
                  )}
                  {hasError && (
                    <div className="flex items-center gap-1 text-red-400 text-xs mt-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>This field has errors</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDuplicate}
                className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-white/10"
                title="Duplicate field"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                title="Delete field"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface FormCanvasProps {
  fields: FieldData[];
  selectedFieldId: string | null;
  onSelectField: (fieldId: string | null) => void;
  onReorderFields: (fields: FieldData[]) => void;
  onRemoveField: (fieldId: string) => void;
  onDuplicateField: (fieldId: string) => void;
  errors: Record<string, string>;
}

export function FormCanvas({
  fields,
  selectedFieldId,
  onSelectField,
  onReorderFields,
  onRemoveField,
  onDuplicateField,
  errors,
}: FormCanvasProps) {
  // Make the canvas droppable for palette items
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-drop-zone",
    data: {
      type: "canvas",
    },
  });

  const hasFieldError = (fieldId: string) => {
    return Object.keys(errors).some(key => key.startsWith(`field_${fieldId}_`));
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-full bg-slate-800 overflow-y-auto transition-colors",
        isOver && "bg-slate-800/80"
      )}
    >
      <div className="p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg">Form Canvas</h2>
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                fields.length >= 50
                  ? "border-red-400 text-red-400"
                  : fields.length >= 40
                  ? "border-amber-400 text-amber-400"
                  : "border-slate-500 text-slate-400"
              )}
            >
              {fields.length} / 50 fields
            </Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Drag fields from palette or reorder existing fields. Click to edit properties.
          </p>
          {fields.length >= 50 && (
            <p className="text-red-400 text-xs mt-2">
              Maximum field limit reached. Remove fields to add more.
            </p>
          )}
        </div>

        {fields.length === 0 ? (
          <Card className={cn(
            "bg-white/5 border-white/10 border-dashed transition-colors",
            isOver && "border-purple-400 bg-purple-500/10"
          )}>
            <CardContent className="py-12 text-center">
              <p className="text-slate-400">No fields yet. Drag fields from the palette or click to add.</p>
            </CardContent>
          </Card>
        ) : (
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0">
              {fields.map((field) => (
                <SortableFieldCard
                  key={field.id}
                  field={field}
                  isSelected={selectedFieldId === field.id}
                  onSelect={() => onSelectField(field.id)}
                  onRemove={() => onRemoveField(field.id)}
                  onDuplicate={() => onDuplicateField(field.id)}
                  hasError={hasFieldError(field.id)}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

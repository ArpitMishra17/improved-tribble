import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formsApi, formsQueryKeys, type FormTemplateDTO, type CreateTemplateRequest } from "@/lib/formsApi";
import { queryClient } from "@/lib/queryClient";
import { FIELD_TYPES } from "@shared/forms.types";

interface TemplateEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: FormTemplateDTO | null;
}

interface FieldData {
  type: string;
  label: string;
  required: boolean;
  options: string | undefined;
  order: number;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  short_text: "Short Text",
  long_text: "Long Text (Paragraph)",
  email: "Email Address",
  yes_no: "Yes/No",
  select: "Dropdown (Select)",
  date: "Date",
  file: "File Upload",
};

export function TemplateEditorModal({ open, onOpenChange, template }: TemplateEditorModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [fields, setFields] = useState<FieldData[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when template changes or modal opens
  useEffect(() => {
    if (open) {
      if (template) {
        // Edit mode
        setName(template.name);
        setDescription(template.description || "");
        setIsPublished(template.isPublished);
        setFields(
          template.fields
            .sort((a: typeof template.fields[number], b: typeof template.fields[number]) => a.order - b.order)
            .map((f: typeof template.fields[number]) => ({
              type: f.type,
              label: f.label,
              required: f.required,
              // Convert JSON array back to comma-separated for editing
              options: f.options
                ? (f.type === 'select'
                    ? (JSON.parse(f.options) as string[]).join(', ')
                    : f.options)
                : undefined,
              order: f.order,
            }))
        );
      } else {
        // Create mode
        resetForm();
      }
      setErrors({});
    }
  }, [open, template]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsPublished(true);
    setFields([]);
    setErrors({});
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateTemplateRequest) => formsApi.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formsQueryKeys.templates() });
      toast({
        title: "Template Created",
        description: "Form template has been created successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Template",
        description: error.message || "Failed to create form template.",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => formsApi.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formsQueryKeys.templates() });
      toast({
        title: "Template Updated",
        description: "Form template has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Template",
        description: error.message || "Failed to update form template.",
        variant: "destructive",
      });
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Template name is required";
    }

    if (fields.length === 0) {
      newErrors.fields = "At least one field is required";
    }

    fields.forEach((field, index) => {
      if (!field.label.trim()) {
        newErrors[`field_${index}_label`] = "Field label is required";
      }
      if (field.type === "select" && !field.options?.trim()) {
        newErrors[`field_${index}_options`] = "Options are required for select fields";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving.",
        variant: "destructive",
      });
      return;
    }

    const descriptionValue = description.trim();
    const data: CreateTemplateRequest = {
      name: name.trim(),
      ...(descriptionValue && { description: descriptionValue }),
      isPublished,
      fields: fields.map((field, index) => {
        const baseField = {
          type: field.type,
          label: field.label.trim(),
          required: field.required,
          order: index, // Use array index for order
        };
        // Only add options if it exists for select fields
        if (field.type === "select" && field.options) {
          return {
            ...baseField,
            options: JSON.stringify(field.options.split(',').map(opt => opt.trim()).filter(Boolean))
          };
        }
        return baseField;
      }),
    };

    if (template) {
      updateMutation.mutate({ id: template.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addField = () => {
    setFields([
      ...fields,
      {
        type: "short_text",
        label: "",
        required: false,
        options: undefined,
        order: fields.length,
      },
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FieldData>) => {
    setFields(fields.map((field, i) => (i === index ? { ...field, ...updates } : field)));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index > 0) {
      const newFields = [...fields];
      const temp = newFields[index - 1]!;
      newFields[index - 1] = newFields[index]!;
      newFields[index] = temp;
      setFields(newFields);
    } else if (direction === "down" && index < fields.length - 1) {
      const newFields = [...fields];
      const temp = newFields[index]!;
      newFields[index] = newFields[index + 1]!;
      newFields[index + 1] = temp;
      setFields(newFields);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl">
            {template ? "Edit Template" : "Create New Template"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {template
              ? "Update the form template and its fields"
              : "Create a custom form template to send to candidates"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Template Metadata */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-slate-300">
                Template Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Background Check Authorization"
                className="mt-1 bg-white/5 border-white/20 text-white"
              />
              {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="description" className="text-slate-300">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this form's purpose..."
                rows={2}
                className="mt-1 bg-white/5 border-white/20 text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isPublished"
                checked={isPublished}
                onCheckedChange={setIsPublished}
              />
              <Label htmlFor="isPublished" className="text-slate-300 cursor-pointer">
                Publish template (make available for recruiters to use)
              </Label>
            </div>
          </div>

          {/* Fields Builder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium">Form Fields</h3>
                <p className="text-slate-400 text-sm">
                  Add and configure the fields that will appear in this form
                </p>
              </div>
              <Button
                onClick={addField}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </div>

            {errors.fields && <p className="text-red-400 text-sm">{errors.fields}</p>}

            {fields.length === 0 ? (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="py-12 text-center">
                  <p className="text-slate-400">No fields yet. Click "Add Field" to get started.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <Card key={index} className="bg-white/5 border-white/10">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        {/* Drag Handle */}
                        <div className="flex flex-col gap-1 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveField(index, "up")}
                            disabled={index === 0}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                          >
                            ↑
                          </Button>
                          <GripVertical className="w-5 h-5 text-slate-500" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveField(index, "down")}
                            disabled={index === fields.length - 1}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                          >
                            ↓
                          </Button>
                        </div>

                        {/* Field Configuration */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-mono text-sm">#{index + 1}</span>
                            <div className="flex-1 grid grid-cols-2 gap-3">
                              {/* Field Type */}
                              <div>
                                <Label className="text-slate-300 text-sm">Field Type</Label>
                                <Select
                                  value={field.type}
                                  onValueChange={(value) => updateField(index, { type: value })}
                                >
                                  <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FIELD_TYPES.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {FIELD_TYPE_LABELS[type] || type}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Required Toggle */}
                              <div className="flex items-center gap-2 mt-6">
                                <Switch
                                  checked={field.required}
                                  onCheckedChange={(checked) =>
                                    updateField(index, { required: checked })
                                  }
                                />
                                <Label className="text-slate-300 text-sm">Required</Label>
                              </div>
                            </div>
                          </div>

                          {/* Field Label */}
                          <div>
                            <Label className="text-slate-300 text-sm">
                              Question/Label <span className="text-red-400">*</span>
                            </Label>
                            <Input
                              value={field.label}
                              onChange={(e) => updateField(index, { label: e.target.value })}
                              placeholder="e.g., What is your full legal name?"
                              className="mt-1 bg-white/5 border-white/20 text-white"
                            />
                            {errors[`field_${index}_label`] && (
                              <p className="text-red-400 text-sm mt-1">
                                {errors[`field_${index}_label`]}
                              </p>
                            )}
                          </div>

                          {/* Options (for select fields) */}
                          {field.type === "select" && (
                            <div>
                              <Label className="text-slate-300 text-sm">
                                Options (comma-separated) <span className="text-red-400">*</span>
                              </Label>
                              <Input
                                value={field.options || ""}
                                onChange={(e) => updateField(index, { options: e.target.value })}
                                placeholder="e.g., Option 1, Option 2, Option 3"
                                className="mt-1 bg-white/5 border-white/20 text-white"
                              />
                              <p className="text-slate-500 text-xs mt-1">
                                Enter options separated by commas. These will be shown in a dropdown.
                              </p>
                              {errors[`field_${index}_options`] && (
                                <p className="text-red-400 text-sm mt-1">
                                  {errors[`field_${index}_options`]}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeField(index)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20 mt-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="bg-slate-700 text-white border-slate-600 hover:bg-slate-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {template ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{template ? "Update Template" : "Create Template"}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import type { FieldData } from "@/pages/form-editor-page";

const FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "yes_no",
  "select",
  "date",
  "file",
];

const FIELD_TYPE_LABELS: Record<string, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  email: "Email",
  yes_no: "Yes/No",
  select: "Dropdown",
  date: "Date",
  file: "File Upload",
};

const FIELD_TYPE_DESCRIPTIONS: Record<string, string> = {
  short_text: "Single line text input for brief responses",
  long_text: "Multi-line text area for longer, detailed responses",
  email: "Email address field with validation",
  yes_no: "Boolean toggle for yes/no questions",
  select: "Dropdown menu with predefined options",
  date: "Date picker for selecting dates",
  file: "File upload field for document attachments",
};

interface FieldPropertiesPanelProps {
  field: FieldData | undefined;
  onUpdateField: (updates: Partial<FieldData>) => void;
  errors: Record<string, string>;
}

export function FieldPropertiesPanel({ field, onUpdateField, errors }: FieldPropertiesPanelProps) {
  if (!field) {
    return (
      <div className="h-full bg-slate-900 border-l border-slate-700 overflow-y-auto">
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-slate-400">Select a field to edit its properties</p>
          </div>
        </div>
      </div>
    );
  }

  const labelError = errors[`field_${field.id}_label`];
  const optionsError = errors[`field_${field.id}_options`];

  return (
    <div className="h-full bg-slate-900 border-l border-slate-700 overflow-y-auto">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-white font-semibold text-lg">Field Properties</h2>
          <p className="text-slate-400 text-sm mt-1">
            Configure the selected field
          </p>
        </div>

        {/* Field Type */}
        <div className="space-y-2">
          <Label htmlFor="field-type" className="text-slate-300">
            Field Type
          </Label>
          <Select
            value={field.type}
            onValueChange={(value) => onUpdateField({ type: value })}
          >
            <SelectTrigger id="field-type" className="bg-white/5 border-white/20 text-white">
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
          <p className="text-slate-500 text-xs">
            {FIELD_TYPE_DESCRIPTIONS[field.type]}
          </p>
        </div>

        {/* Field Label */}
        <div className="space-y-2">
          <Label htmlFor="field-label" className="text-slate-300">
            Question/Label <span className="text-red-400">*</span>
          </Label>
          <Textarea
            id="field-label"
            value={field.label}
            onChange={(e) => onUpdateField({ label: e.target.value })}
            placeholder="e.g., What is your full legal name?"
            rows={3}
            className="bg-white/5 border-white/20 text-white resize-none"
          />
          {labelError ? (
            <div className="flex items-center gap-1 text-red-400 text-sm">
              <AlertCircle className="w-3 h-3" />
              <span>{labelError}</span>
            </div>
          ) : (
            <p className="text-slate-500 text-xs">
              This is what candidates will see
            </p>
          )}
        </div>

        {/* Required Toggle */}
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex-1">
            <Label htmlFor="field-required" className="text-slate-300 cursor-pointer">
              Required Field
            </Label>
            <p className="text-slate-500 text-xs mt-1">
              Candidates must fill this field to submit
            </p>
          </div>
          <Switch
            id="field-required"
            checked={field.required}
            onCheckedChange={(checked) => onUpdateField({ required: checked })}
          />
        </div>

        {/* Options (for select fields) */}
        {field.type === "select" && (
          <div className="space-y-2">
            <Label htmlFor="field-options" className="text-slate-300">
              Dropdown Options <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="field-options"
              value={field.options || ""}
              onChange={(e) => onUpdateField({ options: e.target.value })}
              placeholder="Option 1, Option 2, Option 3"
              rows={4}
              className="bg-white/5 border-white/20 text-white resize-none"
            />
            {optionsError ? (
              <div className="flex items-center gap-1 text-red-400 text-sm">
                <AlertCircle className="w-3 h-3" />
                <span>{optionsError}</span>
              </div>
            ) : (
              <p className="text-slate-500 text-xs">
                Separate options with commas. Example: "Yes, No, Maybe"
              </p>
            )}
          </div>
        )}

        {/* Field Help Text */}
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-sm text-purple-300">Validation Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-2">
            {field.type === "email" && (
              <p>• Email fields automatically validate email format</p>
            )}
            {field.type === "file" && (
              <p>• Supported file types: PDF, DOC, DOCX, TXT (max 10MB)</p>
            )}
            {field.type === "select" && (
              <p>• Ensure each option is unique and clearly labeled</p>
            )}
            {field.type === "date" && (
              <p>• Dates are displayed in the candidate's local format</p>
            )}
            {field.required && (
              <p>• Required fields must be completed before submission</p>
            )}
          </CardContent>
        </Card>

        {/* Field Preview */}
        <div className="space-y-2">
          <Label className="text-slate-300">Preview</Label>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <Label className="text-white text-sm">
                {field.label || <span className="text-slate-500 italic">Untitled field</span>}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </Label>
              {field.type === "short_text" && (
                <Input
                  disabled
                  placeholder="Text input..."
                  className="mt-2 bg-white/10 border-white/20 text-slate-400"
                />
              )}
              {field.type === "long_text" && (
                <Textarea
                  disabled
                  placeholder="Text area..."
                  rows={3}
                  className="mt-2 bg-white/10 border-white/20 text-slate-400 resize-none"
                />
              )}
              {field.type === "email" && (
                <Input
                  disabled
                  type="email"
                  placeholder="email@example.com"
                  className="mt-2 bg-white/10 border-white/20 text-slate-400"
                />
              )}
              {field.type === "yes_no" && (
                <div className="flex items-center gap-2 mt-2">
                  <Switch disabled />
                  <span className="text-slate-400 text-sm">Toggle</span>
                </div>
              )}
              {field.type === "select" && (
                <Select disabled>
                  <SelectTrigger className="mt-2 bg-white/10 border-white/20 text-slate-400">
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                </Select>
              )}
              {field.type === "date" && (
                <Input
                  disabled
                  type="date"
                  className="mt-2 bg-white/10 border-white/20 text-slate-400"
                />
              )}
              {field.type === "file" && (
                <Input
                  disabled
                  type="file"
                  className="mt-2 bg-white/10 border-white/20 text-slate-400"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

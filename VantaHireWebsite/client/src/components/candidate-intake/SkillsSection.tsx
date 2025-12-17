import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, Plus, X, Sparkles } from "lucide-react";
import { type SkillsData, type SkillItem } from "./types";

interface SkillsSectionProps {
  data: SkillsData;
  onChange: (data: SkillsData) => void;
  onValidChange: (isValid: boolean) => void;
  onContinue: () => void;
}

const PROFICIENCY_COLORS: Record<string, string> = {
  beginner: "bg-muted text-foreground border-border",
  intermediate: "bg-info/20 text-info-foreground border-info/30",
  advanced: "bg-primary/20 text-primary border-primary/30",
  expert: "bg-success/20 text-success-foreground border-success/30",
};

const PROFICIENCY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export function SkillsSection({
  data,
  onChange,
  onValidChange,
  onContinue,
}: SkillsSectionProps) {
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillProficiency, setNewSkillProficiency] = useState<string>("");

  // Skills are optional, so always valid
  useEffect(() => {
    onValidChange(true);
  }, [onValidChange]);

  const addSkill = () => {
    if (!newSkillName.trim()) return;

    const newSkill: SkillItem = {
      name: newSkillName.trim(),
      proficiency: newSkillProficiency as SkillItem["proficiency"] || undefined,
    };

    // Avoid duplicates
    if (data.skills.some((s) => s.name.toLowerCase() === newSkill.name.toLowerCase())) {
      return;
    }

    onChange({ skills: [...data.skills, newSkill] });
    setNewSkillName("");
    setNewSkillProficiency("");
  };

  const removeSkill = (skillName: string) => {
    onChange({ skills: data.skills.filter((s) => s.name !== skillName) });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Skills</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add relevant skills with optional proficiency levels
        </p>
      </div>

      {/* Add skill input */}
      <div className="flex gap-2">
        <Input
          value={newSkillName}
          onChange={(e) => setNewSkillName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter a skill (e.g., React, Python, Project Management)"
          className="flex-1"
        />
        <Select value={newSkillProficiency} onValueChange={setNewSkillProficiency}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
            <SelectItem value="expert">Expert</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={addSkill} disabled={!newSkillName.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Skills list */}
      {data.skills.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Sparkles className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No skills added yet. Type a skill name above and press Enter or click Add.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.skills.map((skill) => (
            <Badge
              key={skill.name}
              variant="outline"
              className={`py-1.5 px-3 text-sm ${
                skill.proficiency
                  ? PROFICIENCY_COLORS[skill.proficiency]
                  : "bg-muted/50 text-foreground border-border"
              }`}
            >
              <span>{skill.name}</span>
              {skill.proficiency && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({PROFICIENCY_LABELS[skill.proficiency]})
                </span>
              )}
              <button
                onClick={() => removeSkill(skill.name)}
                className="ml-2 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {data.skills.length}/30 skills added
      </p>

      <div className="pt-4 flex justify-end">
        <Button onClick={onContinue}>
          Continue
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

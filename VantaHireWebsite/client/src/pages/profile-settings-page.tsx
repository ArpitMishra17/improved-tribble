import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, Building, MapPin, Linkedin, Globe, Save, X, Phone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";

interface UserProfile {
  displayName: string | null;
  company: string | null;
  phone: string | null;
  photoUrl: string | null;
  bio: string | null;
  skills: string[] | null;
  linkedin: string | null;
  location: string | null;
  isPublic: boolean | null;
}

interface ProfileData {
  user: {
    id: number;
    username: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    emailVerified: boolean | null;
  };
  profile: UserProfile;
}

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState<UserProfile>({
    displayName: "",
    company: "",
    phone: "",
    photoUrl: "",
    bio: "",
    skills: [],
    linkedin: "",
    location: "",
    isPublic: false,
  });

  const [newSkill, setNewSkill] = useState("");

  // Fetch current profile
  const { data: profileData, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const response = await fetch("/api/profile", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
    enabled: !!user,
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profileData?.profile) {
      setFormData({
        displayName: profileData.profile.displayName || "",
        company: profileData.profile.company || "",
        phone: profileData.profile.phone || "",
        photoUrl: profileData.profile.photoUrl || "",
        bio: profileData.profile.bio || "",
        skills: profileData.profile.skills || [],
        linkedin: profileData.profile.linkedin || "",
        location: profileData.profile.location || "",
        isPublic: profileData.profile.isPublic || false,
      });
    }
  }, [profileData]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const res = await apiRequest("PATCH", "/api/profile", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const addSkill = () => {
    if (newSkill.trim() && formData.skills && formData.skills.length < 20) {
      if (!formData.skills.includes(newSkill.trim())) {
        setFormData({
          ...formData,
          skills: [...formData.skills, newSkill.trim()],
        });
      }
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFormData({
      ...formData,
      skills: (formData.skills || []).filter((s) => s !== skillToRemove),
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading profile...</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8 pt-8">
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
              Profile Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your recruiter profile and public visibility
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info Card */}
            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Basic Information
                </CardTitle>
                <CardDescription>
                  Your public display information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName || ""}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Your display name"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be shown on your job postings
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company" className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Company
                  </Label>
                  <Input
                    id="company"
                    value={formData.company || ""}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Your company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    value={formData.location || ""}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="City, Country"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin" className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4" />
                    LinkedIn Profile
                  </Label>
                  <Input
                    id="linkedin"
                    type="url"
                    value={formData.linkedin || ""}
                    onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                    placeholder="https://linkedin.com/in/your-profile"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bio Card */}
            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Bio</CardTitle>
                <CardDescription>
                  Tell candidates about yourself
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.bio || ""}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Write a brief bio about yourself and your recruiting experience..."
                  rows={4}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {(formData.bio || "").length}/2000 characters
                </p>
              </CardContent>
            </Card>

            {/* Skills Card */}
            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Specializations</CardTitle>
                <CardDescription>
                  Industries or areas you specialize in
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="Add a specialization (e.g., Tech, Healthcare)"
                  />
                  <Button
                    type="button"
                    onClick={addSkill}
                    variant="outline"
                  >
                    Add
                  </Button>
                </div>

                {formData.skills && formData.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.skills.map((skill, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-primary/20 text-primary pr-1"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkill(skill)}
                          className="ml-2 hover:bg-purple-200 rounded p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {(formData.skills || []).length}/20 specializations
                </p>
              </CardContent>
            </Card>

            {/* Visibility Card */}
            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Profile Visibility
                </CardTitle>
                <CardDescription>
                  Control who can see your profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Public Profile</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow candidates to view your profile and see all your job postings
                    </p>
                  </div>
                  <Switch
                    checked={formData.isPublic || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pb-8">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="bg-primary hover:bg-primary/80"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}

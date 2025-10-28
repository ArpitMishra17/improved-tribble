import { pgTable, text, serial, integer, boolean, timestamp, date, numeric, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").notNull().default("candidate"), // admin, recruiter, candidate
});

export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  location: text("location"),
  message: text("message").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  location: text("location").notNull(),
  type: text("type").notNull(), // full-time, part-time, contract, remote
  description: text("description").notNull(),
  skills: text("skills").array(),
  deadline: date("deadline"),
  postedBy: integer("posted_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").notNull().default(false), // Only active after admin approval
  status: text("status").notNull().default('pending'), // pending, approved, declined
  reviewComments: text("review_comments"),
  expiresAt: timestamp("expires_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  slug: text("slug"), // URL-friendly slug for SEO (e.g., "senior-developer-bangalore")
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Job lifecycle tracking (deactivation/reactivation)
  deactivatedAt: timestamp("deactivated_at"), // When job was deactivated
  reactivatedAt: timestamp("reactivated_at"), // When job was last reactivated
  reactivationCount: integer("reactivation_count").notNull().default(0), // Number of times job has been reactivated
  deactivationReason: text("deactivation_reason"), // Reason for deactivation: 'manual', 'auto_expired', 'filled', 'cancelled'
  warningEmailSent: boolean("warning_email_sent").notNull().default(false), // Warning email sent before auto-deactivation
}, (table) => ({
  // Indexes for performance hotspots
  statusIdx: index("jobs_status_idx").on(table.status),
  postedByIdx: index("jobs_posted_by_idx").on(table.postedBy),
  isActiveIdx: index("jobs_is_active_idx").on(table.isActive),
  slugIdx: index("jobs_slug_idx").on(table.slug),
  deactivatedAtIdx: index("jobs_deactivated_at_idx").on(table.deactivatedAt),
}));

export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  bio: text("bio"),
  skills: text("skills").array(),
  linkedin: text("linkedin"),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id),
  userId: integer("user_id").references(() => users.id), // Optional: bind application to user account
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  resumeUrl: text("resume_url").notNull(),
  resumeFilename: text("resume_filename"), // Original filename for proper downloads
  coverLetter: text("cover_letter"),
  status: text("status").default("submitted").notNull(),
  notes: text("notes"),
  lastViewedAt: timestamp("last_viewed_at"),
  downloadedAt: timestamp("downloaded_at"),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // ATS enhancements
  currentStage: integer("current_stage").references(() => pipelineStages.id),
  interviewDate: timestamp("interview_date"),
  interviewTime: text("interview_time"),
  interviewLocation: text("interview_location"),
  interviewNotes: text("interview_notes"),
  recruiterNotes: text("recruiter_notes").array(),
  rating: integer("rating"),
  tags: text("tags").array(),
  stageChangedAt: timestamp("stage_changed_at"),
  stageChangedBy: integer("stage_changed_by").references(() => users.id),
  // Recruiter-add metadata
  submittedByRecruiter: boolean("submitted_by_recruiter").default(false),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  source: text("source").default("public_apply"), // 'public_apply', 'recruiter_add', 'referral', 'linkedin', 'indeed', 'other'
  sourceMetadata: jsonb("source_metadata"), // { referrer, platform, notes }
}, (table) => ({
  // Indexes for ATS performance
  currentStageIdx: index("applications_current_stage_idx").on(table.currentStage),
  jobIdIdx: index("applications_job_id_idx").on(table.jobId),
  emailIdx: index("applications_email_idx").on(table.email),
  userIdIdx: index("applications_user_id_idx").on(table.userId),
  statusIdx: index("applications_status_idx").on(table.status),
}));

export const jobAnalytics = pgTable("job_analytics", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  views: integer("views").notNull().default(0),
  applyClicks: integer("apply_clicks").notNull().default(0),
  conversionRate: numeric("conversion_rate", { precision: 5, scale: 2 }).default("0.00"),
  aiScoreCache: integer("ai_score_cache"),
  aiModelVersion: text("ai_model_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Job audit log for compliance and debugging
export const jobAuditLog = pgTable("job_audit_log", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  action: text("action").notNull(), // 'deactivated', 'reactivated', 'created', 'approved', 'declined'
  performedBy: integer("performed_by").notNull().references(() => users.id),
  reason: text("reason"), // Reason for action (e.g., 'auto_expired', 'manual', 'filled')
  metadata: jsonb("metadata"), // Additional context (e.g., { previousStatus: 'active', newStatus: 'inactive' })
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index("job_audit_log_job_id_idx").on(table.jobId),
  timestampIdx: index("job_audit_log_timestamp_idx").on(table.timestamp),
  actionIdx: index("job_audit_log_action_idx").on(table.action),
}));

// ATS: Pipeline stages
export const pipelineStages = pgTable("pipeline_stages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color").default("#3b82f6"),
  isDefault: boolean("is_default").default(false),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ATS: Application stage history
export const applicationStageHistory = pgTable("application_stage_history", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => applications.id, { onDelete: 'cascade' }),
  fromStage: integer("from_stage").references(() => pipelineStages.id),
  toStage: integer("to_stage").notNull().references(() => pipelineStages.id),
  changedBy: integer("changed_by").notNull().references(() => users.id),
  notes: text("notes"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

// ATS: Email templates
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  templateType: text("template_type").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ATS: Email audit log
export const emailAuditLog = pgTable("email_audit_log", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").references(() => applications.id, { onDelete: 'cascade' }),
  templateId: integer("template_id").references(() => emailTemplates.id),
  templateType: text("template_type"),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  sentBy: integer("sent_by").references(() => users.id),
  status: text("status").notNull().default("success"), // success, failed
  errorMessage: text("error_message"),
  previewUrl: text("preview_url"),
});

// ATS: Automation settings
export const automationSettings = pgTable("automation_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: boolean("setting_value").notNull().default(true),
  description: text("description"),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Consultant Profiles
export const consultants = pgTable("consultants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  experience: text("experience").notNull(),
  linkedinUrl: text("linkedin_url"),
  domains: text("domains").notNull(),
  description: text("description"),
  photoUrl: text("photo_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Forms Feature: Recruiter-sent candidate forms
export const forms = pgTable("forms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isPublished: boolean("is_published").notNull().default(true),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  createdByIdx: index("forms_created_by_idx").on(table.createdBy),
  isPublishedIdx: index("forms_is_published_idx").on(table.isPublished),
}));

export const formFields = pgTable("form_fields", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => forms.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'short_text', 'long_text', 'yes_no', 'select', 'date', 'file', 'email'
  label: text("label").notNull(),
  required: boolean("required").notNull().default(false),
  options: text("options"), // JSON string for select options
  order: integer("order").notNull(),
}, (table) => ({
  formIdOrderIdx: index("form_fields_form_id_order_idx").on(table.formId, table.order),
}));

export const formInvitations = pgTable("form_invitations", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => applications.id, { onDelete: 'cascade' }),
  formId: integer("form_id").notNull().references(() => forms.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'sent', 'viewed', 'answered', 'expired', 'failed'
  sentBy: integer("sent_by").notNull().references(() => users.id),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  answeredAt: timestamp("answered_at"),
  fieldSnapshot: text("field_snapshot").notNull(), // JSONB stored as text: snapshot of form fields at creation
  customMessage: text("custom_message"),
  reminderSentAt: timestamp("reminder_sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index("form_invitations_token_idx").on(table.token),
  applicationIdStatusIdx: index("form_invitations_app_status_idx").on(table.applicationId, table.status),
  createdAtIdx: index("form_invitations_created_at_idx").on(table.createdAt),
  formIdIdx: index("form_invitations_form_id_idx").on(table.formId),
}));

export const formResponses = pgTable("form_responses", {
  id: serial("id").primaryKey(),
  invitationId: integer("invitation_id").notNull().references(() => formInvitations.id, { onDelete: 'cascade' }).unique(),
  applicationId: integer("application_id").notNull().references(() => applications.id, { onDelete: 'cascade' }),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (table) => ({
  applicationIdIdx: index("form_responses_application_id_idx").on(table.applicationId),
}));

export const formResponseAnswers = pgTable("form_response_answers", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id").notNull().references(() => formResponses.id, { onDelete: 'cascade' }),
  fieldId: integer("field_id").notNull().references(() => formFields.id),
  value: text("value"), // Text or JSON string for structured answers
  fileUrl: text("file_url"), // For file upload fields
}, (table) => ({
  responseIdIdx: index("form_response_answers_response_id_idx").on(table.responseId),
}));

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  jobs: many(jobs),
  reviewedJobs: many(jobs, { relationName: "reviewedJobs" }),
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  postedBy: one(users, {
    fields: [jobs.postedBy],
    references: [users.id],
  }),
  reviewedBy: one(users, {
    fields: [jobs.reviewedBy],
    references: [users.id],
    relationName: "reviewedJobs",
  }),
  applications: many(applications),
  analytics: one(jobAnalytics, {
    fields: [jobs.id],
    references: [jobAnalytics.jobId],
  }),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  job: one(jobs, {
    fields: [applications.jobId],
    references: [jobs.id],
  }),
  currentStageRel: one(pipelineStages, {
    fields: [applications.currentStage],
    references: [pipelineStages.id],
  }),
  stageChangedByUser: one(users, {
    fields: [applications.stageChangedBy],
    references: [users.id],
  }),
  stageHistory: many(applicationStageHistory),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [pipelineStages.createdBy],
    references: [users.id],
  }),
  applications: many(applications),
}));

export const applicationStageHistoryRelations = relations(applicationStageHistory, ({ one }) => ({
  application: one(applications, {
    fields: [applicationStageHistory.applicationId],
    references: [applications.id],
  }),
  fromStageRel: one(pipelineStages, {
    fields: [applicationStageHistory.fromStage],
    references: [pipelineStages.id],
  }),
  toStageRel: one(pipelineStages, {
    fields: [applicationStageHistory.toStage],
    references: [pipelineStages.id],
  }),
  changedByUser: one(users, {
    fields: [applicationStageHistory.changedBy],
    references: [users.id],
  }),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [emailTemplates.createdBy],
    references: [users.id],
  }),
  auditLogs: many(emailAuditLog),
}));

export const emailAuditLogRelations = relations(emailAuditLog, ({ one }) => ({
  application: one(applications, {
    fields: [emailAuditLog.applicationId],
    references: [applications.id],
  }),
  template: one(emailTemplates, {
    fields: [emailAuditLog.templateId],
    references: [emailTemplates.id],
  }),
  sentByUser: one(users, {
    fields: [emailAuditLog.sentBy],
    references: [users.id],
  }),
}));

export const automationSettingsRelations = relations(automationSettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [automationSettings.updatedBy],
    references: [users.id],
  }),
}));

export const jobAnalyticsRelations = relations(jobAnalytics, ({ one }) => ({
  job: one(jobs, {
    fields: [jobAnalytics.jobId],
    references: [jobs.id],
  }),
}));

export const jobAuditLogRelations = relations(jobAuditLog, ({ one }) => ({
  job: one(jobs, {
    fields: [jobAuditLog.jobId],
    references: [jobs.id],
  }),
  performedBy: one(users, {
    fields: [jobAuditLog.performedBy],
    references: [users.id],
  }),
}));

export const formsRelations = relations(forms, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [forms.createdBy],
    references: [users.id],
  }),
  fields: many(formFields),
  invitations: many(formInvitations),
}));

export const formFieldsRelations = relations(formFields, ({ one }) => ({
  form: one(forms, {
    fields: [formFields.formId],
    references: [forms.id],
  }),
}));

export const formInvitationsRelations = relations(formInvitations, ({ one }) => ({
  application: one(applications, {
    fields: [formInvitations.applicationId],
    references: [applications.id],
  }),
  form: one(forms, {
    fields: [formInvitations.formId],
    references: [forms.id],
  }),
  sentBy: one(users, {
    fields: [formInvitations.sentBy],
    references: [users.id],
  }),
  response: one(formResponses, {
    fields: [formInvitations.id],
    references: [formResponses.invitationId],
  }),
}));

export const formResponsesRelations = relations(formResponses, ({ one, many }) => ({
  invitation: one(formInvitations, {
    fields: [formResponses.invitationId],
    references: [formInvitations.id],
  }),
  application: one(applications, {
    fields: [formResponses.applicationId],
    references: [applications.id],
  }),
  answers: many(formResponseAnswers),
}));

export const formResponseAnswersRelations = relations(formResponseAnswers, ({ one }) => ({
  response: one(formResponses, {
    fields: [formResponseAnswers.responseId],
    references: [formResponses.id],
  }),
  field: one(formFields, {
    fields: [formResponseAnswers.fieldId],
    references: [formFields.id],
  }),
}));

// Types and insert schemas for new tables
export const insertPipelineStageSchema = createInsertSchema(pipelineStages).pick({
  name: true,
  order: true,
  color: true,
  isDefault: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).pick({
  name: true,
  subject: true,
  body: true,
  templateType: true,
  isDefault: true,
});

export const insertConsultantSchema = createInsertSchema(consultants).pick({
  name: true,
  email: true,
  experience: true,
  linkedinUrl: true,
  domains: true,
  description: true,
  photoUrl: true,
  isActive: true,
}).extend({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  experience: z.string().min(1).max(50),
  linkedinUrl: z.string().url().optional(),
  domains: z.string().min(1).max(1000),
  description: z.string().max(2000).optional(),
  photoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  firstName: true,
  lastName: true,
  role: true,
});

export const insertContactSchema = createInsertSchema(contactSubmissions).pick({
  name: true,
  email: true,
  phone: true,
  company: true,
  location: true,
  message: true,
});

export const insertJobSchema = createInsertSchema(jobs).pick({
  title: true,
  location: true,
  type: true,
  description: true,
  skills: true,
  deadline: true,
}).extend({
  title: z.string().min(1).max(100),
  location: z.string().min(1).max(100),
  type: z.enum(["full-time", "part-time", "contract", "remote"]),
  description: z.string().min(10).max(5000),
  skills: z.array(z.string().min(1).max(50)).max(20).optional(),
  deadline: z.string().transform(str => new Date(str)).optional(),
});

export const insertApplicationSchema = createInsertSchema(applications).pick({
  name: true,
  email: true,
  phone: true,
  coverLetter: true,
  status: true,
  notes: true,
}).extend({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  coverLetter: z.string().max(2000).optional(),
  status: z.enum(["submitted", "reviewed", "shortlisted", "rejected", "downloaded"]).optional(),
  notes: z.string().max(1000).optional(),
});

// Zod schema for recruiter-add endpoint (separate from public apply)
export const recruiterAddApplicationSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  coverLetter: z.string().max(2000).optional(),
  source: z.enum(['recruiter_add', 'referral', 'linkedin', 'indeed', 'other']).default('recruiter_add'),
  sourceMetadata: z.object({
    referrer: z.string().optional(),
    platform: z.string().optional(),
    notes: z.string().max(500).optional(),
  }).optional(),
  currentStage: z.number().int().positive().optional(), // Initial stage assignment
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).pick({
  bio: true,
  skills: true,
  linkedin: true,
  location: true,
}).extend({
  bio: z.string().max(500).optional(),
  skills: z.array(z.string().min(1).max(50)).max(20).optional(),
  linkedin: z.string().url().optional(),
  location: z.string().min(1).max(100).optional(),
});

export const insertJobAnalyticsSchema = createInsertSchema(jobAnalytics).pick({
  jobId: true,
  views: true,
  applyClicks: true,
  conversionRate: true,
}).extend({
  jobId: z.number().int().positive(),
  views: z.number().int().min(0).optional(),
  applyClicks: z.number().int().min(0).optional(),
  conversionRate: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertContact = z.infer<typeof insertContactSchema>;
export type ContactSubmission = typeof contactSubmissions.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type RecruiterAddApplication = z.infer<typeof recruiterAddApplicationSchema>;
export type Application = typeof applications.$inferSelect;

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

export type InsertJobAnalytics = z.infer<typeof insertJobAnalyticsSchema>;
export type JobAnalytics = typeof jobAnalytics.$inferSelect;

export type JobAuditLog = typeof jobAuditLog.$inferSelect;

export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

export type ApplicationStageHistory = typeof applicationStageHistory.$inferSelect;

export type EmailAuditLog = typeof emailAuditLog.$inferSelect;

export type AutomationSetting = typeof automationSettings.$inferSelect;

export type Consultant = typeof consultants.$inferSelect;
export type InsertConsultant = z.infer<typeof insertConsultantSchema>;

// Forms Feature: Insert schemas and types
export const insertFormSchema = createInsertSchema(forms).pick({
  name: true,
  description: true,
  isPublished: true,
}).extend({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isPublished: z.boolean().optional(),
});

export const insertFormFieldSchema = z.object({
  type: z.enum(['short_text', 'long_text', 'yes_no', 'select', 'date', 'file', 'email']),
  label: z.string().min(1).max(200),
  required: z.boolean().default(false),
  options: z.string().optional(), // JSON string for select options
  order: z.number().int().min(0),
});

export const insertFormInvitationSchema = z.object({
  applicationId: z.number().int().positive(),
  formId: z.number().int().positive(),
  customMessage: z.string().max(1000).optional(),
});

export const insertFormResponseSchema = z.object({
  invitationId: z.number().int().positive(),
  applicationId: z.number().int().positive(),
});

export const insertFormResponseAnswerSchema = z.object({
  fieldId: z.number().int().positive(),
  value: z.string().optional(),
  fileUrl: z.string().url().optional(),
});

export type Form = typeof forms.$inferSelect;
export type InsertForm = z.infer<typeof insertFormSchema>;

export type FormField = typeof formFields.$inferSelect;
export type InsertFormField = z.infer<typeof insertFormFieldSchema>;

export type FormInvitation = typeof formInvitations.$inferSelect;
export type InsertFormInvitation = z.infer<typeof insertFormInvitationSchema>;

export type FormResponse = typeof formResponses.$inferSelect;
export type InsertFormResponse = z.infer<typeof insertFormResponseSchema>;

export type FormResponseAnswer = typeof formResponseAnswers.$inferSelect;
export type InsertFormResponseAnswer = z.infer<typeof insertFormResponseAnswerSchema>;

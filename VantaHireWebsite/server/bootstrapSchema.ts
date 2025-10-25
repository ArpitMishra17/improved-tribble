import { db } from './db';
import { sql } from 'drizzle-orm';

export async function ensureAtsSchema(): Promise<void> {
  console.log('🔧 Ensuring ATS schema exists...');

  // Create ATS tables if they do not exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      is_default BOOLEAN DEFAULT FALSE,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      template_type TEXT NOT NULL,
      created_by INTEGER,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS application_stage_history (
      id SERIAL PRIMARY KEY,
      application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      from_stage INTEGER,
      to_stage INTEGER NOT NULL,
      changed_by INTEGER NOT NULL,
      notes TEXT,
      changed_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_audit_log (
      id SERIAL PRIMARY KEY,
      application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
      template_id INTEGER,
      template_type TEXT,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT NOW() NOT NULL,
      sent_by INTEGER,
      status TEXT NOT NULL DEFAULT 'success',
      error_message TEXT,
      preview_url TEXT
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS automation_settings (
      id SERIAL PRIMARY KEY,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value BOOLEAN NOT NULL DEFAULT TRUE,
      description TEXT,
      updated_by INTEGER,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS consultants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      experience TEXT NOT NULL,
      linkedin_url TEXT,
      domains TEXT NOT NULL,
      description TEXT,
      photo_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Add ATS columns to applications table if missing
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS current_stage INTEGER;`);
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_date TIMESTAMP;`);
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_time TEXT;`);
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_location TEXT;`);
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_notes TEXT;`);
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS recruiter_notes TEXT[];`);
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS rating INTEGER;`);
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS tags TEXT[];`);
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMP;`);
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS stage_changed_by INTEGER;`);

  // Phase 5: Add userId column for robust candidate authorization (binds applications to user accounts)
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);`);

  // Add resumeFilename column for proper file download headers
  await db.execute(sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS resume_filename TEXT;`);

  // Phase 5: Create performance indexes for hotspot queries
  // Jobs table indexes (status, postedBy, isActive for filtering)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS jobs_posted_by_idx ON jobs(posted_by);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS jobs_is_active_idx ON jobs(is_active);`);

  // Applications table indexes (userId for auth, status for filtering)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS applications_user_id_idx ON applications(user_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS applications_status_idx ON applications(status);`);

  // Fix jobs table: pending jobs should not be active by default
  await db.execute(sql`ALTER TABLE jobs ALTER COLUMN is_active SET DEFAULT FALSE;`);

  // Clean up existing data: pending jobs should not be active
  await db.execute(sql`UPDATE jobs SET is_active = FALSE WHERE status = 'pending' AND is_active = TRUE;`);

  // Forms Feature: Create forms tables in dependency order
  console.log('  Creating forms tables...');

  // 1. forms table (no dependencies)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS forms (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_published BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // 2. form_fields table (depends on forms)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS form_fields (
      id SERIAL PRIMARY KEY,
      form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      required BOOLEAN NOT NULL DEFAULT FALSE,
      options TEXT,
      "order" INTEGER NOT NULL
    );
  `);

  // 3. form_invitations table (depends on forms, applications)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS form_invitations (
      id SERIAL PRIMARY KEY,
      application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      form_id INTEGER NOT NULL REFERENCES forms(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sent_by INTEGER NOT NULL REFERENCES users(id),
      sent_at TIMESTAMP,
      viewed_at TIMESTAMP,
      answered_at TIMESTAMP,
      field_snapshot TEXT NOT NULL,
      custom_message TEXT,
      reminder_sent_at TIMESTAMP,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // 4. form_responses table (depends on form_invitations, applications)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS form_responses (
      id SERIAL PRIMARY KEY,
      invitation_id INTEGER NOT NULL REFERENCES form_invitations(id) ON DELETE CASCADE UNIQUE,
      application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      submitted_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // 5. form_response_answers table (depends on form_responses, form_fields)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS form_response_answers (
      id SERIAL PRIMARY KEY,
      response_id INTEGER NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
      field_id INTEGER NOT NULL REFERENCES form_fields(id),
      value TEXT,
      file_url TEXT
    );
  `);

  // Forms Feature: Create indexes
  console.log('  Creating forms indexes...');
  await db.execute(sql`CREATE INDEX IF NOT EXISTS forms_created_by_idx ON forms(created_by);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS forms_is_published_idx ON forms(is_published);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS form_fields_form_id_order_idx ON form_fields(form_id, "order");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS form_invitations_token_idx ON form_invitations(token);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS form_invitations_app_status_idx ON form_invitations(application_id, status);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS form_invitations_created_at_idx ON form_invitations(created_at);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS form_invitations_form_id_idx ON form_invitations(form_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS form_responses_application_id_idx ON form_responses(application_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS form_response_answers_response_id_idx ON form_response_answers(response_id);`);

  console.log('✅ ATS schema ready');
}


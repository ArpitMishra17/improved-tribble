#!/usr/bin/env tsx
/**
 * Seed script for default form templates
 *
 * Creates 3 default form templates:
 * 1. Additional Information Request
 * 2. Availability & Scheduling
 * 3. Professional References
 *
 * Usage: npm run seed:forms
 */

import { db } from './db';
import { forms, formFields, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface FieldDefinition {
  type: 'short_text' | 'long_text' | 'yes_no' | 'select' | 'date' | 'file' | 'email';
  label: string;
  required: boolean;
  options?: string;
  order: number;
}

interface TemplateDefinition {
  name: string;
  description: string;
  isPublished: boolean;
  fields: FieldDefinition[];
}

const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'Additional Information Request',
    description: 'Request additional details from candidates to supplement their application',
    isPublished: true,
    fields: [
      {
        type: 'long_text',
        label: 'Tell us more about your interest in this role',
        required: true,
        order: 0,
      },
      {
        type: 'short_text',
        label: 'What is your expected salary range?',
        required: false,
        order: 1,
      },
      {
        type: 'date',
        label: 'What is your earliest possible start date?',
        required: true,
        order: 2,
      },
      {
        type: 'yes_no',
        label: 'Are you willing to relocate?',
        required: true,
        order: 3,
      },
      {
        type: 'select',
        label: 'What is your current employment status?',
        required: true,
        options: JSON.stringify(['Employed', 'Unemployed', 'Student', 'Freelancer', 'Other']),
        order: 4,
      },
      {
        type: 'long_text',
        label: 'Do you have any questions for us?',
        required: false,
        order: 5,
      },
    ],
  },
  {
    name: 'Availability & Scheduling',
    description: 'Gather candidate availability for interview scheduling',
    isPublished: true,
    fields: [
      {
        type: 'select',
        label: 'What is your preferred interview format?',
        required: true,
        options: JSON.stringify(['In-person', 'Video call', 'Phone call', 'No preference']),
        order: 0,
      },
      {
        type: 'select',
        label: 'What time zone are you in?',
        required: true,
        options: JSON.stringify([
          'EST (UTC-5)',
          'CST (UTC-6)',
          'MST (UTC-7)',
          'PST (UTC-8)',
          'GMT (UTC+0)',
          'CET (UTC+1)',
          'IST (UTC+5:30)',
          'Other',
        ]),
        order: 1,
      },
      {
        type: 'long_text',
        label: 'What days/times work best for you in the next two weeks?',
        required: true,
        order: 2,
      },
      {
        type: 'yes_no',
        label: 'Are you available for same-day interviews if needed?',
        required: false,
        order: 3,
      },
      {
        type: 'short_text',
        label: 'Best phone number to reach you',
        required: true,
        order: 4,
      },
      {
        type: 'email',
        label: 'Preferred email for scheduling confirmations',
        required: true,
        order: 5,
      },
    ],
  },
  {
    name: 'Professional References',
    description: 'Collect professional references from candidates',
    isPublished: true,
    fields: [
      {
        type: 'short_text',
        label: 'Reference 1: Full Name',
        required: true,
        order: 0,
      },
      {
        type: 'short_text',
        label: 'Reference 1: Title/Relationship',
        required: true,
        order: 1,
      },
      {
        type: 'email',
        label: 'Reference 1: Email',
        required: true,
        order: 2,
      },
      {
        type: 'short_text',
        label: 'Reference 1: Phone Number',
        required: false,
        order: 3,
      },
      {
        type: 'short_text',
        label: 'Reference 2: Full Name',
        required: true,
        order: 4,
      },
      {
        type: 'short_text',
        label: 'Reference 2: Title/Relationship',
        required: true,
        order: 5,
      },
      {
        type: 'email',
        label: 'Reference 2: Email',
        required: true,
        order: 6,
      },
      {
        type: 'short_text',
        label: 'Reference 2: Phone Number',
        required: false,
        order: 7,
      },
      {
        type: 'short_text',
        label: 'Reference 3: Full Name (Optional)',
        required: false,
        order: 8,
      },
      {
        type: 'short_text',
        label: 'Reference 3: Title/Relationship (Optional)',
        required: false,
        order: 9,
      },
      {
        type: 'email',
        label: 'Reference 3: Email (Optional)',
        required: false,
        order: 10,
      },
      {
        type: 'short_text',
        label: 'Reference 3: Phone Number (Optional)',
        required: false,
        order: 11,
      },
    ],
  },
];

async function seedForms() {
  console.log('🌱 Seeding default form templates...');

  try {
    // Find the first super_admin user to attribute templates to
    const adminUser = await db.query.users.findFirst({
      where: eq(users.role, 'super_admin'),
    });

    if (!adminUser) {
      console.error('❌ No admin user found. Please create an admin user first.');
      console.error('   Run: npm run seed (or create an admin via the UI)');
      process.exit(1);
    }

    console.log(`✓ Found admin user: ${adminUser.email} (ID: ${adminUser.id})`);

    let templatesCreated = 0;
    let fieldsCreated = 0;

    for (const template of DEFAULT_TEMPLATES) {
      // Check if template already exists
      const existing = await db.query.forms.findFirst({
        where: eq(forms.name, template.name),
      });

      if (existing) {
        console.log(`⊘ Template "${template.name}" already exists, skipping...`);
        continue;
      }

      // Create form
      const [createdForm] = await db.insert(forms).values({
        name: template.name,
        description: template.description,
        isPublished: template.isPublished,
        createdBy: adminUser.id,
      }).returning();

      templatesCreated++;
      console.log(`✓ Created template: "${template.name}"`);

      // Create fields
      const fieldsData = template.fields.map(field => ({
        formId: createdForm.id,
        type: field.type,
        label: field.label,
        required: field.required,
        options: field.options,
        order: field.order,
      }));

      await db.insert(formFields).values(fieldsData);
      fieldsCreated += fieldsData.length;
      console.log(`  └─ Added ${fieldsData.length} fields`);
    }

    console.log('');
    console.log('✅ Seeding complete!');
    console.log(`   Templates created: ${templatesCreated}`);
    console.log(`   Fields created: ${fieldsCreated}`);
    console.log('');
    console.log('💡 Tip: These templates are now available in the Forms modal when managing applications.');
  } catch (error) {
    console.error('❌ Error seeding forms:', error);
    process.exit(1);
  }
}

// Run seeding
seedForms()
  .then(() => {
    console.log('👋 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

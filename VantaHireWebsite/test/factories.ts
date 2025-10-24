/**
 * Test data factories for creating mock entities
 */

export function createMockUser(overrides: any = {}) {
  return {
    email: 'test@example.com',
    password: 'securePassword123',
    role: 'candidate',
    fullName: 'Test User',
    ...overrides,
  };
}

export function createMockJob(overrides: any = {}) {
  return {
    title: 'Software Engineer',
    company: 'Test Company',
    location: 'Remote',
    description: 'Test job description',
    requirements: 'Test requirements',
    salary: '100000-150000',
    type: 'full-time',
    ...overrides,
  };
}

export function createMockApplication(overrides: any = {}) {
  return {
    name: 'Test Applicant',
    email: 'applicant@example.com',
    phone: '+1234567890',
    coverLetter: 'Test cover letter',
    ...overrides,
  };
}

export function createMockFormTemplate(overrides: any = {}) {
  return {
    name: 'Test Form Template',
    description: 'Test form description',
    isPublished: true,
    fields: [
      {
        type: 'short_text',
        label: 'What is your full name?',
        required: true,
        order: 0,
      },
      {
        type: 'email',
        label: 'What is your email address?',
        required: true,
        order: 1,
      },
      {
        type: 'yes_no',
        label: 'Are you available to start immediately?',
        required: true,
        order: 2,
      },
    ],
    ...overrides,
  };
}

export function createMockFormInvitation(overrides: any = {}) {
  return {
    applicationId: 1,
    formId: 1,
    customMessage: 'Please complete this form',
    ...overrides,
  };
}

export function createMockFormAnswers(fields: any[]) {
  return fields.map((field, idx) => {
    let value;
    switch (field.type) {
      case 'short_text':
        value = 'Test Answer';
        break;
      case 'long_text':
        value = 'This is a longer test answer with more details.';
        break;
      case 'email':
        value = 'test@example.com';
        break;
      case 'yes_no':
        value = 'yes';
        break;
      case 'select':
        const options = field.options ? JSON.parse(field.options) : ['Option 1'];
        value = options[0];
        break;
      case 'date':
        value = '2024-01-15';
        break;
      case 'file':
        return {
          fieldId: field.id,
          fileUrl: 'https://example.com/file.pdf',
        };
      default:
        value = 'Default test value';
    }
    return {
      fieldId: field.id,
      value,
    };
  });
}

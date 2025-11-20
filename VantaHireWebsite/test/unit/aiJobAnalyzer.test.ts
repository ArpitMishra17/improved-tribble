import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Mock Groq SDK before importing the module
const mockCreate = vi.fn();
const mockGroqInstance = {
  chat: {
    completions: {
      create: mockCreate,
    },
  },
};

vi.mock('groq-sdk', () => {
  return {
    default: vi.fn(() => mockGroqInstance),
  };
});

// Import after mocking
const { generateFormQuestions } = await import('../../server/aiJobAnalyzer');

describe('generateFormQuestions', () => {
  beforeAll(() => {
    // Set up Groq API key for all tests
    process.env.GROQ_API_KEY = 'test-api-key';
  });

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('should generate form questions with valid inputs', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            fields: [
              {
                label: 'Describe your experience with React',
                description: 'Please provide specific examples',
                fieldType: 'long_text',
                required: true,
              },
              {
                label: 'Years of experience',
                fieldType: 'short_text',
                required: true,
              },
              {
                label: 'Preferred work style',
                fieldType: 'mcq',
                required: false,
                options: ['Remote', 'Hybrid', 'On-site'],
              },
            ],
          }),
        },
      }],
      usage: {
        prompt_tokens: 500,
        completion_tokens: 300,
      },
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await generateFormQuestions(
      'Looking for a senior React developer with 5+ years experience',
      ['React', 'TypeScript', 'Node.js'],
      ['technical_depth', 'communication']
    );

    expect(result).toBeDefined();
    expect(result.fields).toHaveLength(3);
    expect(result.fields[0]).toMatchObject({
      label: 'Describe your experience with React',
      fieldType: 'long_text',
      required: true,
    });
    expect(result.model_version).toBe('llama-3.3-70b-versatile');
    expect(result.tokensUsed).toEqual({
      input: 500,
      output: 300,
    });

    // Verify Groq API was called with correct parameters
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'llama-3.3-70b-versatile',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        temperature: 0.5,
      })
    );
  });

  it('should include skills in the prompt', async () => {
    const mockResponse = {
      choices: [{ message: { content: JSON.stringify({ fields: [] }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };

    mockCreate.mockResolvedValue(mockResponse);

    await generateFormQuestions(
      'Backend developer position',
      ['Python', 'Django', 'PostgreSQL'],
      ['technical_depth']
    );

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: any) => m.role === 'user');

    expect(userMessage.content).toContain('Required skills: Python, Django, PostgreSQL');
  });

  it('should include goals in the prompt', async () => {
    const mockResponse = {
      choices: [{ message: { content: JSON.stringify({ fields: [] }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };

    mockCreate.mockResolvedValue(mockResponse);

    await generateFormQuestions(
      'Product manager role',
      [],
      ['communication', 'leadership', 'problem_solving']
    );

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: any) => m.role === 'user');

    expect(userMessage.content).toContain('**Assessment Goals:** communication, leadership, problem_solving');
  });

  it('should handle empty skills and goals gracefully', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            fields: [{
              label: 'Tell us about yourself',
              fieldType: 'long_text',
              required: true,
            }],
          }),
        },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await generateFormQuestions(
      'General position',
      [],
      []
    );

    expect(result.fields).toHaveLength(1);

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: any) => m.role === 'user');

    expect(userMessage.content).toContain('No specific skills listed');
    expect(userMessage.content).toContain('**Assessment Goals:** general screening');
  });

  it('should validate and normalize field types', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            fields: [
              { label: 'Valid field', fieldType: 'long_text', required: true },
              { label: 'Invalid field', fieldType: 'invalid_type', required: false },
              { label: 'Missing type', required: true },
            ],
          }),
        },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await generateFormQuestions('Test job', [], []);

    // Invalid field type should default to 'long_text'
    expect(result.fields[1].fieldType).toBe('long_text');
    expect(result.fields[2].fieldType).toBe('long_text');
  });

  it('should preserve MCQ options when field type is mcq', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            fields: [{
              label: 'Experience level',
              fieldType: 'mcq',
              required: true,
              options: ['Junior', 'Mid-level', 'Senior', 'Lead'],
            }],
          }),
        },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await generateFormQuestions('Developer role', [], []);

    expect(result.fields[0].options).toEqual(['Junior', 'Mid-level', 'Senior', 'Lead']);
  });

  it('should strip options for non-MCQ fields', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            fields: [{
              label: 'Your name',
              fieldType: 'short_text',
              required: true,
              options: ['Should', 'Be', 'Ignored'], // Options on wrong field type
            }],
          }),
        },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await generateFormQuestions('Test job', [], []);

    expect(result.fields[0].options).toBeUndefined();
  });

  it('should handle missing labels with fallback', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            fields: [
              { fieldType: 'short_text', required: true }, // Missing label
            ],
          }),
        },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await generateFormQuestions('Test job', [], []);

    expect(result.fields[0].label).toBe('Untitled Question');
  });

  it('should handle Groq API errors gracefully', async () => {
    mockCreate.mockRejectedValue(new Error('Groq API timeout'));

    await expect(
      generateFormQuestions('Test job', [], [])
    ).rejects.toThrow('AI form generation unavailable: Groq API timeout');
  });

  it('should handle malformed JSON response', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: 'Not valid JSON {{{',
        },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };

    mockCreate.mockResolvedValue(mockResponse);

    await expect(
      generateFormQuestions('Test job', [], [])
    ).rejects.toThrow();
  });

  it('should handle empty fields array response', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({ fields: [] }),
        },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await generateFormQuestions('Test job', [], []);

    expect(result.fields).toEqual([]);
  });

  it('should handle missing usage data gracefully', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            fields: [{
              label: 'Test question',
              fieldType: 'long_text',
              required: true,
            }],
          }),
        },
      }],
      usage: undefined, // Missing usage data
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await generateFormQuestions('Test job', [], []);

    expect(result.tokensUsed).toEqual({
      input: 0,
      output: 0,
    });
  });

  it('should throw error when GROQ_API_KEY is not set', async () => {
    const originalKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    await expect(
      generateFormQuestions('Test job', [], [])
    ).rejects.toThrow('Groq API key not configured');

    // Restore for other tests
    process.env.GROQ_API_KEY = originalKey;
  });
});

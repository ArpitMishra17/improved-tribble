import Groq from "groq-sdk";

// Using Groq's llama-3.3-70b-versatile model for high-quality analysis
let groq: Groq | null = null;

// Lazy initialization of Groq client
function getGroqClient(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Groq API key not configured. AI features are disabled.');
  }
  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

// Check if AI features are available
export function isAIEnabled(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export interface JobAnalysisResult {
  clarity_score: number;
  inclusion_score: number;
  seo_score: number;
  overall_score: number;
  bias_flags: string[];
  seo_keywords: string[];
  suggestions: string[];
  model_version: string;
}

export async function analyzeJobDescription(title: string, description: string): Promise<JobAnalysisResult> {
  try {
    const client = getGroqClient();
    const prompt = `Evaluate the following job description for clarity, inclusion, and SEO optimization. Provide specific, actionable feedback.

Job Title: ${title}
Job Description: ${description}

Analyze and return a JSON object with:
- clarity_score (0-100): How clear and well-structured the description is
- inclusion_score (0-100): How inclusive and bias-free the language is
- seo_score (0-100): How well optimized for search engines
- overall_score (0-100): Average of the three scores
- bias_flags (array): Specific biased terms or phrases found
- seo_keywords (array): Important missing keywords that should be added
- suggestions (array): Specific improvement recommendations

Focus on:
1. Clarity: Clear requirements, structured information, professional tone
2. Inclusion: Gender-neutral language, avoiding age/culture bias, accessible language
3. SEO: Industry keywords, location terms, skill-specific terminology

Return only valid JSON without any additional text.`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert HR consultant specializing in job description optimization. Provide detailed, actionable feedback in valid JSON format only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0]?.message.content || "{}");

    // Validate and ensure all required fields exist
    return {
      clarity_score: Math.max(0, Math.min(100, result.clarity_score || 0)),
      inclusion_score: Math.max(0, Math.min(100, result.inclusion_score || 0)),
      seo_score: Math.max(0, Math.min(100, result.seo_score || 0)),
      overall_score: Math.max(0, Math.min(100, result.overall_score || 0)),
      bias_flags: Array.isArray(result.bias_flags) ? result.bias_flags : [],
      seo_keywords: Array.isArray(result.seo_keywords) ? result.seo_keywords : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      model_version: "llama-3.3-70b-versatile"
    };

  } catch (error) {
    console.error('Groq API error:', error);
    if (error instanceof Error) {
      throw new Error(`AI analysis unavailable: ${error.message}`);
    }
    throw new Error('AI analysis failed');
  }
}

export async function generateJobScore(
  title: string, 
  description: string, 
  historicalData?: { averageViews: number; averageConversion: number }
): Promise<number> {
  try {
    const analysis = await analyzeJobDescription(title, description);
    
    // Base score from AI analysis (70% weight)
    let score = analysis.overall_score * 0.7;
    
    // Historical performance factor (30% weight if available)
    if (historicalData) {
      const performanceFactor = Math.min(100, 
        (historicalData.averageViews / 50) * 20 + 
        (historicalData.averageConversion) * 2
      );
      score += performanceFactor * 0.3;
    } else {
      // If no historical data, give more weight to AI analysis
      score = analysis.overall_score;
    }
    
    return Math.round(Math.max(0, Math.min(100, score)));
  } catch (error) {
    console.error('Job scoring error:', error);
    return 0;
  }
}

export function calculateOptimizationSuggestions(analysis: JobAnalysisResult): string[] {
  const suggestions: string[] = [...analysis.suggestions];

  if (analysis.clarity_score < 70) {
    suggestions.push("Consider restructuring with clear sections: Overview, Requirements, Benefits");
  }

  if (analysis.inclusion_score < 80) {
    suggestions.push("Review language for gender-neutral terms and inclusive phrasing");
  }

  if (analysis.seo_score < 70) {
    suggestions.push("Add more industry-specific keywords and location terms");
  }

  if (analysis.bias_flags.length > 0) {
    suggestions.push(`Address flagged terms: ${analysis.bias_flags.join(", ")}`);
  }

  return suggestions.slice(0, 10); // Limit to top 10 suggestions
}

export interface CandidateSummaryResult {
  summary: string;
  suggestedAction: 'advance' | 'hold' | 'reject';
  suggestedActionReason: string;
  strengths: string[];
  concerns: string[];
  keyHighlights: string[];
  model_version: string;
  tokensUsed: {
    input: number;
    output: number;
  };
}

/**
 * Generate an AI-powered summary of a candidate's fit for a specific job
 *
 * @param resumeText - Extracted text from the candidate's resume
 * @param jobTitle - Title of the job position
 * @param jobDescription - Full job description
 * @param candidateName - Name of the candidate for personalization
 * @returns Structured summary with actionable recommendations
 */
export interface EmailDraftResult {
  subject: string;
  body: string;
  model_version: string;
  tokensUsed: {
    input: number;
    output: number;
  };
}

export async function generateEmailDraft(
  templateSubject: string,
  templateBody: string,
  candidateName: string,
  candidateEmail: string,
  jobTitle: string,
  companyName: string,
  tone: 'friendly' | 'formal' = 'friendly'
): Promise<EmailDraftResult> {
  try {
    const client = getGroqClient();

    const toneGuidance = tone === 'friendly'
      ? "Use a warm, conversational tone while maintaining professionalism. Be personable and engaging."
      : "Use a formal, professional tone. Be respectful and business-appropriate.";

    const prompt = `You are a professional recruiter drafting a personalized email to a candidate.

**Template Subject:** ${templateSubject}
**Template Body:** ${templateBody}

**Candidate Details:**
- Name: ${candidateName}
- Email: ${candidateEmail}
- Applied for: ${jobTitle}
- Company: ${companyName}

**Tone:** ${toneGuidance}

Your task:
1. Personalize the email template for this specific candidate
2. Replace any placeholders like [Candidate Name], [Job Title], [Company Name] with actual values
3. Enhance the message to be more engaging and specific to the role
4. Keep the core message and structure from the template
5. Ensure proper formatting with line breaks for readability

Return a JSON object with:
- **subject** (string): A personalized, compelling subject line (40-60 characters)
- **body** (string): The personalized email body with proper formatting. Use \\n\\n for paragraph breaks.

Return only valid JSON.`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert recruiter who writes engaging, personalized emails to candidates. Always return valid JSON format only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.6
    });

    const result = JSON.parse(response.choices[0]?.message.content || "{}");
    const usage = response.usage;

    // Validate and ensure required fields exist
    return {
      subject: result.subject || templateSubject,
      body: result.body || templateBody,
      model_version: "llama-3.3-70b-versatile",
      tokensUsed: {
        input: usage?.prompt_tokens || 0,
        output: usage?.completion_tokens || 0
      }
    };

  } catch (error) {
    console.error('Groq API error during email draft generation:', error);
    if (error instanceof Error) {
      throw new Error(`AI email draft unavailable: ${error.message}`);
    }
    throw new Error('AI email draft failed');
  }
}

export async function generateCandidateSummary(
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
  candidateName: string
): Promise<CandidateSummaryResult> {
  try {
    const client = getGroqClient();

    const prompt = `You are an expert technical recruiter reviewing a candidate for a position. Provide a comprehensive, actionable summary.

**Job Position:** ${jobTitle}

**Job Requirements:**
${jobDescription}

**Candidate:** ${candidateName}
**Resume:**
${resumeText}

Analyze the candidate's qualifications and provide a JSON response with:
1. **summary** (string, 150-250 words): A comprehensive overview of the candidate's fit, highlighting relevant experience, technical skills, and potential value. Write in a professional but conversational tone suitable for a recruiter dashboard.

2. **suggestedAction** (string): One of:
   - "advance": Strong fit, recommend moving to interview
   - "hold": Potential fit but needs more evaluation or has some gaps
   - "reject": Not a good fit for this role

3. **suggestedActionReason** (string, 50-100 words): Clear, specific reasoning for the suggested action based on job requirements vs. candidate qualifications.

4. **strengths** (array of strings, 3-5 items): Specific strengths relevant to this role (e.g., "8+ years Python experience", "Led teams of 10+ engineers", "Experience with AWS and microservices")

5. **concerns** (array of strings, 0-3 items): Specific gaps or concerns (e.g., "No mention of React experience", "Limited team leadership examples"). Leave empty if no significant concerns.

6. **keyHighlights** (array of strings, 3-5 items): Notable achievements or qualifications (e.g., "Built scalable systems handling 1M+ users", "Published research in ML conferences")

Be objective, specific, and actionable. Focus on job-relevant qualifications. Return only valid JSON.`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert technical recruiter with deep experience evaluating candidates across various technical roles. Provide detailed, objective, and actionable assessments in valid JSON format only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.4
    });

    const result = JSON.parse(response.choices[0]?.message.content || "{}");
    const usage = response.usage;

    // Validate and ensure all required fields exist
    return {
      summary: result.summary || "No summary generated",
      suggestedAction: ['advance', 'hold', 'reject'].includes(result.suggestedAction)
        ? result.suggestedAction
        : 'hold',
      suggestedActionReason: result.suggestedActionReason || "Requires further evaluation",
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      concerns: Array.isArray(result.concerns) ? result.concerns : [],
      keyHighlights: Array.isArray(result.keyHighlights) ? result.keyHighlights : [],
      model_version: "llama-3.3-70b-versatile",
      tokensUsed: {
        input: usage?.prompt_tokens || 0,
        output: usage?.completion_tokens || 0
      }
    };

  } catch (error) {
    console.error('Groq API error during candidate summary generation:', error);
    if (error instanceof Error) {
      throw new Error(`AI summary generation unavailable: ${error.message}`);
    }
    throw new Error('AI summary generation failed');
  }
}

// ============= PIPELINE ACTION ENHANCEMENT =============

export interface PipelineActionEnhancement {
  itemId: string;
  description: string;  // AI-generated context/tips
  impact: string;       // Brief impact statement
}

export interface PipelineActionsResult {
  enhancements: PipelineActionEnhancement[];
  additionalInsights: string[];  // Overall pipeline insights
  model_version: string;
  tokensUsed: {
    input: number;
    output: number;
  };
}

/**
 * Enhance pipeline action items with AI-generated context
 *
 * @param items - Array of action items from the rule engine
 * @param pipelineStats - Overall pipeline health metrics
 * @returns Enhanced descriptions and insights
 */
export async function enhancePipelineActions(
  items: Array<{ id: string; title: string; priority: string; category: string }>,
  pipelineStats: { healthScore: number; totalCandidates: number; openJobs: number }
): Promise<PipelineActionsResult> {
  try {
    const client = getGroqClient();

    const itemsDescription = items.map((item, i) =>
      `${i + 1}. [${item.priority.toUpperCase()}] ${item.title} (Category: ${item.category})`
    ).join('\n');

    const prompt = `You are an expert recruiting operations advisor. Analyze these pipeline hygiene action items and provide helpful context.

**Current Pipeline Stats:**
- Health Score: ${pipelineStats.healthScore}%
- Total Active Candidates: ${pipelineStats.totalCandidates}
- Open Jobs: ${pipelineStats.openJobs}

**Action Items to Enhance:**
${itemsDescription}

For each action item, provide:
1. **description** (string, 1-2 sentences): Specific, actionable context explaining WHY this matters and a QUICK TIP for addressing it
2. **impact** (string, 5-10 words): Brief statement of the positive impact of completing this action

Also provide 1-2 **additionalInsights** about the overall pipeline health based on the patterns you see in these items.

Return a JSON object with:
- **enhancements** (array): For each input item (in order), an object with: itemId (string, use the exact id provided), description (string), impact (string)
- **additionalInsights** (array of strings, 1-2 items): Brief overall observations

Be specific, practical, and encouraging. Focus on recruiter best practices. Return only valid JSON.`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert recruiting operations advisor who helps recruiters optimize their pipeline. Provide specific, actionable advice in valid JSON format only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.5
    });

    const result = JSON.parse(response.choices[0]?.message.content || "{}");
    const usage = response.usage;

    // Validate and map enhancements to their item IDs
    const enhancements: PipelineActionEnhancement[] = [];
    if (Array.isArray(result.enhancements)) {
      result.enhancements.forEach((enh: any, index: number) => {
        const originalItem = items[index];
        if (originalItem) {
          enhancements.push({
            itemId: enh.itemId || originalItem.id,
            description: enh.description || "",
            impact: enh.impact || "",
          });
        }
      });
    }

    return {
      enhancements,
      additionalInsights: Array.isArray(result.additionalInsights)
        ? result.additionalInsights.slice(0, 3)
        : [],
      model_version: "llama-3.3-70b-versatile",
      tokensUsed: {
        input: usage?.prompt_tokens || 0,
        output: usage?.completion_tokens || 0
      }
    };

  } catch (error) {
    console.error('Groq API error during pipeline action enhancement:', error);
    if (error instanceof Error) {
      throw new Error(`AI pipeline enhancement unavailable: ${error.message}`);
    }
    throw new Error('AI pipeline enhancement failed');
  }
}

// ============= FORM FIELD SUGGESTIONS =============

export interface FormFieldSuggestion {
  label: string;
  description?: string;
  fieldType: 'short_text' | 'long_text' | 'mcq' | 'scale';
  required: boolean;
  options?: string[];
}

export interface FormQuestionsResult {
  fields: FormFieldSuggestion[];
  model_version: string;
  tokensUsed: {
    input: number;
    output: number;
  };
}

/**
 * Generate AI-suggested screening questions for a job application form
 *
 * @param jobDescription - The job description text
 * @param skills - Array of required skills for the job
 * @param goals - Assessment goals (e.g., ["communication", "technical_depth", "culture_fit"])
 * @returns Structured form field suggestions
 */
export async function generateFormQuestions(
  jobDescription: string,
  skills: string[],
  goals: string[]
): Promise<FormQuestionsResult> {
  try {
    const client = getGroqClient();

    const goalsText = goals.length > 0
      ? goals.join(", ")
      : "general screening";

    const skillsText = skills.length > 0
      ? `Required skills: ${skills.join(", ")}`
      : "No specific skills listed";

    const prompt = `You are an expert HR consultant creating screening questions for job applications.

**Job Description:**
${jobDescription}

**${skillsText}**

**Assessment Goals:** ${goalsText}

Create 5-8 effective screening questions that help evaluate candidates for this role. Focus on:
1. **Communication**: Assess written communication and clarity
2. **Technical depth**: Evaluate relevant technical skills and experience
3. **Culture fit**: Understand work style, values, and motivations
4. **Role-specific**: Questions tailored to this specific job

For each question, provide:
- **label** (string): The question text (clear, specific, professional)
- **description** (string, optional): Additional context or instructions for the candidate
- **fieldType** (string): One of:
  - "short_text": For brief answers (name, URL, single sentence)
  - "long_text": For detailed answers (paragraphs, explanations)
  - "mcq": For multiple choice (provide options array)
  - "scale": For rating scales (1-5, strongly disagree to strongly agree)
- **required** (boolean): Whether this question is mandatory
- **options** (array of strings, only for mcq): The multiple choice options

Return a JSON object with a "fields" array containing 5-8 questions. Make questions:
- Specific and actionable (not generic)
- Relevant to the job description and skills
- Progressive in difficulty (start easier, get more specific)
- Diverse in format (mix text, MCQ, and scales)

Return only valid JSON.`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert HR consultant who creates effective, job-specific screening questions. Always return valid JSON format only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.5
    });

    const result = JSON.parse(response.choices[0]?.message.content || "{}");
    const usage = response.usage;

    // Validate and ensure all required fields exist
    const validatedFields: FormFieldSuggestion[] = Array.isArray(result.fields)
      ? result.fields.map((field: any) => ({
          label: field.label || "Untitled Question",
          description: field.description || undefined,
          fieldType: ['short_text', 'long_text', 'mcq', 'scale'].includes(field.fieldType)
            ? field.fieldType
            : 'long_text',
          required: typeof field.required === 'boolean' ? field.required : false,
          options: field.fieldType === 'mcq' && Array.isArray(field.options)
            ? field.options
            : undefined,
        }))
      : [];

    return {
      fields: validatedFields,
      model_version: "llama-3.3-70b-versatile",
      tokensUsed: {
        input: usage?.prompt_tokens || 0,
        output: usage?.completion_tokens || 0
      }
    };

  } catch (error) {
    console.error('Groq API error during form question generation:', error);
    if (error instanceof Error) {
      throw new Error(`AI form generation unavailable: ${error.message}`);
    }
    throw new Error('AI form generation failed');
  }
}
/**
 * Sanitize HTML description to plain text for structured data
 * Simple HTML tag stripping for SEO purposes
 */
export function sanitizeDescription(html: string): string {
  if (!html) return '';

  // Remove HTML tags using regex
  // This is safe for our use case (converting to plain text for SEO)
  let plainText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags and content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags and content
    .replace(/<[^>]+>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#039;/g, "'"); // Replace &#039; with '

  // Normalize whitespace
  return plainText.replace(/\s+/g, ' ').trim();
}

/**
 * Map job type to Google JobPosting employmentType enum
 */
export function mapEmploymentType(type: string | null): string | undefined {
  if (!type) return undefined;

  const mapping: Record<string, string> = {
    'full-time': 'FULL_TIME',
    'full time': 'FULL_TIME',
    'fulltime': 'FULL_TIME',
    'ft': 'FULL_TIME',
    'part-time': 'PART_TIME',
    'part time': 'PART_TIME',
    'parttime': 'PART_TIME',
    'pt': 'PART_TIME',
    'contract': 'CONTRACTOR',
    'contractor': 'CONTRACTOR',
    'freelance': 'CONTRACTOR',
    'temporary': 'TEMPORARY',
    'temp': 'TEMPORARY',
    'intern': 'INTERN',
    'internship': 'INTERN',
  };

  return mapping[type.toLowerCase()];
}

/**
 * Parse job location to determine if remote or physical location
 * Returns jobLocationType for remote, or jobLocation for physical
 */
export function parseJobLocation(location: string | null) {
  if (!location) return null;

  const lower = location.toLowerCase();

  // Check for remote indicators
  const remoteKeywords = ['remote', 'work from home', 'wfh', 'anywhere', 'virtual'];
  if (remoteKeywords.some(keyword => lower.includes(keyword))) {
    return { jobLocationType: 'TELECOMMUTE' };
  }

  // Handle multiple locations (e.g., "Bangalore/Mumbai") - use first one
  const firstLocation = location.split('/')[0]?.split(',')[0]?.trim() || '';

  // Default to India for APAC region
  // In future, can add country detection logic
  return {
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: firstLocation,
        addressCountry: 'IN', // Default to India
      },
    },
  };
}

/**
 * Format date to ISO 8601 for structured data
 * Returns ISO string or undefined if invalid
 */
export function formatISODate(date: Date | string | null | undefined): string | undefined {
  if (!date) return undefined;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return undefined;
    return dateObj.toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Validate JobPosting required fields
 * Returns array of error messages
 */
export function validateJobPosting(job: {
  title?: string;
  description?: string;
  createdAt?: Date | string | null;
  location?: string;
}): string[] {
  const errors: string[] = [];

  if (!job.title || job.title.trim().length === 0) {
    errors.push('Missing title');
  }

  if (!job.description || job.description.trim().length < 200) {
    errors.push('Description too short (minimum 200 characters for Google Jobs)');
  }

  if (!job.createdAt) {
    errors.push('Missing datePosted (createdAt)');
  } else {
    const date = formatISODate(job.createdAt);
    if (!date) {
      errors.push('Invalid datePosted format');
    }
  }

  if (!job.location || job.location.trim().length === 0) {
    errors.push('Missing location');
  }

  return errors;
}

/**
 * Generate JobPosting structured data for Google Jobs
 */
export function generateJobPostingSchema(job: {
  id: number;
  title: string;
  description: string;
  location: string;
  type: string | null;
  company?: string | null;
  createdAt: Date | string;
  deadline?: Date | string | null;
  expiresAt?: Date | string | null;
  slug?: string | null;
}, baseUrl: string = 'https://www.vantahire.com') {
  // Validate required fields
  const errors = validateJobPosting(job);
  if (errors.length > 0) {
    console.warn(`JobPosting validation errors for job ${job.id}:`, errors);
    return null;
  }

  // Sanitize description to plain text
  const plainDescription = sanitizeDescription(job.description);

  // Map employment type
  const employmentType = mapEmploymentType(job.type);

  // Parse location
  const locationData = parseJobLocation(job.location);

  // Format dates
  const datePosted = formatISODate(job.createdAt);
  const validThrough = formatISODate(job.expiresAt || job.deadline);

  // Build canonical URL with slug if available
  const jobUrl = job.slug
    ? `${baseUrl}/jobs/${job.id}-${job.slug}`
    : `${baseUrl}/jobs/${job.id}`;

  // Use company name from job if available, otherwise VantaHire
  const companyName = job.company || 'VantaHire';

  const jobPosting: any = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: plainDescription,
    datePosted,
    hiringOrganization: {
      '@type': 'Organization',
      name: companyName,
      logo: `${baseUrl}/logo.png`,
    },
    identifier: {
      '@type': 'PropertyValue',
      name: companyName,
      value: job.id.toString(),
    },
    directApply: true,
    jobLocation: locationData?.jobLocation,
    jobLocationType: locationData?.jobLocationType,
  };

  // Add optional fields
  if (employmentType) {
    jobPosting.employmentType = employmentType;
  }

  if (validThrough) {
    jobPosting.validThrough = validThrough;
  }

  // Add URL
  jobPosting.url = jobUrl;

  return jobPosting;
}

/**
 * Generate sitemap XML for jobs
 */
export function generateJobsSitemapXML(jobs: Array<{
  id: number;
  slug?: string | null;
  updatedAt?: Date | string;
  createdAt: Date | string;
}>, baseUrl: string = 'https://www.vantahire.com'): string {
  const urlEntries = jobs.map(job => {
    const url = job.slug
      ? `${baseUrl}/jobs/${job.id}-${job.slug}`
      : `${baseUrl}/jobs/${job.id}`;

    const lastmod = formatISODate(job.updatedAt || job.createdAt);

    return `  <url>
    <loc>${url}</loc>
    ${lastmod ? `<lastmod>${lastmod.split('T')[0]}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

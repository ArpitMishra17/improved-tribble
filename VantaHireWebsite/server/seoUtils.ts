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
 * Detect country from location string
 */
function detectCountry(location: string): string {
  const lower = location.toLowerCase();

  // India cities/regions
  if (/\b(india|bangalore|bengaluru|mumbai|delhi|chennai|hyderabad|pune|kolkata|gurgaon|gurugram|noida|ahmedabad)\b/.test(lower)) {
    return 'IN';
  }
  // Singapore
  if (/\bsingapore\b/.test(lower)) return 'SG';
  // Malaysia
  if (/\b(malaysia|kuala lumpur|kl)\b/.test(lower)) return 'MY';
  // Philippines
  if (/\b(philippines|manila|cebu)\b/.test(lower)) return 'PH';
  // Indonesia
  if (/\b(indonesia|jakarta)\b/.test(lower)) return 'ID';
  // Vietnam
  if (/\b(vietnam|ho chi minh|hanoi)\b/.test(lower)) return 'VN';
  // Thailand
  if (/\b(thailand|bangkok)\b/.test(lower)) return 'TH';
  // Australia
  if (/\b(australia|sydney|melbourne|brisbane)\b/.test(lower)) return 'AU';
  // USA
  if (/\b(usa|united states|new york|san francisco|california|texas|seattle)\b/.test(lower)) return 'US';
  // UK
  if (/\b(uk|united kingdom|london|manchester)\b/.test(lower)) return 'GB';
  // UAE
  if (/\b(uae|dubai|abu dhabi)\b/.test(lower)) return 'AE';

  return 'IN'; // Default to India for APAC focus
}

/**
 * Parse job location to determine if remote or physical location
 * Returns jobLocationType for remote, or jobLocation for physical
 * For remote jobs, also returns applicantLocationRequirements if region-specific
 */
export function parseJobLocation(location: string | null) {
  if (!location) return null;

  const lower = location.toLowerCase();

  // Check for remote indicators
  const remoteKeywords = ['remote', 'work from home', 'wfh', 'anywhere', 'virtual', 'distributed'];
  const isRemote = remoteKeywords.some(keyword => lower.includes(keyword));

  if (isRemote) {
    // Check if remote is region-specific (e.g., "Remote - India", "Remote (US only)")
    const countryCode = detectCountry(location);
    const isGlobalRemote = lower.includes('anywhere') || lower.includes('global') || lower.includes('worldwide');

    if (isGlobalRemote) {
      return { jobLocationType: 'TELECOMMUTE' };
    }

    // Region-specific remote
    return {
      jobLocationType: 'TELECOMMUTE',
      applicantLocationRequirements: {
        '@type': 'Country',
        name: countryCode,
      },
    };
  }

  // Handle multiple locations (e.g., "Bangalore/Mumbai") - use first one
  const firstLocation = location.split('/')[0]?.split(',')[0]?.trim() || '';
  const countryCode = detectCountry(location);

  return {
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: firstLocation,
        addressCountry: countryCode,
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
  skills?: string[] | null;
  company?: string | null;
  clientName?: string | null;
  clientDomain?: string | null;
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

  // Build canonical URL with slug if available (prefer pure slug for SEO)
  const jobUrl = job.slug
    ? `${baseUrl}/jobs/${job.slug}`
    : `${baseUrl}/jobs/${job.id}`;

  // Determine hiring organization (prefer client if available)
  const orgName = job.clientName || job.company || 'VantaHire';
  const hiringOrganization: any = {
    '@type': 'Organization',
    name: orgName,
    logo: `${baseUrl}/logo.png`,
  };

  // Add client domain as sameAs if available
  if (job.clientDomain) {
    hiringOrganization.sameAs = job.clientDomain.startsWith('http')
      ? job.clientDomain
      : `https://${job.clientDomain}`;
  }

  const jobPosting: any = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: plainDescription,
    datePosted,
    hiringOrganization,
    identifier: {
      '@type': 'PropertyValue',
      name: orgName,
      value: job.id.toString(),
    },
    directApply: true,
    url: jobUrl,
  };

  // Add location data
  if (locationData?.jobLocation) {
    jobPosting.jobLocation = locationData.jobLocation;
  }
  if (locationData?.jobLocationType) {
    jobPosting.jobLocationType = locationData.jobLocationType;
  }
  if ((locationData as any)?.applicantLocationRequirements) {
    jobPosting.applicantLocationRequirements = (locationData as any).applicantLocationRequirements;
  }

  // Add optional fields
  if (employmentType) {
    jobPosting.employmentType = employmentType;
  }

  if (validThrough) {
    jobPosting.validThrough = validThrough;
  }

  // Add skills if available
  if (job.skills && job.skills.length > 0) {
    jobPosting.skills = job.skills.join(', ');
  }

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
    // Prefer pure slug for SEO-friendly URLs
    const url = job.slug
      ? `${baseUrl}/jobs/${job.slug}`
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

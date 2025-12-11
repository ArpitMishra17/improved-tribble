/**
 * Client-side SEO helper functions
 */

import { Job } from "@shared/schema";

/**
 * Strip HTML tags and normalize whitespace for meta descriptions
 */
export function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = div.textContent || div.innerText || '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generate meta description from job description
 */
export function generateJobMetaDescription(job: Job): string {
  const plainText = stripHtml(job.description);
  const description = `Apply for ${job.title} at ${job.location}. ${plainText}`;
  return truncateText(description, 155); // SEO optimal length
}

/**
 * Generate JobPosting JSON-LD structured data
 * Returns null if validation fails (mirrors server behavior)
 */
export function generateJobPostingJsonLd(job: Job, baseUrl: string = window.location.origin) {
  // Validate minimum requirements for Google Jobs
  if (!job.title || job.title.trim().length === 0) {
    console.warn('JobPosting validation failed: missing title', job.id);
    return null;
  }

  if (!job.location || job.location.trim().length === 0) {
    console.warn('JobPosting validation failed: missing location', job.id);
    return null;
  }

  if (!job.createdAt) {
    console.warn('JobPosting validation failed: missing createdAt', job.id);
    return null;
  }

  // Validate date is valid
  const datePosted = new Date(job.createdAt);
  if (isNaN(datePosted.getTime())) {
    console.warn('JobPosting validation failed: invalid createdAt date', job.id);
    return null;
  }

  // Sanitize description
  const plainDescription = stripHtml(job.description);

  // Google Jobs requires minimum 200 characters in description
  if (plainDescription.length < 120) {
    console.warn('JobPosting validation failed: description too short', job.id, plainDescription.length);
    return null;
  }

  // Map employment type
  const employmentTypeMap: Record<string, string> = {
    'full-time': 'FULL_TIME',
    'part-time': 'PART_TIME',
    'contract': 'CONTRACTOR',
    'temporary': 'TEMPORARY',
    'intern': 'INTERN',
  };
  const employmentType = job.type ? employmentTypeMap[job.type.toLowerCase()] : undefined;

  // Determine location type
  const isRemote = job.location?.toLowerCase().includes('remote') ||
                   job.location?.toLowerCase().includes('work from home') ||
                   job.location?.toLowerCase().includes('wfh');

  // Try to detect country from location string
  const detectCountry = (loc: string): string => {
    const locLower = loc.toLowerCase();
    if (locLower.includes('india') || locLower.includes('bangalore') || locLower.includes('mumbai') ||
        locLower.includes('delhi') || locLower.includes('chennai') || locLower.includes('hyderabad') ||
        locLower.includes('pune') || locLower.includes('kolkata') || locLower.includes('gurgaon') ||
        locLower.includes('noida')) return 'IN';
    if (locLower.includes('singapore')) return 'SG';
    if (locLower.includes('malaysia') || locLower.includes('kuala lumpur')) return 'MY';
    if (locLower.includes('philippines') || locLower.includes('manila')) return 'PH';
    if (locLower.includes('indonesia') || locLower.includes('jakarta')) return 'ID';
    if (locLower.includes('vietnam') || locLower.includes('ho chi minh')) return 'VN';
    if (locLower.includes('thailand') || locLower.includes('bangkok')) return 'TH';
    if (locLower.includes('australia') || locLower.includes('sydney') || locLower.includes('melbourne')) return 'AU';
    if (locLower.includes('usa') || locLower.includes('united states') || locLower.includes('new york') ||
        locLower.includes('san francisco') || locLower.includes('california')) return 'US';
    if (locLower.includes('uk') || locLower.includes('united kingdom') || locLower.includes('london')) return 'GB';
    return 'IN'; // Default to India
  };

  const location = isRemote
    ? { jobLocationType: 'TELECOMMUTE' }
    : {
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: job.location?.split('/')[0]?.trim() || job.location,
            addressCountry: detectCountry(job.location || ''),
          },
        },
      };

  // Generate canonical URL
  const jobUrl = job.slug
    ? `${baseUrl}/jobs/${job.id}-${job.slug}`
    : `${baseUrl}/jobs/${job.id}`;

  // Use company name from job if available, otherwise VantaHire
  // Note: company is added via relations in some queries, not always present
  const companyName = (job as any).company || 'VantaHire';

  const jobPosting: any = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: plainDescription,
    datePosted: new Date(job.createdAt).toISOString(),
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
    url: jobUrl,
    ...location,
  };

  // Add optional fields
  if (employmentType) {
    jobPosting.employmentType = employmentType;
  }

  if (job.expiresAt || job.deadline) {
    const validThrough = job.expiresAt || job.deadline;
    if (validThrough) {
      jobPosting.validThrough = new Date(validThrough).toISOString();
    }
  }

  return jobPosting;
}

/**
 * Generate canonical URL for job with slug support
 */
export function getJobCanonicalUrl(job: Job, baseUrl: string = window.location.origin): string {
  return job.slug
    ? `${baseUrl}/jobs/${job.id}-${job.slug}`
    : `${baseUrl}/jobs/${job.id}`;
}

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

  const location = isRemote
    ? { jobLocationType: 'TELECOMMUTE' }
    : {
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: job.location?.split('/')[0].trim(),
            addressCountry: 'IN',
          },
        },
      };

  // Generate canonical URL
  const jobUrl = job.slug
    ? `${baseUrl}/jobs/${job.id}-${job.slug}`
    : `${baseUrl}/jobs/${job.id}`;

  const jobPosting: any = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: plainDescription,
    datePosted: new Date(job.createdAt).toISOString(),
    hiringOrganization: {
      '@type': 'Organization',
      name: 'VantaHire',
      sameAs: 'https://www.linkedin.com/company/vantahire/',
      logo: `${baseUrl}/logo.png`,
    },
    identifier: {
      '@type': 'PropertyValue',
      name: 'VantaHire',
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

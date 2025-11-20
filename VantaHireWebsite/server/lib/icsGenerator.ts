/**
 * ICS Calendar File Generator
 *
 * Generates .ics (iCalendar) files for interview invitations
 * Compatible with Google Calendar, Outlook, Apple Calendar, etc.
 */

import { createEvent, EventAttributes, ReturnObject } from 'ics';

export interface InterviewDetails {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  interviewDate: string; // YYYY-MM-DD format
  interviewTime: string; // HH:MM format (24-hour)
  interviewLocation: string;
  recruiterName?: string;
  recruiterEmail?: string;
  notes?: string;
}

/**
 * Generate an ICS calendar event for an interview
 *
 * @param details - Interview details
 * @returns ICS file content as string
 */
export function generateInterviewICS(details: InterviewDetails): string {
  try {
    // Parse date and time
    const dateParts = details.interviewDate.split('-').map(Number);
    const timeParts = details.interviewTime.split(':').map(Number);

    const year = dateParts[0];
    const month = dateParts[1];
    const day = dateParts[2];
    const hours = timeParts[0];
    const minutes = timeParts[1];

    // Validate parsed values - TypeScript requires explicit validation
    if (
      year === undefined || isNaN(year) ||
      month === undefined || isNaN(month) ||
      day === undefined || isNaN(day) ||
      hours === undefined || isNaN(hours) ||
      minutes === undefined || isNaN(minutes)
    ) {
      throw new Error('Invalid date or time format');
    }

    // Create event start time (assuming 1 hour duration by default)
    // Type assertion needed because ics library types are not perfect
    const startDate = [year, month, day, hours, minutes] as [number, number, number, number, number];
    const endDate = [year, month, day, hours + 1, minutes] as [number, number, number, number, number];

    // Build event attributes - organizer is optional but must be a full Person object when present
    const event: EventAttributes = {
      start: startDate,
      end: endDate,
      title: `Interview: ${details.jobTitle}`,
      description: `Interview for ${details.jobTitle} position with ${details.candidateName}${details.notes ? '\n\nNotes: ' + details.notes : ''}`,
      location: details.interviewLocation,
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      ...(details.recruiterName && details.recruiterEmail
        ? { organizer: { name: details.recruiterName, email: details.recruiterEmail } }
        : {}),
      attendees: [
        {
          name: details.candidateName,
          email: details.candidateEmail,
          rsvp: true,
          partstat: 'NEEDS-ACTION',
          role: 'REQ-PARTICIPANT'
        }
      ],
      alarms: [
        {
          action: 'display',
          description: 'Interview Reminder',
          trigger: { hours: 1, minutes: 0, before: true }
        },
        {
          action: 'display',
          description: 'Interview in 15 minutes',
          trigger: { hours: 0, minutes: 15, before: true }
        }
      ]
    };

    // Generate ICS content
    const result: ReturnObject = createEvent(event);

    if (result.error) {
      console.error('[ICS Generator] Error creating event:', result.error);
      throw new Error(`Failed to generate calendar event: ${result.error.message}`);
    }

    if (!result.value) {
      throw new Error('ICS generation returned empty value');
    }

    return result.value;
  } catch (error) {
    console.error('[ICS Generator] Error:', error);
    throw new Error(`Failed to generate ICS file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the suggested filename for the ICS file
 *
 * @param jobTitle - Job title
 * @param candidateName - Candidate name
 * @returns Filename in format: interview-{job}-{candidate}.ics
 */
export function getICSFilename(jobTitle: string, candidateName: string): string {
  const sanitize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

  return `interview-${sanitize(jobTitle)}-${sanitize(candidateName)}.ics`;
}

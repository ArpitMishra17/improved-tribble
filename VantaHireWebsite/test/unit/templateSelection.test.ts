import { describe, it, expect } from 'vitest';

/**
 * Helper function to determine smart default template type based on stage and status
 * This mirrors the logic in ApplicationDetailPanel.tsx
 */
function getSmartTemplateType(stageName: string, status: string): string | null {
  const lowerStageName = stageName.toLowerCase();

  // Check rejection first (status takes priority)
  if (status === 'rejected' || lowerStageName.includes('reject')) {
    return 'rejection';
  } else if (lowerStageName.includes('interview') || lowerStageName.includes('screening')) {
    return 'interview_invite';
  } else if (lowerStageName.includes('offer')) {
    return 'offer_extended';
  }

  return null;
}

describe('Smart Template Selection Logic', () => {
  describe('Interview context', () => {
    it('should select interview_invite for stage containing "interview"', () => {
      expect(getSmartTemplateType('Phone Interview', 'submitted')).toBe('interview_invite');
      expect(getSmartTemplateType('Technical Interview', 'submitted')).toBe('interview_invite');
      expect(getSmartTemplateType('Final Interview Round', 'submitted')).toBe('interview_invite');
    });

    it('should select interview_invite for stage containing "screening"', () => {
      expect(getSmartTemplateType('Initial Screening', 'submitted')).toBe('interview_invite');
      expect(getSmartTemplateType('Phone Screening', 'submitted')).toBe('interview_invite');
      expect(getSmartTemplateType('Screening Call', 'submitted')).toBe('interview_invite');
    });

    it('should be case-insensitive', () => {
      expect(getSmartTemplateType('INTERVIEW', 'submitted')).toBe('interview_invite');
      expect(getSmartTemplateType('Interview', 'submitted')).toBe('interview_invite');
      expect(getSmartTemplateType('SCREENING', 'submitted')).toBe('interview_invite');
    });
  });

  describe('Rejection context', () => {
    it('should select rejection when status is rejected', () => {
      expect(getSmartTemplateType('Applied', 'rejected')).toBe('rejection');
      expect(getSmartTemplateType('Phone Screen', 'rejected')).toBe('rejection');
      expect(getSmartTemplateType('Any Stage', 'rejected')).toBe('rejection');
    });

    it('should select rejection for stage containing "reject"', () => {
      expect(getSmartTemplateType('Rejected', 'submitted')).toBe('rejection');
      expect(getSmartTemplateType('Rejection', 'submitted')).toBe('rejection');
    });

    it('should prioritize rejection over other matches when status is rejected', () => {
      // Even if stage contains "interview", rejected status should win
      expect(getSmartTemplateType('Interview', 'rejected')).toBe('rejection');
      expect(getSmartTemplateType('Offer Stage', 'rejected')).toBe('rejection');
    });
  });

  describe('Offer context', () => {
    it('should select offer_extended for stage containing "offer"', () => {
      expect(getSmartTemplateType('Offer', 'submitted')).toBe('offer_extended');
      expect(getSmartTemplateType('Offer Pending', 'submitted')).toBe('offer_extended');
      expect(getSmartTemplateType('Make Offer', 'submitted')).toBe('offer_extended');
    });

    it('should be case-insensitive', () => {
      expect(getSmartTemplateType('OFFER', 'submitted')).toBe('offer_extended');
      expect(getSmartTemplateType('Offer', 'submitted')).toBe('offer_extended');
    });
  });

  describe('No match cases', () => {
    it('should return null for stages without keywords', () => {
      expect(getSmartTemplateType('Applied', 'submitted')).toBeNull();
      expect(getSmartTemplateType('Under Review', 'submitted')).toBeNull();
      expect(getSmartTemplateType('Assessment', 'submitted')).toBeNull();
      expect(getSmartTemplateType('Reference Check', 'submitted')).toBeNull();
    });

    it('should return null for empty stage name', () => {
      expect(getSmartTemplateType('', 'submitted')).toBeNull();
    });
  });

  describe('Priority order', () => {
    it('should check rejection status first (takes priority over stage)', () => {
      // Rejected status should override stage-based selection
      expect(getSmartTemplateType('Interview', 'rejected')).toBe('rejection');
      expect(getSmartTemplateType('Offer', 'rejected')).toBe('rejection');
      expect(getSmartTemplateType('Screening', 'rejected')).toBe('rejection');
    });

    it('should use stage keywords when status is not rejected', () => {
      // If NOT rejected, stage keywords should work normally
      expect(getSmartTemplateType('Interview', 'submitted')).toBe('interview_invite');
      expect(getSmartTemplateType('Interview', 'in_progress')).toBe('interview_invite');
      expect(getSmartTemplateType('Offer', 'submitted')).toBe('offer_extended');
    });

    it('should check rejection before offer when both in stage name', () => {
      // If both "offer" and "reject" in stage name (unlikely), rejection wins
      expect(getSmartTemplateType('Reject Offer', 'submitted')).toBe('rejection');
    });
  });
});

# Pipeline Action Checklist - Implementation Plan

## Overview

Replace the current 4-card AI Insights section with a single actionable checklist that guides recruiters through pipeline hygiene tasks. The system uses rule-based generation for instant display, with AI enhancement for context and prioritization.

---

## Current State (To Remove)

```
┌─────────────────┐ ┌─────────────────┐
│ Needs Attention │ │ Conversion Funnel│
├─────────────────┤ ├─────────────────┤
│ JD Improvements │ │ Stage Delays    │
└─────────────────┘ └─────────────────┘
```

**Files to deprecate:**
- `client/src/components/recruiter/RecruiterAiInsightsSection.tsx` (remove usage, keep file for reference)

---

## New State (To Build)

```
┌──────────────────────────────────────────────────────────────┐
│ 🎯 Pipeline Actions                    Score: 68% → 100%    │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ URGENT (2)                                                   │
│ ○ Review 5 candidates stuck in Screening for 7+ days    →   │
│ ○ Follow up on offer sent to Jane Doe (5 days waiting)  →   │
│                                                              │
│ IMPORTANT (3)                                                │
│ ○ Schedule interviews for 3 shortlisted candidates      →   │
│ ○ Add location to "Senior Dev" job posting              →   │
│ ○ Source more candidates for "PM Role" (only 2)         →   │
│                                                              │
│ MAINTENANCE (1)                                              │
│ ○ Archive "Intern" role - no activity in 30 days        →   │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│ Complete all items to unlock    [ Reanalyze ] (disabled)    │
└──────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DATA FLOW                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. PAGE LOAD                                                │
│     ↓                                                        │
│  2. Fetch Pipeline Data (existing APIs)                      │
│     - /api/my-applications-received                          │
│     - /api/analytics/job-health                              │
│     - /api/analytics/nudges                                  │
│     - /api/pipeline/stages                                   │
│     ↓                                                        │
│  3. Rule Engine generates ActionItems (instant, client-side) │
│     ↓                                                        │
│  4. Display Checklist immediately                            │
│     ↓                                                        │
│  5. Load cached AI enhancement (background)                  │
│     - If cache hit → merge AI descriptions                   │
│     - If cache miss → show rule-based only                   │
│     ↓                                                        │
│  6. User completes items (checkbox + navigate to action)     │
│     ↓                                                        │
│  7. All items checked → Enable "Reanalyze" button            │
│     ↓                                                        │
│  8. User clicks "Reanalyze"                                  │
│     - Fetch fresh pipeline data                              │
│     - Compare to snapshot (verify completions)               │
│     - Send to AI with context                                │
│     - Generate new checklist                                 │
│     - Cache result                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### ActionItem
```typescript
type ActionItem = {
  id: string;                    // Stable ID: "stuck-stage-{stageId}"
  priority: 'urgent' | 'important' | 'maintenance';
  category: 'candidate' | 'job' | 'communication' | 'pipeline';
  title: string;                 // "Review 5 candidates stuck in Screening"
  description?: string;          // AI-enhanced context (optional)
  completionType: 'action' | 'outcome';
  link?: string;                 // Navigation target when clicked
  metadata: {
    type: 'stuck_candidates' | 'unreviewed_apps' | 'low_pipeline' |
          'pending_offer' | 'jd_quality' | 'stale_job' | 'no_interviews';
    count?: number;
    jobId?: number;
    stageId?: number;
    daysSince?: number;
  };
};
```

### ChecklistSession
```typescript
type ChecklistSession = {
  id: string;                    // UUID for this session
  userId: number;
  generatedAt: string;           // ISO timestamp
  snapshot: PipelineSnapshot;    // Data at generation time
  items: ActionItem[];
  completedIds: string[];        // IDs user has checked
  aiEnhanced: boolean;           // Whether AI layer was applied
};

type PipelineSnapshot = {
  stuckByStage: Record<number, { count: number; candidateIds: number[] }>;
  unreviewedCount: number;
  pendingOfferCount: number;
  jobsWithLowPipeline: Array<{ jobId: number; count: number }>;
  staleJobs: Array<{ jobId: number; daysSinceActivity: number }>;
  interviewsScheduled: number;
};
```

---

## Rule Engine

### Rules (Priority Ordered)

| # | Rule | Priority | Trigger Condition | Title Template |
|---|------|----------|-------------------|----------------|
| 1 | Pending Offers | urgent | Offers waiting > 3 days | "Follow up on offer to {name} ({days} days waiting)" |
| 2 | Stuck Candidates | urgent | Candidates in stage > 7 days | "Review {count} candidates stuck in {stage}" |
| 3 | Unreviewed Apps | urgent | New apps > 48 hours | "Review {count} new applications" |
| 4 | No Interviews | important | Shortlisted but no interview scheduled | "Schedule interviews for {count} shortlisted" |
| 5 | Low Pipeline | important | Job has < 3 active candidates | "Source more for {jobTitle} (only {count})" |
| 6 | JD Quality | important | Missing location/salary/short desc | "Improve JD for {jobTitle}" |
| 7 | HM Feedback | important | Awaiting feedback > 5 days | "Request feedback for {count} candidates" |
| 8 | Stale Jobs | maintenance | No activity > 30 days | "Review or archive {jobTitle}" |
| 9 | Status Updates | maintenance | Candidates > 14 days no communication | "Send updates to {count} candidates" |

### Rule Implementation
```typescript
// client/src/lib/pipeline-rules.ts

export function generateActionItems(data: PipelineData): ActionItem[] {
  const items: ActionItem[] = [];

  // Rule 1: Pending offers (URGENT)
  data.pendingOffers.forEach(offer => {
    if (offer.daysSinceSent > 3) {
      items.push({
        id: `pending-offer-${offer.applicationId}`,
        priority: 'urgent',
        category: 'communication',
        title: `Follow up on offer to ${offer.candidateName} (${offer.daysSinceSent} days)`,
        completionType: 'action',
        link: `/applications/${offer.applicationId}`,
        metadata: { type: 'pending_offer', daysSince: offer.daysSinceSent }
      });
    }
  });

  // Rule 2: Stuck candidates (URGENT if > 7 days, IMPORTANT if > 3 days)
  Object.entries(data.stuckByStage).forEach(([stageId, info]) => {
    if (info.count > 0 && info.maxDays > 3) {
      items.push({
        id: `stuck-stage-${stageId}`,
        priority: info.maxDays > 7 ? 'urgent' : 'important',
        category: 'candidate',
        title: `Review ${info.count} candidates stuck in ${info.stageName} (${info.maxDays}+ days)`,
        completionType: 'action',
        link: `/applications?stage=${stageId}&stale=true`,
        metadata: { type: 'stuck_candidates', stageId: Number(stageId), count: info.count }
      });
    }
  });

  // Rule 3: Unreviewed applications (URGENT if > 48hrs)
  if (data.unreviewedCount > 0) {
    items.push({
      id: 'unreviewed-apps',
      priority: data.oldestUnreviewedHours > 48 ? 'urgent' : 'important',
      category: 'candidate',
      title: `Review ${data.unreviewedCount} new applications`,
      completionType: 'action',
      link: '/applications?status=new',
      metadata: { type: 'unreviewed_apps', count: data.unreviewedCount }
    });
  }

  // Rule 4: No interviews scheduled for shortlisted
  if (data.shortlistedNoInterview > 0) {
    items.push({
      id: 'schedule-interviews',
      priority: 'important',
      category: 'candidate',
      title: `Schedule interviews for ${data.shortlistedNoInterview} shortlisted candidates`,
      completionType: 'action',
      link: '/applications?status=shortlisted&noInterview=true',
      metadata: { type: 'no_interviews', count: data.shortlistedNoInterview }
    });
  }

  // Rule 5: Low pipeline jobs
  data.jobsWithLowPipeline.forEach(job => {
    items.push({
      id: `low-pipeline-${job.jobId}`,
      priority: 'important',
      category: 'job',
      title: `Source more for "${job.title}" (only ${job.activeCount} candidates)`,
      completionType: 'action',
      link: `/jobs/${job.jobId}`,
      metadata: { type: 'low_pipeline', jobId: job.jobId, count: job.activeCount }
    });
  });

  // Rule 6: JD quality issues
  data.jdIssues.forEach(job => {
    items.push({
      id: `jd-quality-${job.jobId}`,
      priority: 'important',
      category: 'job',
      title: `Improve JD for "${job.title}" - ${job.issue}`,
      completionType: 'action',
      link: `/jobs/${job.jobId}/edit`,
      metadata: { type: 'jd_quality', jobId: job.jobId }
    });
  });

  // Rule 7: Stale jobs
  data.staleJobs.forEach(job => {
    items.push({
      id: `stale-job-${job.jobId}`,
      priority: 'maintenance',
      category: 'job',
      title: `Review or archive "${job.title}" (${job.daysSinceActivity} days inactive)`,
      completionType: 'action',
      link: `/jobs/${job.jobId}`,
      metadata: { type: 'stale_job', jobId: job.jobId, daysSince: job.daysSinceActivity }
    });
  });

  return items;
}
```

---

## Completion Verification

When user clicks "Reanalyze", verify items were actually completed by comparing data:

```typescript
// client/src/lib/verify-completions.ts

const LOW_PIPELINE_THRESHOLD = 3; // Job needs at least 3 candidates to be "healthy"

export function verifyCompletions(
  items: ActionItem[],
  oldSnapshot: PipelineSnapshot,
  newData: PipelineData
): VerificationResult {
  const results: Record<string, { verified: boolean; change: string; mode: 'auto' | 'manual' }> = {};

  items.forEach(item => {
    switch (item.metadata.type) {
      case 'stuck_candidates':
        const oldStuck = oldSnapshot.stuckByStage[item.metadata.stageId!]?.count || 0;
        const newStuck = newData.stuckByStage[item.metadata.stageId!]?.count || 0;
        results[item.id] = {
          verified: newStuck < oldStuck,
          change: `${oldStuck} → ${newStuck}`,
          mode: 'auto'
        };
        break;

      case 'unreviewed_apps':
        results[item.id] = {
          verified: newData.unreviewedCount < oldSnapshot.unreviewedCount,
          change: `${oldSnapshot.unreviewedCount} → ${newData.unreviewedCount}`,
          mode: 'auto'
        };
        break;

      case 'low_pipeline':
        const oldPipeline = oldSnapshot.jobsWithLowPipeline.find(j => j.jobId === item.metadata.jobId);
        const newPipeline = newData.jobsWithLowPipeline.find(j => j.jobId === item.metadata.jobId);
        const newCount = newPipeline?.count ?? 999; // If removed from list, it's healthy
        // Verified if: job removed from low list OR count >= threshold
        results[item.id] = {
          verified: !newPipeline || newCount >= LOW_PIPELINE_THRESHOLD,
          change: `${oldPipeline?.count || 0} → ${newCount >= 999 ? '✓ healthy' : newCount}`,
          mode: 'auto'
        };
        break;

      // JD quality, stale jobs - manual verification (show indicator in UI)
      case 'jd_quality':
      case 'stale_job':
        results[item.id] = {
          verified: true, // Trust checkbox
          change: 'manual check',
          mode: 'manual' // UI shows "manually verified" badge
        };
        break;

      default:
        results[item.id] = { verified: true, change: 'n/a', mode: 'auto' };
    }
  });

  return {
    results,
    verifiedCount: Object.values(results).filter(r => r.verified).length,
    totalCount: items.length,
    manualCount: Object.values(results).filter(r => r.mode === 'manual').length,
    readyForAi: Object.values(results).filter(r => r.verified).length >= items.length * 0.7
  };
}
```

---

## AI Enhancement

### Endpoint: POST /api/ai/pipeline-actions

**Request:**
```typescript
{
  currentData: PipelineData,
  previousSession?: {
    items: ActionItem[],
    completedIds: string[],
    verificationResults: Record<string, { verified: boolean; change: string }>
  },
  pipelineHealthScore: number
}
```

**Response:**
```typescript
{
  items: ActionItem[],           // AI-generated/enhanced items
  summary: string,               // "Great progress! You cleared 4 items..."
  healthProjection: number,      // "Complete these to reach 85%"
  generatedAt: string
}
```

### AI Prompt Template
```
You are a Talent Acquisition advisor analyzing a recruiter's pipeline.

Current Pipeline State:
- {pipelineHealthScore}% health score
- {stuckCount} candidates stuck in pipeline
- {unreviewedCount} unreviewed applications
- {lowPipelineJobs} jobs with low candidate count

Previous Checklist Progress:
- Completed: {completedCount}/{totalCount} items
- Verified changes: {verifiedChanges}

Generate 5-8 prioritized action items for the recruiter.
Each item must be:
1. Specific (include names, counts, job titles)
2. Actionable (clear next step)
3. Prioritized (urgent → important → maintenance)

Focus on items that will have the highest impact on pipeline health.
```

---

## Component Structure

### PipelineActionChecklist.tsx
```typescript
// client/src/components/recruiter/PipelineActionChecklist.tsx

interface PipelineActionChecklistProps {
  pipelineData: PipelineData;
  pipelineHealthScore: number;
}

export function PipelineActionChecklist({ pipelineData, pipelineHealthScore }: Props) {
  // State
  const [session, setSession] = useState<ChecklistSession | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Load/generate checklist on mount
  useEffect(() => {
    const stored = loadSession();
    if (stored && !isSessionStale(stored)) {
      setSession(stored);
      setCompletedIds(new Set(stored.completedIds));
    } else {
      const items = generateActionItems(pipelineData);
      const newSession = createSession(pipelineData, items);
      setSession(newSession);
      saveSession(newSession);
    }
  }, []);

  // Toggle completion
  const toggleItem = (itemId: string) => {
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);

      // Persist
      if (session) {
        saveSession({ ...session, completedIds: Array.from(next) });
      }
      return next;
    });
  };

  // Reanalyze
  const handleReanalyze = async () => {
    setIsReanalyzing(true);
    try {
      const freshData = await fetchPipelineData();
      const verification = verifyCompletions(session!.items, session!.snapshot, freshData);

      const response = await fetch('/api/ai/pipeline-actions', {
        method: 'POST',
        body: JSON.stringify({
          currentData: freshData,
          previousSession: { items: session!.items, completedIds: Array.from(completedIds), verification },
          pipelineHealthScore
        })
      });

      const aiResult = await response.json();
      const newSession = createSession(freshData, aiResult.items, aiResult);
      setSession(newSession);
      setCompletedIds(new Set());
      saveSession(newSession);
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Render
  const allCompleted = session?.items.every(i => completedIds.has(i.id));
  const groupedItems = groupByPriority(session?.items || []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pipeline Actions</CardTitle>
          <HealthScoreBadge score={pipelineHealthScore} />
        </div>
      </CardHeader>
      <CardContent>
        {/* Urgent items */}
        {groupedItems.urgent.length > 0 && (
          <ItemGroup title="Urgent" items={groupedItems.urgent} color="red" />
        )}

        {/* Important items */}
        {groupedItems.important.length > 0 && (
          <ItemGroup title="Important" items={groupedItems.important} color="amber" />
        )}

        {/* Maintenance items */}
        {groupedItems.maintenance.length > 0 && (
          <ItemGroup title="Maintenance" items={groupedItems.maintenance} color="slate" />
        )}

        {/* Reanalyze button */}
        <div className="mt-4 pt-4 border-t">
          <Button
            onClick={handleReanalyze}
            disabled={!allCompleted || isReanalyzing}
          >
            {isReanalyzing ? 'Analyzing...' : 'Reanalyze Pipeline'}
          </Button>
          {!allCompleted && (
            <p className="text-sm text-muted-foreground mt-2">
              Complete all items to unlock reanalysis
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Storage

### localStorage Schema
```typescript
// Key includes userId + role to avoid collisions
const getStorageKey = (userId: number, role: string) =>
  `pipeline-checklist-${userId}-${role}`;

// Lightweight snapshot - counts only, no arrays
type LightweightSnapshot = {
  stuckByStage: Record<number, number>;      // stageId → count (not candidateIds)
  unreviewedCount: number;
  pendingOfferCount: number;
  lowPipelineJobIds: number[];               // Just IDs, not full objects
  staleJobIds: number[];
};

// Store
function saveSession(userId: number, role: string, session: ChecklistSession) {
  const key = getStorageKey(userId, role);
  localStorage.setItem(key, JSON.stringify(session));
}

// Load
function loadSession(userId: number, role: string): ChecklistSession | null {
  const key = getStorageKey(userId, role);
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
}

// Check staleness (regenerate if > 24hrs)
function isSessionStale(session: ChecklistSession): boolean {
  const ageHours = (Date.now() - new Date(session.generatedAt).getTime()) / (1000 * 60 * 60);
  return ageHours > 24;
}

// Reanalyze unlock conditions (more flexible)
function canReanalyze(session: ChecklistSession, completedIds: Set<string>): {
  allowed: boolean;
  reason: string
} {
  const completionRate = completedIds.size / session.items.length;
  const ageHours = (Date.now() - new Date(session.generatedAt).getTime()) / (1000 * 60 * 60);

  // Allow if: 70%+ completed OR 24hrs elapsed
  if (completionRate >= 0.7) {
    return { allowed: true, reason: `${Math.round(completionRate * 100)}% completed` };
  }
  if (ageHours >= 24) {
    return { allowed: true, reason: 'Session expired (24hrs)' };
  }

  const remaining = session.items.length - completedIds.size;
  const hoursLeft = Math.ceil(24 - ageHours);
  return {
    allowed: false,
    reason: `Complete ${remaining} more items or wait ${hoursLeft}hrs`
  };
}
```

---

## Implementation Phases

### Phase 1: Core Checklist (No AI) - Day 1
- [ ] Create `client/src/lib/pipeline-rules.ts` - Rule engine
- [ ] Create `client/src/lib/pipeline-types.ts` - Type definitions
- [ ] Create `client/src/components/recruiter/PipelineActionChecklist.tsx` - UI component
- [ ] Integrate into `recruiter-dashboard.tsx` (replace old insights section)
- [ ] localStorage persistence for completion state

### Phase 2: Verification & Reanalyze - Day 2
- [ ] Create `client/src/lib/verify-completions.ts` - Completion verification
- [ ] Add snapshot comparison logic
- [ ] Implement Reanalyze flow (rule-based only, no AI yet)
- [ ] Add debounce/validation before reanalyze

### Phase 3: AI Enhancement - Day 3
- [ ] Create `server/ai-pipeline-actions.ts` - AI endpoint
- [ ] AI prompt engineering for action generation
- [ ] Cache AI responses (24hr TTL)
- [ ] Background AI enhancement on page load

### Phase 4: Polish & Edge Cases - Day 4
- [ ] Empty state handling
- [ ] Error states
- [ ] Loading states
- [ ] Mobile responsive
- [ ] Accessibility (keyboard nav, screen readers)
- [ ] Analytics tracking (items completed, time to complete)

---

## Files to Create

| File | Purpose |
|------|---------|
| `client/src/lib/pipeline-rules.ts` | Rule engine for generating items |
| `client/src/lib/pipeline-types.ts` | TypeScript types |
| `client/src/lib/verify-completions.ts` | Completion verification |
| `client/src/components/recruiter/PipelineActionChecklist.tsx` | Main UI component |
| `client/src/components/recruiter/ActionItemRow.tsx` | Individual item row |
| `client/src/components/recruiter/HealthScoreBadge.tsx` | Score display |
| `server/ai-pipeline-actions.ts` | AI enhancement endpoint |

## Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/recruiter-dashboard.tsx` | Replace RecruiterAiInsightsSection with PipelineActionChecklist |

## Files to Deprecate (Keep for Reference)

| File | Reason |
|------|--------|
| `client/src/components/recruiter/RecruiterAiInsightsSection.tsx` | Replaced by new checklist |

---

## Success Metrics

1. **Adoption**: % of recruiters who complete at least 1 checklist item
2. **Completion Rate**: Avg % of items completed before reanalyze
3. **Pipeline Health**: Avg health score improvement after 1 week
4. **Time-to-Action**: How quickly items are completed after generation

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI unavailable | Rule-based items always work |
| Slow page load | Rules are instant, AI is background |
| User confusion | Clear UI with priority grouping |
| Gaming system | Data verification on reanalyze |
| Stale checklist | Auto-regenerate after 24hrs |
| Weak verification | For low-pipeline, require a floor (e.g., ≥3 active) when rechecking; mark unverifiable items (JD quality, stale jobs) as “manual verify” instead of auto-verified |
| State collisions | Namespace localStorage keys by userId + role to avoid cross-account bleed |
| UX block on reanalyze | Consider allowing reanalyze after a time window or partial completion (e.g., 70%) while still showing verification deltas |
| UI/test fallout | Update tours/tests when replacing the AI Insights cards with the checklist so data-tour anchors and selectors stay valid |

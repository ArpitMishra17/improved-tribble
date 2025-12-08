# Job Application Management Page - UX Redesign Plan

## Executive Summary

Redesign the Job Applications Kanban page to improve recruiter workflow efficiency by restructuring the layout, adding pipeline health visibility, and reducing cognitive load.

**Key Goals:**
1. Pipeline health at a glance (< 5 seconds)
2. Clear "next actions" for each candidate
3. Minimal clicks to move candidates through stages
4. Context preservation when reviewing candidates

---

## Current State Analysis

### Files Involved

| File | Lines | Purpose |
|------|-------|---------|
| `pages/application-management-page.tsx` | ~2020 | Main page - all state, mutations, handlers, dialogs |
| `components/kanban/KanbanBoard.tsx` | ~197 | DnD context, stage columns grid |
| `components/kanban/StageColumn.tsx` | ~248 | Droppable column with subsections |
| `components/kanban/ApplicationCard.tsx` | ~239 | Draggable candidate card |
| `components/kanban/BulkActionBar.tsx` | ~398 | Selection + bulk actions |
| `components/kanban/ApplicationDetailPanel.tsx` | ~795 | Tabbed detail view in resizable panel |

### Current UX Issues

1. **Poor hierarchy** - Filters, actions, and content compete for attention
2. **No pipeline summary** - Recruiter must mentally count cards to understand health
3. **Cards are verbose** - Too much chrome, not enough information density
4. **Actions scattered** - Bulk actions in toolbar, quick actions in card menu, full actions in panel
5. **Context loss** - ResizablePanel compresses kanban when detail panel opens
6. **No "next action" hints** - Cards don't indicate what the recruiter should do

### Data Already Available (No New APIs Needed)

From `applications[]`:
- `appliedAt` - Calculate "new today", "stuck > N days"
- `currentStage` - Stage distribution
- `status` - Active vs archived
- `aiFitLabel` / `aiFitScore` - AI fit distribution
- `interviewDate` - Interview scheduled indicator
- `rating` - Recruiter rating

From `pipelineStages[]`:
- `id`, `name`, `order`, `color` - Stage metadata

Derived metrics (client-side):
- Applications per stage
- New applications today
- Candidates stuck > 3 days in non-final stages
- AI fit distribution (Exceptional/Strong/Good counts)
- Average time in stage (if `stageHistory` is fetched)

---

## Target Layout Specification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← Back to My Jobs]                                                         │
│ ═══════════════════════════════════════════════════════════════════════════ │
│ Job Title                                                                   │
│ [Details] [Applications*] [Pipeline] [Analytics]          <- JobSubNav      │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────────────┐ │
│ │ Total   │ │ New     │ │ In      │ │ Stuck   │ │ AI Fit: 6 Exc · 18 Str │ │
│ │ 48      │ │ Today   │ │ Applied │ │ > 3d    │ │ · 12 Good              │ │
│ │ 42 actv │ │ 3       │ │ 12      │ │ 5 ⚠️    │ │                        │ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────────────────┘ │
│                                                    <- JobSummaryRibbon      │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Sort: Newest ▾] [Stage: All ▾] [🔍 Search...]  [Exc] [Str] [Good]  48/48   │
│                                                            <- FiltersBar    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ☑️ Select all  │ [Move Stage] [Email] [Form] [Share] [Export] │  3 selected │
│                                                       <- BulkActionBar      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ Applied (12) ─┐  ┌─ Screening (8) ─┐  ┌─ Interview (6) ─┐  ┌─ Offer ─┐  │
│  │ 5 need review  │  │ Avg: 1.2 days   │  │ 2 scheduled     │  │ 1 sent  │  │
│  │ 2 Exc · 6 Str  │  │ 1 Exc · 4 Str   │  │ 1 Exc · 2 Str   │  │         │  │
│  ├────────────────┤  ├─────────────────┤  ├─────────────────┤  ├─────────┤  │
│  │ ☐ Jane Doe     │  │ ☐ Bob Smith     │  │ ☐ Alice Chen    │  │ ☐ ...   │  │
│  │   📧 jane@...  │  │   📧 bob@...    │  │   📧 alice@...  │  │         │  │
│  │   [Exceptional]│  │   [Strong]      │  │   [Exceptional] │  │         │  │
│  │   → Review     │  │   → Schedule    │  │   → Prep notes  │  │         │  │
│  ├────────────────┤  ├─────────────────┤  ├─────────────────┤  │         │  │
│  │ ☐ John Doe     │  │ ...             │  │ ...             │  │         │  │
│  │   ...          │  │                 │  │                 │  │         │  │
│  └────────────────┘  └─────────────────┘  └─────────────────┘  └─────────┘  │
│                                                       <- KanbanBoard        │
│                                                          (horizontal scroll)│
└─────────────────────────────────────────────────────────────────────────────┘

When candidate clicked -> Sheet drawer slides in from right:

┌─────────────────────────────────────────────────────────┬───────────────────┐
│                    (Kanban stays visible)               │ [X] Jane Doe      │
│                                                         │ jane@example.com  │
│                                                         │ [Exceptional] ★4  │
│                                                         │─────────────────  │
│                                                         │ [Summary] [AI]    │
│                                                         │ [Actions] [Notes] │
│                                                         │─────────────────  │
│                                                         │ Move to: [▾]      │
│                                                         │ [Download Resume] │
│                                                         │ [Send Email]      │
│                                                         │ ...               │
└─────────────────────────────────────────────────────────┴───────────────────┘
```

---

## Component Implementation Plan

### 1. JobSummaryRibbon (NEW)

**File:** `components/kanban/JobSummaryRibbon.tsx`

**Props:**
```typescript
interface JobSummaryRibbonProps {
  applications: Application[];
  pipelineStages: PipelineStage[];
  className?: string;
}
```

**Metrics to display:**
| Metric | Derivation | Visual |
|--------|------------|--------|
| Total Applications | `applications.length` | Big number + "X active" subtext |
| New Today | Filter by `appliedAt >= today` | Green if > 0 |
| In First Stage | Count where `currentStage === firstStage.id` | Amber if > 5 |
| Stuck > 3 days | Non-final stages where `appliedAt < 3 days ago` | Red/amber warning |
| AI Fit Summary | Count by `aiFitLabel` | "X Exc · Y Str · Z Good" |

**Implementation notes:**
- Use existing `Card` component with compact padding
- `useMemo` for all calculations to avoid re-render overhead
- Responsive: 2 cols mobile, 3 cols tablet, 5 cols desktop

---

### 2. FiltersBar (NEW)

**File:** `components/kanban/FiltersBar.tsx`

**Props:**
```typescript
interface FiltersBarProps {
  // Current values
  sortBy: 'date' | 'ai_fit';
  stageFilter: string;
  searchQuery: string;
  fitLabelFilter: string[];

  // Callbacks
  onSortChange: (sort: 'date' | 'ai_fit') => void;
  onStageFilterChange: (stageId: string) => void;
  onSearchChange: (query: string) => void;
  onFitLabelToggle: (label: string) => void;
  onClearFitLabels: () => void;

  // Data
  pipelineStages: PipelineStage[];
  totalCount: number;
  filteredCount: number;
}
```

**Layout:**
- Horizontal bar with items spaced evenly
- Sort dropdown (left)
- Stage dropdown
- Search input with icon
- AI fit chip toggles (Exceptional/Strong/Good)
- Results count (right-aligned)

**Implementation notes:**
- Extract existing filter logic from main page
- Debounce search input (300ms)
- Visual distinction between active/inactive filters

---

### 3. Enhanced StageColumn

**File:** `components/kanban/StageColumn.tsx` (MODIFY)

**New header content:**
```typescript
// Add to StageColumnProps
stageInsights?: {
  needsReview: number;      // Not viewed/downloaded
  avgDaysInStage?: number;  // From stageHistory if available
  aiFitSummary: string;     // "2 Exc · 4 Str"
  scheduledInterviews: number;
};
```

**Header structure:**
```
┌─────────────────────────┐
│ Applied (12)            │  <- Stage name + count badge
│ 5 need review           │  <- Insight line 1 (conditional)
│ 2 Exc · 4 Str           │  <- AI fit mini-summary
└─────────────────────────┘
```

**Implementation notes:**
- Insights are optional - gracefully degrade if not provided
- Keep existing drag/drop and subsection logic
- Insight lines are muted text (slate-500)

---

### 4. CandidateCardCompact (NEW)

**File:** `components/kanban/CandidateCardCompact.tsx`

**Props:** Same as `ApplicationCard` plus:
```typescript
interface CandidateCardCompactProps extends ApplicationCardProps {
  nextAction?: string;  // Derived action hint
}
```

**Layout (more compact than current):**
```
┌─────────────────────────────────────────┐
│ ⋮⋮ ☐  Jane Doe              [Exc] ★4 ⋯ │
│       jane@example.com · 555-1234       │
│       → Review resume                   │
└─────────────────────────────────────────┘
```

**Key differences from current ApplicationCard:**
- Single line for name + tags + rating + menu
- Contact info condensed to one line with truncation
- "Next action" hint derived from stage + status:
  - In Applied → "Review resume"
  - In Screening + no interview → "Schedule interview"
  - Interview scheduled → "Prep notes"
  - In Offer → "Follow up"

**Next Action Logic:**
```typescript
function deriveNextAction(app: Application, stage?: PipelineStage): string {
  const stageName = stage?.name?.toLowerCase() || '';

  if (app.status === 'rejected') return 'Archived';
  if (stageName.includes('offer')) return 'Follow up';
  if (app.interviewDate) return 'Prep notes';
  if (stageName.includes('interview')) return 'Schedule interview';
  if (stageName.includes('screening')) return 'Review & decide';
  if (app.status === 'reviewed') return 'Move forward?';
  return 'Review resume';
}
```

**Implementation notes:**
- Maintain drag handle and checkbox
- Keep quick actions dropdown
- More aggressive truncation
- Reduce vertical padding (p-3 instead of p-4)

---

### 5. CandidateDrawer (NEW)

**File:** `components/kanban/CandidateDrawer.tsx`

**Purpose:** Replace ResizablePanel with Sheet for candidate details.

**Props:**
```typescript
interface CandidateDrawerProps {
  application: Application | null;
  isOpen: boolean;
  onClose: () => void;
  // All the same action handlers as ApplicationDetailPanel
  jobId: number;
  pipelineStages: PipelineStage[];
  emailTemplates: EmailTemplate[];
  formTemplates: FormTemplateDTO[];
  stageHistory: any[];
  onMoveStage: (stageId: number, notes?: string) => void;
  onScheduleInterview: (data: {...}) => void;
  onSendEmail: (templateId: number) => void;
  onSendForm: (formId: number, message: string) => void;
  onAddNote: (note: string) => void;
  onSetRating: (rating: number) => void;
  onDownloadResume: () => void;
  onUpdateStatus?: (status: string, notes?: string) => void;
}
```

**Benefits over ResizablePanel:**
- Kanban scroll position preserved
- Full kanban visible (Sheet overlays, doesn't compress)
- ESC key closes drawer
- Click outside closes drawer
- Consistent mobile experience

**Implementation notes:**
- Use existing `Sheet` component from UI library
- Set width to `max-w-lg` (512px) or `max-w-xl` (576px)
- Reuse `ApplicationDetailPanel` content inside Sheet
- Add keyboard shortcut hint in footer

---

### 6. AIInsightsPanel (NEW - Optional)

**File:** `components/kanban/AIInsightsPanel.tsx`

**Props:**
```typescript
interface AIInsightsPanelProps {
  applications: Application[];
  pipelineStages: PipelineStage[];
  onBulkAction?: (actionType: string, applicationIds: number[]) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}
```

**Insights to surface (all derived from existing data):**

1. **Urgent Items:**
   - Candidates in non-final stages > 3 days
   - Interview scheduled in next 24 hours

2. **Bottlenecks:**
   - Stages with no movement in 5+ days
   - High drop-off between stages

3. **Suggested Bulk Actions:**
   - "Move X candidates with 'Strong' fit from Screening to Interview"
   - "Send reminder email to Y candidates awaiting response"

**Implementation notes:**
- Start as collapsed accordion or right sidebar
- Each insight is a card with an action button
- Action buttons wire to existing bulk mutation handlers
- Mark as "AI-assisted" to set expectations

---

## Refactored Main Page Structure

**File:** `pages/application-management-page.tsx`

### State Changes
- Remove filter/sort state from page (move to FiltersBar with lifted state)
- Add `isDrawerOpen` state for Sheet
- Keep all mutations and handlers

### New Component Tree
```tsx
<Layout>
  <Container>
    {/* Header Section */}
    <BackButton />
    <JobSubNav jobId={jobId} jobTitle={job.title} />

    {/* Summary Ribbon */}
    <JobSummaryRibbon
      applications={applications}
      pipelineStages={pipelineStages}
    />

    {/* Filters */}
    <FiltersBar
      sortBy={sortBy}
      stageFilter={stageFilter}
      searchQuery={searchQuery}
      fitLabelFilter={fitLabelFilter}
      onSortChange={setSortBy}
      onStageFilterChange={setStageFilter}
      onSearchChange={setSearchQuery}
      onFitLabelToggle={toggleFitLabel}
      onClearFitLabels={clearFitLabels}
      pipelineStages={pipelineStages}
      totalCount={applications.length}
      filteredCount={filteredApplications.length}
    />

    {/* Bulk Actions */}
    <BulkActionBar {...bulkActionProps} />

    {/* Main Content */}
    <div className="flex gap-4">
      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <KanbanBoard
          applications={filteredApplications}
          pipelineStages={pipelineStages}
          selectedIds={selectedApplications}
          onToggleSelect={handleToggleSelect}
          onOpenDetails={handleOpenDetails}
          onDragEnd={handleDragEnd}
          CardComponent={CandidateCardCompact}  // New prop
        />
      </div>

      {/* Optional AI Insights Panel */}
      <AIInsightsPanel
        applications={applications}
        pipelineStages={pipelineStages}
        isCollapsed={insightsPanelCollapsed}
        onToggleCollapse={() => setInsightsPanelCollapsed(!insightsPanelCollapsed)}
        onBulkAction={handleBulkAction}
      />
    </div>

    {/* Candidate Drawer (Sheet) */}
    <CandidateDrawer
      application={selectedApp}
      isOpen={!!selectedApp}
      onClose={handleCloseDetails}
      {...detailPanelProps}
    />

    {/* Keep existing dialogs */}
    {/* ... */}
  </Container>
</Layout>
```

---

## Migration Strategy

### Phase 1: Non-Breaking Additions
1. Create `JobSummaryRibbon` - add to page above filters
2. Create `FiltersBar` - add alongside existing filters (can coexist)
3. Create `CandidateCardCompact` - add as optional card variant

### Phase 2: Drawer Migration
4. Create `CandidateDrawer` - wire up alongside ResizablePanel
5. Add feature flag or user preference toggle
6. Test thoroughly, then remove ResizablePanel

### Phase 3: Enhancements
7. Enhance `StageColumn` headers with insights
8. Add `AIInsightsPanel` (can be behind feature flag)
9. Remove deprecated components/code

---

## File Changes Summary

| Action | File | Changes |
|--------|------|---------|
| CREATE | `components/kanban/JobSummaryRibbon.tsx` | ~150 lines |
| CREATE | `components/kanban/FiltersBar.tsx` | ~180 lines |
| CREATE | `components/kanban/CandidateCardCompact.tsx` | ~200 lines |
| CREATE | `components/kanban/CandidateDrawer.tsx` | ~100 lines (wrapper) |
| CREATE | `components/kanban/AIInsightsPanel.tsx` | ~250 lines |
| MODIFY | `components/kanban/StageColumn.tsx` | +50 lines (header insights) |
| MODIFY | `components/kanban/KanbanBoard.tsx` | +20 lines (card component prop) |
| MODIFY | `pages/application-management-page.tsx` | -200 lines (extraction), +100 lines (new structure) |

**Estimated net change:** +500-700 lines of new modular code

---

## Testing Checklist

- [ ] All existing E2E tests pass (`job-application-flow.spec.ts`)
- [ ] Drag and drop still works
- [ ] Bulk actions still work
- [ ] Detail panel/drawer shows all tabs
- [ ] Mobile responsive (320px - 768px)
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader announces regions
- [ ] No TypeScript errors
- [ ] Performance: No jank with 100+ applications

---

## Open Questions

1. **Card density toggle?** Should we offer a toggle between compact and full cards?
2. **AI Insights placement?** Right sidebar vs collapsible panel vs bottom drawer?
3. **Persist filter state?** URL params or localStorage?
4. **Stage time tracking?** Do we have `stageHistory` data to calculate avg time in stage?

---

## Approval Checklist

- [ ] UX layout approved
- [ ] Component breakdown approved
- [ ] Migration strategy approved
- [ ] Ready to implement

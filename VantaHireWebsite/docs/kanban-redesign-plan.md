# Job Application Management Page - UX Redesign Plan

## Executive Summary

Redesign the Job Applications Kanban page to improve recruiter workflow efficiency by restructuring the layout, adding pipeline health visibility, and reducing cognitive load.

**Key Goals:**
1. Pipeline health at a glance (< 5 seconds)
2. Clear "next actions" for each candidate
3. Minimal clicks to move candidates through stages
4. Context preservation when reviewing candidates

---

## Final Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Card density | **Full only** | Keep current verbose cards; no toggle needed |
| AI Insights placement | **Right sidebar** | Collapsible, always accessible without scrolling |
| Filter persistence | **URL params** | Shareable links, back button works, bookmarkable views |
| Stage history | **Available** | `stageHistory` exists in schema; enables time-in-stage insights |

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
3. **Actions scattered** - Bulk actions in toolbar, quick actions in card menu, full actions in panel
4. **Context loss** - ResizablePanel compresses kanban when detail panel opens
5. **No "next action" hints** - Cards don't indicate what the recruiter should do
6. **Filters don't persist** - Must re-apply filters on each page load

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

From `stageHistory[]`:
- Transition timestamps - Calculate avg time in stage

Derived metrics (client-side):
- Applications per stage
- New applications today
- Candidates stuck > 3 days in non-final stages
- AI fit distribution (Exceptional/Strong/Good counts)
- Average time in stage

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
│ │ 42 actv │ │ 3       │ │ 12      │ │ 5 ⚠     │ │                        │ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────────────────┘ │
│                                                    <- JobSummaryRibbon      │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Sort: Newest ▾] [Stage: All ▾] [Search...]  [Exc] [Str] [Good]  48/48     │
│                                                            <- FiltersBar    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ☑ Select all  │ [Move Stage] [Email] [Form] [Share] [Export] │  3 selected │
│                                                       <- BulkActionBar      │
├───────────────────────────────────────────────────────────────┬─────────────┤
│                                                               │ AI Insights │
│  ┌─ Applied (12) ─┐  ┌─ Screening (8) ─┐  ┌─ Interview ─┐    │ [collapse]  │
│  │ 5 need review  │  │ Avg: 1.2 days   │  │ 2 scheduled │    │─────────────│
│  │ 2 Exc · 6 Str  │  │ 1 Exc · 4 Str   │  │ 1 Exc · 2   │    │ ⚠ Urgent    │
│  ├────────────────┤  ├─────────────────┤  ├─────────────┤    │ 3 stuck >3d │
│  │ ☐ Jane Doe     │  │ ☐ Bob Smith     │  │ ☐ Alice     │    │             │
│  │   📧 jane@...  │  │   📧 bob@...    │  │   📧 alice  │    │ 📊 Bottlenck│
│  │   [Exceptional]│  │   [Strong]      │  │   [Except.] │    │ No moves in │
│  │   → Review     │  │   → Schedule    │  │   → Prep    │    │ Interview   │
│  ├────────────────┤  ├─────────────────┤  ├─────────────┤    │             │
│  │ ☐ John Doe     │  │ ...             │  │ ...         │    │ 💡 Suggest  │
│  │   ...          │  │                 │  │             │    │ Move 4 Str  │
│  └────────────────┘  └─────────────────┘  └─────────────┘    │ to Interview│
│                                                               └─────────────┘
│                                   <- KanbanBoard + AIInsightsPanel (sidebar)│
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

### 2. FiltersBar (NEW) - With URL Persistence

**File:** `components/kanban/FiltersBar.tsx`

**Props:**
```typescript
interface FiltersBarProps {
  // Current values (synced with URL)
  sortBy: 'date' | 'ai_fit';
  stageFilter: string;
  searchQuery: string;
  fitLabelFilter: string[];

  // Callbacks (update URL params)
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

**URL Parameter Schema:**
```
/jobs/:id/applications?sort=date&stage=2&fit=Strong,Exceptional&q=jane
```

| Param | Default | Values |
|-------|---------|--------|
| `sort` | `date` | `date`, `ai_fit` |
| `stage` | `all` | stage ID or `all` |
| `fit` | (none) | comma-separated: `Exceptional,Strong,Good` |
| `q` | (none) | search string |

**Implementation notes:**
- Use `useSearchParams` from wouter or custom hook
- Only include non-default values in URL
- Debounce search input (300ms) before updating URL
- Parse URL on mount to restore filter state

---

### 3. Enhanced StageColumn

**File:** `components/kanban/StageColumn.tsx` (MODIFY)

**New header content:**
```typescript
// Add to StageColumnProps
stageInsights?: {
  needsReview: number;      // Not viewed/downloaded
  avgDaysInStage?: number;  // From stageHistory
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

### 4. CandidateDrawer (NEW)

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

### 5. AIInsightsPanel (NEW) - Right Sidebar

**File:** `components/kanban/AIInsightsPanel.tsx`

**Props:**
```typescript
interface AIInsightsPanelProps {
  applications: Application[];
  pipelineStages: PipelineStage[];
  stageHistory?: any[];  // For time-in-stage calculations
  onBulkAction?: (actionType: string, applicationIds: number[]) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}
```

**Layout:** Fixed-width right sidebar (280px expanded, 48px collapsed)

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
- Collapsible via chevron icon
- Collapse state persisted in localStorage
- Each insight is a card with an action button
- Action buttons wire to existing bulk mutation handlers
- Mark as "AI-assisted" to set expectations

---

## Refactored Main Page Structure

**File:** `pages/application-management-page.tsx`

### State Changes
- Add URL param sync for filters (custom hook)
- Add `isDrawerOpen` state for Sheet
- Add `insightsPanelCollapsed` state (persisted to localStorage)
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

    {/* Filters (synced with URL) */}
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
        />
      </div>

      {/* AI Insights Panel (Right Sidebar) */}
      <AIInsightsPanel
        applications={applications}
        pipelineStages={pipelineStages}
        stageHistory={stageHistory}
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
2. Create `FiltersBar` with URL sync - add alongside existing filters
3. Create `useFilterParams` hook for URL state management

### Phase 2: Drawer Migration
4. Create `CandidateDrawer` - wire up alongside ResizablePanel
5. Add feature flag or user preference toggle
6. Test thoroughly, then remove ResizablePanel

### Phase 3: Enhancements
7. Enhance `StageColumn` headers with insights
8. Add `AIInsightsPanel` (right sidebar)
9. Remove deprecated components/code

---

## File Changes Summary

| Action | File | Changes |
|--------|------|---------|
| CREATE | `components/kanban/JobSummaryRibbon.tsx` | ~150 lines |
| CREATE | `components/kanban/FiltersBar.tsx` | ~200 lines |
| CREATE | `components/kanban/CandidateDrawer.tsx` | ~100 lines (wrapper) |
| CREATE | `components/kanban/AIInsightsPanel.tsx` | ~280 lines |
| CREATE | `hooks/useFilterParams.ts` | ~80 lines |
| MODIFY | `components/kanban/StageColumn.tsx` | +50 lines (header insights) |
| MODIFY | `pages/application-management-page.tsx` | -200 lines (extraction), +100 lines (new structure) |

**Estimated net change:** +550-750 lines of new modular code

---

## Testing Checklist

### Functional
- [ ] All existing E2E tests pass (`job-application-flow.spec.ts`)
- [ ] Drag and drop still works
- [ ] Bulk actions still work
- [ ] Detail drawer shows all tabs
- [ ] URL params persist and restore correctly
- [ ] Shareable URLs load correct filter state

### Performance
- [ ] No jank with 100+ applications
- [ ] Drawer opens < 100ms
- [ ] Filter changes feel instant

### Accessibility
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader announces regions
- [ ] Focus management when drawer opens/closes
- [ ] ARIA labels on filter controls

### Responsive
- [ ] Mobile responsive (320px - 768px)
- [ ] AI panel collapses gracefully on small screens
- [ ] Drawer full-width on mobile

---

## Approval Checklist

- [x] Card density: Full only (no toggle)
- [x] AI Insights: Right sidebar (collapsible)
- [x] Filter persistence: URL params
- [x] Stage history: Available for time-in-stage
- [x] UX layout approved
- [x] Component breakdown approved
- [x] Migration strategy approved
- [x] **Ready to implement**

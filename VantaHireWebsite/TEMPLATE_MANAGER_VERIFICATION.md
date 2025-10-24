# Template Manager UI - Verification Checklist

Run these checks after deploying to Railway to ensure Template Manager works correctly.

## Pre-Deployment Setup

1. **Deploy to Railway**
   ```bash
   git push origin master
   # Wait for Railway deployment to complete
   ```

2. **Verify Environment Variables**
   - `DATABASE_URL` - PostgreSQL connection string
   - `SESSION_SECRET` - Session encryption key
   - `ALLOWED_HOSTS` - Includes Railway domain
   - `NODE_ENV=production`

3. **Check Migrations Ran**
   - Railway logs should show: `✅ ATS schema ready` and `✅ Forms schema ready`

---

## Test Suite 1: Admin User Workflow

### A. Route Protection & Access

**Test:**
```
1. Log out (clear session)
2. Try to access: https://your-app.up.railway.app/admin/forms
3. Expected: Redirected to /auth or /jobs (unauthorized)
4. Log in as admin
5. Navigate to /admin/forms
6. Expected: Template list page loads
```

**Verification:**
- [ ] Unauthorized users cannot access route
- [ ] Admin sees "Form Templates" page
- [ ] Sees all templates (published + drafts from all users)
- [ ] Create Template button visible

---

### B. Create Complex Template

**Test: Create template with all 7 field types**
```
1. Click "Create Template"
2. Fill in:
   - Name: "Complete Onboarding Form"
   - Description: "All field types test"
   - Publish: ON
3. Add 7 fields (click "Add Field" 7 times)
4. Configure fields:

   Field 1:
   - Type: Short Text
   - Label: "Full Legal Name"
   - Required: YES

   Field 2:
   - Type: Long Text
   - Label: "Tell us about yourself"
   - Required: NO

   Field 3:
   - Type: Email
   - Label: "Personal Email Address"
   - Required: YES

   Field 4:
   - Type: Yes/No
   - Label: "Do you need a laptop?"
   - Required: YES

   Field 5:
   - Type: Select
   - Label: "T-Shirt Size"
   - Options: "XS, S, M, L, XL, XXL"
   - Required: YES

   Field 6:
   - Type: Date
   - Label: "Preferred Start Date"
   - Required: YES

   Field 7:
   - Type: File
   - Label: "Upload Photo ID"
   - Required: YES

5. Click "Create Template"
```

**Verification:**
- [ ] All 7 fields save correctly
- [ ] Success toast appears: "Template Created"
- [ ] Table shows new template with "7 fields"
- [ ] Status badge shows "Published"
- [ ] Created By shows "You" or your email

**Edge Cases:**
- [ ] Try saving with empty name → validation error shown
- [ ] Try saving with 0 fields → validation error shown
- [ ] Try saving select field without options → validation error shown
- [ ] Options with trailing commas work: "A, B, C," → saved as ["A", "B", "C"]
- [ ] Options with extra spaces work: "A , B  , C" → saved as ["A", "B", "C"]

---

### C. Edit Template

**Test: Edit existing template**
```
1. Click edit icon (pencil) on "Complete Onboarding Form"
2. Modify name to "Complete Onboarding Form v2"
3. Add description: "Updated version with extra fields"
4. Remove field 2 (Long Text) - click trash icon
5. Add new field at end:
   - Type: Short Text
   - Label: "Emergency Contact Name"
   - Required: YES
6. Reorder fields:
   - Move "Emergency Contact Name" up using ↑ arrow
   - Move it to position 2 (after "Full Legal Name")
7. Click "Update Template"
```

**Verification:**
- [ ] Name updated to v2
- [ ] Description added
- [ ] Field 2 deleted (now 7 fields total)
- [ ] New field added
- [ ] Field order persists after save
- [ ] Success toast: "Template Updated"
- [ ] Table shows updated name and field count

---

### D. Publish/Unpublish Toggle

**Test:**
```
1. Find "Complete Onboarding Form v2" in table
2. Click eye icon (currently published)
3. Expected: Icon changes to eye-off, status badge changes to "Draft"
4. Click eye-off icon (unpublish)
5. Expected: Icon changes to eye, status badge changes to "Published"
```

**Verification:**
- [ ] Publish toggle works without opening editor
- [ ] Status badge updates immediately
- [ ] Toast notification shown
- [ ] Published templates visible to recruiters
- [ ] Draft templates only visible to creator

---

### E. Delete Template

**Test 1: Delete unused template**
```
1. Create a new template: "Test Delete Template"
2. Save without sending any invitations
3. Click trash icon (red)
4. Confirm deletion in dialog
5. Expected: Template deleted, success toast
```

**Verification:**
- [ ] Delete dialog appears with warning
- [ ] Template removed from table after confirm
- [ ] Success toast: "Template Deleted"

**Test 2: Delete template with invitations**
```
1. Go to /jobs/:id/applications
2. Send "Complete Onboarding Form v2" to a test candidate
3. Return to /admin/forms
4. Try to delete "Complete Onboarding Form v2"
5. Expected: Error toast saying cannot delete (has invitations)
```

**Verification:**
- [ ] Delete fails when invitations exist
- [ ] Error toast shows clear message
- [ ] Template remains in table
- [ ] Dialog suggests unpublishing instead

---

## Test Suite 2: Recruiter User Workflow

### F. Role-Based Access

**Test:**
```
1. Log out
2. Log in as recruiter (not admin)
3. Navigate to /admin/forms
```

**Verification:**
- [ ] Recruiter can access /admin/forms
- [ ] Sees published templates from all users
- [ ] Sees only their own drafts
- [ ] Cannot see other users' drafts

---

### G. Edit Permissions

**Test:**
```
1. As recruiter, view table
2. Find template created by admin
3. Expected: No edit/delete buttons visible
4. Find template created by recruiter (self)
5. Expected: Edit/delete buttons visible
```

**Verification:**
- [ ] Edit button hidden for admin-owned templates
- [ ] Delete button hidden for admin-owned templates
- [ ] Publish toggle hidden for admin-owned templates
- [ ] Edit button visible for own templates
- [ ] Delete button visible for own templates

---

### H. Create & Publish Own Template

**Test:**
```
1. As recruiter, create new template: "Recruiter Custom Form"
2. Add 3 fields
3. Toggle "Publish template" OFF (draft mode)
4. Save
5. Expected: Template visible in list with "Draft" badge
6. Expected: Template NOT visible to other recruiters
```

**Verification:**
- [ ] Recruiter can create templates
- [ ] Draft templates not shown to other users
- [ ] After publishing, template visible to all recruiters
- [ ] Admin can see recruiter's drafts

---

## Test Suite 3: Integration with Forms Feature

### I. Send Custom Form to Candidate

**Test:**
```
1. Navigate to /jobs/:id/applications
2. Click "Forms" button on any application
3. In Forms modal, click "Select Form Template" dropdown
4. Expected: See all published templates including custom ones
5. Select "Complete Onboarding Form v2"
6. Add custom message (optional)
7. Click "Send Form"
```

**Verification:**
- [ ] Custom templates appear in dropdown
- [ ] Can select custom template
- [ ] Form sends successfully
- [ ] Email received by candidate
- [ ] Email contains correct form link

---

### J. Candidate Fills Custom Form

**Test:**
```
1. As candidate, click link in email
2. Expected: See all 7 fields from custom template
3. Fill out form:
   - Short text: "John Doe"
   - Email: "john@example.com"
   - Yes/No: Yes
   - Select: "M" (medium)
   - Date: 2025-02-01
   - File: Upload test PDF
   - Emergency Contact: "Jane Doe"
4. Submit form
```

**Verification:**
- [ ] All 7 field types render correctly
- [ ] Select dropdown shows options from template
- [ ] File upload works
- [ ] Required fields validated
- [ ] Form submits successfully

---

### K. View Response with Custom Fields

**Test:**
```
1. Return to /jobs/:id/applications
2. Open Forms modal
3. Click "View Response" on submitted form
4. Expected: See all Q&A pairs from custom template
```

**Verification:**
- [ ] All 7 fields displayed
- [ ] Answers match candidate input
- [ ] File upload link works
- [ ] Formatting is correct

---

## Test Suite 4: Edge Cases & Error Handling

### L. CSRF Protection

**Test:**
```
1. Open browser DevTools → Network tab
2. Create a new template
3. Inspect POST request to /api/forms/templates
4. Expected: X-CSRF-Token header present
```

**Verification:**
- [ ] CSRF token sent in headers
- [ ] Request succeeds with token
- [ ] Request fails without token (403)

---

### M. Validation Errors

**Test various validation failures:**
```
1. Try to save template with:
   - Empty name → Error: "Template name is required"
   - No fields → Error: "At least one field is required"
   - Field with empty label → Error on specific field
   - Select field with no options → Error on specific field
```

**Verification:**
- [ ] All validation errors shown inline
- [ ] Red error text appears below invalid fields
- [ ] Save button blocked until errors fixed
- [ ] Toast notification on validation failure

---

### N. Network Errors

**Test:**
```
1. In DevTools → Network tab, set throttling to "Offline"
2. Try to create template
3. Expected: Error toast with network error message
4. Re-enable network
5. Retry → Success
```

**Verification:**
- [ ] Network errors handled gracefully
- [ ] Error toast shows helpful message
- [ ] Form data not lost on error
- [ ] Retry works after network restored

---

### O. Concurrent Edits

**Test:**
```
1. Admin opens template for editing
2. In another tab/browser, delete the same template
3. Admin tries to save changes
4. Expected: Error (template no longer exists)
```

**Verification:**
- [ ] Concurrent delete handled
- [ ] Error message clear
- [ ] UI updates on refresh

---

## Test Suite 5: Options Parsing Edge Cases

### P. Special Characters in Options

**Test select field options with:**
```
1. Trailing comma: "A, B, C,"
2. Extra spaces: "A  ,   B   ,  C"
3. Mixed: " A, B  , C,  "
4. Empty options: "A, , B, , C"
5. Special chars: "Size: Small, Size: Medium, Size: Large"
6. Numbers: "1, 2, 3, 4, 5"
```

**Verification:**
- [ ] All variations save correctly
- [ ] Empty options removed
- [ ] Whitespace trimmed
- [ ] JSON array format valid
- [ ] Options display correctly in select dropdown

---

## Test Suite 6: Field Ordering

### Q. Reorder Fields Extensively

**Test:**
```
1. Create template with 5 fields
2. Move field 5 to position 1 (↑ ↑ ↑ ↑)
3. Move field 1 to position 5 (↓ ↓ ↓ ↓)
4. Delete field 3
5. Add new field
6. Save
7. Reopen editor
```

**Verification:**
- [ ] Field order preserved after save
- [ ] No gaps in order numbers
- [ ] New field appears at end
- [ ] Order values normalized to 0..N
- [ ] Candidate sees fields in correct order

---

## Performance & Load Testing

### R. Large Template

**Test:**
```
1. Create template with 50 fields
2. Save
3. Edit (add/remove fields)
4. Send to candidate
```

**Verification:**
- [ ] Editor handles 50 fields without lag
- [ ] Save completes in < 3 seconds
- [ ] Public form renders all fields
- [ ] Submission works

---

### S. Many Templates

**Test:**
```
1. Create 20+ templates
2. Load /admin/forms
```

**Verification:**
- [ ] Table loads quickly (< 2 seconds)
- [ ] All templates visible
- [ ] Scrolling smooth
- [ ] Consider pagination if 100+ templates

---

## Security Checks

### T. Authorization Bypass Attempts

**Test:**
```
1. As recruiter, manually edit URL: /api/forms/templates/1 (admin's template)
2. Try PATCH request
3. Expected: 403 Forbidden
```

**Verification:**
- [ ] Backend enforces ownership on PATCH
- [ ] Backend enforces ownership on DELETE
- [ ] UI correctly hides buttons
- [ ] API returns 403 for unauthorized edits

---

## Final Verification Summary

Once all tests pass:

- [ ] All 20+ test scenarios pass
- [ ] No console errors in browser
- [ ] No server errors in Railway logs
- [ ] Toast notifications clear and helpful
- [ ] Forms feature works end-to-end with custom templates
- [ ] Role-based access working correctly
- [ ] CSRF protection active
- [ ] Options parsing handles edge cases
- [ ] Field ordering reliable
- [ ] Delete guard prevents data loss

---

## Rollout Checklist

Before announcing to users:

- [ ] All verification tests passed
- [ ] Documentation updated (link to this guide)
- [ ] Training materials prepared (screenshots/video)
- [ ] Support team briefed on new feature
- [ ] Monitor Railway logs for errors first 24 hours
- [ ] Have rollback plan ready (previous commit hash)

---

## Monitoring Post-Rollout

**Week 1 Metrics to Track:**
- Number of custom templates created
- Template create/update/delete errors
- Average fields per template
- Most used field types
- Forms sent with custom templates
- User feedback/support tickets

**Dashboard Query (Optional):**
```sql
-- Template usage stats
SELECT
  COUNT(*) as total_templates,
  COUNT(CASE WHEN is_published = true THEN 1 END) as published_count,
  AVG(field_count) as avg_fields_per_template,
  MAX(created_at) as most_recent_template
FROM (
  SELECT
    f.id,
    f.is_published,
    f.created_at,
    COUNT(ff.id) as field_count
  FROM forms f
  LEFT JOIN form_fields ff ON f.id = ff.form_id
  GROUP BY f.id
) AS template_stats;
```

---

**Last Updated:** 2025-01-24
**Maintained By:** VantaHire Engineering Team

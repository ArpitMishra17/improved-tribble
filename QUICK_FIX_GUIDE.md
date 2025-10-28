# VantaHire Database Issues - Quick Fix Guide

## Critical Issues Requiring Immediate Action

### 1. SQL Injection in Helpdesk (MEDIUM Risk)

**File**: `/home/ews/vanta/SpotAxis/helpdesk/views/staff.py` (lines 148-169)

**Current (Vulnerable)**:
```python
queues = _get_user_queues(request.user).values_list('id', flat=True)
where_clause = """WHERE q.id = t.queue_id AND q.id IN (%s)""" % (",".join(("%d" % pk for pk in queues)))
cursor.execute("""SELECT ... FROM ... %s %s ...""" % (from_clause, where_clause))
```

**Fixed (Safe)**:
```python
queues = _get_user_queues(request.user).values_list('id', flat=True)
queues_list = list(queues) if queues else []

cursor = connection.cursor()
if queues_list:
    placeholders = ','.join(['%s'] * len(queues_list))
    cursor.execute("""
        SELECT q.id as queue,
               q.title AS name,
               COUNT(CASE t.status WHEN '1' THEN t.id WHEN '2' THEN t.id END) AS open,
               COUNT(CASE t.status WHEN '3' THEN t.id END) AS resolved,
               COUNT(CASE t.status WHEN '4' THEN t.id END) AS closed
        FROM helpdesk_ticket t, helpdesk_queue q
        WHERE q.id = t.queue_id AND q.id IN (%s)
        GROUP BY q.id, q.title
        ORDER BY q.id
    """ % placeholders, queues_list)
else:
    cursor.execute("""
        SELECT q.id as queue,
               q.title AS name,
               COUNT(CASE t.status WHEN '1' THEN t.id WHEN '2' THEN t.id END) AS open,
               COUNT(CASE t.status WHEN '3' THEN t.id END) AS resolved,
               COUNT(CASE t.status WHEN '4' THEN t.id END) AS closed
        FROM helpdesk_ticket t, helpdesk_queue q
        WHERE q.id = t.queue_id
        GROUP BY q.id, q.title
        ORDER BY q.id
    """)

dash_tickets = query_to_dict(cursor.fetchall(), cursor.description)
```

**Time to Fix**: 30 minutes

---

### 2. Command Injection in File Upload (HIGH Risk)

**File**: `/home/ews/vanta/SpotAxis/candidates/models.py` (lines 692-721)

**Current (Vulnerable)**:
```python
def save(self, *args, **kw):
    # ... code ...
    if ext != 'pdf':
        subprocess.call(['libreoffice', '--headless', '--convert-to', 'pdf', 
                        MEDIA_ROOT + "/" + self.file.name, '--outdir', dir_path])
```

**Quick Fix (Safe)**:
```python
import shlex
import os

def save(self, *args, **kw):
    # ... code ...
    if ext != 'pdf':
        # Validate file name first
        file_name = os.path.basename(self.file.name)
        if not all(c.isalnum() or c in '._-' for c in file_name):
            raise ValueError("Invalid file name characters")
        
        # Use shlex.quote() to properly escape the path
        file_path = shlex.quote(MEDIA_ROOT + "/" + self.file.name)
        dir_path_quoted = shlex.quote(dir_path)
        
        subprocess.call(['libreoffice', '--headless', '--convert-to', 'pdf', 
                        file_path, '--outdir', dir_path_quoted])
```

**Better Solution (Async)**:
```python
# Use Celery instead of blocking subprocess
from celery import shared_task
import subprocess

@shared_task
def convert_cv_to_pdf(curriculum_id):
    curriculum = Curriculum.objects.get(id=curriculum_id)
    if curriculum.file and not curriculum.pdf_file:
        file_path = curriculum.file.path
        dir_path = os.path.dirname(file_path)
        subprocess.run(['libreoffice', '--headless', '--convert-to', 'pdf', 
                       file_path, '--outdir', dir_path], check=True)
        # Update PDF file path
        pdf_path = file_path.rsplit('.', 1)[0] + '.pdf'
        curriculum.pdf_file = pdf_path.replace(MEDIA_ROOT, '').lstrip('/')
        curriculum.save()

# In Curriculum.save():
def save(self, *args, **kw):
    super().save(*args, **kw)
    if self.file and not self.pdf_file:
        convert_cv_to_pdf.delay(self.id)  # Async task
```

**Time to Fix**: 1-2 hours

---

### 3. Missing Input Validation (HIGH Risk)

**File**: `/home/ews/vanta/SpotAxis/companies/views.py` (multiple lines)

**Current (Vulnerable)**:
```python
# Line 66
slabid = request.GET['price_slab']

# Lines 177, 200
country_selected = Country.objects.get(id=request.POST['country'])
industry_selected = Company_Industry.objects.get(id=request.POST['industry'])
```

**Fixed (Safe)**:
```python
from django.shortcuts import get_object_or_404

# Replace line 66
slabid = request.GET.get('price_slab')
if not slabid:
    messages.error(request, 'Price slab not specified')
    return redirect('some_page')

try:
    slab = PriceSlab.objects.get(id=slabid)
except (PriceSlab.DoesNotExist, ValueError):
    raise Http404('Invalid price slab')

# Replace lines 177, 200 etc
country_selected = get_object_or_404(Country, id=request.POST.get('country'))
industry_selected = get_object_or_404(Company_Industry, id=request.POST.get('industry'))
```

**Time to Fix**: 2-4 hours

---

### 4. Configuration Bug in Settings (LOW Risk)

**File**: `/home/ews/vanta/SpotAxis/TRM/settings.py` (line 243)

**Current (Bug)**:
```python
'PORT': os.getenv('db_port') or os.getenv('db_host'),  # Falls back to HOST!
```

**Fixed**:
```python
'PORT': os.getenv('db_port', '5432'),  # Use default port if not set
```

**Time to Fix**: 5 minutes

---

## Configuration Improvements (Not Critical)

### Add Connection Pooling

**File**: `/home/ews/vanta/SpotAxis/TRM/settings.py`

**Current**:
```python
DATABASES = {
    'default': {
        'ENGINE': os.getenv('db_engine'),
        'NAME': os.getenv('db_name'),
        'USER': os.getenv('db_user'),
        'PASSWORD': os.getenv('db_password'),
        'HOST': os.getenv('db_host'),
        'PORT': os.getenv('db_port') or os.getenv('db_host'),
    }
}
```

**Improved**:
```python
DATABASES = {
    'default': {
        'ENGINE': os.getenv('db_engine'),
        'NAME': os.getenv('db_name'),
        'USER': os.getenv('db_user'),
        'PASSWORD': os.getenv('db_password'),
        'HOST': os.getenv('db_host'),
        'PORT': os.getenv('db_port', '5432'),
        'CONN_MAX_AGE': 600,  # Reuse connections for 10 minutes
        'OPTIONS': {
            'connect_timeout': 10,
            'options': '-c statement_timeout=30000'  # 30 second query timeout
        }
    }
}
```

---

### Add Transaction Boundaries

**File**: `/home/ews/vanta/SpotAxis/payments/views.py`

**Current**:
```python
@login_required
@csrf_exempt
def payment(request):
    # ... payment logic without transactions ...
    company.subscription.expiry = new_expiry
    company.subscription.save()
    Transaction.objects.create(...)
    wallet.balance -= amount
    wallet.save()
```

**Improved**:
```python
from django.db import transaction

@login_required
@csrf_exempt
@transaction.atomic
def payment(request):
    # ... payment logic ...
    try:
        with transaction.atomic():
            company.subscription.expiry = new_expiry
            company.subscription.save()
            
            transaction_obj = Transaction.objects.create(
                company=company,
                amount=amount,
                type='DEBIT'
            )
            
            wallet.balance -= amount
            wallet.save()
            
            return render(request, 'success.html')
    except Exception as e:
        logger.error(f"Payment failed: {e}")
        messages.error(request, 'Payment processing failed')
        return redirect('payment_page')
```

---

## Priority Timeline

### Week 1 (Critical)
- [ ] Fix SQL injection in helpdesk (30 min)
- [ ] Fix command injection in file upload (1-2 hours)
- [ ] Add input validation in companies views (2-4 hours)
- [ ] Fix PORT configuration bug (5 min)

### Week 2-4 (High Priority)
- [ ] Add transaction.atomic() to payment processing
- [ ] Configure CONN_MAX_AGE for connection pooling
- [ ] Add try-catch blocks for all database lookups
- [ ] Implement proper error handling

### Month 2 (Medium Priority)
- [ ] Refactor State/City fields to use ForeignKeys
- [ ] Add database indexes for performance
- [ ] Implement comprehensive input validation
- [ ] Add transaction timeout configuration

### Month 3+ (Long Term)
- [ ] Migrate all raw SQL to Django ORM
- [ ] Implement pgbouncer connection pooling
- [ ] Add comprehensive transaction logging
- [ ] Implement data audit trails

---

## Testing the Fixes

### 1. Test SQL Injection Fix
```python
# Before: Test with malicious queue IDs
# After: Should handle safely with parameterized queries

from django.test import TestCase
from helpdesk.views.staff import dashboard

class DashboardTestCase(TestCase):
    def test_dashboard_with_normal_queues(self):
        # Test with valid queue IDs
        pass
    
    def test_dashboard_with_empty_queues(self):
        # Test with no queue access
        pass
```

### 2. Test File Upload Fix
```python
# Test with various filenames
filenames = [
    'normal_file.pdf',
    'file with spaces.docx',
    'file-with-dashes.doc',
    'file_with_underscore.txt',
    'invalid;file.txt',  # Should be rejected
    'invalid`file.txt',  # Should be rejected
]
```

### 3. Test Input Validation Fix
```python
# Test with missing parameters
response = client.get('/payment/?price_slab=')  # Should show error
response = client.post('/register/', {'country': 'invalid'})  # Should 404
```

---

## Resources

- [Django ORM Security](https://docs.djangoproject.com/en/stable/topics/db/models/)
- [Django Transactions](https://docs.djangoproject.com/en/stable/topics/db/transactions/)
- [OWASP SQL Injection](https://owasp.org/www-community/attacks/SQL_Injection)
- [Django get_object_or_404](https://docs.djangoproject.com/en/stable/topics/http/shortcuts/#get-object-or-404)


# Admin Login Troubleshooting Guide

## 🔐 Understanding the Issue

The admin login 401 error happens when:

1. **Admin user was created with auto-generated password** (because `ADMIN_PASSWORD` wasn't set during first startup)
2. **You later set `ADMIN_PASSWORD` environment variable** in Railway
3. **The system doesn't automatically update** the existing admin's password to match the new env variable

## 🎯 Quick Fix (5 minutes)

### Step 1: Set Environment Variables in Railway

Make sure these variables are set in your Railway Web service:

```bash
ADMIN_PASSWORD=YourSecurePassword123!
SESSION_SECRET=your-session-secret-here
DATABASE_URL=postgresql://...  # Should already be set
```

### Step 2: Run Diagnostic Script (Optional)

Open Railway Shell and run:

```bash
npm --prefix VantaHireWebsite run admin:diagnose
```

This will show you:
- ✓ If admin user exists
- ✓ If password format is correct
- ✓ If ADMIN_PASSWORD matches the stored password
- ❌ What's wrong (if anything)

### Step 3: Reset Admin Password

Open Railway Shell and run:

```bash
npm --prefix VantaHireWebsite run admin:reset
```

You should see:
```
✅ Updated existing admin password.
```

or

```
✅ Admin user did not exist. Created a new admin with the provided password.
```

### Step 4: Test Login

Try logging in with:
- **Username:** `admin`
- **Password:** (the value of your `ADMIN_PASSWORD` env variable)

## 📋 Detailed Troubleshooting

### Problem 1: "401 Unauthorized" on Login

**Symptoms:**
- Login returns 401 status
- Correct username and password don't work
- No error message in browser console

**Diagnosis:**
```bash
# In Railway Shell:
npm --prefix VantaHireWebsite run admin:diagnose
```

**Common Causes:**

1. **Password mismatch** - Admin was created with different password
   ```
   Solution: Run npm run admin:reset
   ```

2. **Admin user doesn't exist**
   ```
   Solution: Run npm run admin:reset (it will create one)
   ```

3. **Password format corrupted**
   ```
   Solution: Run npm run admin:reset
   ```

### Problem 2: ADMIN_PASSWORD Not Set

**Symptoms:**
- Diagnostic shows: `ADMIN_PASSWORD: ❌ Not set`

**Solution:**
1. Go to Railway → Your Web Service → Variables
2. Add variable: `ADMIN_PASSWORD` with your desired password
3. Click "Deploy" to restart the service
4. Run `npm run admin:reset` in Railway Shell

### Problem 3: Database Connection Issues

**Symptoms:**
- Diagnostic shows database error
- "Cannot connect to database"

**Solutions:**

1. **Check DATABASE_URL**
   ```bash
   # In Railway Shell:
   echo $DATABASE_URL
   ```
   Should show: `postgresql://user:pass@host:port/db`

2. **Verify database service is running**
   - Check Railway dashboard
   - Make sure PostgreSQL service is active

3. **Run database migrations**
   ```bash
   npm --prefix VantaHireWebsite run db:push
   ```

### Problem 4: Session Issues

**Symptoms:**
- Login succeeds but immediately redirected to login again
- Session not persisting

**Solutions:**

1. **Verify SESSION_SECRET is set**
   ```bash
   # In Railway Shell:
   echo $SESSION_SECRET
   ```

2. **Check session store**
   - The app uses `connect-pg-simple` for PostgreSQL session storage
   - Make sure `session` table exists in database

3. **Clear browser cookies**
   - Delete all cookies for your domain
   - Try incognito/private browsing mode

## 🔧 Manual Verification Steps

### 1. Check Admin User in Database

```bash
# Connect to Railway PostgreSQL:
psql $DATABASE_URL

# Run query:
SELECT id, username, role, "firstName", "lastName",
       LEFT(password, 20) || '...' as password_preview
FROM users
WHERE username = 'admin';
```

**Expected output:**
```
 id | username | role  | firstName | lastName      | password_preview
----+----------+-------+-----------+---------------+---------------------
  1 | admin    | admin | System    | Administrator | a1b2c3d4e5f6...
```

### 2. Test Password Hash

```bash
# In Railway Shell:
npm --prefix VantaHireWebsite run admin:diagnose
```

Look for:
```
4️⃣  Password Verification Test:
   Testing ADMIN_PASSWORD against stored hash...
   ✅ PASSWORD MATCHES!
```

### 3. Check Authentication Endpoint

```bash
# From your local machine:
curl -X POST https://your-app.railway.app/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourPassword"}'
```

**Success response (200):**
```json
{
  "id": 1,
  "username": "admin",
  "firstName": "System",
  "lastName": "Administrator",
  "role": "admin"
}
```

**Failure response (401):**
```
Unauthorized
```

## 🛠️ Advanced Troubleshooting

### Check Application Logs

In Railway:
1. Go to your Web service
2. Click "Deployments" → Latest deployment
3. Click "View Logs"
4. Look for:
   ```
   ✓ Admin user already exists
   ```
   or
   ```
   🔐 ADMIN USER CREATED SUCCESSFULLY
   Username: admin
   Password: [the auto-generated password]
   ```

### Verify Password Hashing Functions

The password is stored in format: `hash.salt`

Example:
```
a1b2c3d4e5f6...64chars...xyz.0123456789abcdef...32chars...
```

If the stored password doesn't have a `.` separator, it's corrupted.

### Force Recreate Admin

If all else fails:

```bash
# In Railway Shell:

# 1. Connect to database
psql $DATABASE_URL

# 2. Delete existing admin
DELETE FROM users WHERE username = 'admin';

# 3. Exit psql
\q

# 4. Recreate admin
npm --prefix VantaHireWebsite run admin:reset
```

## 📝 Prevention

To avoid this issue in the future:

1. **Always set ADMIN_PASSWORD before first deployment**
   - Set it in Railway Variables BEFORE deploying
   - This ensures admin is created with your password

2. **Document your admin password**
   - Store it in a password manager
   - Share it securely with your team

3. **Use the reset script when changing password**
   - Don't just update the env variable
   - Run `npm run admin:reset` after changing it

## 🆘 Still Having Issues?

If none of the above works:

1. **Run full diagnostic:**
   ```bash
   npm --prefix VantaHireWebsite run admin:diagnose
   ```

2. **Check server logs** for any errors during login attempt

3. **Verify all environment variables:**
   ```bash
   # In Railway Shell:
   env | grep -E '(ADMIN_PASSWORD|SESSION_SECRET|DATABASE_URL)'
   ```

4. **Test with a new user:**
   ```bash
   # Create a test admin user via API:
   curl -X POST https://your-app.railway.app/api/register \
     -H "Content-Type: application/json" \
     -d '{
       "username": "testadmin",
       "password": "Test123!",
       "firstName": "Test",
       "lastName": "Admin",
       "role": "admin"
     }'
   ```

## 📚 Additional Resources

- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [Express Session Documentation](https://www.npmjs.com/package/express-session)
- [Passport.js Local Strategy](http://www.passportjs.org/packages/passport-local/)

---

**Need more help?** Create an issue in the GitHub repository with:
- Output from `npm run admin:diagnose`
- Relevant server logs
- Steps you've already tried

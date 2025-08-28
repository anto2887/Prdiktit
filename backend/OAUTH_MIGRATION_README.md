# OAuth Migration Solution

## Problem Summary

Your OAuth callback was failing with this error:
```
column users.updated_at does not exist
LINE 1: ..._is_active, users.created_at AS users_created_at, users.upda...
```

## Root Cause

1. **Database Schema Mismatch**: Your SQLAlchemy User model expects an `updated_at` column, but your database doesn't have it
2. **OAuth Migration Incomplete**: The OAuth migration only added OAuth-specific columns, not the `updated_at` column
3. **ID Token Decoding Issue**: There was a bug in the OAuth service where `id_token.verify_oauth2_token()` was being called incorrectly

## Solution Implemented

### 1. New Migration Endpoints

I've added these new endpoints to `/api/v1/admin/`:

- **`POST /migrate-users-updated-at`** - Adds the missing `updated_at` column
- **`GET /test-users-updated-at`** - Checks the status of the `updated_at` column
- **`POST /migrate-all-oauth-system`** - Runs all OAuth migrations in the correct order

### 2. Fixed OAuth Service

Fixed the ID token verification bug in `oauth_service.py` where it was incorrectly calling `id_token.verify_oauth2_token()` instead of the proper import.

### 3. Test Script

Created `test_oauth_migration.py` to help you test the migration endpoints.

## How to Fix the OAuth Error

### Option 1: Run Individual Migration (Recommended)

1. **Check current status**:
   ```bash
   GET /api/v1/admin/test-users-updated-at
   ```

2. **Run the migration**:
   ```bash
   POST /api/v1/admin/migrate-users-updated-at
   ```

3. **Verify the migration**:
   ```bash
   GET /api/v1/admin/test-users-updated-at
   ```

### Option 2: Run Comprehensive Migration

Run all OAuth migrations at once:
```bash
POST /api/v1/admin/migrate-all-oauth-system
```

This will run:
1. OAuth2 system migration (adds OAuth columns)
2. Users updated_at migration (adds missing updated_at column)
3. Session system migration (creates user_sessions table)

### Option 3: Use the Test Script

```bash
cd backend
python test_oauth_migration.py
```

## What the Migration Does

The `migrate-users-updated-at` endpoint:

1. **Adds `updated_at` column** to the users table with type `TIMESTAMP WITH TIME ZONE`
2. **Sets default value** to `NOW()`
3. **Updates existing records** to have `updated_at = created_at`
4. **Makes the column NOT NULL** after populating

## Expected Results

After running the migration:

- ✅ OAuth callbacks should work without the "column does not exist" error
- ✅ New users will have both `created_at` and `updated_at` timestamps
- ✅ Existing users will have `updated_at` set to their `created_at` value
- ✅ The OAuth ID token decoding warning should be resolved

## Testing

1. **Run the migration** using one of the methods above
2. **Try OAuth login again** - the error should be resolved
3. **Check the logs** for any remaining OAuth issues
4. **Monitor the database** to ensure the column was added correctly

## Troubleshooting

### If migration fails:
- Check database connection and permissions
- Ensure you have admin access to run the migration
- Check the logs for specific error messages

### If OAuth still fails after migration:
- Verify the migration completed successfully
- Check if there are other missing columns
- Ensure the OAuth service is properly configured

### If you get permission errors:
- Make sure you're authenticated as an admin user
- Check if the admin endpoints are properly protected

## Next Steps

1. **Run the migration** using one of the methods above
2. **Test OAuth login** to confirm the error is resolved
3. **Monitor the application** for any other OAuth-related issues
4. **Consider running the comprehensive migration** if you want to ensure all OAuth systems are properly set up

## Files Modified

- `backend/app/routers/admin.py` - Added migration endpoints
- `backend/app/services/oauth_service.py` - Fixed ID token verification
- `backend/test_oauth_migration.py` - Created test script
- `backend/OAUTH_MIGRATION_README.md` - This documentation

The migration should resolve your OAuth callback errors and allow users to authenticate properly through Google OAuth.

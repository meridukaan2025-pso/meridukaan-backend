# Swagger UI Server URL Fix

## Problem
Swagger UI was showing hardcoded `localhost:8080` or `localhost:3001` URLs in production, causing "Failed to fetch" errors when trying to test endpoints.

## Root Cause
The Swagger configuration had hardcoded localhost server URLs that Swagger UI would select, even in production environments. This caused API requests to fail because they were trying to reach `localhost` instead of the actual production domain.

## Solution
Updated the Swagger configuration to dynamically detect and set the correct server URL based on the actual request:

1. **Removed hardcoded localhost servers** from the initial Swagger config
2. **Enhanced dynamic server detection** in `/api-docs-json` endpoint to:
   - Always use the current request's host and protocol (production or local)
   - Only show localhost as an option when actually running locally
   - Properly detect HTTPS in production (handles Railway, reverse proxies, etc.)
   - Set the current server as the default (first in the list)

## Changes Made

### File: `src/main.ts`

1. **Removed hardcoded servers** from `DocumentBuilder` config
2. **Improved `/api-docs-json` endpoint**:
   - Better protocol detection (handles `x-forwarded-proto` headers)
   - Smarter localhost detection (checks for localhost, 127.0.0.1, private IPs)
   - Only adds localhost option when actually running locally
   - Always puts current server first (which Swagger UI uses by default)

## How It Works Now

### In Production:
- Swagger UI loads from `/api-docs-json`
- Server URL is dynamically set to the actual production domain (e.g., `https://your-domain.com`)
- No localhost URLs appear in the server dropdown
- All API requests go to the correct production URL

### In Local Development:
- Swagger UI detects `localhost` in the host header
- Shows both the current server and a localhost alternative
- Works correctly for local testing

## Testing

After deployment, verify:
1. Open Swagger UI: `https://your-production-domain.com/api-docs`
2. Check the "Servers" dropdown (top-right) - should show your production URL
3. Try the `/auth/login` endpoint - should work without "Failed to fetch" errors
4. Check browser console (F12) - no CORS or network errors

## Environment Variables

No new environment variables required. The fix works automatically based on request headers.

## Benefits

✅ **No more "Failed to fetch" errors** in production Swagger UI  
✅ **Automatic URL detection** - works in any environment  
✅ **No configuration needed** - detects production vs local automatically  
✅ **Backward compatible** - still works for local development  
✅ **Handles reverse proxies** - correctly detects HTTPS behind proxies (Railway, etc.)

# goulburn.ai Security Setup Guide

## ⚠️ CRITICAL ISSUES FOUND

Your API currently exposes:
- 6 admin endpoints without authentication
- Database schema endpoint publicly accessible
- Admin login without rate limiting
- All endpoints visible in public Swagger docs

---

## Quick Fix (5 minutes)

### Step 1: Generate Secure Tokens

```bash
# Generate admin token
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate JWT secret
python -c "import secrets; print(secrets.token_hex(32))"
```

### Step 2: Set Environment Variables

```bash
# On Railway (Dashboard > Variables)
ADMIN_TOKEN=your-generated-admin-token
JWT_SECRET_KEY=your-generated-jwt-secret
ENVIRONMENT=production
```

### Step 3: Update Your FastAPI App

Add `include_in_schema=False` to all admin routes:

```python
@app.post("/api/v1/admin/seed", include_in_schema=False)
async def admin_seed():
    ...
```

Add authentication requirement:

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer

security = HTTPBearer()

@app.post("/api/v1/admin/seed", include_in_schema=False)
async def admin_seed(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != os.getenv("ADMIN_TOKEN"):
        raise HTTPException(status_code=403, detail="Forbidden")
    # ... your logic
```

---

## Complete Security Implementation

### 1. Install Dependencies

```bash
pip install -r requirements-security.txt
```

### 2. Copy Configuration Files

```bash
cp .env.example .env
# Edit .env with your secure values
```

### 3. Replace Your Main App

Use `secure_main.py` as your new `main.py`:

```bash
# Backup your current app
cp main.py main.py.backup

# Use secure version
cp secure_main.py main.py
```

### 4. Configure Railway Redis (for rate limiting)

1. Go to Railway Dashboard
2. Click "New" → "Database" → "Add Redis"
3. The `REDIS_URL` will be auto-populated

### 5. Deploy

```bash
git add .
git commit -m "Add security: auth, rate limiting, hidden admin routes"
git push
```

---

## What Each Fix Does

### 1. Hidden Admin Routes (`include_in_schema=False`)

**Before:** Admin endpoints visible at `api.goulburn.ai/docs`

**After:** Only public endpoints shown in docs

```python
# Public - shown in docs
@app.get("/api/v1/agents")
async def list_agents():
    pass

# Admin - hidden from docs
@app.post("/api/v1/admin/seed", include_in_schema=False)
async def admin_seed():
    pass
```

### 2. Admin Authentication

**Before:** Anyone can call admin endpoints

**After:** Requires `Authorization: Bearer <admin_token>` header

```bash
# This will now fail with 403
curl -X POST https://api.goulburn.ai/api/v1/admin/seed

# This works
curl -X POST https://api.goulburn.ai/api/v1/admin/seed \
  -H "Authorization: Bearer your-admin-token"
```

### 3. Rate Limiting

**Before:** Unlimited requests to any endpoint

**After:** Limits per IP/user

| Endpoint Type | Limit |
|---------------|-------|
| Public (GET) | 60/min |
| Register | 5/min |
| Admin | 10/min |

### 4. CORS Restriction

**Before:** Accepts requests from any origin

**After:** Only accepts from `goulburn.ai`

```python
allow_origins=["https://goulburn.ai", "https://www.goulburn.ai"]
```

---

## Testing Your Security

### Test 1: Admin Endpoints Hidden from Docs

```bash
# Should NOT show admin endpoints
curl https://api.goulburn.ai/openapi.json | grep admin

# Should return nothing (empty result = good!)
```

### Test 2: Admin Endpoints Require Auth

```bash
# Should fail with 403
curl -X POST https://api.goulburn.ai/api/v1/admin/seed

# Should work with token
curl -X POST https://api.goulburn.ai/api/v1/admin/seed \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Test 3: Rate Limiting Works

```bash
# Send 70 requests rapidly - should get 429 Too Many Requests
for i in {1..70}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://api.goulburn.ai/api/v1/agents
done
```

---

## Security Checklist

- [ ] Admin token generated and set in environment
- [ ] JWT secret generated and set
- [ ] All admin routes have `include_in_schema=False`
- [ ] All admin routes require authentication
- [ ] Rate limiting enabled
- [ ] CORS restricted to production domains
- [ ] Redis connected for rate limiting
- [ ] `.env` added to `.gitignore`
- [ ] Old admin tokens rotated (if any existed)

---

## Emergency: If Your Admin Token is Compromised

1. **Generate new token immediately**
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. **Update in Railway Dashboard**
   - Go to Variables
   - Update `ADMIN_TOKEN`
   - Redeploy

3. **Check logs for unauthorized access**
   ```bash
   railway logs
   ```

---

## Need Help?

- FastAPI Security: https://fastapi.tiangolo.com/tutorial/security/
- Railway Redis: https://docs.railway.app/databases/redis
- Rate Limiting: https://github.com/abersheeran/asgi-ratelimit

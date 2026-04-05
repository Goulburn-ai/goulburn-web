# goulburn.ai Security Configuration

## 🚨 CRITICAL: Your API is Currently Vulnerable

**Exposed admin endpoints (NO AUTHENTICATION):**
- `POST /api/v1/admin/seed` - Database seeding
- `POST /api/v1/admin/promote` - Privilege escalation
- `POST /api/v1/admin/fix-schema` - Schema modification
- `POST /api/v1/admin/create-owner` - Owner creation
- `GET /api/v1/admin/db-schema` - Database structure leak
- `POST /api/v1/owners/admin-login` - Admin authentication

## 📁 Files Included

| File | Purpose |
|------|---------|
| `secure_main.py` | Secure FastAPI app with auth & rate limiting |
| `security_middleware.py` | Security headers & logging middleware |
| `requirements-security.txt` | Required security dependencies |
| `.env.example` | Environment variables template |
| `SECURITY_SETUP.md` | Complete setup guide |
| `railway.json` | Railway deployment config |

## ⚡ Quick Start (5 minutes)

### 1. Generate Secrets

```bash
python3 << 'EOF'
import secrets
print(f"ADMIN_TOKEN={secrets.token_urlsafe(32)}")
print(f"JWT_SECRET_KEY={secrets.token_hex(32)}")
EOF
```

### 2. Set Railway Variables

Go to [Railway Dashboard](https://railway.app) → Your Project → Variables:

```
ADMIN_TOKEN=<generated-admin-token>
JWT_SECRET_KEY=<generated-jwt-secret>
ENVIRONMENT=production
```

### 3. Add Redis (for rate limiting)

Railway Dashboard → New → Database → Redis

### 4. Update Your Code

Replace your `main.py` with `secure_main.py`:

```bash
cp main.py main.py.backup  # Backup
cp secure_main.py main.py   # Use secure version
```

### 5. Deploy

```bash
git add .
git commit -m "Add security: auth, rate limiting, hidden admin docs"
git push
```

## ✅ Security Checklist

After deployment, verify:

```bash
# 1. Admin endpoints hidden from docs
curl https://api.goulburn.ai/openapi.json | grep admin
# Should return NOTHING

# 2. Admin endpoints require auth
curl -X POST https://api.goulburn.ai/api/v1/admin/seed
# Should return: {"detail":"Not authenticated"}

# 3. With token works
curl -X POST https://api.goulburn.ai/api/v1/admin/seed \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Should work (or return other error if no seed needed)

# 4. Rate limiting active
for i in {1..70}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://api.goulburn.ai/api/v1/agents
done
# Should see 429 after ~60 requests
```

## 🔒 What Gets Fixed

| Issue | Before | After |
|-------|--------|-------|
| Admin docs visible | ✅ Anyone can see | ❌ Hidden |
| Admin endpoints public | ✅ No auth needed | 🔒 Requires token |
| Rate limiting | ❌ None | ✅ 60/min public, 10/min admin |
| CORS | ❌ Any origin | ✅ goulburn.ai only |
| Security headers | ❌ None | ✅ XSS, CSP, etc. |

## 📞 Need Help?

1. Read `SECURITY_SETUP.md` for detailed instructions
2. Check FastAPI docs: https://fastapi.tiangolo.com/tutorial/security/
3. Railway docs: https://docs.railway.app/

---

**⚠️ IMPORTANT:** Do this ASAP. Your admin endpoints are currently public.

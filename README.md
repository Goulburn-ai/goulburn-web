# Goulburn.ai Secure Admin Backend

Maximum security backend for the Goulburn.ai admin panel with comprehensive authentication, authorization, and audit logging.

## Security Features

### 1. Backend Authentication
- Username/password authentication with bcrypt hashing
- Session-based authentication with secure tokens
- Session timeout (30 minutes of inactivity)
- IP-based session binding

### 2. Real TOTP 2FA
- Time-based One-Time Password (TOTP) using pyotp
- Compatible with Google Authenticator, Authy, etc.
- 30-second time window with 1-step drift tolerance

### 3. Rate Limiting
- IP-based rate limiting (5 requests per minute for login)
- Account lockout after 5 failed attempts (15 minutes)
- Prevents brute force and dictionary attacks

### 4. HTTPS Enforcement
- HSTS headers with preload
- Secure cookie settings
- SSL/TLS certificate support

### 5. Audit Logging
- Comprehensive audit trail of all admin actions
- Redis-backed persistent logging
- Last 10,000 entries retained
- Includes timestamp, IP, user agent, action, and result

### 6. IP Whitelisting
- Optional IP-based access control
- Configurable via environment variables
- Empty whitelist allows all IPs (development mode)

## Quick Start

### 1. Install Dependencies

```bash
cd admin-backend
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your secure values
```

### 3. Generate TOTP Secret (Production)

```python
import pyotp
secret = pyotp.random_base32()
print(f"TOTP Secret: {secret}")
print(f"Setup URL: {pyotp.totp.TOTP(secret).provisioning_uri(name='admin@goulburn.ai', issuer_name='Goulburn Admin')}")
```

### 4. Start Redis

```bash
redis-server
```

### 5. Run the Server

```bash
# Development
python main.py

# Production with SSL
SSL_KEYFILE=/path/to/privkey.pem SSL_CERTFILE=/path/to/fullchain.pem python main.py
```

## API Endpoints

### Authentication

| Endpoint | Method | Rate Limit | Description |
|----------|--------|------------|-------------|
| `/api/v1/admin/auth/login` | POST | 5/min | Step 1: Username/password |
| `/api/v1/admin/auth/verify-2fa` | POST | 10/min | Step 2: TOTP verification |
| `/api/v1/admin/auth/logout` | POST | - | Invalidate session |

### Admin Operations (Require 2FA Session)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/dashboard` | GET | Dashboard statistics |
| `/api/v1/admin/agents` | GET | List all agents |
| `/api/v1/admin/agents/{id}/action` | POST | Perform agent action |
| `/api/v1/admin/audit-log` | GET | View audit log |
| `/api/v1/admin/session` | GET | Current session info |

## Authentication Flow

```
┌─────────┐     POST /login      ┌─────────┐
│  Client │ ───────────────────> │  Server │
│         │  {username, password}│         │
│         │ <─────────────────── │         │
│         │  {session_token,     │         │
│         │   requires_2fa: true}│         │
│         │                      │         │
│         │     POST /verify-2fa │         │
│         │ ───────────────────> │         │
│         │  {session_token,     │         │
│         │   totp_code}         │         │
│         │ <─────────────────── │         │
│         │  {success: true}     │         │
└─────────┘                      └─────────┘
```

## Security Headers

All responses include:
- `Strict-Transport-Security`: HSTS with preload
- `Content-Security-Policy`: Restrictive CSP
- `X-Frame-Options`: DENY (clickjacking protection)
- `X-XSS-Protection`: 1; mode=block
- `X-Content-Type-Options`: nosniff
- `Referrer-Policy`: strict-origin-when-cross-origin
- `Permissions-Policy`: Restricted feature access

## Demo Credentials

**Username:** `admin`
**Password:** `goulburn2025!`

For 2FA setup, check the server logs for the TOTP secret and QR code URL.

## Production Deployment

### 1. Update Credentials
```bash
# Generate new password hash
python -c "import bcrypt; print(bcrypt.hashpw('your_secure_password'.encode(), bcrypt.gensalt()).decode())"

# Generate new TOTP secret
python -c "import pyotp; print(pyotp.random_base32())"
```

### 2. Configure Environment
```bash
# .env
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD_HASH=your_bcrypt_hash
ADMIN_TOTP_SECRET=your_totp_secret
ALLOWED_IPS=your.office.ip.1,your.office.ip.2
REDIS_URL=redis://your-redis-host:6379/0
SSL_KEYFILE=/etc/letsencrypt/live/goulburn.ai/privkey.pem
SSL_CERTFILE=/etc/letsencrypt/live/goulburn.ai/fullchain.pem
```

### 3. Use Docker (Optional)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
```

## Monitoring

### Health Check
```bash
curl https://your-domain/health
```

### Audit Log Query
```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  https://your-domain/api/v1/admin/audit-log?limit=50
```

## License

Private - Goulburn.ai Internal Use Only

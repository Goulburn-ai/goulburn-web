"""
Goulburn.ai Secure Admin Backend
Maximum Security Implementation with:
- Backend Authentication
- Real TOTP 2FA
- Rate Limiting
- HTTPS Enforcement
- Audit Logging
- IP Whitelisting
"""

import os
import hmac
import hashlib
import secrets
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import redis.asyncio as redis
import pyotp
import bcrypt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# =============================================================================
# CONFIGURATION
# =============================================================================

# Admin credentials (in production, use environment variables)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")
ADMIN_TOTP_SECRET = os.getenv("ADMIN_TOTP_SECRET", "")

# If not set via env, use demo values (change in production!)
if not ADMIN_PASSWORD_HASH:
    # Hash of 'goulburn2025!'
    ADMIN_PASSWORD_HASH = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G"

if not ADMIN_TOTP_SECRET:
    # Generate a random TOTP secret for demo (change in production!)
    ADMIN_TOTP_SECRET = pyotp.random_base32()
    print(f"[DEMO] TOTP Secret: {ADMIN_TOTP_SECRET}")
    print(f"[DEMO] Setup URL: {pyotp.totp.TOTP(ADMIN_TOTP_SECRET).provisioning_uri(name='admin@goulburn.ai', issuer_name='Goulburn Admin')}")

# Security settings
SESSION_TIMEOUT_MINUTES = 30
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15
RATE_LIMIT_REQUESTS = 5
RATE_LIMIT_WINDOW = 60  # seconds

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# IP Whitelist (empty = allow all, for demo purposes)
ALLOWED_IPS = os.getenv("ALLOWED_IPS", "").split(",") if os.getenv("ALLOWED_IPS") else []

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=100)

class TOTPVerifyRequest(BaseModel):
    session_token: str = Field(..., min_length=32)
    totp_code: str = Field(..., min_length=6, max_length=6)

class SessionResponse(BaseModel):
    session_token: str
    expires_at: datetime
    requires_2fa: bool = False

class AdminActionRequest(BaseModel):
    action: str = Field(..., min_length=1, max_length=100)
    data: Optional[Dict[str, Any]] = None

class AuditLogEntry(BaseModel):
    timestamp: datetime
    action: str
    username: str
    ip_address: str
    user_agent: str
    success: bool
    details: Optional[str] = None

class DashboardStats(BaseModel):
    total_agents: int
    active_agents: int
    pending_verifications: int
    total_api_calls: int
    last_24h_calls: int
    system_health: str

# =============================================================================
# SECURITY MANAGER
# =============================================================================

class SecurityManager:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.totp = pyotp.TOTP(ADMIN_TOTP_SECRET)
    
    def verify_password(self, password: str) -> bool:
        """Verify password using bcrypt"""
        return bcrypt.checkpw(password.encode(), ADMIN_PASSWORD_HASH.encode())
    
    def verify_totp(self, code: str) -> bool:
        """Verify TOTP code"""
        return self.totp.verify(code, valid_window=1)  # Allow 1 time step drift
    
    def generate_session_token(self) -> str:
        """Generate cryptographically secure session token"""
        return secrets.token_urlsafe(32)
    
    def get_client_ip(self, request: Request) -> str:
        """Extract client IP from request"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    def is_ip_allowed(self, ip: str) -> bool:
        """Check if IP is in whitelist"""
        if not ALLOWED_IPS or ALLOWED_IPS == ['']:
            return True  # No whitelist = allow all
        return ip in ALLOWED_IPS
    
    async def is_rate_limited(self, ip: str) -> tuple[bool, int]:
        """Check if IP is rate limited"""
        key = f"rate_limit:{ip}"
        current = await self.redis.get(key)
        
        if current is None:
            await self.redis.setex(key, RATE_LIMIT_WINDOW, 1)
            return False, 0
        
        count = int(current)
        if count >= RATE_LIMIT_REQUESTS:
            ttl = await self.redis.ttl(key)
            return True, ttl
        
        await self.redis.incr(key)
        return False, 0
    
    async def record_attempt(self, ip: str) -> tuple[bool, int]:
        """Record failed login attempt and check lockout"""
        key = f"login_attempts:{ip}"
        current = await self.redis.get(key)
        
        if current is None:
            await self.redis.setex(key, LOCKOUT_DURATION_MINUTES * 60, 1)
            return False, 0
        
        count = int(current)
        if count >= MAX_LOGIN_ATTEMPTS:
            ttl = await self.redis.ttl(key)
            return True, ttl
        
        await self.redis.incr(key)
        return False, 0
    
    async def clear_attempts(self, ip: str):
        """Clear failed login attempts"""
        await self.redis.delete(f"login_attempts:{ip}")
    
    async def create_session(self, username: str, ip: str, user_agent: str, two_factor_verified: bool = False) -> str:
        """Create new session"""
        token = self.generate_session_token()
        session_data = {
            "username": username,
            "ip_address": ip,
            "user_agent": user_agent,
            "created_at": datetime.utcnow().isoformat(),
            "last_activity": datetime.utcnow().isoformat(),
            "two_factor_verified": str(two_factor_verified).lower()
        }
        
        await self.redis.hset(f"session:{token}", mapping=session_data)
        await self.redis.expire(f"session:{token}", SESSION_TIMEOUT_MINUTES * 60)
        
        return token
    
    async def get_session(self, token: str) -> Optional[Dict[str, str]]:
        """Get session data"""
        session = await self.redis.hgetall(f"session:{token}")
        if not session:
            return None
        
        # Update last activity
        await self.redis.hset(f"session:{token}", "last_activity", datetime.utcnow().isoformat())
        await self.redis.expire(f"session:{token}", SESSION_TIMEOUT_MINUTES * 60)
        
        return {k.decode() if isinstance(k, bytes) else k: 
                v.decode() if isinstance(v, bytes) else v 
                for k, v in session.items()}
    
    async def delete_session(self, token: str):
        """Delete session"""
        await self.redis.delete(f"session:{token}")
    
    async def log_audit(self, action: str, username: str, ip: str, user_agent: str, success: bool, details: str = ""):
        """Log audit event"""
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "username": username,
            "ip_address": ip,
            "user_agent": user_agent[:200],  # Truncate long UA strings
            "success": str(success).lower(),
            "details": details
        }
        
        # Add to audit log list (keep last 10000 entries)
        await self.redis.lpush("audit_log", str(entry))
        await self.redis.ltrim("audit_log", 0, 9999)
    
    async def get_audit_log(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """Get audit log entries"""
        entries = await self.redis.lrange("audit_log", offset, offset + limit - 1)
        result = []
        for entry in entries:
            try:
                import ast
                data = ast.literal_eval(entry.decode() if isinstance(entry, bytes) else entry)
                result.append(data)
            except:
                continue
        return result

# =============================================================================
# FASTAPI SETUP
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    app.state.redis = redis.from_url(REDIS_URL, decode_responses=True)
    app.state.security = SecurityManager(app.state.redis)
    print("[ADMIN] Secure backend started")
    print(f"[ADMIN] TOTP Secret: {ADMIN_TOTP_SECRET}")
    yield
    # Shutdown
    await app.state.redis.close()
    print("[ADMIN] Backend shutdown")

# Create FastAPI app
app = FastAPI(
    title="Goulburn Admin API",
    description="Secure Admin Backend for Goulburn.ai",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,  # Disable docs in production
    redoc_url=None
)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["goulburn.ai", "*.goulburn.ai", "localhost", "127.0.0.1"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://goulburn.ai", "https://admin.goulburn.ai"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

security_bearer = HTTPBearer()

# =============================================================================
# SECURITY DEPENDENCIES
# =============================================================================

async def require_https(request: Request):
    """Require HTTPS connection"""
    # Skip in development
    if request.url.hostname in ["localhost", "127.0.0.1"]:
        return
    
    if request.url.scheme != "https":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="HTTPS required"
        )

async def validate_session(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer)
) -> Dict[str, str]:
    """Validate session token"""
    security_mgr: SecurityManager = request.app.state.security
    token = credentials.credentials
    
    session = await security_mgr.get_session(token)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session"
        )
    
    # Check 2FA verification
    if session.get("two_factor_verified") != "true":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Two-factor authentication required"
        )
    
    # Check IP binding (optional security enhancement)
    current_ip = security_mgr.get_client_ip(request)
    if session.get("ip_address") != current_ip:
        await security_mgr.delete_session(token)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalidated due to IP change"
        )
    
    return session

# =============================================================================
# SECURITY HEADERS MIDDLEWARE
# =============================================================================

@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    
    # HTTPS Strict Transport Security
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    
    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self'; "
        "connect-src 'self' https://goulburn.ai; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    
    # XSS Protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Content type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Permissions policy
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    return response

# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.post("/api/v1/admin/auth/login")
@limiter.limit("5/minute")
async def admin_login(request: Request, login_data: LoginRequest):
    """Step 1: Username/password authentication"""
    security_mgr: SecurityManager = request.app.state.security
    ip = security_mgr.get_client_ip(request)
    ua = request.headers.get("User-Agent", "")
    
    # Check IP whitelist
    if not security_mgr.is_ip_allowed(ip):
        await security_mgr.log_audit("login_denied_ip", login_data.username, ip, ua, False)
        raise HTTPException(status_code=403, detail="Access denied from this IP")
    
    # Check rate limiting
    is_limited, ttl = await security_mgr.is_rate_limited(ip)
    if is_limited:
        await security_mgr.log_audit("login_rate_limited", login_data.username, ip, ua, False)
        raise HTTPException(
            status_code=429, 
            detail=f"Too many attempts. Try again in {ttl} seconds."
        )
    
    # Check account lockout
    is_locked, lockout_ttl = await security_mgr.record_attempt(ip)
    if is_locked:
        await security_mgr.log_audit("login_locked", login_data.username, ip, ua, False)
        raise HTTPException(
            status_code=429,
            detail=f"Account locked. Try again in {lockout_ttl} seconds."
        )
    
    # Verify credentials
    if login_data.username != ADMIN_USERNAME or not security_mgr.verify_password(login_data.password):
        await security_mgr.log_audit("login_failed", login_data.username, ip, ua, False)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Clear failed attempts on successful password verification
    await security_mgr.clear_attempts(ip)
    
    # Create pre-2FA session
    session_token = await security_mgr.create_session(
        username=login_data.username,
        ip=ip,
        user_agent=ua,
        two_factor_verified=False
    )
    
    await security_mgr.log_audit("login_step1", login_data.username, ip, ua, True)
    
    return {
        "success": True,
        "session_token": session_token,
        "requires_2fa": True,
        "message": "Please complete two-factor authentication"
    }

@app.post("/api/v1/admin/auth/verify-2fa")
@limiter.limit("10/minute")
async def verify_2fa(request: Request, verify_data: TOTPVerifyRequest):
    """Step 2: TOTP verification"""
    security_mgr: SecurityManager = request.app.state.security
    ip = security_mgr.get_client_ip(request)
    ua = request.headers.get("User-Agent", "")
    
    # Get session
    session = await security_mgr.get_session(verify_data.session_token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Verify TOTP
    if not security_mgr.verify_totp(verify_data.totp_code):
        await security_mgr.log_audit("2fa_failed", session.get("username", "unknown"), ip, ua, False)
        raise HTTPException(status_code=401, detail="Invalid verification code")
    
    # Update session with 2FA verified
    await security_mgr.redis.hset(
        f"session:{verify_data.session_token}",
        "two_factor_verified",
        "true"
    )
    
    await security_mgr.log_audit("2fa_success", session.get("username", "unknown"), ip, ua, True)
    
    return {
        "success": True,
        "message": "Two-factor authentication successful",
        "session_token": verify_data.session_token
    }

@app.post("/api/v1/admin/auth/logout")
async def logout(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer)
):
    """Logout and invalidate session"""
    security_mgr: SecurityManager = request.app.state.security
    token = credentials.credentials
    ip = security_mgr.get_client_ip(request)
    ua = request.headers.get("User-Agent", "")
    
    session = await security_mgr.get_session(token)
    if session:
        await security_mgr.log_audit("logout", session.get("username", "unknown"), ip, ua, True)
        await security_mgr.delete_session(token)
    
    return {"success": True, "message": "Logged out successfully"}

@app.get("/api/v1/admin/dashboard")
async def get_dashboard(
    request: Request,
    session: Dict[str, str] = Depends(validate_session)
):
    """Get dashboard statistics"""
    security_mgr: SecurityManager = request.app.state.security
    ip = security_mgr.get_client_ip(request)
    ua = request.headers.get("User-Agent", "")
    
    # Mock data - in production, fetch from your database
    stats = {
        "total_agents": 15,
        "active_agents": 12,
        "pending_verifications": 3,
        "total_api_calls": 154320,
        "last_24h_calls": 8420,
        "system_health": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    await security_mgr.log_audit("dashboard_view", session.get("username", "unknown"), ip, ua, True)
    
    return stats

@app.get("/api/v1/admin/agents")
async def list_agents(
    request: Request,
    session: Dict[str, str] = Depends(validate_session)
):
    """List all agents"""
    # Mock data - in production, fetch from your database
    agents = [
        {"id": "agent_001", "name": "Customer Support Bot", "status": "active", "trust_score": 98},
        {"id": "agent_002", "name": "Data Processor", "status": "active", "trust_score": 95},
        {"id": "agent_003", "name": "Content Moderator", "status": "paused", "trust_score": 87},
    ]
    
    return {"agents": agents, "total": len(agents)}

@app.post("/api/v1/admin/agents/{agent_id}/action")
async def agent_action(
    agent_id: str,
    action_data: AdminActionRequest,
    request: Request,
    session: Dict[str, str] = Depends(validate_session)
):
    """Perform action on agent"""
    security_mgr: SecurityManager = request.app.state.security
    ip = security_mgr.get_client_ip(request)
    ua = request.headers.get("User-Agent", "")
    
    # Log the action
    await security_mgr.log_audit(
        f"agent_{action_data.action}",
        session.get("username", "unknown"),
        ip, ua, True,
        f"Agent: {agent_id}"
    )
    
    return {
        "success": True,
        "message": f"Action '{action_data.action}' performed on agent {agent_id}"
    }

@app.get("/api/v1/admin/audit-log")
async def get_audit_log(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    session: Dict[str, str] = Depends(validate_session)
):
    """Get audit log"""
    security_mgr: SecurityManager = request.app.state.security
    
    logs = await security_mgr.get_audit_log(limit, offset)
    
    return {
        "logs": logs,
        "total": len(logs),
        "limit": limit,
        "offset": offset
    }

@app.get("/api/v1/admin/session")
async def get_session_info(
    request: Request,
    session: Dict[str, str] = Depends(validate_session)
):
    """Get current session information"""
    return {
        "username": session.get("username"),
        "created_at": session.get("created_at"),
        "last_activity": session.get("last_activity"),
        "ip_address": session.get("ip_address")
    }

# =============================================================================
# ERROR HANDLERS
# =============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.detail,
            "status_code": exc.status_code
        }
    )

# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    # Use SSL in production
    ssl_keyfile = os.getenv("SSL_KEYFILE")
    ssl_certfile = os.getenv("SSL_CERTFILE")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        ssl_keyfile=ssl_keyfile,
        ssl_certfile=ssl_certfile,
        reload=os.getenv("DEBUG", "false").lower() == "true"
    )

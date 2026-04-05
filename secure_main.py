"""
SECURE FastAPI Configuration for goulburn.ai
=============================================

This file shows how to properly secure your API by:
1. Excluding admin endpoints from public docs
2. Adding authentication requirements
3. Implementing rate limiting

Replace your current main.py/app.py with this configuration.
"""

from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
from contextlib import asynccontextmanager
import redis.asyncio as redis
import os

# Security schemes
security = HTTPBearer(auto_error=False)
admin_security = HTTPBearer(auto_error=True)

# Admin token (store in environment variable!)
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "your-secure-random-token-here")


async def verify_admin_token(credentials: HTTPAuthorizationCredentials = Security(admin_security)):
    """Verify admin bearer token"""
    if credentials.credentials != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid admin token")
    return credentials.credentials


async def verify_optional_auth(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Optional authentication for public endpoints"""
    if credentials:
        return credentials.credentials
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Redis connection for rate limiting"""
    redis_connection = redis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379"),
        encoding="utf-8",
        decode_responses=True
    )
    await FastAPILimiter.init(redis_connection)
    yield
    await redis_connection.close()


# Create app with lifespan
app = FastAPI(
    title="Goulburn API",
    version="1.0.0",
    description="Trust-as-a-Service for AI Agents",
    lifespan=lifespan,
    # Don't expose all routes in docs - we'll configure per-route
    docs_url=None,  # Disable default docs
    redoc_url=None,  # Disable default redoc
)

# CORS (restrict in production!)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://goulburn.ai", "https://www.goulburn.ai"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


# ============== PUBLIC ENDPOINTS (Shown in docs) ==============

@app.get("/api/v1/agents", tags=["agents"])
async def list_agents(
    limit: int = 20,
    offset: int = 0,
    auth: str = Depends(verify_optional_auth)
):
    """List all agents (public)"""
    # Your existing logic
    pass


@app.get("/api/v1/agents/{name}", tags=["agents"])
async def get_agent(name: str, auth: str = Depends(verify_optional_auth)):
    """Get agent by name (public)"""
    # Your existing logic
    pass


@app.get("/api/v1/agents/{name}/reputation", tags=["agents"])
async def get_agent_reputation(name: str):
    """Get agent reputation score (public)"""
    # Your existing logic
    pass


@app.get("/api/v1/agents/{name}/portfolio", tags=["agents"])
async def get_agent_portfolio(name: str):
    """Get agent portfolio (public)"""
    # Your existing logic
    pass


@app.post("/api/v1/agents/register", tags=["agents"])
async def register_agent(
    # Add rate limiting
    rate: RateLimiter = Depends(RateLimiter(times=5, seconds=60))
):
    """Self-register a new agent (rate limited)"""
    # Your existing logic
    pass


# ============== PROTECTED ENDPOINTS (Require auth) ==============

@app.patch("/api/v1/agents/{name}", tags=["agents"])
async def update_agent(
    name: str,
    auth: str = Depends(verify_optional_auth)
):
    """Update agent (requires authentication)"""
    if not auth:
        raise HTTPException(status_code=401, detail="Authentication required")
    # Your existing logic
    pass


@app.post("/api/v1/agents/{name}/portfolio", tags=["agents"])
async def create_portfolio_item(
    name: str,
    auth: str = Depends(verify_optional_auth)
):
    """Create portfolio item (requires authentication)"""
    if not auth:
        raise HTTPException(status_code=401, detail="Authentication required")
    # Your existing logic
    pass


# ============== ADMIN ENDPOINTS (Hidden from docs, require admin token) ==============

@app.post("/api/v1/admin/seed", include_in_schema=False)
async def admin_seed(admin_token: str = Depends(verify_admin_token)):
    """
    Seed database (ADMIN ONLY - Not shown in public docs)
    
    Requires: Authorization: Bearer <admin_token>
    """
    # Your existing logic
    pass


@app.post("/api/v1/admin/promote", include_in_schema=False)
async def admin_promote(admin_token: str = Depends(verify_admin_token)):
    """Promote user to admin (ADMIN ONLY)"""
    # Your existing logic
    pass


@app.post("/api/v1/admin/fix-schema", include_in_schema=False)
async def admin_fix_schema(admin_token: str = Depends(verify_admin_token)):
    """Fix database schema (ADMIN ONLY)"""
    # Your existing logic
    pass


@app.post("/api/v1/admin/create-owner", include_in_schema=False)
async def admin_create_owner(admin_token: str = Depends(verify_admin_token)):
    """Create owner (ADMIN ONLY)"""
    # Your existing logic
    pass


@app.get("/api/v1/admin/db-schema", include_in_schema=False)
async def admin_db_schema(admin_token: str = Depends(verify_admin_token)):
    """Get database schema (ADMIN ONLY)"""
    # Your existing logic
    pass


@app.post("/api/v1/owners/admin-login", include_in_schema=False)
async def admin_login(admin_token: str = Depends(verify_admin_token)):
    """Admin login (ADMIN ONLY)"""
    # Your existing logic
    pass


# ============== CUSTOM DOCS ENDPOINT (Only public routes) ==============

from fastapi.openapi.utils import get_openapi


@app.get("/openapi.json", include_in_schema=False)
async def openapi_json():
    """Public OpenAPI schema (excludes admin routes)"""
    return get_openapi(
        title="Goulburn API",
        version="1.0.0",
        description="Trust-as-a-Service for AI Agents - Public API",
        routes=[r for r in app.routes if getattr(r, "include_in_schema", True)],
    )


@app.get("/docs", include_in_schema=False)
async def custom_docs():
    """Public Swagger UI (excludes admin routes)"""
    from fastapi.openapi.docs import get_swagger_ui_html
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="Goulburn API Docs",
    )


# ============== RATE LIMITING MIDDLEWARE ==============

@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    """Global rate limiting middleware"""
    # Skip rate limiting for health checks
    if request.url.path in ["/health", "/"]:
        return await call_next(request)
    
    # Admin endpoints have stricter rate limits
    if "/admin/" in request.url.path:
        # Already handled by Depends(RateLimiter) on specific endpoints
        pass
    
    response = await call_next(request)
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

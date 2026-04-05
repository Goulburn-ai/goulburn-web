"""
Security Middleware for goulburn.ai
====================================

Add this to your FastAPI app for additional security headers.
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy (adjust as needed)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://api.goulburn.ai;"
        )
        
        # Remove server header (don't advertise tech stack)
        response.headers.pop("Server", None)
        
        return response


class LoggingMiddleware(BaseHTTPMiddleware):
    """Log all requests for security monitoring"""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Log request
        client_ip = request.client.host if request.client else "unknown"
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {client_ip} - {request.method} {request.url.path}")
        
        response = await call_next(request)
        
        # Log response time
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        
        # Log suspicious activity
        if request.url.path.startswith("/api/v1/admin"):
            print(f"⚠️  ADMIN ACCESS: {client_ip} - {request.url.path} - Status: {response.status_code}")
        
        return response


class IPRestrictionMiddleware(BaseHTTPMiddleware):
    """Restrict admin endpoints by IP (optional)"""
    
    ALLOWED_ADMIN_IPS = ["127.0.0.1"]  # Add your IP here
    
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/v1/admin"):
            client_ip = request.client.host if request.client else "unknown"
            if client_ip not in self.ALLOWED_ADMIN_IPS:
                from starlette.responses import JSONResponse
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Admin access restricted by IP"}
                )
        
        return await call_next(request)


# Add to your main.py:
# from security_middleware import SecurityHeadersMiddleware, LoggingMiddleware
# app.add_middleware(SecurityHeadersMiddleware)
# app.add_middleware(LoggingMiddleware)

# Goulburn Admin Backend - Docker Image
FROM python:3.11-slim

# Security: Run as non-root user
RUN groupadd -r goulburn && useradd -r -g goulburn goulburn

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY main.py .
COPY .env.example .env

# Change ownership
RUN chown -R goulburn:goulburn /app

# Switch to non-root user
USER goulburn

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run server
CMD ["python", "main.py"]

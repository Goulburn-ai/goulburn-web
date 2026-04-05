#!/bin/bash
# Goulburn Admin Backend - Startup Script

echo "=================================="
echo "Goulburn Admin Backend"
echo "=================================="
echo ""

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Warning: Redis is not running. Please start Redis first:"
    echo "   redis-server"
    echo ""
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment loaded from .env"
else
    echo "⚠️  Warning: .env file not found. Using defaults."
    echo "   Copy .env.example to .env and configure your settings."
fi

echo ""
echo "Starting Admin API Server..."
echo "URL: http://localhost:${PORT:-8000}"
echo ""

# Run the server
python main.py

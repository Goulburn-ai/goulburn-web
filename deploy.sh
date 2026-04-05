#!/bin/bash
# goulburn.ai Security Deployment Script
# Run this to secure your API

set -e

echo "🔒 goulburn.ai Security Setup"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "secure_main.py" ]; then
    echo -e "${RED}Error: secure_main.py not found${NC}"
    echo "Please run this script from the security-config directory"
    exit 1
fi

echo "Step 1: Generating secure tokens..."
ADMIN_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))" 2>/dev/null || python -c "import secrets; print(secrets.token_urlsafe(32))")
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || python -c "import secrets; print(secrets.token_hex(32))")

echo ""
echo -e "${GREEN}Generated tokens:${NC}"
echo "ADMIN_TOKEN=$ADMIN_TOKEN"
echo "JWT_SECRET_KEY=$JWT_SECRET"
echo ""

echo "Step 2: Creating .env file..."
cat > .env << EOF
# goulburn.ai Security Configuration
# Generated on $(date)

ADMIN_TOKEN=$ADMIN_TOKEN
JWT_SECRET_KEY=$JWT_SECRET
ENVIRONMENT=production
ALLOWED_ORIGINS=https://goulburn.ai,https://www.goulburn.ai
PUBLIC_RATE_LIMIT=60
ADMIN_RATE_LIMIT=10
LOG_LEVEL=INFO
EOF

echo -e "${GREEN}✓ .env file created${NC}"
echo ""

echo "Step 3: Instructions for Railway"
echo "================================="
echo ""
echo "1. Go to https://railway.app and open your project"
echo "2. Click on your API service"
echo "3. Go to 'Variables' tab"
echo "4. Add these variables:"
echo ""
echo -e "   ${YELLOW}ADMIN_TOKEN${NC}=$ADMIN_TOKEN"
echo -e "   ${YELLOW}JWT_SECRET_KEY${NC}=$JWT_SECRET"
echo -e "   ${YELLOW}ENVIRONMENT${NC}=production"
echo ""
echo "5. Click 'New' → 'Database' → 'Add Redis'"
echo "6. Copy secure_main.py to your project as main.py"
echo "7. Deploy"
echo ""

echo "Step 4: Files to copy to your project"
echo "======================================"
echo ""
echo "Copy these files to your project root:"
echo "  - secure_main.py → main.py (replace)"
echo "  - security_middleware.py (new file)"
echo "  - requirements-security.txt (merge with requirements.txt)"
echo ""

read -p "Do you want to see the git commands to deploy? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Git commands:"
    echo "============="
    echo "git add ."
    echo "git commit -m 'Add security: auth, rate limiting, hidden admin routes'"
    echo "git push"
    echo ""
fi

echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Set environment variables in Railway"
echo "2. Add Redis database"
echo "3. Copy secure_main.py to your project"
echo "4. Deploy"
echo ""
echo "For detailed instructions, see SECURITY_SETUP.md"

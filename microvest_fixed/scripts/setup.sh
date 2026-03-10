#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# MicroVest v8 — scripts/setup.sh
# One-Command Project Setup
# ─────────────────────────────────────────────────────────────
# Usage:  bash scripts/setup.sh
# ═══════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo -e "${CYAN}${BOLD}╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║     MicroVest v8 — Setup Script      ║${NC}"
echo -e "${CYAN}${BOLD}╚═══════════════════════════════════════╝${NC}"
echo ""

# ── STEP 1: Prerequisites ────────────────────────────────────
echo -e "${BLUE}[1/7] Checking prerequisites...${NC}"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    echo -e "  ${GREEN}✅ $1 found${NC}"
  else
    echo -e "  ${YELLOW}⚠️  $1 not found — installing...${NC}"
    return 1
  fi
}

check_cmd git    || true
check_cmd node   || { echo -e "${RED}❌ Node.js required. Install from nodejs.org${NC}"; exit 1; }
check_cmd npm    || { echo -e "${RED}❌ npm required.${NC}"; exit 1; }

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}❌ Node.js 18+ required. Current: $(node -v)${NC}"
  exit 1
fi
echo -e "  ${GREEN}✅ Node.js $(node -v)${NC}"

# ── STEP 2: Install tools ────────────────────────────────────
echo ""
echo -e "${BLUE}[2/7] Installing required tools...${NC}"

# Netlify CLI
if ! command -v netlify &>/dev/null; then
  echo "  Installing Netlify CLI..."
  npm install -g netlify-cli@latest --quiet
fi
echo -e "  ${GREEN}✅ Netlify CLI $(netlify --version 2>/dev/null | head -1)${NC}"

# Supabase CLI
if ! command -v supabase &>/dev/null; then
  echo "  Installing Supabase CLI..."
  npm install -g supabase --quiet 2>/dev/null || \
  brew install supabase/tap/supabase 2>/dev/null || \
  echo -e "  ${YELLOW}⚠️  Install Supabase CLI manually: https://supabase.com/docs/guides/cli${NC}"
fi

if command -v supabase &>/dev/null; then
  echo -e "  ${GREEN}✅ Supabase CLI$(NC}"
fi

# ── STEP 3: Environment setup ────────────────────────────────
echo ""
echo -e "${BLUE}[3/7] Setting up environment variables...${NC}"

if [ ! -f ".env.local" ]; then
  cat > .env.local << 'ENVEOF'
# MicroVest v8 — Local Development Environment
# DO NOT commit this file to Git!

# Supabase
SUPABASE_URL=https://zmyiaviafmmwpgxfvsbq.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here

# App
APP_VERSION=8.0
APP_ENV=development
APP_URL=http://localhost:8888

# Web Push VAPID Keys (generate with: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_EMAIL=mailto:admin@microvest.app

# Admin
ADMIN_SECRET_KEY=your-super-secret-admin-key-here
ENVEOF
  echo -e "  ${GREEN}✅ .env.local created${NC}"
  echo -e "  ${YELLOW}⚠️  Edit .env.local with your actual values!${NC}"
else
  echo -e "  ${GREEN}✅ .env.local already exists${NC}"
fi

# Add .env.local to .gitignore
if [ ! -f ".gitignore" ]; then
  touch .gitignore
fi
if ! grep -q ".env.local" .gitignore; then
  cat >> .gitignore << 'GITEOF'
# Environment variables — NEVER commit these
.env.local
.env.*.local
*.env

# Netlify
.netlify/

# Supabase local
supabase/.temp/
supabase/.branches/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Node
node_modules/
GITEOF
  echo -e "  ${GREEN}✅ .gitignore updated${NC}"
fi

# ── STEP 4: Git setup ────────────────────────────────────────
echo ""
echo -e "${BLUE}[4/7] Git setup...${NC}"

if [ ! -d ".git" ]; then
  git init
  git add .
  git commit -m "feat: MicroVest v8 initial commit"
  echo -e "  ${GREEN}✅ Git repository initialized${NC}"
  echo ""
  echo -e "  ${YELLOW}📌 Create a GitHub repo and then run:${NC}"
  echo -e "  ${CYAN}  git remote add origin https://github.com/YOUR_USERNAME/microvest.git${NC}"
  echo -e "  ${CYAN}  git push -u origin main${NC}"
else
  echo -e "  ${GREEN}✅ Git already initialized${NC}"
  if ! git remote | grep -q origin; then
    echo -e "  ${YELLOW}⚠️  No remote 'origin' set. Add with:${NC}"
    echo -e "  ${CYAN}  git remote add origin https://github.com/YOUR_USERNAME/microvest.git${NC}"
  fi
fi

# ── STEP 5: Supabase link ────────────────────────────────────
echo ""
echo -e "${BLUE}[5/7] Supabase setup...${NC}"
echo -e "  ${YELLOW}📌 To link Supabase project, run:${NC}"
echo -e "  ${CYAN}  supabase login${NC}"
echo -e "  ${CYAN}  supabase link --project-ref zmyiaviafmmwpgxfvsbq${NC}"
echo -e "  ${CYAN}  supabase db push${NC}"
echo ""
echo -e "  ${YELLOW}📌 Or run schema manually in Supabase SQL Editor:${NC}"
echo -e "  ${CYAN}  Copy contents of schema_v7.sql → run in Supabase Dashboard${NC}"

# ── STEP 6: Netlify setup ────────────────────────────────────
echo ""
echo -e "${BLUE}[6/7] Netlify setup...${NC}"

if command -v netlify &>/dev/null; then
  echo -e "  ${YELLOW}📌 To deploy to Netlify:${NC}"
  echo -e "  ${CYAN}  netlify login${NC}"
  echo -e "  ${CYAN}  netlify init   (follow prompts)${NC}"
  echo -e "  ${CYAN}  netlify deploy --prod${NC}"
  echo ""
  echo -e "  ${YELLOW}📌 Set environment variables in Netlify Dashboard:${NC}"
  echo -e "  ${CYAN}  Site → Environment Variables → Add each from .env.local${NC}"
fi

# ── STEP 7: GitHub Secrets ───────────────────────────────────
echo ""
echo -e "${BLUE}[7/7] GitHub Actions setup...${NC}"
echo ""
echo -e "  ${YELLOW}📌 Add these secrets in GitHub → Settings → Secrets:${NC}"
echo ""
echo -e "  ${CYAN}  NETLIFY_AUTH_TOKEN${NC}     → Netlify: User Settings → OAuth Applications"
echo -e "  ${CYAN}  NETLIFY_SITE_ID${NC}        → Netlify: Site Settings → General → Site ID"
echo -e "  ${CYAN}  SUPABASE_URL${NC}           → https://zmyiaviafmmwpgxfvsbq.supabase.co"
echo -e "  ${CYAN}  SUPABASE_ANON_KEY${NC}      → Supabase: Settings → API → anon key"
echo -e "  ${CYAN}  SUPABASE_SERVICE_KEY${NC}   → Supabase: Settings → API → service_role key"
echo -e "  ${CYAN}  SUPABASE_ACCESS_TOKEN${NC}  → Supabase: Account → Access Tokens"
echo -e "  ${CYAN}  SUPABASE_PROJECT_REF${NC}   → zmyiaviafmmwpgxfvsbq"
echo -e "  ${CYAN}  SUPABASE_DB_PASSWORD${NC}   → your database password"
echo -e "  ${CYAN}  VAPID_PUBLIC_KEY${NC}       → from web-push generate"
echo -e "  ${CYAN}  VAPID_PRIVATE_KEY${NC}      → from web-push generate"
echo -e "  ${CYAN}  ADMIN_SECRET_KEY${NC}       → your custom secret"

# ── DONE ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   MicroVest v8 Setup Complete! 🎉        ║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Quick Start:${NC}"
echo -e "  ${CYAN}netlify dev${NC}          → Local development server"
echo -e "  ${CYAN}netlify deploy${NC}       → Deploy preview"
echo -e "  ${CYAN}netlify deploy --prod${NC} → Deploy production"
echo -e "  ${CYAN}supabase db push${NC}     → Apply database migrations"
echo ""

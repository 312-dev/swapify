#!/usr/bin/env bash
#
# Swapify — One-time production setup
#
# This script:
#   1. Checks prerequisites (fly, neonctl CLIs)
#   2. Creates the Fly.io app
#   3. Provisions a Neon Postgres database
#   4. Generates all secrets
#   5. Sets secrets on Fly.io + GitHub
#   6. Runs database migrations
#   7. Deploys
#   8. Verifies health
#
# Usage:
#   ./scripts/deploy-init.sh --spotify-client-id <id> [options]
#
# Options:
#   --spotify-client-id <id>    Required. From Spotify Developer Dashboard.
#   --resend-api-key <key>      Optional. For email notifications.
#   --anthropic-api-key <key>   Optional. For AI vibe name generation.
#   --skip-neon                 Skip Neon provisioning (set DATABASE_URL manually).
#   --skip-deploy               Stop after setting secrets (don't deploy yet).
#   --dry-run                   Print what would be done without executing.

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }
fatal() { error "$*"; exit 1; }

# ─── Parse Arguments ─────────────────────────────────────────────────────────
SPOTIFY_CLIENT_ID=""
RESEND_API_KEY=""
ANTHROPIC_API_KEY=""
SKIP_NEON=false
SKIP_DEPLOY=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --spotify-client-id) SPOTIFY_CLIENT_ID="$2"; shift 2 ;;
    --resend-api-key)    RESEND_API_KEY="$2"; shift 2 ;;
    --anthropic-api-key) ANTHROPIC_API_KEY="$2"; shift 2 ;;
    --skip-neon)         SKIP_NEON=true; shift ;;
    --skip-deploy)       SKIP_DEPLOY=true; shift ;;
    --dry-run)           DRY_RUN=true; shift ;;
    *) fatal "Unknown option: $1" ;;
  esac
done

if [[ -z "$SPOTIFY_CLIENT_ID" ]]; then
  fatal "Missing required --spotify-client-id. Get it from https://developer.spotify.com/dashboard"
fi

APP_NAME="swapify"
APP_URL="https://swapify.312.dev"
REGION="ord"

# ─── Dry run wrapper ────────────────────────────────────────────────────────
run() {
  if $DRY_RUN; then
    echo -e "${YELLOW}[dry-run]${NC} $*"
  else
    eval "$@"
  fi
}

# ─── 1. Check Prerequisites ─────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  Swapify Production Setup"
echo "═══════════════════════════════════════════"
echo ""

info "Checking prerequisites..."

command -v flyctl >/dev/null 2>&1 || fatal "flyctl not found. Install: curl -L https://fly.io/install.sh | sh"
command -v gh >/dev/null 2>&1    || fatal "gh (GitHub CLI) not found. Install: brew install gh"
command -v node >/dev/null 2>&1  || fatal "node not found"
command -v npm >/dev/null 2>&1   || fatal "npm not found"

if ! $SKIP_NEON; then
  command -v neonctl >/dev/null 2>&1 || fatal "neonctl not found. Install: npm i -g neonctl && neonctl auth"
fi

# Check CLI auth
flyctl auth whoami >/dev/null 2>&1 || fatal "Not logged in to Fly. Run: flyctl auth login"
gh auth status >/dev/null 2>&1     || fatal "Not logged in to GitHub. Run: gh auth login"

if ! $SKIP_NEON; then
  neonctl projects list >/dev/null 2>&1 || fatal "Not logged in to Neon. Run: neonctl auth"
fi

ok "All prerequisites met"

# ─── 2. Generate Secrets ────────────────────────────────────────────────────
info "Generating secrets..."

IRON_SESSION_PASSWORD=$(openssl rand -base64 32)
POLL_SECRET=$(openssl rand -base64 24)
TOKEN_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

ok "Secrets generated"

# Generate VAPID keys
info "Generating VAPID keys for web push..."
VAPID_OUTPUT=$(npx --yes web-push generate-vapid-keys --json 2>/dev/null)
VAPID_PUBLIC_KEY=$(echo "$VAPID_OUTPUT" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.publicKey)")
VAPID_PRIVATE_KEY=$(echo "$VAPID_OUTPUT" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.privateKey)")
ok "VAPID keys generated"

# ─── 3. Provision Neon Database ─────────────────────────────────────────────
DATABASE_URL=""

if ! $SKIP_NEON; then
  info "Provisioning Neon Postgres database..."

  # Create project
  NEON_OUTPUT=$(run neonctl projects create --name "$APP_NAME" --region-id aws-us-east-2 --output json 2>/dev/null || echo "")

  if [[ -n "$NEON_OUTPUT" && "$NEON_OUTPUT" != *"dry-run"* ]]; then
    DATABASE_URL=$(echo "$NEON_OUTPUT" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.connection_uris[0].connection_uri)")
    ok "Neon database provisioned"
  elif $DRY_RUN; then
    DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
    ok "Would provision Neon database"
  else
    fatal "Failed to create Neon project. Create manually at https://neon.tech and use --skip-neon"
  fi
else
  warn "Skipping Neon provisioning. Set DATABASE_URL manually:"
  warn "  fly secrets set DATABASE_URL=<your-connection-string>"
fi

# ─── 4. Create Fly App ──────────────────────────────────────────────────────
info "Setting up Fly.io app..."

if flyctl apps list 2>/dev/null | grep -q "$APP_NAME"; then
  ok "Fly app '$APP_NAME' already exists"
else
  run flyctl apps create "$APP_NAME" --org personal
  ok "Fly app '$APP_NAME' created"
fi

# ─── 5. Set Fly Secrets ─────────────────────────────────────────────────────
info "Setting Fly.io secrets..."

FLY_SECRETS=(
  "SPOTIFY_CLIENT_ID=$SPOTIFY_CLIENT_ID"
  "SPOTIFY_REDIRECT_URI=${APP_URL}/api/auth/callback"
  "IRON_SESSION_PASSWORD=$IRON_SESSION_PASSWORD"
  "POLL_SECRET=$POLL_SECRET"
  "TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY"
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY"
  "VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY"
  "VAPID_SUBJECT=mailto:deploy@swapify.312.dev"
)

if [[ -n "$DATABASE_URL" ]]; then
  FLY_SECRETS+=("DATABASE_URL=$DATABASE_URL")
fi

if [[ -n "$RESEND_API_KEY" ]]; then
  FLY_SECRETS+=("RESEND_API_KEY=$RESEND_API_KEY")
fi

if [[ -n "$ANTHROPIC_API_KEY" ]]; then
  FLY_SECRETS+=("ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
fi

run flyctl secrets set "${FLY_SECRETS[@]}" --app "$APP_NAME"
ok "Fly secrets set"

# ─── 6. Set GitHub Secrets ──────────────────────────────────────────────────
info "Setting GitHub Actions secrets..."

# Get Fly API token for deploy workflow
FLY_API_TOKEN=$(run flyctl tokens create deploy --app "$APP_NAME" -x 999999h 2>/dev/null | tail -1 || echo "")

REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo "")
if [[ -z "$REPO" ]]; then
  warn "Could not detect GitHub repo. Set these secrets manually:"
  warn "  gh secret set FLY_API_TOKEN"
  warn "  gh secret set DATABASE_URL"
else
  if [[ -n "$FLY_API_TOKEN" && ! $DRY_RUN ]]; then
    echo "$FLY_API_TOKEN" | gh secret set FLY_API_TOKEN --repo "$REPO"
    ok "Set FLY_API_TOKEN on $REPO"
  elif $DRY_RUN; then
    ok "Would set FLY_API_TOKEN on $REPO"
  fi

  if [[ -n "$DATABASE_URL" ]]; then
    if $DRY_RUN; then
      ok "Would set DATABASE_URL on $REPO"
    else
      echo "$DATABASE_URL" | gh secret set DATABASE_URL --repo "$REPO"
      ok "Set DATABASE_URL on $REPO"
    fi
  fi
fi

# ─── 7. Run Migrations ──────────────────────────────────────────────────────
if [[ -n "$DATABASE_URL" ]]; then
  info "Running database migrations..."
  run DATABASE_URL="$DATABASE_URL" npm run db:migrate
  ok "Migrations complete"
else
  warn "Skipping migrations — no DATABASE_URL set"
fi

# ─── 8. Deploy ──────────────────────────────────────────────────────────────
if ! $SKIP_DEPLOY; then
  info "Deploying to Fly.io..."
  run flyctl deploy --remote-only --app "$APP_NAME"
  ok "Deployed!"

  # ─── 9. Verify ──────────────────────────────────────────────────────────
  info "Waiting for health check..."
  sleep 10

  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/health" 2>/dev/null || echo "000")

  if [[ "$HTTP_STATUS" == "200" ]]; then
    ok "Health check passed!"
  else
    warn "Health check returned $HTTP_STATUS — check logs: flyctl logs --app $APP_NAME"
  fi
else
  info "Skipping deploy (--skip-deploy). Deploy manually or push to main."
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  Setup Complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "  App URL:       $APP_URL"
echo "  Fly Dashboard: https://fly.io/apps/$APP_NAME"
if [[ -n "$REPO" ]]; then
echo "  GitHub Repo:   https://github.com/$REPO"
fi
echo ""
echo -e "${YELLOW}Manual steps remaining:${NC}"
echo ""
echo "  1. Spotify Developer Dashboard (https://developer.spotify.com/dashboard):"
echo "     - Add redirect URI: ${APP_URL}/api/auth/callback"
echo "     - Add beta tester emails under User Management"
echo ""
echo "  2. DNS: Add CNAME record"
echo "     swapify.312.dev → ${APP_NAME}.fly.dev"
echo ""
echo "  3. Fly TLS cert (after DNS is set):"
echo "     flyctl certs add swapify.312.dev --app $APP_NAME"
echo ""
echo "  4. Future deploys happen automatically on push to main."
echo ""

# Fly.io deployment helper for VisionAssist backend
# Run this in PowerShell from the repository root or the backend folder.
# It requires the Fly CLI (`fly`) to be installed and you must be logged in via `fly auth login`.

# Check for fly
if (-not (Get-Command fly -ErrorAction SilentlyContinue)) {
    Write-Error "Fly CLI not found. Install from https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
}

Write-Host "--- VisionAssist Fly.io deploy helper ---"

# Ask user for values
$appName = Read-Host "Fly app name (default: visionassist-backend)"
if ([string]::IsNullOrWhiteSpace($appName)) { $appName = "visionassist-backend" }
$region = Read-Host "Fly region (optional, e.g. ord, iad, sfo). Leave blank for default"
$vercelDomain = Read-Host "Your Vercel frontend domain (e.g. my-project.vercel.app)"
if ([string]::IsNullOrWhiteSpace($vercelDomain)) {
    Write-Error "Vercel domain is required to set ALLOWED_ORIGINS and FRONTEND_BASE_URL."
    exit 1
}
$googleClientId = Read-Host "GOOGLE_CLIENT_ID"
$googleClientSecret = Read-Host "GOOGLE_CLIENT_SECRET"

# Login step (interactive)
Write-Host "Opening Fly login (if not already authenticated)..."
fly auth login

# Launch app without deploying so we can set secrets first
$launchCmd = "fly launch --name $appName --copy-config --no-deploy"
if (-not [string]::IsNullOrWhiteSpace($region)) { $launchCmd += " --region $region" }
Write-Host "Running: $launchCmd"
Invoke-Expression $launchCmd

# Build the redirect URI for Google OAuth
$redirectUri = "https://$appName.fly.dev/auth/google/callback"

Write-Host "Setting secrets on Fly (this will encrypt environment variables)..."
$secretsCmd = "fly secrets set DATABASE_PATH=visionassist.db ALLOWED_ORIGINS=\"https://$vercelDomain\" MAX_FILE_SIZE_BYTES=5000000 GOOGLE_CLIENT_ID=\"$googleClientId\" GOOGLE_CLIENT_SECRET=\"$googleClientSecret\" GOOGLE_REDIRECT_URI=\"$redirectUri\" FRONTEND_BASE_URL=\"https://$vercelDomain\""
Write-Host "Running: $secretsCmd"
Invoke-Expression $secretsCmd

# Deploy
Write-Host "Deploying to Fly..."
fly deploy

Write-Host "Deploy complete. Visit https://$appName.fly.dev to test the backend endpoints."
Write-Host "Next: set VITE_API_URL=https://$appName.fly.dev in your Vercel project settings and redeploy the frontend."

Write-Host "Done."

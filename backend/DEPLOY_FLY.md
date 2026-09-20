Fly.io Deployment (backend)

Prerequisites
- Docker (not strictly required if Fly builds from Dockerfile, but useful locally)
- Fly CLI installed: https://fly.io/docs/hands-on/install-flyctl/
- GitHub repo pushed (already done)

Quick manual steps

1. Login to Fly (interactive):

```powershell
fly auth login
```

2. From the `backend` folder, launch the app (no immediate deploy):

```powershell
cd backend
fly launch --name visionassist-backend --copy-config --no-deploy
```

3. Set required secrets (replace placeholders):

```powershell
fly secrets set \
  DATABASE_PATH=visionassist.db \
  ALLOWED_ORIGINS="https://<your-vercel-domain>" \
  MAX_FILE_SIZE_BYTES=5000000 \
  GOOGLE_CLIENT_ID="<your-google-client-id>" \
  GOOGLE_CLIENT_SECRET="<your-google-client-secret>" \
  GOOGLE_REDIRECT_URI="https://visionassist-backend.fly.dev/auth/google/callback" \
  FRONTEND_BASE_URL="https://<your-vercel-domain>"
```

4. Deploy:

```powershell
fly deploy
```

5. After deployment:
- Note the Fly app URL (e.g., https://visionassist-backend.fly.dev)
- In your Vercel project settings, set the environment variable `VITE_API_URL` to that URL
- Redeploy your frontend on Vercel

Local Docker test (optional)

```powershell
cd backend
docker build -t visionassist-backend .
docker run -p 8000:8000 --env-file .env -it visionassist-backend
# then in another shell
curl http://localhost:8000/api/health
```

Notes
- Ensure the Google OAuth redirect URI in your Google Cloud Console matches the Fly app callback URL exactly.
- If you need a different app name, update the redirect URI and Vercel env accordingly.

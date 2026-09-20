# VisionAssist

VisionAssist is an AI-powered visual assistance web application for helping visually impaired users understand their surroundings through a camera. It combines computer vision, OCR, speech interaction, and a modern accessible interface.

## Problem statement

People with visual impairments often rely on helpers, guide dogs, or other aids to understand unfamiliar spaces. VisionAssist provides a privacy-conscious, camera-based assistant that can identify nearby objects, read visible text, describe a scene, and provide voice guidance.

## Features

- Dashboard with camera controls and analysis modes
- Real-time camera access using the browser MediaDevices API
- Object detection through a YOLO-based backend service
- OCR-driven text reading with speech output
- Scene description from detected objects and available text
- Voice-command assistance with browser speech recognition when supported
- Text-to-speech output with rate control and stop controls
- Safety warnings for common obstacles
- Analysis history with search, deletion, and clear-all actions
- Settings for speech, accessibility, privacy, and camera handling

## Architecture

- Frontend: React + Vite + JavaScript + CSS + Framer Motion + Axios + React Router + Lucide React
- Backend: FastAPI + OpenCV + Pillow + OCR and object-detection integration + SQLite history storage
- Database: SQLite with a lightweight abstraction that can be swapped to PostgreSQL later

## Technology stack

### Frontend
- React
- Vite
- JavaScript
- CSS
- Framer Motion
- Axios
- React Router
- Lucide React

### Backend
- Python
- FastAPI
- OpenCV
- Pillow
- OCR integration
- YOLO-based object detection integration

## Installation

### Prerequisites
- Node.js 18+
- Python 3.10+

### Install dependencies

```bash
cd frontend
npm install

cd ../backend
py -3.11 -m pip install -r requirements.txt
```

## Environment variables

Create a file named `.env` inside the backend directory with the following variables:

```env
DATABASE_PATH=visionassist.db
ALLOWED_ORIGINS=http://localhost:5173
MAX_FILE_SIZE_BYTES=5000000
```

## How to run

### Frontend and backend

```bash
cd frontend
npm install
npm run dev
```

`npm run dev` starts Vite on `http://localhost:5173` and the FastAPI backend on `http://localhost:8000` together using Python 3.11. Stop the frontend command to stop both processes.

## Public deployment

### Deploying the frontend on Vercel

1. Push the project to GitHub.
2. Sign in to Vercel and create a new project.
3. Select this repository and set the root directory to `frontend`.
4. Set the build command to `npm run build` and the output directory to `dist`.
5. Add an environment variable if your backend is hosted externally:
   - `VITE_API_URL=https://your-backend.example.com`

### Notes

- The frontend is deployable as a public website using Vercel.
- The backend remains a separate service and must also be hosted for analysis features.
- Visitors can open the homepage without a local camera, and can login when ready.

## Backend deployment

The backend can be deployed separately on a free service such as Fly.io, Render, or Railway. A Dockerfile and Fly configuration are included in `backend/`.

### Fly.io deployment

1. Install the Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Login: `fly auth login`
3. Create the app in the `backend` folder:
   ```bash
   cd backend
   fly launch --name visionassist-backend --copy-config
   ```
4. Add required secrets in the Fly app settings:
   - `DATABASE_PATH=visionassist.db`
   - `ALLOWED_ORIGINS=https://your-frontend.vercel.app`
   - `MAX_FILE_SIZE_BYTES=5000000`
   - `GOOGLE_CLIENT_ID=...`
   - `GOOGLE_CLIENT_SECRET=...`
   - `GOOGLE_REDIRECT_URI=https://your-backend.fly.dev/auth/google/callback`
   - `FRONTEND_BASE_URL=https://your-frontend.vercel.app`
5. Deploy:
   ```bash
   fly deploy
   ```

### Frontend integration

Once the backend is hosted, set `VITE_API_URL` in `frontend/.env` or in Vercel environment variables to your backend URL, for example:

```env
VITE_API_URL=https://your-backend.fly.dev
```

Then redeploy the frontend.

## API documentation

The FastAPI app provides automatic OpenAPI documentation at:

- http://localhost:8000/docs
- http://localhost:8000/redoc

## AI/computer vision workflow

1. The user starts the camera and captures a frame.
2. The frontend sends the image to the backend.
3. The backend runs object detection and OCR.
4. Results are returned to the UI.
5. The frontend announces important outcomes using text-to-speech.

## Screenshots

Add screenshots to the `screenshots` folder once the app is running locally.

## Future enhancements

- Add a dedicated scene-captioning model
- Support more languages for OCR
- Introduce offline fallbacks and better performance tuning
- Integrate a more advanced vision-language model for richer descriptions
- Add user accounts and persistent preferences

## Limitations

- OCR accuracy depends on image quality and lighting.
- Object detection depends on the model and camera quality.
- Scene descriptions are derived from detected objects and visible text rather than a full vision-language model.
- Some browser speech APIs are not supported on every device.

## Privacy considerations

- Images are processed temporarily and are not permanently stored in the app.
- The app does not perform facial identification.
- Analysis history can be deleted by the user at any time.

## Exact commands to run the project

```bash
cd frontend
npm install
npm run dev
```

```bash
cd backend
py -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

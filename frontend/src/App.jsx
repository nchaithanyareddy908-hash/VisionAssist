import { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { clearHistory, deleteHistoryItem, getHistory, healthCheck, saveHistory, uploadAnalysis } from './services/api';
import { createSpeechRecognition, speakText, stopSpeech } from './services/speech';

function App() {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [currentMode, setCurrentMode] = useState('detect');
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Choose a mode and start the camera to begin.');
  const [searchQuery, setSearchQuery] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);
  const [settings, setSettings] = useState({
    speechEnabled: true,
    speechRate: 1,
    highContrast: false,
    largeText: false,
    reducedMotion: false,
  });
  const [user, setUser] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('visionassist-settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
    const storedUser = localStorage.getItem('visionassist-user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    loadHistory();
    healthCheck().then(() => setStatusMessage('Backend connection is healthy.')).catch(() => setStatusMessage('Backend offline. Start the FastAPI server to enable analysis.'));
  }, []);

  useEffect(() => {
    document.body.classList.toggle('high-contrast', settings.highContrast);
    document.body.classList.toggle('large-text', settings.largeText);
    document.body.classList.toggle('reduced-motion', settings.reducedMotion);
    localStorage.setItem('visionassist-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const preview = videoRef.current;
    if (preview) {
      if (isCameraActive && stream) {
        preview.srcObject = stream;
      } else {
        preview.srcObject = null;
      }
    }
    return () => {
      if (preview) preview.srcObject = null;
    };
  }, [isCameraActive, stream]);

  const loadHistory = async () => {
    try {
      const response = await getHistory();
      setHistory(response.data);
    } catch (error) {
      console.error('Unable to load history', error);
    }
  };

  const updateSetting = (key, value) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  const startCamera = async () => {
    // Ensure getUserMedia is available and we're in a secure context (HTTPS or localhost)
    const supportsGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!supportsGetUserMedia) {
      setPermissionError('Camera access is not available in this browser.');
      setStatusMessage('This browser does not support camera access (getUserMedia). Try a modern browser like Chrome, Edge, or Firefox.');
      return;
    }
    if (!isSecure) {
      setPermissionError('Camera access requires a secure context (HTTPS).');
      setStatusMessage('Serve the app over HTTPS or use localhost to enable camera access.');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment',
        },
        audio: false,
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      setPermissionError('');
      setStatusMessage('Camera is ready. Capture a frame to analyze it.');
    } catch (error) {
      // Distinguish between permission denied and other errors
      const message = (error && error.name === 'NotAllowedError') ? 'Camera permission was denied. Allow camera access and try again.' : 'Camera permission was denied or unavailable. Please allow camera access in your browser settings and try again.';
      setPermissionError(message);
      setStatusMessage('Camera access is blocked or unavailable.');
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setIsCameraActive(false);
    setStatusMessage('Camera stopped.');
  };

  const captureFrame = async () => {
    if (!isCameraActive || !videoRef.current) {
      setPermissionError('Start the camera before capturing a frame.');
      return;
    }
    setIsProcessing(true);
    setStatusMessage('Processing the latest frame…');
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      const response = await uploadAnalysis(currentMode === 'detect' ? 'detect' : currentMode === 'ocr' ? 'ocr' : 'describe', file);
      const resultData = response.data;
      if (currentMode === 'detect') {
        const speechText = resultData.objects?.length ? `${resultData.objects[0].name} detected.` : 'No objects detected.';
        setLastResult({ ...resultData, warnings: resultData.objects?.length ? [] : [] });
        if (settings.speechEnabled) speakText(speechText, settings.speechRate, settings.speechEnabled);
      } else if (currentMode === 'ocr') {
        setLastResult(resultData);
        if (settings.speechEnabled) speakText(resultData.text || 'No readable text detected.', settings.speechRate, settings.speechEnabled);
      } else {
        setLastResult(resultData);
        if (settings.speechEnabled) speakText(resultData.description, settings.speechRate, settings.speechEnabled);
      }
      await saveHistory(currentMode, resultData);
      await loadHistory();
      setStatusMessage('Analysis completed.');
    } catch (error) {
      setPermissionError('The analysis request failed. Please ensure the backend is running and the image is valid.');
      setStatusMessage('Analysis failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startVoice = () => {
    const Recognition = createSpeechRecognition();
    if (!Recognition) {
      setStatusMessage('Speech recognition is not available in this browser.');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setVoiceListening(true);
    recognition.onerror = () => {
      setVoiceListening(false);
      setStatusMessage('Voice command could not be recognized.');
    };
    recognition.onend = () => setVoiceListening(false);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(' ').trim().toLowerCase();
      if (transcript.includes('what do you see')) {
        captureFrame();
      } else if (transcript.includes('read this')) {
        speakText(lastResult?.text || 'No text available to read.', settings.speechRate, settings.speechEnabled);
      } else if (transcript.includes('describe the scene')) {
        speakText(lastResult?.description || 'No scene description available.', settings.speechRate, settings.speechEnabled);
      } else if (transcript.includes('start object detection')) {
        setCurrentMode('detect');
        captureFrame();
      } else if (transcript.includes('stop camera')) {
        stopCamera();
      } else {
        setStatusMessage(`Heard: ${transcript}`);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setVoiceListening(false);
  };

  const authenticateUser = ({ name, method }) => {
    const profile = { name, method, signedInAt: new Date().toISOString() };
    setUser(profile);
    localStorage.setItem('visionassist-user', JSON.stringify(profile));
    setStatusMessage(`Signed in as ${profile.name}.`);
  };

  const signOut = () => {
    stopCamera();
    setUser(null);
    localStorage.removeItem('visionassist-user');
    autoCameraRequested.current = false;
    setStatusMessage('You have signed out.');
  };

  const deleteHistoryEntry = async (id) => {
    try {
      await deleteHistoryItem(id);
      await loadHistory();
    } catch (error) {
      setStatusMessage('Unable to delete the selected history item.');
    }
  };

  const clearAllHistory = async () => {
    try {
      await clearHistory();
      await loadHistory();
      setStatusMessage('History cleared.');
    } catch (error) {
      setStatusMessage('Unable to clear history.');
    }
  };

  const dashboardProps = useMemo(
    () => ({
      settings,
      videoRef,
      isCameraActive,
      startCamera,
      stopCamera,
      captureFrame,
      isProcessing,
      permissionError,
      currentMode,
      setCurrentMode,
      lastResult,
      history,
      voiceListening,
      startVoice,
      stopVoice,
      speakText: (text) => speakText(text, settings.speechRate, settings.speechEnabled),
      stopSpeech,
      statusMessage,
      searchQuery,
      setSearchQuery,
      onDeleteHistory: deleteHistoryEntry,
      onClearHistory: clearAllHistory,
      user,
      onLogout: signOut,
    }),
    [settings, isCameraActive, isProcessing, permissionError, currentMode, lastResult, history, voiceListening, statusMessage, searchQuery, user]
  );

  return (
    <div className="app-shell">
      <div className="visually-hidden" aria-live="polite">
        {statusMessage}
      </div>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login onLogin={authenticateUser} onGoogleLogin={authenticateUser} />} />
        <Route path="/dashboard" element={user ? <Dashboard {...dashboardProps} /> : <Navigate to="/login" replace />} />
        <Route path="/settings" element={user ? <Settings settings={settings} updateSetting={updateSetting} onClearHistory={clearAllHistory} /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;

import { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
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
  const recognitionRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('visionassist-settings');
    if (saved) {
      setSettings(JSON.parse(saved));
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
    if (!isCameraActive) return undefined;
    const preview = videoRef.current;
    if (preview && stream) preview.srcObject = stream;
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
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setStream(mediaStream);
      setIsCameraActive(true);
      setPermissionError('');
      setStatusMessage('Camera is ready. Capture a frame to analyze it.');
    } catch (error) {
      setPermissionError('Camera permission was denied or unavailable. Please allow camera access and try again.');
      setStatusMessage('Camera access is blocked.');
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
    }),
    [settings, isCameraActive, isProcessing, permissionError, currentMode, lastResult, history, voiceListening, statusMessage, searchQuery]
  );

  return (
    <div className="app-shell">
      <div className="visually-hidden" aria-live="polite">
        {statusMessage}
      </div>
      <Routes>
        <Route path="/" element={<Dashboard {...dashboardProps} />} />
        <Route path="/settings" element={<Settings settings={settings} updateSetting={updateSetting} onClearHistory={clearAllHistory} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <video ref={videoRef} autoPlay playsInline muted className="hidden-video" />
    </div>
  );
}

export default App;

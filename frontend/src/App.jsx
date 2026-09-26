import { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Settings from './pages/Settings';
import Login from './pages/Login';

import {
  clearHistory,
  deleteHistoryItem,
  getHistory,
  healthCheck,
  saveHistory,
  uploadAnalysis,
} from './services/api';

import {
  createSpeechRecognition,
  speakText,
  stopSpeech,
} from './services/speech';

function App() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [currentMode, setCurrentMode] = useState('detect');
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [statusMessage, setStatusMessage] = useState(
    'Choose a mode and start the camera to begin.'
  );
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

  useEffect(() => {
    const savedSettings = localStorage.getItem('visionassist-settings');

    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch {
        console.log('Could not load saved settings.');
      }
    }

    const storedUser = localStorage.getItem('visionassist-user');

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('visionassist-user');
      }
    }

    loadHistory();

    healthCheck()
      .then(() => {
        setStatusMessage('Backend connection is healthy.');
      })
      .catch((error) => {
        console.error('Backend health check failed:', error);

        setStatusMessage(
          'Backend connection could not be verified.'
        );
      });
  }, []);

  useEffect(() => {
    document.body.classList.toggle(
      'high-contrast',
      settings.highContrast
    );

    document.body.classList.toggle(
      'large-text',
      settings.largeText
    );

    document.body.classList.toggle(
      'reduced-motion',
      settings.reducedMotion
    );

    localStorage.setItem(
      'visionassist-settings',
      JSON.stringify(settings)
    );
  }, [settings]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (isCameraActive && stream) {
      video.srcObject = stream;

      video.play().catch((error) => {
        console.error('Video playback failed:', error);
      });
    } else {
      video.srcObject = null;
    }

    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [isCameraActive, stream]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      recognitionRef.current?.stop();
    };
  }, []);

  const loadHistory = async () => {
    try {
      const response = await getHistory();

      if (Array.isArray(response.data)) {
        setHistory(response.data);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('Unable to load history:', error);
    }
  };

  const updateSetting = (key, value) => {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const startCamera = async () => {
    const supportsGetUserMedia =
      !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
      );

    const isSecure =
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (!supportsGetUserMedia) {
      setPermissionError(
        'Camera access is not available in this browser.'
      );

      setStatusMessage(
        'This browser does not support camera access.'
      );

      return;
    }

    if (!isSecure) {
      setPermissionError(
        'Camera access requires a secure connection.'
      );

      setStatusMessage(
        'Please use HTTPS or localhost.'
      );

      return;
    }

    try {
      setPermissionError('');
      setStatusMessage('Starting camera...');

      const mediaStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            width: {
              ideal: 1280,
            },
            height: {
              ideal: 720,
            },
            facingMode: 'environment',
          },
          audio: false,
        });

      streamRef.current = mediaStream;

      setStream(mediaStream);
      setIsCameraActive(true);

      setStatusMessage(
        'Camera is ready. Capture a frame to analyze it.'
      );
    } catch (error) {
      console.error('Camera error:', error);

      if (error?.name === 'NotAllowedError') {
        setPermissionError(
          'Camera permission was denied. Allow camera access and try again.'
        );
      } else {
        setPermissionError(
          'Camera is unavailable. Please check your browser camera settings.'
        );
      }

      setStatusMessage('Camera access failed.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;

    setStream(null);
    setIsCameraActive(false);

    setStatusMessage('Camera stopped.');
  };

  const captureFrame = async () => {
    if (!isCameraActive) {
      setPermissionError(
        'Start the camera before capturing a frame.'
      );

      return;
    }

    const video = videoRef.current;

    if (!video) {
      setPermissionError(
        'Camera preview is not available.'
      );

      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      setPermissionError(
        'Camera frame is not ready yet. Wait a moment and try again.'
      );

      return;
    }

    setIsProcessing(true);
    setPermissionError('');
    setStatusMessage('Capturing image...');

    try {
      const canvas = document.createElement('canvas');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error(
          'Could not create the image canvas.'
        );
      }

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(
                new Error(
                  'Could not create image data from the camera.'
                )
              );
            }
          },
          'image/jpeg',
          0.85
        );
      });

      const file = new File(
        [blob],
        'capture.jpg',
        {
          type: 'image/jpeg',
        }
      );

      setStatusMessage(
        `Sending image to backend for ${currentMode} analysis...`
      );

      const response = await uploadAnalysis(
        currentMode,
        file
      );

      const resultData = response.data;

      if (!resultData) {
        throw new Error(
          'The backend returned an empty response.'
        );
      }

      setLastResult(resultData);

      if (currentMode === 'detect') {
        const speechText =
          resultData.objects?.length
            ? `${resultData.objects.length} object${
                resultData.objects.length === 1
                  ? ''
                  : 's'
              } detected.`
            : 'No objects detected.';

        if (settings.speechEnabled) {
          speakText(
            speechText,
            settings.speechRate,
            settings.speechEnabled
          );
        }
      }

      if (currentMode === 'ocr') {
        if (settings.speechEnabled) {
          speakText(
            resultData.text ||
              'No readable text detected.',
            settings.speechRate,
            settings.speechEnabled
          );
        }
      }

      if (currentMode === 'describe') {
        if (settings.speechEnabled) {
          speakText(
            resultData.description ||
              'No scene description available.',
            settings.speechRate,
            settings.speechEnabled
          );
        }
      }

      try {
        await saveHistory(
          currentMode,
          resultData
        );

        await loadHistory();
      } catch (historyError) {
        console.error(
          'History save failed:',
          historyError
        );
      }

      setStatusMessage(
        'Analysis completed successfully.'
      );
    } catch (error) {
      console.error(
        'Analysis request failed:',
        error
      );

      let message =
        'Analysis request failed.';

      if (error?.response) {
        const backendDetail =
          error.response.data?.detail;

        if (backendDetail) {
          message = `Backend error: ${backendDetail}`;
        } else {
          message =
            `Backend returned HTTP ${error.response.status}.`;
        }
      } else if (error?.message) {
        message = error.message;
      }

      setPermissionError(message);
      setStatusMessage('Analysis failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startVoice = () => {
    const Recognition =
      createSpeechRecognition();

    if (!Recognition) {
      setStatusMessage(
        'Speech recognition is not available in this browser.'
      );

      return;
    }

    const recognition = new Recognition();

    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setVoiceListening(true);
    };

    recognition.onerror = (event) => {
      console.error(
        'Speech recognition error:',
        event
      );

      setVoiceListening(false);

      setStatusMessage(
        'Voice command could not be recognized.'
      );
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(
        event.results
      )
        .map(
          (result) =>
            result[0].transcript
        )
        .join(' ')
        .trim()
        .toLowerCase();

      if (transcript.includes('what do you see')) {
        captureFrame();
      } else if (
        transcript.includes('read this')
      ) {
        speakText(
          lastResult?.text ||
            'No text available to read.',
          settings.speechRate,
          settings.speechEnabled
        );
      } else if (
        transcript.includes('describe the scene')
      ) {
        speakText(
          lastResult?.description ||
            'No scene description available.',
          settings.speechRate,
          settings.speechEnabled
        );
      } else if (
        transcript.includes(
          'start object detection'
        )
      ) {
        setCurrentMode('detect');

        setTimeout(() => {
          captureFrame();
        }, 100);
      } else if (
        transcript.includes('stop camera')
      ) {
        stopCamera();
      } else {
        setStatusMessage(
          `Heard: ${transcript}`
        );
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error(
        'Speech recognition start failed:',
        error
      );

      setVoiceListening(false);
    }
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setVoiceListening(false);
  };

  const authenticateUser = ({
    name,
    method,
  }) => {
    const profile = {
      name,
      method,
      signedInAt:
        new Date().toISOString(),
    };

    setUser(profile);

    localStorage.setItem(
      'visionassist-user',
      JSON.stringify(profile)
    );

    setStatusMessage(
      `Signed in as ${profile.name}.`
    );
  };

  const signOut = () => {
    stopCamera();

    setUser(null);

    localStorage.removeItem(
      'visionassist-user'
    );

    setStatusMessage(
      'You have signed out.'
    );
  };

  const deleteHistoryEntry = async (id) => {
    try {
      await deleteHistoryItem(id);
      await loadHistory();

      setStatusMessage(
        'History item deleted.'
      );
    } catch (error) {
      console.error(
        'Unable to delete history:',
        error
      );

      setStatusMessage(
        'Unable to delete the selected history item.'
      );
    }
  };

  const clearAllHistory = async () => {
    try {
      await clearHistory();
      await loadHistory();

      setStatusMessage(
        'History cleared.'
      );
    } catch (error) {
      console.error(
        'Unable to clear history:',
        error
      );

      setStatusMessage(
        'Unable to clear history.'
      );
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
      speakText: (text) =>
        speakText(
          text,
          settings.speechRate,
          settings.speechEnabled
        ),
      stopSpeech,
      statusMessage,
      searchQuery,
      setSearchQuery,
      onDeleteHistory:
        deleteHistoryEntry,
      onClearHistory:
        clearAllHistory,
      user,
      onLogout: signOut,
    }),
    [
      settings,
      isCameraActive,
      isProcessing,
      permissionError,
      currentMode,
      lastResult,
      history,
      voiceListening,
      statusMessage,
      searchQuery,
      user,
    ]
  );

  return (
    <div className="app-shell">
      <div
        className="visually-hidden"
        aria-live="polite"
      >
        {statusMessage}
      </div>

      <Routes>
        <Route
          path="/"
          element={<Landing />}
        />

        <Route
          path="/login"
          element={
            <Login
              onLogin={authenticateUser}
              onGoogleLogin={authenticateUser}
            />
          }
        />

        <Route
          path="/dashboard"
          element={
            user ? (
              <Dashboard
                {...dashboardProps}
              />
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        <Route
          path="/settings"
          element={
            user ? (
              <Settings
                settings={settings}
                updateSetting={
                  updateSetting
                }
                onClearHistory={
                  clearAllHistory
                }
              />
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </div>
  );
}

export default App;
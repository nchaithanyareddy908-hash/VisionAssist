import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Camera,
  Clipboard,
  Eye,
  Mic,
  PauseCircle,
  Search,
  Settings2,
  Sparkles,
  Volume2,
  Waves,
} from 'lucide-react';
import { Link } from 'react-router-dom';

function Dashboard({
  settings,
  videoRef,
  isCameraActive,
  startCamera,
  stopCamera,
  captureFrame,
  isProcessing,
  permissionError,
  capturedImage,
  currentMode,
  setCurrentMode,
  lastResult,
  history,
  voiceListening,
  startVoice,
  stopVoice,
  speakText,
  stopSpeech,
  statusMessage,
  searchQuery,
  setSearchQuery,
  onDeleteHistory,
  onClearHistory,
  user,
  onLogout,
}) {
  const modes = [
    { key: 'detect', label: 'Object Detection', description: 'Identify nearby objects in real time' },
    { key: 'ocr', label: 'Text Reader', description: 'Read printed text from a captured frame' },
    { key: 'describe', label: 'Scene Description', description: 'Summarize what is visible' },
  ];

  const filteredHistory = history.filter((entry) => {
    const query = searchQuery.toLowerCase();
    return (
      entry.analysis_type.toLowerCase().includes(query) ||
      JSON.stringify(entry.result).toLowerCase().includes(query)
    );
  });

  const renderResult = () => {
    if (!lastResult) return null;
    if (currentMode === 'detect') {
      return (
        <div>
          <h3>Detected objects</h3>
          {lastResult.objects?.length ? (
            lastResult.objects.map((item, index) => (
              <div key={`${item.name}-${index}`} className="result-item">
                <strong>{item.name}</strong>
                <span>{(item.confidence * 100).toFixed(0)}% confidence</span>
              </div>
            ))
          ) : (
            <p>No objects detected.</p>
          )}
        </div>
      );
    }
    if (currentMode === 'ocr') {
      return (
        <div>
          <h3>Extracted text</h3>
          {lastResult.text ? <p>{lastResult.text}</p> : <p>No readable text found.</p>}
        </div>
      );
    }
    return (
      <div>
        <h3>Scene description</h3>
        <p>{lastResult.description || 'No description available.'}</p>
      </div>
    );
  };

  return (
    <div className="dashboard-shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">VisionAssist</p>
          <h1>Speak with your surroundings</h1>
          <p className="hero-description">
            Camera-based assistance for object recognition, reading, scene understanding, and voice guidance.
          </p>
          {user ? (
            <p className="helper-text">Signed in as <strong>{user.name}</strong> ({user.method === 'google' ? 'Google' : 'Email'})</p>
          ) : null}
        </div>
        <div className="hero-actions">
          <Link to="/settings" className="secondary-btn">
            <Settings2 size={18} /> Settings
          </Link>
          {user ? (
            <button className="secondary-btn logout-btn" onClick={() => {
              onLogout();
              window.location.href = '/';
            }}>
              <AlertTriangle size={18} /> Sign out
            </button>
          ) : null}
          <button className="primary-btn" onClick={isCameraActive ? stopCamera : startCamera}>
            <Camera size={18} /> {isCameraActive ? 'Stop Camera' : 'Start Camera'}
          </button>
        </div>
      </header>

      <section className="grid two-up">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card camera-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Live camera</p>
              <h2>Camera preview</h2>
            </div>
            <div className={`status-pill ${isCameraActive ? 'active' : 'inactive'}`}>
              {isCameraActive ? 'Live' : 'Idle'}
            </div>
          </div>
          <div className="video-wrapper">
            <video ref={videoRef} id="camera-preview" autoPlay playsInline muted className="video-feed" />
            {!isCameraActive && <div className="video-overlay">Camera is currently off.</div>}
          </div>
          {permissionError && <p className="error-message">{permissionError}</p>}
          <div className="control-row">
            <button className="primary-btn" onClick={captureFrame} disabled={isProcessing || !isCameraActive}>
              {isProcessing ? 'Processing…' : 'Capture Frame'}
            </button>
            <button className="secondary-btn" onClick={voiceListening ? stopVoice : startVoice}>
              <Mic size={18} /> {voiceListening ? 'Listening…' : 'Voice Command'}
            </button>
          </div>
          <div className="helper-text">The camera only starts after you explicitly choose to begin.</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card analysis-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Analysis modes</p>
              <h2>Choose an assistive mode</h2>
            </div>
            <div className="status-pill active">Ready</div>
          </div>
          <div className="mode-grid">
            {modes.map((mode) => (
              <button
                key={mode.key}
                className={`mode-card ${currentMode === mode.key ? 'selected' : ''}`}
                onClick={() => setCurrentMode(mode.key)}
              >
                <div>{mode.label}</div>
                <small>{mode.description}</small>
              </button>
            ))}
          </div>
          <div className="analysis-panel">
            {isProcessing ? <p className="processing">Processing the latest frame…</p> : renderResult()}
            {lastResult?.warnings?.length ? (
              <div className="warning-box">
                <AlertTriangle size={18} />
                <div>
                  {lastResult.warnings.map((warning, index) => (
                    <p key={`${warning.name}-${index}`}>{warning.message}</p>
                  ))}
                </div>
              </div>
            ) : null}
            {lastResult?.description && !lastResult.warnings?.length ? (
              <div className="info-box">
                <Sparkles size={18} /> This summary is derived from detected objects and any visible text.
              </div>
            ) : null}
          </div>
          <div className="control-row compact">
            <button className="secondary-btn" onClick={() => speakText(lastResult?.description || lastResult?.text || 'No result available', settings.speechRate, settings.speechEnabled)}>
              <Volume2 size={18} /> Read Aloud
            </button>
            <button className="secondary-btn" onClick={stopSpeech}>
              <PauseCircle size={18} /> Stop
            </button>
          </div>
        </motion.div>
      </section>

      <section className="grid three-up">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow">System status</p>
              <h3>Environment health</h3>
            </div>
            <Waves size={18} />
          </div>
          <ul className="status-list">
            <li>Camera access: {isCameraActive ? 'active' : 'ready to start'}</li>
            <li>Voice input: {typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) ? 'supported' : 'not supported'}</li>
            <li>Speech output: {settings.speechEnabled ? 'enabled' : 'disabled'}</li>
          </ul>
          <p className="helper-text">{statusMessage}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h3>Saved analysis history</h3>
            </div>
            <Eye size={18} />
          </div>
          <div className="search-row">
            <Search size={16} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search history" aria-label="Search history" />
          </div>
          <div className="history-list">
            {filteredHistory.length ? filteredHistory.slice(0, 5).map((entry) => (
              <div key={entry.id} className="history-item">
                <div>
                  <strong>{entry.analysis_type}</strong>
                  <p>{entry.result.description || entry.result.text || 'Analysis completed.'}</p>
                </div>
                <button className="icon-btn" onClick={() => onDeleteHistory(entry.id)} aria-label={`Delete ${entry.analysis_type} history`}>
                  <Clipboard size={16} />
                </button>
              </div>
            )) : <p className="helper-text">No matching history entries yet.</p>}
          </div>
          <button className="secondary-btn" onClick={onClearHistory}>Clear history</button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Privacy</p>
              <h3>Camera handling</h3>
            </div>
            <AlertTriangle size={18} />
          </div>
          <p className="helper-text">
            Images are processed temporarily and are not permanently stored unless you save a history entry. The app does not perform facial identification.
          </p>
        </motion.div>
      </section>
    </div>
  );
}

export default Dashboard;

import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Eye, Mic, Moon, Shield, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';

function Settings({ settings, updateSetting, onClearHistory }) {
  return (
    <div className="settings-shell">
      <Link to="/" className="secondary-btn back-link">
        <ArrowLeft size={16} /> Back to dashboard
      </Link>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Preferences</p>
            <h1>Accessibility and privacy settings</h1>
          </div>
          <Shield size={20} />
        </div>
        <div className="settings-grid">
          <label className="setting-item">
            <div>
              <strong>Speech enabled</strong>
              <p>Read aloud results and warnings.</p>
            </div>
            <input type="checkbox" checked={settings.speechEnabled} onChange={() => updateSetting('speechEnabled', !settings.speechEnabled)} />
          </label>

          <label className="setting-item">
            <div>
              <strong>Speech rate</strong>
              <p>Adjust the speaking speed.</p>
            </div>
            <input type="range" min="0.7" max="1.8" step="0.1" value={settings.speechRate} onChange={(event) => updateSetting('speechRate', Number(event.target.value))} />
          </label>

          <label className="setting-item">
            <div>
              <strong>High contrast mode</strong>
              <p>Increase contrast for easier viewing.</p>
            </div>
            <input type="checkbox" checked={settings.highContrast} onChange={() => updateSetting('highContrast', !settings.highContrast)} />
          </label>

          <label className="setting-item">
            <div>
              <strong>Large text mode</strong>
              <p>Use a more legible text size.</p>
            </div>
            <input type="checkbox" checked={settings.largeText} onChange={() => updateSetting('largeText', !settings.largeText)} />
          </label>

          <label className="setting-item">
            <div>
              <strong>Reduced motion</strong>
              <p>Reduce animation effects.</p>
            </div>
            <input type="checkbox" checked={settings.reducedMotion} onChange={() => updateSetting('reducedMotion', !settings.reducedMotion)} />
          </label>

          <label className="setting-item">
            <div>
              <strong>Camera settings</strong>
              <p>Use the live camera only when you choose to start it.</p>
            </div>
            <Camera size={18} />
          </label>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Privacy</p>
            <h2>Stored data and safety</h2>
          </div>
          <Moon size={20} />
        </div>
        <p className="helper-text">
          VisionAssist does not identify people or store images permanently. Analysis history can be deleted at any time.
        </p>
        <button className="secondary-btn" onClick={onClearHistory}>Clear history</button>
      </motion.div>
    </div>
  );
}

export default Settings;

import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

function Landing() {
  return (
    <div className="landing-shell">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="landing-card">
        <div className="landing-badge">VisionAssist</div>
        <h1>AI-powered accessibility for your camera.</h1>
        <p className="landing-description">
          Use your device camera to detect objects, read text, describe scenes, and get spoken guidance in real time.
        </p>
        <div className="landing-actions">
          <Link to="/login" className="primary-btn">
            Get started <ArrowRight size={18} />
          </Link>
          <a href="/" className="secondary-btn">
            Learn more
          </a>
        </div>
        <div className="landing-feature-list">
          <div>
            <Sparkles size={18} />
            <span>Instant scene descriptions</span>
          </div>
          <div>
            <Sparkles size={18} />
            <span>Live object detection</span>
          </div>
          <div>
            <Sparkles size={18} />
            <span>Text-to-speech assistance</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Landing;

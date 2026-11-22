import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const SAMPLES = {
  authentic: {
    label: 'Authentic User',
    icon: '👤',
    color: 'cyan',
    risk: 3.2,
    features: [
      { name: 'Account Age', value: '4.2 years', impact: '-0.12' },
      { name: 'Posting Cadence', value: 'Regular', impact: '-0.08' },
      { name: 'Follower Ratio', value: '0.84', impact: '-0.06' },
      { name: 'Bio Entropy', value: 'Natural', impact: '-0.04' },
      { name: 'Avatar Authenticity', value: 'Original', impact: '-0.03' },
    ],
  },
  bot: {
    label: 'Automated Bot',
    icon: '🤖',
    color: 'magenta',
    risk: 98.4,
    features: [
      { name: 'Posting Cadence', value: 'Every 12s', impact: '+0.34' },
      { name: 'Account Age', value: '3 days', impact: '+0.22' },
      { name: 'Username Entropy', value: 'user8392018', impact: '+0.18' },
      { name: 'Avatar Authenticity', value: 'Stock image', impact: '+0.12' },
      { name: 'Session Entropy', value: '0.02 (mechanical)', impact: '+0.09' },
    ],
  },
  troll: {
    label: 'Coordinated Troll',
    icon: '⚠️',
    color: 'violet',
    risk: 87.1,
    features: [
      { name: 'Graph Cluster', value: 'Sybil ring (14)', impact: '+0.28' },
      { name: 'Engagement Pattern', value: 'Coordinated', impact: '+0.24' },
      { name: 'Text Toxicity', value: 'Elevated', impact: '+0.16' },
      { name: 'Account Age', value: '2 months', impact: '+0.11' },
      { name: 'Follower Ratio', value: '0.02', impact: '+0.08' },
    ],
  },
};

export default function RiskSimulator() {
  const [selected, setSelected] = useState('bot');
  const [animatedRisk, setAnimatedRisk] = useState(0);
  const sample = SAMPLES[selected];

  useEffect(() => {
    let start = animatedRisk;
    const end = sample.risk;
    const duration = 800;
    const startTime = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedRisk(start + (end - start) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selected]);

  const colorMap = {
    cyan: { text: 'text-neon-cyan', bg: 'bg-neon-cyan', ring: 'ring-neon-cyan/40' },
    violet: { text: 'text-neon-violet', bg: 'bg-neon-violet', ring: 'ring-neon-violet/40' },
    magenta: { text: 'text-neon-magenta', bg: 'bg-neon-magenta', ring: 'ring-neon-magenta/40' },
  };
  const c = colorMap[sample.color];

  return (
    <div id="simulator" className="glass-card-glow p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="badge-neon">LIVE DEMO</span>
          <h3 className="mt-2 text-xl font-bold text-white md:text-2xl">
            Risk-Score Simulator
          </h3>
          <p className="mt-1 text-sm text-white/60">
            Test sample account profiles and view real-time probabilities
          </p>
        </div>
      </div>

      {/* Sample tabs */}
      <div className="mb-8 grid grid-cols-3 gap-2 rounded-full border border-white/10 bg-cosmos-800/60 p-1">
        {Object.entries(SAMPLES).map(([key, s]) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            className={`relative rounded-full px-3 py-2.5 text-xs font-semibold tracking-wide transition-colors md:text-sm ${
              selected === key ? 'text-cosmos-900' : 'text-white/60 hover:text-white'
            }`}
          >
            {selected === key && (
              <motion.span
                layoutId="sim-pill"
                className="absolute inset-0 rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet"
              />
            )}
            <span className="relative z-10">
              {s.icon} {s.label}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Risk meter */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-cosmos-900/50 p-8">
          <div className="relative flex h-48 w-48 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="12"
              />
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                stroke={sample.color === 'cyan' ? '#22d3ee' : sample.color === 'violet' ? '#a78bfa' : '#e879f9'}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 88}`}
                strokeDashoffset={2 * Math.PI * 88 * (1 - animatedRisk / 100)}
                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
              />
            </svg>
            <div className="text-center">
              <div className={`text-4xl font-black ${c.text}`}>
                {animatedRisk.toFixed(1)}%
              </div>
              <div className="mt-1 font-mono text-[10px] tracking-widest text-white/50">
                RISK SCORE
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="text-sm font-semibold text-white">{sample.label}</div>
            <div className="mt-1 text-xs text-white/50">
              {sample.risk > 80 ? '🚨 High Risk' : sample.risk > 40 ? '⚠️ Moderate' : '✅ Likely Authentic'}
            </div>
          </div>
        </div>

        {/* SHAP-like breakdown */}
        <div>
          <div className="mb-3 font-mono text-[10px] tracking-widest text-white/50">
            TOP CONTRIBUTING FEATURES (SHAP)
          </div>
          <div className="space-y-2">
            {sample.features.map((f, i) => {
              const positive = f.impact.startsWith('+');
              return (
                <motion.div
                  key={f.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-cosmos-800/40 px-3 py-2"
                >
                  <div className="flex-1">
                    <div className="text-xs font-medium text-white">{f.name}</div>
                    <div className="text-[10px] text-white/50">{f.value}</div>
                  </div>
                  <div
                    className={`font-mono text-xs font-bold ${
                      positive ? 'text-neon-magenta' : 'text-neon-cyan'
                    }`}
                  >
                    {f.impact}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import ConfidenceGauge from '../three/ConfidenceGauge.jsx';
import GlassCard from '../cards/GlassCard.jsx';

const PIPELINE_CARDS = [
  {
    badge: 'INGEST',
    badgeColor: 'cyan',
    title: 'Data Ingestion & Feature Engineering',
    desc: 'Extracting 40+ account, text, and network signals at scale.',
  },
  {
    badge: 'MODEL',
    badgeColor: 'violet',
    title: 'Model Ensemble & Scoring',
    desc: 'Gradient boosting + neural classifier delivering real-time risk probabilities.',
  },
  {
    badge: 'XAI',
    badgeColor: 'magenta',
    title: 'Explainable AI (SHAP) Flags',
    desc: 'Transparent feature-attribution breakdowns showing why an account was flagged.',
  },
  {
    badge: 'API',
    badgeColor: 'cyan',
    title: 'API & Real-Time Webhook',
    desc: 'Low-latency REST inference endpoint for automated moderation workflows.',
  },
];

export default function PipelineSection() {
  return (
    <section id="pipeline" className="relative min-h-screen px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <span className="badge-violet mb-4">ML PIPELINE</span>
          <h2 className="text-4xl font-black tracking-tight md:text-5xl">
            <span className="neon-text">Bailla Mach</span>{' '}
            <span className="text-white">ML Detection Engine</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            From ingestion to inference — a production-grade pipeline with
            explainable risk scoring.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* 3D Gauge */}
          <div className="glass-card relative h-[400px] overflow-hidden md:h-[500px]">
            <Canvas camera={{ position: [0, 0, 6], fov: 50 }} dpr={[1, 1.5]}>
              <Suspense fallback={null}>
                <ambientLight intensity={0.6} />
                <pointLight position={[5, 5, 5]} intensity={1.2} color="#e879f9" />
                <ConfidenceGauge value={98.4} />
              </Suspense>
            </Canvas>
            <div className="pointer-events-none absolute bottom-4 left-4">
              <span className="font-mono text-xs text-neon-magenta">
                LIVE CONFIDENCE READOUT
              </span>
            </div>
          </div>

          {/* Pipeline cards grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PIPELINE_CARDS.map((c, i) => (
              <GlassCard
                key={c.title}
                badge={c.badge}
                badgeColor={c.badgeColor}
                title={c.title}
                delay={i * 0.08}
              >
                {c.desc}
              </GlassCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

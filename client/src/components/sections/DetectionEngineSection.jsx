import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import NetworkGraph from '../three/NetworkGraph.jsx';
import GlassCard from '../cards/GlassCard.jsx';

const MODULES = [
  {
    badge: 'BEHAVIORAL',
    badgeColor: 'cyan',
    title: 'Behavioral & Temporal Analysis',
    desc: 'Posting cadence, session entropy, and automation timing patterns reveal machine-driven activity.',
  },
  {
    badge: 'METADATA',
    badgeColor: 'violet',
    title: 'Profile & Metadata Forensics',
    desc: 'Bio NLP embeddings, username entropy, avatar authenticity, and creation-date anomalies.',
  },
  {
    badge: 'GRAPH',
    badgeColor: 'magenta',
    title: 'Graph & Network Topology',
    desc: 'Follower-to-following ratios, Sybil cluster detection, and coordinated engagement rings.',
  },
];

export default function DetectionEngineSection() {
  return (
    <section
      id="architecture"
      className="relative min-h-screen px-4 py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <span className="badge-neon mb-4">DETECTION ENGINE</span>
          <h2 className="text-4xl font-black tracking-tight md:text-5xl">
            <span className="text-white">Inside the</span>{' '}
            <span className="neon-text">3D Social Graph</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            Authentic clusters vs. coordinated bot rings — visualized as
            node-and-edge topology with anomaly highlights.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* 3D Graph */}
          <div className="glass-card relative h-[400px] overflow-hidden md:h-[500px]">
            <Canvas camera={{ position: [0, 0, 10], fov: 50 }} dpr={[1, 1.5]}>
              <Suspense fallback={null}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1.2} color="#22d3ee" />
                <pointLight position={[-10, -5, 5]} intensity={0.8} color="#e879f9" />
                <NetworkGraph />
              </Suspense>
            </Canvas>
            <div className="pointer-events-none absolute bottom-4 left-4 flex gap-3">
              <span className="flex items-center gap-1.5 text-xs text-white/70">
                <span className="h-2 w-2 rounded-full bg-neon-cyan" /> Authentic
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/70">
                <span className="h-2 w-2 rounded-full bg-neon-magenta" /> Bot Ring
              </span>
            </div>
          </div>

          {/* Module cards */}
          <div className="flex flex-col gap-4">
            {MODULES.map((m, i) => (
              <GlassCard
                key={m.title}
                badge={m.badge}
                badgeColor={m.badgeColor}
                title={m.title}
                delay={i * 0.1}
              >
                {m.desc}
              </GlassCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

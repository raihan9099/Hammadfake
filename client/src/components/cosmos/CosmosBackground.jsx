import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import StarField from './StarField.jsx';
import ParticleClouds from './ParticleClouds.jsx';
import DataStreamRibbon from './DataStreamRibbon.jsx';

export default function CosmosBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 20], fov: 60 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #10183c 0%, #050817 70%)' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <pointLight position={[10, 10, 10]} intensity={1} color="#22d3ee" />
          <pointLight position={[-10, -10, 5]} intensity={0.6} color="#a78bfa" />
          <StarField />
          <ParticleClouds />
          <DataStreamRibbon />
        </Suspense>
      </Canvas>
      {/* Nebula gradients overlay */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-[600px] w-[600px] rounded-full bg-neon-cyan/10 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-neon-violet/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-neon-magenta/10 blur-[120px]" />
      </div>
    </div>
  );
}

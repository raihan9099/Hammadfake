import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Cloud({ color, count = 400, position, scale = 1 }) {
  const ref = useRef();

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 2) * 6 * scale;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, [count, scale]);

  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.elapsedTime;
      ref.current.rotation.y = t * 0.05;
      ref.current.material.opacity = 0.5 + Math.sin(t * 0.8) * 0.15;
    }
  });

  return (
    <points ref={ref} position={position}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.15 * scale}
        sizeAttenuation
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function ParticleClouds() {
  return (
    <group>
      <Cloud color="#22d3ee" position={[-18, 6, -20]} scale={1.2} />
      <Cloud color="#a78bfa" position={[18, -8, -25]} scale={1.5} />
      <Cloud color="#e879f9" position={[0, 12, -30]} scale={1} />
      <Cloud color="#22d3ee" position={[25, 10, -15]} scale={0.8} />
      <Cloud color="#a78bfa" position={[-25, -10, -22]} scale={1.1} />
    </group>
  );
}

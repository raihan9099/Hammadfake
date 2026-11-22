import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export default function ConfidenceGauge({ value = 98.4 }) {
  const ringRef = useRef();
  const groupRef = useRef();

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.5;
    }
  });

  const arc = (value / 100) * Math.PI * 1.5;
  const segments = 60;

  return (
    <group ref={groupRef}>
      {/* Outer ring (background) */}
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <torusGeometry args={[2.5, 0.08, 16, 100, Math.PI * 1.5]} />
        <meshStandardMaterial
          color="#10183c"
          emissive="#1e293b"
          emissiveIntensity={0.5}
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* Inner glow ring */}
      <mesh ref={ringRef} rotation={[0, 0, -Math.PI / 4]}>
        <torusGeometry args={[2.5, 0.03, 16, 100, Math.PI * 1.5]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Progress ticks */}
      {Array.from({ length: segments }).map((_, i) => {
        const angle = -Math.PI / 4 + (i / segments) * Math.PI * 1.5;
        const active = i / segments <= value / 100;
        const r = 2.1;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * r, Math.sin(angle) * r, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
          >
            <boxGeometry args={[0.04, active ? 0.3 : 0.15, 0.04]} />
            <meshBasicMaterial
              color={active ? (value > 90 ? '#e879f9' : '#22d3ee') : '#1e293b'}
              transparent
              opacity={active ? 1 : 0.4}
            />
          </mesh>
        );
      })}

      <Text
        position={[0, 0.2, 0]}
        fontSize={0.9}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff"
      >
        {value.toFixed(1)}%
      </Text>
      <Text
        position={[0, -0.6, 0]}
        fontSize={0.25}
        color="#e879f9"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.1}
      >
        BOT RISK
      </Text>
    </group>
  );
}

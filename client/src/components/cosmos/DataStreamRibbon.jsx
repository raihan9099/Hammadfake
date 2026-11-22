import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function DataStreamRibbon() {
  const ribbonRef = useRef();
  const dotsRef = useRef();

  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(-40, -10, -10),
      new THREE.Vector3(-20, 5, -5),
      new THREE.Vector3(0, 8, 0),
      new THREE.Vector3(20, 3, -8),
      new THREE.Vector3(40, -6, -15),
    ]);
  }, []);

  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 200, 0.08, 8, false);
  }, [curve]);

  const dotsPositions = useMemo(() => {
    const count = 60;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = curve.getPoint(i / count);
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
    }
    return pos;
  }, [curve]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ribbonRef.current) {
      ribbonRef.current.material.opacity = 0.4 + Math.sin(t * 1.5) * 0.15;
    }
    if (dotsRef.current) {
      dotsRef.current.rotation.z = t * 0.05;
    }
  });

  return (
    <group>
      <mesh ref={ribbonRef} geometry={tubeGeometry}>
        <meshBasicMaterial
          color="#a78bfa"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <points ref={dotsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dotsPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.2}
          sizeAttenuation
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

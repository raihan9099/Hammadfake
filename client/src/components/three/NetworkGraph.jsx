import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

function Node({ position, isBot = false, scale = 1 }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.15;
    }
  });

  return (
    <group ref={ref} position={position}>
      <mesh scale={scale}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color={isBot ? '#e879f9' : '#22d3ee'}
          emissive={isBot ? '#e879f9' : '#22d3ee'}
          emissiveIntensity={isBot ? 1.2 : 0.6}
          metalness={0.9}
          roughness={0.15}
        />
      </mesh>
      {/* Glow halo */}
      <mesh scale={scale * 1.8}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial
          color={isBot ? '#e879f9' : '#22d3ee'}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Edge({ start, end, isBot = false }) {
  const geometry = useMemo(() => {
    const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [start, end]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial
        color={isBot ? '#e879f9' : '#a78bfa'}
        transparent
        opacity={isBot ? 0.6 : 0.25}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </line>
  );
}

export default function NetworkGraph() {
  const groupRef = useRef();

  const { nodes, edges } = useMemo(() => {
    // Authentic cluster (center-left) + Bot ring (right)
    const authentic = [
      [-4, 0, 0],
      [-3, 1.5, 0.5],
      [-3, -1.2, -0.5],
      [-4.5, 0.8, -0.8],
      [-4.5, -0.8, 0.8],
    ];
    const bots = [
      [4, 0, 0],
      [3.5, 1.2, 0.4],
      [3.5, -1.2, -0.4],
      [4.5, 0.6, -0.6],
      [4.5, -0.6, 0.6],
      [3, 0, 0.8],
    ];

    const allNodes = [
      ...authentic.map((p) => ({ pos: p, isBot: false })),
      ...bots.map((p) => ({ pos: p, isBot: true })),
    ];

    const allEdges = [];
    // Authentic edges
    for (let i = 0; i < authentic.length; i++) {
      for (let j = i + 1; j < authentic.length; j++) {
        if (Math.random() > 0.3)
          allEdges.push({ s: authentic[i], e: authentic[j], isBot: false });
      }
    }
    // Bot edges (dense — coordinated ring)
    for (let i = 0; i < bots.length; i++) {
      for (let j = i + 1; j < bots.length; j++) {
        if (Math.random() > 0.1)
          allEdges.push({ s: bots[i], e: bots[j], isBot: true });
      }
    }
    // Cross edges (few — infiltration)
    allEdges.push({ s: authentic[0], e: bots[0], isBot: true });
    allEdges.push({ s: authentic[2], e: bots[2], isBot: true });

    return { nodes: allNodes, edges: allEdges };
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.6}>
      <group ref={groupRef}>
        {edges.map((e, i) => (
          <Edge key={i} start={e.s} end={e.e} isBot={e.isBot} />
        ))}
        {nodes.map((n, i) => (
          <Node
            key={i}
            position={n.pos}
            isBot={n.isBot}
            scale={n.isBot ? 0.9 : 1.1}
          />
        ))}
      </group>
    </Float>
  );
}

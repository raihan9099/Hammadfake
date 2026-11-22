import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CAMERA_KEYFRAMES = [
  { at: 0.0, pos: [0, 0, 20], look: [0, 0, 0] },       // Hero
  { at: 0.18, pos: [2, 2, 14], look: [0, 0, 0] },       // Problem
  { at: 0.4, pos: [0, 0, 8], look: [0, 0, 0] },         // Network graph
  { at: 0.62, pos: [-3, 1, 6], look: [0, 0, 0] },       // Pipeline
  { at: 0.85, pos: [0, 0, 10], look: [0, 0, 0] },       // Contact
  { at: 1.0, pos: [0, 0, 20], look: [0, 0, 0] },        // End
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export default function CameraRig({ scrollProgress }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0, 20));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    // Find surrounding keyframes
    let prev = CAMERA_KEYFRAMES[0];
    let next = CAMERA_KEYFRAMES[CAMERA_KEYFRAMES.length - 1];
    for (let i = 0; i < CAMERA_KEYFRAMES.length - 1; i++) {
      if (
        scrollProgress >= CAMERA_KEYFRAMES[i].at &&
        scrollProgress <= CAMERA_KEYFRAMES[i + 1].at
      ) {
        prev = CAMERA_KEYFRAMES[i];
        next = CAMERA_KEYFRAMES[i + 1];
        break;
      }
    }
    const t = Math.max(0, Math.min(1, (scrollProgress - prev.at) / (next.at - prev.at || 1)));
    targetPos.current.set(
      lerp(prev.pos[0], next.pos[0], t),
      lerp(prev.pos[1], next.pos[1], t),
      lerp(prev.pos[2], next.pos[2], t)
    );
    targetLook.current.set(
      lerp(prev.look[0], next.look[0], t),
      lerp(prev.look[1], next.look[1], t),
      lerp(prev.look[2], next.look[2], t)
    );
  }, [scrollProgress]);

  useFrame(() => {
    camera.position.lerp(targetPos.current, 0.08);
    const currentLook = new THREE.Vector3(0, 0, 0);
    camera.lookAt(targetLook.current);
  });

  return null;
}

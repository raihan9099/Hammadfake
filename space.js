(function () {
  if (typeof THREE === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '-1';
  canvas.style.pointerEvents = 'none';
  canvas.style.background = 'radial-gradient(ellipse at top, #0f1638 0%, #060818 60%)';
  document.body.insertBefore(canvas, document.body.firstChild);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.position.set(0, 0, 800);

  // 1. Stars
  const starGeo = new THREE.BufferGeometry();
  const starCount = 3000;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  const starSize = new Float32Array(starCount);
  const palette = [
    new THREE.Color(0x4AE3FF), new THREE.Color(0x9D6BFF),
    new THREE.Color(0xFF6BCB), new THREE.Color(0xFFFFFF), new THREE.Color(0x4A90FF)
  ];

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    starPos[i3] = (Math.random() - 0.5) * 2500;
    starPos[i3 + 1] = (Math.random() - 0.5) * 2500;
    starPos[i3 + 2] = (Math.random() - 0.5) * 2500;
    const c = palette[Math.floor(Math.random() * palette.length)];
    starCol[i3] = c.r; starCol[i3 + 1] = c.g; starCol[i3 + 2] = c.b;
    starSize[i] = Math.random() * 3 + 0.5;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(starSize, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float size; attribute vec3 color; varying vec3 vColor; uniform float uTime; uniform float uPixelRatio;
      void main() {
        vColor = color; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 0.7 + 0.3 * sin(uTime * 2.0 + position.x * 0.01);
        gl_PointSize = size * uPixelRatio * twinkle * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: `
      varying vec3 vColor; void main() {
        vec2 coord = gl_PointCoord - vec2(0.5); float dist = length(coord);
        if (dist > 0.5) discard; float alpha = smoothstep(0.5, 0.0, dist);
        gl_FragColor = vec4(vColor, alpha);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // 2. Dust
  const dustGeo = new THREE.BufferGeometry();
  const dustCount = 200;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const i3 = i * 3;
    dustPos[i3] = (Math.random() - 0.5) * 1800;
    dustPos[i3 + 1] = (Math.random() - 0.5) * 1800;
    dustPos[i3 + 2] = (Math.random() - 0.5) * 1800;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0x4AE3FF, size: 2, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // 3. Light Ribbon
  const ribbonPoints = [];
  for (let i = 0; i < 200; i++) {
    const t = i / 200;
    const angle = t * Math.PI * 2.5;
    const radius = 400 + Math.sin(t * Math.PI * 4) * 150;
    ribbonPoints.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle * 0.7) * 300 + t * 200, Math.sin(angle) * radius * 0.5));
  }
  const ribbonCurve = new THREE.CatmullRomCurve3(ribbonPoints);
  const ribbonGeo = new THREE.TubeGeometry(ribbonCurve, 400, 3, 8, false);
  const ribbonMat = new THREE.MeshBasicMaterial({ color: 0x9D6BFF, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  scene.add(ribbon);

  // Mouse & Scroll
  let targetX = 0, targetY = 0, scrollTarget = 0;
  document.addEventListener('mousemove', (e) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  });
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollTarget = max > 0 ? window.scrollY / max : 0;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    stars.rotation.y = time * 0.02 + targetX * 0.15 + scrollTarget * 0.5;
    stars.rotation.x = time * 0.01 + targetY * 0.15;
    dust.rotation.y = time * 0.04;
    ribbon.rotation.y = time * 0.05 + scrollTarget * 0.8;
    starMat.uniforms.uTime.value = time;

    // Camera scroll effect (EDL style)
    camera.position.x = targetX * 60;
    camera.position.y = -targetY * 60;
    camera.position.z = 800 - scrollTarget * 600;
    camera.rotation.z = scrollTarget * 0.3;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();
})();

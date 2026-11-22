// space.js — EDL-style futuristic 3D space (matches your file's aesthetic)
(function () {
  if (typeof THREE === 'undefined') {
    console.warn('Three.js not loaded');
    return;
  }

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

  /* ============ STARFIELD (3000 twinkling stars) ============ */
  const starGeo = new THREE.BufferGeometry();
  const starCount = 3000;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  const starSize = new Float32Array(starCount);

  const palette = [
    new THREE.Color(0x4AE3FF), // cyan
    new THREE.Color(0x9D6BFF), // violet
    new THREE.Color(0xFF6BCB), // magenta
    new THREE.Color(0xFFFFFF), // white
    new THREE.Color(0x4A90FF)  // blue
  ];

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    starPos[i3]     = (Math.random() - 0.5) * 2500;
    starPos[i3 + 1] = (Math.random() - 0.5) * 2500;
    starPos[i3 + 2] = (Math.random() - 0.5) * 2500;
    const c = palette[Math.floor(Math.random() * palette.length)];
    starCol[i3]     = c.r;
    starCol[i3 + 1] = c.g;
    starCol[i3 + 2] = c.b;
    starSize[i] = Math.random() * 3 + 0.5;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(starSize, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uTime;
      uniform float uPixelRatio;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 0.7 + 0.3 * sin(uTime * 2.0 + position.x * 0.01);
        gl_PointSize = size * uPixelRatio * twinkle * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, dist);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ============ PARTICLE DUST (200 glowing particles) ============ */
  const dustGeo = new THREE.BufferGeometry();
  const dustCount = 200;
  const dustPos = new Float32Array(dustCount * 3);
  const dustCol = new Float32Array(dustCount * 3);
  const dustSize = new Float32Array(dustCount);

  for (let i = 0; i < dustCount; i++) {
    const i3 = i * 3;
    dustPos[i3]     = (Math.random() - 0.5) * 1800;
    dustPos[i3 + 1] = (Math.random() - 0.5) * 1800;
    dustPos[i3 + 2] = (Math.random() - 0.5) * 1800;
    const c = palette[Math.floor(Math.random() * palette.length)];
    dustCol[i3]     = c.r;
    dustCol[i3 + 1] = c.g;
    dustCol[i3 + 2] = c.b;
    dustSize[i] = Math.random() * 18 + 6;
  }

  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
  dustGeo.setAttribute('size', new THREE.BufferAttribute(dustSize, 1));

  const dustMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uTime;
      uniform float uPixelRatio;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float pulse = 0.6 + 0.4 * sin(uTime + position.y * 0.01);
        gl_PointSize = size * uPixelRatio * pulse * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, dist);
        alpha = pow(alpha, 2.0);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  /* ============ SWEEPING LIGHT RIBBON (comet trail) ============ */
  const ribbonPoints = [];
  const ribbonSegments = 200;
  for (let i = 0; i < ribbonSegments; i++) {
    const t = i / ribbonSegments;
    const angle = t * Math.PI * 2.5;
    const radius = 400 + Math.sin(t * Math.PI * 4) * 150;
    ribbonPoints.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle * 0.7) * 300 + t * 200,
      Math.sin(angle) * radius * 0.5
    ));
  }

  const ribbonCurve = new THREE.CatmullRomCurve3(ribbonPoints);
  const ribbonGeo = new THREE.TubeGeometry(ribbonCurve, 400, 4, 8, false);
  const ribbonMat = new THREE.MeshBasicMaterial({
    color: 0x9D6BFF,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  scene.add(ribbon);

  const ribbonGlowGeo = new THREE.TubeGeometry(ribbonCurve, 400, 12, 8, false);
  const ribbonGlowMat = new THREE.MeshBasicMaterial({
    color: 0x4AE3FF,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const ribbonGlow = new THREE.Mesh(ribbonGlowGeo, ribbonGlowMat);
  scene.add(ribbonGlow);

  /* ============ NEBULA SPHERES (glowing dust clouds) ============ */
  const nebulaGroup = new THREE.Group();
  const nebulaColors = [0x4A90FF, 0x9D6BFF, 0xFF6BCB, 0x4AE3FF];

  for (let i = 0; i < 8; i++) {
    const size = Math.random() * 200 + 80;
    const geo = new THREE.SphereGeometry(size, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: nebulaColors[i % nebulaColors.length],
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.set(
      (Math.random() - 0.5) * 1400,
      (Math.random() - 0.5) * 1000,
      (Math.random() - 0.5) * 1000 - 300
    );
    sphere.userData = {
      baseX: sphere.position.x,
      baseY: sphere.position.y,
      speed: Math.random() * 0.2 + 0.1,
      offset: Math.random() * Math.PI * 2
    };
    nebulaGroup.add(sphere);
  }
  scene.add(nebulaGroup);

  /* ============ MOUSE PARALLAX ============ */
  let mouseX = 0, mouseY = 0;
  let targetX = 0, targetY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  /* ============ SCROLL CAMERA ============ */
  let scrollTarget = 0;
  let scrollCurrent = 0;

  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollTarget = max > 0 ? window.scrollY / max : 0;
  });

  /* ============ ANIMATION LOOP ============ */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // Smooth mouse + scroll interpolation
    targetX += (mouseX - targetX) * 0.05;
    targetY += (mouseY - targetY) * 0.05;
    scrollCurrent += (scrollTarget - scrollCurrent) * 0.05;

    // Stars rotate slowly + scroll
    stars.rotation.y = time * 0.02 + targetX * 0.15 + scrollCurrent * 0.5;
    stars.rotation.x = time * 0.01 + targetY * 0.15;

    // Dust rotates
    dust.rotation.y = time * 0.04 + scrollCurrent * 0.3;
    dust.rotation.x = time * 0.02;

    // Ribbon rotation
    ribbon.rotation.y = time * 0.05 + scrollCurrent * 0.8;
    ribbon.rotation.x = Math.sin(time * 0.1) * 0.2;
    ribbonGlow.rotation.copy(ribbon.rotation);

    // Nebula float
    nebulaGroup.children.forEach((sphere) => {
      const d = sphere.userData;
      sphere.position.x = d.baseX + Math.sin(time * d.speed + d.offset) * 50;
      sphere.position.y = d.baseY + Math.cos(time * d.speed + d.offset) * 40;
    });

    // Update shader time
    starMat.uniforms.uTime.value = time;
    dustMat.uniforms.uTime.value = time;

    // Camera: parallax + scroll depth
    camera.position.x = targetX * 60;
    camera.position.y = -targetY * 60;
    camera.position.z = 800 - scrollCurrent * 400;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  animate();

  /* ============ RESIZE ============ */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    starMat.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    dustMat.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  });
})();

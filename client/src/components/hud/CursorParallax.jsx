import { useEffect, useRef } from 'react';

export default function CursorParallax({ children, intensity = 20 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * intensity;
      const y = (e.clientY / window.innerHeight - 0.5) * intensity;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [intensity]);

  return (
    <div ref={ref} className="transition-transform duration-200 ease-out will-change-transform">
      {children}
    </div>
  );
}

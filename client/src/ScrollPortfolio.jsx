import { useEffect, useState } from 'react';
import CosmosBackground from './components/cosmos/CosmosBackground.jsx';
import Logo from './components/hud/Logo.jsx';
import ModeSwitcher from './components/hud/ModeSwitcher.jsx';
import ScrollCue from './components/hud/ScrollCue.jsx';
import HeroSection from './components/sections/HeroSection.jsx';
import ProblemSection from './components/sections/ProblemSection.jsx';
import DetectionEngineSection from './components/sections/DetectionEngineSection.jsx';
import PipelineSection from './components/sections/PipelineSection.jsx';
import ContactSection from './components/sections/ContactSection.jsx';

export default function ScrollPortfolio() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? window.scrollY / max : 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative">
      <CosmosBackground />
      <Logo />
      <ModeSwitcher />
      <ScrollCue
        label={scrollProgress > 0.85 ? 'SCROLL TO EXIT' : 'SCROLL DOWN'}
        visible={scrollProgress < 0.95}
      />

      <main className="relative z-10">
        <HeroSection />
        <ProblemSection />
        <DetectionEngineSection />
        <PipelineSection />
        <ContactSection />
      </main>
    </div>
  );
}

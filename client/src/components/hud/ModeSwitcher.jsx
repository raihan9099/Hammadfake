import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function ModeSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const isProject = location.pathname.startsWith('/project');

  return (
    <div className="fixed right-4 top-4 z-50 md:right-6 md:top-6">
      <div className="flex rounded-full border border-white/15 bg-cosmos-800/80 p-1 backdrop-blur-xl">
        <button
          onClick={() => navigate('/')}
          className={`relative rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-wider transition-colors md:px-4 md:text-xs ${
            !isProject ? 'text-cosmos-900' : 'text-white/60 hover:text-white'
          }`}
        >
          {!isProject && (
            <motion.span
              layoutId="mode-pill"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet"
            />
          )}
          <span className="relative z-10">ARCHITECTURE</span>
        </button>
        <button
          onClick={() => navigate('/project')}
          className={`relative rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-wider transition-colors md:px-4 md:text-xs ${
            isProject ? 'text-cosmos-900' : 'text-white/60 hover:text-white'
          }`}
        >
          {isProject && (
            <motion.span
              layoutId="mode-pill"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet"
            />
          )}
          <span className="relative z-10">LIVE DEMO</span>
        </button>
      </div>
    </div>
  );
}

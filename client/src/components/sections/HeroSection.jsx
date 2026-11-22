import { motion } from 'framer-motion';

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="relative mx-auto mb-8 flex h-32 w-32 items-center justify-center md:h-40 md:w-40"
        >
          <span className="absolute inset-0 animate-ping rounded-full border border-neon-cyan/40" />
          <span className="absolute inset-4 rounded-full border border-neon-violet/40" />
          <span className="absolute inset-8 rounded-full border border-neon-magenta/40" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-neon-cyan via-neon-violet to-neon-magenta text-3xl font-black tracking-tighter text-cosmos-900 shadow-glow md:h-28 md:w-28 md:text-4xl">
            BM
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          className="mx-auto max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl lg:text-7xl"
        >
          <span className="neon-text">Bailla Mach</span>
          <br />
          <span className="text-white">Fake Account Detection</span>
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.5 }}
          className="mx-auto mt-6 max-w-2xl text-base text-white/60 md:text-lg"
        >
          AI/ML-powered detection of bots, coordinated fake profiles, and
          impersonation networks using behavioral signals, graph topology, and
          explainable machine learning.
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.7 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a href="#architecture" className="btn-neon">
            Explore Architecture
          </a>
          <a href="/project" className="btn-ghost">
            View Case Study
          </a>
        </motion.div>
      </div>
    </section>
  );
}

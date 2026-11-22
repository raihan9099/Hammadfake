import { motion } from 'framer-motion';

export default function ScrollCue({ label = 'SCROLL DOWN', visible = true }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.5 }}
      className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2"
    >
      <div className="flex flex-col items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.3em] text-white/60">
          {label}
        </span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="h-8 w-px bg-gradient-to-b from-neon-cyan to-transparent"
        />
      </div>
    </motion.div>
  );
}

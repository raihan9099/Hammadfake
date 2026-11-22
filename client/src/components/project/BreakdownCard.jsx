import { motion } from 'framer-motion';

export default function BreakdownCard({ icon, title, desc, tag, color, delay = 0 }) {
  const colorMap = {
    cyan: 'border-neon-cyan/20 hover:border-neon-cyan/50 hover:shadow-glow',
    violet: 'border-neon-violet/20 hover:border-neon-violet/50 hover:shadow-glow-violet',
    magenta: 'border-neon-magenta/20 hover:border-neon-magenta/50 hover:shadow-glow-magenta',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay }}
      className={`glass-card group cursor-pointer p-6 transition-all duration-300 ${colorMap[color]}`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="text-3xl">{icon}</div>
        <span className={`badge-${color === 'cyan' ? 'neon' : color}`}>{tag}</span>
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{desc}</p>
      <button className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-neon-cyan transition-transform group-hover:translate-x-1">
        VIEW DETAILS →
      </button>
    </motion.div>
  );
}

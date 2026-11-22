import { motion } from 'framer-motion';
import CursorParallax from '../hud/CursorParallax.jsx';

export default function GlassCard({
  badge,
  badgeColor = 'cyan',
  title,
  subtitle,
  children,
  buttonLabel,
  onButtonClick,
  delay = 0,
  className = '',
}) {
  const badgeClass = {
    cyan: 'badge-neon',
    violet: 'badge-violet',
    magenta: 'badge-magenta',
  }[badgeColor];

  return (
    <CursorParallax intensity={8}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, delay, ease: 'easeOut' }}
        className={`glass-card-glow group p-6 transition-all duration-300 hover:shadow-glow ${className}`}
      >
        {badge && (
          <div className="mb-3">
            <span className={badgeClass}>{badge}</span>
          </div>
        )}
        {title && (
          <h3 className="text-lg font-bold tracking-tight text-white md:text-xl">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="mt-1 text-sm font-medium text-neon-cyan/80">{subtitle}</p>
        )}
        {children && (
          <div className="mt-4 text-sm leading-relaxed text-white/70">
            {children}
          </div>
        )}
        {buttonLabel && (
          <button
            onClick={onButtonClick}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-neon-cyan transition-colors hover:text-neon-violet"
          >
            {buttonLabel}
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
        )}
      </motion.div>
    </CursorParallax>
  );
}

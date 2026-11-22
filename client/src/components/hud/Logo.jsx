import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Logo({ compact = false }) {
  const { scrollY } = useScroll();
  const scale = useTransform(scrollY, [0, 300], [1, 0.6]);
  const y = useTransform(scrollY, [0, 300], [0, 8]);

  return (
    <motion.div
      style={{ scale, y }}
      className="fixed left-4 top-4 z-50 origin-top-left md:left-6 md:top-6"
    >
      <Link to="/" className="group flex items-center gap-3">
        <div className="relative flex h-11 w-11 items-center justify-center md:h-14 md:w-14">
          {/* Radar rings */}
          <span className="absolute inset-0 animate-ping rounded-full border border-neon-cyan/40" />
          <span className="absolute inset-0 rounded-full border border-neon-cyan/30" />
          <span className="absolute inset-1 rounded-full border border-neon-violet/30" />
          {/* Crosshair */}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="h-px w-3 bg-neon-cyan/70" />
            <span className="absolute h-3 w-px bg-neon-cyan/70" />
          </span>
          {/* Monogram */}
          <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet text-sm font-black tracking-tighter text-cosmos-900 md:h-11 md:w-11 md:text-base">
            BM
          </div>
        </div>
        {!compact && (
          <div className="hidden flex-col leading-tight md:flex">
            <span className="text-sm font-bold tracking-widest text-white">
              BAILLA MACH
            </span>
            <span className="font-mono text-[10px] tracking-wider text-neon-cyan/80">
              FAKE ACCOUNT DETECTION
            </span>
          </div>
        )}
      </Link>
    </motion.div>
  );
}

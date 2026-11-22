import { motion } from 'framer-motion';

export default function ProblemSection() {
  return (
    <section
      id="overview"
      className="relative flex min-h-screen items-center px-4 py-24"
    >
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2 md:items-center">
        <motion.div
          initial={{ x: -60, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.9 }}
        >
          <span className="badge-magenta mb-4">THE PROBLEM</span>
          <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl lg:text-6xl">
            <span className="neon-text">Exposing</span>
            <br />
            <span className="text-white">Synthetic Identities</span>
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
            Social platforms are flooded with bots, coordinated fake profiles,
            and impersonation networks that spread misinformation, inflate
            engagement, and defraud real users.
          </p>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/60">
            Bailla Mach detects these inauthentic actors by combining behavioral
            signals, linguistic forensics, graph topology, and explainable
            machine learning — giving trust & safety teams a transparent,
            high-precision risk score for every account.
          </p>
        </motion.div>

        <motion.div
          initial={{ x: 60, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="grid gap-4"
        >
          {[
            { label: 'Bots Detected', value: '1.2M+', color: 'text-neon-magenta' },
            { label: 'Precision @ 98% Recall', value: '96.8%', color: 'text-neon-cyan' },
            { label: 'Graph Nodes Analyzed', value: '40M+', color: 'text-neon-violet' },
          ].map((s) => (
            <div key={s.label} className="glass-card flex items-center justify-between p-5">
              <span className="text-sm text-white/60">{s.label}</span>
              <span className={`text-2xl font-black ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

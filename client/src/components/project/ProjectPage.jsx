import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Logo from '../hud/Logo.jsx';
import ModeSwitcher from '../hud/ModeSwitcher.jsx';
import RiskSimulator from './RiskSimulator.jsx';
import BreakdownCard from './BreakdownCard.jsx';
import ProjectFooter from './ProjectFooter.jsx';

const BREAKDOWNS = [
  {
    icon: '📊',
    title: 'Problem & Dataset',
    desc: 'Curated and labeled multi-platform account signals covering bot farms, spam rings, and organic users.',
    tag: 'DATASET',
    color: 'cyan',
  },
  {
    icon: '🧬',
    title: 'Feature Engineering',
    desc: '40+ engineered behavioral, linguistic, and network centrality features.',
    tag: 'FEATURES',
    color: 'violet',
  },
  {
    icon: '🧠',
    title: 'Model Architecture',
    desc: 'Benchmarked Logistic Regression, Random Forest, XGBoost, and Neural Networks for high precision-recall.',
    tag: 'MODEL',
    color: 'magenta',
  },
  {
    icon: '📈',
    title: 'Evaluation & Metrics',
    desc: 'ROC-AUC, F1-score, confusion matrix analysis, and false-positive minimization.',
    tag: 'METRICS',
    color: 'cyan',
  },
  {
    icon: '🔍',
    title: 'Explainability (SHAP)',
    desc: 'Per-account decision breakdowns for human-in-the-loop trust & safety teams.',
    tag: 'XAI',
    color: 'violet',
  },
  {
    icon: '🚀',
    title: 'Deployment & Stack',
    desc: 'Built with Python, Scikit-Learn/XGBoost, FastAPI, React, and Three.js.',
    tag: 'DEPLOY',
    color: 'magenta',
  },
];

export default function ProjectPage() {
  return (
    <div className="relative min-h-screen bg-cosmos-900">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-0 top-0 h-[500px] w-[500px] rounded-full bg-neon-cyan/5 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-neon-violet/5 blur-[120px]" />
      </div>

      <Logo compact />
      <ModeSwitcher />

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-28 md:pt-32">
        {/* Breadcrumb */}
        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 flex items-center gap-2 font-mono text-xs text-white/50"
        >
          <Link to="/" className="transition-colors hover:text-neon-cyan">
            Home
          </Link>
          <span>→</span>
          <span className="text-white/80">Bailla Mach</span>
        </motion.nav>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <h1 className="text-3xl font-black tracking-tight md:text-5xl lg:text-6xl">
            <span className="neon-text">BAILLA MACH:</span>{' '}
            <span className="text-white">FAKE ACCOUNT DETECTION</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base text-white/60 md:text-lg">
            End-to-end machine learning pipeline, graph analytics, and
            explainable risk scoring for identifying inauthentic accounts.
          </p>
        </motion.div>

        {/* Risk Simulator */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-12"
        >
          <RiskSimulator />
        </motion.div>

        {/* Breakdown Grid */}
        <div className="mt-16">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              Technical Breakdown
            </h2>
            <span className="font-mono text-xs text-white/40">
              6 MODULES
            </span>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {BREAKDOWNS.map((b, i) => (
              <BreakdownCard key={b.title} {...b} delay={i * 0.08} />
            ))}
          </div>
        </div>

        <ProjectFooter />
      </main>

      {/* Floating Try Demo button */}
      <a
        href="#simulator"
        className="btn-neon fixed bottom-6 right-6 z-50 shadow-glow"
      >
        ⚡ Try Live Demo
      </a>
    </div>
  );
}

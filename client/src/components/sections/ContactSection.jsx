import { motion } from 'framer-motion';

export default function ContactSection() {
  return (
    <section
      id="contact"
      className="relative flex min-h-screen items-center justify-center px-4 py-24"
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9 }}
        className="mx-auto max-w-3xl text-center"
      >
        <span className="badge-neon mb-6">CONTACT & HIRE ME</span>
        <h2 className="text-4xl font-black tracking-tight md:text-6xl">
          <span className="neon-text">Let's Connect</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-white/60">
          Building safer platforms with explainable AI and trust & safety
          engineering. Open to collaborations, research, and full-time roles.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a href="mailto:hello@baillamach.dev" className="btn-neon">
            ✉ Email Me
          </a>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            <i className="fab fa-github" /> GitHub
          </a>
          <a
            href="https://linkedin.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            <i className="fab fa-linkedin" /> LinkedIn
          </a>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Email', value: 'hello@baillamach.dev' },
            { label: 'Location', value: 'Remote / Global' },
            { label: 'Availability', value: 'Open to work' },
          ].map((c) => (
            <div key={c.label} className="glass-card p-5">
              <div className="text-[10px] font-mono tracking-widest text-neon-cyan/70">
                {c.label.toUpperCase()}
              </div>
              <div className="mt-1 text-sm text-white">{c.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <a href="/project" className="btn-ghost">
            View Full Case Study →
          </a>
        </div>
      </motion.div>
    </section>
  );
}

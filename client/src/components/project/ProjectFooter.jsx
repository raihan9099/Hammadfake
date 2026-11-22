export default function ProjectFooter() {
  return (
    <footer className="mt-24 border-t border-white/10 pt-12">
      <div className="grid gap-12 md:grid-cols-4">
        {/* Summary */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet text-xs font-black text-cosmos-900">
              BM
            </div>
            <div>
              <div className="text-sm font-bold text-white">Bailla Mach</div>
              <div className="font-mono text-[10px] text-neon-cyan/70">
                FAKE ACCOUNT DETECTION
              </div>
            </div>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/50">
            End-to-end AI/ML-powered detection of bots, coordinated fake
            profiles, and impersonation networks — with explainable risk scoring
            for trust & safety teams.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['Python', 'ML', 'XGBoost', 'FastAPI', 'React', 'Three.js'].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-white/70"
                >
                  {t}
                </span>
              )
            )}
          </div>
        </div>

        {/* ARCHITECTURE */}
        <div>
          <div className="font-mono text-[10px] tracking-widest text-neon-cyan/70">
            ARCHITECTURE
          </div>
          <ul className="mt-4 space-y-2 text-sm text-white/60">
            <li><a href="/#architecture" className="hover:text-white">Detection Engine</a></li>
            <li><a href="/#pipeline" className="hover:text-white">ML Pipeline</a></li>
            <li><a href="/#overview" className="hover:text-white">Problem Statement</a></li>
          </ul>
        </div>

        {/* DEMO & CODE */}
        <div>
          <div className="font-mono text-[10px] tracking-widest text-neon-cyan/70">
            DEMO & CODE
          </div>
          <ul className="mt-4 space-y-2 text-sm text-white/60">
            <li><a href="https://github.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white">GitHub Repo</a></li>
            <li><a href="#" className="hover:text-white">Live API Docs</a></li>
            <li><a href="#" className="hover:text-white">Dataset Notes</a></li>
          </ul>
        </div>

        {/* CONNECT */}
        <div>
          <div className="font-mono text-[10px] tracking-widest text-neon-cyan/70">
            CONNECT
          </div>
          <ul className="mt-4 space-y-2 text-sm text-white/60">
            <li><a href="#" className="hover:text-white">About Me</a></li>
            <li><a href="#" className="hover:text-white">Resume / CV</a></li>
            <li><a href="#" className="hover:text-white">Other Projects</a></li>
            <li><a href="#" className="hover:text-white">Contact Form</a></li>
          </ul>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-6 text-xs text-white/40">
        <span>© {new Date().getFullYear()} Bailla Mach. All rights reserved.</span>
        <div className="flex gap-4">
          <a href="mailto:hello@baillamach.dev" className="hover:text-neon-cyan">Email</a>
          <a href="https://github.com/" target="_blank" rel="noopener noreferrer" className="hover:text-neon-cyan">GitHub</a>
          <a href="https://linkedin.com/" target="_blank" rel="noopener noreferrer" className="hover:text-neon-cyan">LinkedIn</a>
        </div>
      </div>
    </footer>
  );
}

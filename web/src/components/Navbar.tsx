import { motion } from 'motion/react';
import { Menu } from 'lucide-react';
import { NAV_LINKS } from '../data';

export default function Navbar() {
  return (
    <div className="max-w-6xl mx-auto px-6 relative z-10">
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex items-center justify-between py-6"
        aria-label="Primary"
      >
        <a href="#top" aria-label="Atlas home" className="flex items-center gap-2.5 text-teal-ink">
          <img
            src={`${import.meta.env.BASE_URL}atlas-mark.png`}
            alt="Atlas"
            className="w-12 h-8 rounded-lg object-cover"
          />
          <span className="text-sm font-semibold tracking-[0.18em]">ATLAS</span>
        </a>
        <div className="hidden md:flex gap-8">
          {NAV_LINKS.map((link, i) => (
            <motion.a
              key={link}
              href={`#${link.toLowerCase()}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.5, ease: 'easeOut' }}
              className="text-teal-ink/70 text-sm font-medium hover:text-teal-ink transition-colors"
            >
              {link}
            </motion.a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-5">
          <a
            href={`${import.meta.env.BASE_URL}add`}
            className="text-teal-ink/70 text-sm font-medium hover:text-teal-ink transition-colors"
          >
            Add repo
          </a>
          <a
            href={`${import.meta.env.BASE_URL}#explore`}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-clay-deep text-sand font-medium text-sm px-5 py-3 transition-all hover:bg-clay active:scale-[0.98]"
          >
            <span>Browse repositories</span>
          </a>
        </div>
        <button
          type="button"
          aria-label="Open menu"
          className="md:hidden w-10 h-10 rounded-full border border-teal-ink/15 bg-white/40 flex items-center justify-center text-teal-ink"
        >
          <Menu className="w-5 h-5" />
        </button>
      </motion.nav>
    </div>
  );
}

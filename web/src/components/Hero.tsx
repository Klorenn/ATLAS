import { motion } from 'motion/react';
import { gradientStyle } from './primitives';
import LogoCloud from './LogoCloud';
import { ATLAS_STATS } from '../data';

export default function Hero() {
  return (
    <section className="pt-16 md:pt-28 pb-20 flex flex-col items-center relative z-10">
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="px-6 text-center text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[0.95] text-teal-ink max-w-4xl"
      >
        <span className="block">Powering the Stellar</span>
        <span className="block animate-shiny" style={gradientStyle}>
          builder ecosystem
        </span>
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mt-12 flex flex-col items-center gap-4 px-6"
      >
        <a
          href="#explore"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-clay-deep text-sand font-medium text-sm px-5 py-3 transition-all hover:bg-clay active:scale-[0.98]"
        >
          Explore the ecosystem
        </a>
        <span className="text-xs text-teal-deep/70 text-center">
          {ATLAS_STATS.repositories} repositories · {ATLAS_STATS.projects} projects ·{' '}
          {ATLAS_STATS.scfProjects} SCF-funded
        </span>
      </motion.div>

      <div className="mt-12 md:mt-16 w-full max-w-6xl">
        <LogoCloud />
      </div>
    </section>
  );
}

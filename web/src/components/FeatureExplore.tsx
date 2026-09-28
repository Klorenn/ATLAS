import { motion } from 'motion/react';
import { SectionEyebrow } from './primitives';

const CHIPS = ['Payments', 'DeFi', 'Wallets', 'Real-time index'];

const GROUPS = [
  {
    title: 'Payments',
    count: 303,
    items: ['Trustless Work, escrow contracts', 'Stellar MPP SDK, micropayments'],
  },
  {
    title: 'DeFi',
    count: 214,
    items: ['Blend, lending protocol', 'Soroswap, AMM core'],
  },
  {
    title: 'Wallets',
    count: 96,
    items: ['Freighter, SDF wallet', 'xBull, multichain wallet'],
  },
  {
    title: 'Tooling',
    count: 388,
    items: ['js-stellar-sdk · go-stellar-sdk · CLI'],
  },
];

export default function FeatureExplore() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-10 md:gap-16 items-start relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <SectionEyebrow label="Explore" tag="AI-native" tone="light" />
        <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02] text-teal-ink">
          Map the ecosystem
          <br />
          in a single pass.
        </h2>
        <p className="mt-6 text-teal-deep text-base leading-[1.6] max-w-md">
          Atlas reads every repository, understands what it was built for, and
          routes the noise away from the signal. Focus on what moves your build
          forward, and the rest organizes itself.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <span
              key={c}
              className="text-xs text-teal-deep px-3 py-1.5 rounded-full border border-teal-ink/15 bg-white/50"
            >
              {c}
            </span>
          ))}
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="liquid-glass rounded-2xl p-5"
      >
        <p className="text-xs text-teal-deep mb-4">Today · 6,864 repositories indexed</p>
        <div className="grid grid-cols-2 gap-3">
          {GROUPS.map((g) => (
            <div key={g.title} className="rounded-lg border border-teal-ink/10 bg-white/50 p-3">
              <p className="text-xs font-semibold text-teal-ink">
                {g.title} ({g.count})
              </p>
              <ul className="mt-2 space-y-1.5">
                {g.items.map((it) => (
                  <li key={it} className="text-[11px] text-teal-deep leading-snug">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Check } from 'lucide-react';

interface Program {
  tier: string;
  headline: string;
  desc: string;
  features: string[];
  cta: string;
  program: string | null;
  live: boolean;
}

// Everything on Atlas is free and open. No paid tiers, no sales CTAs.
const PROGRAMS: Program[] = [
  {
    tier: 'Stellar Community Fund',
    headline: '606 funded',
    desc: 'Grant rounds with on-record evidence in the catalog. Free and open to explore.',
    features: [
      '606 SCF-funded projects',
      'Round-by-round award history',
      'Funding totals in USD',
      'Evidence links per record',
      'Curated repository flags',
    ],
    cta: 'Explore SCF',
    program: 'scf',
    live: true,
  },
  {
    tier: 'Community',
    headline: 'Open index',
    desc: 'The full open map. Free and open to explore.',
    features: [
      '6,864 repositories indexed',
      'Category and language filters',
      'Weekly catalog refreshes',
      'Open data with source evidence',
      'Access via web',
    ],
    cta: 'Explore index',
    program: null,
    live: true,
  },
  {
    tier: 'Hackathons',
    headline: '1,441 builds',
    desc: '26 events · 79 winners across Chile, Brazil, Argentina, Mexico, India and beyond. Free and open to explore.',
    features: [
      'Chile · 187 builds',
      'Brazil · 88 builds',
      'Mexico · 88 builds',
      'Argentina · 48 builds',
      'Global · 965 builds',
    ],
    cta: 'Explore builds',
    program: 'hackathon',
    live: true,
  },
];

function goExplore(program: string | null) {
  const url = new URL(window.location.href);
  if (program) url.searchParams.set('program', program);
  else url.searchParams.delete('program');
  url.hash = 'explore';
  window.history.replaceState(null, '', url.toString());
  window.dispatchEvent(
    new CustomEvent('atlas:preset', {
      detail: program ? { program } : { program: 'all', q: '', category: 'all' },
    }),
  );
  document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Programs() {
  const [liveOnly, setLiveOnly] = useState(false);
  const visible = liveOnly ? PROGRAMS.filter((p) => p.live) : PROGRAMS;

  return (
    <section className="max-w-6xl mx-auto px-6 py-16 md:py-20 relative z-10" id="programs" aria-label="Programs">
      <p className="text-xs uppercase tracking-widest text-teal-deep">[ Programs ]</p>
      <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02] text-teal-ink">
        Where projects get their start.
      </h2>
      <p className="mt-4 text-teal-deep text-base max-w-xl">
        Funding programs, awards and community initiatives. Select a program to see its repositories.
      </p>

      <div className="mt-8 border-t border-teal-ink/15">
        {visible.map((p, i) => (
          <motion.article
            key={p.tier}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.06, duration: 0.5 }}
            className="group grid md:grid-cols-[1fr_auto] gap-4 md:gap-8 items-start py-7 border-b border-teal-ink/10"
          >
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-xl font-semibold text-teal-ink">{p.tier}</h3>
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest rounded border px-2 py-0.5 ${
                    p.live
                      ? 'border-teal-ink/20 text-teal-deep'
                      : 'border-clay-deep/40 text-clay-deep'
                  }`}
                >
                  {p.live ? 'Live data' : 'Sample'}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-teal-deep max-w-xl">{p.desc}</p>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-teal-deep">
                    <Check className="w-3.5 h-3.5 text-teal" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex md:flex-col items-start md:items-end gap-2">
              <p className="text-2xl font-semibold tracking-tight text-teal-ink tabular-nums">
                {p.headline}
              </p>
              {p.live ? (
                <button
                  type="button"
                  onClick={() => goExplore(p.program)}
                  className="inline-flex items-center gap-1 rounded-full bg-clay-deep text-sand text-xs font-semibold px-4 py-2.5 hover:bg-clay transition-colors"
                >
                  {p.cta}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1 rounded-full border border-teal-ink/15 text-xs font-medium px-4 py-2.5 text-teal-deep/60 cursor-default"
                >
                  {p.cta}
                </button>
              )}
            </div>
          </motion.article>
        ))}
      </div>

      <label className="mt-5 flex items-center gap-3 text-xs text-teal-deep cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={liveOnly}
          aria-label="Toggle live data only"
          onClick={() => setLiveOnly((v) => !v)}
          className={`w-11 h-6 rounded-full relative transition-colors ${
            liveOnly ? 'bg-clay-deep' : 'bg-teal-ink/20'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-sand shadow transition-transform ${
              liveOnly ? 'translate-x-5' : ''
            }`}
          />
        </button>
        Live data only
      </label>
    </section>
  );
}

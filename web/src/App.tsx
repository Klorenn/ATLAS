import { Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Explorer from './components/Explorer';
import FeatureExplore from './components/FeatureExplore';
import Programs from './components/Programs';
import Footer from './components/Footer';
import { RootNoiseFilter } from './components/primitives';
import { CTASection } from '@/components/ui/hero-dithering-card';

const BackdropDithering = lazy(() =>
  import('@paper-design/shaders-react').then((mod) => ({ default: mod.Dithering })),
);

// Cifras derivadas de public/data/catalog.json (2026-09-27), no escritas a mano.
const ECOSYSTEM = [
  { name: 'Payments', count: '547 repos' },
  { name: 'DeFi', count: '512 repos' },
  { name: 'Wallets', count: '198 repos' },
  { name: 'Infrastructure', count: '440 repos' },
  { name: 'Developer Tools', count: '916 repos' },
  { name: 'AI', count: '164 repos' },
  { name: 'Gaming', count: '25 repos' },
  { name: 'Education', count: '49 repos' },
  { name: 'Hackathon', count: '1,109 repos' },
  { name: 'Ideathon', count: '77 repos' },
  { name: 'Other', count: '3,250 repos' },
];

export default function App() {
  return (
    <div id="top" className="relative min-h-screen overflow-x-hidden bg-sand text-teal-ink">
      <RootNoiseFilter />

      {/* Global Sand + Clay dithering backdrop for the whole page */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <Suspense fallback={null}>
          <BackdropDithering
            colorBack="#00000000"
            colorFront="#C75A2A"
            shape="warp"
            type="4x4"
            speed={0.15}
            className="w-full h-full opacity-30"
            minPixelRatio={1}
          />
        </Suspense>
      </div>

      {/* Container guide lines */}
      <div className="hidden md:block pointer-events-none fixed inset-y-0 left-1/2 -translate-x-[calc(50%+36rem)] w-px bg-teal-ink/10 z-[5]" />
      <div className="hidden md:block pointer-events-none fixed inset-y-0 left-1/2 translate-x-[calc(-50%+36rem)] w-px bg-teal-ink/10 z-[5]" />

      <Navbar />
      <Hero />
      <main>
        <section id="explore" className="max-w-6xl mx-auto px-6 py-16 md:py-20 relative z-10" aria-labelledby="explore-title">
          <p className="text-xs uppercase tracking-widest text-teal-deep">[ Explore the ecosystem ]</p>
          <h2 id="explore-title" className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02] text-teal-ink">
            Explore the Stellar ecosystem.
          </h2>
          <p className="mt-4 text-teal-deep text-base max-w-xl">
            Search repositories, builders and projects across the ecosystem. Live data from the catalog.
          </p>
          <div className="mt-8 rounded-2xl border border-teal-ink/15 bg-teal-ink/[0.07] backdrop-blur-sm p-4 md:p-6 shadow-[0_16px_40px_-24px_rgba(31,53,54,0.5)]">
            <Explorer />
          </div>
        </section>
        <FeatureExplore />
        <Programs />
        <section id="ecosystem" className="max-w-6xl mx-auto px-6 py-16 md:py-20 relative z-10" aria-label="Ecosystem">
          <p className="text-xs uppercase tracking-widest text-teal-deep">A living map of Stellar</p>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ECOSYSTEM.map((c) => (
              <a
                key={c.name}
                href="#explore"
                className="liquid-glass rounded-xl p-4 hover:shadow-[0_12px_28px_-16px_rgba(31,53,54,0.4)] transition-shadow"
              >
                <p className="text-sm font-semibold text-teal-ink">{c.name}</p>
                <p className="mt-1 text-xs text-teal-deep">{c.count}</p>
              </a>
            ))}
          </div>
        </section>
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

import { Suspense, lazy } from 'react';
import { Github, Mail, MessageCircle, Twitter } from 'lucide-react';

const FooterDithering = lazy(() =>
  import('@paper-design/shaders-react').then((mod) => ({ default: mod.Dithering })),
);

const EXPLORE = [
  { label: 'Repositories', href: '#explore' },
  { label: 'Programs', href: '#programs' },
  { label: 'Ecosystem', href: '#ecosystem' },
];

const CONNECT = [
  { label: 'WhatsApp', href: 'https://chat.whatsapp.com/FsNIUPsmNCl2YJkQi5r4p4', Icon: MessageCircle },
  { label: 'X', href: 'https://x.com/TellusCoop', Icon: Twitter },
  { label: 'GitHub', href: 'https://github.com/Tellus-Cooperative/', Icon: Github },
  { label: 'hola@telluscoop.org', href: 'mailto:hola@telluscoop.org', Icon: Mail },
];

export default function Footer() {
  return (
    <footer className="relative z-10 mt-8">
      <div className="relative overflow-hidden bg-teal-ink text-sand rounded-t-[32px]">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <Suspense fallback={null}>
            <FooterDithering
              colorBack="#00000000"
              colorFront="#3F8487"
              shape="warp"
              type="4x4"
              speed={0.12}
              className="w-full h-full opacity-60"
              minPixelRatio={1}
            />
          </Suspense>
        </div>
        <div className="relative max-w-6xl mx-auto px-6 pt-14 pb-8">
          <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <img
                src={`${import.meta.env.BASE_URL}logos/tellus-white.svg`}
                alt="Tellus Cooperative"
                className="h-10 w-auto"
                loading="lazy"
              />
              <p className="mt-5 text-sm text-sand/70 leading-relaxed max-w-xs">
                A Latin American blockchain cooperative for education, incubation, and open knowledge.
              </p>
            </div>
            <nav aria-label="Atlas">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-sand/50">Atlas</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {EXPLORE.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sand/75 hover:text-sand hover:underline underline-offset-4">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Connect">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-sand/50">Connect</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {CONNECT.map(({ label, href, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target={href.startsWith('mailto') ? undefined : '_blank'}
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sand/75 hover:text-sand hover:underline underline-offset-4"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="mt-12 pt-6 border-t border-sand/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-sand/50">
            <span>© 2026 Tellus Cooperative Foundation · New York, NY</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

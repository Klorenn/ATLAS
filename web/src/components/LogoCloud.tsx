import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface Logo {
  name: string;
  src?: string;
  /** White artwork recolored to ink via CSS for the Sand background. */
  darken?: boolean;
}

// Marks live in public/logos, downloaded from official sources:
// telluscoop.org/brand (Tellus), project GitHub repos (Blend),
// freighter.app, lobstr.co, stellar.org and cryptocurrency-icons.
// `darken` recolors white artwork to Teal Ink with brightness(0).
const LOGOS: Logo[] = [
  { name: 'Tellus Cooperative', src: 'logos/tellus.svg', darken: true },
  { name: 'Stellar', src: 'logos/stellar.svg', darken: true },
  { name: 'Freighter', src: 'logos/freighter.svg', darken: true },
  { name: 'LOBSTR', src: 'logos/lobstr.svg' },
  { name: 'Blend', src: 'logos/blend.svg' },
];

function LogoItem({ logo }: { logo: Logo }) {
  const [failed, setFailed] = useState(false);
  return (
    // Altura fija para todos los marks: el ancho sigue la relación de aspecto,
    // así un lockup 4.75:1 y un icono 1:1 comparten la misma altura visual.
    <span className="flex items-center justify-center h-12 px-7 shrink-0">
      {logo.src && !failed ? (
        <img
          src={`${import.meta.env.BASE_URL}${logo.src}`}
          alt={logo.name}
          title={logo.name}
          loading="lazy"
          className="h-8 w-auto max-w-[190px] object-contain opacity-85 hover:opacity-100 transition-opacity"
          style={logo.darken ? { filter: 'brightness(0)' } : undefined}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          title={logo.name}
          className="text-sm font-semibold tracking-tight text-teal-ink/70 hover:text-teal-ink transition-colors"
        >
          {logo.name}
        </span>
      )}
    </span>
  );
}

/**
 * Marquee de logos. Sin encabezado ni contenedor de sección: el hero lo
 * monta entre el titular y las cifras. Con `prefers-reduced-motion` el
 * carrusel se detiene y la fila queda legible de una sola vez.
 */
export default function LogoCloud() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.45, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="marquee-pause relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
    >
      <div
        className={`flex w-max items-center gap-10 pr-10 ${
          reduceMotion ? 'justify-center flex-wrap' : 'animate-logo-marquee'
        }`}
      >
        {LOGOS.map((logo) => (
          <LogoItem key={logo.name} logo={logo} />
        ))}
        {/* La copia duplicada solo existe para el bucle infinito del marquee. */}
        {!reduceMotion &&
          LOGOS.map((logo) => (
            <span key={`dup-${logo.name}`} aria-hidden="true" className="contents">
              <LogoItem logo={logo} />
            </span>
          ))}
      </div>
    </motion.div>
  );
}

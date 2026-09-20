import { preload } from "react-dom";
import { HeroEffectsLoader } from "@/components/site/hero-effects-loader";

const HERO_SM = "/hero/night-highway-sm.webp";
const HERO_LG = "/hero/night-highway.webp";

/** Light streaks: each is a road lane sweeping toward the vanishing point, lit in turn. */
const STREAKS = [
  { d: "M -120 900 C 380 700 760 560 1180 500 S 1560 470 1720 462", color: "#ffd27a", width: 3.2, dur: 5.2, delay: 0.2 },
  { d: "M -80 860 C 420 690 800 560 1200 512 S 1580 486 1720 480", color: "#ffffff", width: 1.6, dur: 4.4, delay: 1.1 },
  { d: "M 40 940 C 520 760 860 590 1240 528 S 1600 500 1720 496", color: "#ff5a4d", width: 2.6, dur: 6.1, delay: 0.7 },
  { d: "M 260 960 C 640 800 940 620 1290 548 S 1620 516 1720 510", color: "#ff8a5c", width: 2, dur: 5.6, delay: 2.0 },
  { d: "M -200 800 C 260 650 700 540 1150 490 S 1540 460 1720 452", color: "#fff1c9", width: 1.2, dur: 3.9, delay: 1.7 },
] as const;

/**
 * The hero's night-drive scene, rendered on the server with no JavaScript: sky, the highway photograph (the page's
 * largest paint, so it is preloaded), a warm headlight glow, animated light streaks and a vignette. Streaks and glow
 * are CSS animations, so phones get a living scene at almost no cost. On capable desktops `HeroEffectsLoader`
 * adds pointer parallax, scroll separation and drifting dust after the first paint.
 */
export function HeroScene() {
  // Start fetching the right size before the browser reaches the tag.
  preload(HERO_LG, { as: "image", imageSrcSet: `${HERO_SM} 900w, ${HERO_LG} 1920w`, imageSizes: "100vw", fetchPriority: "high" });
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div data-hero-root className="absolute inset-0 [perspective:1400px] [transform-style:preserve-3d]">
        <div
          data-layer="sky"
          className="absolute -inset-[6%]"
          style={{
            background:
              "radial-gradient(120% 70% at 78% 62%, oklch(0.32 0.06 60 / 0.55), transparent 60%), linear-gradient(to bottom, oklch(0.12 0.02 255), oklch(0.17 0.03 250) 70%, oklch(0.2 0.03 60))",
          }}
        />

        <div data-layer="photo" className="absolute -inset-[7%]">
          {/* A plain img on purpose: the two sizes are already optimised files in /public, so there is no image
              server round trip on the page's most important paint. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/night-highway.webp"
            srcSet={`${HERO_SM} 900w, ${HERO_LG} 1920w`}
            sizes="100vw"
            alt=""
            width={1920}
            height={1080}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        </div>

        <div data-layer="glow" className="pointer-events-none absolute -inset-[8%]">
          <div className="hero-breathe absolute -bottom-[10%] start-[8%] h-[70%] w-[60%] rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(closest-side, oklch(0.78 0.15 80 / 0.55), transparent)" }} />
          <div className="hero-breathe absolute end-[4%] top-[28%] h-[45%] w-[38%] rounded-full opacity-50 blur-3xl [animation-delay:-4s]" style={{ background: "radial-gradient(closest-side, oklch(0.62 0.2 25 / 0.5), transparent)" }} />
        </div>

        <svg data-layer="streaks" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute -inset-[6%] h-[112%] w-[112%] mix-blend-screen">
          {STREAKS.map((s, i) => (
            <g key={i}>
              <path d={s.d} fill="none" stroke={s.color} strokeWidth={s.width * 5} strokeLinecap="round" opacity="0.12" />
              <path
                className="hero-streak"
                d={s.d}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinecap="round"
                pathLength={2400}
                strokeDasharray="220 2180"
                style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
              />
            </g>
          ))}
        </svg>

        <div data-layer="bloom" className="pointer-events-none absolute start-[34%] top-[26%] hidden size-[34rem] rounded-full opacity-40 mix-blend-screen blur-2xl lg:block" style={{ background: "radial-gradient(closest-side, oklch(0.82 0.14 80 / 0.5), transparent)" }} />

        <div data-layer="dust" className="pointer-events-none absolute -inset-[8%]" />

        <div data-layer="vignette" className="pointer-events-none absolute -inset-[8%]">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/5" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/45 to-transparent" />
          <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 220px 40px oklch(0.1 0.02 255 / 0.85)" }} />
        </div>
      </div>
      <HeroEffectsLoader />
    </div>
  );
}

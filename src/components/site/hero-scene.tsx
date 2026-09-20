"use client";

import { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** How far each layer travels with the pointer, as a share of the hero's width. Far layers barely move; near ones move most. */
const DEPTH = { sky: 0.006, photo: 0.014, glow: 0.024, streaks: 0.035, dust: 0.05, vignette: 0.02 } as const;

/** Light streaks: each is a road lane sweeping toward the vanishing point, lit in turn. */
const STREAKS = [
  { d: "M -120 900 C 380 700 760 560 1180 500 S 1560 470 1720 462", color: "#ffd27a", width: 3.2, dur: 5.2, delay: 0.2 },
  { d: "M -80 860 C 420 690 800 560 1200 512 S 1580 486 1720 480", color: "#ffffff", width: 1.6, dur: 4.4, delay: 1.1 },
  { d: "M 40 940 C 520 760 860 590 1240 528 S 1600 500 1720 496", color: "#ff5a4d", width: 2.6, dur: 6.1, delay: 0.7 },
  { d: "M 260 960 C 640 800 940 620 1290 548 S 1620 516 1720 510", color: "#ff8a5c", width: 2, dur: 5.6, delay: 2.0 },
  { d: "M -200 800 C 260 650 700 540 1150 490 S 1540 460 1720 452", color: "#fff1c9", width: 1.2, dur: 3.9, delay: 1.7 },
] as const;

/**
 * The hero's 2.5D night-drive scene. Six flat layers sit at different depths inside one perspective box: sky,
 * the highway photograph, a warm headlight glow, animated light streaks, drifting dust and a near vignette.
 * They shift by different amounts as the pointer moves (or on a slow, calm drift on touch screens and when the
 * pointer is idle), and separate again as the page scrolls, which is what makes the flat image read as depth.
 *
 * With reduced motion the scene is a still composition. Everything animated is transform or opacity only.
 */
export function HeroScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const canvas = canvasRef.current;
      if (!root) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const layer = (name: string) => root.querySelector<HTMLElement>(`[data-layer="${name}"]`);
        const names = Object.keys(DEPTH) as (keyof typeof DEPTH)[];
        const setters = new Map<string, { x: (v: number) => void; y: (v: number) => void }>();
        for (const name of names) {
          const el = layer(name);
          if (!el) continue;
          setters.set(name, {
            x: gsap.quickTo(el, "x", { duration: 1.4, ease: "power3.out" }),
            y: gsap.quickTo(el, "y", { duration: 1.4, ease: "power3.out" }),
          });
        }
        const tilt = {
          rx: gsap.quickTo(root, "rotationX", { duration: 1.6, ease: "power3.out" }),
          ry: gsap.quickTo(root, "rotationY", { duration: 1.6, ease: "power3.out" }),
        };
        const bloom = layer("bloom");
        const bloomX = bloom ? gsap.quickTo(bloom, "x", { duration: 2.2, ease: "power3.out" }) : null;
        const bloomY = bloom ? gsap.quickTo(bloom, "y", { duration: 2.2, ease: "power3.out" }) : null;

        gsap.set(root, { transformPerspective: 1400, transformOrigin: "50% 60%" });

        // Entrance: the scene settles from slightly zoomed and dark, layer by layer, and the streaks ignite.
        gsap.from(root.querySelectorAll("[data-layer]"), { opacity: 0, scale: 1.08, duration: 1.8, ease: "expo.out", stagger: 0.12 });
        gsap.from(root.querySelectorAll("[data-streak]"), { opacity: 0, duration: 2.4, ease: "expo.out", stagger: 0.18, delay: 0.5 });
        gsap.to(layer("photo"), { scale: 1.07, duration: 26, delay: 1.8, ease: "none" });

        // Pointer position in -1..1. On touch, or when the pointer has been idle, a slow drift takes over.
        let pointerX = 0;
        let pointerY = 0;
        let lastMove = 0;
        const width = () => root.clientWidth || window.innerWidth;
        const onMove = (e: PointerEvent) => {
          if (e.pointerType === "touch") return;
          pointerX = (e.clientX / window.innerWidth) * 2 - 1;
          pointerY = (e.clientY / window.innerHeight) * 2 - 1;
          lastMove = performance.now();
        };
        window.addEventListener("pointermove", onMove, { passive: true });

        // GSAP's ticker passes the time in seconds.
        const tick = (time: number) => {
          const idle = performance.now() - lastMove > 2500;
          const t = time;
          const nx = idle ? Math.sin(t * 0.22) * 0.6 : pointerX;
          const ny = idle ? Math.cos(t * 0.17) * 0.35 : pointerY;
          for (const name of names) {
            const s = setters.get(name);
            if (!s) continue;
            s.x(-nx * DEPTH[name] * width());
            s.y(-ny * DEPTH[name] * width() * 0.6);
          }
          tilt.ry(nx * 1.6);
          tilt.rx(-ny * 1.1);
          bloomX?.(nx * width() * 0.05);
          bloomY?.(ny * width() * 0.03);
        };
        gsap.ticker.add(tick);

        // Scroll: layers separate at different rates while the hero leaves, and the whole scene dims a little.
        const scroll = gsap.timeline({
          scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 0.8 },
        });
        scroll.to(layer("sky"), { yPercent: 4, ease: "none" }, 0);
        scroll.to(layer("photo"), { yPercent: 12, ease: "none" }, 0);
        scroll.to(layer("glow"), { yPercent: 18, ease: "none" }, 0);
        scroll.to(layer("streaks"), { yPercent: 26, ease: "none" }, 0);
        scroll.to(layer("dust"), { yPercent: 38, ease: "none" }, 0);
        scroll.to(layer("vignette"), { yPercent: -8, opacity: 1, ease: "none" }, 0);

        // Dust: a few dozen motes drifting upward on a canvas, paused when the hero is off screen.
        let stopDust = () => {};
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const motes = Array.from({ length: 48 }, () => ({
              x: Math.random(),
              y: Math.random(),
              r: 0.6 + Math.random() * 1.9,
              speed: 0.008 + Math.random() * 0.03,
              sway: Math.random() * Math.PI * 2,
              warm: Math.random() > 0.55,
            }));
            const resize = () => {
              canvas.width = canvas.clientWidth * dpr;
              canvas.height = canvas.clientHeight * dpr;
            };
            resize();
            let visible = true;
            const draw = (time: number, delta: number) => {
              if (!visible) return;
              const w = canvas.width;
              const h = canvas.height;
              ctx.clearRect(0, 0, w, h);
              for (const m of motes) {
                m.y -= (m.speed * delta) / 1000;
                m.sway += delta / 2600;
                if (m.y < -0.02) {
                  m.y = 1.02;
                  m.x = Math.random();
                }
                const px = (m.x + Math.sin(m.sway) * 0.012) * w;
                const py = m.y * h;
                const twinkle = 0.35 + 0.35 * Math.sin(time / 900 + m.sway * 3);
                ctx.beginPath();
                ctx.arc(px, py, m.r * dpr, 0, Math.PI * 2);
                ctx.fillStyle = m.warm ? `rgba(255, 205, 120, ${twinkle})` : `rgba(255, 255, 255, ${twinkle * 0.7})`;
                ctx.fill();
              }
            };
            const loop = (time: number, delta: number) => {
              draw(time * 1000, Math.min(64, delta));
            };
            gsap.ticker.add(loop);
            const io = new IntersectionObserver(([entry]) => {
              visible = Boolean(entry?.isIntersecting);
            });
            io.observe(root);
            window.addEventListener("resize", resize);
            stopDust = () => {
              gsap.ticker.remove(loop);
              io.disconnect();
              window.removeEventListener("resize", resize);
            };
          }
        }

        return () => {
          window.removeEventListener("pointermove", onMove);
          gsap.ticker.remove(tick);
          stopDust();
        };
      });
      return () => mm.revert();
    },
    { scope: rootRef }
  );

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div ref={rootRef} className="absolute inset-0 [perspective:1400px] [transform-style:preserve-3d]">
        {/* 0. Sky: deep asphalt blue fading to a faint warm horizon. */}
        <div
          data-layer="sky"
          className="absolute -inset-[6%] will-change-transform"
          style={{
            background:
              "radial-gradient(120% 70% at 78% 62%, oklch(0.32 0.06 60 / 0.55), transparent 60%), linear-gradient(to bottom, oklch(0.12 0.02 255), oklch(0.17 0.03 250) 70%, oklch(0.2 0.03 60))",
          }}
        />

        {/* 1. The highway photograph. */}
        <div data-layer="photo" className="absolute -inset-[7%] will-change-transform">
          <Image
            src="https://images.unsplash.com/photo-1633121945200-05b2a267caee?auto=format&fit=crop&w=2400&q=80"
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        </div>

        {/* 2. Headlight glow: warm pools of light that breathe slowly. */}
        <div data-layer="glow" className="pointer-events-none absolute -inset-[8%] will-change-transform">
          <div className="hero-breathe absolute -bottom-[10%] start-[8%] h-[70%] w-[60%] rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(closest-side, oklch(0.78 0.15 80 / 0.55), transparent)" }} />
          <div className="hero-breathe absolute end-[4%] top-[28%] h-[45%] w-[38%] rounded-full opacity-50 blur-3xl [animation-delay:-4s]" style={{ background: "radial-gradient(closest-side, oklch(0.62 0.2 25 / 0.5), transparent)" }} />
        </div>

        {/* 3. Light streaks sweeping toward the vanishing point. */}
        <svg data-layer="streaks" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute -inset-[6%] h-[112%] w-[112%] mix-blend-screen will-change-transform">
          {STREAKS.map((s, i) => (
            <g key={i}>
              <path d={s.d} fill="none" stroke={s.color} strokeWidth={s.width * 5} strokeLinecap="round" opacity="0.12" />
              <path
                data-streak
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

        {/* Bloom that trails the pointer, like light catching a lens. */}
        <div data-layer="bloom" className="pointer-events-none absolute start-[34%] top-[26%] size-[34rem] rounded-full opacity-40 mix-blend-screen blur-2xl" style={{ background: "radial-gradient(closest-side, oklch(0.82 0.14 80 / 0.5), transparent)" }} />

        {/* 4. Dust drifting through the light. */}
        <div data-layer="dust" className="absolute -inset-[8%] will-change-transform">
          <canvas ref={canvasRef} className="size-full" />
        </div>

        {/* 5. Near layer: heavy vignette so the scene feels enclosed, with the text side kept readable. */}
        <div data-layer="vignette" className="pointer-events-none absolute -inset-[8%] will-change-transform">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/5" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/45 to-transparent" />
          <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 220px 40px oklch(0.1 0.02 255 / 0.85)" }} />
        </div>
      </div>
    </div>
  );
}

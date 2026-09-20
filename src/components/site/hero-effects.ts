import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** How far each layer travels with the pointer, as a share of the hero's width. Far layers barely move. */
const DEPTH: Record<string, number> = { photo: 0.012, glow: 0.02, streaks: 0.03, dust: 0.045 };
/** How far each layer drifts as the hero scrolls away, in percent of its own height. */
const SCROLL_SHIFT: Record<string, number> = { photo: 10, glow: 16, streaks: 22 };

/**
 * The hero's depth effects, loaded only on devices that can afford them (a fine pointer, no reduced-motion request,
 * a wide screen) and only after the first paint. The still scene is already on the page from the server.
 *
 * Kept deliberately light so it never costs frames: parallax is event-driven (no per-frame loop), it moves a few
 * whole layers with transforms only, the response is quick (half a second, no long floaty lag), and the dust is a
 * small canvas redrawn at 30 frames a second. Returns a function that removes everything it added.
 */
export function startHeroEffects(root: HTMLElement): () => void {
  const layer = (name: string) => root.querySelector<HTMLElement>(`[data-layer="${name}"]`);
  const cleanups: (() => void)[] = [];

  const ctx = gsap.context(() => {
    const setters = new Map<string, { x: (v: number) => void; y: (v: number) => void }>();
    for (const name of Object.keys(DEPTH)) {
      const el = layer(name);
      if (!el) continue;
      setters.set(name, {
        x: gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" }),
        y: gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" }),
      });
    }
    const bloom = layer("bloom");
    const bloomX = bloom ? gsap.quickTo(bloom, "x", { duration: 0.9, ease: "power3.out" }) : null;
    const bloomY = bloom ? gsap.quickTo(bloom, "y", { duration: 0.9, ease: "power3.out" }) : null;

    // Pointer movement, coalesced to one update per frame.
    let frame = 0;
    let nx = 0;
    let ny = 0;
    const apply = () => {
      frame = 0;
      const width = root.clientWidth || window.innerWidth;
      for (const [name, s] of setters) {
        const depth = DEPTH[name] ?? 0;
        s.x(-nx * depth * width);
        s.y(-ny * depth * width * 0.6);
      }
      bloomX?.(nx * width * 0.04);
      bloomY?.(ny * width * 0.025);
    };
    const onMove = (e: PointerEvent) => {
      nx = (e.clientX / window.innerWidth) * 2 - 1;
      ny = (e.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    cleanups.push(() => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    });

    // Scroll: a few layers drift at different rates while the hero leaves. Tied straight to the scroll position (no
    // smoothing), so it never trails behind the finger or wheel.
    const scroll = gsap.timeline({ scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: true } });
    for (const [name, shift] of Object.entries(SCROLL_SHIFT)) {
      const el = layer(name);
      if (el) scroll.to(el, { yPercent: shift, ease: "none" }, 0);
    }

    // Dust: a couple of dozen motes on a small canvas, 30 frames a second, paused while the hero is off screen.
    const dust = layer("dust");
    if (dust) {
      const canvas = document.createElement("canvas");
      canvas.className = "size-full";
      dust.appendChild(canvas);
      cleanups.push(() => canvas.remove());
      const c2d = canvas.getContext("2d");
      if (c2d) {
        const motes = Array.from({ length: 24 }, () => ({
          x: Math.random(),
          y: Math.random(),
          r: 0.7 + Math.random() * 1.5,
          speed: 0.008 + Math.random() * 0.025,
          sway: Math.random() * Math.PI * 2,
          warm: Math.random() > 0.55,
        }));
        const resize = () => {
          canvas.width = Math.round(canvas.clientWidth / 2);
          canvas.height = Math.round(canvas.clientHeight / 2);
        };
        resize();
        window.addEventListener("resize", resize);
        cleanups.push(() => window.removeEventListener("resize", resize));
        let visible = true;
        const io = new IntersectionObserver(([entry]) => {
          visible = Boolean(entry?.isIntersecting) && !document.hidden;
        });
        io.observe(root);
        cleanups.push(() => io.disconnect());
        let sinceDraw = 0;
        const loop = (time: number, delta: number) => {
          sinceDraw += delta;
          if (!visible || sinceDraw < 33) return;
          const step = Math.min(100, sinceDraw) / 1000;
          sinceDraw = 0;
          const w = canvas.width;
          const h = canvas.height;
          c2d.clearRect(0, 0, w, h);
          for (const m of motes) {
            m.y -= m.speed * step;
            m.sway += step * 0.4;
            if (m.y < -0.02) {
              m.y = 1.02;
              m.x = Math.random();
            }
            const twinkle = 0.3 + 0.3 * Math.sin(time * 1.1 + m.sway * 3);
            c2d.beginPath();
            c2d.arc((m.x + Math.sin(m.sway) * 0.012) * w, m.y * h, m.r, 0, Math.PI * 2);
            c2d.fillStyle = m.warm ? `rgba(255, 205, 120, ${twinkle})` : `rgba(255, 255, 255, ${twinkle * 0.7})`;
            c2d.fill();
          }
        };
        gsap.ticker.add(loop);
        cleanups.push(() => gsap.ticker.remove(loop));
      }
    }
  }, root);

  return () => {
    for (const fn of cleanups) fn();
    ctx.revert();
  };
}

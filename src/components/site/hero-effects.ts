import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** How far each layer travels with the pointer, as a share of the hero's width. Far layers barely move; near ones move most. */
const DEPTH: Record<string, number> = { sky: 0.006, photo: 0.014, glow: 0.024, streaks: 0.035, dust: 0.05, vignette: 0.02 };
/** How far each layer drifts as the hero scrolls away, in percent of its own height. */
const SCROLL_SHIFT: Record<string, number> = { sky: 4, photo: 12, glow: 18, streaks: 26, dust: 38, vignette: -8 };

/**
 * The hero's depth effects, loaded only on devices that can afford them (a fine pointer, no reduced-motion request,
 * a wide screen) and only after the first paint. The still scene is already on the page from the server; this adds
 * pointer parallax with a slight tilt, a slow drift when the pointer is idle, layers that separate on scroll, and
 * dust drifting through the light. Returns a function that removes everything it added.
 */
export function startHeroEffects(root: HTMLElement): () => void {
  const layer = (name: string) => root.querySelector<HTMLElement>(`[data-layer="${name}"]`);
  const names = Object.keys(DEPTH);
  const cleanups: (() => void)[] = [];
  const ctx = gsap.context(() => {
    gsap.set(root, { transformPerspective: 1400, transformOrigin: "50% 60%" });

    const setters = new Map<string, { x: (v: number) => void; y: (v: number) => void }>();
    for (const name of names) {
      const el = layer(name);
      if (!el) continue;
      setters.set(name, {
        x: gsap.quickTo(el, "x", { duration: 1.4, ease: "power3.out" }),
        y: gsap.quickTo(el, "y", { duration: 1.4, ease: "power3.out" }),
      });
    }
    const tiltX = gsap.quickTo(root, "rotationX", { duration: 1.6, ease: "power3.out" });
    const tiltY = gsap.quickTo(root, "rotationY", { duration: 1.6, ease: "power3.out" });
    const bloom = layer("bloom");
    const bloomX = bloom ? gsap.quickTo(bloom, "x", { duration: 2.2, ease: "power3.out" }) : null;
    const bloomY = bloom ? gsap.quickTo(bloom, "y", { duration: 2.2, ease: "power3.out" }) : null;
    const photo = layer("photo");
    if (photo) gsap.to(photo, { scale: 1.07, duration: 26, delay: 1.8, ease: "none" });

    // Pointer position in -1..1; a slow drift takes over when the pointer has been idle.
    let pointerX = 0;
    let pointerY = 0;
    let lastMove = 0;
    const onMove = (e: PointerEvent) => {
      pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      pointerY = (e.clientY / window.innerHeight) * 2 - 1;
      lastMove = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    cleanups.push(() => window.removeEventListener("pointermove", onMove));

    // GSAP's ticker passes the time in seconds.
    const tick = (time: number) => {
      const idle = performance.now() - lastMove > 2500;
      const nx = idle ? Math.sin(time * 0.22) * 0.6 : pointerX;
      const ny = idle ? Math.cos(time * 0.17) * 0.35 : pointerY;
      const width = root.clientWidth || window.innerWidth;
      for (const name of names) {
        const s = setters.get(name);
        if (!s) continue;
        s.x(-nx * (DEPTH[name] ?? 0) * width);
        s.y(-ny * (DEPTH[name] ?? 0) * width * 0.6);
      }
      tiltY(nx * 1.6);
      tiltX(-ny * 1.1);
      bloomX?.(nx * width * 0.05);
      bloomY?.(ny * width * 0.03);
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));

    const scroll = gsap.timeline({ scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 0.8 } });
    for (const name of names) {
      const el = layer(name);
      if (el) scroll.to(el, { yPercent: SCROLL_SHIFT[name] ?? 0, ease: "none" }, 0);
    }

    // Dust: a few dozen motes on a canvas inside the dust layer, paused while the hero is off screen.
    const dust = layer("dust");
    if (dust) {
      const canvas = document.createElement("canvas");
      canvas.className = "size-full";
      dust.appendChild(canvas);
      cleanups.push(() => canvas.remove());
      const c2d = canvas.getContext("2d");
      if (c2d) {
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
        window.addEventListener("resize", resize);
        cleanups.push(() => window.removeEventListener("resize", resize));
        let visible = true;
        const io = new IntersectionObserver(([entry]) => {
          visible = Boolean(entry?.isIntersecting);
        });
        io.observe(root);
        cleanups.push(() => io.disconnect());
        const loop = (time: number, delta: number) => {
          if (!visible) return;
          const w = canvas.width;
          const h = canvas.height;
          c2d.clearRect(0, 0, w, h);
          const step = Math.min(64, delta) / 1000;
          for (const m of motes) {
            m.y -= m.speed * step;
            m.sway += (step * 1000) / 2600;
            if (m.y < -0.02) {
              m.y = 1.02;
              m.x = Math.random();
            }
            const twinkle = 0.35 + 0.35 * Math.sin(time * 1.1 + m.sway * 3);
            c2d.beginPath();
            c2d.arc((m.x + Math.sin(m.sway) * 0.012) * w, m.y * h, m.r * dpr, 0, Math.PI * 2);
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
    gsap.set(root, { clearProps: "all" });
  };
}

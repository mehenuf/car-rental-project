import { preload } from "react-dom";

const HERO_SM = "/hero/night-highway-sm.webp";
const HERO_LG = "/hero/night-highway.webp";

/**
 * The hero's background: one optimised photograph under a scrim that keeps the headline readable. It is a static
 * composition rendered on the server, with no scripts, no scroll-linked movement and no animation, so the page's
 * largest paint is as early and as cheap as it can be. The photo is preloaded because it is the LCP element.
 */
export function HeroScene() {
  preload(HERO_LG, { as: "image", imageSrcSet: `${HERO_SM} 900w, ${HERO_LG} 1920w`, imageSizes: "100vw", fetchPriority: "high" });
  return (
    <div className="absolute inset-0 overflow-hidden bg-background" aria-hidden="true">
      {/* A plain img on purpose: the two sizes are already optimised files in /public, so there is no image-server
          round trip on the page's most important paint. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_LG}
        srcSet={`${HERO_SM} 900w, ${HERO_LG} 1920w`}
        sizes="100vw"
        alt=""
        width={1920}
        height={1080}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
    </div>
  );
}

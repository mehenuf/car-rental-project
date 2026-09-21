import { Noto_Sans_Arabic } from "next/font/google";

// One module per script font, imported only for that language (see ../fonts.ts), so the @font-face rules for a script
// are not in the stylesheet of every other language. Script fonts carry their own Latin glyphs. Not preloaded: a page
// in that language fetches the file as soon as its text needs it.
export const scriptFont = Noto_Sans_Arabic({ variable: "--font-script", subsets: ["arabic"], preload: false, display: "swap" });

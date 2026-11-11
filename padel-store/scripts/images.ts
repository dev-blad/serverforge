/**
 * Generates original, royalty-free product illustrations as SVG.
 * Brands are fictional; no third-party logos are used.
 * Used by `npm run images` (writes to public/images/products).
 */

export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  bg?: [string, string];
}

export type ImageKind =
  | { type: "racket"; shape: "round" | "teardrop" | "diamond"; brand: string }
  | { type: "balls"; brand: string; pack: "tube" | "box" | "bucket" }
  | { type: "shoe"; brand: string }
  | { type: "bag"; brand: string; style: "thermo" | "backpack" | "holdall" }
  | { type: "grip"; brand: string }
  | { type: "tee" | "shorts" | "skort" | "hoodie"; brand: string }
  | { type: "wristband" | "cap" | "pressuriser" | "bottle"; brand: string }
  | { type: "protector"; brand: string };

const W = 800;

function frame(p: Palette, inner: string, variant: number) {
  const [a, b] = p.bg ?? (variant === 1 ? ["#eef2ec", "#dfe7dc"] : variant === 2 ? ["#f4f1ea", "#e8e2d5"] : ["#f3f5f1", "#e6ebe3"]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" role="img">
<defs>
<radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
<linearGradient id="pri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.primary}"/><stop offset="1" stop-color="${shade(p.primary, -0.28)}"/></linearGradient>
<linearGradient id="sec" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.secondary}"/><stop offset="1" stop-color="${shade(p.secondary, -0.25)}"/></linearGradient>
<linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.accent}"/><stop offset="1" stop-color="${shade(p.accent, -0.2)}"/></linearGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="ball" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#f4ff9a"/><stop offset=".55" stop-color="#d4ec2a"/><stop offset="1" stop-color="#9fb815"/></radialGradient>
<radialGradient id="shadow"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-opacity=".18"/></filter>
</defs>
<rect width="${W}" height="${W}" fill="url(#bg)"/>
${inner}
</svg>`;
}

/** Lighten (amt>0) or darken (amt<0) a hex colour. */
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const word = (brand: string, x: number, y: number, size: number, fill = "#fff", rotate = 0) =>
  `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="${size}" letter-spacing="${size * 0.12}" fill="${fill}" text-anchor="middle" transform="rotate(${rotate} ${x} ${y})">${esc(brand.toUpperCase())}</text>`;

function racketHead(shape: "round" | "teardrop" | "diamond") {
  // Head spans roughly y 60..470 centred on x=400
  if (shape === "round") return "M400 62 C 548 62 610 170 610 270 C 610 380 530 470 400 470 C 270 470 190 380 190 270 C 190 170 252 62 400 62 Z";
  if (shape === "teardrop") return "M400 60 C 560 60 612 160 606 262 C 600 360 520 470 400 474 C 280 470 200 360 194 262 C 188 160 240 60 400 60 Z";
  return "M400 56 C 500 56 590 118 610 214 C 622 290 560 400 400 476 C 240 400 178 290 190 214 C 210 118 300 56 400 56 Z";
}

function racket(p: Palette, k: Extract<ImageKind, { type: "racket" }>) {
  const head = racketHead(k.shape);
  let holes = "";
  for (let y = 120; y <= 420; y += 30) {
    for (let x = 230; x <= 570; x += 30) {
      const off = (y / 30) % 2 ? 15 : 0;
      holes += `<circle cx="${x + off}" cy="${y}" r="5.2" fill="#0b1410" fill-opacity=".55"/>`;
    }
  }
  return `<g id="racket">
<path d="M352 452 L 372 600 L 428 600 L 448 452 Z" fill="url(#sec)"/>
<path d="M372 470 L 400 548 L 428 470 Z" fill="${shade(p.secondary, -0.45)}" fill-opacity=".85"/>
<rect x="368" y="590" width="64" height="150" rx="12" fill="#1c1f1d"/>
${Array.from({ length: 9 }, (_, i) => `<path d="M368 ${600 + i * 16} L 432 ${612 + i * 16}" stroke="#3a403c" stroke-width="5"/>`).join("")}
<rect x="362" y="732" width="76" height="22" rx="8" fill="url(#acc)"/>
<path d="${head}" fill="url(#pri)" stroke="url(#sec)" stroke-width="22"/>
<clipPath id="hc"><path d="${head}"/></clipPath>
<g clip-path="url(#hc)">
<path d="M150 380 L 650 150 L 650 230 L 150 460 Z" fill="url(#acc)" opacity=".9"/>
<path d="M150 330 L 650 100 L 650 122 L 150 352 Z" fill="${p.secondary}" opacity=".65"/>
${holes}
<rect x="150" y="40" width="500" height="460" fill="url(#gloss)"/>
</g>
${word(k.brand, 400, 300, 34, "#ffffff", -24)}
<path d="${head}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="2"/>
</g>`;
}

function racketImage(p: Palette, k: Extract<ImageKind, { type: "racket" }>, v: number) {
  const r = racket(p, k);
  if (v === 0) return frame(p, `<ellipse cx="400" cy="770" rx="160" ry="16" fill="url(#shadow)"/><g filter="url(#soft)" transform="translate(0 0) scale(1)">${r}</g>`, v);
  if (v === 1)
    return frame(
      p,
      `<ellipse cx="420" cy="760" rx="240" ry="22" fill="url(#shadow)"/><g filter="url(#soft)" transform="rotate(-32 400 400) translate(10 20) scale(.92)">${r}</g>
<circle cx="640" cy="640" r="58" fill="url(#ball)"/><path d="M590 610 C 625 640 655 640 690 612" stroke="#fff" stroke-width="5" fill="none" opacity=".85"/><path d="M592 672 C 625 645 658 645 690 670" stroke="#fff" stroke-width="5" fill="none" opacity=".85"/>`,
      v,
    );
  return frame(p, `<g transform="translate(-420 -260) scale(2.05)">${r}</g><rect x="0" y="690" width="800" height="110" fill="#0b1410" opacity=".55"/>${word(k.brand + " · detail", 400, 760, 30, "#fff")}`, v);
}

function ballSvg(cx: number, cy: number, r: number) {
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#ball)"/>
<path d="M${cx - r * 0.85} ${cy - r * 0.5} C ${cx - r * 0.3} ${cy - r * 0.05} ${cx + r * 0.3} ${cy - r * 0.05} ${cx + r * 0.85} ${cy - r * 0.5}" stroke="#fff" stroke-width="${r * 0.09}" fill="none" opacity=".9"/>
<path d="M${cx - r * 0.85} ${cy + r * 0.5} C ${cx - r * 0.3} ${cy + r * 0.05} ${cx + r * 0.3} ${cy + r * 0.05} ${cx + r * 0.85} ${cy + r * 0.5}" stroke="#fff" stroke-width="${r * 0.09}" fill="none" opacity=".9"/></g>`;
}

function tube(p: Palette, brand: string, x: number, y: number, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
<rect x="-90" y="0" width="180" height="440" rx="22" fill="url(#pri)"/>
<rect x="-90" y="120" width="180" height="170" fill="url(#acc)"/>
<rect x="-90" y="0" width="180" height="440" rx="22" fill="url(#gloss)"/>
<ellipse cx="0" cy="0" rx="90" ry="20" fill="${shade(p.primary, 0.25)}"/>
<rect x="-96" y="-28" width="192" height="40" rx="12" fill="url(#sec)"/>
${word(brand, 0, 220, 30, "#fff", -90)}
<text x="0" y="400" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#fff" text-anchor="middle" opacity=".9">3 BALLS</text>
</g>`;
}

function ballsImage(p: Palette, k: Extract<ImageKind, { type: "balls" }>, v: number) {
  if (k.pack === "bucket") {
    return frame(
      p,
      `<ellipse cx="400" cy="720" rx="230" ry="24" fill="url(#shadow)"/>
<path d="M200 300 L 240 700 Q 400 740 560 700 L 600 300 Z" fill="url(#pri)" filter="url(#soft)"/>
<path d="M200 300 L 240 700 Q 400 740 560 700 L 600 300 Z" fill="url(#gloss)"/>
${ballSvg(300, 290, 60)}${ballSvg(410, 270, 62)}${ballSvg(510, 292, 58)}${ballSvg(360, 230, 55)}${ballSvg(465, 220, 54)}
<ellipse cx="400" cy="300" rx="200" ry="34" fill="none" stroke="url(#sec)" stroke-width="16"/>
<rect x="250" y="440" width="300" height="120" rx="14" fill="url(#acc)"/>${word(k.brand, 400, 515, 36, "#fff")}
${v === 1 ? ballSvg(650, 660, 70) : ""}`,
      v,
    );
  }
  if (k.pack === "box" || v === 2) {
    return frame(
      p,
      `<ellipse cx="400" cy="720" rx="300" ry="22" fill="url(#shadow)"/>
${tube(p, k.brand, 250, 230, 0.95)}${tube(p, k.brand, 400, 200, 1)}${tube(p, k.brand, 550, 230, 0.95)}
${ballSvg(400, 690, 54)}`,
      v,
    );
  }
  return frame(
    p,
    `<ellipse cx="400" cy="730" rx="220" ry="20" fill="url(#shadow)"/>${tube(p, k.brand, v === 1 ? 300 : 360, 230)}
${ballSvg(v === 1 ? 520 : 560, 640, 80)}${v === 1 ? ballSvg(620, 520, 70) + ballSvg(660, 650, 66) : ""}`,
    v,
  );
}

function shoeImage(p: Palette, k: { brand: string }, v: number) {
  const flip = v === 1 ? `transform="translate(800 0) scale(-1 1)"` : v === 2 ? `transform="rotate(-8 400 400) translate(0 20)"` : "";
  return frame(
    p,
    `<ellipse cx="400" cy="610" rx="300" ry="24" fill="url(#shadow)"/>
<g ${flip} filter="url(#soft)">
<path d="M120 520 C 120 470 150 450 200 440 L 330 410 C 380 360 420 300 470 280 L 540 270 C 580 300 600 340 640 380 C 690 400 700 450 690 520 Z" fill="url(#pri)"/>
<path d="M110 520 L 700 520 C 705 560 690 585 660 590 L 150 590 C 120 588 105 560 110 520 Z" fill="#f7f7f2"/>
<path d="M110 560 L 700 560 C 698 578 688 590 660 590 L 150 590 C 125 588 112 578 110 560 Z" fill="${shade(p.secondary, -0.1)}"/>
${Array.from({ length: 16 }, (_, i) => `<path d="M${150 + i * 34} 590 l 12 -14 l 12 14" stroke="#fff" stroke-opacity=".6" stroke-width="3" fill="none"/>`).join("")}
<path d="M220 470 C 320 430 420 480 520 430 C 580 410 640 430 680 470 L 690 500 C 600 470 520 520 400 500 C 320 488 260 500 200 505 Z" fill="url(#acc)"/>
<path d="M470 285 L 545 275 L 560 300 L 480 320 Z" fill="${shade(p.primary, -0.4)}"/>
${Array.from({ length: 5 }, (_, i) => `<path d="M${400 + i * 22} ${345 - i * 12} l 34 18" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`).join("")}
<path d="M560 290 C 610 300 640 330 660 380" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none"/>
${word(k.brand, 330, 485, 26, "#fff", -6)}
</g>`,
    v,
  );
}

function bagImage(p: Palette, k: Extract<ImageKind, { type: "bag" }>, v: number) {
  if (k.style === "backpack") {
    return frame(
      p,
      `<ellipse cx="400" cy="720" rx="210" ry="20" fill="url(#shadow)"/>
<g filter="url(#soft)" ${v === 1 ? 'transform="rotate(6 400 400)"' : ""}>
<path d="M330 130 C 330 90 470 90 470 130" stroke="${shade(p.primary, -0.4)}" stroke-width="18" fill="none"/>
<rect x="230" y="130" width="340" height="580" rx="90" fill="url(#pri)"/>
<rect x="270" y="420" width="260" height="230" rx="40" fill="url(#sec)"/>
<path d="M270 470 L 530 470" stroke="#000" stroke-opacity=".25" stroke-width="4" stroke-dasharray="10 6"/>
<path d="M260 240 C 300 200 500 200 540 240" stroke="#000" stroke-opacity=".3" stroke-width="5" stroke-dasharray="12 7" fill="none"/>
<rect x="230" y="130" width="340" height="580" rx="90" fill="url(#gloss)"/>
<rect x="300" y="300" width="200" height="60" rx="12" fill="url(#acc)"/>${word(k.brand, 400, 342, 26)}
</g>`,
      v,
    );
  }
  const wide = k.style === "holdall" ? 1.05 : 1;
  return frame(
    p,
    `<ellipse cx="400" cy="680" rx="320" ry="24" fill="url(#shadow)"/>
<g filter="url(#soft)" transform="${v === 1 ? "rotate(-6 400 400)" : ""} translate(400 0) scale(${wide} 1) translate(-400 0)">
<path d="M250 240 C 260 170 540 170 550 240" stroke="#1c1f1d" stroke-width="16" fill="none"/>
<path d="M110 300 C 110 250 150 230 200 230 L 600 230 C 650 230 690 250 690 300 L 690 600 C 690 640 660 660 620 660 L 180 660 C 140 660 110 640 110 600 Z" fill="url(#pri)"/>
<path d="M110 300 C 110 250 150 230 200 230 L 600 230 C 650 230 690 250 690 300" stroke="#000" stroke-opacity=".3" stroke-width="6" stroke-dasharray="14 8" fill="none"/>
${k.style === "thermo" ? `<path d="M130 260 C 250 330 300 520 270 650 L 200 660 C 160 560 140 400 130 260 Z" fill="url(#sec)"/><path d="M670 260 C 550 330 500 520 530 650 L 600 660 C 640 560 660 400 670 260 Z" fill="url(#sec)"/>` : `<rect x="110" y="520" width="580" height="60" fill="url(#sec)"/>`}
<rect x="300" y="390" width="200" height="70" rx="14" fill="url(#acc)"/>${word(k.brand, 400, 438, 28)}
<path d="M110 300 C 110 250 150 230 200 230 L 600 230 C 650 230 690 250 690 300 L 690 600 C 690 640 660 660 620 660 L 180 660 C 140 660 110 640 110 600 Z" fill="url(#gloss)"/>
</g>`,
    v,
  );
}

function gripImage(p: Palette, k: { brand: string }, v: number) {
  const roll = (cx: number, cy: number, c: string) =>
    `<g><ellipse cx="${cx}" cy="${cy}" rx="110" ry="110" fill="${c}"/>${Array.from({ length: 7 }, (_, i) => `<circle cx="${cx}" cy="${cy}" r="${100 - i * 12}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="2"/>`).join("")}<circle cx="${cx}" cy="${cy}" r="24" fill="${shade(c, -0.35)}"/></g>`;
  return frame(
    p,
    `<ellipse cx="400" cy="690" rx="280" ry="22" fill="url(#shadow)"/>
${v === 2 ? "" : `<rect x="210" y="160" width="380" height="520" rx="30" fill="url(#sec)" filter="url(#soft)"/><rect x="240" y="190" width="320" height="300" rx="160" fill="#fff" opacity=".18"/>${word(k.brand, 400, 600, 34)}<text x="400" y="640" text-anchor="middle" font-family="Helvetica, Arial" font-size="20" fill="#fff">OVERGRIP</text>`}
${roll(v === 2 ? 300 : 400, v === 2 ? 400 : 340, p.primary)}${v === 2 ? roll(500, 430, p.accent) : ""}`,
    v,
  );
}

function apparelImage(p: Palette, k: Extract<ImageKind, { type: "tee" | "shorts" | "skort" | "hoodie" }>, v: number) {
  let path = "";
  if (k.type === "tee" || k.type === "hoodie")
    path = `<path d="M300 140 C 340 170 460 170 500 140 L 640 200 L 700 330 L 610 370 L 580 320 L 580 680 L 220 680 L 220 320 L 190 370 L 100 330 L 160 200 Z" fill="url(#pri)"/>
<path d="M300 140 C 340 ${k.type === "hoodie" ? 240 : 190} 460 ${k.type === "hoodie" ? 240 : 190} 500 140" fill="${shade(p.primary, -0.35)}"/>
<path d="M220 420 L 580 420 L 580 450 L 220 450 Z" fill="url(#acc)"/>
${k.type === "hoodie" ? `<path d="M300 300 L 300 380 M500 300 L 500 380" stroke="#fff" stroke-width="5"/><rect x="300" y="520" width="200" height="110" rx="20" fill="#000" opacity=".12"/>` : ""}`;
  else if (k.type === "shorts")
    path = `<path d="M220 200 L 580 200 L 640 600 L 430 620 L 400 380 L 370 620 L 160 600 Z" fill="url(#pri)"/><rect x="220" y="200" width="360" height="40" fill="${shade(p.primary, -0.3)}"/><path d="M180 520 L 380 540 M620 520 L 420 540" stroke="url(#acc)" stroke-width="14"/>`;
  else
    path = `<path d="M240 200 L 560 200 L 660 620 L 140 620 Z" fill="url(#pri)"/><rect x="240" y="200" width="320" height="44" fill="${shade(p.primary, -0.3)}"/><path d="M150 580 L 650 580" stroke="url(#acc)" stroke-width="16"/><path d="M400 250 L 380 610" stroke="#000" stroke-opacity=".15" stroke-width="4"/>`;
  return frame(
    p,
    `<g filter="url(#soft)" ${v === 1 ? 'transform="rotate(-5 400 400)"' : ""}>${path}${word(k.brand, 400, k.type === "shorts" || k.type === "skort" ? 330 : 320, 30, "#fff")}</g>${v === 2 ? `<rect x="0" y="700" width="800" height="100" fill="#0b1410" opacity=".5"/>${word("breathable · quick dry", 400, 762, 24)}` : ""}`,
    v,
  );
}

function accessoryImage(p: Palette, k: Extract<ImageKind, { type: "wristband" | "cap" | "pressuriser" | "bottle" | "protector" }>, v: number) {
  let inner = "";
  switch (k.type) {
    case "wristband":
      inner = `<g filter="url(#soft)"><ellipse cx="330" cy="420" rx="170" ry="110" fill="none" stroke="url(#pri)" stroke-width="80"/><ellipse cx="500" cy="380" rx="150" ry="95" fill="none" stroke="url(#acc)" stroke-width="70"/></g>${word(k.brand, 330, 540, 26, shade(p.primary, -0.4))}`;
      break;
    case "cap":
      inner = `<g filter="url(#soft)"><path d="M190 470 C 190 260 610 260 610 470 Z" fill="url(#pri)"/><path d="M400 260 L 400 470" stroke="#000" stroke-opacity=".15" stroke-width="4"/><circle cx="400" cy="262" r="14" fill="${shade(p.primary, -0.4)}"/><path d="M180 470 C 300 450 520 450 720 520 C 600 560 300 540 180 500 Z" fill="url(#sec)"/>${word(k.brand, 400, 410, 30)}</g>`;
      break;
    case "pressuriser":
      inner = `<g filter="url(#soft)"><rect x="300" y="200" width="200" height="480" rx="30" fill="url(#pri)"/><rect x="290" y="150" width="220" height="70" rx="16" fill="url(#sec)"/><rect x="380" y="90" width="40" height="70" rx="8" fill="#1c1f1d"/><rect x="300" y="200" width="200" height="480" rx="30" fill="url(#gloss)"/><rect x="300" y="380" width="200" height="120" fill="url(#acc)"/>${word(k.brand, 400, 450, 26)}</g>${ballSvg(590, 640, 64)}`;
      break;
    case "bottle":
      inner = `<g filter="url(#soft)"><rect x="330" y="120" width="140" height="60" rx="14" fill="#1c1f1d"/><path d="M300 200 C 300 170 500 170 500 200 L 520 680 C 520 710 280 710 280 680 Z" fill="url(#pri)"/><path d="M300 200 C 300 170 500 170 500 200 L 520 680 C 520 710 280 710 280 680 Z" fill="url(#gloss)"/><rect x="292" y="380" width="216" height="140" fill="url(#acc)"/>${word(k.brand, 400, 462, 26)}</g>`;
      break;
    case "protector":
      inner = `<g filter="url(#soft)"><circle cx="400" cy="400" r="200" fill="none" stroke="${p.primary}" stroke-opacity=".55" stroke-width="90"/><circle cx="400" cy="400" r="200" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="6"/><circle cx="400" cy="400" r="110" fill="url(#sec)"/>${word(k.brand, 400, 412, 28)}</g>`;
      break;
  }
  return frame(p, `<ellipse cx="400" cy="720" rx="230" ry="20" fill="url(#shadow)"/><g ${v === 1 ? 'transform="rotate(-10 400 400)"' : v === 2 ? 'transform="translate(400 400) scale(1.15) translate(-400 -400)"' : ""}>${inner}</g>`, v);
}

export function renderProductImage(kind: ImageKind, palette: Palette, variant: number): string {
  switch (kind.type) {
    case "racket":
      return racketImage(palette, kind, variant);
    case "balls":
      return ballsImage(palette, kind, variant);
    case "shoe":
      return shoeImage(palette, kind, variant);
    case "bag":
      return bagImage(palette, kind, variant);
    case "grip":
      return gripImage(palette, kind, variant);
    case "tee":
    case "shorts":
    case "skort":
    case "hoodie":
      return apparelImage(palette, kind, variant);
    default:
      return accessoryImage(palette, kind, variant);
  }
}

/** Hero illustration: stylised padel court with glass walls, racket and ball. */
export function renderHero(): string {
  const p: Palette = { primary: "#0f5132", secondary: "#d9f99d", accent: "#bef264" };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" role="img">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2f24"/><stop offset="1" stop-color="#103d2f"/></linearGradient>
<linearGradient id="court" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d6fa5"/><stop offset="1" stop-color="#0f4c78"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe9ff" stop-opacity=".25"/><stop offset="1" stop-color="#bfe9ff" stop-opacity=".05"/></linearGradient>
<linearGradient id="pri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16a34a"/><stop offset="1" stop-color="#0f5132"/></linearGradient>
<linearGradient id="sec" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5e7eb"/><stop offset="1" stop-color="#9ca3af"/></linearGradient>
<linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9f99d"/><stop offset="1" stop-color="#a3e635"/></linearGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".25"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="ball" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#f4ff9a"/><stop offset=".55" stop-color="#d4ec2a"/><stop offset="1" stop-color="#9fb815"/></radialGradient>
<radialGradient id="glow" cx="50%" cy="30%" r="60%"><stop offset="0" stop-color="#d9f99d" stop-opacity=".35"/><stop offset="1" stop-color="#d9f99d" stop-opacity="0"/></radialGradient>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-opacity=".35"/></filter>
</defs>
<rect width="1200" height="900" fill="url(#sky)"/>
<rect width="1200" height="900" fill="url(#glow)"/>
<path d="M120 860 L 380 380 L 820 380 L 1080 860 Z" fill="url(#court)"/>
<path d="M120 860 L 380 380 L 820 380 L 1080 860 Z" fill="none" stroke="#fff" stroke-width="6"/>
<path d="M600 380 L 600 860 M220 680 L 980 680 M330 470 L 870 470" stroke="#fff" stroke-width="5" opacity=".9"/>
<path d="M180 750 L 1020 750" stroke="#0b1410" stroke-width="10" opacity=".5"/>
<path d="M175 700 L 1025 700 L 1025 752 L 175 752 Z" fill="none" stroke="#e5e7eb" stroke-width="4" opacity=".7"/>
<path d="M380 380 L 380 200 L 820 200 L 820 380 Z" fill="url(#glass)" stroke="#bfe9ff" stroke-opacity=".4" stroke-width="3"/>
<path d="M120 860 L 60 600 L 330 290 L 380 380 Z" fill="url(#glass)" stroke="#bfe9ff" stroke-opacity=".35" stroke-width="3"/>
<path d="M1080 860 L 1140 600 L 870 290 L 820 380 Z" fill="url(#glass)" stroke="#bfe9ff" stroke-opacity=".35" stroke-width="3"/>
<g transform="translate(560 40) rotate(28 400 400) scale(.95)" filter="url(#soft)">${racket(p, { type: "racket", shape: "teardrop", brand: "Courtline" })}</g>
<g filter="url(#soft)">${ballSvg(330, 520, 62)}</g>
</svg>`;
}

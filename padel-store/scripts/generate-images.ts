import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTS } from "../prisma/catalog";
import { renderHero, renderProductImage } from "./images";

const outDir = join(process.cwd(), "public/images/products");
mkdirSync(outDir, { recursive: true });

let count = 0;
for (const p of PRODUCTS) {
  for (let v = 0; v < 3; v++) {
    writeFileSync(join(outDir, `${p.slug}-${v + 1}.svg`), renderProductImage(p.image, p.palette, v));
    count++;
  }
}
writeFileSync(join(process.cwd(), "public/images/hero.svg"), renderHero());
console.log(`Generated ${count} product images + hero`);

import { writeFile } from "node:fs/promises";
import { loadEnv } from "vite";
const raw =
  process.env.VITE_SITE_URL ||
  loadEnv("production", process.cwd(), "VITE_").VITE_SITE_URL;
let site;
if (raw) {
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("VITE_SITE_URL must be an HTTP(S) URL");
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname))
    site = parsed.origin;
}
const paths = [
  "",
  "about",
  "administration",
  "teachers",
  "academics",
  "admission",
  "notices",
  "results",
  "gallery",
  "news",
  "downloads",
  "contact",
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${site ? paths.map((p) => `<url><loc>${site}/${p}</loc></url>`).join("") : ""}</urlset>\n`;
await writeFile(new URL("../public/sitemap.xml", import.meta.url), xml);
await writeFile(
  new URL("../public/robots.txt", import.meta.url),
  `User-agent: *\nAllow: /\nDisallow: /admin\n${site ? `Sitemap: ${site}/sitemap.xml\n` : "# Set VITE_SITE_URL to the final domain and rebuild to publish sitemap URLs.\n"}`,
);
if (!site)
  console.log("SEO: domain not configured; sitemap has no invented URLs.");

// Récupère de vraies actus de jeux (Google Actualités + flux de sites gaming) -> leaks.json
import { writeFile } from "node:fs/promises";

const GN = {
  "GTA 6": ["GTA 6 leak", "GTA VI fuite trailer"],
  "GTA RP": ["GTA RP serveur", "GTA RP actualité"],
  "FiveM": ["FiveM leak", "FiveM mod serveur"],
  "MW4": ["Modern Warfare 4 leak", "Call of Duty 2026 leak"],
  "Fortnite": ["Fortnite leak", "Fortnite skins saison"],
  "Valorant": ["Valorant leak", "Valorant nouvel agent"],
  "CS2": ["Counter-Strike 2 update", "CS2 leak"],
  "Minecraft": ["Minecraft snapshot", "Minecraft leak"],
  "Roblox": ["Roblox actualité", "Roblox update"],
};
const KW = {
  "GTA 6": /gta (6|vi)\b/i, "GTA RP": /gta ?rp|role-?play/i, "FiveM": /fivem|cfx\.re/i,
  "MW4": /modern warfare (4|iv)|mw4|call of duty|black ops|warzone/i, "Fortnite": /fortnite/i,
  "Valorant": /valorant/i, "CS2": /counter-strike|cs2/i, "Minecraft": /minecraft/i, "Roblox": /roblox/i,
};
const DIRECT = [
  "https://insider-gaming.com/feed/", "https://www.dexerto.com/feed/", "https://gamerant.com/feed/",
  "https://charlieintel.com/feed/", "https://www.gamespot.com/feeds/news/",
];

const dec = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#8217;/g, "’").trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? m[1] : ""; };
const text = (h) => dec(dec(h).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const get = async (u) => {
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 FluxBot" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(r.status);
  return r.text();
};
const items = (xml) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
const imageOf = (x) =>
  (x.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/) || x.match(/<enclosure[^>]*url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i)
  || dec(x).match(/<img[^>]*src="([^"]+)"/))?.[1] || "";
const ogImage = async (u) => {
  try { return (await get(u)).match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] || ""; }
  catch { return ""; }
};

const all = [], seen = new Set();
const add = (it) => {
  const k = it.title.toLowerCase();
  if (!it.title || seen.has(k) || isNaN(new Date(it.date))) return;
  seen.add(k); all.push(it);
};

// 1) Google Actualités (titres + sources, sans image)
for (const [cat, qs] of Object.entries(GN)) for (const q of qs) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`;
    for (const x of items(await get(url))) {
      const source = text(tag(x, "source")); let title = text(tag(x, "title"));
      if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
      add({ cat, title, link: text(tag(x, "link")), source, date: new Date(text(tag(x, "pubDate"))).toISOString(), image: "", summary: "" });
    }
  } catch (e) { console.warn("GN échec :", q, e.message); }
}

// 2) Sites gaming (images + extraits)
for (const feed of DIRECT) {
  try {
    const host = new URL(feed).hostname.replace(/^www\./, "");
    for (const x of items(await get(feed))) {
      const title = text(tag(x, "title")), desc = text(tag(x, "description"));
      const cat = Object.keys(KW).find((c) => KW[c].test(title + " " + desc));
      if (!cat) continue;
      add({ cat, title, link: text(tag(x, "link")), source: host, date: new Date(text(tag(x, "pubDate"))).toISOString(),
        image: imageOf(x), summary: desc.slice(0, 320) });
    }
  } catch (e) { console.warn("Flux échec :", feed, e.message); }
}

all.sort((a, b) => b.date.localeCompare(a.date));
const out = all.filter((it, i) => all.slice(0, i).filter((o) => o.cat === it.cat).length < 15);
let n = 0;
for (const it of out) if (!it.image && !it.link.includes("news.google.com") && n++ < 30) it.image = await ogImage(it.link);
if (out.length) await writeFile("leaks.json", JSON.stringify({ updated: new Date().toISOString(), items: out }, null, 1));
console.log(out.length, "articles,", out.filter((i) => i.image).length, "avec image");

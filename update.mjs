// Récupère de vraies actus/leaks (Google News RSS) et écrit leaks.json
import { writeFile } from "node:fs/promises";

const CATS = {
  "GTA 6": ["GTA 6 leak", "GTA VI fuite trailer 3"],
  "GTA RP": ["GTA RP serveur", "GTA RP actualité"],
  "FiveM": ["FiveM leak", "FiveM mod serveur"],
  "MW4": ["Modern Warfare 4 leak", "Call of Duty 2026 leak"],
  "Fortnite": ["Fortnite leak", "Fortnite skins saison"],
  "Valorant": ["Valorant leak", "Valorant nouvel agent"],
  "CS2": ["Counter-Strike 2 update", "CS2 leak"],
  "Minecraft": ["Minecraft snapshot", "Minecraft leak"],
  "Roblox": ["Roblox actualité", "Roblox update"],
};

const dec = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? dec(m[1]) : ""; };

async function feed(q) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 FluxBot" } });
  if (!r.ok) throw new Error(r.status);
  return [...(await r.text()).matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const x = m[1], source = tag(x, "source");
    let title = tag(x, "title");
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
    return { title, link: tag(x, "link"), source, date: new Date(tag(x, "pubDate")).toISOString() };
  });
}

const items = [], seen = new Set();
for (const [cat, queries] of Object.entries(CATS)) {
  for (const q of queries) {
    try {
      for (const it of await feed(q)) {
        const k = it.title.toLowerCase();
        if (seen.has(k) || isNaN(new Date(it.date))) continue;
        seen.add(k);
        items.push({ cat, ...it });
      }
    } catch (e) { console.warn("Échec :", q, e.message); }
  }
}
items.sort((a, b) => b.date.localeCompare(a.date));
const out = items.filter((it, i) => items.slice(0, i).filter((o) => o.cat === it.cat).length < 15);
if (out.length) await writeFile("leaks.json", JSON.stringify({ updated: new Date().toISOString(), items: out }, null, 1));
console.log(out.length, "articles");

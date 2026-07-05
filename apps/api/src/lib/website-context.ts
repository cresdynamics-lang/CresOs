import https from "https";
import http from "http";

interface SiteCache {
  content: string;
  fetchedAt: number;
}

let _siteCache: SiteCache | null = null;
const SITE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function httpFetch(url: string, redirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https://") ? https : http;
    const req = protocol.get(
      url,
      { headers: { "User-Agent": "CresOS-Assistant/1.0", Accept: "text/html,*/*" } },
      (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && redirects > 0) {
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          res.resume();
          httpFetch(next, redirects - 1).then(resolve).catch(reject);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error("HTTP timeout"));
    });
  });
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function crawlWebsiteContext(): Promise<string> {
  const baseUrl = (process.env.WEBSITE_CRAWL_URL || "https://www.cresdynamics.com").replace(/\/$/, "");
  const pagesToTry = [baseUrl, `${baseUrl}/services`, `${baseUrl}/about`, `${baseUrl}/pricing`];
  const collected: string[] = [];
  for (const url of pagesToTry) {
    try {
      const html = await httpFetch(url);
      const text = htmlToText(html);
      if (text.length > 100) collected.push(`[PAGE: ${url}]\n${text.slice(0, 3000)}`);
    } catch {
      /* skip */
    }
  }
  return collected.join("\n\n---\n\n").slice(0, 12000);
}

/** Live cresdynamics.com context for AI assistants (cached 6h). */
export async function getWebsiteContext(): Promise<string> {
  const now = Date.now();
  if (_siteCache && now - _siteCache.fetchedAt < SITE_CACHE_TTL_MS && _siteCache.content) {
    return _siteCache.content;
  }
  try {
    const content = await crawlWebsiteContext();
    _siteCache = { content, fetchedAt: now };
    return content;
  } catch {
    return "";
  }
}

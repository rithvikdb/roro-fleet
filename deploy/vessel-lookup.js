const USER_AGENT = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "AppleWebKit/537.36 (KHTML, like Gecko)",
  "Chrome/124.0 Safari/537.36",
].join(" ");

async function lookupVessel(query) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) return { found: false, error: "Missing vessel name or IMO" };

  const candidates = /^\d{7}$/.test(cleanQuery)
    ? [
        `https://www.vesselfinder.com/vessels/details/${cleanQuery}`,
        `https://www.marinetraffic.com/en/ais/details/ships/imo:${cleanQuery}`,
      ]
    : [
        `https://www.vesselfinder.com/vessels?name=${encodeURIComponent(cleanQuery)}`,
        `https://www.marinetraffic.com/en/ais/index/search/all/keyword:${encodeURIComponent(cleanQuery)}`,
      ];

  const errors = [];
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": USER_AGENT,
        },
      });

      if (!response.ok) {
        errors.push(`${sourceName(url)} returned ${response.status}`);
        continue;
      }

      const html = await response.text();
      const detailUrl = findDetailUrl(html, cleanQuery, url);
      if (detailUrl && detailUrl !== url) {
        const detail = await fetch(detailUrl, {
          headers: {
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": USER_AGENT,
          },
        });
        if (detail.ok) {
          const parsed = parseVesselPage(await detail.text(), detailUrl);
          if (parsed.found) return parsed;
        }
      }

      const parsed = parseVesselPage(html, url);
      if (parsed.found) return parsed;
      errors.push(`${sourceName(url)} did not expose vessel details`);
    } catch (error) {
      errors.push(`${sourceName(url)} failed: ${error.message}`);
    }
  }

  return {
    found: false,
    error: errors.join("; ") || "No public AIS details found",
  };
}

function parseVesselPage(html, url) {
  const text = decodeHtml(stripTags(html)).replace(/\s+/g, " ").trim();
  const title = decodeHtml(match(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const source = sourceName(url);

  const imo = first(
    match(text, /\bIMO\s*(?:number)?\s*[:#-]?\s*(\d{7})\b/i),
    match(title, /\bIMO\s*(\d{7})\b/i),
    match(url, /(?:imo:|details\/)(\d{7})/i)
  );

  const titleParts = title.split(/\s+-\s+|,\s*/).map((part) => part.trim()).filter(Boolean);
  const name = first(
    htmlLabeledValue(html, ["Vessel Name"]),
    jsonLdValue(html, "name"),
    match(text, /Vessel\s+([A-Z0-9][A-Z0-9 .'-]{2,60})\s+IMO/i),
    titleParts[0]
  );

  if (!imo && !name) return { found: false };

  const type = normalizeType(first(
    htmlLabeledValue(html, ["Ship Type", "Vessel Type", "AIS Type"]),
    labeledValue(text, ["Vessel Type", "Ship type", "Type"]),
    titleParts.find((part) => /carrier|cargo|tanker|ro-ro|roro|vehicle|passenger/i.test(part))
  ));

  return compact({
    found: true,
    source,
    sourceUrl: url,
    name: cleanName(name),
    imo,
    type,
    flag: normalizeFlag(first(htmlLabeledValue(html, ["Flag", "AIS Flag"]), labeledValue(text, ["Flag", "Flag State"]))),
    built: numberValue(first(
      htmlLabeledValue(html, ["Year of Build", "Year Built", "Built"]),
      labeledValue(text, ["Year Built", "Built"]),
      match(text, /\bBuilt\s*[:#-]?\s*(19\d{2}|20\d{2})\b/i)
    )),
    dwt: numberValue(first(htmlLabeledValue(html, ["Summer DWT", "Deadweight"]), labeledValue(text, ["Summer DWT", "Deadweight", "DWT"]))),
    gt: numberValue(first(htmlLabeledValue(html, ["Gross Tonnage"]), labeledValue(text, ["Gross Tonnage", "Gross tonnage", "GT"]), labeledValue(text, ["GRT"]))),
    call_sign: cleanCallSign(first(htmlLabeledValue(html, ["Callsign", "Call Sign"]), labeledValue(text, ["Call Sign", "Callsign"]), match(text, /\bCall Sign\s*([A-Z0-9]{3,8})\b/i))),
    propulsion: "DIESEL",
  });
}

function htmlLabeledValue(html, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `<td[^>]*>\\s*${escaped}(?:\\s*<[^>]+>[^<]*<\\/[^>]+>)*\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,
      "i"
    );
    const value = match(html, pattern);
    if (value) return decodeHtml(stripTags(value)).replace(/\s+/g, " ").trim();
  }
  return "";
}

function findDetailUrl(html, query, currentUrl) {
  if (/\/vessels\/details\//i.test(currentUrl) || /\/details\/ships\/imo:/i.test(currentUrl)) return currentUrl;

  const direct = match(html, /href=["']([^"']*\/vessels\/details\/\d{7}[^"']*)["']/i);
  if (direct) return absoluteUrl(direct, currentUrl);

  const imo = match(html, /\bIMO\s*(\d{7})\b/i);
  if (imo) return `https://www.vesselfinder.com/vessels/details/${imo}`;

  if (/^\d{7}$/.test(query)) return `https://www.vesselfinder.com/vessels/details/${query}`;
  return "";
}

function labeledValue(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const value = match(text, new RegExp(`${escaped}\\s*[:#-]?\\s*([^|;]{2,80})`, "i"));
    if (value) return value.replace(/\b(?:Vessel|Ship|Details|Information)\b.*$/i, "").trim();
  }
  return "";
}

function jsonLdValue(html, key) {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    try {
      const jsonText = match(block, /<script[^>]*>([\s\S]*?)<\/script>/i);
      const data = JSON.parse(jsonText);
      const value = findJsonKey(data, key);
      if (value) return value;
    } catch {
      // Ignore invalid embedded metadata.
    }
  }
  return "";
}

function findJsonKey(value, key) {
  if (!value || typeof value !== "object") return "";
  if (typeof value[key] === "string") return value[key];
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJsonKey(item, key);
      if (found) return found;
    }
  }
  for (const item of Object.values(value)) {
    const found = findJsonKey(item, key);
    if (found) return found;
  }
  return "";
}

function sourceName(url) {
  if (/vesselfinder/i.test(url)) return "VesselFinder";
  if (/marinetraffic/i.test(url)) return "MarineTraffic";
  return "Public AIS";
}

function absoluteUrl(value, base) {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

function normalizeType(value) {
  if (!value) return "";
  if (/vehicle|car carrier|pctc|pcc/i.test(value)) return "PCTC";
  if (/ro-?ro|roll/i.test(value)) return "RoRo";
  if (/conro/i.test(value)) return "ConRo";
  return value.split(/\s{2,}| - | \| /)[0].trim().slice(0, 30);
}

function normalizeFlag(value) {
  if (!value) return "";
  const clean = value.replace(/[^a-z ]/gi, " ").trim();
  const countryCodes = {
    japan: "JP",
    panama: "PA",
    liberia: "LR",
    "marshall islands": "MH",
    malta: "MT",
    norway: "NO",
    singapore: "SG",
    bahamas: "BS",
    cyprus: "CY",
    "united kingdom": "GB",
    usa: "US",
    "united states": "US",
  };
  const lower = clean.toLowerCase();
  return countryCodes[lower] || clean.slice(0, 2).toUpperCase();
}

function cleanName(value) {
  return String(value || "")
    .replace(/\b(?:vessel|ship|details|current position|marine traffic|vesselfinder)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function cleanCallSign(value) {
  return String(value || "").match(/[A-Z0-9]{3,8}/i)?.[0]?.toUpperCase() || "";
}

function stripTags(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function numberValue(value) {
  const matched = match(String(value || ""), /(\d[\d,.]*)/);
  return matched ? Number(matched.replace(/[,.]/g, "")) : undefined;
}

function match(value, regex) {
  const result = String(value || "").match(regex);
  return result ? result[1].trim() : "";
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") || "";
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

module.exports = { lookupVessel };

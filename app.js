const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

/* =========================================================
   GOLDMANIA SAVINGS
   MULTI-SELLER OFFICIAL PUBLIC PAGE ADAPTER
========================================================= */

const SELLERS = {
  caratlane: {
    name: "CaratLane",
    enabled: true,
    url: "https://www.caratlane.com/gold-coins/",
    sourceType: "official-public-page"
  },

  mmtc: {
    name: "MMTC-PAMP",
    enabled: true,
    url: "https://www.mmtcpamp.com/shop",
    sourceType: "official-public-page"
  },

  tanishq: {
    name: "Tanishq",
    enabled: true,
    url: "https://www.tanishq.co.in/shop/gold-coin?lang=en_IN",
    sourceType: "official-public-page"
  },

  kalyan: {
    name: "Kalyan Jewellers",
    enabled: true,
    url: "https://www.kalyanjewellers.net/Jewellery/Gold/gold-coin.php",
    sourceType: "official-public-page"
  },

  senco: {
    name: "Senco Gold & Diamonds",
    enabled: true,
    url: "https://sencogoldanddiamonds.com/jewellery/24k-1-g-999.9-pure-gold-coin",
    sourceType: "official-public-page"
  },

  malabar: {
    name: "Malabar Gold & Diamonds",
    enabled: true,
    url: "https://malabar191.malabargoldanddiamonds.com/gold-coins.html",
    sourceType: "official-public-page"
  },

  png: {
    name: "PNG Jewellers",
    enabled: true,
    url: "https://www.pngadgil.com/",
    sourceType: "official-public-page"
  },

  joyalukkas: {
    name: "Joyalukkas",
    enabled: true,
    url: "https://www.joyalukkas.in/",
    sourceType: "official-public-page"
  },

  bluestone: {
    name: "BlueStone",
    enabled: true,
    url: "https://www.bluestone.com/jewellery/goldcoins.html",
    sourceType: "official-public-page"
  },

  candere: {
    name: "Candere",
    enabled: true,
    url: "https://www.candere.com/gifts/gold-coins.html",
    sourceType: "official-public-page"
  },

  mia: {
    name: "Mia by Tanishq",
    enabled: true,
    url: "https://www.miabytanishq.com/",
    sourceType: "official-public-page"
  },

  reliance: {
    name: "Reliance Jewels",
    enabled: true,
    url: "https://www.reliancejewels.com/all-jewellery-coins/",
    sourceType: "official-public-page"
  },

  pcjeweller: {
    name: "PC Jeweller",
    enabled: true,
    url: "https://www.pcjeweller.com/",
    sourceType: "official-public-page"
  }
};


/* =========================================================
   MAIN ROUTER
========================================================= */

export default {

  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    /* HEALTH */

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "GoldManiaSavings API",
        version: "5.0.0",
        time: new Date().toISOString(),

        storage: {
          goldHistory: Boolean(env.GOLD_HISTORY),
          productCache: Boolean(env.PRODUCT_CACHE)
        },

        sellers: Object.entries(SELLERS)
          .filter(([, seller]) => seller.enabled)
          .map(([id, seller]) => ({
            id,
            name: seller.name,
            sourceType: seller.sourceType
          }))
      });
    }

    /* GOLD */

    if (url.pathname === "/api/gold") {
      return getGoldRates(env);
    }

    /* SELLERS */

    if (url.pathname === "/api/sellers") {
      return json({
        ok: true,
        sellers: Object.entries(SELLERS).map(
          ([id, seller]) => ({
            id,
            name: seller.name,
            enabled: seller.enabled,
            sourceType: seller.sourceType,
            url: seller.url
          })
        )
      });
    }

    /* PRODUCTS */

    if (url.pathname === "/api/products") {
      return getProducts(request, env);
    }

    /* OFFERS */

    if (url.pathname === "/api/offers") {
      return getOffers(env);
    }

    /* HISTORY */

    if (url.pathname === "/api/history") {
      return getHistory(env);
    }

    return json({
      ok: false,
      message: "Unknown API endpoint",
      endpoints: [
        "/api/health",
        "/api/gold",
        "/api/sellers",
        "/api/products",
        "/api/offers",
        "/api/history"
      ]
    }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      updateScheduledData(env)
    );
  }

};


/* =========================================================
   INDIA GOLD REFERENCE
========================================================= */

async function fetchIndiaGoldData() {

  const response = await fetch(
    "https://snapdata.dev/api/v1/gold/in/latest.json",
    {
      headers: {
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `SnapData request failed: ${response.status}`
    );
  }

  const data = await response.json();

  const observations =
    Array.isArray(data.observations)
      ? data.observations
      : [];

  function getRate(instrument) {

    const item = observations.find(
      observation =>
        observation.instrument === instrument
    );

    return item
      ? Number(item.value || 0)
      : 0;
  }

  const rate24 = getRate("XAU.24K");
  const rate22 = getRate("XAU.22K");
  const rate18 = getRate("XAU.18K");

  if (!rate24 && !rate22 && !rate18) {
    throw new Error(
      "India gold rates not found"
    );
  }

  return {
    timestamp:
      data.generated_at ||
      new Date().toISOString(),

    date:
      data.coverage?.to || null,

    source:
      "IBJA benchmark via SnapData",

    resolution:
      data.resolution || "daily",

    currency:
      "INR",

    unit:
      "INR/gram",

    rates: {
      "24K": Number(rate24.toFixed(2)),
      "22K": Number(rate22.toFixed(2)),
      "18K": Number(rate18.toFixed(2))
    }
  };
}


/* =========================================================
   GOLD API
========================================================= */

async function fetchGoldData(env) {

  if (!env.GOLD_API_KEY) {
    throw new Error(
      "GOLD_API_KEY is not configured"
    );
  }

  const response = await fetch(
    "https://www.goldapi.io/api/XAU/INR",
    {
      headers: {
        "x-access-token":
          env.GOLD_API_KEY,

        "Content-Type":
          "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `GoldAPI request failed: ${response.status}`
    );
  }

  const data = await response.json();

  const ounce =
    Number(data.price || 0);

  if (!ounce || ounce <= 0) {
    throw new Error(
      "Invalid GoldAPI price"
    );
  }

  const gram24 =
    ounce / 31.1034768;

  const gram22 =
    gram24 * 0.916;

  const gram18 =
    gram24 * 0.750;

  return {
    timestamp:
      new Date().toISOString(),

    rates: {
      "24K":
        Number(gram24.toFixed(2)),

      "22K":
        Number(gram22.toFixed(2)),

      "18K":
        Number(gram18.toFixed(2))
    }
  };
}


/* =========================================================
   GOLD ENDPOINT
========================================================= */

async function getGoldRates(env) {

  let india = null;
  let international = null;

  try {
    india =
      await fetchIndiaGoldData();
  } catch (error) {
    console.error(
      "India gold error:",
      error
    );
  }

  try {
    international =
      await fetchGoldData(env);
  } catch (error) {
    console.error(
      "GoldAPI error:",
      error
    );
  }

  if (!india && !international) {
    return json({
      ok: false,
      live: false,
      message:
        "Gold rates unavailable"
    }, 502);
  }

  return json({
    ok: true,

    live:
      Boolean(india),

    timestamp:
      new Date().toISOString(),

    indiaReference:
      india
        ? {
            source:
              india.source,

            resolution:
              india.resolution,

            date:
              india.date,

            currency:
              india.currency,

            unit:
              india.unit,

            rates: {
              "24K": {
                perGram:
                  india.rates["24K"]
              },

              "22K": {
                perGram:
                  india.rates["22K"]
              },

              "18K": {
                perGram:
                  india.rates["18K"]
              }
            }
          }
        : null,

    internationalSpot:
      international
        ? {
            source:
              "GoldAPI",

            currency:
              "INR",

            rates: {
              "24K": {
                perGram:
                  international.rates["24K"]
              },

              "22K": {
                perGram:
                  international.rates["22K"]
              },

              "18K": {
                perGram:
                  international.rates["18K"]
              }
            }
          }
        : null
  });
}


/* =========================================================
   PRODUCTS ENDPOINT
========================================================= */

async function getProducts(request, env) {

  const url =
    new URL(request.url);

  const purity =
    url.searchParams.get("purity");

  const weightParam =
    url.searchParams.get("weight");

  const seller =
    url.searchParams.get("seller");

  const limitParam =
    url.searchParams.get("limit");

  const limit =
    limitParam
      ? Math.min(
          Math.max(
            Number(limitParam) || 100,
            1
          ),
          500
        )
      : 500;

  let products = [];

  let errors = [];

  /*
   * LIVE FETCH
   */

  const results =
    await Promise.allSettled(
      Object.entries(SELLERS)
        .filter(
          ([, sellerConfig]) =>
            sellerConfig.enabled &&
            (!seller ||
              sellerConfigNameMatch(
                seller,
                sellerConfig
              ))
        )
        .map(
          async ([sellerId]) => {

            const items =
              await fetchSellerProducts(
                sellerId,
                env
              );

            return {
              sellerId,
              products: items
            };
          }
        )
    );

  for (const result of results) {

    if (result.status === "fulfilled") {

      products.push(
        ...result.value.products
      );

    } else {

      errors.push(
        String(result.reason)
      );

    }
  }

  /*
   * CACHE FALLBACK
   */

  let cacheUsed = false;

  if (
    products.length === 0 &&
    env.PRODUCT_CACHE
  ) {

    try {

      const cached =
        await env.PRODUCT_CACHE.get(
          "products",
          {
            type: "json"
          }
        );

      if (
        cached &&
        Array.isArray(
          cached.products
        )
      ) {

        products =
          cached.products;

        cacheUsed = true;
      }

    } catch (error) {

      errors.push(
        `Cache read failed: ${error.message}`
      );

    }
  }

  /*
   * FILTER PURITY
   */

  if (purity) {

    products =
      products.filter(
        product =>
          String(product.purity)
            .toUpperCase() ===
          String(purity)
            .toUpperCase()
      );
  }

  /*
   * FILTER WEIGHT
   */

  if (
    weightParam !== null &&
    weightParam !== undefined
  ) {

    const weight =
      Number(weightParam);

    if (!Number.isNaN(weight)) {

      products =
        products.filter(
          product =>
            Number(product.weight) ===
            weight
        );
    }
  }

  /*
   * FILTER SELLER
   */

  if (seller) {

    products =
      products.filter(
        product =>
          String(
            product.sellerId
          ).toLowerCase() ===
          String(seller).toLowerCase()
      );
  }

  /*
   * DEDUPLICATE
   */

  products =
    dedupeProducts(products);

  /*
   * LIMIT
   */

  products =
    products.slice(0, limit);

  return json({

    ok: true,

    live:
      !cacheUsed &&
      products.length > 0,

    cacheUsed,

    updatedAt:
      new Date().toISOString(),

    count:
      products.length,

    sellerCount:
      new Set(
        products.map(
          product =>
            product.sellerId
        )
      ).size,

    errors,

    products
  });
}


/* =========================================================
   SELLER NAME MATCH
========================================================= */

function sellerConfigNameMatch(
  requested,
  seller
) {

  const value =
    String(requested)
      .toLowerCase()
      .trim();

  return (
    value ===
      seller.name.toLowerCase() ||
    value ===
      seller.sourceType.toLowerCase()
  );
}


/* =========================================================
   SELLER DISPATCHER
========================================================= */

async function fetchSellerProducts(
  sellerId,
  env
) {

  switch (sellerId) {

    case "caratlane":
      return fetchCaratLane(env);

    case "mmtc":
      return fetchMMTCPAMP(env);

    case "tanishq":
      return fetchTanishq(env);

    case "kalyan":
      return fetchKalyan(env);

    case "senco":
      return fetchSenco(env);

    case "malabar":
      return fetchMalabar(env);

    case "png":
      return fetchPNG(env);

    case "joyalukkas":
      return fetchJoyalukkas(env);

    case "bluestone":
      return fetchBlueStone(env);

    case "candere":
      return fetchCandere(env);

    case "mia":
      return fetchMia(env);

    case "reliance":
      return fetchReliance(env);

    case "pcjeweller":
      return fetchPCJeweller(env);

    default:
      return [];
  }
}


/* =========================================================
   CARATLANE
========================================================= */

async function fetchCaratLane(env) {

  const url =
    env.CARATLANE_PRODUCTS_URL ||
    SELLERS.caratlane.url;

  return fetchAndParseListing(
    url,
    "caratlane",
    "CaratLane"
  );
}


/* =========================================================
   MMTC-PAMP
========================================================= */

async function fetchMMTCPAMP(env) {

  const url =
    env.MMTC_PRODUCTS_URL ||
    SELLERS.mmtc.url;

  return fetchAndParseListing(
    url,
    "mmtc",
    "MMTC-PAMP"
  );
}


/* =========================================================
   TANISHQ
========================================================= */

async function fetchTanishq(env) {

  const url =
    env.TANISHQ_PRODUCTS_URL ||
    SELLERS.tanishq.url;

  return fetchAndParseListing(
    url,
    "tanishq",
    "Tanishq"
  );
}


/* =========================================================
   KALYAN
========================================================= */

async function fetchKalyan(env) {

  const url =
    env.KALYAN_PRODUCTS_URL ||
    SELLERS.kalyan.url;

  return fetchAndParseListing(
    url,
    "kalyan",
    "Kalyan Jewellers"
  );
}


/* =========================================================
   SENCO
========================================================= */

async function fetchSenco(env) {

  const url =
    env.SENCO_PRODUCTS_URL ||
    SELLERS.senco.url;

  return fetchAndParseListing(
    url,
    "senco",
    "Senco Gold & Diamonds"
  );
}


/* =========================================================
   MALABAR
========================================================= */

async function fetchMalabar(env) {

  const url =
    env.MALABAR_PRODUCTS_URL ||
    SELLERS.malabar.url;

  return fetchAndParseListing(
    url,
    "malabar",
    "Malabar Gold & Diamonds"
  );
}


/* =========================================================
   PNG
========================================================= */

async function fetchPNG(env) {

  const url =
    env.PNG_PRODUCTS_URL ||
    SELLERS.png.url;

  return fetchAndParseListing(
    url,
    "png",
    "PNG Jewellers"
  );
}


/* =========================================================
   JOYALUKKAS
========================================================= */

async function fetchJoyalukkas(env) {

  const url =
    env.JOYALUKKAS_PRODUCTS_URL ||
    SELLERS.joyalukkas.url;

  return fetchAndParseListing(
    url,
    "joyalukkas",
    "Joyalukkas"
  );
}


/* =========================================================
   BLUESTONE
========================================================= */

async function fetchBlueStone(env) {

  const url =
    env.BLUESTONE_PRODUCTS_URL ||
    SELLERS.bluestone.url;

  return fetchAndParseListing(
    url,
    "bluestone",
    "BlueStone"
  );
}


/* =========================================================
   CANDERE
========================================================= */

async function fetchCandere(env) {

  const url =
    env.CANDERE_PRODUCTS_URL ||
    SELLERS.candere.url;

  return fetchAndParseListing(
    url,
    "candere",
    "Candere"
  );
}


/* =========================================================
   MIA
========================================================= */

async function fetchMia(env) {

  const url =
    env.MIA_PRODUCTS_URL ||
    SELLERS.mia.url;

  return fetchAndParseListing(
    url,
    "mia",
    "Mia by Tanishq"
  );
}


/* =========================================================
   RELIANCE
========================================================= */

async function fetchReliance(env) {

  const url =
    env.RELIANCE_PRODUCTS_URL ||
    SELLERS.reliance.url;

  return fetchAndParseListing(
    url,
    "reliance",
    "Reliance Jewels"
  );
}


/* =========================================================
   PC JEWELLER
========================================================= */

async function fetchPCJeweller(env) {

  const url =
    env.PCJEWELLER_PRODUCTS_URL ||
    SELLERS.pcjeweller.url;

  return fetchAndParseListing(
    url,
    "pcjeweller",
    "PC Jeweller"
  );
}


/* =========================================================
   GENERIC OFFICIAL PAGE FETCHER
========================================================= */

async function fetchAndParseListing(
  url,
  sellerId,
  sellerName
) {

  try {

    const response =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            "Accept":
              "text/html,application/xhtml+xml,application/json",

            "User-Agent":
              "Mozilla/5.0 GoldManiaSavingsBot/5.0",

            "Accept-Language":
              "en-IN,en;q=0.9"
          }
        }
      );

    if (!response.ok) {

      throw new Error(
        `${sellerName} HTTP ${response.status}`
      );
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {

      const data =
        await response.json();

      return normalizeProducts(
        extractProductsFromJSON(data),
        sellerId,
        sellerName,
        url
      );
    }

    const html =
      await response.text();

    /*
     * First try JSON-LD.
     */

    let products =
      parseJsonLdProducts(
        html
      );

    /*
     * If JSON-LD does not provide
     * enough data, use HTML parser.
     */

    if (
      products.length === 0
    ) {

      products =
        parseGoldProductsFromHTML(
          html
        );
    }

    return normalizeProducts(
      products,
      sellerId,
      sellerName,
      url
    );

  } catch (error) {

    console.error(
      `${sellerName} adapter error:`,
      error
    );

    return [];
  }
}


/* =========================================================
   JSON PRODUCT EXTRACTION
========================================================= */

function extractProductsFromJSON(
  data
) {

  if (Array.isArray(data)) {
    return data;
  }

  if (
    Array.isArray(
      data.products
    )
  ) {
    return data.products;
  }

  if (
    Array.isArray(
      data.items
    )
  ) {
    return data.items;
  }

  if (
    Array.isArray(
      data.results
    )
  ) {
    return data.results;
  }

  if (
    data.product
  ) {
    return [data.product];
  }

  return [];
}


/* =========================================================
   JSON-LD PARSER
========================================================= */

function parseJsonLdProducts(
  html
) {

  const products = [];

  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while (
    (match = regex.exec(html))
  ) {

    try {

      const raw =
        match[1]
          .trim();

      const data =
        JSON.parse(raw);

      collectJsonLd(
        data,
        products
      );

    } catch {
      /* Ignore invalid JSON-LD */
    }
  }

  return products;
}


function collectJsonLd(
  data,
  products
) {

  if (!data) {
    return;
  }

  if (Array.isArray(data)) {

    for (
      const item of data
    ) {

      collectJsonLd(
        item,
        products
      );
    }

    return;
  }

  if (
    data["@graph"] &&
    Array.isArray(
      data["@graph"]
    )
  ) {

    for (
      const item of data["@graph"]
    ) {

      collectJsonLd(
        item,
        products
      );
    }
  }

  const type =
    Array.isArray(data["@type"])
      ? data["@type"]
      : [data["@type"]];

  if (
    type.includes("Product") ||
    data.name
  ) {

    const offer =
      Array.isArray(
        data.offers
      )
        ? data.offers[0]
        : data.offers;

    products.push({

      id:
        data.sku ||
        data.mpn ||
        data.productID ||
        "",

      productName:
        cleanText(
          data.name || ""
        ),

      listedPrice:
        extractNumber(
          offer?.price ||
          data.price
        ),

      mrp:
        extractNumber(
          data.mrp ||
          data.highPrice
        ),

      productUrl:
        data.url ||
        "",

      description:
        cleanText(
          data.description ||
          ""
        ),

      image:
        data.image ||
        "",

      availability:
        offer?.availability ||
        ""
    });
  }
}


/* =========================================================
   HTML GOLD PRODUCT PARSER
========================================================= */

function parseGoldProductsFromHTML(
  html
) {

  const products = [];

  const text =
    html
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      );

  /*
   * Common product card patterns.
   */

  const patterns = [

    /*
     * 24K / 22K product
     */

    /([^<>]{3,150}?(?:Gold Coin|Gold Bar|Gold Product|Gold Coin Pendant)[^<>]{0,150})/gi

  ];

  for (
    const pattern of patterns
  ) {

    let match;

    while (
      (match = pattern.exec(text))
    ) {

      const block =
        cleanText(
          match[1]
        );

      if (
        !isLikelyGoldProduct(
          block
        )
      ) {
        continue;
      }

      const weight =
        extractWeight(block);

      const purity =
        extractPurity(block);

      const price =
        extractPrice(block);

      if (
        weight ||
        purity ||
        price
      ) {

        products.push({

          productName:
            block,

          weight,

          purity,

          listedPrice:
            price
        });
      }
    }
  }

  /*
   * Dedicated price/title scanning.
   */

  const lines =
    text
      .split(/\s{2,}|\n+/)
      .map(
        line =>
          cleanText(line)
      )
      .filter(Boolean);

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {

    const line =
      lines[i];

    if (
      !isLikelyGoldProduct(
        line
      )
    ) {
      continue;
    }

    const nearby =
      lines
        .slice(
          i,
          i + 5
        )
        .join(" ");

    const weight =
      extractWeight(
        nearby
      );

    const purity =
      extractPurity(
        nearby
      );

    const price =
      extractPrice(
        nearby
      );

    if (
      weight ||
      purity ||
      price
    ) {

      products.push({

        productName:
          line,

        weight,

        purity,

        listedPrice:
          price,

        offerText:
          extractOfferText(
            nearby
          )
      });
    }
  }

  return products;
}


/* =========================================================
   NORMALIZER
========================================================= */

function normalizeProducts(
  data,
  sellerId,
  sellerName,
  sourceUrl
) {

  if (
    !Array.isArray(data)
  ) {
    return [];
  }

  const now =
    new Date().toISOString();

  return data
    .map(
      (item, index) => {

        const productName =
          cleanText(
            item.productName ||
            item.name ||
            item.title ||
            "Gold Product"
          );

        const combined =
          [
            productName,
            item.description || "",
            item.offerText || ""
          ].join(" ");

        const weight =
          Number(
            item.weight ||
            extractWeight(combined) ||
            0
          );

        const purity =
          normalizePurity(
            item.purity ||
            extractPurity(combined)
          );

        const listedPrice =
          extractNumber(
            item.listedPrice ||
            item.price ||
            item.salePrice ||
            item.currentPrice ||
            extractPrice(combined)
          );

        const mrp =
          extractNumber(
            item.mrp ||
            item.originalPrice ||
            0
          );

        const productUrl =
          safeUrl(
            item.productUrl ||
            item.url ||
            item.link ||
            sourceUrl
          );

        const offerText =
          cleanText(
            item.offerText ||
            extractOfferText(
              combined
            )
          );

        const coupon =
          extractOfferAmount(
            item.coupon
          );

        const cardOffer =
          extractOfferAmount(
            item.cardOffer
          );

        const upiOffer =
          extractOfferAmount(
            item.upiOffer
          );

        const cashback =
          extractOfferAmount(
            item.cashback
          );

        const voucher =
          cleanText(
            item.voucher ||
            ""
          );

        const promoCode =
          cleanText(
            item.promoCode ||
            ""
          );

        /*
         * Don't create useless products
         * without any gold information.
         */

        if (
          !productName &&
          !listedPrice &&
          !weight
        ) {
          return null;
        }

        return {

          id:
            String(
              item.id ||
              item.sku ||
              item.productId ||
              `${sellerId}-${hashString(
                productName +
                "-" +
                weight +
                "-" +
                index
              )}`
            ),

          sellerId,

          seller:
            sellerName,

          productName,

          purity:
            purity || "",

          weight:
            weight || 0,

          listedPrice:
            listedPrice || 0,

          mrp:
            mrp || 0,

          shipping:
            extractNumber(
              item.shipping ||
              0
            ),

          coupon,

          cardOffer,

          upiOffer,

          cashback,

          productUrl,

          status:
            "verified",

          sourceType:
            "verified-official-page",

          lastUpdated:
            now,

          source:
            sellerName,

          voucher,

          promoCode,

          offerText
        };
      }
    )
    .filter(Boolean);
}


/* =========================================================
   WEIGHT PARSER
========================================================= */

function extractWeight(
  value
) {

  if (!value) {
    return 0;
  }

  const text =
    String(value);

  const patterns = [

    /(\d+(?:\.\d+)?)\s*(?:grams?|gms?|g)\b/i,

    /(\d+(?:\.\d+)?)\s*gm\b/i

  ];

  for (
    const pattern of patterns
  ) {

    const match =
      text.match(pattern);

    if (match) {

      return Number(
        match[1]
      );
    }
  }

  return 0;
}


/* =========================================================
   PURITY PARSER
========================================================= */

function extractPurity(
  value
) {

  if (!value) {
    return "";
  }

  const text =
    String(value)
      .toUpperCase();

  if (
    /24\s*(?:K|KT|KARAT|CARAT)/i
      .test(text)
  ) {
    return "24K";
  }

  if (
    /22\s*(?:K|KT|KARAT|CARAT)/i
      .test(text)
  ) {
    return "22K";
  }

  if (
    /18\s*(?:K|KT|KARAT|CARAT)/i
      .test(text)
  ) {
    return "18K";
  }

  if (
    /\b999\.9+\b/.test(text) ||
    /\b9999\b/.test(text)
  ) {
    return "24K";
  }

  if (
    /\b999\b/.test(text)
  ) {
    return "24K";
  }

  if (
    /\b916\b/.test(text)
  ) {
    return "22K";
  }

  return "";
}


function normalizePurity(
  value
) {

  if (!value) {
    return "";
  }

  const result =
    extractPurity(
      String(value)
    );

  if (result) {
    return result;
  }

  const text =
    String(value)
      .toUpperCase();

  if (
    text === "24"
  ) {
    return "24K";
  }

  if (
    text === "22"
  ) {
    return "22K";
  }

  if (
    text === "18"
  ) {
    return "18K";
  }

  return "";
}


/* =========================================================
   PRICE PARSER
========================================================= */

function extractPrice(
  value
) {

  if (!value) {
    return 0;
  }

  const text =
    String(value);

  const patterns = [

    /₹\s*([\d,]+(?:\.\d+)?)/g,

    /Rs\.?\s*([\d,]+(?:\.\d+)?)/gi,

    /INR\s*([\d,]+(?:\.\d+)?)/gi

  ];

  for (
    const pattern of patterns
  ) {

    const match =
      pattern.exec(text);

    if (match) {

      return Number(
        match[1]
          .replace(/,/g, "")
      );
    }
  }

  return 0;
}


/* =========================================================
   NUMBER PARSER
========================================================= */

function extractNumber(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const cleaned =
    String(value)
      .replace(/[₹,\s]/g, "");

  const number =
    Number(
      cleaned
    );

  return Number.isFinite(number)
    ? number
    : 0;
}


/* =========================================================
   OFFER TEXT
========================================================= */

function extractOfferText(
  value
) {

  if (!value) {
    return "";
  }

  const text =
    cleanText(
      String(value)
    );

  const match =
    text.match(
      /(.{0,100}(?:offer|discount|coupon|cashback|voucher|promo|promocode|promo code|bank offer|upi|card offer|flat\s*₹|flat\s*rs).{0,200})/i
    );

  return match
    ? cleanText(match[1])
    : "";
}


/* =========================================================
   OFFER AMOUNT
========================================================= */

function extractOfferAmount(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (
    typeof value === "number"
  ) {
    return value;
  }

  return extractNumber(
    value
  );
}


/* =========================================================
   GOLD PRODUCT CHECK
========================================================= */

function isLikelyGoldProduct(
  value
) {

  if (!value) {
    return false;
  }

  return /gold|24k|22k|18k|999|916/i
    .test(
      String(value)
    );
}


/* =========================================================
   OFFER FILTER
========================================================= */

async function getOffers(
  env
) {

  let products =
    await getAllLiveProducts(
      env
    );

  if (
    products.length === 0 &&
    env.PRODUCT_CACHE
  ) {

    try {

      const cached =
        await env.PRODUCT_CACHE.get(
          "products",
          {
            type: "json"
          }
        );

      if (
        cached &&
        Array.isArray(
          cached.products
        )
      ) {

        products =
          cached.products;
      }

    } catch (error) {

      console.error(
        "Offer cache error:",
        error
      );
    }
  }

  const offers =
    products
      .filter(
        product =>
          Number(product.coupon) > 0 ||
          Number(product.cardOffer) > 0 ||
          Number(product.upiOffer) > 0 ||
          Number(product.cashback) > 0 ||
          Boolean(product.voucher) ||
          Boolean(product.promoCode) ||
          Boolean(product.offerText)
      )
      .map(
        product => ({
          sellerId:
            product.sellerId,

          seller:
            product.seller,

          productName:
            product.productName,

          productUrl:
            product.productUrl,

          coupon:
            product.coupon,

          cardOffer:
            product.cardOffer,

          upiOffer:
            product.upiOffer,

          cashback:
            product.cashback,

          voucher:
            product.voucher,

          promoCode:
            product.promoCode,

          offerText:
            product.offerText,

          lastUpdated:
            product.lastUpdated
        })
      );

  return json({
    ok: true,
    count:
      offers.length,
    offers
  });
}


/* =========================================================
   GET ALL LIVE PRODUCTS
========================================================= */

async function getAllLiveProducts(
  env
) {

  let products = [];

  const results =
    await Promise.allSettled(
      Object.entries(SELLERS)
        .filter(
          ([, seller]) =>
            seller.enabled
        )
        .map(
          async ([sellerId]) =>
            fetchSellerProducts(
              sellerId,
              env
            )
        )
    );

  for (
    const result of results
  ) {

    if (
      result.status ===
      "fulfilled"
    ) {

      products.push(
        ...result.value
      );
    }
  }

  return dedupeProducts(
    products
  );
}


/* =========================================================
   HISTORY
========================================================= */

async function getHistory(
  env
) {

  if (!env.GOLD_HISTORY) {

    return json({
      ok: true,
      storage:
        "not-configured",
      history: []
    });
  }

  try {

    const history =
      await env.GOLD_HISTORY.get(
        "history",
        {
          type: "json"
        }
      );

    return json({

      ok: true,

      storage:
        "KV",

      count:
        Array.isArray(history)
          ? history.length
          : 0,

      history:
        history || []
    });

  } catch (error) {

    console.error(
      "History read error:",
      error
    );

    return json({

      ok: false,

      storage:
        "KV",

      history: []

    }, 500);
  }
}


/* =========================================================
   SCHEDULED UPDATE
========================================================= */

async function updateScheduledData(
  env
) {

  const now =
    new Date().toISOString();

  let indiaGold =
    null;

  /*
   * GOLD HISTORY
   */

  try {

    indiaGold =
      await fetchIndiaGoldData();

    if (
      indiaGold &&
      env.GOLD_HISTORY
    ) {

      const existing =
        await env.GOLD_HISTORY.get(
          "history",
          {
            type: "json"
          }
        ) || [];

      existing.push({

        timestamp:
          indiaGold.timestamp,

        source:
          indiaGold.source,

        resolution:
          indiaGold.resolution,

        date:
          indiaGold.date,

        rates:
          indiaGold.rates
      });

      await env.GOLD_HISTORY.put(
        "history",
        JSON.stringify(
          existing.slice(-500)
        )
      );
    }

  } catch (error) {

    console.error(
      "Gold history update error:",
      error
    );
  }

  /*
   * PRODUCT FETCH
   */

  let products = [];

  try {

    products =
      await getAllLiveProducts(
        env
      );

  } catch (error) {

    console.error(
      "Product scheduled update error:",
      error
    );
  }

  /*
   * PRODUCT CACHE
   */

  if (
    env.PRODUCT_CACHE &&
    products.length > 0
  ) {

    try {

      await env.PRODUCT_CACHE.put(

        "products",

        JSON.stringify({

          updatedAt:
            now,

          count:
            products.length,

          products
        }),

        {
          expirationTtl:
            86400
        }
      );

    } catch (error) {

      console.error(
        "Product cache write error:",
        error
      );
    }
  }

  console.log(
    "Scheduled update completed",
    {
      time:
        now,

      indiaGold:
        Boolean(indiaGold),

      products:
        products.length
    }
  );

  return {

    ok: true,

    updatedAt:
      now,

    products:
      products.length,

    indiaGold:
      Boolean(indiaGold)
  };
}


/* =========================================================
   DEDUPLICATION
========================================================= */

function dedupeProducts(
  products
) {

  const map =
    new Map();

  for (
    const product of products
  ) {

    if (!product) {
      continue;
    }

    const key =
      [
        product.sellerId,
        product.productName,
        product.weight,
        product.purity,
        product.listedPrice
      ]
        .join("|")
        .toLowerCase();

    if (
      !map.has(key)
    ) {

      map.set(
        key,
        product
      );
    }
  }

  return [
    ...map.values()
  ];
}


/* =========================================================
   SAFE URL
========================================================= */

function safeUrl(
  value
) {

  if (!value) {
    return "";
  }

  try {

    const url =
      new URL(
        String(value)
      );

    if (
      url.protocol !==
        "http:" &&
      url.protocol !==
        "https:"
    ) {
      return "";
    }

    return url.toString();

  } catch {

    return "";
  }
}


/* =========================================================
   CLEAN TEXT
========================================================= */

function cleanText(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(
      /<[^>]*>/g,
      " "
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* =========================================================
   HASH
========================================================= */

function hashString(
  value
) {

  let hash =
    0;

  const text =
    String(value);

  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    hash =
      (
        (
          hash << 5
        ) -
        hash
      ) +
      text.charCodeAt(i);

    hash |= 0;
  }

  return Math.abs(
    hash
  );
}


/* =========================================================
   JSON RESPONSE
========================================================= */

function json(
  data,
  status = 200
) {

  return new Response(

    JSON.stringify(
      data,
      null,
      2
    ),

    {

      status,

      headers: {

        ...corsHeaders,

        "Content-Type":
          "application/json; charset=UTF-8",

        "Cache-Control":
          "no-store"
      }
    }
  );
}

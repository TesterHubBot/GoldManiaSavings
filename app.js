/* =========================================================
   GoldManiaSavings
   app.js
   FULL CORRECTED VERSION

   Worker API:
   https://goldmaniasavings-api.onlinetechmine.workers.dev

   Supports:
   /api/health
   /api/gold
   /api/products
   /api/sellers
   /api/offers

   IMPORTANT GOLD FIX:
   Worker can return either:

   {
     ok: true,
     rates: {
       "24K": { perGram: 14957 },
       "22K": { perGram: 13710 },
       "18K": { perGram: 11218 }
     }
   }

   OR:

   {
     ok: true,
     indiaReference: {
       rates: {...}
     }
   }

   This app supports BOTH formats.
========================================================= */

"use strict";


/* =========================================================
   CONFIG
========================================================= */

const API_BASE =
  "https://goldmaniasavings-api.onlinetechmine.workers.dev";

const API = {
  health: `${API_BASE}/api/health`,
  gold: `${API_BASE}/api/gold`,
  products: `${API_BASE}/api/products`,
  sellers: `${API_BASE}/api/sellers`,
  offers: `${API_BASE}/api/offers`
};

const REQUEST_TIMEOUT = 15000;

const CACHE_KEYS = {
  gold: "gms_gold_cache_v3",
  products: "gms_products_cache_v3",
  sellers: "gms_sellers_cache_v3",
  offers: "gms_offers_cache_v3"
};


/* =========================================================
   STATE
========================================================= */

const state = {

  gold: null,

  products: [],

  sellers: [],

  offers: [],

  selectedPurity: "",

  selectedWeight: "",

  selectedSeller: "",

  productsLoaded: false,

  goldLoaded: false,

  offersLoaded: false,

  healthLoaded: false,

  apiConnected: false,

  loadingProducts: false,

  loadingGold: false,

  loadingOffers: false,

  loadingHealth: false,

  lastProductUpdate: null,

  lastGoldUpdate: null,

  lastHealthUpdate: null

};


/* =========================================================
   DOM HELPERS
========================================================= */

function $(selector) {

  return document.querySelector(selector);

}


function $all(selector) {

  return Array.from(
    document.querySelectorAll(selector)
  );

}


function safeText(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);


async function init() {

  setConnectionStatus(
    "Connecting..."
  );

  bindEvents();

  loadCachedData();

  renderAll();

  /*
   * Health + actual APIs are loaded.
   *
   * Health failure alone must NOT make
   * the entire site appear unavailable.
   */

  await Promise.allSettled([

    loadHealth(),

    loadGold(),

    loadProducts(),

    loadSellers(),

    loadOffers()

  ]);

  renderAll();

  updateConnectionStatus();

}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {

  $all("button")
    .forEach(button => {

      const text =
        String(
          button.textContent || ""
        ).toLowerCase();

      if (
        text.includes("refresh")
      ) {

        button.addEventListener(
          "click",
          async event => {

            event.preventDefault();

            await refreshAll();

          }
        );

      }

    });


  const purity =
    findSelect([
      "#purity",
      "#puritySelect",
      "#purity-filter",
      "[name='purity']"
    ]);


  const weight =
    findSelect([
      "#weight",
      "#weightSelect",
      "#weight-filter",
      "[name='weight']"
    ]);


  const seller =
    findSelect([
      "#seller",
      "#sellerSelect",
      "#seller-filter",
      "[name='seller']"
    ]);


  if (purity) {

    purity.addEventListener(
      "change",
      () => {

        state.selectedPurity =
          purity.value || "";

        renderProducts();

      }
    );

  }


  if (weight) {

    weight.addEventListener(
      "change",
      () => {

        state.selectedWeight =
          weight.value || "";

        renderProducts();

      }
    );

  }


  if (seller) {

    seller.addEventListener(
      "change",
      () => {

        state.selectedSeller =
          seller.value || "";

        renderProducts();

      }
    );

  }


  const compareButton =
    findButtonByText("compare");


  if (compareButton) {

    compareButton.addEventListener(
      "click",
      event => {

        event.preventDefault();

        readFilters();

        renderProducts();

      }
    );

  }


  const clearButton =
    findButtonByText("clear");


  if (clearButton) {

    clearButton.addEventListener(
      "click",
      event => {

        event.preventDefault();

        clearFilters();

      }
    );

  }

}


/* =========================================================
   SELECT FINDER
========================================================= */

function findSelect(selectors) {

  for (
    const selector of selectors
  ) {

    const element =
      $(selector);

    if (
      element &&
      element.tagName === "SELECT"
    ) {

      return element;

    }

  }

  return null;

}


/* =========================================================
   BUTTON FINDER
========================================================= */

function findButtonByText(text) {

  const wanted =
    String(text)
      .toLowerCase();

  return $all("button")
    .find(button =>
      String(
        button.textContent || ""
      )
        .toLowerCase()
        .includes(wanted)
    ) || null;

}


/* =========================================================
   READ FILTERS
========================================================= */

function readFilters() {

  const purity =
    findSelect([
      "#purity",
      "#puritySelect",
      "#purity-filter",
      "[name='purity']"
    ]);


  const weight =
    findSelect([
      "#weight",
      "#weightSelect",
      "#weight-filter",
      "[name='weight']"
    ]);


  const seller =
    findSelect([
      "#seller",
      "#sellerSelect",
      "#seller-filter",
      "[name='seller']"
    ]);


  state.selectedPurity =
    purity?.value || "";


  state.selectedWeight =
    weight?.value || "";


  state.selectedSeller =
    seller?.value || "";

}


/* =========================================================
   CLEAR FILTERS
========================================================= */

function clearFilters() {

  state.selectedPurity = "";

  state.selectedWeight = "";

  state.selectedSeller = "";


  [
    "#purity",
    "#puritySelect",
    "#purity-filter",
    "[name='purity']",

    "#weight",
    "#weightSelect",
    "#weight-filter",
    "[name='weight']",

    "#seller",
    "#sellerSelect",
    "#seller-filter",
    "[name='seller']"

  ].forEach(selector => {

    const element =
      $(selector);

    if (element) {

      element.value = "";

    }

  });


  renderProducts();

}


/* =========================================================
   FETCH JSON
========================================================= */

async function fetchJSON(url) {

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );


  try {

    const response =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            "Accept":
              "application/json"
          },

          cache:
            "no-store",

          signal:
            controller.signal
        }
      );


    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    const raw =
      await response.text();


    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }


    let data;


    try {

      data =
        JSON.parse(raw);

    } catch {

      throw new Error(
        contentType.includes(
          "application/json"
        )
          ? "Invalid JSON response"
          : "API did not return JSON"
      );

    }


    return data;

  } finally {

    clearTimeout(timeout);

  }

}


/* =========================================================
   HEALTH
========================================================= */

async function loadHealth() {

  if (
    state.loadingHealth
  ) {

    return;

  }


  state.loadingHealth = true;


  try {

    const data =
      await fetchJSON(
        API.health
      );


    state.healthLoaded = true;

    state.apiConnected =
      data?.ok !== false;

    state.lastHealthUpdate =
      new Date();


  } catch (error) {

    console.warn(
      "Health API failed:",
      error
    );

    /*
     * IMPORTANT:
     *
     * Health failure does not mean
     * gold/products APIs are unavailable.
     */

  } finally {

    state.loadingHealth = false;

  }

}


/* =========================================================
   GOLD
========================================================= */

async function loadGold() {

  if (
    state.loadingGold
  ) {

    return;

  }


  state.loadingGold = true;


  try {

    const data =
      await fetchJSON(
        API.gold
      );


    console.log(
      "[GoldManiaSavings] /api/gold:",
      data
    );


    if (
      !data ||
      data.ok !== true
    ) {

      throw new Error(
        data?.message ||
        "Gold API returned invalid data"
      );

    }


    const normalized =
      normalizeGoldResponse(
        data
      );


    if (!normalized) {

      throw new Error(
        "Gold API returned rates in an unsupported format"
      );

    }


    state.gold =
      normalized;


    state.goldLoaded = true;

    state.apiConnected = true;

    state.lastGoldUpdate =
      new Date();


    saveCache(
      CACHE_KEYS.gold,
      state.gold
    );


    renderGold();


    updateConnectionStatus();


  } catch (error) {

    console.error(
      "Gold loading failed:",
      error
    );


    /*
     * If cache exists, keep displaying it.
     */

    if (
      state.gold
    ) {

      renderGold();

    } else {

      renderGoldError(
        "Gold price unavailable"
      );

    }

  } finally {

    state.loadingGold = false;

  }

}


/* =========================================================
   GOLD NORMALIZER
   SUPPORTS MULTIPLE WORKER FORMATS
========================================================= */

function normalizeGoldResponse(data) {

  if (
    !data ||
    typeof data !== "object"
  ) {

    return null;

  }


  /*
   * FORMAT 1
   *
   * {
   *   rates: {
   *     "24K": {...}
   *   }
   * }
   */

  let reference =
    data;


  /*
   * FORMAT 2
   *
   * {
   *   indiaReference: {
   *     rates: {...}
   *   }
   * }
   */

  if (
    data.indiaReference &&
    typeof data.indiaReference === "object"
  ) {

    reference =
      data.indiaReference;

  }


  /*
   * FORMAT 3
   *
   * {
   *   india: {
   *     rates: {...}
   *   }
   */

  else if (
    data.india &&
    typeof data.india === "object"
  ) {

    reference =
      data.india;

  }


  const rates =
    reference.rates ||
    data.rates ||
    {};


  const r24 =
    extractRate(
      rates["24K"] ??
      rates["24k"] ??
      rates["24"] ??
      data["24K"] ??
      data["24k"]
    );


  const r22 =
    extractRate(
      rates["22K"] ??
      rates["22k"] ??
      rates["22"] ??
      data["22K"] ??
      data["22k"]
    );


  const r18 =
    extractRate(
      rates["18K"] ??
      rates["18k"] ??
      rates["18"] ??
      data["18K"] ??
      data["18k"]
    );


  /*
   * At least one rate must exist.
   */

  if (
    !r24 &&
    !r22 &&
    !r18
  ) {

    return null;

  }


  return {

    ok: true,

    source:
      reference.source ||
      data.source ||
      "SnapData",

    resolution:
      reference.resolution ||
      data.resolution ||
      "daily",

    date:
      reference.date ||
      data.date ||
      data.timestamp ||
      "",

    timestamp:
      data.timestamp ||
      reference.timestamp ||
      "",

    currency:
      reference.currency ||
      data.currency ||
      "INR",

    unit:
      reference.unit ||
      data.unit ||
      "INR/gram",

    live:
      data.live !== false,

    cached:
      data.cached === true,

    rates: {

      "24K": r24,

      "22K": r22,

      "18K": r18

    }

  };

}


/* =========================================================
   EXTRACT RATE
========================================================= */

function extractRate(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return 0;

  }


  if (
    typeof value === "object"
  ) {

    return number(
      value.perGram ??
      value.price ??
      value.value ??
      value.rate ??
      value.amount
    );

  }


  return number(value);

}


/* =========================================================
   PRODUCTS
========================================================= */

async function loadProducts() {

  if (
    state.loadingProducts
  ) {

    return;

  }


  state.loadingProducts = true;


  try {

    const data =
      await fetchJSON(
        API.products
      );


    if (
      !data ||
      data.ok !== true
    ) {

      throw new Error(
        data?.message ||
        "Products API returned invalid data"
      );

    }


    const products =
      Array.isArray(
        data.products
      )
        ? data.products
        : [];


    state.products =
      normalizeProducts(
        products
      );


    state.productsLoaded = true;

    state.apiConnected = true;


    state.lastProductUpdate =
      data.updatedAt
        ? new Date(
            data.updatedAt
          )
        : new Date();


    saveCache(
      CACHE_KEYS.products,
      {
        updatedAt:
          data.updatedAt ||
          new Date().toISOString(),

        products:
          state.products
      }
    );


    renderSellerOptions();

    populateWeightOptions();

    renderProducts();

  } catch (error) {

    console.error(
      "Product loading failed:",
      error
    );


    if (
      state.products.length === 0
    ) {

      renderProductsError(
        "Product data unavailable"
      );

    }

  } finally {

    state.loadingProducts = false;

  }

}


/* =========================================================
   NORMALIZE PRODUCTS
========================================================= */

function normalizeProducts(products) {

  return products
    .filter(Boolean)
    .map(product => {

      const price =
        number(
          product.listedPrice ??
          product.price ??
          product.salePrice
        );


      const weight =
        number(
          product.weight ??
          product.weightGrams ??
          product.grams
        );


      const purity =
        normalizePurity(
          product.purity ??
          product.karat ??
          product.goldPurity
        );


      const productUrl =
        normalizeProductUrl(
          product.productUrl ||
          product.url ||
          product.link ||
          product.productLink
        );


      return {

        ...product,

        sellerId:
          String(
            product.sellerId ||
            product.seller_id ||
            product.seller ||
            ""
          ),

        seller:
          product.sellerName ||
          product.seller ||
          product.sellerId ||
          "Seller",

        productName:
          cleanProductName(
            product.productName ||
            product.name ||
            product.title ||
            "Gold Coin"
          ),

        purity,

        weight,

        listedPrice:
          price,

        mrp:
          number(
            product.mrp
          ),

        coupon:
          number(
            product.coupon
          ),

        cardOffer:
          number(
            product.cardOffer
          ),

        upiOffer:
          number(
            product.upiOffer
          ),

        cashback:
          number(
            product.cashback
          ),

        voucher:
          String(
            product.voucher || ""
          ).trim(),

        promoCode:
          String(
            product.promoCode || ""
          ).trim(),

        offerText:
          String(
            product.offerText || ""
          ).trim(),

        productUrl,

        status:
          product.status ||
          "verified"

      };

    })
    .filter(product =>
      product.listedPrice > 0 &&
      product.productUrl
    );

}


/* =========================================================
   SELLERS
========================================================= */

async function loadSellers() {

  try {

    const data =
      await fetchJSON(
        API.sellers
      );


    if (
      data &&
      Array.isArray(
        data.sellers
      )
    ) {

      state.sellers =
        data.sellers;

      state.apiConnected = true;


      saveCache(
        CACHE_KEYS.sellers,
        state.sellers
      );


      renderSellerOptions();

    }

  } catch (error) {

    console.warn(
      "Seller loading failed:",
      error
    );

  }

}


/* =========================================================
   OFFERS
========================================================= */

async function loadOffers() {

  if (
    state.loadingOffers
  ) {

    return;

  }


  state.loadingOffers = true;


  try {

    const data =
      await fetchJSON(
        API.offers
      );


    if (
      data &&
      Array.isArray(
        data.offers
      )
    ) {

      state.offers =
        data.offers;

      state.offersLoaded = true;

      state.apiConnected = true;


      saveCache(
        CACHE_KEYS.offers,
        state.offers
      );


      renderOffers();

    }

  } catch (error) {

    console.warn(
      "Offers loading failed:",
      error
    );

  } finally {

    state.loadingOffers = false;

  }

}


/* =========================================================
   CACHE
========================================================= */

function saveCache(key, value) {

  try {

    localStorage.setItem(
      key,
      JSON.stringify({
        savedAt:
          new Date().toISOString(),

        value
      })
    );

  } catch (error) {

    console.warn(
      "Cache save failed:",
      error
    );

  }

}


function readCache(key) {

  try {

    const raw =
      localStorage.getItem(
        key
      );


    if (!raw) {

      return null;

    }


    const parsed =
      JSON.parse(raw);


    return parsed?.value ??
      parsed;

  } catch {

    return null;

  }

}


/* =========================================================
   LOAD CACHED DATA
========================================================= */

function loadCachedData() {

  const gold =
    readCache(
      CACHE_KEYS.gold
    );


  if (gold) {

    state.gold =
      normalizeGoldResponse(
        gold
      ) || gold;

  }


  const products =
    readCache(
      CACHE_KEYS.products
    );


  if (
    products &&
    Array.isArray(
      products.products
    )
  ) {

    state.products =
      normalizeProducts(
        products.products
      );

  }

  else if (
    Array.isArray(products)
  ) {

    state.products =
      normalizeProducts(
        products
      );

  }


  const sellers =
    readCache(
      CACHE_KEYS.sellers
    );


  if (
    Array.isArray(sellers)
  ) {

    state.sellers =
      sellers;

  }


  const offers =
    readCache(
      CACHE_KEYS.offers
    );


  if (
    Array.isArray(offers)
  ) {

    state.offers =
      offers;

  }


  if (
    state.gold
  ) {

    state.goldLoaded = true;

  }


  if (
    state.products.length > 0
  ) {

    state.productsLoaded = true;

  }


  if (
    state.offers.length > 0
  ) {

    state.offersLoaded = true;

  }

}


/* =========================================================
   REFRESH ALL
========================================================= */

async function refreshAll() {

  setConnectionStatus(
    "Refreshing..."
  );


  /*
   * Reset only request flags.
   * Do NOT delete cached data.
   */

  state.loadingGold = false;

  state.loadingProducts = false;

  state.loadingOffers = false;


  await Promise.allSettled([

    loadHealth(),

    loadGold(),

    loadProducts(),

    loadSellers(),

    loadOffers()

  ]);


  renderAll();

  updateConnectionStatus();

}


/* =========================================================
   CONNECTION STATUS
========================================================= */

function updateConnectionStatus() {

  /*
   * Any successful API response means
   * Worker is reachable.
   */

  if (
    state.goldLoaded ||
    state.productsLoaded ||
    state.offersLoaded ||
    state.healthLoaded ||
    state.apiConnected
  ) {

    setConnectionStatus(
      "Connected"
    );

    return;

  }


  /*
   * Cached data means app still has
   * usable data even if Worker is down.
   */

  if (
    state.gold ||
    state.products.length > 0 ||
    state.offers.length > 0
  ) {

    setConnectionStatus(
      "Connected • Cached"
    );

    return;

  }


  setConnectionStatus(
    "Worker unavailable"
  );

}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  populatePurityOptions();

  populateWeightOptions();

  renderGold();

  renderSellerOptions();

  renderProducts();

  renderOffers();

  updateLastRefresh();

}


/* =========================================================
   GOLD RENDER
========================================================= */

function renderGold() {

  if (
    !state.gold
  ) {

    return;

  }


  const rates =
    state.gold.rates || {};


  const rate24 =
    number(
      rates["24K"]
    );


  const rate22 =
    number(
      rates["22K"]
    );


  const rate18 =
    number(
      rates["18K"]
    );


  setText(
    [
      "#gold24",
      "#price24",
      "[data-gold='24K']"
    ],
    formatINR(rate24)
  );


  setText(
    [
      "#gold22",
      "#price22",
      "[data-gold='22K']"
    ],
    formatINR(rate22)
  );


  setText(
    [
      "#gold18",
      "#price18",
      "[data-gold='18K']"
    ],
    formatINR(rate18)
  );


  replaceGoldLoading(
    "24K",
    rate24
  );


  replaceGoldLoading(
    "22K",
    rate22
  );


  replaceGoldLoading(
    "18K",
    rate18
  );


  setText(
    [
      "#goldSource",
      "#gold-source",
      "[data-role='gold-source']"
    ],
    state.gold.source ||
    "SnapData"
  );


  setText(
    [
      "#goldUpdated",
      "#gold-updated",
      "[data-role='gold-updated']"
    ],
    formatDate(
      state.gold.timestamp ||
      state.gold.date
    )
  );


  /*
   * Additional common selectors.
   */

  setText(
    [
      "#gold24Price",
      "[data-gold-price='24K']"
    ],
    formatINR(rate24)
  );


  setText(
    [
      "#gold22Price",
      "[data-gold-price='22K']"
    ],
    formatINR(rate22)
  );


  setText(
    [
      "#gold18Price",
      "[data-gold-price='18K']"
    ],
    formatINR(rate18)
  );

}


/* =========================================================
   REPLACE GOLD LOADING TEXT
========================================================= */

function replaceGoldLoading(
  purity,
  value
) {

  if (
    !value
  ) {

    return;

  }


  $all("body *")
    .forEach(element => {

      if (
        element.children.length > 0
      ) {

        return;

      }


      const text =
        String(
          element.textContent || ""
        ).trim();


      if (
        !/^Loading\.\.\.$/i.test(text)
      ) {

        return;

      }


      const parentText =
        String(
          element.parentElement
            ?.textContent || ""
        )
          .toLowerCase();


      if (
        parentText.includes(
          purity.toLowerCase()
        )
      ) {

        element.textContent =
          formatINR(value);

      }

    });

}


/* =========================================================
   GOLD ERROR
========================================================= */

function renderGoldError(message) {

  /*
   * Never overwrite valid cached/current gold.
   */

  if (
    state.gold
  ) {

    renderGold();

    return;

  }


  $all("body *")
    .forEach(element => {

      if (
        element.children.length > 0
      ) {

        return;

      }


      if (
        element.textContent
          .trim() === "Loading..."
      ) {

        element.textContent =
          message;

      }

    });

}


/* =========================================================
   SELLER OPTIONS
========================================================= */

function renderSellerOptions() {

  const select =
    findSelect([
      "#seller",
      "#sellerSelect",
      "#seller-filter",
      "[name='seller']"
    ]);


  if (!select) {

    return;

  }


  const current =
    state.selectedSeller;


  select.innerHTML = `
    <option value="">All Sellers</option>
  `;


  const map =
    new Map();


  state.sellers.forEach(
    seller => {

      if (!seller) {

        return;

      }


      const id =
        String(
          seller.id ||
          seller.sellerId ||
          seller.slug ||
          ""
        );


      const name =
        seller.name ||
        seller.seller ||
        id;


      if (id) {

        map.set(
          id,
          name
        );

      }

    }
  );


  state.products.forEach(
    product => {

      if (
        product.sellerId
      ) {

        map.set(
          product.sellerId,
          product.seller ||
          product.sellerId
        );

      }

    }
  );


  Array.from(
    map.entries()
  )
    .sort(
      (a, b) =>
        String(a[1])
          .localeCompare(
            String(b[1])
          )
    )
    .forEach(
      ([id, name]) => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          id;


        option.textContent =
          name;


        select.appendChild(
          option
        );

      }
    );


  select.value =
    current || "";

}


/* =========================================================
   PRODUCT FILTER
========================================================= */

function getFilteredProducts() {

  let products =
    [...state.products];


  if (
    state.selectedPurity
  ) {

    products =
      products.filter(
        product =>
          String(
            product.purity || ""
          )
            .toUpperCase() ===
          String(
            state.selectedPurity
          )
            .toUpperCase()
      );

  }


  if (
    state.selectedWeight
  ) {

    const wanted =
      Number(
        state.selectedWeight
      );


    if (
      Number.isFinite(wanted)
    ) {

      products =
        products.filter(
          product =>
            Math.abs(
              Number(
                product.weight
              ) -
              wanted
            ) < 0.0001
        );

    }

  }


  if (
    state.selectedSeller
  ) {

    products =
      products.filter(
        product =>
          String(
            product.sellerId
          )
            .toLowerCase() ===
          String(
            state.selectedSeller
          )
            .toLowerCase()
      );

  }


  products.sort(
    (a, b) =>
      Number(
        a.listedPrice
      ) -
      Number(
        b.listedPrice
      )
  );


  return products;

}


/* =========================================================
   PRODUCT RENDER
========================================================= */

function renderProducts() {

  const products =
    getFilteredProducts();


  updateProductCount(
    products.length
  );


  const tableBody =
    findProductTableBody();


  if (tableBody) {

    if (
      products.length === 0
    ) {

      tableBody.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="gms-empty"
          >
            🪙 No matching gold coins found.
          </td>
        </tr>
      `;

    }

    else {

      tableBody.innerHTML =
        products
          .map(
            product =>
              productRow(
                product,
                products
              )
          )
          .join("");

    }

    return;

  }


  const container =
    findProductContainer();


  if (!container) {

    return;

  }


  if (
    products.length === 0
  ) {

    container.innerHTML = `
      <div class="gms-empty">
        🪙 No matching gold coins found.
      </div>
    `;

    return;

  }


  container.innerHTML =
    products
      .map(
        product =>
          productCard(
            product,
            products
          )
      )
      .join("");

}


/* =========================================================
   FIND PRODUCT TABLE
========================================================= */

function findProductTableBody() {

  const selectors = [

    "#productsTableBody",

    "#productTableBody",

    "#comparisonBody",

    "#products-body",

    "table tbody"

  ];


  for (
    const selector of selectors
  ) {

    const element =
      $(selector);


    if (element) {

      return element;

    }

  }


  return null;

}


/* =========================================================
   PRODUCT CONTAINER
========================================================= */

function findProductContainer() {

  const selectors = [

    "#products",

    "#productList",

    "#productsGrid",

    "#comparison",

    "#comparisonResults",

    ".product-grid",

    ".products-grid"

  ];


  for (
    const selector of selectors
  ) {

    const element =
      $(selector);


    if (element) {

      return element;

    }

  }


  return null;

}


/* =========================================================
   PRODUCT ROW
========================================================= */

function productRow(
  product,
  allProducts
) {

  const cheapest =
    isCheapest(
      product,
      allProducts
    );


  const offer =
    getOfferSummary(
      product
    );


  return `
    <tr
      class="${cheapest ? "gms-cheapest" : ""}"
    >

      <td>

        <strong>
          ${safeText(
            product.seller
          )}
        </strong>

        ${
          cheapest
            ? `
              <span class="gms-best-price">
                LOWEST PRICE
              </span>
            `
            : ""
        }

      </td>


      <td>

        <strong>
          ${safeText(
            product.productName
          )}
        </strong>

      </td>


      <td>
        ${safeText(
          product.purity || "-"
        )}
      </td>


      <td>
        ${formatWeight(
          product.weight
        )}
      </td>


      <td>

        <strong class="gms-price">
          ${formatINR(
            product.listedPrice
          )}
        </strong>

        ${
          product.mrp >
          product.listedPrice
            ? `
              <small class="gms-mrp">
                MRP
                ${formatINR(
                  product.mrp
                )}
              </small>
            `
            : ""
        }

      </td>


      <td>

        ${
          offer
            ? `
              <div class="gms-offer">
                ${safeText(
                  offer
                )}
              </div>
            `
            : `
              <span class="gms-no-offer">
                —
              </span>
            `
        }

      </td>


      <td>

        <a
          class="gms-product-link"
          href="${safeText(
            product.productUrl
          )}"
          target="_blank"
          rel="noopener noreferrer"
        >
          View Product
        </a>

      </td>

    </tr>
  `;

}


/* =========================================================
   PRODUCT CARD
========================================================= */

function productCard(
  product,
  allProducts
) {

  const cheapest =
    isCheapest(
      product,
      allProducts
    );


  const offer =
    getOfferSummary(
      product
    );


  return `
    <article
      class="gms-product-card
      ${cheapest ? "gms-cheapest" : ""}"
    >

      ${
        cheapest
          ? `
            <div class="gms-best-price">
              LOWEST PRICE
            </div>
          `
          : ""
      }


      <div class="gms-seller">
        ${safeText(
          product.seller
        )}
      </div>


      <h3>
        ${safeText(
          product.productName
        )}
      </h3>


      <div>
        ${safeText(
          product.purity
        )}
        ·
        ${formatWeight(
          product.weight
        )}
      </div>


      <div class="gms-price">
        ${formatINR(
          product.listedPrice
        )}
      </div>


      ${
        offer
          ? `
            <div class="gms-offer">
              ${safeText(
                offer
              )}
            </div>
          `
          : ""
      }


      <a
        class="gms-product-link"
        href="${safeText(
          product.productUrl
        )}"
        target="_blank"
        rel="noopener noreferrer"
      >
        View Exact Product
      </a>

    </article>
  `;

}


/* =========================================================
   CHEAPEST
========================================================= */

function isCheapest(
  product,
  products
) {

  const sameVariant =
    products.filter(
      item =>
        item.purity ===
          product.purity &&
        Number(
          item.weight
        ) ===
        Number(
          product.weight
        )
    );


  if (
    sameVariant.length <= 1
  ) {

    return false;

  }


  const minimum =
    Math.min(
      ...sameVariant.map(
        item =>
          Number(
            item.listedPrice
          )
      )
    );


  return (
    Number(
      product.listedPrice
    ) === minimum
  );

}


/* =========================================================
   OFFER SUMMARY
========================================================= */

function getOfferSummary(
  product
) {

  if (!product) {

    return "";

  }


  const parts = [];


  if (
    number(
      product.coupon
    ) > 0
  ) {

    parts.push(
      `Coupon ${formatINR(
        product.coupon
      )}`
    );

  }


  if (
    number(
      product.cardOffer
    ) > 0
  ) {

    parts.push(
      `Card ${formatINR(
        product.cardOffer
      )}`
    );

  }


  if (
    number(
      product.upiOffer
    ) > 0
  ) {

    parts.push(
      `UPI ${formatINR(
        product.upiOffer
      )}`
    );

  }


  if (
    number(
      product.cashback
    ) > 0
  ) {

    parts.push(
      `Cashback ${formatINR(
        product.cashback
      )}`
    );

  }


  if (
    product.voucher
  ) {

    parts.push(
      `Voucher: ${product.voucher}`
    );

  }


  if (
    product.promoCode
  ) {

    parts.push(
      `Promo: ${product.promoCode}`
    );

  }


  if (
    product.offerText
  ) {

    parts.push(
      product.offerText
    );

  }


  return parts.join(
    " · "
  );

}


/* =========================================================
   OFFERS RENDER
========================================================= */

function renderOffers() {

  const container =
    findOffersContainer();


  if (!container) {

    return;

  }


  let offers =
    Array.isArray(
      state.offers
    )
      ? state.offers
      : [];


  if (
    offers.length === 0
  ) {

    offers =
      state.products.filter(
        product =>
          Boolean(
            getOfferSummary(
              product
            )
          )
      );

  }


  if (
    offers.length === 0
  ) {

    container.innerHTML = `
      <div class="gms-empty">
        🎁 No offers found.
      </div>
    `;

    return;

  }


  container.innerHTML =
    offers
      .map(
        offer => {

          const text =
            getOfferSummary(
              offer
            );


          return `
            <div class="gms-offer-card">

              <strong>
                ${safeText(
                  offer.seller ||
                  "Seller"
                )}
              </strong>


              ${
                offer.productName
                  ? `
                    <div>
                      ${safeText(
                        offer.productName
                      )}
                    </div>
                  `
                  : ""
              }


              <div class="gms-offer">
                ${safeText(
                  text
                )}
              </div>


              ${
                offer.productUrl
                  ? `
                    <a
                      href="${safeText(
                        offer.productUrl
                      )}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Product
                    </a>
                  `
                  : ""
              }

            </div>
          `;

        }
      )
      .join("");

}


/* =========================================================
   OFFER CONTAINER
========================================================= */

function findOffersContainer() {

  const selectors = [

    "#offers",

    "#offersList",

    "#offerList",

    "#deals",

    "#offersContainer",

    ".offers-grid",

    ".offers-list"

  ];


  for (
    const selector of selectors
  ) {

    const element =
      $(selector);


    if (element) {

      return element;

    }

  }


  const headings =
    $all(
      "h1,h2,h3"
    );


  const heading =
    headings.find(
      h =>
        String(
          h.textContent || ""
        )
          .toLowerCase()
          .includes(
            "offers & deals"
          )
    );


  if (heading) {

    return (
      heading.closest(
        "section"
      ) ||
      heading.parentElement
    );

  }


  return null;

}


/* =========================================================
   PRODUCT COUNT
========================================================= */

function updateProductCount(
  count
) {

  const selectors = [

    "#productCount",

    "#productsCount",

    "#comparisonCount",

    "[data-product-count]"

  ];


  let updated = false;


  selectors.forEach(
    selector => {

      const element =
        $(selector);


      if (element) {

        element.textContent =
          `${count} products`;

        updated = true;

      }

    }
  );


  if (!updated) {

    $all("body *")
      .forEach(element => {

        if (
          element.children.length !== 0
        ) {

          return;

        }


        const text =
          String(
            element.textContent || ""
          ).trim();


        if (
          /^\d+\s+products?$/i
            .test(text)
        ) {

          element.textContent =
            `${count} products`;

        }

      });

  }

}


/* =========================================================
   PRODUCT ERROR
========================================================= */

function renderProductsError(
  message
) {

  const tbody =
    findProductTableBody();


  if (tbody) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="gms-empty"
        >
          ${safeText(
            message
          )}
        </td>
      </tr>
    `;

    return;

  }


  const container =
    findProductContainer();


  if (container) {

    container.innerHTML = `
      <div class="gms-empty">
        ${safeText(
          message
        )}
      </div>
    `;

  }

}


/* =========================================================
   CONNECTION STATUS
========================================================= */

function setConnectionStatus(
  text
) {

  const selectors = [

    "#connectionStatus",

    "#status",

    "[data-connection-status]",

    ".connection-status"

  ];


  let found = false;


  selectors.forEach(
    selector => {

      const element =
        $(selector);


      if (element) {

        element.textContent =
          text;

        found = true;

      }

    }
  );


  if (!found) {

    $all("body *")
      .forEach(element => {

        if (
          element.children.length === 0 &&
          (
            element.textContent
              .trim() ===
              "Connecting..." ||

            element.textContent
              .trim() ===
              "Worker unavailable"
          )
        ) {

          element.textContent =
            text;

        }

      });

  }

}


/* =========================================================
   LAST UPDATE
========================================================= */

function updateLastRefresh() {

  const date =
    state.lastProductUpdate ||
    state.lastGoldUpdate ||
    state.lastHealthUpdate;


  if (!date) {

    return;

  }


  const formatted =
    formatDate(date);


  setText(
    [
      "#lastRefresh",
      "#lastUpdated",
      "[data-last-refresh]"
    ],
    formatted
  );

}


/* =========================================================
   SET TEXT
========================================================= */

function setText(
  selectors,
  value
) {

  selectors.forEach(
    selector => {

      const element =
        $(selector);


      if (element) {

        element.textContent =
          value;

      }

    }
  );

}


/* =========================================================
   NUMBER
========================================================= */

function number(value) {

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


  const parsed =
    Number(
      String(value)
        .replace(/₹/g, "")
        .replace(/,/g, "")
        .replace(/INR/gi, "")
        .trim()
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;

}


/* =========================================================
   CURRENCY
========================================================= */

function formatINR(value) {

  const amount =
    number(value);


  if (
    !amount
  ) {

    return "₹ —";

  }


  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",

      currency: "INR",

      maximumFractionDigits: 2
    }
  ).format(amount);

}


/* =========================================================
   WEIGHT
========================================================= */

function formatWeight(value) {

  const weight =
    number(value);


  if (!weight) {

    return "—";

  }


  return `${weight} g`;

}


/* =========================================================
   DATE
========================================================= */

function formatDate(value) {

  if (!value) {

    return "—";

  }


  const date =
    value instanceof Date
      ? value
      : new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(value);

  }


  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",

      month: "short",

      year: "numeric",

      hour: "2-digit",

      minute: "2-digit"
    }
  );

}


/* =========================================================
   PURITY
========================================================= */

function normalizePurity(value) {

  const text =
    String(
      value || ""
    )
      .toUpperCase()
      .replace(/\s/g, "");


  if (
    text.includes("24") ||
    text.includes("999") ||
    text.includes("995")
  ) {

    return "24K";

  }


  if (
    text.includes("22") ||
    text.includes("916")
  ) {

    return "22K";

  }


  if (
    text.includes("18") ||
    text.includes("750")
  ) {

    return "18K";

  }


  return String(
    value || ""
  );

}


/* =========================================================
   PRODUCT NAME
========================================================= */

function cleanProductName(value) {

  return String(
    value || ""
  )
    .replace(
      /\b(TRY AT HOME|TRY VIDEO CALL|VIEW SIMILAR|CHECK DELIVERY DATE)\b/gi,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(
      0,
      180
    );

}


/* =========================================================
   PRODUCT URL
========================================================= */

function normalizeProductUrl(value) {

  if (!value) {

    return "";

  }


  const text =
    String(value)
      .trim();


  if (
    !/^https?:\/\//i.test(text)
  ) {

    return "";

  }


  /*
   * IMPORTANT:
   *
   * Exact product URL is preserved.
   *
   * No category conversion.
   * No query parameter removal.
   */

  return text;

}


/* =========================================================
   PURITY OPTIONS
========================================================= */

function populatePurityOptions() {

  const select =
    findSelect([
      "#purity",
      "#puritySelect",
      "#purity-filter",
      "[name='purity']"
    ]);


  if (!select) {

    return;

  }


  const current =
    state.selectedPurity;


  select.innerHTML = `
    <option value="">
      All Purity
    </option>

    <option value="24K">
      24K
    </option>

    <option value="22K">
      22K
    </option>

    <option value="18K">
      18K
    </option>
  `;


  select.value =
    current || "";

}


/* =========================================================
   WEIGHT OPTIONS
========================================================= */

function populateWeightOptions() {

  const select =
    findSelect([
      "#weight",
      "#weightSelect",
      "#weight-filter",
      "[name='weight']"
    ]);


  if (!select) {

    return;

  }


  const current =
    state.selectedWeight;


  const weights =
    Array.from(
      new Set(
        state.products
          .map(
            product =>
              number(
                product.weight
              )
          )
          .filter(
            weight =>
              weight > 0
          )
      )
    )
    .sort(
      (a, b) =>
        a - b
    );


  select.innerHTML = `
    <option value="">
      All Weights
    </option>
  `;


  weights.forEach(
    weight => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        String(weight);


      option.textContent =
        `${weight} g`;


      select.appendChild(
        option
      );

    }
  );


  select.value =
    current || "";

}


/* =========================================================
   GLOBAL DEBUG
========================================================= */

window.GoldManiaSavings = {

  state,

  API,

  refresh:
    refreshAll,

  reloadHealth:
    loadHealth,

  reloadGold:
    loadGold,

  reloadProducts:
    loadProducts,

  reloadSellers:
    loadSellers,

  reloadOffers:
    loadOffers,

  clearCache() {

    Object.values(
      CACHE_KEYS
    ).forEach(
      key => {

        try {

          localStorage.removeItem(
            key
          );

        } catch {}

      }
    );


    location.reload();

  }

};


/* =========================================================
   END
========================================================= */

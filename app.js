/* =========================================================
   GoldManiaSavings
   FINAL app.js
   Frontend controller for index.html + style.css

   Backend:
   https://goldmaniasavings-api.onlinetechmine.workers.dev

   IMPORTANT:
   This frontend does NOT scrape seller websites directly.
   The Cloudflare Worker is responsible for fetching /
   normalising / caching seller data.

   Expected endpoints:
   /api/health
   /api/gold
   /api/sellers
   /api/products
   /api/offers
   /api/history
========================================================= */

"use strict";

/* =========================================================
   CONFIG
========================================================= */

const CONFIG = {
  API_BASE:
    "https://goldmaniasavings-api.onlinetechmine.workers.dev",

  REQUEST_TIMEOUT:
    20000,

  GOLD_REFRESH_MS:
    5 * 60 * 1000,

  PRODUCT_REFRESH_MS:
    10 * 60 * 1000,

  MAX_PRODUCTS:
    1000
};


/* =========================================================
   STATE
========================================================= */

const state = {
  gold: null,

  products: [],

  sellers: [],

  offers: [],

  history: [],

  selectedPurity: "ALL",

  selectedSeller: "ALL",

  selectedWeight: "ALL",

  sortBy: "price-asc",

  loadingGold: false,

  loadingProducts: false,

  loadingOffers: false,

  lastGoldUpdate: null,

  lastProductUpdate: null,

  apiOnline: false
};


/* =========================================================
   DOM HELPERS
========================================================= */

function $(selector, root = document) {
  return root.querySelector(selector);
}


function $all(selector, root = document) {
  return Array.from(
    root.querySelectorAll(selector)
  );
}


function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   NUMBER HELPERS
========================================================= */

function number(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const cleaned =
    String(value)
      .replace(/[₹,\s]/g, "");

  const match =
    cleaned.match(
      /-?\d+(?:\.\d+)?/
    );

  if (!match) {
    return 0;
  }

  const result =
    Number(match[0]);

  return Number.isFinite(result)
    ? result
    : 0;
}


function formatINR(value) {
  const amount = number(value);

  if (!amount) {
    return "₹—";
  }

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }
  ).format(amount);
}


function formatNumber(value) {
  const amount = number(value);

  if (!amount) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-IN",
    {
      maximumFractionDigits: 2
    }
  ).format(amount);
}


/* =========================================================
   API
========================================================= */

async function apiFetch(
  path,
  options = {}
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      CONFIG.REQUEST_TIMEOUT
    );

  try {
    const separator =
      path.includes("?")
        ? "&"
        : "?";

    const url =
      `${CONFIG.API_BASE}${path}${separator}_=${Date.now()}`;

    const response =
      await fetch(
        url,
        {
          ...options,
          signal:
            controller.signal,

          headers: {
            Accept:
              "application/json",

            ...(options.headers || {})
          },

          cache:
            "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    return data;

  } finally {
    clearTimeout(timeout);
  }
}


/* =========================================================
   HEALTH
========================================================= */

async function checkAPI() {
  try {
    const data =
      await apiFetch(
        "/api/health"
      );

    state.apiOnline =
      data?.ok === true;

    setConnectionStatus(
      true
    );

    return true;

  } catch (error) {

    console.error(
      "API health check failed:",
      error
    );

    state.apiOnline =
      false;

    setConnectionStatus(
      false
    );

    return false;
  }
}


/* =========================================================
   CONNECTION STATUS
========================================================= */

function setConnectionStatus(
  online
) {

  const elements = [
    "#apiStatus",
    "#connectionStatus",
    "[data-api-status]"
  ];

  for (
    const selector of elements
  ) {

    const element =
      $(selector);

    if (!element) {
      continue;
    }

    element.textContent =
      online
        ? "Live"
        : "Offline";

    element.classList.toggle(
      "online",
      online
    );

    element.classList.toggle(
      "offline",
      !online
    );
  }
}


/* =========================================================
   GOLD PRICE
========================================================= */

async function loadGoldPrice() {

  if (state.loadingGold) {
    return;
  }

  state.loadingGold = true;

  setGoldLoading(
    true
  );

  try {

    const data =
      await apiFetch(
        "/api/gold"
      );

    if (!data?.ok) {
      throw new Error(
        data?.message ||
        "Gold price unavailable"
      );
    }

    state.gold =
      data;

    state.lastGoldUpdate =
      data.timestamp ||
      new Date().toISOString();

    state.apiOnline =
      true;

    setConnectionStatus(
      true
    );

    renderGoldPrice();

  } catch (error) {

    console.error(
      "Gold price load failed:",
      error
    );

    renderGoldError(
      error.message
    );

  } finally {

    state.loadingGold =
      false;

    setGoldLoading(
      false
    );
  }
}


/* =========================================================
   GOLD PRICE EXTRACTION
========================================================= */

function getGoldRate(
  purity
) {

  const gold =
    state.gold;

  if (!gold) {
    return 0;
  }


  /*
   * Preferred source:
   * indiaReference.rates
   */

  const india =
    gold.indiaReference?.rates;

  if (
    india &&
    india[purity]
  ) {

    return number(
      india[purity].perGram
    );

  }


  /*
   * Fallback:
   * internationalSpot.rates
   */

  const international =
    gold.internationalSpot?.rates;

  if (
    international &&
    international[purity]
  ) {

    return number(
      international[purity].perGram
    );

  }


  return 0;
}


/* =========================================================
   RENDER GOLD
========================================================= */

function renderGoldPrice() {

  const rates = {
    "24K":
      getGoldRate("24K"),

    "22K":
      getGoldRate("22K"),

    "18K":
      getGoldRate("18K")
  };


  /*
   * Support multiple possible
   * index.html IDs.
   */

  setText(
    "#gold24",
    formatINR(
      rates["24K"]
    )
  );

  setText(
    "#gold22",
    formatINR(
      rates["22K"]
    )
  );

  setText(
    "#gold18",
    formatINR(
      rates["18K"]
    )
  );


  setText(
    "#gold24Price",
    formatINR(
      rates["24K"]
    )
  );

  setText(
    "#gold22Price",
    formatINR(
      rates["22K"]
    )
  );

  setText(
    "#gold18Price",
    formatINR(
      rates["18K"]
    )
  );


  setText(
    "[data-gold-24]",
    formatINR(
      rates["24K"]
    )
  );

  setText(
    "[data-gold-22]",
    formatINR(
      rates["22K"]
    )
  );

  setText(
    "[data-gold-18]",
    formatINR(
      rates["18K"]
    )
  );


  const source =
    state.gold?.indiaReference?.source ||
    state.gold?.internationalSpot?.source ||
    "Gold reference";


  setText(
    "#goldSource",
    source
  );

  setText(
    "[data-gold-source]",
    source
  );


  const date =
    state.gold?.indiaReference?.date ||
    state.gold?.timestamp ||
    "";


  if (date) {

    const formatted =
      formatDateTime(
        date
      );

    setText(
      "#goldUpdated",
      formatted
    );

    setText(
      "[data-gold-updated]",
      formatted
    );

  }
}


/* =========================================================
   GOLD ERROR
========================================================= */

function renderGoldError(
  message
) {

  const fallback =
    "Unavailable";

  [
    "#gold24",
    "#gold22",
    "#gold18",
    "#gold24Price",
    "#gold22Price",
    "#gold18Price"
  ].forEach(
    selector =>
      setText(
        selector,
        fallback
      )
  );


  [
    "[data-gold-24]",
    "[data-gold-22]",
    "[data-gold-18]"
  ].forEach(
    selector =>
      setText(
        selector,
        fallback
      )
  );


  setText(
    "#goldSource",
    "Price temporarily unavailable"
  );

  setText(
    "[data-gold-source]",
    "Price temporarily unavailable"
  );
}


/* =========================================================
   GOLD LOADING
========================================================= */

function setGoldLoading(
  loading
) {

  if (!loading) {
    return;
  }

  [
    "#gold24",
    "#gold22",
    "#gold18",
    "#gold24Price",
    "#gold22Price",
    "#gold18Price"
  ].forEach(
    selector => {

      const element =
        $(selector);

      if (
        element &&
        (
          element.textContent.trim() === "" ||
          element.textContent.includes("Unavailable")
        )
      ) {

        element.textContent =
          "Loading...";

      }

    }
  );
}


/* =========================================================
   PRODUCTS
========================================================= */

async function loadProducts() {

  if (state.loadingProducts) {
    return;
  }

  state.loadingProducts =
    true;

  renderProductsLoading();

  try {

    const data =
      await apiFetch(
        "/api/products"
      );

    if (!data?.ok) {
      throw new Error(
        data?.message ||
        "Products unavailable"
      );
    }

    const products =
      Array.isArray(
        data.products
      )
        ? data.products
        : [];


    state.products =
      products
        .map(
          normaliseProduct
        )
        .filter(
          product =>
            product.productUrl ||
            product.productName
        )
        .slice(
          0,
          CONFIG.MAX_PRODUCTS
        );


    state.lastProductUpdate =
      data.updatedAt ||
      new Date().toISOString();


    state.apiOnline =
      true;

    setConnectionStatus(
      true
    );


    populateSellerFilter();

    populateWeightFilter();

    renderComparison();

  } catch (error) {

    console.error(
      "Product load failed:",
      error
    );

    state.products =
      [];

    renderProductsError(
      error.message
    );

  } finally {

    state.loadingProducts =
      false;
  }
}


/* =========================================================
   NORMALISE PRODUCT
========================================================= */

function normaliseProduct(
  product
) {

  const purity =
    normalisePurity(
      product?.purity
    );


  const weight =
    number(
      product?.weight
    );


  const price =
    number(
      product?.listedPrice ??
      product?.price
    );


  const mrp =
    number(
      product?.mrp
    );


  return {

    ...product,

    id:
      String(
        product?.id ||
        ""
      ),

    sellerId:
      String(
        product?.sellerId ||
        ""
      )
        .toLowerCase(),

    seller:
      String(
        product?.seller ||
        product?.sellerName ||
        product?.sellerId ||
        "Seller"
      ),

    productName:
      cleanProductName(
        product?.productName ||
        product?.name ||
        "Gold Coin"
      ),

    purity,

    weight,

    listedPrice:
      price,

    mrp,

    coupon:
      number(
        product?.coupon
      ),

    cardOffer:
      number(
        product?.cardOffer
      ),

    upiOffer:
      number(
        product?.upiOffer
      ),

    cashback:
      number(
        product?.cashback
      ),

    voucher:
      String(
        product?.voucher ||
        ""
      ).trim(),

    promoCode:
      String(
        product?.promoCode ||
        ""
      ).trim(),

    offerText:
      String(
        product?.offerText ||
        ""
      ).trim(),

    productUrl:
      safeProductURL(
        product?.productUrl ||
        product?.url
      )
  };
}


/* =========================================================
   PURITY
========================================================= */

function normalisePurity(
  value
) {

  const text =
    String(
      value || ""
    )
      .toUpperCase()
      .replace(/\s+/g, "");


  if (
    text.includes("24") ||
    text.includes("999")
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


  return "";
}


/* =========================================================
   PRODUCT NAME
========================================================= */

function cleanProductName(
  value
) {

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
   SAFE PRODUCT URL
========================================================= */

function safeProductURL(
  value
) {

  if (!value) {
    return "";
  }

  try {

    const url =
      new URL(
        String(value),
        window.location.href
      );

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return "";
    }

    /*
     * IMPORTANT:
     * Do NOT replace exact seller URL.
     * Tracking parameters are deliberately
     * preserved because some sellers use
     * them for browse/product routing.
     */

    return url.href;

  } catch {

    return "";
  }
}


/* =========================================================
   SELLERS
========================================================= */

async function loadSellers() {

  try {

    const data =
      await apiFetch(
        "/api/sellers"
      );

    if (
      data?.ok &&
      Array.isArray(
        data.sellers
      )
    ) {

      state.sellers =
        data.sellers;

      populateSellerFilter();

    }

  } catch (error) {

    console.warn(
      "Seller list unavailable:",
      error
    );

    /*
     * Build seller list from products
     * as a fallback.
     */

    state.sellers =
      buildSellerListFromProducts();

    populateSellerFilter();
  }
}


/* =========================================================
   SELLER FALLBACK
========================================================= */

function buildSellerListFromProducts() {

  const map =
    new Map();

  for (
    const product of state.products
  ) {

    if (
      !product.sellerId
    ) {
      continue;
    }

    if (
      !map.has(
        product.sellerId
      )
    ) {

      map.set(
        product.sellerId,
        {
          id:
            product.sellerId,

          name:
            product.seller,

          enabled:
            true
        }
      );

    }

  }

  return Array.from(
    map.values()
  );
}


/* =========================================================
   FILTER SELLER
========================================================= */

function populateSellerFilter() {

  const selects =
    [
      "#sellerFilter",
      "#sellerSelect"
    ];


  const sellers =
    state.sellers.length
      ? state.sellers
      : buildSellerListFromProducts();


  for (
    const selector of selects
  ) {

    const select =
      $(selector);

    if (!select) {
      continue;
    }


    const current =
      state.selectedSeller;


    select.innerHTML =
      `<option value="ALL">All Sellers</option>`;


    sellers
      .filter(
        seller =>
          seller.enabled !== false
      )
      .sort(
        (a, b) =>
          String(a.name)
            .localeCompare(
              String(b.name)
            )
      )
      .forEach(
        seller => {

          const option =
            document.createElement(
              "option"
            );

          option.value =
            seller.id;

          option.textContent =
            seller.name;

          select.appendChild(
            option
          );

        }
      );


    select.value =
      current;
  }
}


/* =========================================================
   WEIGHT FILTER
========================================================= */

function populateWeightFilter() {

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


  const selectors =
    [
      "#weightFilter",
      "#weightSelect"
    ];


  for (
    const selector of selectors
  ) {

    const select =
      $(selector);

    if (!select) {
      continue;
    }


    select.innerHTML =
      `<option value="ALL">All Weights</option>`;


    for (
      const weight of weights
    ) {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        String(weight);

      option.textContent =
        `${formatNumber(weight)} g`;

      select.appendChild(
        option
      );

    }


    select.value =
      state.selectedWeight;
  }
}


/* =========================================================
   PURITY FILTER
========================================================= */

function setPurity(
  purity
) {

  state.selectedPurity =
    normaliseFilterValue(
      purity
    );

  updatePurityButtons();

  renderComparison();
}


function normaliseFilterValue(
  value
) {

  const text =
    String(
      value || ""
    ).toUpperCase();

  if (
    text === "24K" ||
    text === "22K" ||
    text === "18K"
  ) {
    return text;
  }

  return "ALL";
}


/* =========================================================
   PURITY BUTTONS
========================================================= */

function updatePurityButtons() {

  const buttons =
    $all(
      "[data-purity]"
    );


  for (
    const button of buttons
  ) {

    const value =
      normaliseFilterValue(
        button.dataset.purity
      );

    const active =
      value ===
      state.selectedPurity;


    button.classList.toggle(
      "active",
      active
    );

    button.setAttribute(
      "aria-pressed",
      String(active)
    );

  }
}


/* =========================================================
   FILTERED PRODUCTS
========================================================= */

function getFilteredProducts() {

  let products =
    [...state.products];


  if (
    state.selectedPurity !==
    "ALL"
  ) {

    products =
      products.filter(
        product =>
          product.purity ===
          state.selectedPurity
      );

  }


  if (
    state.selectedSeller !==
    "ALL"
  ) {

    products =
      products.filter(
        product =>
          product.sellerId ===
          state.selectedSeller
      );

  }


  if (
    state.selectedWeight !==
    "ALL"
  ) {

    const target =
      number(
        state.selectedWeight
      );

    products =
      products.filter(
        product =>
          number(
            product.weight
          ) === target
      );

  }


  return sortProducts(
    products
  );
}


/* =========================================================
   SORT
========================================================= */

function sortProducts(
  products
) {

  const list =
    [...products];


  switch (
    state.sortBy
  ) {

    case "price-desc":

      list.sort(
        (a, b) =>
          number(b.listedPrice) -
          number(a.listedPrice)
      );

      break;


    case "seller":

      list.sort(
        (a, b) =>
          a.seller.localeCompare(
            b.seller
          )
      );

      break;


    case "weight":

      list.sort(
        (a, b) =>
          number(a.weight) -
          number(b.weight)
      );

      break;


    case "price-asc":

    default:

      list.sort(
        (a, b) =>
          number(a.listedPrice) -
          number(b.listedPrice)
      );

      break;

  }


  return list;
}


/* =========================================================
   COMPARISON
========================================================= */

function renderComparison() {

  const products =
    getFilteredProducts();


  updateProductCount(
    products.length
  );


  /*
   * Main containers used by common
   * versions of index.html.
   */

  const containers =
    [
      "#productsGrid",
      "#comparisonGrid",
      "#productGrid",
      "#products",
      "#comparison"
    ];


  let container = null;


  for (
    const selector of containers
  ) {

    const element =
      $(selector);

    if (element) {
      container =
        element;
      break;
    }

  }


  if (!container) {

    console.warn(
      "Product container not found."
    );

    return;
  }


  if (!products.length) {

    container.innerHTML =
      renderEmptyProducts();

    return;
  }


  /*
   * Determine cheapest product.
   */

  const validPrices =
    products
      .map(
        product =>
          number(
            product.listedPrice
          )
      )
      .filter(
        price =>
          price > 0
      );


  const lowestPrice =
    validPrices.length
      ? Math.min(
          ...validPrices
        )
      : 0;


  container.innerHTML =
    products
      .map(
        product =>
          renderProductCard(
            product,
            lowestPrice
          )
      )
      .join("");


  attachProductActions(
    container
  );
}


/* =========================================================
   PRODUCT CARD
========================================================= */

function renderProductCard(
  product,
  lowestPrice
) {

  const price =
    number(
      product.listedPrice
    );


  const isLowest =
    price > 0 &&
    price === lowestPrice;


  const offerCount =
    countOffers(
      product
    );


  const saving =
    calculateSaving(
      product
    );


  return `
    <article
      class="product-card ${isLowest ? "lowest-price" : ""}"
      data-product-id="${escapeHTML(product.id)}"
    >

      <div class="product-card-top">

        <div class="seller-badge">
          ${escapeHTML(product.seller)}
        </div>

        ${
          isLowest
            ? `
              <span class="lowest-badge">
                Lowest Price
              </span>
            `
            : ""
        }

      </div>


      <div class="product-card-body">

        <h3 class="product-name">
          ${escapeHTML(product.productName)}
        </h3>


        <div class="product-meta">

          ${
            product.purity
              ? `
                <span>
                  ${escapeHTML(product.purity)}
                </span>
              `
              : ""
          }

          ${
            product.weight
              ? `
                <span>
                  ${formatNumber(product.weight)} g
                </span>
              `
              : ""
          }

        </div>


        <div class="product-price-row">

          <div>

            <div class="product-price">
              ${
                price
                  ? formatINR(price)
                  : "Price unavailable"
              }
            </div>

            ${
              product.mrp &&
              product.mrp > price
                ? `
                  <div class="product-mrp">
                    ${formatINR(product.mrp)}
                  </div>
                `
                : ""
            }

          </div>


          ${
            saving > 0
              ? `
                <span class="saving-badge">
                  Save ${formatINR(saving)}
                </span>
              `
              : ""
          }

        </div>


        <div class="offer-summary">

          ${
            offerCount > 0
              ? `
                <span class="offer-count">
                  ${offerCount} offer${offerCount > 1 ? "s" : ""}
                </span>
              `
              : `
                <span class="no-offer">
                  No extra offer listed
                </span>
              `
          }

        </div>


        ${renderOfferDetails(product)}

      </div>


      <div class="product-card-actions">

        ${
          product.productUrl
            ? `
              <a
                class="product-link"
                href="${escapeHTML(product.productUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Exact Product
              </a>
            `
            : `
              <span class="product-link disabled">
                Product link unavailable
              </span>
            `
        }

      </div>

    </article>
  `;
}


/* =========================================================
   OFFER DETAILS
========================================================= */

function renderOfferDetails(
  product
) {

  const offers = [];


  if (
    product.coupon > 0
  ) {

    offers.push(
      `
      <div class="offer-item">
        <span>Coupon</span>
        <strong>
          ${formatINR(product.coupon)}
        </strong>
      </div>
      `
    );

  }


  if (
    product.cardOffer > 0
  ) {

    offers.push(
      `
      <div class="offer-item">
        <span>Card Offer</span>
        <strong>
          ${formatINR(product.cardOffer)}
        </strong>
      </div>
      `
    );

  }


  if (
    product.upiOffer > 0
  ) {

    offers.push(
      `
      <div class="offer-item">
        <span>UPI Offer</span>
        <strong>
          ${formatINR(product.upiOffer)}
        </strong>
      </div>
      `
    );

  }


  if (
    product.cashback > 0
  ) {

    offers.push(
      `
      <div class="offer-item">
        <span>Cashback</span>
        <strong>
          ${formatINR(product.cashback)}
        </strong>
      </div>
      `
    );

  }


  if (
    product.voucher
  ) {

    offers.push(
      `
      <div class="offer-item offer-text">
        <span>Voucher</span>
        <strong>
          ${escapeHTML(product.voucher)}
        </strong>
      </div>
      `
    );

  }


  if (
    product.promoCode
  ) {

    offers.push(
      `
      <div class="offer-item offer-text">
        <span>Promo Code</span>
        <strong>
          ${escapeHTML(product.promoCode)}
        </strong>
      </div>
      `
    );

  }


  if (
    product.offerText
  ) {

    offers.push(
      `
      <div class="offer-item offer-text">
        <span>Offer</span>
        <strong>
          ${escapeHTML(product.offerText)}
        </strong>
      </div>
      `
    );

  }


  if (!offers.length) {
    return "";
  }


  return `
    <div class="offer-list">
      ${offers.join("")}
    </div>
  `;
}


/* =========================================================
   SAVING
========================================================= */

function calculateSaving(
  product
) {

  const mrp =
    number(
      product.mrp
    );

  const price =
    number(
      product.listedPrice
    );


  if (
    mrp > price &&
    price > 0
  ) {

    return mrp - price;

  }


  return 0;
}


/* =========================================================
   COUNT OFFERS
========================================================= */

function countOffers(
  product
) {

  let count = 0;


  if (
    number(product.coupon) > 0
  ) {
    count++;
  }


  if (
    number(product.cardOffer) > 0
  ) {
    count++;
  }


  if (
    number(product.upiOffer) > 0
  ) {
    count++;
  }


  if (
    number(product.cashback) > 0
  ) {
    count++;
  }


  if (
    product.voucher
  ) {
    count++;
  }


  if (
    product.promoCode
  ) {
    count++;
  }


  if (
    product.offerText
  ) {
    count++;
  }


  return count;
}


/* =========================================================
   PRODUCTS LOADING
========================================================= */

function renderProductsLoading() {

  const container =
    getProductContainer();

  if (!container) {
    return;
  }


  container.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>
        Loading gold coins from sellers...
      </p>
    </div>
  `;
}


/* =========================================================
   PRODUCTS ERROR
========================================================= */

function renderProductsError(
  message
) {

  const container =
    getProductContainer();

  if (!container) {
    return;
  }


  container.innerHTML = `
    <div class="error-state">

      <h3>
        Products could not be loaded
      </h3>

      <p>
        ${
          escapeHTML(
            message ||
            "Please try again."
          )
        }
      </p>

      <button
        type="button"
        class="retry-button"
        data-action="retry-products"
      >
        Retry
      </button>

    </div>
  `;


  const retry =
    container.querySelector(
      '[data-action="retry-products"]'
    );


  if (retry) {

    retry.addEventListener(
      "click",
      () =>
        loadProducts()
    );

  }
}


/* =========================================================
   EMPTY
========================================================= */

function renderEmptyProducts() {

  return `
    <div class="empty-state">

      <h3>
        No matching gold coins
      </h3>

      <p>
        Try another purity, seller or weight.
      </p>

      <button
        type="button"
        data-action="clear-filters"
      >
        Clear Filters
      </button>

    </div>
  `;
}


/* =========================================================
   CONTAINER
========================================================= */

function getProductContainer() {

  const selectors =
    [
      "#productsGrid",
      "#comparisonGrid",
      "#productGrid",
      "#products",
      "#comparison"
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
   PRODUCT ACTIONS
========================================================= */

function attachProductActions(
  container
) {

  const clear =
    container.querySelector(
      '[data-action="clear-filters"]'
    );


  if (clear) {

    clear.addEventListener(
      "click",
      clearFilters
    );

  }
}


/* =========================================================
   OFFERS ENDPOINT
========================================================= */

async function loadOffers() {

  if (state.loadingOffers) {
    return;
  }

  state.loadingOffers =
    true;

  try {

    const data =
      await apiFetch(
        "/api/offers"
      );

    if (
      data?.ok &&
      Array.isArray(
        data.offers
      )
    ) {

      state.offers =
        data.offers;

      renderOffers();

    }

  } catch (error) {

    console.warn(
      "Offers endpoint failed:",
      error
    );

    /*
     * Product-level offers are still
     * rendered from /api/products.
     */

    renderOffers();

  } finally {

    state.loadingOffers =
      false;
  }
}


/* =========================================================
   OFFERS UI
========================================================= */

function renderOffers() {

  const container =
    $(
      "#offersContainer"
    ) ||
    $(
      "#offersGrid"
    ) ||
    $(
      "#offers"
    );


  if (!container) {
    return;
  }


  /*
   * If dedicated offers endpoint
   * has no results, derive from products.
   */

  let offers =
    [...state.offers];


  if (!offers.length) {

    offers =
      state.products
        .filter(
          product =>
            countOffers(product) > 0
        )
        .map(
          product => ({
            seller:
              product.seller,

            productName:
              product.productName,

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

            productUrl:
              product.productUrl
          })
        );

  }


  if (!offers.length) {

    container.innerHTML = `
      <div class="empty-state">
        No seller offers available right now.
      </div>
    `;

    return;
  }


  container.innerHTML =
    offers
      .map(
        offer => `
          <article class="offer-card">

            <div class="offer-card-seller">
              ${escapeHTML(
                offer.seller ||
                "Seller"
              )}
            </div>

            <h3>
              ${escapeHTML(
                offer.productName ||
                "Gold Coin"
              )}
            </h3>

            ${
              offer.coupon > 0
                ? `
                  <div>
                    Coupon:
                    <strong>
                      ${formatINR(offer.coupon)}
                    </strong>
                  </div>
                `
                : ""
            }

            ${
              offer.cardOffer > 0
                ? `
                  <div>
                    Card Offer:
                    <strong>
                      ${formatINR(offer.cardOffer)}
                    </strong>
                  </div>
                `
                : ""
            }

            ${
              offer.upiOffer > 0
                ? `
                  <div>
                    UPI Offer:
                    <strong>
                      ${formatINR(offer.upiOffer)}
                    </strong>
                  </div>
                `
                : ""
            }

            ${
              offer.cashback > 0
                ? `
                  <div>
                    Cashback:
                    <strong>
                      ${formatINR(offer.cashback)}
                    </strong>
                  </div>
                `
                : ""
            }

            ${
              offer.voucher
                ? `
                  <div>
                    Voucher:
                    <strong>
                      ${escapeHTML(
                        offer.voucher
                      )}
                    </strong>
                  </div>
                `
                : ""
            }

            ${
              offer.promoCode
                ? `
                  <div>
                    Promo Code:
                    <strong>
                      ${escapeHTML(
                        offer.promoCode
                      )}
                    </strong>
                  </div>
                `
                : ""
            }

            ${
              offer.offerText
                ? `
                  <div>
                    Offer:
                    <strong>
                      ${escapeHTML(
                        offer.offerText
                      )}
                    </strong>
                  </div>
                `
                : ""
            }

            ${
              offer.productUrl
                ? `
                  <a
                    href="${escapeHTML(
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

          </article>
        `
      )
      .join("");
}


/* =========================================================
   COMPARISON SUMMARY
========================================================= */

function renderComparisonSummary() {

  const products =
    getFilteredProducts();


  const valid =
    products.filter(
      product =>
        number(
          product.listedPrice
        ) > 0
    );


  if (!valid.length) {
    return;
  }


  const cheapest =
    valid.reduce(
      (current, product) =>
        number(
          product.listedPrice
        ) <
        number(
          current.listedPrice
        )
          ? product
          : current
    );


  setText(
    "#lowestPrice",
    formatINR(
      cheapest.listedPrice
    )
  );


  setText(
    "#lowestSeller",
    cheapest.seller
  );


  setText(
    "#comparisonLowestPrice",
    formatINR(
      cheapest.listedPrice
    )
  );


  setText(
    "#comparisonLowestSeller",
    cheapest.seller
  );
}


/* =========================================================
   PRODUCT COUNT
========================================================= */

function updateProductCount(
  count
) {

  [
    "#productCount",
    "#productsCount",
    "[data-product-count]"
  ].forEach(
    selector =>
      setText(
        selector,
        `${count} product${count === 1 ? "" : "s"}`
      )
  );


  renderComparisonSummary();
}


/* =========================================================
   CLEAR FILTERS
========================================================= */

function clearFilters() {

  state.selectedPurity =
    "ALL";

  state.selectedSeller =
    "ALL";

  state.selectedWeight =
    "ALL";

  state.sortBy =
    "price-asc";


  const selectors =
    [
      "#sellerFilter",
      "#sellerSelect",
      "#weightFilter",
      "#weightSelect",
      "#sortSelect",
      "#sortBy"
    ];


  selectors.forEach(
    selector => {

      const element =
        $(selector);

      if (!element) {
        return;
      }

      if (
        selector.includes("seller")
      ) {
        element.value =
          "ALL";
      } else if (
        selector.includes("weight")
      ) {
        element.value =
          "ALL";
      } else {
        element.value =
          "price-asc";
      }

    }
  );


  updatePurityButtons();

  renderComparison();
}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  /*
   * Purity buttons
   */

  $all(
    "[data-purity]"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        () =>
          setPurity(
            button.dataset.purity
          )
      );

    }
  );


  /*
   * Seller filter
   */

  [
    "#sellerFilter",
    "#sellerSelect"
  ].forEach(
    selector => {

      const element =
        $(selector);

      if (!element) {
        return;
      }

      element.addEventListener(
        "change",
        event => {

          state.selectedSeller =
            event.target.value ||
            "ALL";

          renderComparison();

        }
      );

    }
  );


  /*
   * Weight filter
   */

  [
    "#weightFilter",
    "#weightSelect"
  ].forEach(
    selector => {

      const element =
        $(selector);

      if (!element) {
        return;
      }

      element.addEventListener(
        "change",
        event => {

          state.selectedWeight =
            event.target.value ||
            "ALL";

          renderComparison();

        }
      );

    }
  );


  /*
   * Sort
   */

  [
    "#sortSelect",
    "#sortBy"
  ].forEach(
    selector => {

      const element =
        $(selector);

      if (!element) {
        return;
      }

      element.addEventListener(
        "change",
        event => {

          state.sortBy =
            event.target.value ||
            "price-asc";

          renderComparison();

        }
      );

    }
  );


  /*
   * Global retry buttons
   */

  $all(
    '[data-action="retry-products"]'
  ).forEach(
    button =>
      button.addEventListener(
        "click",
        loadProducts
      )
  );


  /*
   * Refresh buttons
   */

  $all(
    '[data-action="refresh"]'
  ).forEach(
    button =>
      button.addEventListener(
        "click",
        refreshAll
      )
  );


  $all(
    '[data-action="refresh-gold"]'
  ).forEach(
    button =>
      button.addEventListener(
        "click",
        loadGoldPrice
      )
  );


  $all(
    '[data-action="refresh-products"]'
  ).forEach(
    button =>
      button.addEventListener(
        "click",
        loadProducts
      )
  );


  /*
   * Clear filters
   */

  $all(
    '[data-action="clear-filters"]'
  ).forEach(
    button =>
      button.addEventListener(
        "click",
        clearFilters
      )
  );


  /*
   * Escape key closes any modal
   * implemented by index.html.
   */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        closeModals();

      }

    }
  );
}


/* =========================================================
   CLOSE MODALS
========================================================= */

function closeModals() {

  $all(
    ".modal.open, .modal.active, [role='dialog'].open"
  ).forEach(
    modal => {

      modal.classList.remove(
        "open",
        "active"
      );

      modal.setAttribute(
        "aria-hidden",
        "true"
      );

    }
  );
}


/* =========================================================
   REFRESH ALL
========================================================= */

async function refreshAll() {

  await Promise.allSettled([
    loadGoldPrice(),
    loadProducts(),
    loadSellers(),
    loadOffers()
  ]);
}


/* =========================================================
   AUTO REFRESH
========================================================= */

function setupAutoRefresh() {

  setInterval(
    () => {

      loadGoldPrice();

    },
    CONFIG.GOLD_REFRESH_MS
  );


  setInterval(
    () => {

      loadProducts();
      loadOffers();

    },
    CONFIG.PRODUCT_REFRESH_MS
  );


  /*
   * Refresh when browser tab becomes
   * visible again.
   */

  document.addEventListener(
    "visibilitychange",
    () => {

      if (
        document.visibilityState ===
        "visible"
      ) {

        const now =
          Date.now();


        const goldAge =
          state.lastGoldUpdate
            ? now -
              new Date(
                state.lastGoldUpdate
              ).getTime()
            : Infinity;


        const productAge =
          state.lastProductUpdate
            ? now -
              new Date(
                state.lastProductUpdate
              ).getTime()
            : Infinity;


        if (
          goldAge >
          CONFIG.GOLD_REFRESH_MS
        ) {

          loadGoldPrice();

        }


        if (
          productAge >
          CONFIG.PRODUCT_REFRESH_MS
        ) {

          loadProducts();

        }

      }

    }
  );
}


/* =========================================================
   UTIL
========================================================= */

function setText(
  selector,
  value
) {

  const elements =
    $all(selector);

  elements.forEach(
    element => {

      element.textContent =
        String(
          value ?? ""
        );

    }
  );
}


function formatDateTime(
  value
) {

  try {

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }


    return new Intl.DateTimeFormat(
      "en-IN",
      {
        dateStyle:
          "medium",

        timeStyle:
          "short"
      }
    ).format(date);

  } catch {

    return String(value);
  }
}


/* =========================================================
   INITIALISE
========================================================= */

async function init() {

  console.log(
    "GoldManiaSavings starting..."
  );


  /*
   * Bind UI events first so the page
   * remains interactive even while data
   * is loading.
   */

  setupEvents();

  updatePurityButtons();


  /*
   * Run independent requests in parallel.
   */

  await Promise.allSettled([

    checkAPI(),

    loadGoldPrice(),

    loadProducts(),

    loadSellers(),

    loadOffers()

  ]);


  /*
   * Render once more after all data
   * sources have settled.
   */

  renderGoldPrice();

  populateSellerFilter();

  populateWeightFilter();

  updatePurityButtons();

  renderComparison();

  renderOffers();


  /*
   * Background refresh.
   */

  setupAutoRefresh();


  console.log(
    "GoldManiaSavings ready",
    {
      products:
        state.products.length,

      sellers:
        state.sellers.length,

      apiOnline:
        state.apiOnline
    }
  );
}


/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    init,
    {
      once: true
    }
  );

} else {

  init();

}


/* =========================================================
   OPTIONAL DEBUG ACCESS
   Browser console:
   window.GoldManiaSavings
========================================================= */

window.GoldManiaSavings = {
  state,

  refresh:
    refreshAll,

  refreshGold:
    loadGoldPrice,

  refreshProducts:
    loadProducts,

  clearFilters,

  getProducts:
    () =>
      [...state.products],

  getGold:
    () =>
      state.gold
};

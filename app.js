/* =========================================================
   GoldManiaSavings
   Frontend Application
   app.js
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const CONFIG = {
  API_BASE:
    "https://goldmaniasavings-api.onlinetechmine.workers.dev",

  ENDPOINTS: {
    health: "/api/health",
    gold: "/api/gold",
    sellers: "/api/sellers",
    products: "/api/products",
    offers: "/api/offers",
    history: "/api/history"
  },

  REFRESH_MS: 5 * 60 * 1000,

  FETCH_TIMEOUT_MS: 15000,

  DEFAULT_PURITY: "ALL",

  DEFAULT_SORT: "PRICE_ASC"
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

  selectedWeight: "ALL",

  selectedSeller: "ALL",

  sort: "PRICE_ASC",

  loading: false,

  goldLoading: false,

  productsLoading: false,

  lastProductsUpdate: null,

  lastGoldUpdate: null,

  apiOnline: false,

  error: null
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return Array.from(
    document.querySelectorAll(selector)
  );
}

function byId(id) {
  return document.getElementById(id);
}


/* =========================================================
   INIT
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);

async function init() {

  bindEvents();

  renderInitialUI();

  await loadApplicationData();

  startAutoRefresh();
}


/* =========================================================
   EVENTS
   ========================================================= */

function bindEvents() {

  document.addEventListener(
    "click",
    handleDocumentClick
  );

  document.addEventListener(
    "change",
    handleDocumentChange
  );

}


/* =========================================================
   CLICK EVENTS
   ========================================================= */

function handleDocumentClick(event) {

  const purityButton =
    event.target.closest(
      "[data-purity]"
    );

  if (purityButton) {

    state.selectedPurity =
      purityButton.dataset.purity ||
      "ALL";

    updateActiveControls();

    renderProducts();

    return;
  }


  const sellerButton =
    event.target.closest(
      "[data-seller]"
    );

  if (sellerButton) {

    state.selectedSeller =
      sellerButton.dataset.seller ||
      "ALL";

    updateActiveControls();

    renderProducts();

    return;
  }


  const weightButton =
    event.target.closest(
      "[data-weight]"
    );

  if (weightButton) {

    state.selectedWeight =
      weightButton.dataset.weight ||
      "ALL";

    updateActiveControls();

    renderProducts();

    return;
  }


  const sortButton =
    event.target.closest(
      "[data-sort]"
    );

  if (sortButton) {

    state.sort =
      sortButton.dataset.sort ||
      CONFIG.DEFAULT_SORT;

    updateActiveControls();

    renderProducts();

    return;
  }


  const compareButton =
    event.target.closest(
      "[data-compare]"
    );

  if (compareButton) {

    const productId =
      compareButton.dataset.compare;

    openComparison(
      productId
    );

    return;
  }


  const closeButton =
    event.target.closest(
      "[data-close-modal]"
    );

  if (closeButton) {

    closeComparison();

    return;
  }

}


/* =========================================================
   CHANGE EVENTS
   ========================================================= */

function handleDocumentChange(event) {

  if (
    event.target.matches(
      "#puritySelect"
    )
  ) {

    state.selectedPurity =
      event.target.value;

    updateActiveControls();

    renderProducts();

  }


  if (
    event.target.matches(
      "#sellerSelect"
    )
  ) {

    state.selectedSeller =
      event.target.value;

    updateActiveControls();

    renderProducts();

  }


  if (
    event.target.matches(
      "#weightSelect"
    )
  ) {

    state.selectedWeight =
      event.target.value;

    updateActiveControls();

    renderProducts();

  }


  if (
    event.target.matches(
      "#sortSelect"
    )
  ) {

    state.sort =
      event.target.value;

    updateActiveControls();

    renderProducts();

  }

}


/* =========================================================
   LOAD ALL DATA
   ========================================================= */

async function loadApplicationData() {

  setGlobalLoading(true);

  await Promise.allSettled([
    loadHealth(),
    loadGold(),
    loadSellers(),
    loadProducts(),
    loadOffers(),
    loadHistory()
  ]);

  setGlobalLoading(false);

  renderAll();

}


/* =========================================================
   API FETCH
   ========================================================= */

async function apiFetch(
  endpoint,
  options = {}
) {

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      CONFIG.FETCH_TIMEOUT_MS
    );

  try {

    const response =
      await fetch(
        CONFIG.API_BASE +
        endpoint,
        {
          ...options,

          signal:
            controller.signal,

          headers: {
            Accept:
              "application/json",

            ...(options.headers || {})
          }
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

async function loadHealth() {

  try {

    const data =
      await apiFetch(
        CONFIG.ENDPOINTS.health
      );


    state.apiOnline =
      Boolean(
        data &&
        data.ok
      );

  } catch (error) {

    state.apiOnline = false;

    console.error(
      "Health check failed:",
      error
    );

  }

}


/* =========================================================
   GOLD
   ========================================================= */

async function loadGold() {

  state.goldLoading = true;

  renderGoldLoading();


  try {

    const data =
      await apiFetch(
        CONFIG.ENDPOINTS.gold
      );


    if (
      !data ||
      !data.ok
    ) {

      throw new Error(
        data?.message ||
        "Gold data unavailable"
      );

    }


    state.gold =
      normalizeGoldResponse(
        data
      );

    state.lastGoldUpdate =
      new Date();

  } catch (error) {

    console.error(
      "Gold loading failed:",
      error
    );

    state.gold = null;

    showGoldError();

  } finally {

    state.goldLoading = false;

  }


  renderGold();

}


/* =========================================================
   NORMALIZE GOLD
   ========================================================= */

function normalizeGoldResponse(
  data
) {

  const india =
    data.indiaReference ||
    null;

  const international =
    data.internationalSpot ||
    null;


  return {

    live:
      Boolean(data.live),

    timestamp:
      data.timestamp ||
      null,

    source:
      india?.source ||
      international?.source ||
      "Unknown",

    resolution:
      india?.resolution ||
      null,

    date:
      india?.date ||
      null,

    rates: {

      "24K":
        Number(
          india?.rates?.["24K"]?.perGram ||
          international?.rates?.["24K"]?.perGram ||
          0
        ),

      "22K":
        Number(
          india?.rates?.["22K"]?.perGram ||
          international?.rates?.["22K"]?.perGram ||
          0
        ),

      "18K":
        Number(
          india?.rates?.["18K"]?.perGram ||
          international?.rates?.["18K"]?.perGram ||
          0
        )

    }

  };

}


/* =========================================================
   SELLERS
   ========================================================= */

async function loadSellers() {

  try {

    const data =
      await apiFetch(
        CONFIG.ENDPOINTS.sellers
      );


    state.sellers =
      Array.isArray(data?.sellers)
        ? data.sellers
        : [];

  } catch (error) {

    console.error(
      "Seller loading failed:",
      error
    );

    state.sellers = [];

  }


  renderSellerControls();

}


/* =========================================================
   PRODUCTS
   ========================================================= */

async function loadProducts() {

  state.productsLoading = true;

  renderProductLoading();


  try {

    const data =
      await apiFetch(
        CONFIG.ENDPOINTS.products
      );


    if (
      !data ||
      !data.ok
    ) {

      throw new Error(
        data?.message ||
        "Products unavailable"
      );

    }


    state.products =
      Array.isArray(data.products)
        ? data.products
        : [];


    state.lastProductsUpdate =
      data.updatedAt ||
      new Date().toISOString();


    state.error = null;

  } catch (error) {

    console.error(
      "Product loading failed:",
      error
    );

    state.products = [];

    state.error =
      "Products could not be loaded.";

  } finally {

    state.productsLoading = false;

  }


  renderProducts();

}


/* =========================================================
   OFFERS
   ========================================================= */

async function loadOffers() {

  try {

    const data =
      await apiFetch(
        CONFIG.ENDPOINTS.offers
      );


    state.offers =
      Array.isArray(data?.offers)
        ? data.offers
        : [];

  } catch (error) {

    console.error(
      "Offers loading failed:",
      error
    );

    state.offers = [];

  }


  renderOffers();

}


/* =========================================================
   HISTORY
   ========================================================= */

async function loadHistory() {

  try {

    const data =
      await apiFetch(
        CONFIG.ENDPOINTS.history
      );


    state.history =
      Array.isArray(data?.history)
        ? data.history
        : [];

  } catch (error) {

    console.error(
      "History loading failed:",
      error
    );

    state.history = [];

  }

}


/* =========================================================
   RENDER ALL
   ========================================================= */

function renderAll() {

  renderGold();

  renderSellerControls();

  renderWeightControls();

  renderProducts();

  renderOffers();

  renderStatus();

  updateActiveControls();

}


/* =========================================================
   INITIAL UI
   ========================================================= */

function renderInitialUI() {

  renderGoldLoading();

  renderProductLoading();

}


/* =========================================================
   GOLD RENDER
   ========================================================= */

function renderGold() {

  const container =
    byId("goldRates") ||
    byId("goldPriceGrid") ||
    $(".gold-rates") ||
    $(".gold-price-grid");


  if (!container) {
    return;
  }


  if (
    !state.gold ||
    !state.gold.rates
  ) {

    showGoldError();

    return;

  }


  const rates =
    state.gold.rates;


  container.innerHTML = `

    ${goldRateCard(
      "24K",
      rates["24K"]
    )}

    ${goldRateCard(
      "22K",
      rates["22K"]
    )}

    ${goldRateCard(
      "18K",
      rates["18K"]
    )}

  `;


  const source =
    byId("goldSource") ||
    $(".gold-source");


  if (source) {

    source.textContent =
      state.gold.source
        ? `Source: ${state.gold.source}`
        : "";

  }


  const updated =
    byId("goldUpdated") ||
    $(".gold-updated");


  if (updated) {

    updated.textContent =
      formatGoldDate(
        state.gold.timestamp
      );

  }

}


function goldRateCard(
  purity,
  price
) {

  const valid =
    Number.isFinite(
      Number(price)
    ) &&
    Number(price) > 0;


  return `

    <article class="gold-rate-card">

      <div class="gold-rate-purity">
        ${escapeHTML(purity)}
      </div>

      <div class="gold-rate-price">
        ${
          valid
            ? formatINR(price)
            : "Unavailable"
        }
      </div>

      <div class="gold-rate-unit">
        per gram
      </div>

    </article>

  `;

}


/* =========================================================
   GOLD LOADING
   ========================================================= */

function renderGoldLoading() {

  const container =
    byId("goldRates") ||
    byId("goldPriceGrid") ||
    $(".gold-rates") ||
    $(".gold-price-grid");


  if (!container) {
    return;
  }


  if (!state.goldLoading) {
    return;
  }


  container.innerHTML = `

    <article class="gold-rate-card loading-card">
      <div class="skeleton"></div>
      <div class="skeleton small"></div>
    </article>

    <article class="gold-rate-card loading-card">
      <div class="skeleton"></div>
      <div class="skeleton small"></div>
    </article>

    <article class="gold-rate-card loading-card">
      <div class="skeleton"></div>
      <div class="skeleton small"></div>
    </article>

  `;

}


/* =========================================================
   GOLD ERROR
   ========================================================= */

function showGoldError() {

  const container =
    byId("goldRates") ||
    byId("goldPriceGrid") ||
    $(".gold-rates") ||
    $(".gold-price-grid");


  if (!container) {
    return;
  }


  container.innerHTML = `

    <div class="data-error">

      <strong>
        Gold price unavailable
      </strong>

      <span>
        Please try refreshing the page.
      </span>

    </div>

  `;

}


/* =========================================================
   SELLER CONTROLS
   ========================================================= */

function renderSellerControls() {

  const containers = [
    byId("sellerFilters"),
    byId("sellerSelect"),
    $(".seller-filters")
  ].filter(Boolean);


  const sellers =
    getAvailableSellers();


  const select =
    byId("sellerSelect");


  if (select) {

    select.innerHTML = `

      <option value="ALL">
        All sellers
      </option>

      ${sellers.map(
        seller => `
          <option
            value="${escapeAttribute(seller.id)}"
          >
            ${escapeHTML(seller.name)}
          </option>
        `
      ).join("")}

    `;

    select.value =
      state.selectedSeller;

  }


  containers.forEach(
    container => {

      if (
        container === select
      ) {
        return;
      }


      container.innerHTML = `

        <button
          type="button"
          class="filter-chip ${
            state.selectedSeller === "ALL"
              ? "active"
              : ""
          }"
          data-seller="ALL"
        >
          All sellers
        </button>

        ${sellers.map(
          seller => `

            <button
              type="button"
              class="filter-chip ${
                state.selectedSeller === seller.id
                  ? "active"
                  : ""
              }"
              data-seller="${escapeAttribute(seller.id)}"
            >
              ${escapeHTML(seller.name)}
            </button>

          `
        ).join("")}

      `;

    }
  );

}


/* =========================================================
   AVAILABLE SELLERS
   ========================================================= */

function getAvailableSellers() {

  const sellerMap =
    new Map();


  state.sellers.forEach(
    seller => {

      if (
        seller?.id &&
        seller?.name
      ) {

        sellerMap.set(
          seller.id,
          {
            id:
              seller.id,

            name:
              seller.name
          }
        );

      }

    }
  );


  state.products.forEach(
    product => {

      if (
        product?.sellerId
      ) {

        if (
          !sellerMap.has(
            product.sellerId
          )
        ) {

          sellerMap.set(
            product.sellerId,
            {
              id:
                product.sellerId,

              name:
                product.seller ||
                product.sellerId
            }
          );

        }

      }

    }
  );


  return Array.from(
    sellerMap.values()
  ).sort(
    (a, b) =>
      a.name.localeCompare(
        b.name
      )
  );

}


/* =========================================================
   WEIGHT CONTROLS
   ========================================================= */

function renderWeightControls() {

  const select =
    byId("weightSelect");


  const weights =
    getAvailableWeights();


  if (!select) {
    return;
  }


  select.innerHTML = `

    <option value="ALL">
      All weights
    </option>

    ${weights.map(
      weight => `

        <option
          value="${escapeAttribute(String(weight))}"
        >
          ${escapeHTML(formatWeight(weight))}
        </option>

      `
    ).join("")}

  `;


  select.value =
    state.selectedWeight;

}


/* =========================================================
   AVAILABLE WEIGHTS
   ========================================================= */

function getAvailableWeights() {

  const values =
    state.products
      .map(
        product =>
          Number(product.weight)
      )
      .filter(
        value =>
          Number.isFinite(value) &&
          value > 0
      );


  return Array.from(
    new Set(values)
  ).sort(
    (a, b) => a - b
  );

}


/* =========================================================
   PRODUCTS
   ========================================================= */

function getFilteredProducts() {

  let products =
    [...state.products];


  if (
    state.selectedPurity !== "ALL"
  ) {

    products =
      products.filter(
        product =>
          normalizePurity(
            product.purity
          ) ===
          state.selectedPurity
      );

  }


  if (
    state.selectedWeight !== "ALL"
  ) {

    const requested =
      Number(
        state.selectedWeight
      );


    products =
      products.filter(
        product =>
          Number(product.weight) ===
          requested
      );

  }


  if (
    state.selectedSeller !== "ALL"
  ) {

    products =
      products.filter(
        product =>
          String(
            product.sellerId || ""
          ).toLowerCase() ===
          String(
            state.selectedSeller
          ).toLowerCase()
      );

  }


  products =
    products.filter(
      product =>
        isValidProduct(product)
    );


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

  switch (
    state.sort
  ) {

    case "PRICE_DESC":

      return products.sort(
        (a, b) =>
          Number(b.listedPrice) -
          Number(a.listedPrice)
      );


    case "WEIGHT_ASC":

      return products.sort(
        (a, b) =>
          Number(a.weight) -
          Number(b.weight)
      );


    case "WEIGHT_DESC":

      return products.sort(
        (a, b) =>
          Number(b.weight) -
          Number(a.weight)
      );


    case "SELLER":

      return products.sort(
        (a, b) =>
          String(a.seller || "")
            .localeCompare(
              String(b.seller || "")
            )
      );


    case "PRICE_ASC":
    default:

      return products.sort(
        (a, b) =>
          Number(a.listedPrice) -
          Number(b.listedPrice)
      );

  }

}


/* =========================================================
   PRODUCT RENDER
   ========================================================= */

function renderProducts() {

  const container =
    byId("productsGrid") ||
    byId("productGrid") ||
    $(".products-grid") ||
    $(".product-grid");


  if (!container) {
    return;
  }


  if (
    state.productsLoading
  ) {

    renderProductLoading();

    return;

  }


  const products =
    getFilteredProducts();


  updateProductCount(
    products.length
  );


  if (!products.length) {

    container.innerHTML = `

      <div class="empty-state">

        <div class="empty-icon">
          🪙
        </div>

        <h3>
          No gold coins found
        </h3>

        <p>
          Try another purity, weight or seller.
        </p>

      </div>

    `;

    return;

  }


  const lowestMap =
    createLowestPriceMap(
      products
    );


  container.innerHTML =
    products
      .map(
        product =>
          productCard(
            product,
            lowestMap
          )
      )
      .join("");

}


/* =========================================================
   PRODUCT CARD
   ========================================================= */

function productCard(
  product,
  lowestMap
) {

  const comparisonKey =
    makeComparisonKey(
      product
    );


  const lowest =
    lowestMap.get(
      comparisonKey
    );


  const isLowest =
    lowest &&
    String(lowest.id) ===
    String(product.id);


  const offers =
    getProductOffers(
      product
    );


  const exactUrl =
    getExactProductUrl(
      product
    );


  return `

    <article
      class="product-card ${
        isLowest
          ? "lowest-price-card"
          : ""
      }"
      data-product-id="${escapeAttribute(
        String(product.id || "")
      )}"
    >

      ${
        isLowest
          ? `
            <div class="lowest-badge">
              LOWEST PRICE
            </div>
          `
          : ""
      }

      <div class="product-card-body">

        <div class="product-seller">
          ${escapeHTML(
            product.seller ||
            product.sellerId ||
            "Seller"
          )}
        </div>

        <h3 class="product-name">
          ${escapeHTML(
            product.productName ||
            "Gold Coin"
          )}
        </h3>

        <div class="product-specs">

          <span>
            ${escapeHTML(
              normalizePurity(
                product.purity
              ) || "Gold"
            )}
          </span>

          <span>
            ${escapeHTML(
              formatWeight(
                product.weight
              )
            )}
          </span>

          ${
            product.fineness
              ? `
                <span>
                  ${escapeHTML(
                    product.fineness
                  )}
                </span>
              `
              : ""
          }

        </div>


        <div class="product-price-row">

          <div>

            <div class="product-price">
              ${formatINR(
                product.listedPrice
              )}
            </div>

            ${
              Number(product.mrp) >
              Number(product.listedPrice)
                ? `
                  <div class="product-mrp">
                    ${formatINR(
                      product.mrp
                    )}
                  </div>
                `
                : ""
            }

          </div>


          ${
            isLowest
              ? `
                <div class="price-note">
                  Lowest
                </div>
              `
              : ""
          }

        </div>


        ${
          offers
            ? `
              <div class="offer-box">
                ${offers}
              </div>
            `
            : ""
        }


        <div class="product-actions">

          ${
            exactUrl
              ? `
                <a
                  class="product-link"
                  href="${escapeAttribute(
                    exactUrl
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View exact product
                </a>
              `
              : `
                <span class="product-link disabled">
                  Product link unavailable
                </span>
              `
          }


          <button
            type="button"
            class="compare-button"
            data-compare="${escapeAttribute(
              String(product.id || "")
            )}"
          >
            Compare
          </button>

        </div>

      </div>

    </article>

  `;

}


/* =========================================================
   EXACT PRODUCT URL
   ========================================================= */

function getExactProductUrl(
  product
) {

  const url =
    String(
      product.productUrl ||
      ""
    ).trim();


  if (
    !/^https?:\/\//i.test(url)
  ) {

    return "";

  }


  if (
    isCategoryUrl(
      url
    )
  ) {

    return "";

  }


  return url;

}


/* =========================================================
   CATEGORY URL PROTECTION
   ========================================================= */

function isCategoryUrl(
  url
) {

  const value =
    String(url)
      .toLowerCase();


  const badPatterns = [

    "gold-coins.html",

    "/gold-coins/",

    "/goldcoins/",

    "/collections/",

    "/category/",

    "/products?",

    "?category=",

    "/search",

    "/search?",

    "/shop/gold-coins"

  ];


  return badPatterns.some(
    pattern =>
      value.includes(pattern)
  );

}


/* =========================================================
   PRODUCT OFFERS
   ========================================================= */

function getProductOffers(
  product
) {

  const parts = [];


  if (
    Number(product.coupon) > 0
  ) {

    parts.push(
      `<span>Coupon: ${formatINR(
        product.coupon
      )}</span>`
    );

  }


  if (
    Number(product.cardOffer) > 0
  ) {

    parts.push(
      `<span>Card offer: ${formatINR(
        product.cardOffer
      )}</span>`
    );

  }


  if (
    Number(product.upiOffer) > 0
  ) {

    parts.push(
      `<span>UPI offer: ${formatINR(
        product.upiOffer
      )}</span>`
    );

  }


  if (
    Number(product.cashback) > 0
  ) {

    parts.push(
      `<span>Cashback: ${formatINR(
        product.cashback
      )}</span>`
    );

  }


  if (
    product.voucher
  ) {

    parts.push(
      `<span>Voucher: ${escapeHTML(
        product.voucher
      )}</span>`
    );

  }


  if (
    product.promoCode
  ) {

    parts.push(
      `<span>Promo: <strong>${escapeHTML(
        product.promoCode
      )}</strong></span>`
    );

  }


  if (
    product.offerText
  ) {

    parts.push(
      `<span>${escapeHTML(
        product.offerText
      )}</span>`
    );

  }


  if (!parts.length) {
    return "";
  }


  return `
    <div class="offer-list">
      ${parts.join("")}
    </div>
  `;

}


/* =========================================================
   LOWEST PRICE MAP
   ========================================================= */

function createLowestPriceMap(
  products
) {

  const map =
    new Map();


  for (
    const product of products
  ) {

    const price =
      Number(
        product.listedPrice
      );


    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      continue;
    }


    const key =
      makeComparisonKey(
        product
      );


    const current =
      map.get(key);


    if (
      !current ||
      price <
      Number(
        current.listedPrice
      )
    ) {

      map.set(
        key,
        product
      );

    }

  }


  return map;

}


/* =========================================================
   COMPARISON KEY
   ========================================================= */

function makeComparisonKey(
  product
) {

  const purity =
    normalizePurity(
      product.purity
    );


  const weight =
    normalizeWeight(
      product.weight
    );


  return [
    purity,
    weight
  ].join("|");

}


/* =========================================================
   OPEN COMPARISON
   ========================================================= */

function openComparison(
  productId
) {

  const selected =
    state.products.find(
      product =>
        String(product.id) ===
        String(productId)
    );


  if (!selected) {
    return;
  }


  const key =
    makeComparisonKey(
      selected
    );


  const comparison =
    state.products
      .filter(
        product =>
          makeComparisonKey(
            product
          ) === key &&
          isValidProduct(
            product
          )
      )
      .sort(
        (a, b) =>
          Number(a.listedPrice) -
          Number(b.listedPrice)
      );


  renderComparisonModal(
    selected,
    comparison
  );

}


/* =========================================================
   COMPARISON MODAL
   ========================================================= */

function renderComparisonModal(
  selected,
  products
) {

  let modal =
    byId("comparisonModal");


  if (!modal) {

    modal =
      document.createElement(
        "div"
      );

    modal.id =
      "comparisonModal";

    modal.className =
      "comparison-modal";

    document.body.appendChild(
      modal
    );

  }


  const lowest =
    products.length
      ? products[0]
      : null;


  modal.innerHTML = `

    <div
      class="comparison-backdrop"
      data-close-modal
    ></div>

    <div class="comparison-dialog">

      <button
        type="button"
        class="comparison-close"
        data-close-modal
        aria-label="Close"
      >
        ×
      </button>

      <div class="comparison-header">

        <div class="comparison-title">
          Price comparison
        </div>

        <div class="comparison-product">
          ${escapeHTML(
            selected.productName ||
            "Gold Coin"
          )}
        </div>

        <div class="comparison-spec">
          ${escapeHTML(
            normalizePurity(
              selected.purity
            )
          )}
          ·
          ${escapeHTML(
            formatWeight(
              selected.weight
            )
          )}
        </div>

      </div>


      <div class="comparison-table-wrap">

        <table class="comparison-table">

          <thead>
            <tr>
              <th>Seller</th>
              <th>Price</th>
              <th>Offers</th>
              <th></th>
            </tr>
          </thead>

          <tbody>

            ${
              products.map(
                product => {

                  const isLowestProduct =
                    lowest &&
                    String(
                      lowest.id
                    ) ===
                    String(
                      product.id
                    );


                  return `

                    <tr
                      class="${
                        isLowestProduct
                          ? "comparison-lowest"
                          : ""
                      }"
                    >

                      <td>
                        <strong>
                          ${escapeHTML(
                            product.seller ||
                            product.sellerId
                          )}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          ${formatINR(
                            product.listedPrice
                          )}
                        </strong>

                        ${
                          isLowestProduct
                            ? `
                              <span class="mini-lowest">
                                LOWEST
                              </span>
                            `
                            : ""
                        }
                      </td>

                      <td>
                        ${getOfferSummary(
                          product
                        )}
                      </td>

                      <td>
                        ${
                          getExactProductUrl(
                            product
                          )
                            ? `
                              <a
                                href="${escapeAttribute(
                                  getExactProductUrl(
                                    product
                                  )
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="comparison-link"
                              >
                                Open product
                              </a>
                            `
                            : ""
                        }
                      </td>

                    </tr>

                  `;

                }
              ).join("")
            }

          </tbody>

        </table>

      </div>

    </div>

  `;


  modal.classList.add(
    "open"
  );


  document.body.classList.add(
    "modal-open"
  );

}


/* =========================================================
   CLOSE COMPARISON
   ========================================================= */

function closeComparison() {

  const modal =
    byId("comparisonModal");


  if (modal) {

    modal.classList.remove(
      "open"
    );

  }


  document.body.classList.remove(
    "modal-open"
  );

}


/* =========================================================
   OFFER SUMMARY
   ========================================================= */

function getOfferSummary(
  product
) {

  const offers = [];


  if (
    Number(product.coupon) > 0
  ) {

    offers.push(
      `Coupon ${formatINR(
        product.coupon
      )}`
    );

  }


  if (
    Number(product.cardOffer) > 0
  ) {

    offers.push(
      `Card ${formatINR(
        product.cardOffer
      )}`
    );

  }


  if (
    Number(product.upiOffer) > 0
  ) {

    offers.push(
      `UPI ${formatINR(
        product.upiOffer
      )}`
    );

  }


  if (
    Number(product.cashback) > 0
  ) {

    offers.push(
      `Cashback ${formatINR(
        product.cashback
      )}`
    );

  }


  if (
    product.voucher
  ) {

    offers.push(
      `Voucher ${product.voucher}`
    );

  }


  if (
    product.promoCode
  ) {

    offers.push(
      `Promo ${product.promoCode}`
    );

  }


  if (
    product.offerText
  ) {

    offers.push(
      product.offerText
    );

  }


  return offers.length
    ? escapeHTML(
        offers.join(" · ")
      )
    : "—";

}


/* =========================================================
   OFFERS SECTION
   ========================================================= */

function renderOffers() {

  const container =
    byId("offersGrid") ||
    byId("offersList") ||
    $(".offers-grid") ||
    $(".offers-list");


  if (!container) {
    return;
  }


  if (!state.offers.length) {

    container.innerHTML = `

      <div class="empty-state">
        <h3>No offers found</h3>
        <p>
          Seller offers will appear here when available.
        </p>
      </div>

    `;

    return;

  }


  container.innerHTML =
    state.offers
      .map(
        offer => `

          <article class="offer-card">

            <div class="offer-seller">
              ${escapeHTML(
                offer.seller ||
                "Seller"
              )}
            </div>

            <h3>
              ${escapeHTML(
                offer.productName ||
                "Gold Product"
              )}
            </h3>

            ${
              offer.coupon
                ? `<div>Coupon: ${formatINR(
                    offer.coupon
                  )}</div>`
                : ""
            }

            ${
              offer.cardOffer
                ? `<div>Card offer: ${formatINR(
                    offer.cardOffer
                  )}</div>`
                : ""
            }

            ${
              offer.upiOffer
                ? `<div>UPI offer: ${formatINR(
                    offer.upiOffer
                  )}</div>`
                : ""
            }

            ${
              offer.cashback
                ? `<div>Cashback: ${formatINR(
                    offer.cashback
                  )}</div>`
                : ""
            }

            ${
              offer.voucher
                ? `<div>Voucher: ${escapeHTML(
                    offer.voucher
                  )}</div>`
                : ""
            }

            ${
              offer.promoCode
                ? `
                  <div>
                    Promo:
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
                  <div class="offer-text">
                    ${escapeHTML(
                      offer.offerText
                    )}
                  </div>
                `
                : ""
            }

            ${
              getExactProductUrl(
                offer
              )
                ? `
                  <a
                    href="${escapeAttribute(
                      getExactProductUrl(
                        offer
                      )
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View exact product
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
   PRODUCT LOADING
   ========================================================= */

function renderProductLoading() {

  const container =
    byId("productsGrid") ||
    byId("productGrid") ||
    $(".products-grid") ||
    $(".product-grid");


  if (!container) {
    return;
  }


  if (!state.productsLoading) {
    return;
  }


  container.innerHTML =
    Array.from(
      { length: 6 },
      () => `

        <article class="product-card loading-card">

          <div class="skeleton large"></div>

          <div class="skeleton"></div>

          <div class="skeleton medium"></div>

          <div class="skeleton small"></div>

        </article>

      `
    ).join("");

}


/* =========================================================
   PRODUCT COUNT
   ========================================================= */

function updateProductCount(
  count
) {

  const elements = [
    byId("productCount"),
    $(".product-count"),
    byId("resultsCount")
  ].filter(Boolean);


  elements.forEach(
    element => {

      element.textContent =
        `${count} product${
          count === 1
            ? ""
            : "s"
        }`;

    }
  );

}


/* =========================================================
   ACTIVE CONTROLS
   ========================================================= */

function updateActiveControls() {

  $$("[data-purity]")
    .forEach(
      element => {

        element.classList.toggle(
          "active",
          (
            element.dataset.purity ||
            "ALL"
          ) ===
          state.selectedPurity
        );

      }
    );


  $$("[data-seller]")
    .forEach(
      element => {

        element.classList.toggle(
          "active",
          (
            element.dataset.seller ||
            "ALL"
          ) ===
          state.selectedSeller
        );

      }
    );


  $$("[data-weight]")
    .forEach(
      element => {

        element.classList.toggle(
          "active",
          (
            element.dataset.weight ||
            "ALL"
          ) ===
          state.selectedWeight
        );

      }
    );


  const puritySelect =
    byId("puritySelect");


  if (puritySelect) {

    puritySelect.value =
      state.selectedPurity;

  }


  const sellerSelect =
    byId("sellerSelect");


  if (sellerSelect) {

    sellerSelect.value =
      state.selectedSeller;

  }


  const weightSelect =
    byId("weightSelect");


  if (weightSelect) {

    weightSelect.value =
      state.selectedWeight;

  }


  const sortSelect =
    byId("sortSelect");


  if (sortSelect) {

    sortSelect.value =
      state.sort;

  }

}


/* =========================================================
   STATUS
   ========================================================= */

function renderStatus() {

  const status =
    byId("apiStatus") ||
    $(".api-status");


  if (!status) {
    return;
  }


  if (state.apiOnline) {

    status.textContent =
      "Live data connected";

    status.classList.remove(
      "offline"
    );

    status.classList.add(
      "online"
    );

  } else {

    status.textContent =
      "Data connection unavailable";

    status.classList.remove(
      "online"
    );

    status.classList.add(
      "offline"
    );

  }

}


/* =========================================================
   GLOBAL LOADING
   ========================================================= */

function setGlobalLoading(
  loading
) {

  document.body.classList.toggle(
    "app-loading",
    loading
  );

}


/* =========================================================
   AUTO REFRESH
   ========================================================= */

function startAutoRefresh() {

  setInterval(
    async () => {

      await Promise.allSettled([
        loadGold(),
        loadProducts(),
        loadOffers()
      ]);

      renderStatus();

    },
    CONFIG.REFRESH_MS
  );

}


/* =========================================================
   VALID PRODUCT
   ========================================================= */

function isValidProduct(
  product
) {

  if (
    !product ||
    typeof product !== "object"
  ) {

    return false;

  }


  const price =
    Number(
      product.listedPrice
    );


  const weight =
    Number(
      product.weight
    );


  const name =
    String(
      product.productName ||
      ""
    ).trim();


  const url =
    getExactProductUrl(
      product
    );


  if (
    !name ||
    price <= 0 ||
    weight <= 0 ||
    !url
  ) {

    return false;

  }


  if (
    name.length > 180
  ) {

    return false;

  }


  return true;

}


/* =========================================================
   PURITY
   ========================================================= */

function normalizePurity(
  value
) {

  const text =
    String(
      value || ""
    )
      .toUpperCase()
      .replace(
        /\s+/g,
        ""
      );


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


  return "";

}


/* =========================================================
   WEIGHT
   ========================================================= */

function normalizeWeight(
  value
) {

  const number =
    Number(
      value
    );


  return Number.isFinite(number)
    ? number
    : 0;

}


/* =========================================================
   FORMAT WEIGHT
   ========================================================= */

function formatWeight(
  value
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {

    return "Weight unavailable";

  }


  return `${formatNumber(
    number
  )} g`;

}


/* =========================================================
   INR
   ========================================================= */

function formatINR(
  value
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {

    return "₹—";

  }


  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }
  ).format(number);

}


/* =========================================================
   NUMBER
   ========================================================= */

function formatNumber(
  value
) {

  const number =
    Number(value);


  if (
    !Number.isFinite(number)
  ) {

    return "0";

  }


  return new Intl.NumberFormat(
    "en-IN",
    {
      maximumFractionDigits: 3
    }
  ).format(number);

}


/* =========================================================
   GOLD DATE
   ========================================================= */

function formatGoldDate(
  value
) {

  if (!value) {
    return "";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";

  }


  return `Updated ${date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  )}`;

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   ATTRIBUTE ESCAPE
   ========================================================= */

function escapeAttribute(
  value
) {

  return escapeHTML(
    value
  );

}


/* =========================================================
   GLOBAL ERROR HANDLER
   ========================================================= */

window.addEventListener(
  "unhandledrejection",
  event => {

    console.error(
      "Unhandled promise:",
      event.reason
    );

  }
);


window.addEventListener(
  "error",
  event => {

    console.error(
      "Application error:",
      event.error
    );

  }
);


/* =========================================================
   OPTIONAL GLOBAL API
   ========================================================= */

window.GoldManiaSavings = {

  state,

  reload: loadApplicationData,

  refreshGold: loadGold,

  refreshProducts: loadProducts,

  refreshOffers: loadOffers,

  compare:
    openComparison

};

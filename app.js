/* =========================================================
   GoldManiaSavings - app.js
   Full frontend controller
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     CONFIG
     ======================================================= */

  const API_BASE =
    window.GOLDMANIA_API_BASE ||
    "https://goldmaniasavings-api.onlinetechmine.workers.dev";

  const API = {
    gold: `${API_BASE}/api/gold`,
    products: `${API_BASE}/api/products`,
    sellers: `${API_BASE}/api/sellers`,
    offers: `${API_BASE}/api/offers`
  };

  const state = {
    gold: null,
    products: [],
    offers: [],
    sellers: [],
    goldLoading: false,
    productsLoading: false,
    offersLoading: false,
    lastGoldUpdate: null,
    error: null
  };

  /* =======================================================
     DOM HELPERS
     ======================================================= */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(value) {
    const n = Number(value);

    if (!Number.isFinite(n) || n <= 0) {
      return "—";
    }

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(n);
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function safeURL(value) {
    try {
      const url = new URL(value);

      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  /* =======================================================
     FETCH HELPERS
     ======================================================= */

  async function fetchJSON(
    url,
    options = {},
    timeout = 15000
  ) {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(options.headers || {})
        }
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const text = await response.text();

      if (!text) {
        throw new Error("Empty response");
      }

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON response");
      }

      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  /* =======================================================
     INITIALIZATION
     ======================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

  async function init() {
    bindEvents();

    setInitialUI();

    /*
     * Important:
     * Gold and products are loaded independently.
     *
     * Gold failure must NEVER prevent products
     * and comparison from loading.
     */

    await Promise.allSettled([
      loadGold(),
      loadProducts(),
      loadOffers(),
      loadSellers()
    ]);

    renderAll();
  }

  /* =======================================================
     EVENTS
     ======================================================= */

  function bindEvents() {
    document.addEventListener(
      "click",
      handleClick
    );

    document.addEventListener(
      "change",
      handleChange
    );

    document.addEventListener(
      "input",
      handleInput
    );
  }

  function handleClick(event) {
    const refreshGold =
      event.target.closest(
        "[data-action='refresh-gold']"
      );

    if (refreshGold) {
      event.preventDefault();
      loadGold();
      return;
    }

    const refreshProducts =
      event.target.closest(
        "[data-action='refresh-products']"
      );

    if (refreshProducts) {
      event.preventDefault();
      loadProducts();
      return;
    }

    const purity =
      event.target.closest(
        "[data-purity]"
      );

    if (purity) {
      event.preventDefault();

      const value =
        purity.dataset.purity;

      setActivePurity(value);
      renderProducts();
      return;
    }

    const seller =
      event.target.closest(
        "[data-seller]"
      );

    if (seller) {
      event.preventDefault();

      const value =
        seller.dataset.seller;

      setActiveSeller(value);
      renderProducts();
      return;
    }
  }

  function handleChange(event) {
    if (
      event.target.matches(
        "#purityFilter, [name='purity']"
      )
    ) {
      renderProducts();
    }

    if (
      event.target.matches(
        "#sellerFilter, [name='seller']"
      )
    ) {
      renderProducts();
    }
  }

  function handleInput(event) {
    if (
      event.target.matches(
        "#productSearch"
      )
    ) {
      /*
       * Search bar is intentionally not required
       * by the current UI.
       *
       * If an old HTML version still contains it,
       * this keeps it functional.
       */

      renderProducts();
    }
  }

  /* =======================================================
     INITIAL UI
     ======================================================= */

  function setInitialUI() {
    setGoldStatus(
      "Loading gold price..."
    );

    renderProductsLoading();
    renderOffersLoading();
  }

  /* =======================================================
     GOLD
     ======================================================= */

  async function loadGold() {
    state.goldLoading = true;

    setGoldStatus(
      "Updating gold price..."
    );

    try {
      const data =
        await fetchJSON(
          API.gold,
          {},
          12000
        );

      if (
        !data ||
        data.ok === false
      ) {
        throw new Error(
          data?.message ||
          "Gold data unavailable"
        );
      }

      state.gold = normalizeGold(data);

      state.lastGoldUpdate =
        new Date();

      renderGold();

    } catch (error) {
      console.error(
        "Gold price error:",
        error
      );

      /*
       * Do NOT keep the UI permanently at
       * "Loading..."
       */

      setGoldStatus(
        "Gold price temporarily unavailable"
      );

      renderGoldError();

    } finally {
      state.goldLoading = false;
    }
  }

  function normalizeGold(data) {
    const reference =
      data.indiaReference ||
      data.india ||
      null;

    const international =
      data.internationalSpot ||
      data.international ||
      null;

    const rates =
      reference?.rates ||
      reference?.goldRates ||
      {};

    const internationalRates =
      international?.rates ||
      {};

    return {
      source:
        reference?.source ||
        data.source ||
        "Gold reference",

      date:
        reference?.date ||
        data.date ||
        null,

      timestamp:
        data.timestamp ||
        reference?.timestamp ||
        null,

      rates: {
        "24K":
          number(
            rates["24K"]?.perGram ??
            rates["24K"]
          ),

        "22K":
          number(
            rates["22K"]?.perGram ??
            rates["22K"]
          ),

        "18K":
          number(
            rates["18K"]?.perGram ??
            rates["18K"]
          )
      },

      international: {
        "24K":
          number(
            internationalRates["24K"]?.perGram ??
            internationalRates["24K"]
          ),

        "22K":
          number(
            internationalRates["22K"]?.perGram ??
            internationalRates["22K"]
          ),

        "18K":
          number(
            internationalRates["18K"]?.perGram ??
            internationalRates["18K"]
          )
      }
    };
  }

  function renderGold() {
    if (!state.gold) {
      renderGoldError();
      return;
    }

    const rates =
      state.gold.rates;

    updateMany(
      [
        "#gold24",
        "#gold24Price",
        "[data-gold='24K']"
      ],
      money(rates["24K"])
    );

    updateMany(
      [
        "#gold22",
        "#gold22Price",
        "[data-gold='22K']"
      ],
      money(rates["22K"])
    );

    updateMany(
      [
        "#gold18",
        "#gold18Price",
        "[data-gold='18K']"
      ],
      money(rates["18K"])
    );

    const source =
      state.gold.source ||
      "Gold reference";

    updateMany(
      [
        "#goldSource",
        "[data-gold-source]"
      ],
      source
    );

    const updated =
      state.lastGoldUpdate
        ? formatTime(
            state.lastGoldUpdate
          )
        : "";

    updateMany(
      [
        "#goldUpdated",
        "#goldLastUpdated",
        "[data-gold-updated]"
      ],
      updated
    );

    setGoldStatus(
      `Updated ${updated}`
    );
  }

  function renderGoldError() {
    const fallback =
      "Unavailable";

    updateMany(
      [
        "#gold24",
        "#gold24Price",
        "[data-gold='24K']"
      ],
      fallback
    );

    updateMany(
      [
        "#gold22",
        "#gold22Price",
        "[data-gold='22K']"
      ],
      fallback
    );

    updateMany(
      [
        "#gold18",
        "#gold18Price",
        "[data-gold='18K']"
      ],
      fallback
    );
  }

  function setGoldStatus(text) {
    updateMany(
      [
        "#goldStatus",
        "[data-gold-status]"
      ],
      text
    );
  }

  /* =======================================================
     PRODUCTS
     ======================================================= */

  async function loadProducts() {
    state.productsLoading = true;

    renderProductsLoading();

    try {
      const data =
        await fetchJSON(
          API.products,
          {},
          20000
        );

      if (
        !data ||
        data.ok === false
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

      renderProducts();

      updateProductMeta(data);

    } catch (error) {
      console.error(
        "Products error:",
        error
      );

      state.products = [];

      renderProductsError(
        "Products could not be loaded right now."
      );

    } finally {
      state.productsLoading = false;
    }
  }

  function normalizeProduct(product) {
    return {
      ...product,

      sellerId:
        String(
          product.sellerId || ""
        ).toLowerCase(),

      seller:
        product.seller ||
        product.sellerId ||
        "Seller",

      productName:
        product.productName ||
        "Gold Coin",

      purity:
        String(
          product.purity || ""
        ).toUpperCase(),

      weight:
        number(product.weight),

      listedPrice:
        number(product.listedPrice),

      mrp:
        number(product.mrp),

      coupon:
        number(product.coupon),

      cardOffer:
        number(product.cardOffer),

      upiOffer:
        number(product.upiOffer),

      cashback:
        number(product.cashback),

      voucher:
        product.voucher || "",

      promoCode:
        product.promoCode || "",

      offerText:
        product.offerText || "",

      productUrl:
        safeURL(product.productUrl)
    };
  }

  function getFilteredProducts() {
    const products =
      state.products.map(
        normalizeProduct
      );

    const purity =
      getSelectedPurity();

    const seller =
      getSelectedSeller();

    return products.filter(
      product => {
        if (
          purity &&
          product.purity !== purity
        ) {
          return false;
        }

        if (
          seller &&
          seller !== "all" &&
          product.sellerId !== seller
        ) {
          return false;
        }

        return true;
      }
    );
  }

  function renderProducts() {
    const products =
      getFilteredProducts();

    const containers = [
      "#products",
      "#productGrid",
      "#goldProducts",
      "[data-products]"
    ];

    let container = null;

    for (
      const selector of containers
    ) {
      container = $(selector);

      if (container) {
        break;
      }
    }

    if (!container) {
      return;
    }

    if (
      state.productsLoading &&
      state.products.length === 0
    ) {
      renderProductsLoading();
      return;
    }

    if (!products.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>No matching gold coins found</strong>
          <span>Try another purity or seller.</span>
        </div>
      `;

      return;
    }

    /*
     * Group by actual product identity.
     *
     * This is important because comparison must show
     * the same/similar coin from multiple sellers.
     */

    const groups =
      groupProducts(products);

    container.innerHTML =
      groups
        .map(renderProductGroup)
        .join("");

    renderComparisonSummary(groups);
  }

  /* =======================================================
     PRODUCT GROUPING
     ======================================================= */

  function groupProducts(products) {
    const groups = new Map();

    for (
      const product of products
    ) {
      const key =
        productGroupKey(product);

      if (!groups.has(key)) {
        groups.set(
          key,
          []
        );
      }

      groups
        .get(key)
        .push(product);
    }

    return [...groups.values()]
      .map(group =>
        group.sort(
          (a, b) =>
            priceForComparison(a) -
            priceForComparison(b)
        )
      );
  }

  function productGroupKey(product) {
    const name =
      normalizeName(
        product.productName
      );

    return [
      product.purity,
      product.weight,
      name
    ].join("|");
  }

  function normalizeName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(
        /\b(coin|gold|pure|plain|22k|24k|18k|kt|karat)\b/g,
        " "
      )
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function priceForComparison(product) {
    const price =
      number(
        product.listedPrice
      );

    if (price > 0) {
      return price;
    }

    return Number.MAX_SAFE_INTEGER;
  }

  /* =======================================================
     PRODUCT CARD / COMPARISON
     ======================================================= */

  function renderProductGroup(group) {
    const cheapest =
      group.find(
        product =>
          priceForComparison(product) <
          Number.MAX_SAFE_INTEGER
      );

    const title =
      cheapest?.productName ||
      group[0]?.productName ||
      "Gold Coin";

    const purity =
      cheapest?.purity ||
      group[0]?.purity ||
      "";

    const weight =
      cheapest?.weight ||
      group[0]?.weight ||
      0;

    const rows =
      group
        .map(
          product =>
            renderSellerOffer(
              product,
              cheapest
            )
        )
        .join("");

    return `
      <article class="comparison-card">

        <div class="comparison-header">

          <div>
            <h3>
              ${escapeHTML(title)}
            </h3>

            <div class="product-meta">
              ${
                purity
                  ? `<span>${escapeHTML(purity)}</span>`
                  : ""
              }

              ${
                weight
                  ? `<span>${escapeHTML(weight)} g</span>`
                  : ""
              }
            </div>
          </div>

          ${
            cheapest
              ? `
                <div class="lowest-price">
                  <small>Lowest price</small>
                  <strong>
                    ${money(
                      cheapest.listedPrice
                    )}
                  </strong>
                  <span>
                    ${escapeHTML(
                      cheapest.seller
                    )}
                  </span>
                </div>
              `
              : ""
          }

        </div>

        <div class="seller-comparison">
          ${rows}
        </div>

      </article>
    `;
  }

  function renderSellerOffer(
    product,
    cheapest
  ) {
    const url =
      product.productUrl;

    const isLowest =
      cheapest &&
      product === cheapest;

    const offerHTML =
      renderOffersInline(
        product
      );

    return `
      <div class="seller-row ${
        isLowest
          ? "is-lowest"
          : ""
      }">

        <div class="seller-info">

          <strong>
            ${escapeHTML(
              product.seller
            )}
          </strong>

          ${
            isLowest
              ? `
                <span class="lowest-badge">
                  LOWEST
                </span>
              `
              : ""
          }

        </div>

        <div class="seller-price">
          <strong>
            ${money(
              product.listedPrice
            )}
          </strong>

          ${
            product.mrp &&
            product.mrp >
              product.listedPrice
              ? `
                <del>
                  ${money(
                    product.mrp
                  )}
                </del>
              `
              : ""
          }
        </div>

        <div class="seller-offers">
          ${offerHTML}
        </div>

        <div class="seller-action">

          ${
            url
              ? `
                <a
                  class="product-link"
                  href="${escapeHTML(url)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View exact product
                </a>
              `
              : `
                <span class="no-link">
                  Link unavailable
                </span>
              `
          }

        </div>

      </div>
    `;
  }

  /* =======================================================
     OFFERS
     ======================================================= */

  function renderOffersInline(product) {
    const offers = [];

    if (product.coupon > 0) {
      offers.push(
        `Coupon ${money(product.coupon)}`
      );
    }

    if (product.cardOffer > 0) {
      offers.push(
        `Card ${money(product.cardOffer)}`
      );
    }

    if (product.upiOffer > 0) {
      offers.push(
        `UPI ${money(product.upiOffer)}`
      );
    }

    if (product.cashback > 0) {
      offers.push(
        `Cashback ${money(product.cashback)}`
      );
    }

    if (product.voucher) {
      offers.push(
        `Voucher: ${product.voucher}`
      );
    }

    if (product.promoCode) {
      offers.push(
        `Promo: ${product.promoCode}`
      );
    }

    if (product.offerText) {
      offers.push(
        product.offerText
      );
    }

    if (!offers.length) {
      return `
        <span class="no-offer">
          No offer listed
        </span>
      `;
    }

    return offers
      .map(
        offer =>
          `<span class="offer-chip">
            ${escapeHTML(offer)}
          </span>`
      )
      .join("");
  }

  async function loadOffers() {
    state.offersLoading = true;

    try {
      const data =
        await fetchJSON(
          API.offers,
          {},
          18000
        );

      state.offers =
        Array.isArray(data?.offers)
          ? data.offers
          : [];

      renderOffers();

    } catch (error) {
      console.error(
        "Offers error:",
        error
      );

      state.offers = [];

      renderOffersError();

    } finally {
      state.offersLoading = false;
    }
  }

  function renderOffers() {
    const container =
      $(
        "#offers"
      ) ||
      $(
        "#offersGrid"
      ) ||
      $(
        "[data-offers]"
      );

    if (!container) {
      return;
    }

    if (!state.offers.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>No separate offers found</strong>
          <span>
            Product-specific offers are shown
            in the comparison cards when available.
          </span>
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.offers
        .map(
          offer => `
            <article class="offer-card">

              <strong>
                ${escapeHTML(
                  offer.seller
                )}
              </strong>

              <span>
                ${escapeHTML(
                  offer.productName
                )}
              </span>

              ${
                offer.offerText
                  ? `<p>${escapeHTML(
                      offer.offerText
                    )}</p>`
                  : ""
              }

              ${
                offer.promoCode
                  ? `
                    <code>
                      ${escapeHTML(
                        offer.promoCode
                      )}
                    </code>
                  `
                  : ""
              }

              ${
                offer.productUrl
                  ? `
                    <a
                      href="${escapeHTML(
                        safeURL(
                          offer.productUrl
                        )
                      )}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View product
                    </a>
                  `
                  : ""
              }

            </article>
          `
        )
        .join("");
  }

  /* =======================================================
     SELLERS
     ======================================================= */

  async function loadSellers() {
    try {
      const data =
        await fetchJSON(
          API.sellers,
          {},
          12000
        );

      state.sellers =
        Array.isArray(data?.sellers)
          ? data.sellers
          : [];

      renderSellerFilters();

    } catch (error) {
      console.error(
        "Sellers error:",
        error
      );

      state.sellers = [];
    }
  }

  function renderSellerFilters() {
    const select =
      $(
        "#sellerFilter"
      );

    if (
      !select ||
      !state.sellers.length
    ) {
      return;
    }

    const current =
      select.value || "all";

    select.innerHTML = `
      <option value="all">
        All sellers
      </option>

      ${
        state.sellers
          .map(
            seller => `
              <option
                value="${escapeHTML(
                  seller.id
                )}"
              >
                ${escapeHTML(
                  seller.name
                )}
              </option>
            `
          )
          .join("")
      }
    `;

    select.value =
      current;
  }

  /* =======================================================
     FILTERS
     ======================================================= */

  function getSelectedPurity() {
    const select =
      $(
        "#purityFilter"
      );

    if (select) {
      return (
        select.value || ""
      ).toUpperCase();
    }

    const active =
      $(
        "[data-purity].active"
      );

    return (
      active?.dataset?.purity ||
      ""
    ).toUpperCase();
  }

  function getSelectedSeller() {
    const select =
      $(
        "#sellerFilter"
      );

    return (
      select?.value ||
      "all"
    ).toLowerCase();
  }

  function setActivePurity(value) {
    $$(
      "[data-purity]"
    ).forEach(
      element => {
        element.classList.toggle(
          "active",
          String(
            element.dataset.purity
          ).toUpperCase() ===
            String(value)
              .toUpperCase()
        );
      }
    );

    const select =
      $(
        "#purityFilter"
      );

    if (select) {
      select.value =
        value;
    }
  }

  function setActiveSeller(value) {
    const select =
      $(
        "#sellerFilter"
      );

    if (select) {
      select.value =
        value;
    }
  }

  /* =======================================================
     COMPARISON SUMMARY
     ======================================================= */

  function renderComparisonSummary(
    groups
  ) {
    const container =
      $(
        "#comparisonSummary"
      ) ||
      $(
        "[data-comparison-summary]"
      );

    if (!container) {
      return;
    }

    let sellerCount = 0;
    let productCount = 0;

    groups.forEach(
      group => {
        productCount += 1;
        sellerCount += group.length;
      }
    );

    container.innerHTML = `
      <span>
        ${productCount}
        comparable products
      </span>

      <span>
        ${sellerCount}
        seller prices
      </span>
    `;
  }

  /* =======================================================
     LOADING / ERROR STATES
     ======================================================= */

  function renderProductsLoading() {
    const container =
      $(
        "#products"
      ) ||
      $(
        "#productGrid"
      ) ||
      $(
        "#goldProducts"
      ) ||
      $(
        "[data-products]"
      );

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="loading-state">
        Loading gold coins...
      </div>
    `;
  }

  function renderProductsError(
    message
  ) {
    const container =
      $(
        "#products"
      ) ||
      $(
        "#productGrid"
      ) ||
      $(
        "#goldProducts"
      ) ||
      $(
        "[data-products]"
      );

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="error-state">
        ${escapeHTML(message)}
      </div>
    `;
  }

  function renderOffersLoading() {
    const container =
      $(
        "#offers"
      ) ||
      $(
        "#offersGrid"
      ) ||
      $(
        "[data-offers]"
      );

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="loading-state">
        Loading offers...
      </div>
    `;
  }

  function renderOffersError() {
    const container =
      $(
        "#offers"
      ) ||
      $(
        "#offersGrid"
      ) ||
      $(
        "[data-offers]"
      );

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="empty-state">
        Offers unavailable right now.
      </div>
    `;
  }

  /* =======================================================
     META
     ======================================================= */

  function updateProductMeta(data) {
    const count =
      number(
        data?.count ??
        state.products.length
      );

    updateMany(
      [
        "#productCount",
        "[data-product-count]"
      ],
      String(count)
    );

    const source =
      data?.source ||
      "";

    updateMany(
      [
        "#productSource",
        "[data-product-source]"
      ],
      source
    );

    if (
      data?.cacheUsed
    ) {
      updateMany(
        [
          "#productStatus",
          "[data-product-status]"
        ],
        "Showing cached product data"
      );
    } else {
      updateMany(
        [
          "#productStatus",
          "[data-product-status]"
        ],
        "Product data updated"
      );
    }
  }

  /* =======================================================
     GENERIC HELPERS
     ======================================================= */

  function updateMany(
    selectors,
    value
  ) {
    selectors.forEach(
      selector => {
        $$(selector).forEach(
          element => {
            element.textContent =
              value;
          }
        );
      }
    );
  }

  function formatTime(date) {
    if (!date) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat(
        "en-IN",
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }
      ).format(date);
    } catch {
      return date.toLocaleTimeString();
    }
  }

  /* =======================================================
     PUBLIC DEBUG API
     ======================================================= */

  window.GoldMania = {
    state,

    reloadGold: loadGold,
    reloadProducts: loadProducts,
    reloadOffers: loadOffers,

    reloadAll: async () => {
      await Promise.allSettled([
        loadGold(),
        loadProducts(),
        loadOffers(),
        loadSellers()
      ]);

      renderAll();
    },

    getAPIBase: () =>
      API_BASE
  };

  /* =======================================================
     RENDER ALL
     ======================================================= */

  function renderAll() {
    renderGold();
    renderProducts();
    renderOffers();
    renderSellerFilters();
  }

})();

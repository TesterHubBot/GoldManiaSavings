/* =========================================================
   GoldManiaSavings - Frontend app.js
   API: Cloudflare Worker
========================================================= */

"use strict";

/* =========================================================
   API CONFIG
========================================================= */

const API_BASE =
  "https://goldmaniasavings-api.onlinetechmine.workers.dev";


/* =========================================================
   API HELPER
========================================================= */

async function apiFetch(path, options = {}) {

  const url =
    `${API_BASE}${path}`;

  const response =
    await fetch(url, {
      ...options,
      headers: {
        "Accept": "application/json",
        ...(options.headers || {})
      },
      cache: "no-store"
    });

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error(
      `Invalid API response (${response.status})`
    );
  }

  if (!response.ok || data?.ok === false) {

    throw new Error(
      data?.message ||
      `API request failed (${response.status})`
    );

  }

  return data;
}


/* =========================================================
   SAFE HELPERS
========================================================= */

function numberValue(value, fallback = 0) {

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}


function money(value) {

  const amount =
    numberValue(value);

  if (!amount) {
    return "₹0";
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


function safeText(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);

}


function safeUrl(value) {

  if (!value) {
    return "";
  }

  if (
    typeof value === "object"
  ) {

    return (
      value.url ||
      value.href ||
      value.link ||
      ""
    );

  }

  return String(value);

}


function escapeHTML(value) {

  return safeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================================================
   GLOBAL STATE
========================================================= */

const state = {

  gold: null,

  products: [],

  offers: [],

  history: [],

  loading: {

    gold: false,

    products: false,

    offers: false,

    history: false

  },

  filters: {

    purity: "",

    weight: "",

    seller: ""

  }

};


/* =========================================================
   DOM HELPERS
========================================================= */

function findElement(...ids) {

  for (const id of ids) {

    const element =
      document.getElementById(id);

    if (element) {
      return element;
    }

  }

  return null;
}


function setText(
  ids,
  value
) {

  const list =
    Array.isArray(ids)
      ? ids
      : [ids];

  for (const id of list) {

    const element =
      document.getElementById(id);

    if (element) {

      element.textContent =
        value;

    }

  }

}


function setHTML(
  ids,
  value
) {

  const list =
    Array.isArray(ids)
      ? ids
      : [ids];

  for (const id of list) {

    const element =
      document.getElementById(id);

    if (element) {

      element.innerHTML =
        value;

    }

  }

}


/* =========================================================
   GOLD API
========================================================= */

async function loadGold() {

  state.loading.gold = true;

  setText(
    [
      "gold24",
      "gold24k",
      "price24",
      "rate24"
    ],
    "Loading..."
  );

  setText(
    [
      "gold22",
      "gold22k",
      "price22",
      "rate22"
    ],
    "Loading..."
  );

  setText(
    [
      "gold18",
      "gold18k",
      "price18",
      "rate18"
    ],
    "Loading..."
  );

  try {

    const data =
      await apiFetch(
        "/api/gold"
      );

    state.gold =
      data;

    const rates =
      data?.indiaReference?.rates || {};

    const rate24 =
      numberValue(
        rates?.["24K"]?.perGram
      );

    const rate22 =
      numberValue(
        rates?.["22K"]?.perGram
      );

    const rate18 =
      numberValue(
        rates?.["18K"]?.perGram
      );


    setText(
      [
        "gold24",
        "gold24k",
        "price24",
        "rate24"
      ],
      rate24
        ? money(rate24)
        : "Unavailable"
    );


    setText(
      [
        "gold22",
        "gold22k",
        "price22",
        "rate22"
      ],
      rate22
        ? money(rate22)
        : "Unavailable"
    );


    setText(
      [
        "gold18",
        "gold18k",
        "price18",
        "rate18"
      ],
      rate18
        ? money(rate18)
        : "Unavailable"
    );


    const source =
      data?.indiaReference?.source ||
      "India gold reference";


    setText(
      [
        "goldSource",
        "gold-source"
      ],
      source
    );


    const updated =
      data?.timestamp
        ? new Date(
            data.timestamp
          ).toLocaleString(
            "en-IN"
          )
        : "";


    setText(
      [
        "goldUpdated",
        "gold-updated",
        "updatedAt"
      ],
      updated
    );


    return data;

  } catch (error) {

    console.error(
      "Gold API error:",
      error
    );


    setText(
      [
        "gold24",
        "gold24k",
        "price24",
        "rate24"
      ],
      "Unavailable"
    );


    setText(
      [
        "gold22",
        "gold22k",
        "price22",
        "rate22"
      ],
      "Unavailable"
    );


    setText(
      [
        "gold18",
        "gold18k",
        "price18",
        "rate18"
      ],
      "Unavailable"
    );


    setText(
      [
        "goldError",
        "gold-error"
      ],
      error.message
    );

  } finally {

    state.loading.gold =
      false;

  }

}


/* =========================================================
   PRODUCTS API
========================================================= */

async function loadProducts() {

  state.loading.products =
    true;


  const params =
    new URLSearchParams();


  if (
    state.filters.purity
  ) {

    params.set(
      "purity",
      state.filters.purity
    );

  }


  if (
    state.filters.weight
  ) {

    params.set(
      "weight",
      state.filters.weight
    );

  }


  if (
    state.filters.seller
  ) {

    params.set(
      "seller",
      state.filters.seller
    );

  }


  const query =
    params.toString()
      ? `?${params.toString()}`
      : "";


  try {

    const data =
      await apiFetch(
        `/api/products${query}`
      );


    state.products =
      Array.isArray(
        data.products
      )
        ? data.products
        : [];


    renderProducts(
      state.products
    );


    setText(
      [
        "productCount",
        "productsCount",
        "count"
      ],
      state.products.length
    );


    setText(
      [
        "productUpdated",
        "productsUpdated"
      ],
      data.updatedAt
        ? new Date(
            data.updatedAt
          ).toLocaleString(
            "en-IN"
          )
        : ""
    );


    return data;

  } catch (error) {

    console.error(
      "Products API error:",
      error
    );


    state.products =
      [];


    renderProductError(
      error.message
    );

  } finally {

    state.loading.products =
      false;

  }

}


/* =========================================================
   PRODUCT RENDER
========================================================= */

function renderProducts(
  products
) {

  const container =
    findElement(
      "products",
      "productList",
      "productsGrid",
      "goldProducts"
    );


  if (!container) {
    return;
  }


  if (
    !Array.isArray(products) ||
    products.length === 0
  ) {

    container.innerHTML = `
      <div class="empty-products">
        <strong>No products found</strong>
        <div>
          Try another purity, weight or seller.
        </div>
      </div>
    `;

    return;

  }


  container.innerHTML =
    products.map(
      renderProductCard
    ).join("");

}


function renderProductError(
  message
) {

  const container =
    findElement(
      "products",
      "productList",
      "productsGrid",
      "goldProducts"
    );


  if (!container) {
    return;
  }


  container.innerHTML = `
    <div class="api-error">
      <strong>Products unavailable</strong>
      <div>${escapeHTML(message)}</div>
      <button type="button"
              onclick="window.GoldMania.reloadProducts()">
        Retry
      </button>
    </div>
  `;

}


function renderProductCard(
  product
) {

  const name =
    product.productName ||
    "Gold Product";


  const seller =
    product.seller ||
    product.source ||
    product.sellerId ||
    "Seller";


  const purity =
    product.purity ||
    "";


  const weight =
    numberValue(
      product.weight
    );


  const price =
    numberValue(
      product.listedPrice
    );


  const mrp =
    numberValue(
      product.mrp
    );


  const shipping =
    numberValue(
      product.shipping
    );


  const coupon =
    numberValue(
      product.coupon
    );


  const cardOffer =
    numberValue(
      product.cardOffer
    );


  const upiOffer =
    numberValue(
      product.upiOffer
    );


  const cashback =
    numberValue(
      product.cashback
    );


  const voucher =
    safeText(
      product.voucher
    );


  const promoCode =
    safeText(
      product.promoCode
    );


  const offerText =
    safeText(
      product.offerText
    );


  const productUrl =
    safeUrl(
      product.productUrl
    );


  const offerParts = [];


  if (coupon > 0) {

    offerParts.push(
      `Coupon: ${money(coupon)}`
    );

  }


  if (cardOffer > 0) {

    offerParts.push(
      `Card: ${money(cardOffer)}`
    );

  }


  if (upiOffer > 0) {

    offerParts.push(
      `UPI: ${money(upiOffer)}`
    );

  }


  if (cashback > 0) {

    offerParts.push(
      `Cashback: ${money(cashback)}`
    );

  }


  if (voucher) {

    offerParts.push(
      `Voucher: ${voucher}`
    );

  }


  if (promoCode) {

    offerParts.push(
      `Promo: ${promoCode}`
    );

  }


  if (offerText) {

    offerParts.push(
      offerText
    );

  }


  const offersHTML =
    offerParts.length
      ? `
        <div class="product-offers">
          ${offerParts
            .map(
              offer =>
                `<span class="offer">
                  ${escapeHTML(offer)}
                </span>`
            )
            .join("")}
        </div>
      `
      : "";


  const priceHTML =
    price > 0
      ? money(price)
      : "Price unavailable";


  const mrpHTML =
    mrp > price
      ? `
        <span class="product-mrp">
          ${money(mrp)}
        </span>
      `
      : "";


  const linkHTML =
    productUrl
      ? `
        <a
          class="product-link"
          href="${escapeHTML(productUrl)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          View product
        </a>
      `
      : `
        <span class="product-link disabled">
          Product link unavailable
        </span>
      `;


  return `
    <article
      class="product-card"
      data-seller="${escapeHTML(seller)}"
      data-purity="${escapeHTML(purity)}"
      data-weight="${weight}"
    >

      <div class="product-seller">
        ${escapeHTML(seller)}
      </div>

      <h3 class="product-name">
        ${escapeHTML(name)}
      </h3>

      <div class="product-meta">

        ${
          purity
            ? `<span>${escapeHTML(purity)}</span>`
            : ""
        }

        ${
          weight
            ? `<span>${weight} g</span>`
            : ""
        }

      </div>

      <div class="product-price">
        ${priceHTML}
        ${mrpHTML}
      </div>

      ${
        shipping > 0
          ? `
            <div class="product-shipping">
              Shipping: ${money(shipping)}
            </div>
          `
          : ""
      }

      ${offersHTML}

      ${linkHTML}

    </article>
  `;

}


/* =========================================================
   OFFERS API
========================================================= */

async function loadOffers() {

  state.loading.offers =
    true;


  try {

    const data =
      await apiFetch(
        "/api/offers"
      );


    state.offers =
      Array.isArray(
        data.offers
      )
        ? data.offers
        : [];


    renderOffers(
      state.offers
    );


    setText(
      [
        "offerCount",
        "offersCount"
      ],
      state.offers.length
    );


    return data;

  } catch (error) {

    console.error(
      "Offers API error:",
      error
    );


    renderOfferError(
      error.message
    );

  } finally {

    state.loading.offers =
      false;

  }

}


function renderOffers(
  offers
) {

  const container =
    findElement(
      "offers",
      "offerList",
      "offersGrid"
    );


  if (!container) {
    return;
  }


  if (
    !offers.length
  ) {

    container.innerHTML = `
      <div class="empty-offers">
        No visible offers currently found.
      </div>
    `;

    return;

  }


  container.innerHTML =
    offers.map(
      offer => {

        const details = [];


        if (
          numberValue(
            offer.coupon
          ) > 0
        ) {

          details.push(
            `Coupon: ${money(offer.coupon)}`
          );

        }


        if (
          numberValue(
            offer.cardOffer
          ) > 0
        ) {

          details.push(
            `Card: ${money(offer.cardOffer)}`
          );

        }


        if (
          numberValue(
            offer.upiOffer
          ) > 0
        ) {

          details.push(
            `UPI: ${money(offer.upiOffer)}`
          );

        }


        if (
          numberValue(
            offer.cashback
          ) > 0
        ) {

          details.push(
            `Cashback: ${money(offer.cashback)}`
          );

        }


        return `
          <div class="offer-card">

            <div class="offer-seller">
              ${escapeHTML(
                offer.seller || ""
              )}
            </div>

            <div class="offer-product">
              ${escapeHTML(
                offer.productName || ""
              )}
            </div>

            <div class="offer-details">
              ${
                details.length
                  ? details
                      .map(
                        escapeHTML
                      )
                      .join(" • ")
                  : "Offer details available on product page"
              }
            </div>

          </div>
        `;

      }
    ).join("");

}


function renderOfferError(
  message
) {

  const container =
    findElement(
      "offers",
      "offerList",
      "offersGrid"
    );


  if (!container) {
    return;
  }


  container.innerHTML = `
    <div class="api-error">
      ${escapeHTML(message)}
    </div>
  `;

}


/* =========================================================
   HISTORY API
========================================================= */

async function loadHistory() {

  state.loading.history =
    true;


  try {

    const data =
      await apiFetch(
        "/api/history"
      );


    state.history =
      Array.isArray(
        data.history
      )
        ? data.history
        : [];


    renderHistory(
      state.history
    );


    return data;

  } catch (error) {

    console.error(
      "History API error:",
      error
    );


    renderHistoryError(
      error.message
    );

  } finally {

    state.loading.history =
      false;

  }

}


function renderHistory(
  history
) {

  const container =
    findElement(
      "history",
      "historyList",
      "goldHistory"
    );


  if (!container) {
    return;
  }


  if (!history.length) {

    container.innerHTML = `
      <div class="empty-history">
        No gold history available.
      </div>
    `;

    return;

  }


  const latest =
    [...history]
      .reverse();


  container.innerHTML =
    latest
      .map(
        item => {

          const rates =
            item.rates || {};


          const timestamp =
            item.timestamp
              ? new Date(
                  item.timestamp
                ).toLocaleString(
                  "en-IN"
                )
              : "";


          return `
            <div class="history-row">

              <div>
                ${escapeHTML(
                  timestamp
                )}
              </div>

              <div>
                24K:
                ${money(
                  rates["24K"]
                )}
              </div>

              <div>
                22K:
                ${money(
                  rates["22K"]
                )}
              </div>

              <div>
                18K:
                ${money(
                  rates["18K"]
                )}
              </div>

            </div>
          `;

        }
      )
      .join("");

}


function renderHistoryError(
  message
) {

  const container =
    findElement(
      "history",
      "historyList",
      "goldHistory"
    );


  if (!container) {
    return;
  }


  container.innerHTML = `
    <div class="api-error">
      ${escapeHTML(message)}
    </div>
  `;

}


/* =========================================================
   FILTERS
========================================================= */

function setupFilters() {

  const purity =
    findElement(
      "purityFilter",
      "purity"
    );


  const weight =
    findElement(
      "weightFilter",
      "weight"
    );


  const seller =
    findElement(
      "sellerFilter",
      "seller"
    );


  if (purity) {

    purity.addEventListener(
      "change",
      () => {

        state.filters.purity =
          purity.value;

        loadProducts();

      }
    );

  }


  if (weight) {

    weight.addEventListener(
      "change",
      () => {

        state.filters.weight =
          weight.value;

        loadProducts();

      }
    );

  }


  if (seller) {

    seller.addEventListener(
      "change",
      () => {

        state.filters.seller =
          seller.value;

        loadProducts();

      }
    );

  }

}


/* =========================================================
   WEIGHT FILTER OPTIONS
   Automatically adds weights from API
========================================================= */

function populateWeightFilter() {

  const select =
    findElement(
      "weightFilter",
      "weight"
    );


  if (!select) {
    return;
  }


  const existing =
    new Set();


  Array.from(
    select.options
  ).forEach(
    option => {

      if (option.value) {
        existing.add(
          option.value
        );
      }

    }
  );


  const weights =
    state.products
      .map(
        product =>
          numberValue(
            product.weight
          )
      )
      .filter(
        weight =>
          weight > 0
      );


  const uniqueWeights =
    [...new Set(weights)]
      .sort(
        (a, b) =>
          a - b
      );


  uniqueWeights.forEach(
    weight => {

      const value =
        String(weight);


      if (
        existing.has(value)
      ) {
        return;
      }


      const option =
        document.createElement(
          "option"
        );


      option.value =
        value;


      option.textContent =
        `${weight} g`;


      select.appendChild(
        option
      );

    }
  );

}


/* =========================================================
   SELLER FILTER OPTIONS
========================================================= */

function populateSellerFilter() {

  const select =
    findElement(
      "sellerFilter",
      "seller"
    );


  if (!select) {
    return;
  }


  const existing =
    new Set();


  Array.from(
    select.options
  ).forEach(
    option => {

      if (option.value) {
        existing.add(
          option.value
        );
      }

    }
  );


  const sellers =
    state.products
      .map(
        product =>
          product.seller
      )
      .filter(Boolean);


  [...new Set(sellers)]
    .sort()
    .forEach(
      seller => {

        if (
          existing.has(seller)
        ) {
          return;
        }


        const option =
          document.createElement(
            "option"
          );


        option.value =
          seller;


        option.textContent =
          seller;


        select.appendChild(
          option
        );

      }
    );

}


/* =========================================================
   REFRESH
========================================================= */

async function loadAll() {

  await Promise.allSettled([

    loadGold(),

    loadProducts(),

    loadOffers(),

    loadHistory()

  ]);


  populateWeightFilter();

  populateSellerFilter();

}


/* =========================================================
   PUBLIC API
========================================================= */

window.GoldMania = {

  reload: loadAll,

  reloadGold: loadGold,

  reloadProducts: loadProducts,

  reloadOffers: loadOffers,

  reloadHistory: loadHistory,

  getState() {

    return state;

  }

};


/* =========================================================
   START
========================================================= */

function init() {

  setupFilters();

  loadAll();

}


/* =========================================================
   DOM READY
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

} else {

  init();

}

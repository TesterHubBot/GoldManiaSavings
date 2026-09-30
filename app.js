/* =========================================================
   GoldManiaSavings - Frontend
   Cloudflare Worker API
========================================================= */

"use strict";

/* =========================================================
   CONFIG
========================================================= */

const API_BASE =
  "https://goldmaniasavings-api.onlinetechmine.workers.dev";

const API = {
  gold: `${API_BASE}/api/gold`,
  products: `${API_BASE}/api/products`,
  offers: `${API_BASE}/api/offers`,
  history: `${API_BASE}/api/history`
};


/* =========================================================
   STATE
========================================================= */

const state = {
  gold: null,
  products: [],
  offers: [],
  history: [],
  filters: {
    purity: "",
    weight: "",
    seller: ""
  }
};


/* =========================================================
   HELPERS
========================================================= */

function $(id) {
  return document.getElementById(id);
}


function firstElement(...ids) {
  for (const id of ids) {
    const el = $(id);
    if (el) return el;
  }
  return null;
}


function setText(ids, value) {

  if (!Array.isArray(ids)) {
    ids = [ids];
  }

  ids.forEach(id => {

    const el = $(id);

    if (el) {
      el.textContent = value;
    }

  });
}


function numberValue(value, fallback = 0) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const n = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/[₹]/g, "")
      .trim()
  );

  return Number.isFinite(n)
    ? n
    : fallback;
}


function money(value) {

  const n = numberValue(value);

  if (!n) {
    return "₹0";
  }

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }
  ).format(n);
}


function text(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}


function escapeHTML(value) {

  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function getUrl(value) {

  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {

    return (
      value.url ||
      value.href ||
      value.link ||
      value.productUrl ||
      ""
    );

  }

  return "";
}


/* =========================================================
   API FETCH
========================================================= */

async function apiFetch(url) {

  console.log("[GoldMania] API:", url);

  const response = await fetch(
    url,
    {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    }
  );

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  let data;

  if (
    contentType.includes(
      "application/json"
    )
  ) {

    data = await response.json();

  } else {

    const raw =
      await response.text();

    throw new Error(
      `API returned non-JSON response (${response.status}): ${raw.slice(0, 120)}`
    );

  }


  if (!response.ok) {

    throw new Error(
      data?.message ||
      `HTTP ${response.status}`
    );

  }


  if (
    data &&
    data.ok === false
  ) {

    throw new Error(
      data.message ||
      "API returned ok:false"
    );

  }


  return data;

}


/* =========================================================
   GOLD
========================================================= */

async function loadGold() {

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
        API.gold
      );


    console.log(
      "[GoldMania] GOLD:",
      data
    );


    state.gold = data;


    const india =
      data?.indiaReference ||
      data?.india ||
      data?.reference ||
      {};


    const rates =
      india?.rates ||
      data?.rates ||
      {};


    const rate24 =
      extractRate(
        rates,
        "24K"
      );


    const rate22 =
      extractRate(
        rates,
        "22K"
      );


    const rate18 =
      extractRate(
        rates,
        "18K"
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


    setText(
      [
        "goldSource",
        "gold-source",
        "goldSourceName"
      ],
      india?.source ||
      data?.source ||
      "India Reference"
    );


    const updated =
      data?.updatedAt ||
      data?.timestamp ||
      india?.updatedAt ||
      "";


    setText(
      [
        "goldUpdated",
        "gold-updated",
        "updatedAt"
      ],
      updated
        ? formatDate(updated)
        : ""
    );


    return data;

  } catch (error) {

    console.error(
      "[GoldMania] Gold error:",
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
        "gold-error",
        "apiError"
      ],
      error.message
    );


    return null;

  }

}


function extractRate(rates, key) {

  const value =
    rates?.[key];


  if (
    typeof value === "number"
  ) {
    return value;
  }


  if (
    typeof value === "string"
  ) {
    return numberValue(value);
  }


  if (
    typeof value === "object" &&
    value !== null
  ) {

    return numberValue(
      value.perGram ??
      value.price ??
      value.rate ??
      value.value
    );

  }


  return 0;

}


/* =========================================================
   PRODUCTS
========================================================= */

async function loadProducts() {

  const container =
    getProductsContainer();


  if (container) {

    container.innerHTML = `
      <div class="loading-products">
        Loading gold products...
      </div>
    `;

  }


  try {

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


    const data =
      await apiFetch(
        `${API.products}${query}`
      );


    console.log(
      "[GoldMania] PRODUCTS:",
      data
    );


    state.products =
      Array.isArray(
        data?.products
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
        "product-count",
        "count"
      ],
      state.products.length
    );


    setText(
      [
        "productUpdated",
        "productsUpdated"
      ],
      data?.updatedAt
        ? formatDate(
            data.updatedAt
          )
        : ""
    );


    populateFilters();


    return data;

  } catch (error) {

    console.error(
      "[GoldMania] Products error:",
      error
    );


    state.products = [];


    if (container) {

      container.innerHTML = `
        <div class="api-error">
          <strong>Products unavailable</strong>
          <div>${escapeHTML(error.message)}</div>

          <button
            type="button"
            onclick="window.GoldMania.reloadProducts()"
          >
            Retry
          </button>
        </div>
      `;

    }


    return null;

  }

}


/* =========================================================
   PRODUCTS CONTAINER
========================================================= */

function getProductsContainer() {

  return firstElement(
    "products",
    "productList",
    "productsGrid",
    "goldProducts",
    "gold-products",
    "productGrid"
  );

}


/* =========================================================
   PRODUCT RENDER
========================================================= */

function renderProducts(products) {

  const container =
    getProductsContainer();


  if (!container) {

    console.warn(
      "[GoldMania] Product container not found."
    );

    return;

  }


  if (
    !Array.isArray(products) ||
    products.length === 0
  ) {

    container.innerHTML = `
      <div class="empty-products">
        <strong>No gold products found.</strong>
        <div>
          Try another weight, purity or seller.
        </div>
      </div>
    `;

    return;

  }


  container.innerHTML =
    products
      .map(
        renderProduct
      )
      .join("");

}


function renderProduct(product) {

  const seller =
    product?.seller ||
    product?.source ||
    product?.sellerName ||
    product?.sellerId ||
    "Seller";


  const name =
    product?.productName ||
    product?.name ||
    "Gold Product";


  const purity =
    product?.purity ||
    "";


  const weight =
    numberValue(
      product?.weight
    );


  const price =
    numberValue(
      product?.listedPrice ??
      product?.price ??
      product?.salePrice
    );


  const mrp =
    numberValue(
      product?.mrp
    );


  const shipping =
    numberValue(
      product?.shipping
    );


  const productUrl =
    getUrl(
      product?.productUrl ??
      product?.url
    );


  const offers = [];


  if (
    numberValue(
      product?.coupon
    ) > 0
  ) {

    offers.push(
      `Coupon ${money(product.coupon)}`
    );

  }


  if (
    numberValue(
      product?.cardOffer
    ) > 0
  ) {

    offers.push(
      `Card ${money(product.cardOffer)}`
    );

  }


  if (
    numberValue(
      product?.upiOffer
    ) > 0
  ) {

    offers.push(
      `UPI ${money(product.upiOffer)}`
    );

  }


  if (
    numberValue(
      product?.cashback
    ) > 0
  ) {

    offers.push(
      `Cashback ${money(product.cashback)}`
    );

  }


  if (
    product?.voucher
  ) {

    offers.push(
      `Voucher: ${text(product.voucher)}`
    );

  }


  if (
    product?.promoCode
  ) {

    offers.push(
      `Promo: ${text(product.promoCode)}`
    );

  }


  if (
    product?.offerText
  ) {

    offers.push(
      text(product.offerText)
    );

  }


  const offersHTML =
    offers.length
      ? `
        <div class="product-offers">
          ${offers
            .map(
              item =>
                `<span class="offer">
                  ${escapeHTML(item)}
                </span>`
            )
            .join("")}
        </div>
      `
      : "";


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
      : "";


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
        ${
          price
            ? money(price)
            : "Price unavailable"
        }

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
   OFFERS
========================================================= */

async function loadOffers() {

  const container =
    firstElement(
      "offers",
      "offerList",
      "offersGrid",
      "offer-grid"
    );


  if (container) {

    container.innerHTML = `
      <div>
        Loading offers...
      </div>
    `;

  }


  try {

    const data =
      await apiFetch(
        API.offers
      );


    console.log(
      "[GoldMania] OFFERS:",
      data
    );


    state.offers =
      Array.isArray(
        data?.offers
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
      "[GoldMania] Offers error:",
      error
    );


    if (container) {

      container.innerHTML = `
        <div class="api-error">
          Offers unavailable
        </div>
      `;

    }

    return null;

  }

}


function renderOffers(offers) {

  const container =
    firstElement(
      "offers",
      "offerList",
      "offersGrid",
      "offer-grid"
    );


  if (!container) {
    return;
  }


  if (!offers.length) {

    container.innerHTML = `
      <div class="empty-offers">
        No visible offers currently found.
      </div>
    `;

    return;

  }


  container.innerHTML =
    offers
      .map(
        offer => {

          const seller =
            offer?.seller ||
            offer?.source ||
            "";


          const product =
            offer?.productName ||
            "";


          const details = [];


          if (
            offer?.coupon
          ) {

            details.push(
              `Coupon: ${money(offer.coupon)}`
            );

          }


          if (
            offer?.cardOffer
          ) {

            details.push(
              `Card: ${money(offer.cardOffer)}`
            );

          }


          if (
            offer?.upiOffer
          ) {

            details.push(
              `UPI: ${money(offer.upiOffer)}`
            );

          }


          if (
            offer?.cashback
          ) {

            details.push(
              `Cashback: ${money(offer.cashback)}`
            );

          }


          if (
            offer?.voucher
          ) {

            details.push(
              `Voucher: ${text(offer.voucher)}`
            );

          }


          if (
            offer?.promoCode
          ) {

            details.push(
              `Promo: ${text(offer.promoCode)}`
            );

          }


          if (
            offer?.offerText
          ) {

            details.push(
              text(offer.offerText)
            );

          }


          return `
            <div class="offer-card">

              <div class="offer-seller">
                ${escapeHTML(seller)}
              </div>

              <div class="offer-product">
                ${escapeHTML(product)}
              </div>

              <div class="offer-details">
                ${
                  details.length
                    ? details
                        .map(escapeHTML)
                        .join(" • ")
                    : "Visible offer details unavailable"
                }
              </div>

            </div>
          `;

        }
      )
      .join("");

}


/* =========================================================
   HISTORY
========================================================= */

async function loadHistory() {

  const container =
    firstElement(
      "history",
      "historyList",
      "goldHistory"
    );


  try {

    const data =
      await apiFetch(
        API.history
      );


    console.log(
      "[GoldMania] HISTORY:",
      data
    );


    state.history =
      Array.isArray(
        data?.history
      )
        ? data.history
        : [];


    if (!container) {
      return data;
    }


    if (!state.history.length) {

      container.innerHTML = `
        <div>No gold history available.</div>
      `;

      return data;

    }


    container.innerHTML =
      [...state.history]
        .reverse()
        .map(
          item => {

            const rates =
              item?.rates || {};


            return `
              <div class="history-row">

                <div>
                  ${escapeHTML(
                    item?.date ||
                    item?.timestamp ||
                    ""
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


    return data;

  } catch (error) {

    console.error(
      "[GoldMania] History error:",
      error
    );


    if (container) {

      container.innerHTML = `
        <div class="api-error">
          History unavailable
        </div>
      `;

    }


    return null;

  }

}


/* =========================================================
   FILTERS
========================================================= */

function setupFilters() {

  const purity =
    firstElement(
      "purityFilter",
      "purity"
    );


  const weight =
    firstElement(
      "weightFilter",
      "weight"
    );


  const seller =
    firstElement(
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
   POPULATE FILTERS
========================================================= */

function populateFilters() {

  populateWeightFilter();
  populateSellerFilter();

}


function populateWeightFilter() {

  const select =
    firstElement(
      "weightFilter",
      "weight"
    );


  if (!select) {
    return;
  }


  const values =
    new Set(
      Array.from(
        select.options
      )
      .map(
        option =>
          option.value
      )
    );


  const weights =
    state.products
      .map(
        product =>
          numberValue(
            product?.weight
          )
      )
      .filter(
        weight =>
          weight > 0
      );


  [...new Set(weights)]
    .sort(
      (a, b) =>
        a - b
    )
    .forEach(
      weight => {

        const value =
          String(weight);


        if (
          values.has(value)
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


function populateSellerFilter() {

  const select =
    firstElement(
      "sellerFilter",
      "seller"
    );


  if (!select) {
    return;
  }


  const values =
    new Set(
      Array.from(
        select.options
      )
      .map(
        option =>
          option.value
      )
    );


  const sellers =
    state.products
      .map(
        product =>
          product?.seller ||
          product?.source
      )
      .filter(Boolean);


  [...new Set(sellers)]
    .sort()
    .forEach(
      seller => {

        if (
          values.has(seller)
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
   HEALTH CHECK
========================================================= */

async function checkAPI() {

  try {

    const data =
      await apiFetch(
        `${API_BASE}/api/health`
      );


    console.log(
      "[GoldMania] API HEALTH:",
      data
    );


    setText(
      [
        "apiStatus",
        "api-status",
        "connectionStatus"
      ],
      data?.ok
        ? "Connected"
        : "Unavailable"
    );


    return data;

  } catch (error) {

    console.error(
      "[GoldMania] Health error:",
      error
    );


    setText(
      [
        "apiStatus",
        "api-status",
        "connectionStatus"
      ],
      "API unavailable"
    );


    return null;

  }

}


/* =========================================================
   LOAD ALL
========================================================= */

async function loadAll() {

  console.log(
    "[GoldMania] Starting..."
  );


  await checkAPI();


  await Promise.allSettled([
    loadGold(),
    loadProducts(),
    loadOffers(),
    loadHistory()
  ]);


  console.log(
    "[GoldMania] Finished."
  );

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

  checkAPI: checkAPI,

  getState: () => state

};


/* =========================================================
   START
========================================================= */

function init() {

  console.log(
    "[GoldMania] app.js loaded"
  );


  setupFilters();


  loadAll();

}


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

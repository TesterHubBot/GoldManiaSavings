"use strict";

/* =========================================================
   GoldManiaSavings
   Frontend API client
========================================================= */

const API_BASE =
  "https://goldmaniasavings-api.onlinetechmine.workers.dev";

const API = {
  health: API_BASE + "/api/health",
  gold: API_BASE + "/api/gold",
  products: API_BASE + "/api/products",
  offers: API_BASE + "/api/offers",
  history: API_BASE + "/api/history"
};


/* =========================================================
   STATE
========================================================= */

const state = {
  health: null,
  gold: null,
  products: [],
  offers: [],
  history: [],
  errors: []
};


/* =========================================================
   DOM
========================================================= */

function getEl(...ids) {

  for (const id of ids) {

    const el = document.getElementById(id);

    if (el) {
      return el;
    }

  }

  return null;
}


function setText(ids, value) {

  if (!Array.isArray(ids)) {
    ids = [ids];
  }

  ids.forEach(id => {

    const el = document.getElementById(id);

    if (el) {
      el.textContent = value;
    }

  });

}


/* =========================================================
   UTILITIES
========================================================= */

function num(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const n = Number(
    String(value)
      .replace(/₹/g, "")
      .replace(/,/g, "")
      .trim()
  );

  return Number.isFinite(n) ? n : 0;
}


function money(value) {

  const n = num(value);

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


function esc(value) {

  return String(
    value ?? ""
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function dateText(value) {

  if (!value) {
    return "";
  }

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleString("en-IN");
}


/* =========================================================
   API
========================================================= */

async function request(url) {

  console.log(
    "[GoldMania API]",
    url
  );


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


  if (!contentType.includes("json")) {

    const raw =
      await response.text();

    throw new Error(
      "API did not return JSON (" +
      response.status +
      "): " +
      raw.slice(0, 200)
    );

  }


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data?.message ||
      `HTTP ${response.status}`
    );

  }


  return data;

}


/* =========================================================
   HEALTH
========================================================= */

async function loadHealth() {

  try {

    const data =
      await request(API.health);


    state.health =
      data;


    console.log(
      "[GoldMania] HEALTH",
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
      "[GoldMania] HEALTH ERROR",
      error
    );


    setText(
      [
        "apiStatus",
        "api-status",
        "connectionStatus"
      ],
      "API Error"
    );


    state.errors.push(
      "Health: " +
      error.message
    );


    return null;

  }

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
      await request(API.gold);


    state.gold =
      data;


    console.log(
      "[GoldMania] GOLD",
      data
    );


    const reference =
      data?.indiaReference ||
      data?.india ||
      {};


    const rates =
      reference?.rates ||
      data?.rates ||
      {};


    const r24 =
      getRate(
        rates,
        "24K"
      );


    const r22 =
      getRate(
        rates,
        "22K"
      );


    const r18 =
      getRate(
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
      r24
        ? money(r24)
        : "Unavailable"
    );


    setText(
      [
        "gold22",
        "gold22k",
        "price22",
        "rate22"
      ],
      r22
        ? money(r22)
        : "Unavailable"
    );


    setText(
      [
        "gold18",
        "gold18k",
        "price18",
        "rate18"
      ],
      r18
        ? money(r18)
        : "Unavailable"
    );


    setText(
      [
        "goldSource",
        "gold-source"
      ],
      reference?.source ||
      data?.source ||
      ""
    );


    setText(
      [
        "goldUpdated",
        "gold-updated",
        "updatedAt"
      ],
      dateText(
        data?.updatedAt ||
        data?.timestamp
      )
    );


    return data;

  } catch (error) {

    console.error(
      "[GoldMania] GOLD ERROR",
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


    state.errors.push(
      "Gold: " +
      error.message
    );


    return null;

  }

}


function getRate(rates, key) {

  const value =
    rates?.[key];


  if (
    typeof value === "object" &&
    value !== null
  ) {

    return num(
      value.perGram ??
      value.rate ??
      value.price ??
      value.value
    );

  }


  return num(value);

}


/* =========================================================
   PRODUCTS
========================================================= */

async function loadProducts() {

  const container =
    getEl(
      "products",
      "productList",
      "productsGrid",
      "goldProducts",
      "gold-products",
      "productGrid"
    );


  if (container) {

    container.innerHTML = `
      <div class="loading-products">
        Loading products...
      </div>
    `;

  }


  try {

    const data =
      await request(
        API.products
      );


    console.log(
      "[GoldMania] PRODUCTS",
      data
    );


    state.products =
      Array.isArray(
        data?.products
      )
        ? data.products
        : [];


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
      dateText(
        data?.updatedAt
      )
    );


    renderProducts();


    populateFilters();


    return data;

  } catch (error) {

    console.error(
      "[GoldMania] PRODUCTS ERROR",
      error
    );


    state.products = [];


    if (container) {

      container.innerHTML = `
        <div class="api-error">

          <strong>
            Products could not be loaded
          </strong>

          <p>
            ${esc(error.message)}
          </p>

          <button
            type="button"
            onclick="GoldMania.reloadProducts()"
          >
            Retry
          </button>

        </div>
      `;

    }


    state.errors.push(
      "Products: " +
      error.message
    );


    return null;

  }

}


/* =========================================================
   PRODUCT RENDER
========================================================= */

function renderProducts() {

  const container =
    getEl(
      "products",
      "productList",
      "productsGrid",
      "goldProducts",
      "gold-products",
      "productGrid"
    );


  if (!container) {

    console.warn(
      "[GoldMania] NO PRODUCT CONTAINER FOUND"
    );

    return;

  }


  if (!state.products.length) {

    container.innerHTML = `
      <div class="empty-products">
        No products found.
      </div>
    `;

    return;

  }


  container.innerHTML =
    state.products
      .map(productCard)
      .join("");

}


function productCard(product) {

  const seller =
    product?.seller ||
    product?.source ||
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
    num(product?.weight);


  const price =
    num(
      product?.listedPrice ??
      product?.price ??
      product?.salePrice
    );


  const mrp =
    num(product?.mrp);


  const url =
    getProductUrl(
      product?.productUrl ||
      product?.url
    );


  const offers = [];


  if (
    num(product?.coupon)
  ) {

    offers.push(
      "Coupon: " +
      money(product.coupon)
    );

  }


  if (
    num(product?.cardOffer)
  ) {

    offers.push(
      "Card: " +
      money(product.cardOffer)
    );

  }


  if (
    num(product?.upiOffer)
  ) {

    offers.push(
      "UPI: " +
      money(product.upiOffer)
    );

  }


  if (
    num(product?.cashback)
  ) {

    offers.push(
      "Cashback: " +
      money(product.cashback)
    );

  }


  if (
    product?.voucher
  ) {

    offers.push(
      "Voucher: " +
      product.voucher
    );

  }


  if (
    product?.promoCode
  ) {

    offers.push(
      "Promo: " +
      product.promoCode
    );

  }


  if (
    product?.offerText
  ) {

    offers.push(
      product.offerText
    );

  }


  return `
    <article class="product-card">

      <div class="product-seller">
        ${esc(seller)}
      </div>

      <h3 class="product-name">
        ${esc(name)}
      </h3>

      <div class="product-meta">

        ${
          purity
            ? `<span>${esc(purity)}</span>`
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

        ${
          mrp > price
            ? `
              <del>
                ${money(mrp)}
              </del>
            `
            : ""
        }

      </div>

      ${
        offers.length
          ? `
            <div class="product-offers">

              ${offers
                .map(
                  item =>
                    `<div class="offer">
                      ${esc(item)}
                    </div>`
                )
                .join("")}

            </div>
          `
          : ""
      }

      ${
        url
          ? `
            <a
              href="${esc(url)}"
              target="_blank"
              rel="noopener noreferrer"
              class="product-link"
            >
              View Product
            </a>
          `
          : ""
      }

    </article>
  `;

}


function getProductUrl(value) {

  if (!value) {
    return "";
  }


  if (
    typeof value === "string"
  ) {

    return value;

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


  return "";

}


/* =========================================================
   OFFERS
========================================================= */

async function loadOffers() {

  const container =
    getEl(
      "offers",
      "offerList",
      "offersGrid"
    );


  try {

    const data =
      await request(
        API.offers
      );


    state.offers =
      Array.isArray(
        data?.offers
      )
        ? data.offers
        : [];


    if (!container) {
      return data;
    }


    if (!state.offers.length) {

      container.innerHTML = `
        <div>
          No visible offers currently found.
        </div>
      `;

      return data;

    }


    container.innerHTML =
      state.offers
        .map(
          offer => `
            <div class="offer-card">

              <strong>
                ${esc(
                  offer?.seller ||
                  offer?.source ||
                  ""
                )}
              </strong>

              <div>
                ${esc(
                  offer?.productName ||
                  ""
                )}
              </div>

              <div>
                ${esc(
                  offer?.offerText ||
                  offer?.promoCode ||
                  offer?.voucher ||
                  ""
                )}
              </div>

            </div>
          `
        )
        .join("");


    return data;

  } catch (error) {

    console.error(
      "[GoldMania] OFFERS ERROR",
      error
    );


    if (container) {

      container.innerHTML = `
        <div class="api-error">
          Offers unavailable:
          ${esc(error.message)}
        </div>
      `;

    }


    return null;

  }

}


/* =========================================================
   HISTORY
========================================================= */

async function loadHistory() {

  const container =
    getEl(
      "history",
      "historyList",
      "goldHistory"
    );


  try {

    const data =
      await request(
        API.history
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


    container.innerHTML =
      state.history
        .slice()
        .reverse()
        .map(
          item => {

            const rates =
              item?.rates || {};


            return `
              <div class="history-row">

                <span>
                  ${esc(
                    item?.date ||
                    item?.timestamp ||
                    ""
                  )}
                </span>

                <span>
                  24K ${money(
                    rates["24K"]
                  )}
                </span>

                <span>
                  22K ${money(
                    rates["22K"]
                  )}
                </span>

                <span>
                  18K ${money(
                    rates["18K"]
                  )}
                </span>

              </div>
            `;

          }
        )
        .join("");


    return data;

  } catch (error) {

    console.error(
      "[GoldMania] HISTORY ERROR",
      error
    );


    if (container) {

      container.innerHTML = `
        <div class="api-error">
          History unavailable:
          ${esc(error.message)}
        </div>
      `;

    }


    return null;

  }

}


/* =========================================================
   FILTERS
========================================================= */

function populateFilters() {

  const weight =
    getEl(
      "weightFilter",
      "weight"
    );


  const seller =
    getEl(
      "sellerFilter",
      "seller"
    );


  if (weight) {

    const values =
      [
        ...new Set(
          state.products
            .map(
              p => num(p?.weight)
            )
            .filter(
              Boolean
            )
        )
      ]
      .sort(
        (a, b) =>
          a - b
      );


    values.forEach(value => {

      if (
        [...weight.options]
          .some(
            o =>
              o.value ===
              String(value)
          )
      ) {
        return;
      }


      const option =
        document.createElement(
          "option"
        );


      option.value =
        String(value);


      option.textContent =
        `${value} g`;


      weight.appendChild(
        option
      );

    });

  }


  if (seller) {

    const sellers =
      [
        ...new Set(
          state.products
            .map(
              p =>
                p?.seller ||
                p?.source
            )
            .filter(Boolean)
        )
      ]
      .sort();


    sellers.forEach(name => {

      if (
        [...seller.options]
          .some(
            o =>
              o.value === name
          )
      ) {
        return;
      }


      const option =
        document.createElement(
          "option"
        );


      option.value =
        name;


      option.textContent =
        name;


      seller.appendChild(
        option
      );

    });

  }

}


/* =========================================================
   FILTER EVENTS
========================================================= */

function setupFilters() {

  const purity =
    getEl(
      "purityFilter",
      "purity"
    );


  const weight =
    getEl(
      "weightFilter",
      "weight"
    );


  const seller =
    getEl(
      "sellerFilter",
      "seller"
    );


  if (purity) {

    purity.addEventListener(
      "change",
      () => {

        loadProductsWithFilters(
          purity.value,
          weight?.value || "",
          seller?.value || ""
        );

      }
    );

  }


  if (weight) {

    weight.addEventListener(
      "change",
      () => {

        loadProductsWithFilters(
          purity?.value || "",
          weight.value,
          seller?.value || ""
        );

      }
    );

  }


  if (seller) {

    seller.addEventListener(
      "change",
      () => {

        loadProductsWithFilters(
          purity?.value || "",
          weight?.value || "",
          seller.value
        );

      }
    );

  }

}


async function loadProductsWithFilters(
  purity,
  weight,
  seller
) {

  let url =
    API.products;


  const params =
    new URLSearchParams();


  if (purity) {
    params.set(
      "purity",
      purity
    );
  }


  if (weight) {
    params.set(
      "weight",
      weight
    );
  }


  if (seller) {
    params.set(
      "seller",
      seller
    );
  }


  if (
    params.toString()
  ) {

    url +=
      "?" +
      params.toString();

  }


  try {

    const data =
      await request(url);


    state.products =
      Array.isArray(
        data?.products
      )
        ? data.products
        : [];


    renderProducts();


    setText(
      [
        "productCount",
        "productsCount",
        "count"
      ],
      state.products.length
    );


  } catch (error) {

    console.error(
      "[GoldMania] FILTER ERROR",
      error
    );

  }

}


/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadAll() {

  console.log(
    "[GoldMania] Starting..."
  );


  state.errors = [];


  await loadHealth();


  await Promise.allSettled([
    loadGold(),
    loadProducts(),
    loadOffers(),
    loadHistory()
  ]);


  console.log(
    "[GoldMania] Complete",
    state
  );

}


/* =========================================================
   PUBLIC
========================================================= */

window.GoldMania = {

  reload: loadAll,

  reloadGold: loadGold,

  reloadProducts: loadProducts,

  reloadOffers: loadOffers,

  reloadHistory: loadHistory,

  checkAPI: loadHealth,

  getState: () => state

};


/* =========================================================
   INIT
========================================================= */

function init() {

  console.log(
    "================================"
  );

  console.log(
    "GoldManiaSavings app.js loaded"
  );

  console.log(
    "API:",
    API_BASE
  );

  console.log(
    "================================"
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

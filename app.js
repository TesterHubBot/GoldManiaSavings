/* =========================================================
   GoldManiaSavings - Frontend app.js
   Connects to Cloudflare Worker API
========================================================= */

const API_BASE =
  "https://goldmaniasavings-api.onlinetechmine.workers.dev";


/* =========================================================
   API HELPER
========================================================= */

async function apiFetch(path, options = {}) {

  const response = await fetch(
    `${API_BASE}${path}`,
    {
      ...options,
      headers: {
        "Accept": "application/json",
        ...(options.headers || {})
      }
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Invalid API response (${response.status})`
    );
  }

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.message ||
      `API request failed (${response.status})`
    );
  }

  return data;
}


/* =========================================================
   GOLD RATE
========================================================= */

async function loadGoldRates() {

  try {

    const data =
      await apiFetch("/api/gold");

    if (!data.indiaReference) {
      console.warn(
        "India gold reference unavailable"
      );
      return data;
    }

    const rates =
      data.indiaReference.rates;

    setText(
      "gold24k",
      formatMoney(
        rates["24K"]?.perGram
      )
    );

    setText(
      "gold22k",
      formatMoney(
        rates["22K"]?.perGram
      )
    );

    setText(
      "gold18k",
      formatMoney(
        rates["18K"]?.perGram
      )
    );

    setText(
      "goldUpdated",
      data.timestamp
        ? formatDate(data.timestamp)
        : "-"
    );

    return data;

  } catch (error) {

    console.error(
      "Gold rate error:",
      error
    );

    setText(
      "goldUpdated",
      "Unable to load"
    );

    return null;
  }
}


/* =========================================================
   PRODUCTS
========================================================= */

async function loadProducts(params = {}) {

  try {

    const query =
      new URLSearchParams();

    if (params.purity) {
      query.set(
        "purity",
        params.purity
      );
    }

    if (
      params.weight !== undefined &&
      params.weight !== null &&
      params.weight !== ""
    ) {
      query.set(
        "weight",
        params.weight
      );
    }

    if (params.seller) {
      query.set(
        "seller",
        params.seller
      );
    }

    const queryString =
      query.toString();

    const data =
      await apiFetch(
        `/api/products${
          queryString
            ? `?${queryString}`
            : ""
        }`
      );

    const products =
      Array.isArray(data.products)
        ? data.products
        : [];

    renderProducts(
      products
    );

    updateProductStatus(
      data
    );

    return products;

  } catch (error) {

    console.error(
      "Products error:",
      error
    );

    renderProducts([]);

    setText(
      "productStatus",
      "Unable to load products"
    );

    return [];
  }
}


/* =========================================================
   OFFERS
========================================================= */

async function loadOffers() {

  try {

    const data =
      await apiFetch(
        "/api/offers"
      );

    const offers =
      Array.isArray(data.offers)
        ? data.offers
        : [];

    renderOffers(
      offers
    );

    return offers;

  } catch (error) {

    console.error(
      "Offers error:",
      error
    );

    renderOffers([]);

    return [];
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

    const sellers =
      Array.isArray(data.sellers)
        ? data.sellers
        : [];

    renderSellerFilter(
      sellers
    );

    return sellers;

  } catch (error) {

    console.error(
      "Seller error:",
      error
    );

    return [];
  }
}


/* =========================================================
   PRODUCT RENDER
========================================================= */

function renderProducts(
  products
) {

  const container =
    document.getElementById(
      "products"
    );

  if (!container) {
    console.warn(
      "#products not found"
    );
    return;
  }

  container.innerHTML = "";

  if (!products.length) {

    container.innerHTML = `
      <div class="no-products">
        No gold products found.
      </div>
    `;

    return;
  }


  for (
    const product of products
  ) {

    const card =
      document.createElement(
        "article"
      );

    card.className =
      "product-card";


    const price =
      Number(
        product.listedPrice
      ) || 0;


    const mrp =
      Number(
        product.mrp
      ) || 0;


    const saving =
      mrp > price
        ? mrp - price
        : 0;


    const offerHTML =
      buildOfferHTML(
        product
      );


    const url =
      typeof product.productUrl === "string"
        ? product.productUrl
        : "";


    card.innerHTML = `

      <div class="product-seller">
        ${escapeHTML(
          product.seller || "Seller"
        )}
      </div>

      <h3 class="product-name">
        ${escapeHTML(
          product.productName ||
          "Gold Product"
        )}
      </h3>

      <div class="product-meta">

        <span>
          Purity:
          <strong>
            ${escapeHTML(
              product.purity || "-"
            )}
          </strong>
        </span>

        <span>
          Weight:
          <strong>
            ${escapeHTML(
              String(product.weight ?? "-")
            )} g
          </strong>
        </span>

      </div>

      <div class="product-price">
        ₹${formatNumber(price)}
      </div>

      ${
        saving > 0
          ? `
            <div class="product-saving">
              Save ₹${formatNumber(saving)}
            </div>
          `
          : ""
      }

      ${offerHTML}

      ${
        url
          ? `
            <a
              class="product-link"
              href="${escapeAttribute(url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Product
            </a>
          `
          : `
            <span class="product-link disabled">
              Product link unavailable
            </span>
          `
      }

      <div class="product-updated">
        Updated:
        ${formatDate(
          product.lastUpdated
        )}
      </div>

    `;


    container.appendChild(
      card
    );
  }
}


/* =========================================================
   OFFER HTML
========================================================= */

function buildOfferHTML(
  product
) {

  const offers = [];


  if (
    Number(product.coupon) > 0
  ) {
    offers.push(
      `Coupon: ₹${formatNumber(
        product.coupon
      )}`
    );
  }


  if (
    Number(product.cardOffer) > 0
  ) {
    offers.push(
      `Card offer: ₹${formatNumber(
        product.cardOffer
      )}`
    );
  }


  if (
    Number(product.upiOffer) > 0
  ) {
    offers.push(
      `UPI offer: ₹${formatNumber(
        product.upiOffer
      )}`
    );
  }


  if (
    Number(product.cashback) > 0
  ) {
    offers.push(
      `Cashback: ₹${formatNumber(
        product.cashback
      )}`
    );
  }


  if (product.voucher) {
    offers.push(
      `Voucher: ${product.voucher}`
    );
  }


  if (product.promoCode) {
    offers.push(
      `Promo code: ${product.promoCode}`
    );
  }


  if (product.offerText) {
    offers.push(
      product.offerText
    );
  }


  if (!offers.length) {
    return "";
  }


  return `
    <div class="product-offers">

      <strong>
        Available offers
      </strong>

      <ul>
        ${offers
          .map(
            offer =>
              `<li>${escapeHTML(
                String(offer)
              )}</li>`
          )
          .join("")}
      </ul>

    </div>
  `;
}


/* =========================================================
   OFFERS PAGE
========================================================= */

function renderOffers(
  offers
) {

  const container =
    document.getElementById(
      "offers"
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";


  if (!offers.length) {

    container.innerHTML = `
      <div class="no-offers">
        No visible offers available.
      </div>
    `;

    return;
  }


  offers.forEach(
    offer => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "offer-card";


      const values = [];


      if (Number(offer.coupon) > 0) {
        values.push(
          `Coupon ₹${formatNumber(
            offer.coupon
          )}`
        );
      }


      if (
        Number(offer.cardOffer) > 0
      ) {
        values.push(
          `Card ₹${formatNumber(
            offer.cardOffer
          )}`
        );
      }


      if (
        Number(offer.upiOffer) > 0
      ) {
        values.push(
          `UPI ₹${formatNumber(
            offer.upiOffer
          )}`
        );
      }


      if (
        Number(offer.cashback) > 0
      ) {
        values.push(
          `Cashback ₹${formatNumber(
            offer.cashback
          )}`
        );
      }


      item.innerHTML = `

        <div>
          <strong>
            ${escapeHTML(
              offer.seller || ""
            )}
          </strong>
        </div>

        <div>
          ${escapeHTML(
            offer.productName || ""
          )}
        </div>

        <div>
          ${values
            .map(
              value =>
                `<span class="offer-tag">
                  ${escapeHTML(value)}
                </span>`
            )
            .join(" ")}
        </div>

      `;


      container.appendChild(
        item
      );
    }
  );
}


/* =========================================================
   SELLER FILTER
========================================================= */

function renderSellerFilter(
  sellers
) {

  const select =
    document.getElementById(
      "sellerFilter"
    );

  if (!select) {
    return;
  }


  const current =
    select.value;


  select.innerHTML = `
    <option value="">
      All Sellers
    </option>
  `;


  sellers.forEach(
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


/* =========================================================
   FILTER EVENTS
========================================================= */

function setupFilters() {

  const purity =
    document.getElementById(
      "purityFilter"
    );

  const weight =
    document.getElementById(
      "weightFilter"
    );

  const seller =
    document.getElementById(
      "sellerFilter"
    );


  function reload() {

    loadProducts({

      purity:
        purity?.value || "",

      weight:
        weight?.value || "",

      seller:
        seller?.value || ""

    });

  }


  purity?.addEventListener(
    "change",
    reload
  );

  weight?.addEventListener(
    "change",
    reload
  );

  seller?.addEventListener(
    "change",
    reload
  );
}


/* =========================================================
   API STATUS
========================================================= */

function updateProductStatus(
  data
) {

  const element =
    document.getElementById(
      "productStatus"
    );

  if (!element) {
    return;
  }


  if (data.live) {

    element.textContent =
      `${data.count || 0} products • Live`;

    element.dataset.status =
      "live";

  } else if (data.cacheUsed) {

    element.textContent =
      `${data.count || 0} products • Cached`;

    element.dataset.status =
      "cache";

  } else {

    element.textContent =
      `${data.count || 0} products`;

    element.dataset.status =
      "offline";
  }
}


/* =========================================================
   HEALTH CHECK
========================================================= */

async function checkAPIHealth() {

  try {

    const data =
      await apiFetch(
        "/api/health"
      );

    console.log(
      "GoldManiaSavings API:",
      data
    );

    return true;

  } catch (error) {

    console.error(
      "API health check failed:",
      error
    );

    return false;
  }
}


/* =========================================================
   REFRESH EVERYTHING
========================================================= */

async function refreshAll() {

  await Promise.allSettled([

    loadGoldRates(),

    loadProducts(),

    loadOffers(),

    loadSellers()

  ]);

}


/* =========================================================
   AUTO REFRESH
========================================================= */

function startAutoRefresh() {

  /*
   * Refresh frontend every 5 minutes.
   * Backend cron handles its own scheduled updates.
   */

  setInterval(
    refreshAll,
    5 * 60 * 1000
  );
}


/* =========================================================
   HELPERS
========================================================= */

function setText(
  id,
  value
) {

  const element =
    document.getElementById(id);

  if (element) {
    element.textContent =
      value ?? "-";
  }
}


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

  return number.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2
    }
  );
}


function formatMoney(
  value
) {

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return "-";
  }

  return `₹${formatNumber(number)}`;
}


function formatDate(
  value
) {

  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

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
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}


function escapeHTML(
  value
) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function escapeAttribute(
  value
) {

  return escapeHTML(value);
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    console.log(
      "GoldManiaSavings frontend starting..."
    );

    await checkAPIHealth();

    setupFilters();

    await refreshAll();

    startAutoRefresh();

  }
);

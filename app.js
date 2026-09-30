/* =========================================================
   GoldManiaSavings
   Frontend Application
   Version 10.0.0

   Worker:
   https://goldmaniasavings-api.onlinetechmine.workers.dev
========================================================= */

"use strict";


/* =========================================================
   CONFIG
========================================================= */

const API_BASE =
  "https://goldmaniasavings-api.onlinetechmine.workers.dev";

const API_TIMEOUT =
  15000;

const CACHE_KEY =
  "goldmania_products_v10";

const GOLD_CACHE_KEY =
  "goldmania_gold_v10";


/* =========================================================
   STATE
========================================================= */

const state = {

  products: [],

  filteredProducts: [],

  sellers: [],

  gold: null,

  loadingProducts: false,

  loadingGold: false

};


/* =========================================================
   DOM
========================================================= */

const $ = (id) =>
  document.getElementById(id);


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);


async function init() {

  bindEvents();

  setStatus(
    "Connecting to GoldManiaSavings..."
  );

  /*
   * Load cached values immediately.
   * This prevents a completely blank UI.
   */

  loadCachedGold();

  loadCachedProducts();

  /*
   * Then fetch live data.
   */

  await Promise.allSettled([

    loadGold(),

    loadSellers(),

    loadProducts()

  ]);

  applyFilters();

}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {

  const compareButton =
    $("compareButton");

  if (compareButton) {

    compareButton.addEventListener(
      "click",
      applyFilters
    );

  }


  const controls = [

    "purity",

    "weight",

    "sellerFilter",

    "paymentFilter",

    "sortFilter"

  ];


  controls.forEach(
    id => {

      const element =
        $(id);

      if (!element) {
        return;
      }

      element.addEventListener(
        "change",
        applyFilters
      );

    }
  );

}


/* =========================================================
   FETCH WITH TIMEOUT
========================================================= */

async function fetchJSON(
  path
) {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      API_TIMEOUT
    );


  try {

    const response =
      await fetch(
        API_BASE +
        path,
        {
          method: "GET",

          headers: {
            "Accept":
              "application/json"
          },

          cache: "no-store",

          signal:
            controller.signal
        }
      );


    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }


    const text =
      await response.text();


    if (!text) {

      throw new Error(
        "Empty response"
      );

    }


    let data;


    try {

      data =
        JSON.parse(text);

    } catch {

      throw new Error(
        "Worker returned invalid JSON"
      );

    }


    return data;

  } finally {

    clearTimeout(timer);

  }

}


/* =========================================================
   GOLD
========================================================= */

async function loadGold() {

  state.loadingGold =
    true;


  setRateStatus(
    "🟡 Loading gold price..."
  );


  try {

    const data =
      await fetchJSON(
        "/api/gold"
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


    const gold =
      normalizeGoldResponse(
        data
      );


    if (!gold) {

      throw new Error(
        "Gold response has no usable rates"
      );

    }


    state.gold =
      gold;


    saveCache(
      GOLD_CACHE_KEY,
      gold
    );


    renderGold();


  } catch (error) {

    console.error(
      "Gold loading failed:",
      error
    );


    /*
     * If cache exists, keep it.
     */

    if (!state.gold) {

      setRateStatus(
        "🔴 Gold price unavailable"
      );

      setText(
        "liveRateUpdated",
        "Worker gold endpoint could not be reached."
      );

    } else {

      renderGold();

    }

  } finally {

    state.loadingGold =
      false;

  }

}


/* =========================================================
   GOLD RESPONSE NORMALIZER
========================================================= */

function normalizeGoldResponse(
  data
) {

  /*
   * Current Worker:
   *
   * data.indiaReference.rates["24K"].perGram
   */

  const india =
    data?.indiaReference?.rates;


  if (india) {

    const r24 =
      readRate(
        india["24K"]
      );

    const r22 =
      readRate(
        india["22K"]
      );

    const r18 =
      readRate(
        india["18K"]
      );


    if (
      r24 ||
      r22 ||
      r18
    ) {

      return {

        source:
          data.indiaReference.source ||
          "India gold reference",

        date:
          data.indiaReference.date ||
          data.timestamp ||
          null,

        rate24:
          r24,

        rate22:
          r22,

        rate18:
          r18

      };

    }

  }


  /*
   * Alternative Worker shape:
   *
   * data.rates["24K"].perGram
   */

  if (data?.rates) {

    const r24 =
      readRate(
        data.rates["24K"]
      );

    const r22 =
      readRate(
        data.rates["22K"]
      );

    const r18 =
      readRate(
        data.rates["18K"]
      );


    if (
      r24 ||
      r22 ||
      r18
    ) {

      return {

        source:
          data.source ||
          "Gold reference",

        date:
          data.timestamp ||
          null,

        rate24:
          r24,

        rate22:
          r22,

        rate18:
          r18

      };

    }

  }


  /*
   * Very simple shape:
   *
   * data.rates["24K"] = number
   */

  if (data?.rates) {

    const r24 =
      Number(
        data.rates["24K"] || 0
      );

    const r22 =
      Number(
        data.rates["22K"] || 0
      );

    const r18 =
      Number(
        data.rates["18K"] || 0
      );


    if (
      r24 ||
      r22 ||
      r18
    ) {

      return {

        source:
          data.source ||
          "Gold reference",

        date:
          data.timestamp ||
          null,

        rate24:
          r24,

        rate22:
          r22,

        rate18:
          r18

      };

    }

  }


  return null;

}


function readRate(
  value
) {

  if (
    value &&
    typeof value === "object"
  ) {

    return Number(
      value.perGram ||
      value.price ||
      value.value ||
      0
    );

  }


  return Number(
    value || 0
  );

}


/* =========================================================
   RENDER GOLD
========================================================= */

function renderGold() {

  if (!state.gold) {
    return;
  }


  const r24 =
    Number(
      state.gold.rate24 || 0
    );

  const r22 =
    Number(
      state.gold.rate22 || 0
    );

  const r18 =
    Number(
      state.gold.rate18 || 0
    );


  setText(
    "live24Rate",
    money(
      r24
    )
  );


  setText(
    "live22Rate",
    money(
      r22
    )
  );


  setText(
    "live18Rate",
    money(
      r18
    )
  );


  setValue(
    "rate24",
    r24
  );


  setValue(
    "rate22",
    r22
  );


  setRateStatus(
    "🟢 Gold price loaded"
  );


  const date =
    state.gold.date;


  setText(
    "liveRateUpdated",
    date
      ? `Source: ${state.gold.source || "India reference"} • ${formatDate(date)}`
      : `Source: ${state.gold.source || "India reference"}`
  );


  updateSummary();

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


  state.loadingProducts =
    true;


  setStatus(
    "Loading gold coin products..."
  );


  try {

    const data =
      await fetchJSON(
        "/api/products"
      );


    const products =
      Array.isArray(
        data?.products
      )
        ? data.products
        : [];


    state.products =
      normalizeProducts(
        products
      );


    saveCache(
      CACHE_KEY,
      state.products
    );


    populateSellerFilter();

    setStatus(
      `${state.products.length} products loaded`
    );


    applyFilters();


  } catch (error) {

    console.error(
      "Product loading failed:",
      error
    );


    /*
     * Keep cached products if available.
     */

    if (
      state.products.length
    ) {

      setStatus(
        `${state.products.length} cached products loaded`
      );

      applyFilters();

    } else {

      setStatus(
        "🔴 Products unavailable. Check Worker /api/products."
      );

      renderEmpty(
        "Product data could not be loaded."
      );

    }

  } finally {

    state.loadingProducts =
      false;

  }

}


/* =========================================================
   PRODUCT NORMALIZER
========================================================= */

function normalizeProducts(
  products
) {

  return products

    .filter(
      product =>
        product &&
        typeof product === "object"
    )

    .map(
      product => ({

        ...product,

        sellerId:
          String(
            product.sellerId ||
            ""
          ).toLowerCase(),

        seller:
          String(
            product.seller ||
            product.sellerId ||
            "Unknown seller"
          ),

        productName:
          clean(
            product.productName ||
            "Gold Coin"
          ),

        purity:
          normalizePurity(
            product.purity
          ),

        weight:
          Number(
            product.weight || 0
          ),

        listedPrice:
          Number(
            product.listedPrice || 0
          ),

        mrp:
          Number(
            product.mrp || 0
          ),

        shipping:
          Number(
            product.shipping || 0
          ),

        coupon:
          Number(
            product.coupon || 0
          ),

        cardOffer:
          Number(
            product.cardOffer || 0
          ),

        upiOffer:
          Number(
            product.upiOffer || 0
          ),

        cashback:
          Number(
            product.cashback || 0
          ),

        voucher:
          clean(
            product.voucher
          ),

        promoCode:
          clean(
            product.promoCode
          ),

        offerText:
          clean(
            product.offerText
          ),

        productUrl:
          safeURL(
            product.productUrl
          )

      })
    )

    .filter(
      product =>
        product.listedPrice > 0 ||
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
        "/api/sellers"
      );


    state.sellers =
      Array.isArray(
        data?.sellers
      )
        ? data.sellers
        : [];


    populateSellerFilter();

  } catch (error) {

    console.warn(
      "Seller endpoint failed:",
      error
    );

  }

}


function populateSellerFilter() {

  const select =
    $("sellerFilter");


  if (!select) {
    return;
  }


  const current =
    select.value;


  const names =
    new Map();


  state.sellers.forEach(
    seller => {

      if (
        seller?.id &&
        seller?.name
      ) {

        names.set(
          seller.id,
          seller.name
        );

      }

    }
  );


  state.products.forEach(
    product => {

      if (
        product.sellerId
      ) {

        names.set(
          product.sellerId,
          product.seller
        );

      }

    }
  );


  select.innerHTML =
    `<option value="all">All Sellers</option>`;


  Array.from(
    names.entries()
  )
    .sort(
      (a, b) =>
        a[1].localeCompare(
          b[1]
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


  if (
    Array.from(
      select.options
    )
      .some(
        option =>
          option.value === current
      )
  ) {

    select.value =
      current;

  }

}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {

  const purity =
    valueOf(
      "purity"
    ) || "24K";


  const weightValue =
    valueOf(
      "weight"
    );


  const seller =
    valueOf(
      "sellerFilter"
    ) || "all";


  const payment =
    valueOf(
      "paymentFilter"
    ) || "all";


  const sort =
    valueOf(
      "sortFilter"
    ) || "effective";


  let products =
    state.products
      .filter(
        product =>
          !purity ||
          product.purity ===
          normalizePurity(
            purity
          )
      );


  if (
    weightValue
  ) {

    const target =
      Number(
        weightValue
      );


    products =
      products.filter(
        product =>
          approximatelyEqual(
            product.weight,
            target
          )
      );

  }


  if (
    seller &&
    seller !== "all"
  ) {

    products =
      products.filter(
        product =>
          product.sellerId ===
          seller
      );

  }


  products =
    products.filter(
      product =>
        paymentMatches(
          product,
          payment
        )
    );


  products =
    products.map(
      product =>
        calculateProduct(
          product
        )
    );


  products.sort(
    (a, b) => {

      if (
        sort === "listed"
      ) {

        return (
          a.listedPrice -
          b.listedPrice
        );

      }


      if (
        sort === "premium"
      ) {

        return (
          a.premiumPercent -
          b.premiumPercent
        );

      }


      return (
        a.effectivePrice -
        b.effectivePrice
      );

    }
  );


  state.filteredProducts =
    products;


  updateSummary();

  renderComparison(
    products
  );

}


/* =========================================================
   PAYMENT FILTER
========================================================= */

function paymentMatches(
  product,
  payment
) {

  if (
    payment === "all"
  ) {
    return true;
  }


  if (
    payment === "card"
  ) {

    return (
      Number(
        product.cardOffer
      ) > 0
    );

  }


  if (
    payment === "upi"
  ) {

    return (
      Number(
        product.upiOffer
      ) > 0
    );

  }


  if (
    payment === "cashback"
  ) {

    return (
      Number(
        product.cashback
      ) > 0
    );

  }


  if (
    payment === "voucher"
  ) {

    return Boolean(
      product.voucher ||
      product.promoCode
    );

  }


  return true;

}


/* =========================================================
   PRODUCT CALCULATION
========================================================= */

function calculateProduct(
  product
) {

  const goldRate =
    getRateForPurity(
      product.purity
    );


  const weight =
    Number(
      product.weight || 0
    );


  const goldValue =
    goldRate *
    weight;


  const listedPrice =
    Number(
      product.listedPrice || 0
    );


  const premium =
    Math.max(
      0,
      listedPrice -
      goldValue
    );


  const premiumPercent =
    goldValue > 0
      ? (
          premium /
          goldValue
        ) * 100
      : 0;


  const offerReduction =
    calculateOfferReduction(
      product
    );


  const effectivePrice =
    Math.max(
      0,
      listedPrice -
      offerReduction
    );


  return {

    ...product,

    goldRate,

    goldValue,

    premium,

    premiumPercent,

    offerReduction,

    effectivePrice

  };

}


/* =========================================================
   OFFER REDUCTION
========================================================= */

function calculateOfferReduction(
  product
) {

  /*
   * Only numeric offers are safely
   * applied to the comparison.
   *
   * Text-only voucher/promo values
   * are displayed but not guessed.
   */

  const values = [

    Number(
      product.coupon || 0
    ),

    Number(
      product.cardOffer || 0
    ),

    Number(
      product.upiOffer || 0
    ),

    Number(
      product.cashback || 0
    )

  ];


  /*
   * The backend may provide offers
   * that are already monetary values.
   *
   * We do not stack every offer blindly.
   * Use the largest numeric saving.
   */

  return Math.max(
    0,
    ...values
  );

}


/* =========================================================
   RENDER COMPARISON
========================================================= */

function renderComparison(
  products
) {

  const body =
    $("comparisonBody");


  if (!body) {
    return;
  }


  body.innerHTML =
    "";


  if (
    !products.length
  ) {

    renderEmpty(
      "No matching gold coin products found for this purity/weight."
    );

    return;

  }


  const cheapest =
    products.reduce(
      (
        best,
        product
      ) =>
        !best ||
        product.effectivePrice <
        best.effectivePrice
          ? product
          : best,
      null
    );


  products.forEach(
    (
      product,
      index
    ) => {

      const row =
        document.createElement(
          "tr"
        );


      if (
        cheapest &&
        product.id ===
        cheapest.id
      ) {

        row.classList.add(
          "best-price"
        );

      }


      row.innerHTML = `

        <td>

          <div class="product-cell">

            <strong>
              ${escapeHTML(
                product.seller
              )}
            </strong>

            <span>
              ${escapeHTML(
                product.productName
              )}
            </span>

            <small>
              ${escapeHTML(
                product.purity
              )}
              •
              ${formatWeight(
                product.weight
              )}
            </small>

          </div>

        </td>


        <td>

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
                <small class="mrp">
                  MRP ${money(
                    product.mrp
                  )}
                </small>
              `
              : ""
          }

        </td>


        <td>
          ${money(
            product.goldValue
          )}
        </td>


        <td>

          <span class="premium">

            ${formatPercent(
              product.premiumPercent
            )}

          </span>

        </td>


        <td>

          ${renderOffers(
            product
          )}

        </td>


        <td>

          <strong class="effective-price">

            ${money(
              product.effectivePrice
            )}

          </strong>

          ${
            product.offerReduction > 0
              ? `
                <small class="saving">
                  Save ${money(
                    product.offerReduction
                  )}
                </small>
              `
              : ""
          }

        </td>


        <td>

          ${
            product.productUrl
              ? `
                <a
                  class="product-link"
                  href="${escapeAttribute(
                    product.productUrl
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Exact Product
                </a>
              `
              : `
                <span class="no-link">
                  Link unavailable
                </span>
              `
          }

        </td>

      `;


      body.appendChild(
        row
      );

    }
  );


  const cheapestText =
    cheapest
      ? ` • Lowest effective price: ${cheapest.seller}`
      : "";


  setText(
    "comparisonTitle",
    `${products.length} Gold Coin${products.length === 1 ? "" : "s"} Compared${cheapestText}`
  );


  setStatus(
    `${products.length} matching products`
  );

}


/* =========================================================
   OFFERS
========================================================= */

function renderOffers(
  product
) {

  const offers = [];


  if (
    product.coupon > 0
  ) {

    offers.push(
      `<span class="offer coupon">
        Coupon ${money(
          product.coupon
        )}
      </span>`
    );

  }


  if (
    product.cardOffer > 0
  ) {

    offers.push(
      `<span class="offer card">
        💳 Card ${money(
          product.cardOffer
        )}
      </span>`
    );

  }


  if (
    product.upiOffer > 0
  ) {

    offers.push(
      `<span class="offer upi">
        UPI ${money(
          product.upiOffer
        )}
      </span>`
    );

  }


  if (
    product.cashback > 0
  ) {

    offers.push(
      `<span class="offer cashback">
        Cashback ${money(
          product.cashback
        )}
      </span>`
    );

  }


  if (
    product.voucher
  ) {

    offers.push(
      `<span class="offer voucher">
        Voucher: ${escapeHTML(
          product.voucher
        )}
      </span>`
    );

  }


  if (
    product.promoCode
  ) {

    offers.push(
      `<span class="offer promo">
        Promo: ${escapeHTML(
          product.promoCode
        )}
      </span>`
    );

  }


  if (
    product.offerText
  ) {

    offers.push(
      `<span class="offer text-offer">
        ${escapeHTML(
          product.offerText
        )}
      </span>`
    );

  }


  if (
    !offers.length
  ) {

    return `
      <span class="no-offer">
        No offer data
      </span>
    `;

  }


  return `
    <div class="offers">
      ${offers.join("")}
    </div>
  `;

}


/* =========================================================
   SUMMARY
========================================================= */

function updateSummary() {

  const purity =
    valueOf(
      "purity"
    ) || "24K";


  const weight =
    valueOf(
      "weight"
    );


  const rate =
    getRateForPurity(
      purity
    );


  const weightNumber =
    Number(
      weight || 0
    );


  setText(
    "summaryPurity",
    purity
  );


  setText(
    "summaryWeight",
    weight
      ? formatWeight(
          weightNumber
        )
      : "All"
  );


  if (
    weightNumber > 0 &&
    rate > 0
  ) {

    setText(
      "summaryPureGold",
      `${formatNumber(
        weightNumber
      )} g`
    );


    setText(
      "summaryGoldValue",
      money(
        weightNumber *
        rate
      )
    );

  } else {

    setText(
      "summaryPureGold",
      "—"
    );


    setText(
      "summaryGoldValue",
      "—"
    );

  }

}


/* =========================================================
   RATE
========================================================= */

function getRateForPurity(
  purity
) {

  if (!state.gold) {
    return 0;
  }


  if (
    purity === "22K"
  ) {

    return Number(
      state.gold.rate22 || 0
    );

  }


  if (
    purity === "18K"
  ) {

    return Number(
      state.gold.rate18 || 0
    );

  }


  return Number(
    state.gold.rate24 || 0
  );

}


/* =========================================================
   CACHE
========================================================= */

function saveCache(
  key,
  value
) {

  try {

    localStorage.setItem(
      key,
      JSON.stringify({
        savedAt:
          Date.now(),

        data:
          value
      })
    );

  } catch {

    /* Ignore storage failures */

  }

}


function readCache(
  key
) {

  try {

    const raw =
      localStorage.getItem(
        key
      );


    if (!raw) {
      return null;
    }


    const parsed =
      JSON.parse(
        raw
      );


    return parsed?.data ||
      null;

  } catch {

    return null;

  }

}


function loadCachedGold() {

  const cached =
    readCache(
      GOLD_CACHE_KEY
    );


  if (!cached) {
    return;
  }


  state.gold =
    cached;


  renderGold();


  setRateStatus(
    "🟠 Showing cached gold price"
  );

}


function loadCachedProducts() {

  const cached =
    readCache(
      CACHE_KEY
    );


  if (
    !Array.isArray(
      cached
    )
  ) {
    return;
  }


  state.products =
    normalizeProducts(
      cached
    );


  populateSellerFilter();

  applyFilters();

}


/* =========================================================
   UI HELPERS
========================================================= */

function setText(
  id,
  value
) {

  const element =
    $(id);


  if (element) {

    element.textContent =
      value;

  }

}


function setValue(
  id,
  value
) {

  const element =
    $(id);


  if (element) {

    element.value =
      value ?? "";

  }

}


function valueOf(
  id
) {

  const element =
    $(id);


  return element
    ? element.value
    : "";

}


function setStatus(
  message
) {

  setText(
    "productStatus",
    message
  );

}


function setRateStatus(
  message
) {

  setText(
    "liveRateStatus",
    message
  );

}


/* =========================================================
   EMPTY
========================================================= */

function renderEmpty(
  message
) {

  const body =
    $("comparisonBody");


  if (!body) {
    return;
  }


  body.innerHTML = `

    <tr>

      <td
        colspan="7"
        class="empty-state"
      >

        ${escapeHTML(
          message
        )}

      </td>

    </tr>

  `;

}


/* =========================================================
   FORMAT
========================================================= */

function money(
  value
) {

  const number =
    Number(
      value || 0
    );


  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {

    return "—";

  }


  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }
  ).format(
    number
  );

}


function formatNumber(
  value
) {

  return Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 4
    }
  );

}


function formatPercent(
  value
) {

  const number =
    Number(
      value || 0
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "—";

  }


  return `${number.toFixed(2)}%`;

}


function formatWeight(
  value
) {

  const number =
    Number(
      value || 0
    );


  if (
    number <= 0
  ) {

    return "—";

  }


  if (
    number < 1
  ) {

    return `${formatNumber(
      number * 1000
    )} mg`;

  }


  return `${formatNumber(
    number
  )} g`;

}


function formatDate(
  value
) {

  try {

    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return String(
        value
      );

    }


    return date.toLocaleString(
      "en-IN",
      {
        dateStyle:
          "medium",

        timeStyle:
          "short"
      }
    );

  } catch {

    return String(
      value
    );

  }

}


/* =========================================================
   NORMALIZATION
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
        /\s/g,
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


function approximatelyEqual(
  a,
  b
) {

  return (
    Math.abs(
      Number(a) -
      Number(b)
    ) < 0.0001
  );

}


function clean(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


/* =========================================================
   URL SAFETY
========================================================= */

function safeURL(
  value
) {

  if (
    !value
  ) {
    return "";
  }


  try {

    const url =
      new URL(
        String(
          value
        ).trim()
      );


    if (
      url.protocol !==
        "http:" &&
      url.protocol !==
        "https:"
    ) {

      return "";

    }


    return url.href;

  } catch {

    return "";

  }

}


/* =========================================================
   HTML ESCAPING
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


function escapeAttribute(
  value
) {

  return escapeHTML(
    value
  );

}

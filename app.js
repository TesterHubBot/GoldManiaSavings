(function () {
  "use strict";

  /*
   * =========================================================
   * GOLDMANIASAVINGS FRONTEND
   * =========================================================
   *
   * This file is loaded by:
   *
   * <script src="app.js?v=20260930"></script>
   *
   * Worker:
   * https://goldmaniasavings-api.onlinetechmine.workers.dev
   */

  const API_BASE =
    "https://goldmaniasavings-api.onlinetechmine.workers.dev";

  const ENDPOINTS = {
    gold: API_BASE + "/api/gold",
    products: API_BASE + "/api/products",
    sellers: API_BASE + "/api/sellers",
    offers: API_BASE + "/api/offers"
  };

  const state = {
    gold: null,
    products: [],
    sellers: [],
    offers: []
  };


  /*
   * =========================================================
   * DOM
   * =========================================================
   */

  function $(id) {
    return document.getElementById(id);
  }


  /*
   * =========================================================
   * HELPERS
   * =========================================================
   */

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }


  function money(value) {
    const n = number(value);

    if (n <= 0) {
      return "—";
    }

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(n);
  }


  function validURL(value) {
    try {
      const url = new URL(String(value || ""));

      if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
      ) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }


  function formatUpdated(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }


  /*
   * =========================================================
   * CONNECTION STATUS
   * =========================================================
   */

  function setConnection(ok, text) {
    const dot = $("connectionDot");
    const connectionText = $("connectionText");

    if (dot) {
      dot.className = "dot " + (ok ? "ok" : "bad");
    }

    if (connectionText) {
      connectionText.textContent = text;
    }
  }


  function showNotice(element, message, type) {
    if (!element) {
      return;
    }

    element.textContent = message || "";

    element.className =
      "notice " +
      (
        message
          ? "show " + (type || "info")
          : ""
      );
  }


  /*
   * =========================================================
   * FETCH
   * =========================================================
   */

  async function fetchJSON(url, timeout = 20000) {
    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      timeout
    );

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        },
        signal: controller.signal
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(
          "HTTP " + response.status +
          (text ? " - " + text.slice(0, 180) : "")
        );
      }

      if (!text.trim()) {
        throw new Error("Empty response from Worker");
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error(
          "Worker returned non-JSON response"
        );
      }

    } catch (error) {

      if (error?.name === "AbortError") {
        throw new Error(
          "Worker request timed out"
        );
      }

      throw error;

    } finally {
      clearTimeout(timer);
    }
  }


  /*
   * =========================================================
   * WORKER HEALTH CHECK
   * =========================================================
   *
   * Important:
   * We do not assume that /api/gold exists.
   * We test the API endpoints individually.
   */

  async function checkWorker() {
    try {
      const response = await fetch(
        API_BASE + "/",
        {
          method: "GET",
          cache: "no-store"
        }
      );

      if (response.ok) {
        setConnection(
          true,
          "Worker online"
        );
        return true;
      }

    } catch (error) {
      console.warn(
        "Worker root check failed:",
        error
      );
    }

    return false;
  }


  /*
   * =========================================================
   * GOLD
   * =========================================================
   */

  async function loadGold() {

    if ($("gold24")) {
      $("gold24").textContent = "Loading...";
    }

    if ($("gold22")) {
      $("gold22").textContent = "Loading...";
    }

    if ($("gold18")) {
      $("gold18").textContent = "Loading...";
    }

    showNotice(
      $("goldNotice"),
      "",
      ""
    );

    try {

      const data = await fetchJSON(
        ENDPOINTS.gold,
        20000
      );

      if (!data || data.ok === false) {
        throw new Error(
          data?.message ||
          "Gold API returned an error"
        );
      }


      /*
       * Support multiple possible Worker shapes.
       */

      const reference =
        data.indiaReference ||
        data.india ||
        data.reference ||
        data.data?.indiaReference ||
        data.data?.india ||
        data.data ||
        null;


      const rates =
        reference?.rates ||
        data.rates ||
        {};


      const r24 =
        number(
          rates["24K"]?.perGram ??
          rates["24K"] ??
          rates["24k"]?.perGram ??
          rates["24k"] ??
          data["24K"]?.perGram ??
          data["24K"]
        );


      const r22 =
        number(
          rates["22K"]?.perGram ??
          rates["22K"] ??
          rates["22k"]?.perGram ??
          rates["22k"] ??
          data["22K"]?.perGram ??
          data["22K"]
        );


      const r18 =
        number(
          rates["18K"]?.perGram ??
          rates["18K"] ??
          rates["18k"]?.perGram ??
          rates["18k"] ??
          data["18K"]?.perGram ??
          data["18K"]
        );


      if (
        r24 <= 0 &&
        r22 <= 0 &&
        r18 <= 0
      ) {
        throw new Error(
          "Worker returned no usable gold rates"
        );
      }


      state.gold = {
        "24K": r24,
        "22K": r22,
        "18K": r18
      };


      if ($("gold24")) {
        $("gold24").textContent =
          money(r24);
      }

      if ($("gold22")) {
        $("gold22").textContent =
          money(r22);
      }

      if ($("gold18")) {
        $("gold18").textContent =
          money(r18);
      }


      if ($("goldSource")) {
        $("goldSource").textContent =
          reference?.source ||
          data.source ||
          "India gold reference";
      }


      if ($("goldUpdated")) {
        $("goldUpdated").textContent =
          formatUpdated(
            data.timestamp ||
            reference?.timestamp ||
            reference?.date ||
            data.updatedAt
          );
      }


      showNotice(
        $("goldNotice"),
        "",
        ""
      );


      setConnection(
        true,
        "Worker connected"
      );


    } catch (error) {

      console.error(
        "Gold load failed:",
        error
      );


      if ($("gold24")) {
        $("gold24").textContent =
          "Unavailable";
      }

      if ($("gold22")) {
        $("gold22").textContent =
          "Unavailable";
      }

      if ($("gold18")) {
        $("gold18").textContent =
          "Unavailable";
      }

      if ($("goldSource")) {
        $("goldSource").textContent =
          "Worker unavailable";
      }

      if ($("goldUpdated")) {
        $("goldUpdated").textContent =
          "—";
      }


      showNotice(
        $("goldNotice"),
        "Gold price could not be loaded. " +
        error.message,
        "error"
      );


      setConnection(
        false,
        "Worker unavailable"
      );
    }
  }


  /*
   * =========================================================
   * NORMALIZE PRODUCT
   * =========================================================
   */

  function normalizeProduct(product) {

    product =
      product &&
      typeof product === "object"
        ? product
        : {};


    return {
      ...product,

      sellerId:
        String(
          product.sellerId ||
          product.seller_id ||
          ""
        ).toLowerCase(),

      seller:
        product.seller ||
        product.sellerName ||
        product.merchant ||
        product.sellerId ||
        "Seller",

      productName:
        product.productName ||
        product.name ||
        product.title ||
        "Gold Coin",

      purity:
        String(
          product.purity ||
          product.karat ||
          ""
        ).toUpperCase(),

      weight:
        number(
          product.weight ??
          product.weightGrams ??
          product.grams
        ),

      listedPrice:
        number(
          product.listedPrice ??
          product.price ??
          product.salePrice ??
          product.sellingPrice
        ),

      mrp:
        number(
          product.mrp ??
          product.originalPrice ??
          product.mrpPrice
        ),

      coupon:
        number(product.coupon),

      cardOffer:
        number(product.cardOffer),

      upiOffer:
        number(product.upiOffer),

      cashback:
        number(product.cashback),

      voucher:
        String(
          product.voucher || ""
        ),

      promoCode:
        String(
          product.promoCode ||
          product.promo ||
          product.couponCode ||
          ""
        ),

      offerText:
        String(
          product.offerText ||
          product.offer ||
          ""
        ),

      productUrl:
        validURL(
          product.productUrl ||
          product.url ||
          product.link
        )
    };
  }


  /*
   * =========================================================
   * PRODUCTS
   * =========================================================
   */

  async function loadProducts() {

    if ($("comparisonList")) {
      $("comparisonList").innerHTML =
        '<div class="loading">Loading verified gold products...</div>';
    }

    if ($("productCount")) {
      $("productCount").textContent =
        "Loading products...";
    }


    try {

      const data = await fetchJSON(
        ENDPOINTS.products,
        30000
      );


      if (
        !data ||
        data.ok === false
      ) {
        throw new Error(
          data?.message ||
          "Products API returned an error"
        );
      }


      /*
       * Support:
       * { products: [] }
       * { data: [] }
       * direct []
       */

      let products = [];

      if (Array.isArray(data)) {
        products = data;
      } else if (Array.isArray(data.products)) {
        products = data.products;
      } else if (Array.isArray(data.data)) {
        products = data.data;
      }


      state.products = products;


      renderWeightOptions();
      renderSellerOptions();
      renderProducts();


      if ($("siteUpdated")) {
        $("siteUpdated").textContent =
          formatUpdated(
            data.updatedAt ||
            data.timestamp
          );
      }


      showNotice(
        $("productNotice"),
        state.products.length
          ? ""
          : "Worker returned zero products.",
        state.products.length
          ? ""
          : "info"
      );


    } catch (error) {

      console.error(
        "Products load failed:",
        error
      );


      state.products = [];


      if ($("productCount")) {
        $("productCount").textContent =
          "0 products";
      }


      if ($("comparisonList")) {
        $("comparisonList").innerHTML = `
          <div class="empty">
            <div class="empty-icon">⚠️</div>
            <strong>Products could not be loaded</strong>
            <p>
              Worker product endpoint error:
              ${escapeHTML(error.message)}
            </p>
          </div>
        `;
      }


      showNotice(
        $("productNotice"),
        "Product endpoint error: " +
        error.message,
        "error"
      );
    }
  }


  /*
   * =========================================================
   * FILTER
   * =========================================================
   */

  function getFilteredProducts() {

    const purity =
      $("purityFilter")?.value || "";

    const weight =
      $("weightFilter")?.value || "";

    const seller =
      $("sellerFilter")?.value || "";


    return state.products
      .map(normalizeProduct)
      .filter(product => {

        if (
          product.listedPrice <= 0 &&
          !product.productUrl
        ) {
          return false;
        }


        if (
          purity &&
          product.purity !== purity
        ) {
          return false;
        }


        if (
          weight &&
          number(product.weight) !==
          number(weight)
        ) {
          return false;
        }


        if (
          seller &&
          product.sellerId !== seller
        ) {
          return false;
        }


        return true;
      });
  }


  /*
   * =========================================================
   * GROUPING
   * =========================================================
   */

  function normalizeName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(
        /\b(coin|gold|pure|plain|24k|22k|18k|24kt|22kt|18kt|karat|kt|916|999|999.9|750)\b/g,
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


  function groupKey(product) {

    return [
      product.purity,
      product.weight,
      normalizeName(
        product.productName
      )
    ].join("|");
  }


  /*
   * =========================================================
   * RENDER PRODUCTS
   * =========================================================
   */

  function renderProducts() {

    const products =
      getFilteredProducts();


    if ($("productCount")) {
      $("productCount").textContent =
        products.length +
        (
          products.length === 1
            ? " product"
            : " products"
        );
    }


    if (!products.length) {

      if ($("comparisonList")) {
        $("comparisonList").innerHTML = `
          <div class="empty">
            <div class="empty-icon">🪙</div>
            <strong>No matching gold coins found</strong>
            <p>
              Try another purity, weight or seller.
            </p>
          </div>
        `;
      }

      return;
    }


    const groups = new Map();


    for (const product of products) {

      const key =
        groupKey(product);


      if (!groups.has(key)) {
        groups.set(key, []);
      }


      groups
        .get(key)
        .push(product);
    }


    const groupArray =
      [...groups.values()];


    groupArray.forEach(group => {

      group.sort(
        (a, b) =>
          (a.listedPrice || Infinity) -
          (b.listedPrice || Infinity)
      );

    });


    if ($("comparisonList")) {
      $("comparisonList").innerHTML =
        groupArray
          .map(renderGroup)
          .join("");
    }
  }


  function renderGroup(group) {

    const validPrices =
      group.filter(
        p => p.listedPrice > 0
      );


    const cheapest =
      validPrices.length
        ? validPrices[0]
        : null;


    const first =
      group[0];


    const title =
      first.productName ||
      "Gold Coin";


    const rows =
      group
        .map(
          product =>
            renderSellerRow(
              product,
              cheapest
            )
        )
        .join("");


    return `
      <article class="comparison-card">

        <div class="comparison-title">

          <div>

            <h3>
              ${escapeHTML(title)}
            </h3>

            <div class="meta">

              ${
                first.purity
                  ? `<span>${escapeHTML(first.purity)}</span>`
                  : ""
              }

              ${
                first.weight
                  ? `<span>${escapeHTML(first.weight)} g</span>`
                  : ""
              }

            </div>

          </div>

          ${
            cheapest
              ? `
                <div class="lowest">

                  <small>
                    LOWEST LISTED PRICE
                  </small>

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

        ${rows}

      </article>
    `;
  }


  function renderSellerRow(
    product,
    cheapest
  ) {

    const isLowest =
      cheapest &&
      product === cheapest;


    const offers = [];


    if (product.coupon > 0) {
      offers.push(`
        <span class="offer">
          Coupon ${money(product.coupon)}
        </span>
      `);
    }


    if (product.cardOffer > 0) {
      offers.push(`
        <span class="offer blue">
          Card ${money(product.cardOffer)}
        </span>
      `);
    }


    if (product.upiOffer > 0) {
      offers.push(`
        <span class="offer blue">
          UPI ${money(product.upiOffer)}
        </span>
      `);
    }


    if (product.cashback > 0) {
      offers.push(`
        <span class="offer green">
          Cashback ${money(product.cashback)}
        </span>
      `);
    }


    if (product.voucher) {
      offers.push(`
        <span class="offer">
          Voucher:
          ${escapeHTML(product.voucher)}
        </span>
      `);
    }


    if (product.promoCode) {
      offers.push(`
        <span class="offer">
          Promo:
          ${escapeHTML(product.promoCode)}
        </span>
      `);
    }


    if (product.offerText) {
      offers.push(`
        <span class="offer green">
          ${escapeHTML(product.offerText)}
        </span>
      `);
    }


    const offerHTML =
      offers.length
        ? offers.join("")
        : '<span class="no-offer">No offer listed</span>';


    const url =
      product.productUrl;


    return `
      <div class="seller-row ${
        isLowest
          ? "lowest-row"
          : ""
      }">

        <div>

          <div class="seller-name">

            ${escapeHTML(
              product.seller
            )}

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

        </div>


        <div class="seller-price">

          <strong>
            ${money(
              product.listedPrice
            )}
          </strong>

          ${
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


        <div class="offer-list">
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
                  View Exact Product
                </a>
              `
              : `
                <span class="missing-link">
                  Exact product link unavailable
                </span>
              `
          }

        </div>

      </div>
    `;
  }


  /*
   * =========================================================
   * WEIGHT OPTIONS
   * =========================================================
   */

  function renderWeightOptions() {

    const select =
      $("weightFilter");


    if (!select) {
      return;
    }


    const current =
      select.value;


    const weights =
      [
        ...new Set(
          state.products
            .map(normalizeProduct)
            .map(p => p.weight)
            .filter(w => w > 0)
        )
      ]
      .sort((a, b) => a - b);


    select.innerHTML =
      '<option value="">All Weights</option>';


    weights.forEach(weight => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        String(weight);


      option.textContent =
        weight < 1
          ? Math.round(weight * 1000) + " mg"
          : weight + " g";


      select.appendChild(option);
    });


    if (
      weights.includes(
        number(current)
      )
    ) {
      select.value =
        current;
    }
  }


  /*
   * =========================================================
   * SELLER OPTIONS
   * =========================================================
   */

  function renderSellerOptions() {

    const select =
      $("sellerFilter");


    if (!select) {
      return;
    }


    const current =
      select.value;


    const sellers =
      new Map();


    state.products
      .map(normalizeProduct)
      .forEach(product => {

        if (
          product.sellerId &&
          product.seller
        ) {

          sellers.set(
            product.sellerId,
            product.seller
          );
        }
      });


    select.innerHTML =
      '<option value="">All Sellers</option>';


    [...sellers.entries()]
      .sort(
        (a, b) =>
          a[1].localeCompare(b[1])
      )
      .forEach(
        ([id, name]) => {

          const option =
            document.createElement(
              "option"
            );


          option.value = id;
          option.textContent = name;


          select.appendChild(option);
        }
      );


    if (sellers.has(current)) {
      select.value = current;
    }
  }


  /*
   * =========================================================
   * OFFERS
   * =========================================================
   */

  async function loadOffers() {

    if ($("offersGrid")) {
      $("offersGrid").innerHTML =
        '<div class="loading">Loading offers...</div>';
    }


    try {

      const data =
        await fetchJSON(
          ENDPOINTS.offers,
          30000
        );


      if (
        data &&
        data.ok === false
      ) {
        throw new Error(
          data.message ||
          "Offers API returned an error"
        );
      }


      if (Array.isArray(data)) {
        state.offers = data;
      } else if (
        Array.isArray(data?.offers)
      ) {
        state.offers =
          data.offers;
      } else if (
        Array.isArray(data?.data)
      ) {
        state.offers =
          data.data;
      } else {
        state.offers = [];
      }


      renderOffers();


    } catch (error) {

      console.error(
        "Offers load failed:",
        error
      );


      /*
       * Product-level fallback.
       */

      const products =
        state.products
          .map(normalizeProduct);


      state.offers =
        products.filter(
          p =>
            p.coupon > 0 ||
            p.cardOffer > 0 ||
            p.upiOffer > 0 ||
            p.cashback > 0 ||
            p.voucher ||
            p.promoCode ||
            p.offerText
        );


      renderOffers();
    }
  }


  function renderOffers() {

    if (
      !state.offers.length
    ) {

      if ($("offersGrid")) {
        $("offersGrid").innerHTML = `
          <div class="empty">
            <div class="empty-icon">🎁</div>

            <strong>
              No separate offers found
            </strong>

            <p>
              Product-level offers will appear
              inside comparison results when available.
            </p>

          </div>
        `;
      }

      return;
    }


    if (!$("offersGrid")) {
      return;
    }


    $("offersGrid").innerHTML =
      state.offers
        .map(offer => {

          const url =
            validURL(
              offer.productUrl ||
              offer.url ||
              offer.link
            );


          const parts = [];


          if (
            number(offer.coupon) > 0
          ) {
            parts.push(
              "Coupon " +
              money(offer.coupon)
            );
          }


          if (
            number(offer.cardOffer) > 0
          ) {
            parts.push(
              "Card " +
              money(offer.cardOffer)
            );
          }


          if (
            number(offer.upiOffer) > 0
          ) {
            parts.push(
              "UPI " +
              money(offer.upiOffer)
            );
          }


          if (
            number(offer.cashback) > 0
          ) {
            parts.push(
              "Cashback " +
              money(offer.cashback)
            );
          }


          return `
            <article class="offer-card">

              <div class="seller">
                ${escapeHTML(
                  offer.seller ||
                  offer.sellerName ||
                  "Seller"
                )}
              </div>

              <span class="product">
                ${escapeHTML(
                  offer.productName ||
                  offer.name ||
                  "Gold Product"
                )}
              </span>


              ${
                parts.length
                  ? `
                    <div class="offer-list">

                      ${
                        parts
                          .map(
                            p =>
                              `<span class="offer">${escapeHTML(p)}</span>`
                          )
                          .join("")
                      }

                    </div>
                  `
                  : ""
              }


              ${
                offer.voucher
                  ? `
                    <p>
                      <strong>
                        Voucher:
                      </strong>

                      ${escapeHTML(
                        offer.voucher
                      )}
                    </p>
                  `
                  : ""
              }


              ${
                offer.promoCode
                  ? `
                    <p>

                      <strong>
                        Promo code:
                      </strong>

                      <span class="code">
                        ${escapeHTML(
                          offer.promoCode
                        )}
                      </span>

                    </p>
                  `
                  : ""
              }


              ${
                offer.offerText
                  ? `
                    <p>
                      ${escapeHTML(
                        offer.offerText
                      )}
                    </p>
                  `
                  : ""
              }


              ${
                url
                  ? `
                    <a
                      class="offer-link"
                      href="${escapeHTML(url)}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Exact Product →
                    </a>
                  `
                  : ""
              }

            </article>
          `;
        })
        .join("");
  }


  /*
   * =========================================================
   * SELLERS
   * =========================================================
   */

  async function loadSellers() {

    try {

      const data =
        await fetchJSON(
          ENDPOINTS.sellers,
          20000
        );


      if (
        data &&
        data.ok === false
      ) {
        throw new Error(
          data.message ||
          "Sellers API returned an error"
        );
      }


      if (Array.isArray(data)) {
        state.sellers = data;
      } else if (
        Array.isArray(data?.sellers)
      ) {
        state.sellers =
          data.sellers;
      } else if (
        Array.isArray(data?.data)
      ) {
        state.sellers =
          data.data;
      } else {
        state.sellers = [];
      }


      renderSellers();


    } catch (error) {

      console.error(
        "Sellers load failed:",
        error
      );


      /*
       * Product fallback.
       */

      const map =
        new Map();


      state.products
        .map(normalizeProduct)
        .forEach(product => {

          if (
            product.sellerId &&
            product.seller
          ) {

            map.set(
              product.sellerId,
              product.seller
            );
          }
        });


      state.sellers =
        [...map.entries()]
          .map(
            ([id, name]) => ({
              id,
              name
            })
          );


      renderSellers();
    }
  }


  function renderSellers() {

    if (!$("sellerGrid")) {
      return;
    }


    if (
      !state.sellers.length
    ) {

      $("sellerGrid").innerHTML =
        '<div class="loading">No seller data available.</div>';

      return;
    }


    $("sellerGrid").innerHTML =
      state.sellers
        .map(seller => {

          const name =
            seller.name ||
            seller.seller ||
            seller.sellerName ||
            seller.id ||
            "Seller";


          return `
            <div class="seller-box">

              <strong>
                ${escapeHTML(name)}
              </strong>

              <span>
                Gold coin seller
              </span>

            </div>
          `;
        })
        .join("");
  }


  /*
   * =========================================================
   * EVENTS
   * =========================================================
   */

  function setupEvents() {

    $("refreshGold")?.addEventListener(
      "click",
      loadGold
    );


    $("refreshOffers")?.addEventListener(
      "click",
      loadOffers
    );


    $("compareBtn")?.addEventListener(
      "click",
      renderProducts
    );


    $("clearBtn")?.addEventListener(
      "click",
      function () {

        if ($("purityFilter")) {
          $("purityFilter").value = "";
        }

        if ($("weightFilter")) {
          $("weightFilter").value = "";
        }

        if ($("sellerFilter")) {
          $("sellerFilter").value = "";
        }

        renderProducts();
      }
    );


    $("purityFilter")?.addEventListener(
      "change",
      renderProducts
    );


    $("weightFilter")?.addEventListener(
      "change",
      renderProducts
    );


    $("sellerFilter")?.addEventListener(
      "change",
      renderProducts
    );
  }


  /*
   * =========================================================
   * STARTUP
   * =========================================================
   */

  async function init() {

    if ($("year")) {
      $("year").textContent =
        new Date().getFullYear();
    }


    if ($("siteUpdated")) {
      $("siteUpdated").textContent =
        "Loading...";
    }


    setupEvents();


    /*
     * Load independently.
     * One failure must NOT stop the others.
     */

    await Promise.allSettled([
      loadGold(),
      loadProducts(),
      loadSellers(),
      loadOffers()
    ]);


    /*
     * Offers may have loaded before products.
     * Rebuild fallback offers after products arrive.
     */

    if (
      state.products.length &&
      !state.offers.length
    ) {
      renderOffers();
    }


    if (state.products.length) {

      renderWeightOptions();
      renderSellerOptions();
      renderProducts();
    }


    /*
     * If all API calls failed, make the
     * connection status explicit.
     */

    if (
      !state.gold &&
      !state.products.length &&
      !state.sellers.length
    ) {

      setConnection(
        false,
        "Worker unavailable"
      );
    }
  }


  /*
   * =========================================================
   * BOOT
   * =========================================================
   */

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

})();

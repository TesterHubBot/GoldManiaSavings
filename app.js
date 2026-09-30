/* =========================================================
   GoldManiaSavings - FINAL app.js
   Frontend for Cloudflare Worker scraper API

   Required API:
   https://goldmaniasavings-api.onlinetechmine.workers.dev

   Features:
   - 24K / 22K / 18K gold price
   - All gold-coin sellers
   - Exact product URLs
   - Product comparison
   - Lowest-price identification
   - Offers
   - Vouchers
   - Promo codes
   - Card offers
   - UPI offers
   - Cashback
   - Seller filtering
   - Purity filtering
   - Weight filtering
   - Mobile-safe rendering
========================================================= */

"use strict";

/* =========================================================
   CONFIG
========================================================= */

const API_BASE =
    "https://goldmaniasavings-api.onlinetechmine.workers.dev";

const state = {
    gold: null,
    products: [],
    offers: [],
    sellers: [],
    filteredProducts: [],

    purity: "",
    weight: "",
    seller: ""
};


/* =========================================================
   DOM
========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   API FETCH
========================================================= */

async function apiFetch(path) {

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => controller.abort(),
            25000
        );

    try {

        const response =
            await fetch(
                API_BASE + path,
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

        const raw =
            await response.text();

        let data = null;

        try {

            data =
                JSON.parse(raw);

        } catch {

            throw new Error(
                "Worker returned invalid JSON"
            );

        }

        if (!response.ok) {

            throw new Error(
                data?.message ||
                `HTTP ${response.status}`
            );

        }

        return data;

    } finally {

        clearTimeout(timeout);

    }
}


/* =========================================================
   HELPERS
========================================================= */

function number(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }

    const n =
        Number(
            String(value)
                .replace(/₹/g, "")
                .replace(/,/g, "")
                .trim()
        );

    return Number.isFinite(n)
        ? n
        : 0;
}


function money(value) {

    const n =
        number(value);

    if (!n) {
        return "—";
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


function cleanText(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/\s+/g, " ")
        .trim();

}


function escapeHTML(value) {

    return cleanText(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function safeURL(value) {

    const url =
        cleanText(value);

    if (
        !/^https?:\/\//i.test(url)
    ) {
        return "";
    }

    try {

        const parsed =
            new URL(url);

        if (
            parsed.protocol !== "http:" &&
            parsed.protocol !== "https:"
        ) {
            return "";
        }

        return parsed.href;

    } catch {

        return "";

    }
}


/* =========================================================
   WEIGHT
========================================================= */

function getWeight(product) {

    const direct =
        number(
            product?.weight
        );

    if (
        direct > 0
    ) {
        return direct;
    }

    const name =
        cleanText(
            product?.productName
        );

    const match =
        name.match(
            /(\d+(?:\.\d+)?)\s*(?:g|gm|gram|grams)\b/i
        );

    if (match) {
        return number(match[1]);
    }

    if (
        /\b50\s*mg\b/i.test(name)
    ) {
        return 0.05;
    }

    if (
        /\b100\s*mg\b/i.test(name)
    ) {
        return 0.1;
    }

    if (
        /\b200\s*mg\b/i.test(name)
    ) {
        return 0.2;
    }

    if (
        /\b500\s*mg\b/i.test(name)
    ) {
        return 0.5;
    }

    return 0;
}


/* =========================================================
   PURITY
========================================================= */

function getPurity(product) {

    const direct =
        cleanText(
            product?.purity
        ).toUpperCase();

    if (
        direct === "24K" ||
        direct === "22K" ||
        direct === "18K"
    ) {
        return direct;
    }

    const text =
        (
            cleanText(
                product?.productName
            ) +
            " " +
            cleanText(
                product?.description
            )
        ).toUpperCase();

    if (
        /\b999(?:\.9)?\b/.test(text) ||
        /\b995\b/.test(text) ||
        /\b24\s*K\b/.test(text) ||
        /\b24KT\b/.test(text) ||
        /\b24\s*KARAT\b/.test(text)
    ) {
        return "24K";
    }

    if (
        /\b916\b/.test(text) ||
        /\b22\s*K\b/.test(text) ||
        /\b22KT\b/.test(text) ||
        /\b22\s*KARAT\b/.test(text)
    ) {
        return "22K";
    }

    if (
        /\b750\b/.test(text) ||
        /\b18\s*K\b/.test(text) ||
        /\b18KT\b/.test(text) ||
        /\b18\s*KARAT\b/.test(text)
    ) {
        return "18K";
    }

    return "";
}


/* =========================================================
   PRODUCT NORMALISATION
========================================================= */

function normaliseProduct(product) {

    if (
        !product ||
        typeof product !== "object"
    ) {
        return null;
    }

    const name =
        cleanText(
            product.productName ||
            product.name ||
            product.title ||
            "Gold Coin"
        );

    const seller =
        cleanText(
            product.seller ||
            product.source ||
            product.sellerId ||
            "Unknown Seller"
        );

    const purity =
        getPurity(product);

    const weight =
        getWeight(product);

    const price =
        number(
            product.listedPrice ??
            product.price ??
            product.salePrice
        );

    const url =
        safeURL(
            product.productUrl ||
            product.url ||
            product.link
        );

    return {
        ...product,

        productName:
            name,

        seller:
            seller,

        purity:
            purity,

        weight:
            weight,

        listedPrice:
            price,

        productUrl:
            url,

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
            cleanText(product.voucher),

        promoCode:
            cleanText(
                product.promoCode ||
                product.promo
            ),

        offerText:
            cleanText(
                product.offerText ||
                product.offer ||
                product.offers
            )
    };
}


/* =========================================================
   GOLD PRICE
========================================================= */

function extractGoldRate(
    data,
    purity
) {

    const india =
        data?.indiaReference?.rates;

    if (
        india &&
        india[purity]
    ) {

        return number(
            india[purity].perGram
        );

    }

    const direct =
        data?.rates?.[purity];

    if (
        direct &&
        typeof direct === "object"
    ) {

        return number(
            direct.perGram
        );

    }

    if (
        typeof direct === "number"
    ) {

        return number(direct);

    }

    const international =
        data?.internationalSpot?.rates;

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


async function loadGold() {

    const errorBox =
        $("goldError");

    if (errorBox) {
        errorBox.classList.add("hidden");
        errorBox.textContent = "";
    }

    setGoldText(
        "gold24",
        "Loading..."
    );

    setGoldText(
        "gold22",
        "Loading..."
    );

    setGoldText(
        "gold18",
        "Loading..."
    );

    try {

        const data =
            await apiFetch(
                "/api/gold"
            );

        state.gold =
            data;

        const rate24 =
            extractGoldRate(
                data,
                "24K"
            );

        const rate22 =
            extractGoldRate(
                data,
                "22K"
            );

        const rate18 =
            extractGoldRate(
                data,
                "18K"
            );

        setGoldText(
            "gold24",
            rate24
                ? money(rate24)
                : "Unavailable"
        );

        setGoldText(
            "gold22",
            rate22
                ? money(rate22)
                : "Unavailable"
        );

        setGoldText(
            "gold18",
            rate18
                ? money(rate18)
                : "Unavailable"
        );

        if ($("goldSource")) {

            $("goldSource").textContent =
                data?.indiaReference?.source ||
                data?.internationalSpot?.source ||
                "Worker";

        }

        if ($("goldUpdated")) {

            const date =
                data?.timestamp ||
                data?.updatedAt ||
                data?.indiaReference?.date;

            $("goldUpdated").textContent =
                date
                    ? formatDate(date)
                    : "Available";

        }

        setConnection(
            true,
            "Connected"
        );

        return data;

    } catch (error) {

        console.error(
            "Gold loading error:",
            error
        );

        setGoldText(
            "gold24",
            "Unavailable"
        );

        setGoldText(
            "gold22",
            "Unavailable"
        );

        setGoldText(
            "gold18",
            "Unavailable"
        );

        if (errorBox) {

            errorBox.textContent =
                "Gold price could not be loaded from the Worker: " +
                error.message;

            errorBox.classList.remove(
                "hidden"
            );

        }

        setConnection(
            false,
            "Worker unavailable"
        );

        return null;
    }
}


function setGoldText(
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


/* =========================================================
   PRODUCTS
========================================================= */

async function loadProducts() {

    try {

        const data =
            await apiFetch(
                "/api/products"
            );

        const raw =
            Array.isArray(
                data?.products
            )
                ? data.products
                : [];

        state.products =
            raw
                .map(
                    normaliseProduct
                )
                .filter(Boolean)
                .filter(
                    product =>
                        product.listedPrice > 0 &&
                        product.productUrl
                );

        updateSiteTime(
            data?.updatedAt
        );

        populateSellerFilter();

        renderSellers();

        return state.products;

    } catch (error) {

        console.error(
            "Product loading error:",
            error
        );

        state.products = [];

        renderProductsError(
            "Products could not be loaded: " +
            error.message
        );

        return [];

    }
}


/* =========================================================
   OFFERS
========================================================= */

async function loadOffers() {

    const loading =
        $("offersLoading");

    const grid =
        $("offersGrid");

    const empty =
        $("offersEmpty");

    if (loading) {
        loading.classList.remove(
            "hidden"
        );
        loading.textContent =
            "Loading offers...";
    }

    if (grid) {
        grid.innerHTML = "";
    }

    if (empty) {
        empty.classList.add(
            "hidden"
        );
    }

    try {

        const data =
            await apiFetch(
                "/api/offers"
            );

        state.offers =
            Array.isArray(
                data?.offers
            )
                ? data.offers
                : [];

        renderOffers();

        return state.offers;

    } catch (error) {

        console.error(
            "Offers loading error:",
            error
        );

        state.offers = [];

        if (loading) {

            loading.textContent =
                "Offers unavailable";

        }

        if (empty) {
            empty.classList.remove(
                "hidden"
            );
        }

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

        state.sellers =
            Array.isArray(
                data?.sellers
            )
                ? data.sellers
                : [];

        renderSellers();

        populateSellerFilter();

        return state.sellers;

    } catch (error) {

        console.error(
            "Seller loading error:",
            error
        );

        return [];

    }
}


/* =========================================================
   FILTER
========================================================= */

function getSelectedFilters() {

    state.purity =
        cleanText(
            $("purityFilter")?.value
        );

    state.weight =
        cleanText(
            $("weightFilter")?.value
        );

    state.seller =
        cleanText(
            $("sellerFilter")?.value
        );

}


/* =========================================================
   MATCH PRODUCT
========================================================= */

function matchesProduct(
    product
) {

    if (
        state.purity &&
        getPurity(product) !==
        state.purity.toUpperCase()
    ) {
        return false;
    }

    if (
        state.weight
    ) {

        const wanted =
            number(
                state.weight
            );

        const actual =
            getWeight(product);

        if (
            Math.abs(
                actual - wanted
            ) > 0.001
        ) {
            return false;
        }

    }

    if (
        state.seller
    ) {

        const selected =
            state.seller.toLowerCase();

        const actual =
            cleanText(
                product.seller
            ).toLowerCase();

        if (
            selected !== actual
        ) {
            return false;
        }

    }

    return true;
}


/* =========================================================
   COMPARE
========================================================= */

function compareGold() {

    getSelectedFilters();

    const products =
        state.products
            .filter(
                matchesProduct
            );

    state.filteredProducts =
        products;

    renderComparison(
        products
    );

    renderBestPrice(
        products
    );

    const section =
        $("comparisonSection");

    if (section) {

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }
}


/* =========================================================
   SORT
========================================================= */

function sortProducts(
    products
) {

    return [
        ...products
    ].sort(
        (a, b) =>
            number(a.listedPrice) -
            number(b.listedPrice)
    );

}


/* =========================================================
   LOWEST PRICE
========================================================= */

function getLowestPrice(
    products
) {

    const prices =
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

    if (!prices.length) {
        return 0;
    }

    return Math.min(
        ...prices
    );
}


/* =========================================================
   OFFER ITEMS
========================================================= */

function getOffers(
    product
) {

    const offers = [];

    if (
        number(
            product.coupon
        ) > 0
    ) {

        offers.push({
            type: "coupon",
            text:
                "Coupon " +
                money(
                    product.coupon
                )
        });

    }

    if (
        number(
            product.cardOffer
        ) > 0
    ) {

        offers.push({
            type: "card",
            text:
                "Card offer " +
                money(
                    product.cardOffer
                )
        });

    }

    if (
        number(
            product.upiOffer
        ) > 0
    ) {

        offers.push({
            type: "upi",
            text:
                "UPI offer " +
                money(
                    product.upiOffer
                )
        });

    }

    if (
        number(
            product.cashback
        ) > 0
    ) {

        offers.push({
            type: "cashback",
            text:
                "Cashback " +
                money(
                    product.cashback
                )
        });

    }

    if (
        product.voucher
    ) {

        offers.push({
            type: "voucher",
            text:
                "Voucher: " +
                product.voucher
        });

    }

    if (
        product.promoCode
    ) {

        offers.push({
            type: "promo",
            text:
                "Promo: " +
                product.promoCode
        });

    }

    if (
        product.offerText
    ) {

        offers.push({
            type: "offer",
            text:
                product.offerText
        });

    }

    return offers;
}


/* =========================================================
   RENDER OFFERS
========================================================= */

function renderOffers() {

    const loading =
        $("offersLoading");

    const grid =
        $("offersGrid");

    const empty =
        $("offersEmpty");

    if (loading) {
        loading.classList.add(
            "hidden"
        );
    }

    if (!grid) {
        return;
    }

    if (
        !state.offers.length
    ) {

        grid.innerHTML = "";

        if (empty) {
            empty.classList.remove(
                "hidden"
            );
        }

        return;
    }

    if (empty) {
        empty.classList.add(
            "hidden"
        );
    }

    grid.innerHTML =
        state.offers
            .map(
                offer => {

                    const items = [];

                    if (
                        number(
                            offer.coupon
                        ) > 0
                    ) {
                        items.push(
                            "Coupon " +
                            money(
                                offer.coupon
                            )
                        );
                    }

                    if (
                        number(
                            offer.cardOffer
                        ) > 0
                    ) {
                        items.push(
                            "Card " +
                            money(
                                offer.cardOffer
                            )
                        );
                    }

                    if (
                        number(
                            offer.upiOffer
                        ) > 0
                    ) {
                        items.push(
                            "UPI " +
                            money(
                                offer.upiOffer
                            )
                        );
                    }

                    if (
                        number(
                            offer.cashback
                        ) > 0
                    ) {
                        items.push(
                            "Cashback " +
                            money(
                                offer.cashback
                            )
                        );
                    }

                    if (
                        offer.voucher
                    ) {
                        items.push(
                            "Voucher: " +
                            offer.voucher
                        );
                    }

                    if (
                        offer.promoCode
                    ) {
                        items.push(
                            "Promo: " +
                            offer.promoCode
                        );
                    }

                    if (
                        offer.offerText
                    ) {
                        items.push(
                            offer.offerText
                        );
                    }

                    const url =
                        safeURL(
                            offer.productUrl
                        );

                    return `
                        <article class="offer-card">

                            <div class="offer-card-top">
                                <strong>
                                    ${escapeHTML(
                                        offer.seller ||
                                        "Seller"
                                    )}
                                </strong>
                            </div>

                            <div class="offer-product">
                                ${escapeHTML(
                                    offer.productName ||
                                    "Gold Coin"
                                )}
                            </div>

                            <div class="offer-list">
                                ${
                                    items.length
                                        ? items.map(
                                            item =>
                                                `<span class="offer-tag">
                                                    ${escapeHTML(item)}
                                                </span>`
                                        ).join("")
                                        : `<span class="no-offer">
                                            No offer details
                                          </span>`
                                }
                            </div>

                            ${
                                url
                                    ? `
                                        <a
                                            class="product-link"
                                            href="${escapeHTML(url)}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            View Product
                                        </a>
                                      `
                                    : ""
                            }

                        </article>
                    `;

                }
            )
            .join("");
}


/* =========================================================
   RENDER COMPARISON
========================================================= */

function renderComparison(
    products
) {

    const body =
        $("comparisonBody");

    const empty =
        $("emptyState");

    const count =
        $("productCount");

    if (!body) {
        return;
    }

    if (count) {

        count.textContent =
            `${products.length} product` +
            (
                products.length === 1
                    ? ""
                    : "s"
            );

    }

    if (!products.length) {

        body.innerHTML = "";

        if (empty) {
            empty.classList.remove(
                "hidden"
            );
        }

        return;
    }

    if (empty) {
        empty.classList.add(
            "hidden"
        );
    }

    const sorted =
        sortProducts(
            products
        );

    const lowest =
        getLowestPrice(
            sorted
        );

    body.innerHTML =
        sorted
            .map(
                product =>
                    renderProductRow(
                        product,
                        lowest
                    )
            )
            .join("");
}


/* =========================================================
   PRODUCT ROW
========================================================= */

function renderProductRow(
    product,
    lowestPrice
) {

    const seller =
        cleanText(
            product.seller
        ) ||
        "Seller";

    const name =
        cleanText(
            product.productName
        ) ||
        "Gold Coin";

    const purity =
        getPurity(
            product
        );

    const weight =
        getWeight(
            product
        );

    const price =
        number(
            product.listedPrice
        );

    const isLowest =
        price > 0 &&
        price === lowestPrice;

    const url =
        safeURL(
            product.productUrl
        );

    const offers =
        getOffers(
            product
        );

    const offerHTML =
        offers.length
            ? `
                <div class="offer-list">
                    ${
                        offers
                            .map(
                                offer =>
                                    `
                                    <span
                                        class="offer-tag ${escapeHTML(
                                            offer.type
                                        )}"
                                    >
                                        ${escapeHTML(
                                            offer.text
                                        )}
                                    </span>
                                    `
                            )
                            .join("")
                    }
                </div>
              `
            : `
                <span class="no-offer">
                    No offer
                </span>
              `;

    const priceClass =
        isLowest
            ? "product-price lowest-price"
            : "product-price";

    return `
        <tr>

            <td class="seller-cell">

                <span class="seller-name">
                    ${escapeHTML(
                        seller
                    )}
                </span>

                <span class="seller-subtitle">
                    Verified seller
                </span>

            </td>


            <td class="product-cell">

                <div class="product-name">
                    ${escapeHTML(
                        name
                    )}
                </div>

                ${
                    product.id
                        ? `
                            <div class="product-id">
                                ${escapeHTML(
                                    String(
                                        product.id
                                    )
                                )}
                            </div>
                          `
                        : ""
                }

            </td>


            <td>

                <span class="purity-pill">
                    ${escapeHTML(
                        purity ||
                        "—"
                    )}
                </span>

            </td>


            <td>

                <span class="weight-value">
                    ${
                        weight
                            ? formatWeight(
                                weight
                              )
                            : "—"
                    }
                </span>

            </td>


            <td class="price-cell">

                <div class="${priceClass}">
                    ${money(price)}
                </div>

                ${
                    number(product.mrp) > price
                        ? `
                            <div class="mrp">
                                ${money(
                                    product.mrp
                                )}
                            </div>
                          `
                        : ""
                }

            </td>


            <td class="offer-cell">

                ${offerHTML}

            </td>


            <td>

                ${
                    url
                        ? `
                            <a
                                class="product-link"
                                href="${escapeHTML(url)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View Product
                            </a>
                          `
                        : `
                            <span class="no-offer">
                                Link unavailable
                            </span>
                          `
                }

            </td>

        </tr>
    `;
}


/* =========================================================
   BEST PRICE
========================================================= */

function renderBestPrice(
    products
) {

    const section =
        $("bestPriceSection");

    const grid =
        $("bestPriceCards");

    if (
        !section ||
        !grid
    ) {
        return;
    }

    if (!products.length) {

        section.classList.add(
            "hidden"
        );

        grid.innerHTML = "";

        return;
    }

    const sorted =
        sortProducts(
            products
        );

    const best =
        sorted[0];

    if (!best) {
        section.classList.add(
            "hidden"
        );
        return;
    }

    section.classList.remove(
        "hidden"
    );

    const url =
        safeURL(
            best.productUrl
        );

    grid.innerHTML = `
        <article class="best-price-card">

            <div class="best-price-label">
                LOWEST LISTED PRICE
            </div>

            <div class="best-price-value">
                ${money(
                    best.listedPrice
                )}
            </div>

            <div class="best-price-seller">
                ${escapeHTML(
                    best.seller
                )}
            </div>

            <div class="best-price-product">
                ${escapeHTML(
                    best.productName
                )}
            </div>

            ${
                url
                    ? `
                        <a
                            class="product-link"
                            href="${escapeHTML(url)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            View Product
                        </a>
                      `
                    : ""
            }

        </article>
    `;
}


/* =========================================================
   SELLER FILTER
========================================================= */

function populateSellerFilter() {

    const select =
        $("sellerFilter");

    if (!select) {
        return;
    }

    const current =
        cleanText(
            select.value
        );

    const names =
        new Set();

    state.products.forEach(
        product => {

            const seller =
                cleanText(
                    product.seller
                );

            if (seller) {
                names.add(
                    seller
                );
            }

        }
    );

    state.sellers.forEach(
        seller => {

            const name =
                cleanText(
                    seller.name
                );

            if (name) {
                names.add(
                    name
                );
            }

        }
    );

    const sorted =
        Array.from(
            names
        ).sort(
            (a, b) =>
                a.localeCompare(
                    b
                )
        );

    select.innerHTML = `
        <option value="">
            All Sellers
        </option>
    `;

    sorted.forEach(
        seller => {

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

    if (
        current &&
        sorted.includes(
            current
        )
    ) {

        select.value =
            current;

    }

}


/* =========================================================
   SELLER CARDS
========================================================= */

function renderSellers() {

    const grid =
        $("sellerGrid");

    if (!grid) {
        return;
    }

    const sellers =
        state.sellers.length
            ? state.sellers
            : buildSellersFromProducts();

    if (!sellers.length) {

        grid.innerHTML =
            `
                <div class="empty-state small">
                    Seller data unavailable.
                </div>
            `;

        return;
    }

    grid.innerHTML =
        sellers
            .map(
                seller => {

                    const name =
                        cleanText(
                            seller.name
                        );

                    const website =
                        safeURL(
                            seller.website
                        );

                    const productCount =
                        state.products.filter(
                            product =>
                                cleanText(
                                    product.seller
                                ) === name
                        ).length;

                    return `
                        <article class="seller-card">

                            <div class="seller-card-name">
                                ${escapeHTML(
                                    name
                                )}
                            </div>

                            <div class="seller-card-count">
                                ${productCount}
                                product${
                                    productCount === 1
                                        ? ""
                                        : "s"
                                }
                                found
                            </div>

                            ${
                                website
                                    ? `
                                        <a
                                            class="product-link"
                                            href="${escapeHTML(
                                                website
                                            )}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Seller Website
                                        </a>
                                      `
                                    : ""
                            }

                        </article>
                    `;
                }
            )
            .join("");
}


function buildSellersFromProducts() {

    const names =
        [
            ...new Set(
                state.products
                    .map(
                        product =>
                            cleanText(
                                product.seller
                            )
                    )
                    .filter(Boolean)
            )
        ];

    return names.map(
        name => ({
            name
        })
    );
}


/* =========================================================
   ERROR STATE
========================================================= */

function renderProductsError(
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
                <div class="empty-icon">
                    ⚠️
                </div>

                <h3>
                    Product data unavailable
                </h3>

                <p>
                    ${escapeHTML(
                        message
                    )}
                </p>

                <button
                    class="primary-btn"
                    type="button"
                    onclick="GoldMania.reloadProducts()"
                >
                    Retry
                </button>

            </td>
        </tr>
    `;

}


/* =========================================================
   CONNECTION
========================================================= */

function setConnection(
    online,
    message
) {

    const dot =
        $("connectionDot");

    const text =
        $("connectionText");

    if (dot) {

        dot.classList.remove(
            "online",
            "offline"
        );

        dot.classList.add(
            online
                ? "online"
                : "offline"
        );

    }

    if (text) {
        text.textContent =
            message;
    }

}


/* =========================================================
   DATE
========================================================= */

function formatDate(
    value
) {

    try {

        return new Date(
            value
        ).toLocaleString(
            "en-IN",
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );

    } catch {

        return cleanText(
            value
        );

    }
}


function updateSiteTime(
    value
) {

    const target =
        $("siteUpdated");

    if (!target) {
        return;
    }

    target.textContent =
        value
            ? formatDate(value)
            : new Date().toLocaleString(
                "en-IN"
            );

}


/* =========================================================
   WEIGHT FORMAT
========================================================= */

function formatWeight(
    weight
) {

    const n =
        number(weight);

    if (
        n < 1
    ) {

        return (
            n * 1000
        ).toFixed(
            n * 1000 % 1
                ? 2
                : 0
        ) + " mg";

    }

    return (
        Number.isInteger(n)
            ? n
            : n.toFixed(3)
                .replace(
                    /0+$/,
                    ""
                )
                .replace(
                    /\.$/,
                    ""
                )
    ) + " g";

}


/* =========================================================
   CLEAR FILTERS
========================================================= */

function clearFilters() {

    if ($("purityFilter")) {
        $("purityFilter").value = "";
    }

    if ($("weightFilter")) {
        $("weightFilter").value = "";
    }

    if ($("sellerFilter")) {
        $("sellerFilter").value = "";
    }

    state.purity = "";
    state.weight = "";
    state.seller = "";

    const all =
        state.products;

    state.filteredProducts =
        all;

    renderComparison(
        all
    );

    renderBestPrice(
        all
    );

}


/* =========================================================
   REFRESH
========================================================= */

async function refreshAll() {

    setConnection(
        true,
        "Refreshing..."
    );

    await Promise.all([
        loadGold(),
        loadProducts(),
        loadSellers(),
        loadOffers()
    ]);

    getSelectedFilters();

    if (
        state.purity ||
        state.weight ||
        state.seller
    ) {

        compareGold();

    } else {

        renderComparison(
            state.products
        );

        renderBestPrice(
            state.products
        );

    }

    setConnection(
        true,
        "Connected"
    );

}


/* =========================================================
   EVENT BINDING
========================================================= */

function bindEvents() {

    $("applyFilters")
        ?.addEventListener(
            "click",
            compareGold
        );

    $("clearFilters")
        ?.addEventListener(
            "click",
            clearFilters
        );

    $("refreshGold")
        ?.addEventListener(
            "click",
            loadGold
        );

    $("refreshOffers")
        ?.addEventListener(
            "click",
            loadOffers
        );

    $("purityFilter")
        ?.addEventListener(
            "change",
            compareGold
        );

    $("weightFilter")
        ?.addEventListener(
            "change",
            compareGold
        );

    $("sellerFilter")
        ?.addEventListener(
            "change",
            compareGold
        );

    $("closeModal")
        ?.addEventListener(
            "click",
            closeModal
        );

    $("modalBackdrop")
        ?.addEventListener(
            "click",
            closeModal
        );

}


/* =========================================================
   MODAL
========================================================= */

function closeModal() {

    const modal =
        $("productModal");

    if (!modal) {
        return;
    }

    modal.classList.add(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   YEAR
========================================================= */

function setYear() {

    const year =
        $("year");

    if (year) {

        year.textContent =
            new Date()
                .getFullYear();

    }

}


/* =========================================================
   INITIALISE
========================================================= */

async function init() {

    console.log(
        "GoldManiaSavings starting..."
    );

    setYear();

    bindEvents();

    setConnection(
        true,
        "Connecting..."
    );

    /*
     * Load all independently.
     * One failure must not stop
     * the remaining sections.
     */

    await Promise.allSettled([
        loadGold(),
        loadProducts(),
        loadSellers(),
        loadOffers()
    ]);

    /*
     * Show all products initially.
     * User can then choose purity,
     * weight or seller.
     */

    state.filteredProducts =
        state.products;

    renderComparison(
        state.products
    );

    renderBestPrice(
        state.products
    );

    populateSellerFilter();

    renderSellers();

    setConnection(
        true,
        "Connected"
    );

    console.log(
        "GoldManiaSavings ready",
        {
            products:
                state.products.length,

            offers:
                state.offers.length,

            sellers:
                state.sellers.length,

            gold:
                Boolean(state.gold)
        }
    );

}


/* =========================================================
   GLOBAL API
========================================================= */

window.compareGold =
    compareGold;

window.refreshComparison =
    compareGold;

window.GoldMania = {

    reload:
        refreshAll,

    reloadGold:
        loadGold,

    reloadProducts:
        loadProducts,

    reloadOffers:
        loadOffers,

    reloadSellers:
        loadSellers,

    clear:
        clearFilters,

    getState:
        () => state

};


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

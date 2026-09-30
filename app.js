"use strict";

/*
=========================================================
 GoldManiaSavings - app.js
 Compatible with the supplied index.html

 Cloudflare Worker:
 https://goldmaniasavings-api.onlinetechmine.workers.dev

 Expected endpoints:
   /api/gold
   /api/products
   /api/offers
   /api/history
=========================================================
*/

const API_BASE =
    "https://goldmaniasavings-api.onlinetechmine.workers.dev";


/* ========================================================
   STATE
======================================================== */

const state = {
    gold: null,
    products: [],
    offers: [],
    history: [],

    selectedPurity: "24K",
    selectedWeight: 1,

    filteredProducts: []
};


/* ========================================================
   HELPERS
======================================================== */

function $(id) {
    return document.getElementById(id);
}


function text(id, value) {
    const el = $(id);

    if (el) {
        el.textContent =
            value === null || value === undefined
                ? ""
                : String(value);
    }
}


function num(value, fallback = 0) {
    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;
}


function money(value) {
    const n = num(value);

    if (!n) {
        return "₹0";
    }

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(n);
}


function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function getProductUrl(value) {

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
            ""
        );
    }

    return "";
}


function normalisePurity(value) {

    const p =
        String(value || "")
            .trim()
            .toUpperCase();

    if (p.includes("24")) {
        return "24K";
    }

    if (p.includes("22")) {
        return "22K";
    }

    if (p.includes("18")) {
        return "18K";
    }

    return p;
}


function normaliseWeight(value) {
    return Number(
        Number(value).toFixed(4)
    );
}


function sameWeight(a, b) {

    return Math.abs(
        normaliseWeight(a) -
        normaliseWeight(b)
    ) < 0.0001;
}


/* ========================================================
   API
======================================================== */

async function api(path) {

    const url =
        API_BASE + path;

    const response =
        await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json"
            },
            cache: "no-store"
        });

    const contentType =
        response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        const body = await response.text();

        throw new Error(
            `API returned non-JSON response (${response.status}): ${body.slice(0, 200)}`
        );
    }

    if (!response.ok) {

        throw new Error(
            data?.message ||
            `API error ${response.status}`
        );

    }

    return data;
}


/* ========================================================
   GOLD RATE
======================================================== */

async function loadGold() {

    text("live24Rate", "Loading...");
    text("live22Rate", "Loading...");
    text("live18Rate", "Loading...");
    text("liveRateStatus", "🟡 Loading...");
    text("liveRateUpdated", "Fetching current reference rate...");

    try {

        const data =
            await api("/api/gold");

        state.gold = data;

        const rates =
            data?.indiaReference?.rates ||
            data?.rates ||
            {};

        const rate24 =
            num(
                rates?.["24K"]?.perGram ??
                rates?.["24K"] ??
                data?.["24K"]
            );

        const rate22 =
            num(
                rates?.["22K"]?.perGram ??
                rates?.["22K"] ??
                data?.["22K"]
            );

        const rate18 =
            num(
                rates?.["18K"]?.perGram ??
                rates?.["18K"] ??
                data?.["18K"]
            );


        text(
            "live24Rate",
            rate24
                ? money(rate24)
                : "Unavailable"
        );


        text(
            "live22Rate",
            rate22
                ? money(rate22)
                : "Unavailable"
        );


        text(
            "live18Rate",
            rate18
                ? money(rate18)
                : "Unavailable"
        );


        /*
         * Calculator inputs are number inputs.
         * Do NOT put ₹ symbol here.
         */

        const rate24Input =
            $("rate24");

        const rate22Input =
            $("rate22");


        if (rate24Input) {
            rate24Input.value =
                rate24 || "";
        }


        if (rate22Input) {
            rate22Input.value =
                rate22 || "";
        }


        text(
            "liveRateStatus",
            "🟢 Live"
        );


        const updated =
            data?.timestamp ||
            data?.updatedAt ||
            data?.indiaReference?.updatedAt;


        text(
            "liveRateUpdated",
            updated
                ? `Updated: ${new Date(updated).toLocaleString("en-IN")}`
                : "Current reference rate loaded"
        );


    } catch (error) {

        console.error(
            "Gold rate error:",
            error
        );


        text(
            "live24Rate",
            "Unavailable"
        );

        text(
            "live22Rate",
            "Unavailable"
        );

        text(
            "live18Rate",
            "Unavailable"
        );

        text(
            "liveRateStatus",
            "🔴 Offline"
        );

        text(
            "liveRateUpdated",
            "Gold rate unavailable"
        );

    }

}


/* ========================================================
   PRODUCTS
======================================================== */

async function loadProducts() {

    try {

        const data =
            await api("/api/products");

        const products =
            Array.isArray(data?.products)
                ? data.products
                : [];


        /*
         * IMPORTANT:
         * Only actual API products are accepted.
         * No fake products are generated here.
         */

        state.products =
            products.map(normaliseProduct);


        populateSellerFilter();

        refreshComparison();


        console.log(
            "GoldMania products loaded:",
            state.products.length
        );


        return data;


    } catch (error) {

        console.error(
            "Products API error:",
            error
        );


        state.products = [];

        renderProductsError(
            error.message
        );

    }

}


function normaliseProduct(product) {

    return {

        id:
            product?.id ||
            cryptoRandomId(),

        sellerId:
            product?.sellerId ||
            "",

        seller:
            product?.seller ||
            product?.source ||
            product?.sellerId ||
            "Unknown Seller",

        productName:
            product?.productName ||
            "Gold Coin",

        purity:
            normalisePurity(
                product?.purity
            ),

        weight:
            normaliseWeight(
                product?.weight
            ),

        listedPrice:
            num(
                product?.listedPrice
            ),

        mrp:
            num(
                product?.mrp
            ),

        shipping:
            num(
                product?.shipping
            ),

        coupon:
            num(
                product?.coupon
            ),

        cardOffer:
            num(
                product?.cardOffer
            ),

        upiOffer:
            num(
                product?.upiOffer
            ),

        cashback:
            num(
                product?.cashback
            ),

        voucher:
            String(
                product?.voucher || ""
            ),

        promoCode:
            String(
                product?.promoCode || ""
            ),

        offerText:
            String(
                product?.offerText || ""
            ),

        productUrl:
            getProductUrl(
                product?.productUrl
            ),

        status:
            product?.status ||
            "unknown",

        sourceType:
            product?.sourceType ||
            "",

        lastUpdated:
            product?.lastUpdated ||
            dataSafeDate(),

        source:
            product?.source ||
            product?.seller ||
            ""

    };

}


function cryptoRandomId() {

    return (
        "GM-" +
        Math.random()
            .toString(36)
            .slice(2) +
        Date.now()
    );

}


function dataSafeDate() {
    return new Date().toISOString();
}


/* ========================================================
   SELLER FILTER
======================================================== */

function populateSellerFilter() {

    const select =
        $("sellerFilter");

    if (!select) {
        return;
    }


    const current =
        select.value || "all";


    /*
     * Keep "All Sellers".
     * Remove dynamically created options.
     */

    select.innerHTML = `
        <option value="all">
            All Sellers
        </option>
    `;


    const sellers =
        [
            ...new Set(
                state.products
                    .map(
                        p => p.seller
                    )
                    .filter(Boolean)
            )
        ]
        .sort(
            (a, b) =>
                a.localeCompare(b)
        );


    sellers.forEach(
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
        sellers.includes(current)
    ) {
        select.value =
            current;
    }

}


/* ========================================================
   CALCULATOR
======================================================== */

function getSelectedPurity() {

    const element =
        $("purity");

    return element
        ? normalisePurity(element.value)
        : "24K";

}


function getSelectedWeight() {

    const element =
        $("weight");

    return element
        ? normaliseWeight(element.value)
        : 1;

}


function getReferenceRate(purity) {

    const rates =
        state.gold?.indiaReference?.rates ||
        state.gold?.rates ||
        {};

    return num(
        rates?.[purity]?.perGram ??
        rates?.[purity] ??
        0
    );

}


function calculateGoldValue(
    purity,
    weight
) {

    const rate =
        getReferenceRate(purity);

    return rate * weight;

}


function updateSummary(
    purity,
    weight
) {

    const goldValue =
        calculateGoldValue(
            purity,
            weight
        );


    const pureGold =
        purity === "24K"
            ? weight
            : purity === "22K"
                ? weight * (22 / 24)
                : purity === "18K"
                    ? weight * (18 / 24)
                    : weight;


    text(
        "summaryPurity",
        purity
    );


    text(
        "summaryWeight",
        `${weight} g`
    );


    text(
        "summaryPureGold",
        `${pureGold.toFixed(4)} g`
    );


    text(
        "summaryGoldValue",
        goldValue
            ? money(goldValue)
            : "Unavailable"
    );


    text(
        "comparisonTitle",
        `${purity} / ${weight}g Gold Coin Comparison`
    );

}


/* ========================================================
   COMPARE GOLD
======================================================== */

function compareGold() {

    const purity =
        getSelectedPurity();

    const weight =
        getSelectedWeight();


    state.selectedPurity =
        purity;

    state.selectedWeight =
        weight;


    updateSummary(
        purity,
        weight
    );


    const results =
        $("results");

    if (results) {
        results.style.display =
            "block";
    }


    refreshComparison();


    /*
     * Scroll only when user manually
     * clicked Compare button.
     */

    if (results) {

        setTimeout(
            () => {

                results.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            },
            50
        );

    }

}


/* ========================================================
   FILTER + SORT
======================================================== */

function refreshComparison() {

    const purity =
        getSelectedPurity();

    const weight =
        getSelectedWeight();


    state.selectedPurity =
        purity;

    state.selectedWeight =
        weight;


    updateSummary(
        purity,
        weight
    );


    let products =
        state.products.filter(
            product => {

                return (
                    product.purity === purity &&
                    sameWeight(
                        product.weight,
                        weight
                    )
                );

            }
        );


    /*
     * Seller filter
     */

    const seller =
        $("sellerFilter")?.value ||
        "all";


    if (seller !== "all") {

        products =
            products.filter(
                product =>
                    product.seller === seller
            );

    }


    /*
     * Payment filter
     */

    const payment =
        $("paymentFilter")?.value ||
        "all";


    if (payment === "card") {

        products =
            products.filter(
                product =>
                    product.cardOffer > 0
            );

    }


    if (payment === "upi") {

        products =
            products.filter(
                product =>
                    product.upiOffer > 0
            );

    }


    /*
     * Premium filter
     */

    const premium =
        $("premiumFilter")?.value ||
        "all";


    if (premium !== "all") {

        const maxPremium =
            Number(premium);


        products =
            products.filter(
                product => {

                    const p =
                        calculatePremiumPercent(
                            product
                        );

                    return p <= maxPremium;

                }
            );

    }


    /*
     * Sort
     */

    const sort =
        $("sortFilter")?.value ||
        "effective";


    products =
        [...products].sort(
            (a, b) => {

                if (sort === "listed") {

                    return (
                        a.listedPrice -
                        b.listedPrice
                    );

                }


                if (sort === "premium") {

                    return (
                        calculatePremiumPercent(a) -
                        calculatePremiumPercent(b)
                    );

                }


                if (sort === "offer") {

                    return (
                        totalOfferValue(b) -
                        totalOfferValue(a)
                    );

                }


                return (
                    effectivePrice(a) -
                    effectivePrice(b)
                );

            }
        );


    state.filteredProducts =
        products;


    renderComparison(
        products
    );

}


/* ========================================================
   PREMIUM
======================================================== */

function calculatePremiumPercent(
    product
) {

    const goldValue =
        calculateGoldValue(
            product.purity,
            product.weight
        );


    if (
        !goldValue ||
        !product.listedPrice
    ) {
        return 0;
    }


    return (
        (
            (
                product.listedPrice -
                goldValue
            ) /
            goldValue
        ) * 100
    );

}


/* ========================================================
   OFFERS
======================================================== */

function totalOfferValue(
    product
) {

    return (
        num(product.coupon) +
        num(product.cardOffer) +
        num(product.upiOffer) +
        num(product.cashback)
    );

}


function effectivePrice(
    product
) {

    return Math.max(
        0,
        product.listedPrice -
        totalOfferValue(product)
    );

}


/* ========================================================
   OFFER HTML
======================================================== */

function offerHTML(
    product
) {

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
                No visible offer
            </span>
        `;

    }


    return offers
        .map(
            offer =>
                `<span class="offer">
                    ${escapeHTML(offer)}
                </span>`
        )
        .join(" ");

}


/* ========================================================
   COMPARISON TABLE
======================================================== */

function renderComparison(
    products
) {

    const body =
        $("comparisonBody");

    if (!body) {
        return;
    }


    if (!products.length) {

        body.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="empty-state"
                >
                    No actual product data found
                    for
                    <strong>
                        ${escapeHTML(state.selectedPurity)}
                        /
                        ${escapeHTML(state.selectedWeight)}g
                    </strong>.
                    <br><br>
                    This means the connected sources
                    currently did not return a matching
                    product. No sample price is being
                    generated.
                </td>
            </tr>
        `;

        return;

    }


    body.innerHTML =
        products
            .map(
                renderComparisonRow
            )
            .join("");

}


function renderComparisonRow(
    product
) {

    const goldValue =
        calculateGoldValue(
            product.purity,
            product.weight
        );


    const premium =
        calculatePremiumPercent(
            product
        );


    const effective =
        effectivePrice(
            product
        );


    const url =
        product.productUrl;


    const status =
        product.status === "verified"
            ? "🟢 Verified"
            : product.status === "expired"
                ? "🔵 Expired"
                : "🟡 Available";


    const action =
        url
            ? `
                <a
                    href="${escapeHTML(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    View Product
                </a>
            `
            : `
                <span>
                    No URL
                </span>
            `;


    return `
        <tr>

            <td>

                <strong>
                    ${escapeHTML(product.seller)}
                </strong>

                <br>

                <small>
                    ${escapeHTML(product.productName)}
                </small>

                <br>

                <small>
                    ${status}
                </small>

            </td>


            <td>
                ${money(product.listedPrice)}
            </td>


            <td>
                ${
                    goldValue
                        ? money(goldValue)
                        : "—"
                }
            </td>


            <td>
                ${
                    goldValue
                        ? `${premium.toFixed(2)}%`
                        : "—"
                }
            </td>


            <td>
                ${offerHTML(product)}
            </td>


            <td>

                <strong>
                    ${money(effective)}
                </strong>

            </td>


            <td>
                ${action}
            </td>

        </tr>
    `;

}


/* ========================================================
   API ERROR
======================================================== */

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
                <strong>
                    Product API unavailable
                </strong>

                <br><br>

                ${escapeHTML(message)}

                <br><br>

                <button
                    type="button"
                    onclick="window.GoldMania.reloadProducts()"
                >
                    Retry
                </button>

            </td>
        </tr>
    `;

}


/* ========================================================
   OPTIONAL OFFERS API
======================================================== */

async function loadOffers() {

    try {

        const data =
            await api("/api/offers");

        state.offers =
            Array.isArray(data?.offers)
                ? data.offers
                : [];

        return data;

    } catch (error) {

        /*
         * /api/offers is optional.
         * Product offers are already read from
         * /api/products.
         */

        console.warn(
            "Offers endpoint unavailable:",
            error.message
        );

        state.offers = [];

    }

}


/* ========================================================
   OPTIONAL HISTORY API
======================================================== */

async function loadHistory() {

    try {

        const data =
            await api("/api/history");

        state.history =
            Array.isArray(data?.history)
                ? data.history
                : [];

        return data;

    } catch (error) {

        console.warn(
            "History endpoint unavailable:",
            error.message
        );

        state.history = [];

    }

}


/* ========================================================
   LOAD EVERYTHING
======================================================== */

async function loadAll() {

    /*
     * Gold and products are the important APIs.
     * Optional APIs should never stop the page.
     */

    await Promise.allSettled([
        loadGold(),
        loadProducts(),
        loadOffers(),
        loadHistory()
    ]);

}


/* ========================================================
   EVENT SETUP
======================================================== */

function setupEvents() {

    const purity =
        $("purity");

    const weight =
        $("weight");

    const seller =
        $("sellerFilter");

    const payment =
        $("paymentFilter");

    const premium =
        $("premiumFilter");

    const sort =
        $("sortFilter");


    if (purity) {

        purity.addEventListener(
            "change",
            () => {

                state.selectedPurity =
                    getSelectedPurity();

                /*
                 * Don't require button click.
                 * Update comparison immediately
                 * if results are already visible.
                 */

                const results =
                    $("results");

                if (
                    results &&
                    results.style.display !== "none"
                ) {

                    refreshComparison();

                }

            }
        );

    }


    if (weight) {

        weight.addEventListener(
            "change",
            () => {

                state.selectedWeight =
                    getSelectedWeight();

                const results =
                    $("results");

                if (
                    results &&
                    results.style.display !== "none"
                ) {

                    refreshComparison();

                }

            }
        );

    }


    /*
     * HTML already has onchange attributes,
     * but add listeners as a backup.
     */

    [seller, payment, premium, sort]
        .forEach(
            element => {

                if (!element) {
                    return;
                }

                element.addEventListener(
                    "change",
                    refreshComparison
                );

            }
        );

}


/* ========================================================
   PUBLIC API
======================================================== */

window.compareGold =
    compareGold;


window.refreshComparison =
    refreshComparison;


window.GoldMania = {

    reload:
        loadAll,

    reloadGold:
        loadGold,

    reloadProducts:
        loadProducts,

    reloadOffers:
        loadOffers,

    reloadHistory:
        loadHistory,

    compare:
        compareGold,

    refresh:
        refreshComparison,

    getState:
        () => state

};


/* ========================================================
   INIT
======================================================== */

function init() {

    setupEvents();

    /*
     * Initial values from HTML.
     */

    state.selectedPurity =
        getSelectedPurity();

    state.selectedWeight =
        getSelectedWeight();


    loadAll();

}


/* ========================================================
   DOM READY
======================================================== */

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

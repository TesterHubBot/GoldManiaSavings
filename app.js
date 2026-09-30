/* =========================================================
   GoldManiaSavings - app.js
   Matches the supplied index.html
   API: Cloudflare Worker
========================================================= */

"use strict";

const API_BASE =
    "https://goldmaniasavings-api.onlinetechmine.workers.dev";

const state = {
    gold: null,
    products: [],
    filteredProducts: [],
    selectedPurity: "24K",
    selectedWeight: 0.05
};


/* =========================================================
   API
========================================================= */

async function apiFetch(path) {

    const response = await fetch(
        API_BASE + path,
        {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            cache: "no-store"
        }
    );

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch (error) {
        throw new Error(
            "API returned invalid JSON. HTTP " +
            response.status
        );
    }

    if (!response.ok) {
        throw new Error(
            data?.message ||
            "API error " + response.status
        );
    }

    return data;
}


/* =========================================================
   HELPERS
========================================================= */

function num(value) {

    const n = Number(value);

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


function get(id) {

    return document.getElementById(id);
}


/* =========================================================
   GOLD RATE
========================================================= */

async function loadGoldRate() {

    const status =
        get("liveRateStatus");

    const updated =
        get("liveRateUpdated");

    if (status) {
        status.textContent = "🟡 Loading...";
    }

    try {

        const data =
            await apiFetch("/api/gold");

        state.gold = data;

        const rates =
            data?.indiaReference?.rates || {};

        const rate24 =
            num(rates?.["24K"]?.perGram);

        const rate22 =
            num(rates?.["22K"]?.perGram);

        const rate18 =
            num(rates?.["18K"]?.perGram);

        /*
         * IMPORTANT:
         * index.html uses input IDs rate24/rate22
         * and display IDs live24Rate/live22Rate/live18Rate
         */

        if (get("live24Rate")) {
            get("live24Rate").textContent =
                rate24 ? money(rate24) : "Unavailable";
        }

        if (get("live22Rate")) {
            get("live22Rate").textContent =
                rate22 ? money(rate22) : "Unavailable";
        }

        if (get("live18Rate")) {
            get("live18Rate").textContent =
                rate18 ? money(rate18) : "Unavailable";
        }

        if (get("rate24")) {
            get("rate24").value =
                rate24 || "";
        }

        if (get("rate22")) {
            get("rate22").value =
                rate22 || "";
        }

        if (status) {

            status.textContent =
                data?.live
                    ? "🟢 Live"
                    : "🟡 Cached";
        }

        if (updated) {

            const date =
                data?.updatedAt
                    ? new Date(
                        data.updatedAt
                    ).toLocaleString("en-IN")
                    : "";

            updated.textContent =
                date
                    ? "Updated: " + date
                    : "Gold rate available";
        }

        return data;

    } catch (error) {

        console.error(
            "Gold rate error:",
            error
        );

        if (get("live24Rate")) {
            get("live24Rate").textContent =
                "Unavailable";
        }

        if (get("live22Rate")) {
            get("live22Rate").textContent =
                "Unavailable";
        }

        if (get("live18Rate")) {
            get("live18Rate").textContent =
                "Unavailable";
        }

        if (status) {
            status.textContent =
                "🔴 Error";
        }

        if (updated) {
            updated.textContent =
                error.message;
        }
    }
}


/* =========================================================
   PRODUCTS
========================================================= */

async function loadProducts() {

    try {

        const data =
            await apiFetch("/api/products");

        state.products =
            Array.isArray(data?.products)
                ? data.products
                : [];

        console.log(
            "GoldMania API products:",
            state.products
        );

        return state.products;

    } catch (error) {

        console.error(
            "Products API error:",
            error
        );

        state.products = [];

        return [];
    }
}


/* =========================================================
   NORMALISE WEIGHT
========================================================= */

function getProductWeight(product) {

    const direct =
        num(product?.weight);

    if (direct > 0) {
        return direct;
    }

    /*
     * Some products may have weight encoded
     * inside productName.
     */

    const name =
        text(product?.productName);

    const match =
        name.match(
            /(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\b/i
        );

    if (match) {
        return num(match[1]);
    }

    /*
     * ounce handling
     */

    if (
        /1\s*ounce|1\s*oz/i.test(name)
    ) {
        return 31.1035;
    }

    return 0;
}


/* =========================================================
   FILTER PRODUCTS
========================================================= */

function getMatchingProducts(
    purity,
    weight
) {

    const wantedWeight =
        num(weight);

    return state.products.filter(
        product => {

            const productPurity =
                text(product?.purity)
                    .trim()
                    .toUpperCase();

            const productWeight =
                getProductWeight(product);

            /*
             * Exact purity
             */

            if (
                productPurity !==
                purity.toUpperCase()
            ) {
                return false;
            }

            /*
             * Small tolerance for decimal
             * weight comparison.
             */

            if (
                Math.abs(
                    productWeight -
                    wantedWeight
                ) > 0.001
            ) {
                return false;
            }

            return true;
        }
    );
}


/* =========================================================
   GOLD VALUE
========================================================= */

function getReferenceRate(
    purity
) {

    const rates =
        state.gold?.indiaReference?.rates || {};

    return num(
        rates?.[purity]?.perGram
    );
}


function calculateGoldValue(
    purity,
    weight
) {

    const rate =
        getReferenceRate(purity);

    return rate * num(weight);
}


/* =========================================================
   PRODUCT OFFERS
========================================================= */

function getOfferText(product) {

    const offers = [];

    if (num(product?.coupon) > 0) {

        offers.push(
            "Coupon " +
            money(product.coupon)
        );
    }

    if (num(product?.cardOffer) > 0) {

        offers.push(
            "Card " +
            money(product.cardOffer)
        );
    }

    if (num(product?.upiOffer) > 0) {

        offers.push(
            "UPI " +
            money(product.upiOffer)
        );
    }

    if (num(product?.cashback) > 0) {

        offers.push(
            "Cashback " +
            money(product.cashback)
        );
    }

    if (product?.voucher) {

        offers.push(
            "Voucher: " +
            text(product.voucher)
        );
    }

    if (product?.promoCode) {

        offers.push(
            "Promo: " +
            text(product.promoCode)
        );
    }

    if (product?.offerText) {

        offers.push(
            text(product.offerText)
        );
    }

    return offers;
}


/* =========================================================
   EFFECTIVE PRICE
========================================================= */

function getOfferValue(product) {

    return (
        num(product?.coupon) +
        num(product?.cardOffer) +
        num(product?.upiOffer) +
        num(product?.cashback)
    );
}


function getEffectivePrice(product) {

    const price =
        num(product?.listedPrice);

    return Math.max(
        0,
        price -
        getOfferValue(product)
    );
}


function getPremiumPercent(
    product,
    goldValue
) {

    const price =
        num(product?.listedPrice);

    if (
        !goldValue ||
        !price
    ) {
        return 0;
    }

    return (
        (
            (price - goldValue) /
            goldValue
        ) * 100
    );
}


/* =========================================================
   COMPARE
========================================================= */

async function compareGold() {

    const purityElement =
        get("purity");

    const weightElement =
        get("weight");

    const purity =
        purityElement?.value ||
        "24K";

    const weight =
        num(
            weightElement?.value
        );

    state.selectedPurity =
        purity;

    state.selectedWeight =
        weight;

    /*
     * Make sure product data exists.
     */

    if (
        !state.products.length
    ) {
        await loadProducts();
    }

    /*
     * Summary
     */

    const goldValue =
        calculateGoldValue(
            purity,
            weight
        );

    const pureGold =
        purity === "24K"
            ? weight
            : weight * (
                purity === "22K"
                    ? 22 / 24
                    : 18 / 24
            );

    if (get("results")) {
        get("results").style.display =
            "block";
    }

    if (get("comparisonTitle")) {

        get("comparisonTitle").textContent =
            `${weight}g ${purity} Gold Coin Comparison`;
    }

    if (get("summaryPurity")) {
        get("summaryPurity").textContent =
            purity;
    }

    if (get("summaryWeight")) {
        get("summaryWeight").textContent =
            weight + " g";
    }

    if (get("summaryPureGold")) {
        get("summaryPureGold").textContent =
            pureGold.toFixed(4) + " g";
    }

    if (get("summaryGoldValue")) {
        get("summaryGoldValue").textContent =
            goldValue
                ? money(goldValue)
                : "Unavailable";
    }

    refreshComparison();
}


/* =========================================================
   REFRESH COMPARISON
========================================================= */

function refreshComparison() {

    const purity =
        state.selectedPurity;

    const weight =
        state.selectedWeight;

    let products =
        getMatchingProducts(
            purity,
            weight
        );

    const sellerFilter =
        get("sellerFilter")?.value ||
        "all";

    const paymentFilter =
        get("paymentFilter")?.value ||
        "all";

    const premiumFilter =
        get("premiumFilter")?.value ||
        "all";

    const sortFilter =
        get("sortFilter")?.value ||
        "effective";


    /* Seller */

    if (
        sellerFilter !== "all"
    ) {

        products =
            products.filter(
                product =>
                    text(
                        product?.seller
                    ).toLowerCase() ===
                    sellerFilter.toLowerCase()
            );
    }


    /* Payment */

    if (
        paymentFilter === "card"
    ) {

        products =
            products.filter(
                product =>
                    num(
                        product?.cardOffer
                    ) > 0
            );
    }

    if (
        paymentFilter === "upi"
    ) {

        products =
            products.filter(
                product =>
                    num(
                        product?.upiOffer
                    ) > 0
            );
    }


    /* Premium */

    const maxPremium =
        num(premiumFilter);

    if (
        premiumFilter !== "all" &&
        maxPremium > 0
    ) {

        const goldValue =
            calculateGoldValue(
                purity,
                weight
            );

        products =
            products.filter(
                product =>
                    getPremiumPercent(
                        product,
                        goldValue
                    ) <= maxPremium
            );
    }


    /* Sort */

    const goldValue =
        calculateGoldValue(
            purity,
            weight
        );

    products.sort(
        (a, b) => {

            if (
                sortFilter ===
                "listed"
            ) {

                return (
                    num(a.listedPrice) -
                    num(b.listedPrice)
                );
            }

            if (
                sortFilter ===
                "premium"
            ) {

                return (
                    getPremiumPercent(
                        a,
                        goldValue
                    ) -
                    getPremiumPercent(
                        b,
                        goldValue
                    )
                );
            }

            if (
                sortFilter ===
                "offer"
            ) {

                return (
                    getOfferValue(b) -
                    getOfferValue(a)
                );
            }

            return (
                getEffectivePrice(a) -
                getEffectivePrice(b)
            );
        }
    );


    state.filteredProducts =
        products;

    renderComparison(
        products,
        goldValue
    );
}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderComparison(
    products,
    goldValue
) {

    const body =
        get("comparisonBody");

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
                    No API product matches
                    <strong>
                        ${escapeHTML(
                            state.selectedWeight +
                            "g " +
                            state.selectedPurity
                        )}
                    </strong>.
                    <br><br>
                    The current API response does
                    not contain this weight/purity.
                </td>
            </tr>
        `;

        return;
    }


    body.innerHTML =
        products.map(
            product => {

                const seller =
                    text(
                        product?.seller ||
                        product?.source ||
                        "Unknown"
                    );

                const name =
                    text(
                        product?.productName ||
                        "Gold Coin"
                    );

                const listed =
                    num(
                        product?.listedPrice
                    );

                const premium =
                    getPremiumPercent(
                        product,
                        goldValue
                    );

                const effective =
                    getEffectivePrice(
                        product
                    );

                const offers =
                    getOfferText(
                        product
                    );

                const url =
                    text(
                        product?.productUrl
                    );

                const status =
                    text(
                        product?.status ||
                        ""
                    ).toLowerCase();

                let statusIcon =
                    "🟡";

                if (
                    status === "verified"
                ) {
                    statusIcon = "🟢";
                }

                if (
                    status === "expired"
                ) {
                    statusIcon = "🔵";
                }


                const offerHTML =
                    offers.length
                        ? offers
                            .map(
                                offer =>
                                    `<div>${escapeHTML(
                                        offer
                                    )}</div>`
                            )
                            .join("")
                        : `<span>—</span>`;


                const actionHTML =
                    url
                        ? `
                            <a
                                href="${escapeHTML(url)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View
                            </a>
                          `
                        : "—";


                return `
                    <tr>

                        <td>

                            <strong>
                                ${statusIcon}
                                ${escapeHTML(
                                    seller
                                )}
                            </strong>

                            <br>

                            <small>
                                ${escapeHTML(
                                    name
                                )}
                            </small>

                        </td>

                        <td>
                            ${money(listed)}
                        </td>

                        <td>
                            ${goldValue
                                ? money(goldValue)
                                : "—"}
                        </td>

                        <td>
                            ${premium
                                ? premium.toFixed(2) + "%"
                                : "—"}
                        </td>

                        <td>
                            ${offerHTML}
                        </td>

                        <td>
                            <strong>
                                ${money(effective)}
                            </strong>
                        </td>

                        <td>
                            ${actionHTML}
                        </td>

                    </tr>
                `;
            }
        ).join("");
}


/* =========================================================
   FILTER OPTIONS
========================================================= */

function populateSellerFilter() {

    const select =
        get("sellerFilter");

    if (!select) {
        return;
    }

    const sellers =
        [
            ...new Set(
                state.products
                    .map(
                        product =>
                            text(
                                product?.seller
                            ).trim()
                    )
                    .filter(Boolean)
            )
        ].sort();

    /*
     * Keep All Sellers
     */

    select.innerHTML = `
        <option value="all">
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
   INITIALISE
========================================================= */

async function init() {

    console.log(
        "GoldManiaSavings starting..."
    );

    await Promise.all([
        loadGoldRate(),
        loadProducts()
    ]);

    populateSellerFilter();

    console.log(
        "API product count:",
        state.products.length
    );

    /*
     * Do NOT automatically show fake
     * products for 0.05g / 0.1g / 0.5g.
     *
     * Only actual API products are displayed.
     */

}


/* =========================================================
   PUBLIC FUNCTIONS
========================================================= */

window.compareGold =
    compareGold;

window.refreshComparison =
    refreshComparison;

window.GoldMania = {

    reload: init,

    reloadGold: loadGoldRate,

    reloadProducts: loadProducts,

    getState: function () {
        return state;
    }
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
        init
    );

} else {

    init();

}

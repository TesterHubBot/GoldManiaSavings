/* =========================================================
   GoldManiaSavings
   Complete Frontend Application
   Seller-agnostic product comparison
========================================================= */

/* =========================================================
   CONFIGURATION
========================================================= */

const LIVE_API_URL =
    "https://goldmaniasavings-api.onlinetechmine.workers.dev";


/* =========================================================
   GLOBAL DATA
========================================================= */

let productDatabase = [];

let currentProducts = [];

let currentGoldRates = {
    "24K": 0,
    "22K": 0,
    "18K": 0
};


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "GoldManiaSavings starting..."
        );

        setupWeightOptions();

        setupFilterListeners();

        await loadGoldRates();

        await loadProducts();

        setupSellerFilter();

        updateCalculatorRates();

    }
);


/* =========================================================
   WEIGHT OPTIONS
========================================================= */

function setupWeightOptions() {

    const weightSelect =
        document.getElementById("weight");

    if (!weightSelect) {
        return;
    }

    if (weightSelect.options.length === 0) {

        const weights = [
            0.05,
            0.1,
            0.25,
            0.5,
            1,
            2,
            5,
            10,
            20,
            50,
            100
        ];

        weights.forEach(
            weight => {

                const option =
                    document.createElement("option");

                option.value =
                    String(weight);

                option.textContent =
                    `${weight} g`;

                weightSelect.appendChild(
                    option
                );

            }
        );

    }

}


/* =========================================================
   FILTER LISTENERS
========================================================= */

function setupFilterListeners() {

    const ids = [
        "sellerFilter",
        "paymentFilter",
        "premiumFilter",
        "sortFilter"
    ];

    ids.forEach(
        id => {

            const element =
                document.getElementById(id);

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


/* =========================================================
   GOLD RATES
========================================================= */

async function loadGoldRates() {

    setLiveStatus("🟡 Loading...");

    try {

        const response =
            await fetch(
                `${LIVE_API_URL}/api/gold`,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                `Gold API HTTP ${response.status}`
            );

        }

        const data =
            await response.json();

        if (
            !data.ok
        ) {

            throw new Error(
                "Gold API returned ok=false"
            );

        }


        /*
         * New API format:
         *
         * indiaReference.rates
         *
         * Fallback:
         * rates
         */

        const rates =
            data.indiaReference?.rates ||
            data.rates ||
            data.internationalSpot?.rates ||
            {};


        currentGoldRates["24K"] =
            Number(
                rates["24K"]?.perGram ||
                rates["24K"] ||
                0
            );


        currentGoldRates["22K"] =
            Number(
                rates["22K"]?.perGram ||
                rates["22K"] ||
                0
            );


        currentGoldRates["18K"] =
            Number(
                rates["18K"]?.perGram ||
                rates["18K"] ||
                0
            );


        if (
            !currentGoldRates["24K"] &&
            !currentGoldRates["22K"] &&
            !currentGoldRates["18K"]
        ) {

            throw new Error(
                "No gold rates found"
            );

        }


        updateGoldRateUI();

        updateCalculatorRates();

        setLiveStatus("🟢 LIVE");


        updateLastUpdated(
            data.timestamp
        );


        console.log(
            "Live India gold rates:",
            currentGoldRates
        );


    } catch (error) {

        console.error(
            "Gold rate error:",
            error
        );

        setLiveStatus(
            "🔴 Offline"
        );

        updateLastUpdated(
            null
        );

    }

}


/* =========================================================
   GOLD RATE UI
========================================================= */

function updateGoldRateUI() {

    const rate24 =
        document.getElementById(
            "live24Rate"
        );

    const rate22 =
        document.getElementById(
            "live22Rate"
        );

    const rate18 =
        document.getElementById(
            "live18Rate"
        );


    if (rate24) {

        rate24.textContent =
            formatCurrency(
                currentGoldRates["24K"]
            );

    }


    if (rate22) {

        rate22.textContent =
            formatCurrency(
                currentGoldRates["22K"]
            );

    }


    if (rate18) {

        rate18.textContent =
            formatCurrency(
                currentGoldRates["18K"]
            );

    }

}


/* =========================================================
   CALCULATOR
========================================================= */

function updateCalculatorRates() {

    const rate24 =
        document.getElementById("rate24");

    const rate22 =
        document.getElementById("rate22");


    if (rate24) {

        rate24.value =
            currentGoldRates["24K"] || "";

    }


    if (rate22) {

        rate22.value =
            currentGoldRates["22K"] || "";

    }

}


/* =========================================================
   LIVE STATUS
========================================================= */

function setLiveStatus(text) {

    const element =
        document.getElementById(
            "liveRateStatus"
        );

    if (element) {

        element.textContent =
            text;

    }

}


/* =========================================================
   LAST UPDATED
========================================================= */

function updateLastUpdated(timestamp) {

    const element =
        document.getElementById(
            "liveRateUpdated"
        );

    if (!element) {
        return;
    }


    if (!timestamp) {

        element.textContent =
            "Live rate unavailable";

        return;

    }


    const date =
        new Date(timestamp);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        element.textContent =
            "Live rate available";

        return;

    }


    element.textContent =
        `Last updated: ${date.toLocaleString(
            "en-IN"
        )}`;

}


/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

    productDatabase = [];


    /*
     * LIVE WORKER API
     */

    try {

        const response =
            await fetch(
                `${LIVE_API_URL}/api/products`,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `Products API HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        if (
            data &&
            Array.isArray(
                data.products
            )
        ) {

            productDatabase =
                data.products
                    .map(
                        normalizeFrontendProduct
                    )
                    .filter(Boolean);


            console.log(
                "API products loaded:",
                productDatabase.length,
                {
                    live: data.live,
                    cacheUsed: data.cacheUsed
                }
            );


            /*
             * IMPORTANT:
             *
             * Even if API returns zero products,
             * don't silently pretend it is offline.
             */

            if (
                productDatabase.length > 0
            ) {

                setupSellerFilter();

                return;

            }

        }


    } catch (error) {

        console.warn(
            "Live products API failed:",
            error
        );

    }


    /*
     * FALLBACK products.json
     */

    try {

        const response =
            await fetch(
                "./products.json",
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "products.json not found"
            );

        }


        const data =
            await response.json();


        let products = [];


        if (
            Array.isArray(data)
        ) {

            products =
                data;

        } else if (
            Array.isArray(
                data.products
            )
        ) {

            products =
                data.products;

        }


        productDatabase =
            products
                .map(
                    normalizeFrontendProduct
                )
                .filter(Boolean);


        console.log(
            "Fallback products loaded:",
            productDatabase.length
        );


    } catch (error) {

        console.error(
            "Product loading failed:",
            error
        );

        productDatabase = [];

    }


    setupSellerFilter();

}


/* =========================================================
   NORMALIZE FRONTEND PRODUCT
========================================================= */

function normalizeFrontendProduct(product) {

    if (
        !product ||
        typeof product !== "object"
    ) {

        return null;

    }


    const sellerId =
        String(
            product.sellerId ||
            product.seller ||
            product.source ||
            "unknown"
        )
        .trim();


    const sellerName =
        String(
            product.seller ||
            product.sellerName ||
            product.source ||
            sellerId ||
            "Seller"
        )
        .trim();


    const productName =
        String(
            product.productName ||
            product.name ||
            "Gold Product"
        )
        .trim();


    const purity =
        normalizePurity(
            product.purity ||
            "24K"
        );


    const weight =
        Number(
            product.weight ??
            product.weightGrams ??
            0
        );


    const listedPrice =
        Number(
            product.listedPrice ??
            product.price ??
            0
        );


    const mrp =
        Number(
            product.mrp ??
            0
        );


    const shipping =
        Number(
            product.shipping ??
            0
        );


    const coupon =
        Number(
            product.coupon ??
            0
        );


    const cardOffer =
        Number(
            product.cardOffer ??
            0
        );


    const upiOffer =
        Number(
            product.upiOffer ??
            0
        );


    const cashback =
        Number(
            product.cashback ??
            0
        );


    /*
     * New offer fields
     */

    const voucher =
        product.voucher ??
        product.vouchers ??
        product.voucherCode ??
        "";


    const promoCode =
        product.promoCode ??
        product.promo ??
        product.promoCodes ??
        "";


    const offerText =
        product.offerText ??
        product.offers ??
        product.offer ??
        "";


    /*
     * productUrl sometimes arrives
     * as an object instead of string.
     */

    const productUrl =
        normalizeURL(
            product.productUrl ||
            product.url ||
            product.link ||
            ""
        );


    return {

        ...product,

        id:
            String(
                product.id ||
                cryptoSafeId()
            ),

        sellerId,

        seller:
            sellerName,

        productName,

        purity,

        weight,

        listedPrice,

        mrp,

        shipping,

        coupon,

        cardOffer,

        upiOffer,

        cashback,

        voucher:
            normalizeOfferText(
                voucher
            ),

        promoCode:
            normalizeOfferText(
                promoCode
            ),

        offerText:
            normalizeOfferText(
                offerText
            ),

        productUrl,

        status:
            product.status ||
            "sample",

        sourceType:
            product.sourceType ||
            "unknown",

        source:
            product.source ||
            sellerName,

        lastUpdated:
            product.lastUpdated ||
            null

    };

}


/* =========================================================
   SAFE ID
========================================================= */

function cryptoSafeId() {

    try {

        if (
            typeof crypto !== "undefined" &&
            crypto.randomUUID
        ) {

            return crypto.randomUUID();

        }

    } catch (error) {

        /* ignore */

    }


    return (
        "product-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2)
    );

}


/* =========================================================
   NORMALIZE URL
========================================================= */

function normalizeURL(value) {

    if (!value) {
        return "";
    }


    /*
     * If API accidentally sends
     * an object:
     *
     * { url: "..." }
     *
     * or
     *
     * { href: "..." }
     */

    if (
        typeof value === "object"
    ) {

        value =
            value.url ||
            value.href ||
            value.link ||
            value.productUrl ||
            "";

    }


    if (
        typeof value !== "string"
    ) {

        return "";

    }


    value =
        value.trim();


    if (!value) {
        return "";
    }


    /*
     * Only allow web URLs.
     */

    if (
        /^https?:\/\//i.test(
            value
        )
    ) {

        return value;

    }


    /*
     * If API returned
     * www.example.com
     */

    if (
        /^www\./i.test(
            value
        )
    ) {

        return (
            "https://" +
            value
        );

    }


    return "";

}


/* =========================================================
   SELLER FILTER
========================================================= */

function setupSellerFilter() {

    const select =
        document.getElementById(
            "sellerFilter"
        );


    if (!select) {
        return;
    }


    const sellers =
        new Map();


    productDatabase.forEach(
        product => {

            const id =
                String(
                    product.sellerId ||
                    product.seller ||
                    "unknown"
                );


            const name =
                product.seller ||
                product.sellerName ||
                product.source ||
                id;


            sellers.set(
                id,
                name
            );

        }
    );


    const oldValue =
        select.value;


    select.innerHTML = "";


    const allOption =
        document.createElement(
            "option"
        );


    allOption.value =
        "all";


    allOption.textContent =
        "All Sellers";


    select.appendChild(
        allOption
    );


    sellers.forEach(
        (name, id) => {

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
        oldValue &&
        [...select.options]
            .some(
                option =>
                    option.value ===
                    oldValue
            )
    ) {

        select.value =
            oldValue;

    }

}


/* =========================================================
   COMPARE GOLD
========================================================= */

function compareGold() {

    const purityElement =
        document.getElementById(
            "purity"
        );


    const weightElement =
        document.getElementById(
            "weight"
        );


    if (
        !purityElement ||
        !weightElement
    ) {

        return;

    }


    const purity =
        normalizePurity(
            purityElement.value
        );


    const weight =
        Number(
            weightElement.value
        );


    if (
        !purity ||
        !weight
    ) {

        alert(
            "Please select purity and weight."
        );

        return;

    }


    updateSummary(
        purity,
        weight
    );


    currentProducts =
        buildComparisonProducts(
            purity,
            weight
        );


    refreshComparison();


    const results =
        document.getElementById(
            "results"
        );


    if (results) {

        results.style.display =
            "block";


        results.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }

}


/* =========================================================
   BUILD COMPARISON PRODUCTS
========================================================= */

function buildComparisonProducts(
    purity,
    weight
) {

    const matching =
        productDatabase.filter(
            product => {

                const productPurity =
                    normalizePurity(
                        product.purity
                    );


                const productWeight =
                    Number(
                        product.weight ||
                        product.weightGrams ||
                        0
                    );


                return (

                    productPurity ===
                    purity

                    &&

                    Math.abs(
                        productWeight -
                        weight
                    ) < 0.0001

                );

            }
        );


    return matching.map(
        product =>
            calculateProduct(
                product,
                purity,
                weight
            )
    );

}


/* =========================================================
   CALCULATE PRODUCT
========================================================= */

function calculateProduct(
    product,
    purity,
    weight
) {

    const goldRate =
        Number(
            currentGoldRates[purity] ||
            0
        );


    const goldValue =
        goldRate *
        weight;


    const listedPrice =
        Number(
            product.listedPrice ||
            product.price ||
            0
        );


    const shipping =
        Number(
            product.shipping ||
            0
        );


    const coupon =
        Number(
            product.coupon ||
            0
        );


    const cardOffer =
        Number(
            product.cardOffer ||
            0
        );


    const upiOffer =
        Number(
            product.upiOffer ||
            0
        );


    const cashback =
        Number(
            product.cashback ||
            0
        );


    const grossPrice =
        listedPrice +
        shipping;


    /*
     * Card / UPI are alternative
     * payment methods.
     *
     * Don't subtract both.
     */

    const paymentDiscount =
        Math.max(
            cardOffer,
            upiOffer
        );


    const effectivePrice =
        Math.max(
            0,
            grossPrice -
            coupon -
            paymentDiscount -
            cashback
        );


    let premium = 0;


    if (
        goldValue > 0
    ) {

        premium =
            (
                (
                    listedPrice -
                    goldValue
                ) /
                goldValue
            ) *
            100;

    }


    return {

        ...product,

        purity,

        weight,

        goldValue,

        listedPrice,

        shipping,

        coupon,

        cardOffer,

        upiOffer,

        cashback,

        premium,

        effectivePrice

    };

}


/* =========================================================
   REFRESH COMPARISON
========================================================= */

function refreshComparison() {

    if (
        !currentProducts.length
    ) {

        renderEmptyComparison();

        return;

    }


    const sellerFilter =
        document.getElementById(
            "sellerFilter"
        )?.value ||
        "all";


    const paymentFilter =
        document.getElementById(
            "paymentFilter"
        )?.value ||
        "all";


    const premiumFilter =
        document.getElementById(
            "premiumFilter"
        )?.value ||
        "all";


    const sortFilter =
        document.getElementById(
            "sortFilter"
        )?.value ||
        "effective";


    let filtered =
        [...currentProducts];


    /*
     * SELLER
     */

    if (
        sellerFilter !== "all"
    ) {

        filtered =
            filtered.filter(
                product => {

                    return (

                        String(
                            product.sellerId
                        ) ===
                        String(
                            sellerFilter
                        )

                        ||

                        String(
                            product.seller
                        ) ===
                        String(
                            sellerFilter
                        )

                    );

                }
            );

    }


    /*
     * PAYMENT
     */

    if (
        paymentFilter === "card"
    ) {

        filtered =
            filtered.filter(
                product =>
                    Number(
                        product.cardOffer
                    ) > 0
            );

    }


    if (
        paymentFilter === "upi"
    ) {

        filtered =
            filtered.filter(
                product =>
                    Number(
                        product.upiOffer
                    ) > 0
            );

    }


    /*
     * PREMIUM
     */

    if (
        premiumFilter !== "all"
    ) {

        const maxPremium =
            Number(
                premiumFilter
            );


        if (
            !Number.isNaN(
                maxPremium
            )
        ) {

            filtered =
                filtered.filter(
                    product =>
                        Number(
                            product.premium
                        ) <=
                        maxPremium
                );

        }

    }


    /*
     * SORT
     */

    if (
        sortFilter === "effective"
    ) {

        filtered.sort(
            (a, b) =>
                a.effectivePrice -
                b.effectivePrice
        );

    }


    if (
        sortFilter === "listed"
    ) {

        filtered.sort(
            (a, b) =>
                a.listedPrice -
                b.listedPrice
        );

    }


    if (
        sortFilter === "premium"
    ) {

        filtered.sort(
            (a, b) =>
                a.premium -
                b.premium
        );

    }


    if (
        sortFilter === "offer"
    ) {

        filtered.sort(
            (a, b) =>
                totalOffers(b) -
                totalOffers(a)
        );

    }


    renderComparison(
        filtered
    );

}


/* =========================================================
   TOTAL OFFERS
========================================================= */

function totalOffers(
    product
) {

    return (

        Number(
            product.coupon || 0
        ) +

        Math.max(
            Number(
                product.cardOffer || 0
            ),
            Number(
                product.upiOffer || 0
            )
        ) +

        Number(
            product.cashback || 0
        )

    );

}


/* =========================================================
   RENDER COMPARISON
========================================================= */

function renderComparison(
    products
) {

    const body =
        document.getElementById(
            "comparisonBody"
        );


    if (!body) {
        return;
    }


    if (
        products.length === 0
    ) {

        renderEmptyComparison();

        return;

    }


    body.innerHTML = "";


    products.forEach(
        product => {

            const row =
                document.createElement(
                    "tr"
                );


            const status =
                getStatus(
                    product
                );


            const sellerName =
                escapeHTML(
                    product.seller ||
                    product.sellerName ||
                    product.source ||
                    "Seller"
                );


            const productName =
                escapeHTML(
                    product.productName ||
                    product.name ||
                    "Gold Product"
                );


            const listedPrice =
                formatCurrency(
                    product.listedPrice
                );


            const goldValue =
                formatCurrency(
                    product.goldValue
                );


            const effectivePrice =
                formatCurrency(
                    product.effectivePrice
                );


            const premium =
                Number(
                    product.premium || 0
                ).toFixed(2);


            const offers =
                buildOfferHTML(
                    product
                );


            let action = "";


            if (
                product.productUrl
            ) {

                action = `

                    <a
                        class="deal-btn"
                        href="${escapeAttribute(
                            product.productUrl
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View
                    </a>

                `;

            } else {

                action = `

                    <button
                        class="deal-btn"
                        type="button"
                        onclick="showNoLinkMessage()"
                    >
                        Details
                    </button>

                `;

            }


            row.innerHTML = `

                <td>

                    <div class="seller">
                        ${sellerName}
                    </div>

                    <div class="brand">
                        ${productName}
                    </div>

                    <div>
                        ${status}
                    </div>

                </td>


                <td>
                    ${listedPrice}
                </td>


                <td>
                    ${goldValue}
                </td>


                <td>

                    <span class="premium">
                        ${premium}%
                    </span>

                </td>


                <td>
                    ${offers}
                </td>


                <td>

                    <span class="effective">
                        ${effectivePrice}
                    </span>

                </td>


                <td>
                    ${action}
                </td>

            `;


            body.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   OFFER HTML
========================================================= */

function buildOfferHTML(
    product
) {

    const offers = [];


    /*
     * COUPON
     */

    if (
        Number(
            product.coupon
        ) > 0
    ) {

        offers.push(

            `<span class="badge badge-green">
                Coupon ₹${formatNumber(
                    product.coupon
                )}
            </span>`

        );

    }


    /*
     * CARD
     */

    if (
        Number(
            product.cardOffer
        ) > 0
    ) {

        offers.push(

            `<span class="badge badge-blue">
                Card ₹${formatNumber(
                    product.cardOffer
                )}
            </span>`

        );

    }


    /*
     * UPI
     */

    if (
        Number(
            product.upiOffer
        ) > 0
    ) {

        offers.push(

            `<span class="badge badge-orange">
                UPI ₹${formatNumber(
                    product.upiOffer
                )}
            </span>`

        );

    }


    /*
     * CASHBACK
     */

    if (
        Number(
            product.cashback
        ) > 0
    ) {

        offers.push(

            `<span class="badge badge-green">
                Cashback ₹${formatNumber(
                    product.cashback
                )}
            </span>`

        );

    }


    /*
     * VOUCHER
     */

    if (
        product.voucher
    ) {

        offers.push(

            `<span class="badge badge-blue">
                Voucher ${escapeHTML(
                    product.voucher
                )}
            </span>`

        );

    }


    /*
     * PROMO CODE
     */

    if (
        product.promoCode
    ) {

        offers.push(

            `<span class="badge badge-orange">
                Promo ${escapeHTML(
                    product.promoCode
                )}
            </span>`

        );

    }


    /*
     * OFFER TEXT
     */

    if (
        product.offerText
    ) {

        offers.push(

            `<span class="badge badge-green">
                ${escapeHTML(
                    product.offerText
                )}
            </span>`

        );

    }


    if (
        offers.length === 0
    ) {

        return `
            <span
                style="color:#999;font-size:12px;"
            >
                No offer
            </span>
        `;

    }


    return offers.join(" ");

}


/* =========================================================
   STATUS
========================================================= */

function getStatus(
    product
) {

    const status =
        String(
            product.status ||
            "sample"
        )
        .toLowerCase();


    if (
        status === "verified"
    ) {

        return `
            <span class="badge badge-green">
                ✓ Verified
            </span>
        `;

    }


    if (
        status === "expired"
    ) {

        return `
            <span class="badge badge-blue">
                Expired
            </span>
        `;

    }


    if (
        status === "unavailable"
    ) {

        return `
            <span class="badge badge-orange">
                Unavailable
            </span>
        `;

    }


    return `
        <span class="badge badge-orange">
            Sample
        </span>
    `;

}


/* =========================================================
   SUMMARY
========================================================= */

function updateSummary(
    purity,
    weight
) {

    const goldRate =
        Number(
            currentGoldRates[purity] ||
            0
        );


    const goldValue =
        goldRate *
        weight;


    const purityElement =
        document.getElementById(
            "summaryPurity"
        );


    const weightElement =
        document.getElementById(
            "summaryWeight"
        );


    const pureGoldElement =
        document.getElementById(
            "summaryPureGold"
        );


    const goldValueElement =
        document.getElementById(
            "summaryGoldValue"
        );


    if (purityElement) {

        purityElement.textContent =
            purity;

    }


    if (weightElement) {

        weightElement.textContent =
            `${weight} g`;

    }


    if (pureGoldElement) {

        const pureGold =
            calculatePureGoldWeight(
                purity,
                weight
            );


        pureGoldElement.textContent =
            `${pureGold.toFixed(4)} g`;

    }


    if (goldValueElement) {

        goldValueElement.textContent =
            formatCurrency(
                goldValue
            );

    }


    const title =
        document.getElementById(
            "comparisonTitle"
        );


    if (title) {

        title.textContent =
            `${purity} Gold Coin Comparison — ${weight}g`;

    }

}


/* =========================================================
   PURE GOLD WEIGHT
========================================================= */

function calculatePureGoldWeight(
    purity,
    weight
) {

    const factors = {

        "24K": 0.9999,

        "22K": 0.916,

        "18K": 0.750

    };


    return (
        weight *
        (
            factors[purity] ||
            0
        )
    );

}


/* =========================================================
   EMPTY RESULT
========================================================= */

function renderEmptyComparison() {

    const body =
        document.getElementById(
            "comparisonBody"
        );


    if (!body) {
        return;
    }


    body.innerHTML = `

        <tr>

            <td
                colspan="7"
                class="empty-state"
            >

                No matching products
                are currently available.

                <br><br>

                Try another weight,
                purity or seller.

            </td>

        </tr>

    `;

}


/* =========================================================
   NO LINK MESSAGE
========================================================= */

function showNoLinkMessage() {

    alert(
        "Seller product link is not available yet."
    );

}


/* =========================================================
   NORMALIZE PURITY
========================================================= */

function normalizePurity(
    purity
) {

    if (!purity) {
        return "";
    }


    const value =
        String(
            purity
        )
        .toUpperCase()
        .replace(
            /\s/g,
            ""
        );


    if (
        value.includes("24")
    ) {

        return "24K";

    }


    if (
        value.includes("22")
    ) {

        return "22K";

    }


    if (
        value.includes("18")
    ) {

        return "18K";

    }


    return value;

}


/* =========================================================
   OFFER TEXT NORMALIZER
========================================================= */

function normalizeOfferText(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    if (
        typeof value === "object"
    ) {

        try {

            return JSON.stringify(
                value
            );

        } catch (error) {

            return "";

        }

    }


    return String(
        value
    ).trim();

}


/* =========================================================
   CURRENCY
========================================================= */

function formatCurrency(
    value
) {

    const number =
        Number(
            value || 0
        );


    if (
        !number ||
        Number.isNaN(number)
    ) {

        return "₹0";

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


/* =========================================================
   NUMBER
========================================================= */

function formatNumber(
    value
) {

    const number =
        Number(
            value || 0
        );


    return new Intl.NumberFormat(
        "en-IN",
        {

            maximumFractionDigits: 2

        }
    ).format(
        number
    );

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


/* =========================================================
   ATTRIBUTE ESCAPING
========================================================= */

function escapeAttribute(
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
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    );

}


/* =========================================================
   AUTO REFRESH GOLD
========================================================= */

setInterval(
    async function () {

        await loadGoldRates();


        const results =
            document.getElementById(
                "results"
            );


        if (
            results &&
            results.style.display !==
            "none"
        ) {

            const purity =
                normalizePurity(
                    document.getElementById(
                        "purity"
                    )?.value
                );


            const weight =
                Number(
                    document.getElementById(
                        "weight"
                    )?.value
                );


            if (
                purity &&
                weight
            ) {

                currentProducts =
                    buildComparisonProducts(
                        purity,
                        weight
                    );


                refreshComparison();

            }

        }

    },

    5 * 60 * 1000

);


/* =========================================================
   AUTO REFRESH PRODUCTS
   Every 15 minutes
========================================================= */

setInterval(
    async function () {

        await loadProducts();

        setupSellerFilter();


        const purity =
            normalizePurity(
                document.getElementById(
                    "purity"
                )?.value
            );


        const weight =
            Number(
                document.getElementById(
                    "weight"
                )?.value
            );


        if (
            purity &&
            weight
        ) {

            currentProducts =
                buildComparisonProducts(
                    purity,
                    weight
                );


            refreshComparison();

        }

    },

    15 * 60 * 1000

);


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.compareGold =
    compareGold;

window.refreshComparison =
    refreshComparison;

window.loadGoldRates =
    loadGoldRates;

window.loadProducts =
    loadProducts;

window.showNoLinkMessage =
    showNoLinkMessage;

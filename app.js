/* =========================================================
   GoldManiaSavings
   Complete Frontend Application
   Multi-Seller + Live Gold Rate + Cached Products
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const LIVE_API_URL =
    "https://goldmaniasavings-api.onlinetechmine.workers.dev";


const API_TIMEOUT =
    15000;


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


let goldRateSource = "";

let goldRateTimestamp = null;


/* =========================================================
   PAGE INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "GoldManiaSavings starting..."
        );


        setupWeightOptions();


        await loadGoldRates();


        await loadProducts();


        setupSellerFilter();


        updateCalculatorRates();


        console.log(
            "GoldManiaSavings ready."
        );

    }
);


/* =========================================================
   SAFE FETCH
========================================================= */

async function fetchWithTimeout(
    url,
    options = {},
    timeout = API_TIMEOUT
) {

    const controller =
        new AbortController();


    const timer =
        setTimeout(
            function () {

                controller.abort();

            },
            timeout
        );


    try {

        return await fetch(
            url,
            {

                ...options,

                signal:
                    controller.signal

            }
        );

    } finally {

        clearTimeout(timer);

    }

}


/* =========================================================
   WEIGHT OPTIONS
========================================================= */

function setupWeightOptions() {

    const weightSelect =
        document.getElementById(
            "weight"
        );


    if (!weightSelect) {

        return;

    }


    if (
        weightSelect.options.length === 0
    ) {

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
            function (weight) {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    weight;


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
   GOLD RATE
========================================================= */

async function loadGoldRates() {

    setLiveStatus(
        "🟡 Loading..."
    );


    try {

        const response =
            await fetchWithTimeout(
                `${LIVE_API_URL}/api/gold`,
                {
                    method: "GET",

                    cache: "no-store",

                    headers: {
                        "Accept":
                            "application/json"
                    }
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
            !data ||
            !data.ok
        ) {

            throw new Error(
                "Invalid gold API response"
            );

        }


        /*
         * New backend response:
         *
         * indiaReference.rates
         *
         * Older backend response:
         *
         * rates
         */

        let rates =
            null;


        if (
            data.indiaReference &&
            data.indiaReference.rates
        ) {

            rates =
                data.indiaReference.rates;

            goldRateSource =
                data.indiaReference.source ||
                "India Reference";

        }


        else if (
            data.rates
        ) {

            rates =
                data.rates;

            goldRateSource =
                data.source ||
                "Gold API";

        }


        else if (
            data.internationalSpot &&
            data.internationalSpot.rates
        ) {

            rates =
                data.internationalSpot.rates;

            goldRateSource =
                data.internationalSpot.source ||
                "International Spot";

        }


        if (!rates) {

            throw new Error(
                "Gold rates not found"
            );

        }


        currentGoldRates["24K"] =
            Number(
                rates["24K"]?.perGram ??
                rates["24K"] ??
                0
            );


        currentGoldRates["22K"] =
            Number(
                rates["22K"]?.perGram ??
                rates["22K"] ??
                0
            );


        currentGoldRates["18K"] =
            Number(
                rates["18K"]?.perGram ??
                rates["18K"] ??
                0
            );


        if (
            currentGoldRates["24K"] <= 0 &&
            currentGoldRates["22K"] <= 0 &&
            currentGoldRates["18K"] <= 0
        ) {

            throw new Error(
                "Gold rates are zero"
            );

        }


        goldRateTimestamp =
            data.timestamp ||
            new Date().toISOString();


        updateGoldRateUI();


        updateCalculatorRates();


        /*
         * IMPORTANT:
         *
         * Your backend is live.
         * Therefore don't show Offline
         * when the API returns valid rates.
         */

        setLiveStatus(
            "🟢 LIVE"
        );


        updateLastUpdated(
            goldRateTimestamp
        );


        console.log(
            "Live gold rates:",
            currentGoldRates
        );


    } catch (error) {

        console.error(
            "Gold rate error:",
            error
        );


        /*
         * Do not erase existing rates.
         */

        if (
            currentGoldRates["24K"] > 0
        ) {

            setLiveStatus(
                "🟡 LAST RATE"
            );

            updateLastUpdated(
                goldRateTimestamp
            );

        } else {

            setLiveStatus(
                "🔴 Offline"
            );

            updateLastUpdated(
                null
            );

        }

    }

}


/* =========================================================
   UPDATE GOLD RATE UI
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
   CALCULATOR RATE INPUTS
========================================================= */

function updateCalculatorRates() {

    const rate24 =
        document.getElementById(
            "rate24"
        );


    const rate22 =
        document.getElementById(
            "rate22"
        );


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
   STATUS
========================================================= */

function setLiveStatus(
    text
) {

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

function updateLastUpdated(
    timestamp
) {

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
            "Updated recently";

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

    setProductStatus(
        "🟡 Loading sellers..."
    );


    let apiLoaded =
        false;


    /*
     * FIRST:
     * Cloudflare Worker
     */

    try {

        const response =
            await fetchWithTimeout(
                `${LIVE_API_URL}/api/products`,
                {

                    method: "GET",

                    cache: "no-store",

                    headers: {
                        "Accept":
                            "application/json"
                    }

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
            data.ok &&
            Array.isArray(
                data.products
            )
        ) {

            productDatabase =
                normalizeProductDatabase(
                    data.products
                );


            apiLoaded =
                true;


            console.log(
                "Products API:",
                {
                    count:
                        productDatabase.length,

                    live:
                        data.live,

                    cacheUsed:
                        data.cacheUsed
                }
            );


            if (
                data.cacheUsed
            ) {

                setProductStatus(
                    "🟡 Cached seller data"
                );

            } else if (
                data.live
            ) {

                setProductStatus(
                    "🟢 LIVE seller data"
                );

            } else {

                setProductStatus(
                    "🟢 Seller data loaded"
                );

            }


            /*
             * If products are available,
             * don't unnecessarily fall back.
             */

            if (
                productDatabase.length > 0
            ) {

                return;

            }

        }

    } catch (error) {

        console.warn(
            "Products API unavailable:",
            error
        );

    }


    /*
     * SECOND:
     * Local products.json fallback
     */

    try {

        const response =
            await fetchWithTimeout(
                "./products.json",
                {

                    method: "GET",

                    cache: "no-store",

                    headers: {
                        "Accept":
                            "application/json"
                    }

                }
            );


        if (!response.ok) {

            throw new Error(
                "products.json not found"
            );

        }


        const data =
            await response.json();


        let products =
            [];


        if (
            Array.isArray(data)
        ) {

            products =
                data;

        }

        else if (
            data &&
            Array.isArray(
                data.products
            )
        ) {

            products =
                data.products;

        }


        productDatabase =
            normalizeProductDatabase(
                products
            );


        if (
            productDatabase.length > 0
        ) {

            setProductStatus(
                "🟡 Local product data"
            );

        }

        else if (!apiLoaded) {

            setProductStatus(
                "⚪ No seller products"
            );

        }


        console.log(
            "Fallback products:",
            productDatabase.length
        );


    } catch (error) {

        console.warn(
            "products.json unavailable:",
            error
        );


        if (
            productDatabase.length === 0
        ) {

            productDatabase =
                [];

            setProductStatus(
                "⚪ No seller products"
            );

        }

    }

}


/* =========================================================
   NORMALIZE PRODUCT DATABASE
========================================================= */

function normalizeProductDatabase(
    products
) {

    if (
        !Array.isArray(products)
    ) {

        return [];

    }


    return products
        .map(
            normalizeProduct
        )
        .filter(
            product =>
                product !== null
        );

}


/* =========================================================
   NORMALIZE SINGLE PRODUCT
========================================================= */

function normalizeProduct(
    product
) {

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
            "unknown"
        );


    const seller =
        cleanText(
            product.seller ||
            product.sellerName ||
            sellerId
        );


    const productName =
        cleanText(
            product.productName ||
            product.name ||
            "Gold Product"
        );


    const purity =
        normalizePurity(
            product.purity ||
            product.karat ||
            "24K"
        );


    const weight =
        Number(
            product.weight ??
            product.weightGrams ??
            product.grams ??
            0
        );


    const listedPrice =
        numberValue(
            product.listedPrice ??
            product.price ??
            product.salePrice
        );


    const mrp =
        numberValue(
            product.mrp ??
            product.mrpPrice
        );


    const shipping =
        numberValue(
            product.shipping ??
            product.deliveryCharge
        );


    const coupon =
        numberValue(
            product.coupon ??
            product.couponDiscount
        );


    const cardOffer =
        numberValue(
            product.cardOffer ??
            product.cardDiscount
        );


    const upiOffer =
        numberValue(
            product.upiOffer ??
            product.upiDiscount
        );


    const cashback =
        numberValue(
            product.cashback ??
            product.cashbackAmount
        );


    const voucher =
        cleanText(
            product.voucher ||
            product.voucherCode ||
            ""
        );


    const promoCode =
        cleanText(
            product.promoCode ||
            product.promo ||
            product.promo_code ||
            ""
        );


    const offerText =
        cleanText(
            product.offerText ||
            product.offers ||
            product.offer ||
            ""
        );


    /*
     * FIX:
     *
     * productUrl was previously {}
     * in the API response.
     *
     * Only allow valid strings.
     */

    const productUrl =
        normalizeProductUrl(
            product.productUrl ||
            product.url ||
            product.link
        );


    return {

        ...product,

        id:
            String(
                product.id ||
                `${sellerId}-${productName}-${weight}`
            ),

        sellerId,

        seller,

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

        voucher,

        promoCode,

        offerText,

        productUrl,

        status:
            product.status ||
            "sample",

        sourceType:
            product.sourceType ||
            "unknown",

        source:
            product.source ||
            seller,

        lastUpdated:
            product.lastUpdated ||
            null

    };

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
        function (product) {

            const id =
                product.sellerId ||
                product.seller ||
                "unknown";


            const name =
                product.seller ||
                product.sellerName ||
                id;


            sellers.set(
                id,
                name
            );

        }
    );


    select.innerHTML = `

        <option value="all">
            All Sellers
        </option>

    `;


    sellers.forEach(
        function (name, id) {

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

}


/* =========================================================
   PRODUCT STATUS
========================================================= */

function setProductStatus(
    text
) {

    /*
     * Supports an optional element:
     *
     * sellerStatus
     *
     * If your HTML doesn't have it,
     * nothing happens.
     */

    const element =
        document.getElementById(
            "sellerStatus"
        );


    if (element) {

        element.textContent =
            text;

    }

}


/* =========================================================
   MAIN COMPARISON
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

            behavior:
                "smooth",

            block:
                "start"

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
            function (product) {

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
        function (product) {

            return calculateProduct(
                product,
                purity,
                weight
            );

        }
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
        numberValue(
            product.listedPrice ||
            product.price
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


    const grossPrice =
        listedPrice +
        shipping;


    /*
     * Card / UPI are alternatives.
     * Do not subtract both simultaneously.
     */

    const maxPaymentDiscount =
        Math.max(
            cardOffer,
            upiOffer
        );


    const effectivePrice =
        Math.max(
            0,

            grossPrice -
            coupon -
            maxPaymentDiscount -
            cashback

        );


    let premium =
        0;


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
     * Seller
     */

    if (
        sellerFilter !== "all"
    ) {

        filtered =
            filtered.filter(
                function (product) {

                    return (

                        product.sellerId ===
                        sellerFilter

                        ||

                        product.seller ===
                        sellerFilter

                    );

                }
            );

    }


    /*
     * Payment
     */

    if (
        paymentFilter === "card"
    ) {

        filtered =
            filtered.filter(
                function (product) {

                    return (
                        Number(
                            product.cardOffer
                        ) > 0
                    );

                }
            );

    }


    if (
        paymentFilter === "upi"
    ) {

        filtered =
            filtered.filter(
                function (product) {

                    return (
                        Number(
                            product.upiOffer
                        ) > 0
                    );

                }
            );

    }


    /*
     * Premium
     */

    if (
        premiumFilter !== "all"
    ) {

        const maxPremium =
            Number(
                premiumFilter
            );


        filtered =
            filtered.filter(
                function (product) {

                    return (
                        Number(
                            product.premium
                        ) <=
                        maxPremium
                    );

                }
            );

    }


    /*
     * Sorting
     */

    if (
        sortFilter ===
        "effective"
    ) {

        filtered.sort(
            function (a, b) {

                return (
                    a.effectivePrice -
                    b.effectivePrice
                );

            }
        );

    }


    if (
        sortFilter ===
        "listed"
    ) {

        filtered.sort(
            function (a, b) {

                return (
                    a.listedPrice -
                    b.listedPrice
                );

            }
        );

    }


    if (
        sortFilter ===
        "premium"
    ) {

        filtered.sort(
            function (a, b) {

                return (
                    a.premium -
                    b.premium
                );

            }
        );

    }


    if (
        sortFilter ===
        "offer"
    ) {

        filtered.sort(
            function (a, b) {

                return (
                    totalOffers(b) -
                    totalOffers(a)
                );

            }
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

        numberValue(
            product.coupon
        )

        +

        Math.max(

            numberValue(
                product.cardOffer
            ),

            numberValue(
                product.upiOffer
            )

        )

        +

        numberValue(
            product.cashback
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
        function (product) {

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
                    "Seller"
                );


            const productName =
                escapeHTML(
                    product.productName ||
                    product.name ||
                    "Gold Coin"
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


            const action =
                buildProductAction(
                    product
                );


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
   PRODUCT ACTION
========================================================= */

function buildProductAction(
    product
) {

    const url =
        normalizeProductUrl(
            product.productUrl
        );


    if (
        url
    ) {

        return `

            <a
                class="deal-btn"
                href="${escapeAttribute(
                    url
                )}"
                target="_blank"
                rel="noopener noreferrer"
            >
                View
            </a>

        `;

    }


    return `

        <button
            class="deal-btn"
            type="button"
            onclick="showNoLinkMessage()"
        >
            Details
        </button>

    `;

}


/* =========================================================
   OFFER HTML
========================================================= */

function buildOfferHTML(
    product
) {

    const offers = [];


    if (
        numberValue(
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


    if (
        numberValue(
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


    if (
        numberValue(
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


    if (
        numberValue(
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
     * Voucher
     */

    if (
        cleanText(
            product.voucher
        )
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
     * Promo code
     */

    if (
        cleanText(
            product.promoCode
        )
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
     * Generic offer text
     */

    if (
        cleanText(
            product.offerText
        )
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
        ).toLowerCase();


    if (
        status ===
        "verified"
    ) {

        return `

            <span class="badge badge-green">
                ✓ Verified
            </span>

        `;

    }


    if (
        status ===
        "expired"
    ) {

        return `

            <span class="badge badge-blue">
                Expired
            </span>

        `;

    }


    if (
        status ===
        "cached"
    ) {

        return `

            <span class="badge badge-orange">
                Cached
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
            `${pureGold.toFixed(
                4
            )} g`;

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
   NUMBER VALUE
========================================================= */

function numberValue(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;

    }


    /*
     * Handle strings such as:
     *
     * ₹16,102
     * 16102
     */

    if (
        typeof value ===
        "string"
    ) {

        const cleaned =
            value
                .replace(
                    /₹/g,
                    ""
                )
                .replace(
                    /,/g,
                    ""
                )
                .trim();


        const parsed =
            Number(
                cleaned
            );


        return Number.isFinite(
            parsed
        )
            ? parsed
            : 0;

    }


    const parsed =
        Number(
            value
        );


    return Number.isFinite(
        parsed
    )
        ? parsed
        : 0;

}


/* =========================================================
   CLEAN TEXT
========================================================= */

function cleanText(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    if (
        typeof value ===
        "object"
    ) {

        return "";

    }


    return String(
        value
    ).trim();

}


/* =========================================================
   PRODUCT URL NORMALIZER
========================================================= */

function normalizeProductUrl(
    value
) {

    /*
     * FIX FOR:
     *
     * productUrl: {}
     *
     */

    if (
        !value
    ) {

        return "";

    }


    if (
        typeof value ===
        "string"
    ) {

        const url =
            value.trim();


        if (
            !url
        ) {

            return "";

        }


        if (
            /^https?:\/\//i.test(
                url
            )
        ) {

            return url;

        }


        return "";

    }


    /*
     * Sometimes API may return:
     *
     * { href: "https://..." }
     *
     * { url: "https://..." }
     */

    if (
        typeof value ===
        "object"
    ) {

        const possible =
            value.href ||
            value.url ||
            value.link;


        if (
            typeof possible ===
            "string"
        ) {

            return normalizeProductUrl(
                possible
            );

        }

    }


    return "";

}


/* =========================================================
   CURRENCY
========================================================= */

function formatCurrency(
    value
) {

    const number =
        numberValue(
            value
        );


    if (
        number === 0
    ) {

        return "₹0";

    }


    return new Intl.NumberFormat(
        "en-IN",
        {

            style:
                "currency",

            currency:
                "INR",

            maximumFractionDigits:
                2

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
        numberValue(
            value
        );


    return new Intl.NumberFormat(
        "en-IN",
        {

            maximumFractionDigits:
                2

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
   AUTO REFRESH GOLD RATE
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
========================================================= */

/*
 * Refresh seller data every 10 minutes.
 */

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

    10 * 60 * 1000

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

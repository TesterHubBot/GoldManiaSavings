/* =========================================================
   GoldManiaSavings
   Complete Frontend Application
   LIVE GOLD + HISTORY
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

let goldHistory = [];


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

        await loadGoldHistory();

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
            weight => {

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
            await fetch(
                `${LIVE_API_URL}/api/gold`,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                `Gold API failed: ${response.status}`
            );

        }

        const data =
            await response.json();

        if (
            !data.ok ||
            !data.indiaReference ||
            !data.indiaReference.rates
        ) {

            throw new Error(
                "Invalid India gold API response"
            );

        }


        /* =================================================
           IMPORTANT:
           Use INDIA REFERENCE, not international spot.
        ================================================= */

        currentGoldRates["24K"] =
            Number(
                data
                    .indiaReference
                    .rates["24K"]
                    ?.perGram || 0
            );

        currentGoldRates["22K"] =
            Number(
                data
                    .indiaReference
                    .rates["22K"]
                    ?.perGram || 0
            );

        currentGoldRates["18K"] =
            Number(
                data
                    .indiaReference
                    .rates["18K"]
                    ?.perGram || 0
            );


        updateGoldRateUI();

        updateCalculatorRates();


        setLiveStatus(
            "🟢 LIVE"
        );


        updateLastUpdated(
            data.timestamp
        );


        console.log(
            "India live gold rates:",
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


    element.textContent =
        `Last updated: ${date.toLocaleString(
            "en-IN"
        )}`;

}


/* =========================================================
   GOLD HISTORY
========================================================= */

async function loadGoldHistory() {

    try {

        const response =
            await fetch(
                `${LIVE_API_URL}/api/history`,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `History API failed: ${response.status}`
            );

        }


        const data =
            await response.json();


        if (
            !data.ok ||
            !Array.isArray(
                data.history
            )
        ) {

            throw new Error(
                "Invalid history response"
            );

        }


        goldHistory =
            data.history;


        console.log(
            "Gold history loaded:",
            goldHistory.length
        );


        renderGoldHistory(
            goldHistory
        );


    } catch (error) {

        console.error(
            "Gold history error:",
            error
        );


        goldHistory =
            [];


        renderGoldHistory(
            []
        );

    }

}


/* =========================================================
   RENDER GOLD HISTORY
========================================================= */

function renderGoldHistory(
    history
) {

    /*
     * Supports multiple possible
     * history container IDs.
     */

    const container =
        document.getElementById(
            "goldHistory"
        ) ||
        document.getElementById(
            "history"
        ) ||
        document.getElementById(
            "goldHistoryTable"
        );


    if (!container) {

        console.log(
            "Gold history container not found."
        );

        return;

    }


    if (
        !history ||
        history.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-state">

                Gold history is not available yet.

            </div>

        `;

        return;

    }


    /*
     * Latest first.
     */

    const sortedHistory =
        [...history].sort(
            (a, b) => {

                return (
                    new Date(
                        b.timestamp ||
                        b.date ||
                        0
                    ) -
                    new Date(
                        a.timestamp ||
                        a.date ||
                        0
                    )
                );

            }
        );


    let rows = "";


    sortedHistory.forEach(
        item => {

            const rates =
                item.rates || {};


            const dateValue =
                item.date ||
                item.timestamp;


            const date =
                dateValue
                    ? new Date(
                        dateValue
                    ).toLocaleDateString(
                        "en-IN"
                    )
                    : "-";


            const time =
                item.timestamp
                    ? new Date(
                        item.timestamp
                    ).toLocaleTimeString(
                        "en-IN",
                        {
                            hour:
                                "2-digit",

                            minute:
                                "2-digit"
                        }
                    )
                    : "-";


            rows += `

                <tr>

                    <td>
                        ${escapeHTML(
                            date
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            time
                        )}
                    </td>

                    <td>
                        ${formatCurrency(
                            rates["24K"] || 0
                        )}
                    </td>

                    <td>
                        ${formatCurrency(
                            rates["22K"] || 0
                        )}
                    </td>

                    <td>
                        ${formatCurrency(
                            rates["18K"] || 0
                        )}
                    </td>

                </tr>

            `;

        }
    );


    container.innerHTML = `

        <div
            class="gold-history-wrapper"
            style="
                width:100%;
                overflow-x:auto;
            "
        >

            <table
                class="gold-history-table"
                style="
                    width:100%;
                    border-collapse:collapse;
                "
            >

                <thead>

                    <tr>

                        <th
                            style="
                                text-align:left;
                                padding:10px;
                            "
                        >
                            Date
                        </th>

                        <th
                            style="
                                text-align:left;
                                padding:10px;
                            "
                        >
                            Time
                        </th>

                        <th
                            style="
                                text-align:right;
                                padding:10px;
                            "
                        >
                            24K / g
                        </th>

                        <th
                            style="
                                text-align:right;
                                padding:10px;
                            "
                        >
                            22K / g
                        </th>

                        <th
                            style="
                                text-align:right;
                                padding:10px;
                            "
                        >
                            18K / g
                        </th>

                    </tr>

                </thead>

                <tbody>

                    ${rows}

                </tbody>

            </table>

        </div>

    `;

}


/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

    try {

        const response =
            await fetch(
                `${LIVE_API_URL}/api/products`,
                {
                    cache: "no-store"
                }
            );


        if (response.ok) {

            const data =
                await response.json();


            if (
                data.ok &&
                Array.isArray(
                    data.products
                ) &&
                data.products.length > 0
            ) {

                productDatabase =
                    data.products;


                console.log(
                    "Live seller products loaded:",
                    productDatabase.length
                );


                return;

            }

        }

    } catch (error) {

        console.warn(
            "Live seller API unavailable:",
            error
        );

    }


    /*
     * Local fallback.
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


        if (
            Array.isArray(data)
        ) {

            productDatabase =
                data;

        } else if (
            Array.isArray(
                data.products
            )
        ) {

            productDatabase =
                data.products;

        } else {

            productDatabase =
                [];

        }


        console.log(
            "Fallback products loaded:",
            productDatabase.length
        );


    } catch (error) {

        console.error(
            "Product loading failed:",
            error
        );


        productDatabase =
            [];

    }

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
        purityElement.value;


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
        product => {

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


    if (
        sellerFilter !== "all"
    ) {

        filtered =
            filtered.filter(
                product => {

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


    if (
        premiumFilter !== "all"
    ) {

        const maxPremium =
            Number(
                premiumFilter
            );


        filtered =
            filtered.filter(
                product =>
                    Number(
                        product.premium
                    ) <=
                    maxPremium
            );

    }


    if (
        sortFilter === "effective"
    ) {

        filtered.sort(
            (
                a,
                b
            ) =>
                a.effectivePrice -
                b.effectivePrice
        );

    }


    if (
        sortFilter === "listed"
    ) {

        filtered.sort(
            (
                a,
                b
            ) =>
                a.listedPrice -
                b.listedPrice
        );

    }


    if (
        sortFilter === "premium"
    ) {

        filtered.sort(
            (
                a,
                b
            ) =>
                a.premium -
                b.premium
        );

    }


    if (
        sortFilter === "offer"
    ) {

        filtered.sort(
            (
                a,
                b
            ) =>
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
            product.coupon
        ) +

        Math.max(
            Number(
                product.cardOffer
            ),

            Number(
                product.upiOffer
            )
        ) +

        Number(
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
                product.productUrl
                    ? `

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

                    `
                    : `

                        <button
                            class="deal-btn"
                            type="button"
                            onclick="showNoLinkMessage()"
                        >
                            Details
                        </button>

                    `;


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
   CURRENCY
========================================================= */

function formatCurrency(
    value
) {

    const number =
        Number(
            value || 0
        );


    if (!number) {

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
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


/* =========================================================
   AUTO REFRESH
========================================================= */

/*
 * Refresh live gold rate every 5 minutes.
 */

setInterval(
    async function () {

        await loadGoldRates();

        await loadGoldHistory();


        /*
         * Recalculate comparison
         * using latest India rate.
         */

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
                document.getElementById(
                    "purity"
                )?.value;


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
   GLOBAL FUNCTIONS
========================================================= */

window.compareGold =
    compareGold;

window.refreshComparison =
    refreshComparison;

window.loadGoldRates =
    loadGoldRates;

window.loadGoldHistory =
    loadGoldHistory;

window.loadProducts =
    loadProducts;

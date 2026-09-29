/* =========================================================
   GoldManiaSavings
   Live Gold Rate + Product Comparison
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

let currentSelection = null;


/* =========================================================
   MONEY FORMAT
   ========================================================= */

function money(value) {

    return "₹" + Number(value || 0).toLocaleString(
        "en-IN",
        {
            maximumFractionDigits: 0
        }
    );

}


/* =========================================================
   STATUS BADGE
   ========================================================= */

function getStatusBadge(status) {

    const labels = {

        verified: "✓ Verified",

        sample: "⚪ Sample",

        expired: "⚠ Expired"

    };


    const colors = {

        verified: "badge-green",

        sample: "badge-orange",

        expired: "badge-blue"

    };


    return `
        <span class="badge ${colors[status] || "badge-orange"}">
            ${labels[status] || status || "Unknown"}
        </span>
    `;

}


/* =========================================================
   LOAD PRODUCTS
   ========================================================= */

async function loadProducts() {

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
                "Unable to load products.json"
            );

        }


        const data =
            await response.json();


        productDatabase =
            Array.isArray(data.products)
                ? data.products
                : [];


        console.log(
            "Products loaded:",
            productDatabase.length
        );


    } catch (error) {

        console.error(
            "Product loading error:",
            error
        );


        productDatabase = [];

    }

}


/* =========================================================
   LIVE GOLD RATE
   ========================================================= */

async function loadLiveGoldRates() {

    const status =
        document.getElementById(
            "liveRateStatus"
        );


    try {

        if (status) {

            status.textContent =
                "🟡 Updating live rate...";

        }


        const response =
            await fetch(
                `${LIVE_API_URL}/api/gold`,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Live API request failed"
            );

        }


        const data =
            await response.json();


        if (
            !data.ok ||
            !data.live ||
            !data.rates
        ) {

            throw new Error(
                "Live gold rate unavailable"
            );

        }


        /* =========================
           GET LIVE RATES
        ========================= */

        const rate24 =
            Number(
                data.rates["24K"].perGram
            );


        const rate22 =
            Number(
                data.rates["22K"].perGram
            );


        const rate18 =
            Number(
                data.rates["18K"].perGram
            );


        /* =========================
           UPDATE CALCULATOR INPUTS
        ========================= */

        const rate24Input =
            document.getElementById(
                "rate24"
            );


        const rate22Input =
            document.getElementById(
                "rate22"
            );


        if (rate24Input) {

            rate24Input.value =
                rate24;

        }


        if (rate22Input) {

            rate22Input.value =
                rate22;

        }


        /* =========================
           UPDATE LIVE DISPLAY
        ========================= */

        const rate24Display =
            document.getElementById(
                "live24Rate"
            );


        const rate22Display =
            document.getElementById(
                "live22Rate"
            );


        const rate18Display =
            document.getElementById(
                "live18Rate"
            );


        if (rate24Display) {

            rate24Display.textContent =
                money(rate24) + " / g";

        }


        if (rate22Display) {

            rate22Display.textContent =
                money(rate22) + " / g";

        }


        if (rate18Display) {

            rate18Display.textContent =
                money(rate18) + " / g";

        }


        /* =========================
           UPDATE TIME
        ========================= */

        const updatedAt =
            document.getElementById(
                "liveRateUpdated"
            );


        if (updatedAt) {

            const time =
                new Date(
                    data.timestamp
                );


            updatedAt.textContent =
                "Updated " +
                time.toLocaleTimeString(
                    "en-IN",
                    {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                    }
                );

        }


        if (status) {

            status.textContent =
                "🟢 LIVE";

        }


        /* =========================
           STORE LIVE RATES
        ========================= */

        window.liveGoldRates = {

            "24K": rate24,

            "22K": rate22,

            "18K": rate18

        };


        console.log(
            "Live gold rates:",
            window.liveGoldRates
        );


        /*
         * If a comparison is already visible,
         * refresh it using the new live rate.
         */

        if (currentSelection) {

            renderProducts();

        }


    } catch (error) {

        console.error(
            "Live gold rate error:",
            error
        );


        if (status) {

            status.textContent =
                "🔴 LIVE RATE UNAVAILABLE";

        }

    }

}


/* =========================================================
   GET CURRENT GOLD RATE
   ========================================================= */

function getCurrentGoldRate(purity) {

    if (
        window.liveGoldRates &&
        window.liveGoldRates[purity]
    ) {

        return Number(
            window.liveGoldRates[purity]
        );

    }


    /*
     * Fallback to calculator input
     * if live API is temporarily unavailable.
     */

    if (purity === "24K") {

        return Number(
            document.getElementById(
                "rate24"
            )?.value || 0
        );

    }


    if (purity === "22K") {

        return Number(
            document.getElementById(
                "rate22"
            )?.value || 0
        );

    }


    return 0;

}


/* =========================================================
   GET USER SELECTION
   ========================================================= */

function getSelection() {

    const purityElement =
        document.getElementById(
            "purity"
        );


    const weightElement =
        document.getElementById(
            "weight"
        );


    const purity =
        purityElement
            ? purityElement.value
            : "24K";


    const weight =
        parseFloat(
            weightElement
                ? weightElement.value
                : 1
        );


    const factor =
        purity === "24K"
            ? 0.9999
            : 0.916;


    const rate =
        getCurrentGoldRate(
            purity
        );


    const pureGold =
        weight * factor;


    const goldValue =
        pureGold * rate;


    return {

        purity,

        weight,

        factor,

        rate,

        pureGold,

        goldValue

    };

}


/* =========================================================
   PRODUCT CALCULATION
   ========================================================= */

function calculateProduct(product) {

    const goldValue =
        currentSelection.goldValue;


    const listedPrice =
        Number(
            product.listedPrice || 0
        );


    const coupon =
        Number(
            product.coupon || 0
        );


    const cardOffer =
        Number(
            product.cardOffer || 0
        );


    const upiOffer =
        Number(
            product.upiOffer || 0
        );


    const shipping =
        Number(
            product.shipping || 0
        );


    const payment =
        document.getElementById(
            "paymentFilter"
        )?.value || "all";


    let paymentDiscount = 0;


    if (payment === "card") {

        paymentDiscount =
            cardOffer;

    }

    else if (payment === "upi") {

        paymentDiscount =
            upiOffer;

    }

    else {

        paymentDiscount =
            Math.max(
                cardOffer,
                upiOffer
            );

    }


    const payable =
        Math.max(
            0,

            listedPrice +
            shipping -
            coupon -
            paymentDiscount
        );


    const cashback =
        Number(
            product.cashback || 0
        );


    const effective =
        Math.max(
            0,

            payable -
            cashback
        );


    const premium =
        goldValue > 0

            ? (
                (
                    listedPrice -
                    goldValue
                ) /
                goldValue
            ) * 100

            : 0;


    const effectivePremium =
        goldValue > 0

            ? (
                (
                    effective -
                    goldValue
                ) /
                goldValue
            ) * 100

            : 0;


    return {

        ...product,

        goldValue,

        payable,

        effective,

        premium,

        effectivePremium,

        paymentDiscount

    };

}


/* =========================================================
   SELLER FILTER
   ========================================================= */

function populateSellerFilter() {

    const select =
        document.getElementById(
            "sellerFilter"
        );


    if (!select) {

        return;

    }


    const sellers =
        [
            ...new Set(
                productDatabase.map(
                    product =>
                        product.seller
                )
            )
        ];


    select.innerHTML =
        `
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
   FILTER PRODUCTS
   ========================================================= */

function getFilteredProducts() {

    if (!currentSelection) {

        return [];

    }


    const purity =
        currentSelection.purity;


    const weight =
        currentSelection.weight;


    const seller =
        document.getElementById(
            "sellerFilter"
        )?.value || "all";


    const payment =
        document.getElementById(
            "paymentFilter"
        )?.value || "all";


    const premium =
        document.getElementById(
            "premiumFilter"
        )?.value || "all";


    let products =
        productDatabase.filter(
            product => {

                if (
                    product.purity !==
                    purity
                ) {

                    return false;

                }


                if (
                    Number(product.weight) !==
                    Number(weight)
                ) {

                    return false;

                }


                if (
                    seller !== "all" &&
                    product.seller !== seller
                ) {

                    return false;

                }


                if (
                    payment !== "all" &&
                    !product.paymentMethods?.includes(
                        payment
                    )
                ) {

                    return false;

                }


                return true;

            }
        );


    products =
        products.map(
            calculateProduct
        );


    if (premium !== "all") {

        const max =
            Number(premium);


        products =
            products.filter(
                product =>
                    product.effectivePremium <=
                    max
            );

    }


    const sort =
        document.getElementById(
            "sortFilter"
        )?.value || "effective";


    if (sort === "effective") {

        products.sort(
            (a, b) =>
                a.effective -
                b.effective
        );

    }


    else if (sort === "listed") {

        products.sort(
            (a, b) =>
                a.listedPrice -
                b.listedPrice
        );

    }


    else if (sort === "premium") {

        products.sort(
            (a, b) =>
                a.effectivePremium -
                b.effectivePremium
        );

    }


    else if (sort === "offer") {

        products.sort(
            (a, b) => {

                const offerA =
                    Number(a.coupon || 0) +
                    Number(a.cardOffer || 0) +
                    Number(a.upiOffer || 0) +
                    Number(a.cashback || 0);


                const offerB =
                    Number(b.coupon || 0) +
                    Number(b.cardOffer || 0) +
                    Number(b.upiOffer || 0) +
                    Number(b.cashback || 0);


                return offerB - offerA;

            }
        );

    }


    return products;

}


/* =========================================================
   COMPARE GOLD
   ========================================================= */

async function compareGold() {

    /*
     * Make sure products are available.
     */

    if (!productDatabase.length) {

        await loadProducts();

    }


    /*
     * Make sure live rates are available.
     */

    if (!window.liveGoldRates) {

        await loadLiveGoldRates();

    }


    currentSelection =
        getSelection();


    /* =========================
       SUMMARY
    ========================= */

    const summaryPurity =
        document.getElementById(
            "summaryPurity"
        );


    const summaryWeight =
        document.getElementById(
            "summaryWeight"
        );


    const summaryPureGold =
        document.getElementById(
            "summaryPureGold"
        );


    const summaryGoldValue =
        document.getElementById(
            "summaryGoldValue"
        );


    if (summaryPurity) {

        summaryPurity.textContent =
            currentSelection.purity;

    }


    if (summaryWeight) {

        summaryWeight.textContent =
            currentSelection.weight +
            "g";

    }


    if (summaryPureGold) {

        summaryPureGold.textContent =
            currentSelection.pureGold.toFixed(
                4
            ) + "g";

    }


    if (summaryGoldValue) {

        summaryGoldValue.textContent =
            money(
                currentSelection.goldValue
            );

    }


    const title =
        document.getElementById(
            "comparisonTitle"
        );


    if (title) {

        title.textContent =
            `${currentSelection.purity} • ${currentSelection.weight}g Gold Coin`;

    }


    populateSellerFilter();

    renderProducts();


    const results =
        document.getElementById(
            "results"
        );


    if (results) {

        results.style.display =
            "block";


        results.scrollIntoView({
            behavior: "smooth"
        });

    }

}


/* =========================================================
   RENDER PRODUCTS
   ========================================================= */

function renderProducts() {

    const body =
        document.getElementById(
            "comparisonBody"
        );


    if (!body) {

        return;

    }


    const products =
        getFilteredProducts();


    body.innerHTML = "";


    if (!products.length) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    style="
                        text-align:center;
                        padding:40px;
                    "
                >

                    <strong>
                        No matching products found.
                    </strong>

                    <br><br>

                    Try another weight or purity.

                </td>

            </tr>

        `;

        return;

    }


    products.forEach(
        (product, index) => {

            const row =
                document.createElement(
                    "tr"
                );


            const totalOffer =

                Number(
                    product.coupon || 0
                ) +

                Number(
                    product.paymentDiscount || 0
                ) +

                Number(
                    product.cashback || 0
                );


            const action =
                product.productUrl;


            const actionHTML =
                action

                    ? `

                        <a
                            href="${action}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="deal-btn"
                        >
                            View Product
                        </a>

                      `

                    : `

                        <button
                            class="deal-btn"
                            onclick="showDataNotice('${product.seller}')"
                        >
                            Data Pending
                        </button>

                      `;


            row.innerHTML = `

                <td>

                    <div class="seller">

                        ${
                            index === 0
                                ? "🏆 "
                                : ""
                        }

                        ${product.seller}

                    </div>


                    <div class="brand">

                        ${product.productName}

                    </div>


                    <div style="margin-top:5px;">

                        ${getStatusBadge(
                            product.status
                        )}

                    </div>

                </td>


                <td>

                    <strong>

                        ${money(
                            product.listedPrice
                        )}

                    </strong>


                    ${
                        product.shipping

                        ? `

                            <br>

                            <small>

                                +
                                ${money(
                                    product.shipping
                                )}
                                shipping

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

                        ${
                            product.premium
                                .toFixed(2)
                        }%

                    </span>

                </td>


                <td>

                    ${
                        product.coupon

                        ? `

                            <span
                                class="badge badge-orange"
                            >
                                Coupon
                                -${money(
                                    product.coupon
                                )}
                            </span>

                          `

                        : ""

                    }


                    ${
                        product.cardOffer

                        ? `

                            <span
                                class="badge badge-blue"
                            >
                                Card
                                -${money(
                                    product.cardOffer
                                )}
                            </span>

                          `

                        : ""

                    }


                    ${
                        product.upiOffer

                        ? `

                            <span
                                class="badge badge-green"
                            >
                                UPI
                                -${money(
                                    product.upiOffer
                                )}
                            </span>

                          `

                        : ""

                    }


                    ${
                        product.cashback

                        ? `

                            <br>

                            <small>

                                Cashback:
                                ${money(
                                    product.cashback
                                )}

                            </small>

                          `

                        : ""

                    }

                </td>


                <td>

                    <div class="effective">

                        ${money(
                            product.effective
                        )}

                    </div>


                    <small>

                        Total benefits:
                        ${money(
                            totalOffer
                        )}

                    </small>

                </td>


                <td>

                    ${actionHTML}

                </td>

            `;


            body.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   DATA NOTICE
   ========================================================= */

function showDataNotice(
    seller
) {

    alert(

        `${seller} product URL is not connected yet.\n\n` +

        `This product is currently sample data.`

    );

}


/* =========================================================
   FILTER REFRESH
   ========================================================= */

function refreshComparison() {

    if (currentSelection) {

        renderProducts();

    }

}


/* =========================================================
   AUTO REFRESH LIVE RATE
   ========================================================= */

/*
 * Refresh every 5 minutes.
 */

setInterval(
    loadLiveGoldRates,
    5 * 60 * 1000
);


/* =========================================================
   PAGE INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "GoldManiaSavings starting..."
        );


        /*
         * Load products
         */

        await loadProducts();


        /*
         * Load LIVE gold rates
         */

        await loadLiveGoldRates();


        /*
         * Setup seller filters
         */

        populateSellerFilter();


        console.log(
            "GoldManiaSavings ready."
        );

    }
);

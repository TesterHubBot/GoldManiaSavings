let productDatabase = [];
let currentSelection = null;


/* =========================
   BASIC HELPERS
========================= */

function money(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 0
    });
}


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
            ${labels[status] || status}
        </span>
    `;
}


/* =========================
   LOAD PRODUCTS
========================= */

async function loadProducts() {

    try {

        const response =
            await fetch("./products.json", {
                cache: "no-store"
            });

        if (!response.ok) {
            throw new Error("Unable to load products.json");
        }

        const data =
            await response.json();

        productDatabase =
            Array.isArray(data.products)
                ? data.products
                : [];

        console.log(
            "GoldManiaSavings products loaded:",
            productDatabase.length
        );

    } catch (error) {

        console.error(error);

        productDatabase = [];

    }

}


/* =========================
   GOLD SELECTION
========================= */

function getSelection() {

    const purity =
        document.getElementById("purity").value;

    const weight =
        parseFloat(
            document.getElementById("weight").value
        );

    const rate24 =
        parseFloat(
            document.getElementById("rate24").value
        ) || 0;

    const rate22 =
        parseFloat(
            document.getElementById("rate22").value
        ) || 0;

    const factor =
        purity === "24K"
            ? 0.9999
            : 0.916;

    const rate =
        purity === "24K"
            ? rate24
            : rate22;

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


/* =========================
   PRODUCT CALCULATION
========================= */

function calculateProduct(product) {

    const goldValue =
        currentSelection.goldValue;

    const listedPrice =
        Number(product.listedPrice || 0);

    const coupon =
        Number(product.coupon || 0);

    const cardOffer =
        Number(product.cardOffer || 0);

    const upiOffer =
        Number(product.upiOffer || 0);

    const shipping =
        Number(product.shipping || 0);

    const payment =
        document.getElementById("paymentFilter")?.value
        || "all";

    let paymentDiscount = 0;

    if (payment === "card") {
        paymentDiscount = cardOffer;
    }

    else if (payment === "upi") {
        paymentDiscount = upiOffer;
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
        Number(product.cashback || 0);

    const effective =
        Math.max(
            0,
            payable - cashback
        );

    const premium =
        goldValue > 0
            ? ((listedPrice - goldValue) /
               goldValue) * 100
            : 0;

    const effectivePremium =
        goldValue > 0
            ? ((effective - goldValue) /
               goldValue) * 100
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


/* =========================
   FILTERS
========================= */

function getFilteredProducts() {

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
        productDatabase.filter(product => {

            if (product.purity !== purity) {
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
                !product.paymentMethods?.includes(payment)
            ) {
                return false;
            }

            return true;

        });


    products =
        products.map(calculateProduct);


    if (premium !== "all") {

        const max =
            Number(premium);

        products =
            products.filter(
                product =>
                    product.effectivePremium <= max
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
                    a.coupon +
                    a.cardOffer +
                    a.upiOffer +
                    a.cashback;

                const offerB =
                    b.coupon +
                    b.cardOffer +
                    b.upiOffer +
                    b.cashback;

                return offerB - offerA;

            }
        );

    }

    return products;

}


/* =========================
   SELLER FILTER
========================= */

function populateSellerFilter() {

    const select =
        document.getElementById(
            "sellerFilter"
        );

    if (!select) return;

    const sellers =
        [...new Set(
            productDatabase.map(
                product => product.seller
            )
        )];

    select.innerHTML =
        `<option value="all">
            All Sellers
        </option>`;

    sellers.forEach(seller => {

        const option =
            document.createElement("option");

        option.value = seller;

        option.textContent = seller;

        select.appendChild(option);

    });

}


/* =========================
   MAIN COMPARE
========================= */

async function compareGold() {

    if (!productDatabase.length) {

        await loadProducts();

    }

    currentSelection =
        getSelection();


    document.getElementById(
        "summaryPurity"
    ).textContent =
        currentSelection.purity;


    document.getElementById(
        "summaryWeight"
    ).textContent =
        currentSelection.weight + "g";


    document.getElementById(
        "summaryPureGold"
    ).textContent =
        currentSelection.pureGold.toFixed(4)
        + "g";


    document.getElementById(
        "summaryGoldValue"
    ).textContent =
        money(currentSelection.goldValue);


    document.getElementById(
        "comparisonTitle"
    ).textContent =
        `${currentSelection.purity} • ${currentSelection.weight}g Gold Coin`;


    populateSellerFilter();

    renderProducts();


    document.getElementById(
        "results"
    ).style.display = "block";


    document.getElementById(
        "results"
    ).scrollIntoView({
        behavior: "smooth"
    });

}


/* =========================
   RENDER PRODUCT CARDS
========================= */

function renderProducts() {

    const body =
        document.getElementById(
            "comparisonBody"
        );

    if (!body) return;

    const products =
        getFilteredProducts();


    body.innerHTML = "";


    if (!products.length) {

        body.innerHTML = `
            <tr>
                <td colspan="7"
                    style="text-align:center;padding:40px;">

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
                document.createElement("tr");


            const totalOffer =
                product.coupon +
                product.paymentDiscount +
                product.cashback;


            const action =
                product.affiliateUrl ||
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
                            View Deal
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
                        ${money(product.listedPrice)}
                    </strong>

                    ${
                        product.shipping
                        ? `
                            <br>
                            <small>
                                + ${money(product.shipping)}
                                shipping
                            </small>
                          `
                        : ""
                    }

                </td>


                <td>

                    ${money(product.goldValue)}

                </td>


                <td>

                    <span class="premium">

                        ${product.premium.toFixed(2)}%

                    </span>

                </td>


                <td>

                    ${
                        product.coupon
                        ? `
                            <span class="badge badge-orange">
                                Coupon -${money(product.coupon)}
                            </span>
                          `
                        : ""
                    }

                    ${
                        product.cardOffer
                        ? `
                            <span class="badge badge-blue">
                                Card -${money(product.cardOffer)}
                            </span>
                          `
                        : ""
                    }

                    ${
                        product.upiOffer
                        ? `
                            <span class="badge badge-green">
                                UPI -${money(product.upiOffer)}
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
                                ${money(product.cashback)}
                            </small>
                          `
                        : ""
                    }

                </td>


                <td>

                    <div class="effective">

                        ${money(product.effective)}

                    </div>

                    <small>

                        Total benefits:
                        ${money(totalOffer)}

                    </small>

                </td>


                <td>

                    ${actionHTML}

                </td>

            `;


            body.appendChild(row);

        }
    );

}


/* =========================
   NOTICE
========================= */

function showDataNotice(seller) {

    alert(
        `${seller} product URL has not been connected yet.\n\n` +
        `This product is currently sample data.`
    );

}


/* =========================
   AUTO REFRESH
========================= */

function refreshComparison() {

    if (currentSelection) {
        renderProducts();
    }

}


/* =========================
   INIT
========================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadProducts();

        populateSellerFilter();

        console.log(
            "GoldManiaSavings ready."
        );

    }
);


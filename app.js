const API =
  "https://goldmaniasavings-api.onlinetechmine.workers.dev";

let products = [];
let selectedPurity = "all";

const $ = selector =>
  document.querySelector(selector);

document.addEventListener(
  "DOMContentLoaded",
  init
);

async function init() {
  bindEvents();

  await Promise.all([
    loadGold(),
    loadSellers(),
    loadProducts()
  ]);
}

/* ---------------------------------------------------------
   EVENTS
--------------------------------------------------------- */

function bindEvents() {
  document
    .querySelectorAll(
      ".chip[data-purity]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          document
            .querySelectorAll(
              ".chip[data-purity]"
            )
            .forEach(b =>
              b.classList.remove(
                "active"
              )
            );

          button.classList.add(
            "active"
          );

          selectedPurity =
            button.dataset.purity;

          render();
        }
      );
    });

  $("#weightFilter")
    .addEventListener(
      "change",
      render
    );

  $("#sellerFilter")
    .addEventListener(
      "change",
      render
    );

  $("#refreshBtn")
    .addEventListener(
      "click",
      async () => {
        $("#refreshBtn").textContent =
          "↻ Updating...";

        await Promise.all([
          loadGold(),
          loadProducts()
        ]);

        $("#refreshBtn").textContent =
          "↻ Refresh";
      }
    );
}

/* ---------------------------------------------------------
   GOLD
--------------------------------------------------------- */

async function loadGold() {
  try {
    const response =
      await fetch(
        `${API}/api/gold`,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "Gold endpoint failed"
      );
    }

    const data =
      await response.json();

    const rates =
      data.rates || {};

    $("#gold24").textContent =
      money(rates["24K"]);

    $("#gold22").textContent =
      money(rates["22K"]);

    $("#gold18").textContent =
      money(rates["18K"]);

    const status =
      $("#goldStatus");

    if (data.live) {
      status.textContent =
        "● Live";
      status.className =
        "status live";
    } else {
      status.textContent =
        "Unavailable";
      status.className =
        "status offline";
    }

    $("#goldSource").textContent =
      data.source
        ? `Source: ${data.source} · INR per gram`
        : "Gold reference price unavailable.";

  } catch (error) {
    console.error(error);

    $("#goldStatus").textContent =
      "Unavailable";

    $("#goldStatus

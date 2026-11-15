(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);
  const number = id => {
    const raw = $(id).value.trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };

  $("searchForm").addEventListener("submit", event => {
    event.preventDefault();
    const terms = $("keywords").value.trim();
    const category = $("category").value;
    const minDiscount = Number($("discount").value);
    const maxPrice = number("maxPrice");
    const query = [terms, category].filter(Boolean).join(" ");
    const params = new URLSearchParams({k:query || "deals"});
    if (minDiscount > 0) params.set("pct-off", minDiscount + "-");
    if (maxPrice !== null) params.set("high-price", String(Math.round(maxPrice)));
    params.set("s", $("sort").value);
    window.open("https://www.amazon.com/s?" + params.toString(), "_blank", "noopener,noreferrer");
  });

  $("compareForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("productName").value.trim();
    const amazon = number("amazonPrice");
    const entries = [
      ["Walmart",number("walmartPrice")],
      ["Target",number("targetPrice")],
      ["Manufacturer",number("manufacturerPrice")]
    ].filter(([,price]) => price !== null);
    const regular = number("regularPrice");
    const result = $("result");
    result.classList.remove("hidden");
    if (amazon === null || amazon <= 0) {
      result.innerHTML = '<span class="status">AMAZON PRICE NEEDED</span><p>Enter a valid Amazon price to compare this product.</p>';
      return;
    }
    const cheapest = entries.length ? entries.reduce((best,item) => item[1] < best[1] ? item : best) : null;
    const savings = cheapest ? cheapest[1] - amazon : null;
    const percent = cheapest && cheapest[1] > 0 ? (savings / cheapest[1]) * 100 : null;
    const msrpDrop = regular && regular > 0 ? ((regular-amazon)/regular)*100 : null;
    let status = "NOT ENOUGH DATA", statusClass = "";
    let verdict = "We do not have another retailer's price yet. That means the deal is unverified—not that Amazon is the cheapest.";
    if (cheapest && savings > 0.01) {
      status = "AMAZON IS CHEAPER"; statusClass = "good";
      verdict = "Amazon is " + money(savings) + " (" + percent.toFixed(1) + "%) below the lowest entered alternative: " + cheapest[0] + ". Confirm that the exact model, condition, shipping, and seller match.";
    } else if (cheapest && savings < -0.01) {
      status = "ANOTHER STORE IS CHEAPER"; statusClass = "bad";
      verdict = cheapest[0] + " is " + money(Math.abs(savings)) + " cheaper than Amazon. Based on the prices entered, Amazon is not the best price.";
    } else if (cheapest) {
      status = "PRICES ARE TIED";
      verdict = "Amazon is effectively tied with the lowest entered alternative (" + cheapest[0] + "). Check shipping, coupons, and seller conditions.";
    }
    const metric = (label,value) => '<div class="metric"><span>'+label+'</span><strong>'+value+'</strong></div>';
    const msrpText = msrpDrop === null ? "Not supplied" : (msrpDrop >= 0 ? msrpDrop.toFixed(1)+"% below" : Math.abs(msrpDrop).toFixed(1)+"% above");
    const compareText = cheapest ? money(cheapest[1])+" · "+cheapest[0] : "Not checked";
    const link = $("amazonUrl").value.trim();
    const safeLink = /^https:\/\/(www\.)?amazon\.com\//i.test(link) ? link : "";
    result.innerHTML = '<h3>'+escapeHtml(name)+'</h3><span class="status '+statusClass+'">'+status+'</span><p>'+escapeHtml(verdict)+'</p><div class="metrics">'+metric("AMAZON",money(amazon))+metric("LOWEST ALTERNATIVE",compareText)+metric("VS. REFERENCE PRICE",msrpText)+'</div><p><strong>Evidence:</strong> '+(entries.length ? entries.length+" retailer price(s) entered" : "No retailer prices entered")+'. '+(regular !== null ? "Reference price supplied; it is not independently verified." : "No reference price supplied.")+'</p>'+(safeLink ? '<a class="retailer-link" target="_blank" rel="noopener noreferrer" href="'+safeLink+'">Open Amazon product ↗</a>' : '');
  });

  $("resetCompare").addEventListener("click", () => {
    $("compareForm").reset();
    $("result").classList.add("hidden");
    $("result").textContent = "";
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
})();
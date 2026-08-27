(function () {
  const screen = document.getElementById("ussd-screen");
  const input = document.getElementById("ussd-input");
  const sendBtn = document.getElementById("ussd-send");
  const restartBtn = document.getElementById("ussd-restart");

  let state = "dial";
  let ctx = {};

  function listLines(items, labelFn) {
    return items.map((it, i) => `${i + 1}. ${labelFn(it)}`).join("\n");
  }

  function show(text) { screen.textContent = text; }

  function renderMenu() {
    state = "menu";
    show("TSALA MARKET\n1. Check my offer\n2. Price trends\n0. Exit");
  }

  function renderCommodity(next) {
    ctx.nextAfterCommodity = next;
    state = "commodity";
    show(`Select commodity:\n${listLines(COMMODITIES, c => c.name)}\n0. Back`);
  }

  function renderDistrict() {
    state = "district";
    show(`Select district:\n${listLines(DISTRICTS, d => d.name)}\n0. Back`);
  }

  function renderGrade() {
    state = "grade";
    show(`Quality grade for ${Pricing.getCommodity(ctx.commodityId).name}:\n1. Grade A\n2. Grade B\n3. Grade C\n0. Not sure (uses Grade B)`);
  }

  function renderPrice() {
    state = "price";
    show(`Enter the price you were offered (Pula, numbers only):\ne.g. 150`);
  }

  function renderUnit() {
    state = "unit";
    const commodity = Pricing.getCommodity(ctx.commodityId);
    show(`Select the unit for that price:\n${listLines(commodity.units, u => u.unit)}\n0. Back`);
  }

  function renderCheckResult() {
    const result = Pricing.checkFairPrice({
      commodityId: ctx.commodityId, districtId: ctx.districtId,
      grade: ctx.grade, offeredAmount: ctx.amount, offeredUnit: ctx.unit,
    });
    state = "result";
    if (result.status === "unsupported_unit") {
      show(`Sorry, that unit isn't recognised.\nSupported: ${result.supportedUnits.join(", ")}\n\n1. Try again  0. Exit`);
      return;
    }
    if (result.status === "insufficient_data") {
      show(`Not enough verified data yet for this commodity/district.\nWe never guess -- please try again soon.\n\n1. New check  0. Exit`);
      return;
    }
    const flagText = { Fair: "FAIR OFFER", BelowAverage: "BELOW AVERAGE", SignificantlyUnderpaid: "SIGNIFICANTLY UNDERPAID" }[result.flag];
    show(
`RESULT: ${flagText}
Your offer: P${result.offeredPricePKg.toFixed(2)}/kg
Reference : P${result.referencePricePKg.toFixed(2)}/kg
Deviation : ${result.deviationPct > 0 ? "+" : ""}${result.deviationPct}%
Confidence: ${result.confidence}${result.fallbackUsed ? ` (${result.fallbackLevel} data)` : ""}

Indicative guidance only, not a
guaranteed price.

1. New check  0. Exit`
    );
  }

  function renderTrendsResult() {
    const params = Store.getSystemParams();
    const entries = Store.getEntries().filter(e =>
      e.commodity === ctx.commodityId && e.district === ctx.districtId &&
      e.marketLevel === "FarmGate" && e.verificationStatus === "Verified" &&
      (Date.now() - new Date(e.submittedDate).getTime()) / 86400000 <= params.aggregationWindowDays
    );
    state = "result";
    if (!entries.length) {
      show(`No verified price data yet for\n${Pricing.getCommodity(ctx.commodityId).name} in ${Pricing.getDistrict(ctx.districtId).name}.\n\n1. New search  0. Exit`);
      return;
    }
    const vals = entries.map(e => e.priceNormalizedPKg).sort((a, b) => a - b);
    const median = vals.length % 2 ? vals[Math.floor(vals.length / 2)] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
    show(
`${Pricing.getCommodity(ctx.commodityId).name.toUpperCase()} -- ${Pricing.getDistrict(ctx.districtId).name}
Farm-gate median: P${median.toFixed(2)}/kg
Based on ${entries.length} verified entries
(last ${params.aggregationWindowDays} days)

1. New search  0. Exit`
    );
  }

  function handleInput(raw) {
    const val = raw.trim();
    if (state === "dial") { renderMenu(); return; }

    if (state === "menu") {
      if (val === "1") { ctx = { flow: "check" }; renderCommodity("district"); }
      else if (val === "2") { ctx = { flow: "trends" }; renderCommodity("district"); }
      else show("Session ended. Dial *134*7# to start again.");
      return;
    }

    if (state === "commodity") {
      if (val === "0") { renderMenu(); return; }
      const idx = parseInt(val, 10) - 1;
      if (COMMODITIES[idx]) { ctx.commodityId = COMMODITIES[idx].id; renderDistrict(); }
      else show("Invalid option. Enter a number from the list, or 0 to go back.\n\n" + screen.textContent);
      return;
    }

    if (state === "district") {
      if (val === "0") { renderCommodity(ctx.nextAfterCommodity); return; }
      const idx = parseInt(val, 10) - 1;
      if (DISTRICTS[idx]) {
        ctx.districtId = DISTRICTS[idx].id;
        if (ctx.flow === "check") renderGrade(); else renderTrendsResult();
      } else show("Invalid option. Enter a number from the list, or 0 to go back.");
      return;
    }

    if (state === "grade") {
      if (val === "0") { ctx.grade = ""; renderPrice(); return; }
      const map = { "1": "A", "2": "B", "3": "C" };
      if (map[val]) { ctx.grade = map[val]; renderPrice(); }
      else show("Invalid option. Choose 1, 2, 3, or 0.");
      return;
    }

    if (state === "price") {
      const amount = parseFloat(val);
      if (isNaN(amount) || amount <= 0) { show("Please enter a valid number, e.g. 150"); return; }
      ctx.amount = amount;
      renderUnit();
      return;
    }

    if (state === "unit") {
      if (val === "0") { renderPrice(); return; }
      const commodity = Pricing.getCommodity(ctx.commodityId);
      const idx = parseInt(val, 10) - 1;
      if (commodity.units[idx]) { ctx.unit = commodity.units[idx].unit; renderCheckResult(); }
      else show("Invalid option. Enter a number from the list, or 0 to go back.");
      return;
    }

    if (state === "result") {
      if (val === "1") { ctx = { flow: ctx.flow }; renderCommodity("district"); }
      else show("Session ended. Dial *134*7# to start again.");
      return;
    }
  }

  sendBtn.addEventListener("click", () => { handleInput(input.value); input.value = ""; input.focus(); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { handleInput(input.value); input.value = ""; } });
  restartBtn.addEventListener("click", () => { ctx = {}; renderMenu(); });

  renderMenu();
})();

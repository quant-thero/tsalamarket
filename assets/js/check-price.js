(function () {
  const commoditySel = document.getElementById("commodity");
  const districtSel = document.getElementById("district");
  const unitSel = document.getElementById("unit");
  const form = document.getElementById("check-form");
  const resultPanel = document.getElementById("result-panel");

  COMMODITIES.forEach(c => commoditySel.appendChild(new Option(`${c.name} (${c.category})`, c.id)));
  DISTRICTS.forEach(d => districtSel.appendChild(new Option(d.name, d.id)));

  function populateUnits() {
    const commodity = Pricing.getCommodity(commoditySel.value);
    unitSel.innerHTML = "";
    commodity.units.forEach(u => unitSel.appendChild(new Option(u.unit, u.unit)));
  }
  commoditySel.addEventListener("change", populateUnits);
  populateUnits();

  const FLAG_META = {
    Fair: { cls: "fair", label: "Fair offer", badge: "badge-fair", dot: "dot-fair" },
    BelowAverage: { cls: "below", label: "Below average", badge: "badge-below", dot: "dot-below" },
    SignificantlyUnderpaid: { cls: "underpaid", label: "Significantly underpaid", badge: "badge-underpaid", dot: "dot-underpaid" },
  };
  const CONF_BADGE = { High: "badge-high", Medium: "badge-medium", Low: "badge-low" };

  function render(result, ctx) {
    if (result.status === "unsupported_unit") {
      resultPanel.className = "card";
      resultPanel.innerHTML = `
        <div class="result-flag underpaid">
          <div>
            <div class="flag-title">Unit not recognised</div>
            <p class="small" style="margin-top:8px;">
              We couldn't convert that unit for ${ctx.commodityName}. Supported units: ${result.supportedUnits.join(", ")}.
            </p>
          </div>
        </div>`;
      return;
    }

    if (result.status === "insufficient_data") {
      resultPanel.className = "card";
      resultPanel.innerHTML = `
        <div class="result-flag" style="background:var(--paper-2); border:1px solid var(--ink-100);">
          <div>
            <div class="flag-title" style="color:var(--ink-700);">Not enough verified data yet</div>
            <p class="small" style="margin-top:8px;">
              We don't have enough verified entries for ${ctx.commodityName} in ${ctx.districtName}
              (or nearby districts) to return a reliable fairness flag. We never guess -- try again
              once more data has been submitted, or check a neighbouring district.
            </p>
          </div>
        </div>`;
      return;
    }

    const meta = FLAG_META[result.flag];
    resultPanel.className = "card";
    resultPanel.innerHTML = `
      <div class="result-flag ${meta.cls}">
        <div style="width:100%;">
          <span class="dot ${meta.dot}"></span>
          <div class="flag-title">${meta.label}</div>
          <p class="small" style="margin-top:6px; opacity:.85;">
            You were offered <strong>P${result.offeredPricePKg.toFixed(2)}/kg</strong>
            vs a verified reference of <strong>P${result.referencePricePKg.toFixed(2)}/kg</strong>
            (${result.deviationPct > 0 ? "+" : ""}${result.deviationPct}%)
          </p>
        </div>
      </div>
      <div class="tag-row" style="margin-top:16px;">
        <span class="badge ${CONF_BADGE[result.confidence]}">${result.confidence} confidence</span>
        ${result.ungraded ? '<span class="badge badge-neutral">Assumed Grade B</span>' : `<span class="badge badge-neutral">Grade ${result.grade}</span>`}
        ${result.fallbackUsed ? `<span class="badge badge-community">Widened to ${result.fallbackLevel} data</span>` : ""}
      </div>
      <div class="divider"></div>
      <div class="small muted">
        Based on ${result.sampleSize} verified ${result.sampleSize === 1 ? "entry" : "entries"}
        from ${result.submitterCount} distinct ${result.submitterCount === 1 ? "submitter" : "submitters"}.
      </div>
      <div class="disclaimer">${result.disclaimer}</div>
    `;
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const commodityId = commoditySel.value;
    const districtId = districtSel.value;
    const grade = document.getElementById("grade").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const unit = unitSel.value;

    const result = Pricing.checkFairPrice({ commodityId, districtId, grade, offeredAmount: amount, offeredUnit: unit });
    render(result, {
      commodityName: Pricing.getCommodity(commodityId).name,
      districtName: Pricing.getDistrict(districtId).name,
    });
  });
})();

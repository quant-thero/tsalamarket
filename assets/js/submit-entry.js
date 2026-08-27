(function () {
  const commoditySel = document.getElementById("commodity");
  const districtSel = document.getElementById("district");
  const unitSel = document.getElementById("unit");
  const form = document.getElementById("submit-form");
  const resultBox = document.getElementById("submit-result");
  const myEntriesBody = document.getElementById("my-entries-body");
  const SUBMITTER_ID = "sub-local-user";

  COMMODITIES.forEach(c => commoditySel.appendChild(new Option(c.name, c.id)));
  DISTRICTS.forEach(d => districtSel.appendChild(new Option(d.name, d.id)));

  function populateUnits() {
    const commodity = Pricing.getCommodity(commoditySel.value);
    unitSel.innerHTML = "";
    commodity.units.forEach(u => unitSel.appendChild(new Option(u.unit, u.unit)));
  }
  commoditySel.addEventListener("change", populateUnits);
  populateUnits();

  function statusBadge(status) {
    const map = { Verified: "badge-verified", CommunityReported: "badge-community", Rejected: "badge-rejected" };
    return `<span class="badge ${map[status] || "badge-neutral"}">${status === "CommunityReported" ? "Community" : status}</span>`;
  }

  function refreshMyEntries() {
    const mine = Store.getEntries().filter(e => e.submitterId === SUBMITTER_ID)
      .sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
    myEntriesBody.innerHTML = mine.length ? mine.map(e => `
      <tr>
        <td>${Pricing.getCommodity(e.commodity).name}</td>
        <td>${Pricing.getDistrict(e.district).name}</td>
        <td>P${e.priceNormalizedPKg.toFixed(2)}/kg</td>
        <td>${statusBadge(e.verificationStatus)}</td>
      </tr>`).join("")
      : `<tr><td colspan="4" class="empty-state">No submissions yet this session.</td></tr>`;
  }
  refreshMyEntries();

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = document.getElementById("submitter-name").value.trim() || "Anonymous vendor";
    const commodityId = commoditySel.value, districtId = districtSel.value;
    const grade = document.getElementById("grade").value;
    const marketLevel = document.getElementById("market-level").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const unit = unitSel.value;

    const result = Pricing.submitPriceEntry({
      submitterId: SUBMITTER_ID, submitterName: name,
      commodityId, districtId, grade, marketLevel, amount, unit,
    });

    if (result.status === "unsupported_unit") {
      resultBox.className = "card";
      resultBox.innerHTML = `<div class="result-flag underpaid"><div>
        <div class="flag-title">Unit not recognised</div>
        <p class="small" style="margin-top:8px;">Supported units: ${result.supportedUnits.join(", ")}.</p>
      </div></div>`;
      return;
    }

    const e = result.entry;
    resultBox.className = "card";
    resultBox.innerHTML = `
      <div class="result-flag ${e.verificationStatus === "Verified" ? "fair" : ""}" style="${e.verificationStatus !== "Verified" ? "background:var(--blue-100); border:1px solid #bcd8f2;" : ""}">
        <div>
          <div class="flag-title" style="${e.verificationStatus !== "Verified" ? "color:var(--blue-700);" : ""}">
            ${e.verificationStatus === "Verified" ? "Entry verified" : "Entry recorded -- pending verification"}
          </div>
          <p class="small" style="margin-top:8px;">
            P${e.priceNormalizedPKg.toFixed(2)}/kg recorded for ${Pricing.getCommodity(e.commodity).name}, ${Pricing.getDistrict(e.district).name}, Grade ${e.qualityGrade}.
            ${e.ungradedFlag ? "No grade was declared, so it defaulted to Grade B and is flagged for admin correction." : ""}
            ${result.corroborated ? " A matching independent submission within the last 72 hours corroborated this entry, so both were promoted to Verified." : " It will move to Verified once corroborated by another submitter or confirmed by a System Admin."}
          </p>
        </div>
      </div>`;
    form.reset();
    populateUnits();
    refreshMyEntries();
  });
})();

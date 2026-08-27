(function () {
  const commoditySel = document.getElementById("commodity");
  const districtSel = document.getElementById("district");
  const statRow = document.getElementById("stat-row");
  const entriesBody = document.getElementById("entries-body");
  let chart = null;

  COMMODITIES.forEach(c => commoditySel.appendChild(new Option(`${c.name} (${c.category})`, c.id)));
  DISTRICTS.forEach(d => districtSel.appendChild(new Option(d.name, d.id)));
  commoditySel.value = "tomatoes";
  districtSel.value = "kweneng";

  function statusBadge(status) {
    const map = { Verified: "badge-verified", CommunityReported: "badge-community", Rejected: "badge-rejected" };
    return `<span class="badge ${map[status] || "badge-neutral"}">${status === "CommunityReported" ? "Community" : status}</span>`;
  }

  function refresh() {
    const commodityId = commoditySel.value, districtId = districtSel.value;
    const all = Store.getEntries()
      .filter(e => e.commodity === commodityId && e.district === districtId)
      .sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));

    const verifiedB = all.filter(e => e.qualityGrade === "B" && e.marketLevel === "FarmGate" && e.verificationStatus === "Verified");
    const verifiedAny = all.filter(e => e.verificationStatus === "Verified");

    const latest = verifiedAny[0];
    const medianAll = verifiedAny.length
      ? [...verifiedAny.map(e => e.priceNormalizedPKg)].sort((a, b) => a - b)[Math.floor(verifiedAny.length / 2)]
      : null;

    statRow.innerHTML = `
      <div class="stat"><div class="stat-value">${verifiedAny.length}</div><div class="stat-label">Verified entries (all time, this bucket)</div></div>
      <div class="stat"><div class="stat-value">${latest ? "P" + latest.priceNormalizedPKg.toFixed(2) : "--"}</div><div class="stat-label">Most recent verified /kg</div></div>
      <div class="stat"><div class="stat-value">${medianAll !== null ? "P" + medianAll.toFixed(2) : "--"}</div><div class="stat-label">Rough median /kg</div></div>
      <div class="stat"><div class="stat-value">${new Set(all.map(e => e.submitterId)).size}</div><div class="stat-label">Distinct submitters</div></div>
    `;

    entriesBody.innerHTML = all.length ? all.slice(0, 12).map(e => `
      <tr>
        <td>${new Date(e.submittedDate).toLocaleDateString()}</td>
        <td>${e.qualityGrade}${e.ungradedFlag ? " (auto)" : ""}</td>
        <td>${e.marketLevel}</td>
        <td>P${e.priceNormalizedPKg.toFixed(2)}/kg</td>
        <td>${statusBadge(e.verificationStatus)}</td>
        <td class="small muted">${e.submitterName || "Farmer submission"}</td>
      </tr>
    `).join("") : `<tr><td colspan="6" class="empty-state">No submissions yet for this commodity/district.</td></tr>`;

    try {
      const chartData = [...verifiedB].sort((a, b) => new Date(a.submittedDate) - new Date(b.submittedDate));
      const labels = chartData.map(e => new Date(e.submittedDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
      const values = chartData.map(e => e.priceNormalizedPKg);

      if (chart) chart.destroy();
      chart = new Chart(document.getElementById("trend-chart"), {
        type: "line",
        data: {
          labels: labels.length ? labels : ["No verified data yet"],
          datasets: [{
            label: "Verified P/kg",
            data: values,
            borderColor: "#0f6e56",
            backgroundColor: "rgba(29,158,117,0.12)",
            tension: 0.35,
            fill: true,
            pointRadius: 3,
          }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { callback: v => "P" + v } } },
        },
      });
    } catch (err) {
      document.getElementById("trend-chart").insertAdjacentHTML("afterend",
        '<p class="small muted" id="chart-fallback-note">Chart library did not load -- see the table below for the same data.</p>');
    }
  }

  commoditySel.addEventListener("change", refresh);
  districtSel.addEventListener("change", refresh);
  refresh();
})();

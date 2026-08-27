(function () {
  const districtFilter = document.getElementById("district-filter");
  const commodityFilter = document.getElementById("commodity-filter");
  const statsRow = document.getElementById("eo-stats");
  const queryBody = document.getElementById("query-body");
  let districtChart = null, volumeChart = null;

  DISTRICTS.forEach(d => districtFilter.appendChild(new Option(d.name, d.id)));
  COMMODITIES.forEach(c => commodityFilter.appendChild(new Option(c.name, c.id)));

  const FLAG_COLORS = { Fair: "#1d9e75", BelowAverage: "#ef9f27", SignificantlyUnderpaid: "#e24b4a" };
  const FLAG_LABEL = { Fair: "Fair", BelowAverage: "Below average", SignificantlyUnderpaid: "Significantly underpaid" };

  function filteredLog() {
    return Store.getQueryLog().filter(r =>
      (!districtFilter.value || r.district === districtFilter.value) &&
      (!commodityFilter.value || r.commodity === commodityFilter.value)
    );
  }

  function refresh() {
    const log = filteredLog();
    const resolved = log.filter(r => !r.insufficient);
    const underpaidPct = resolved.length
      ? Math.round((resolved.filter(r => r.flag === "SignificantlyUnderpaid").length / resolved.length) * 100)
      : 0;
    const avgDeviation = resolved.length
      ? (resolved.reduce((s, r) => s + r.deviationPct, 0) / resolved.length).toFixed(1)
      : "--";

    statsRow.innerHTML = `
      <div class="stat"><div class="stat-value">${log.length}</div><div class="stat-label">Total queries logged</div></div>
      <div class="stat"><div class="stat-value">${underpaidPct}%</div><div class="stat-label">Flagged significantly underpaid</div></div>
      <div class="stat"><div class="stat-value">${avgDeviation}${avgDeviation !== "--" ? "%" : ""}</div><div class="stat-label">Average deviation from reference</div></div>
      <div class="stat"><div class="stat-value">${log.filter(r => r.insufficient).length}</div><div class="stat-label">Insufficient-data outcomes</div></div>
    `;

    queryBody.innerHTML = log.slice(0, 25).map(r => `
      <tr>
        <td class="small">${new Date(r.timestamp).toLocaleString()}</td>
        <td>${Pricing.getCommodity(r.commodity).name}</td>
        <td>${Pricing.getDistrict(r.district).name}</td>
        <td>${r.grade || "--"}</td>
        <td>${r.insufficient
          ? '<span class="badge badge-neutral">Insufficient data</span>'
          : `<span class="badge ${r.flag === "Fair" ? "badge-fair" : r.flag === "BelowAverage" ? "badge-below" : "badge-underpaid"}">${FLAG_LABEL[r.flag]}</span>`}</td>
        <td>${r.insufficient ? "--" : (r.deviationPct > 0 ? "+" : "") + r.deviationPct + "%"}</td>
      </tr>`).join("") || `<tr><td colspan="6" class="empty-state">No queries match this filter.</td></tr>`;

    try {
      // District x fairness-flag stacked bar
      const districtsInPlay = districtFilter.value ? [DISTRICTS.find(d => d.id === districtFilter.value)] : DISTRICTS;
      const flagKeys = ["Fair", "BelowAverage", "SignificantlyUnderpaid"];
      const datasets = flagKeys.map(flag => ({
        label: FLAG_LABEL[flag],
        backgroundColor: FLAG_COLORS[flag],
        data: districtsInPlay.map(d => resolved.filter(r => r.district === d.id && r.flag === flag).length),
      }));

      if (districtChart) districtChart.destroy();
      districtChart = new Chart(document.getElementById("district-chart"), {
        type: "bar",
        data: { labels: districtsInPlay.map(d => d.name), datasets },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } },
          scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } },
        },
      });

      // Query volume over last 14 days
      const days = [...Array(14)].map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d;
      });
      const counts = days.map(d => log.filter(r => new Date(r.timestamp).toDateString() === d.toDateString()).length);
      if (volumeChart) volumeChart.destroy();
      volumeChart = new Chart(document.getElementById("volume-chart"), {
        type: "line",
        data: {
          labels: days.map(d => d.toLocaleDateString(undefined, { month: "short", day: "numeric" })),
          datasets: [{ label: "Queries", data: counts, borderColor: "#185fa5", backgroundColor: "rgba(24,95,165,0.12)", fill: true, tension: 0.3 }],
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { precision: 0 } } } },
      });
    } catch (err) {
      document.getElementById("district-chart").insertAdjacentHTML("afterend",
        '<p class="small muted">Chart library did not load -- see the table below for the same data.</p>');
    }
  }

  districtFilter.addEventListener("change", refresh);
  commodityFilter.addEventListener("change", refresh);
  refresh();
})();

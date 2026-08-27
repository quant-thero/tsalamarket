(function () {
  const queueBody = document.getElementById("queue-body");
  const auditBody = document.getElementById("audit-body");
  const statsRow = document.getElementById("admin-stats");
  const ADMIN_ID = "admin-demo";
  let filter = "all";

  function statusBadge(status) {
    const map = { Verified: "badge-verified", CommunityReported: "badge-community", Rejected: "badge-rejected" };
    return `<span class="badge ${map[status] || "badge-neutral"}">${status === "CommunityReported" ? "Unverified" : status}</span>`;
  }

  function refreshStats() {
    const all = Store.getEntries();
    const unverified = all.filter(e => e.verificationStatus === "CommunityReported").length;
    const outliers = all.filter(e => e.outlierFlagged && e.verificationStatus !== "Rejected").length;
    const verified = all.filter(e => e.verificationStatus === "Verified").length;
    statsRow.innerHTML = `
      <div class="stat"><div class="stat-value">${all.length}</div><div class="stat-label">Total price entries</div></div>
      <div class="stat"><div class="stat-value">${unverified}</div><div class="stat-label">Awaiting verification</div></div>
      <div class="stat"><div class="stat-value">${outliers}</div><div class="stat-label">Flagged as statistical outliers</div></div>
      <div class="stat"><div class="stat-value">${verified}</div><div class="stat-label">Verified entries</div></div>
    `;
  }

  function refreshQueue() {
    let list = Store.getEntries().sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
    if (filter === "unverified") list = list.filter(e => e.verificationStatus === "CommunityReported");
    if (filter === "outliers") list = list.filter(e => e.outlierFlagged);
    list = list.slice(0, 40);

    queueBody.innerHTML = list.length ? list.map(e => `
      <tr>
        <td class="small">${new Date(e.submittedDate).toLocaleDateString()}</td>
        <td>${Pricing.getCommodity(e.commodity).name}</td>
        <td>${Pricing.getDistrict(e.district).name}</td>
        <td>${e.qualityGrade}${e.ungradedFlag ? " (auto)" : ""}</td>
        <td>P${e.priceNormalizedPKg.toFixed(2)}/kg</td>
        <td>${statusBadge(e.verificationStatus)}</td>
        <td>${e.outlierFlagged ? '<span class="badge badge-below">Outlier</span>' : ""}</td>
        <td>
          <div class="tag-row">
            ${e.verificationStatus !== "Verified" ? `<button class="btn btn-sm btn-primary" data-act="verify" data-id="${e.id}">Verify</button>` : ""}
            ${e.verificationStatus !== "Rejected" ? `<button class="btn btn-sm btn-danger" data-act="reject" data-id="${e.id}">Reject</button>` : ""}
          </div>
        </td>
      </tr>`).join("") : `<tr><td colspan="8" class="empty-state">No entries match this filter.</td></tr>`;

    queueBody.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id, act = btn.dataset.act;
        const entry = Store.getEntries().find(x => x.id === id);
        const before = entry.verificationStatus;
        const after = act === "verify" ? "Verified" : "Rejected";
        Store.updateEntry(id, { verificationStatus: after });
        Store.addAuditRecord({
          adminIdentity: ADMIN_ID, actionType: act, entryId: id,
          fieldChanged: "verificationStatus", beforeValue: before, afterValue: after,
        });
        refreshAll();
      });
    });
  }

  function refreshAudit() {
    const log = Store.getAuditLog();
    auditBody.innerHTML = log.length ? log.slice(0, 30).map(r => `
      <tr>
        <td class="small">${new Date(r.timestamp).toLocaleString()}</td>
        <td><span class="badge ${r.actionType === "verify" ? "badge-verified" : "badge-rejected"}">${r.actionType}</span></td>
        <td class="small">${r.entryId}</td>
        <td class="small">${r.fieldChanged}: ${r.beforeValue} &rarr; ${r.afterValue}</td>
      </tr>`).join("") : `<tr><td colspan="4" class="empty-state">No admin actions yet this session.</td></tr>`;
  }

  function refreshAll() { refreshStats(); refreshQueue(); refreshAudit(); }

  Pricing.scanAllOutliers();

  ["all", "unverified", "outliers"].forEach(k => {
    document.getElementById(`filter-${k}`).addEventListener("click", () => { filter = k; refreshQueue(); });
  });

  // --- parameters form ---
  const paramsForm = document.getElementById("params-form");
  function loadParams() {
    const p = Store.getSystemParams();
    document.getElementById("p-window").value = p.aggregationWindowDays;
    document.getElementById("p-corrhours").value = p.corroborationWindowHours;
    document.getElementById("p-corrtol").value = p.corroborationTolerancePct;
    document.getElementById("p-iqr").value = p.outlierIqrMultiplier;
    document.getElementById("p-minsample").value = p.minSampleSize;
    document.getElementById("p-minsub").value = p.minSubmitters;
    document.getElementById("p-fair").value = p.fairThresholdPct;
    document.getElementById("p-below").value = p.belowAverageThresholdPct;
  }
  loadParams();

  paramsForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const p = {
      aggregationWindowDays: Number(document.getElementById("p-window").value),
      corroborationWindowHours: Number(document.getElementById("p-corrhours").value),
      corroborationTolerancePct: Number(document.getElementById("p-corrtol").value),
      outlierIqrMultiplier: Number(document.getElementById("p-iqr").value),
      minSampleSize: Number(document.getElementById("p-minsample").value),
      minSubmitters: Number(document.getElementById("p-minsub").value),
      fairThresholdPct: Number(document.getElementById("p-fair").value),
      belowAverageThresholdPct: Number(document.getElementById("p-below").value),
    };
    Store.saveSystemParams(p);
    Store.addAuditRecord({
      adminIdentity: ADMIN_ID, actionType: "configure", entryId: "system-parameters",
      fieldChanged: "SystemParameterSet", beforeValue: "(previous values)", afterValue: JSON.stringify(p),
    });
    refreshAudit();
    alert("Parameters saved. The pricing engine will use these on the next fairness check.");
  });

  document.getElementById("reset-demo").addEventListener("click", () => {
    if (confirm("Reset all demo data (entries, audit log, query log, parameters)? This cannot be undone.")) {
      Store.reset();
      loadParams();
      refreshAll();
    }
  });

  refreshAll();
})();

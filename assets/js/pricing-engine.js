/* ==========================================================================
   Tsala Market -- Pricing engine (frontend simulation)
   Mirrors PriceCalculationService from the domain model / decision D-002:
   bucketing, outlier filtering, sample-size gating with fallback, median
   reference price, fairness classification and confidence labelling.
   Traces to: FR-02, FR-03, FR-08 - FR-13 ; BR-03, BR-05 - BR-11.
   ========================================================================== */

const Pricing = {

  getCommodity(id) { return COMMODITIES.find(c => c.id === id); },
  getDistrict(id) { return DISTRICTS.find(d => d.id === id); },

  /** FR-02 / FR-03 -- normalise a submitted price to P/kg; reject unknown units. */
  normalizeToPKg(commodityId, amount, unitLabel) {
    const commodity = this.getCommodity(commodityId);
    const match = commodity.units.find(u => u.unit === unitLabel);
    if (!match) {
      return { ok: false, supportedUnits: commodity.units.map(u => u.unit) };
    }
    return { ok: true, pricePerKg: amount / match.factor };
  },

  _daysAgo(iso) { return (Date.now() - new Date(iso).getTime()) / 86400000; },

  /** BR-05 -- Verified + within the trailing aggregation window. */
  _qualifyingEntries(commodityId, districtId, grade, marketLevel, windowDays) {
    return Store.getEntries().filter(e =>
      e.commodity === commodityId && e.district === districtId &&
      e.qualityGrade === grade && e.marketLevel === marketLevel &&
      e.verificationStatus === "Verified" &&
      this._daysAgo(e.submittedDate) <= windowDays
    );
  },

  /** BR-07 -- exclude entries beyond 1.5x IQR from Q1-Q3, but never delete them. */
  _excludeOutliers(entries, multiplier) {
    if (entries.length < 4) return { kept: entries, excluded: [] };
    const sorted = [...entries].sort((a, b) => a.priceNormalizedPKg - b.priceNormalizedPKg);
    const q1 = this._quantile(sorted, 0.25);
    const q3 = this._quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const lo = q1 - multiplier * iqr, hi = q3 + multiplier * iqr;
    const eps = 1e-9;
    const kept = [], excluded = [];
    sorted.forEach(e => (e.priceNormalizedPKg >= lo - eps && e.priceNormalizedPKg <= hi + eps ? kept : excluded).push(e));
    return { kept, excluded };
  },

  _quantile(sortedArr, q) {
    const vals = sortedArr.map(e => e.priceNormalizedPKg);
    const pos = (vals.length - 1) * q;
    const base = Math.floor(pos), rest = pos - base;
    return vals[base + 1] !== undefined ? vals[base] + rest * (vals[base + 1] - vals[base]) : vals[base];
  },

  /** BR-08 -- reference price is always the median, never the mean. */
  _median(entries) {
    const vals = entries.map(e => e.priceNormalizedPKg).sort((a, b) => a - b);
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  },

  _distinctSubmitters(entries) { return new Set(entries.map(e => e.submitterId)).size; },

  /** BR-06 -- gate on 5 entries / 2 submitters, else widen the search (FR-09, A3). */
  _resolveBucket(commodityId, districtId, grade, marketLevel, params) {
    const own = this._qualifyingEntries(commodityId, districtId, grade, marketLevel, params.aggregationWindowDays);
    const ownFiltered = this._excludeOutliers(own, params.outlierIqrMultiplier);
    if (ownFiltered.kept.length >= params.minSampleSize &&
        this._distinctSubmitters(ownFiltered.kept) >= params.minSubmitters) {
      return { level: "district", district: districtId, ...ownFiltered, excludedAlways: ownFiltered.excluded };
    }

    // A3 step 1 -- widen to neighbouring districts within the same region
    const district = this.getDistrict(districtId);
    const neighbours = (REGIONS[district.region] || []).filter(d => d !== districtId);
    let pooled = [];
    neighbours.forEach(nd => { pooled = pooled.concat(this._qualifyingEntries(commodityId, nd, grade, marketLevel, params.aggregationWindowDays)); });
    const regionFiltered = this._excludeOutliers(pooled, params.outlierIqrMultiplier);
    if (regionFiltered.kept.length >= params.minSampleSize &&
        this._distinctSubmitters(regionFiltered.kept) >= params.minSubmitters) {
      return { level: "region", region: district.region, ...regionFiltered, excludedAlways: [...ownFiltered.excluded, ...regionFiltered.excluded] };
    }

    // A3 step 2 -- broader national bucket for the same commodity/grade/market level
    let national = [];
    DISTRICTS.forEach(d => { national = national.concat(this._qualifyingEntries(commodityId, d.id, grade, marketLevel, params.aggregationWindowDays)); });
    const nationalFiltered = this._excludeOutliers(national, params.outlierIqrMultiplier);
    if (nationalFiltered.kept.length >= params.minSampleSize &&
        this._distinctSubmitters(nationalFiltered.kept) >= params.minSubmitters) {
      return { level: "national", ...nationalFiltered, excludedAlways: [...ownFiltered.excluded, ...nationalFiltered.excluded] };
    }

    return { level: "none", kept: [], excluded: [], excludedAlways: ownFiltered.excluded };
  },

  /** FR-11 -- assign the fairness flag from percentage deviation below the median. */
  _classifyFairness(offered, median, params) {
    const deviationPct = ((offered - median) / median) * 100; // negative = below reference
    let flag;
    if (deviationPct >= -params.fairThresholdPct) flag = "Fair";
    else if (deviationPct >= -params.belowAverageThresholdPct) flag = "BelowAverage";
    else flag = "SignificantlyUnderpaid";
    return { deviationPct, flag };
  },

  /** FR-12 -- confidence from sample size, submitter diversity and recency. */
  _confidence(entries, fallbackUsed) {
    if (fallbackUsed) return "Low";
    const submitters = this._distinctSubmitters(entries);
    const recentAll = entries.every(e => this._daysAgo(e.submittedDate) <= 7);
    if (entries.length >= 10 && submitters >= 3 && recentAll) return "High";
    if (entries.length >= 5 && submitters >= 2) return "Medium";
    return "Low";
  },

  /** Admin support -- proactively flag statistical outliers across every bucket
   * (rather than only lazily, as a side-effect of a farmer's Check my offer). */
  scanAllOutliers() {
    const params = Store.getSystemParams();
    const entries = Store.getEntries().filter(e => e.verificationStatus === "Verified");
    const buckets = new Map();
    entries.forEach(e => {
      const key = `${e.commodity}|${e.district}|${e.qualityGrade}|${e.marketLevel}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(e);
    });
    buckets.forEach(bucketEntries => {
      const withinWindow = bucketEntries.filter(e => this._daysAgo(e.submittedDate) <= params.aggregationWindowDays);
      const { excluded } = this._excludeOutliers(withinWindow, params.outlierIqrMultiplier);
      excluded.forEach(ex => {
        if (!ex.outlierFlagged) Store.updateEntry(ex.id, { outlierFlagged: true });
      });
    });
  },

  /**
   * UC-01 -- Check Fair Price. Returns either an error (unsupported unit),
   * an insufficient-data result (A3, minimal guarantee: never fabricated),
   * or a full FairPriceCheckResult with disclaimer (BR-10).
   */
  checkFairPrice({ commodityId, districtId, grade, offeredAmount, offeredUnit }) {
    const params = Store.getSystemParams();
    const norm = this.normalizeToPKg(commodityId, offeredAmount, offeredUnit);
    if (!norm.ok) return { status: "unsupported_unit", supportedUnits: norm.supportedUnits };

    const ungraded = !grade;
    const effectiveGrade = grade || "B"; // BR-04

    const bucket = this._resolveBucket(commodityId, districtId, effectiveGrade, "FarmGate", params);

    // log outlier entries for admin review (BR-07) regardless of outcome
    bucket.excludedAlways.forEach(ex => {
      if (!ex._loggedOutlier) { Store.updateEntry(ex.id, { outlierFlagged: true }); ex._loggedOutlier = true; }
    });

    if (bucket.level === "none") {
      Store.addQueryLogRecord({
        commodity: commodityId, district: districtId, grade: effectiveGrade,
        flag: null, deviationPct: null, insufficient: true,
      });
      return { status: "insufficient_data", ungraded };
    }

    const median = this._median(bucket.kept);
    const { deviationPct, flag } = this._classifyFairness(norm.pricePerKg, median, params);
    const fallbackUsed = bucket.level !== "district";
    const confidence = this._confidence(bucket.kept, fallbackUsed);

    Store.addQueryLogRecord({
      commodity: commodityId, district: districtId, grade: effectiveGrade,
      flag, deviationPct: Number(deviationPct.toFixed(1)), insufficient: false,
    });

    return {
      status: "ok",
      ungraded,
      grade: effectiveGrade,
      offeredPricePKg: norm.pricePerKg,
      referencePricePKg: Number(median.toFixed(2)),
      deviationPct: Number(deviationPct.toFixed(1)),
      flag,
      confidence,
      fallbackUsed,
      fallbackLevel: bucket.level,
      sampleSize: bucket.kept.length,
      submitterCount: this._distinctSubmitters(bucket.kept),
      disclaimer: "This result is indicative guidance based on recent aggregated verified submissions -- not a guaranteed, audited, or binding price.",
    };
  },

  /** UC-03 -- Submit a price entry (Vendor / Cooperative Lead / Verified Buyer). FR-04, FR-05. */
  submitPriceEntry({ submitterId, submitterName, commodityId, districtId, grade, marketLevel, amount, unit }) {
    const params = Store.getSystemParams();
    const norm = this.normalizeToPKg(commodityId, amount, unit);
    if (!norm.ok) return { status: "unsupported_unit", supportedUnits: norm.supportedUnits };

    const ungradedFlag = !grade;
    const effectiveGrade = grade || "B"; // BR-04, never A or C by default

    const newEntry = {
      id: `entry-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      commodity: commodityId, district: districtId,
      qualityGrade: effectiveGrade, marketLevel,
      priceOriginal: amount, unitOriginal: unit,
      priceNormalizedPKg: Number(norm.pricePerKg.toFixed(2)),
      verificationStatus: "CommunityReported", // BR-01
      ungradedFlag,
      submitterId, submitterName,
      submittedDate: new Date().toISOString(),
    };

    // BR-02(b) -- auto-promote via peer corroboration: a second independent
    // submission for the same bucket within the corroboration window and tolerance.
    const candidates = Store.getEntries().filter(e =>
      e.commodity === commodityId && e.district === districtId &&
      e.qualityGrade === effectiveGrade && e.marketLevel === marketLevel &&
      e.submitterId !== submitterId &&
      this._daysAgo(e.submittedDate) * 24 <= params.corroborationWindowHours
    );
    const corroborator = candidates.find(c => {
      const pctDiff = Math.abs(c.priceNormalizedPKg - newEntry.priceNormalizedPKg) / newEntry.priceNormalizedPKg * 100;
      return pctDiff <= params.corroborationTolerancePct;
    });

    if (corroborator) {
      newEntry.verificationStatus = "Verified";
      if (corroborator.verificationStatus === "CommunityReported") {
        Store.updateEntry(corroborator.id, { verificationStatus: "Verified" });
      }
    }

    Store.addEntry(newEntry);
    return { status: "ok", entry: newEntry, corroborated: !!corroborator };
  },
};

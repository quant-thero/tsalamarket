/* ==========================================================================
   Tsala Market -- Mock / synthetic data
   All data below is SYNTHETIC and for demonstration only (Proposal S8).
   Real deployments would replace this with live BAMB feeds, registered
   buyer/vendor submissions, and a telecom USSD gateway.
   ========================================================================== */

const REGIONS = {
  south: ["kweneng", "kgatleng", "southern", "southeast"],
  north: ["central", "northeast", "ngamiland", "northwest"],
  west: ["kgalagadi", "ghanzi"],
};

const DISTRICTS = [
  { id: "kweneng", name: "Kweneng", region: "south" },
  { id: "kgatleng", name: "Kgatleng", region: "south" },
  { id: "southern", name: "Southern", region: "south" },
  { id: "southeast", name: "South East", region: "south" },
  { id: "central", name: "Central", region: "north" },
  { id: "northeast", name: "North East", region: "north" },
  { id: "ngamiland", name: "Ngamiland", region: "north" },
  { id: "northwest", name: "North West", region: "north" },
  { id: "kgalagadi", name: "Kgalagadi", region: "west" },
  { id: "ghanzi", name: "Ghanzi", region: "west" },
];

const COMMODITIES = [
  { id: "tomatoes", name: "Tomatoes", category: "Horticulture",
    units: [{ unit: "kg", factor: 1 }, { unit: "crate (20kg)", factor: 20 }, { unit: "heap", factor: 2 }] },
  { id: "cabbage", name: "Cabbage", category: "Horticulture",
    units: [{ unit: "kg", factor: 1 }, { unit: "head", factor: 1.5 }, { unit: "bag (25kg)", factor: 25 }] },
  { id: "onions", name: "Onions", category: "Horticulture",
    units: [{ unit: "kg", factor: 1 }, { unit: "bag (10kg)", factor: 10 }, { unit: "heap", factor: 2 }] },
  { id: "butternut", name: "Butternut", category: "Horticulture",
    units: [{ unit: "kg", factor: 1 }, { unit: "bag (15kg)", factor: 15 }, { unit: "heap", factor: 3 }] },
  { id: "rape", name: "Rape / leafy greens", category: "Horticulture",
    units: [{ unit: "kg", factor: 1 }, { unit: "bunch", factor: 0.5 }, { unit: "bag (10kg)", factor: 10 }] },
  { id: "maize", name: "Maize", category: "Grain",
    units: [{ unit: "kg", factor: 1 }, { unit: "50kg bag", factor: 50 }, { unit: "80kg bag", factor: 80 }] },
  { id: "sorghum", name: "Sorghum", category: "Grain",
    units: [{ unit: "kg", factor: 1 }, { unit: "80kg bag", factor: 80 }] },
  { id: "cattle", name: "Cattle", category: "Livestock",
    units: [{ unit: "kg liveweight", factor: 1 }, { unit: "head (~180kg est.)", factor: 180 }] },
  { id: "goat", name: "Goat", category: "Livestock",
    units: [{ unit: "kg liveweight", factor: 1 }, { unit: "head (~30kg est.)", factor: 30 }] },
];

const QUALITY_GRADES = ["A", "B", "C"];
const MARKET_LEVELS = ["FarmGate", "Wholesale", "Retail"];

const SUBMITTER_NAMES = [
  "Mmoloki Cooperative", "Tlokweng Vendor Group", "Kweneng Buyers Trust",
  "Palapye Grain Traders", "Maun Livestock Agents", "Serowe Market Vendors",
  "Gaborone Fresh Produce Co.", "Francistown Buyer Network", "Molepolole Coop Lead",
  "Ramotswa Vendor Circle",
];

/** Build a seeded price entry. daysAgo -> submittedDate; verified true/false. */
function entry(commodity, district, grade, marketLevel, pricePerKg, daysAgo, submitterIdx, status) {
  return {
    id: `seed-${commodity}-${district}-${grade}-${marketLevel}-${daysAgo}-${submitterIdx}-${Math.round(pricePerKg * 100)}`,
    commodity, district, qualityGrade: grade, marketLevel,
    priceOriginal: pricePerKg, unitOriginal: "kg",
    priceNormalizedPKg: pricePerKg,
    verificationStatus: status || "Verified",
    ungradedFlag: false,
    submitterId: `sub-${submitterIdx}`,
    submitterName: SUBMITTER_NAMES[submitterIdx % SUBMITTER_NAMES.length],
    submittedDate: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  };
}

/** Seed data engineered to match the project's own acceptance criteria (see docs/acceptance-criteria.md). */
function buildSeedEntries() {
  const e = [];

  // AC-01 / AC-02 -- Tomatoes, Grade B, Kweneng, FarmGate -> median 8.00 P/kg
  [ [7.60, 12, 0], [7.90, 9, 1], [8.00, 6, 2], [8.10, 4, 0], [8.40, 2, 1] ]
    .forEach(([p, d, s]) => e.push(entry("tomatoes", "kweneng", "B", "FarmGate", p, d, s)));

  // AC-06 -- Onions, Grade B, Central, FarmGate -> 12 entries, 4 submitters, all within 5 days -> High confidence
  const onionPrices = [5.2, 5.4, 5.1, 5.6, 5.3, 5.5, 5.0, 5.7, 5.4, 5.3, 5.2, 5.6];
  onionPrices.forEach((p, i) => e.push(entry("onions", "central", "B", "FarmGate", p, i % 5 + 1, i % 4)));

  // AC-03 -- Butternut, Grade A, Ngamiland, FarmGate -> only 3 entries, single submitter -> forces fallback
  [ [6.0, 10, 3], [6.2, 6, 3], [5.9, 3, 3] ]
    .forEach(([p, d, s]) => e.push(entry("butternut", "ngamiland", "A", "FarmGate", p, d, s)));
  // Fallback pool: neighbouring North-region districts DO have enough Butternut Grade A data
  [ [6.1, 14, 4], [6.3, 11, 5], [6.0, 8, 6], [5.8, 5, 4], [6.2, 2, 5] ]
    .forEach(([p, d, s]) => e.push(entry("butternut", "northwest", "A", "FarmGate", p, d, s)));

  // Cabbage, Grade B, Southern -> healthy bucket, includes one deliberate outlier (admin review queue demo)
  [ [3.1, 9, 0], [3.3, 7, 1], [3.0, 5, 2], [3.2, 3, 0], [3.4, 1, 1], [9.8, 2, 7] ]
    .forEach(([p, d, s]) => e.push(entry("cabbage", "southern", "B", "FarmGate", p, d, s)));

  // Maize, Grade B, Central -> grain bucket
  [ [3.8, 20, 0], [3.6, 15, 1], [3.9, 10, 2], [3.7, 5, 3], [3.85, 2, 0] ]
    .forEach(([p, d, s]) => e.push(entry("maize", "central", "B", "FarmGate", p, d, s)));

  // Sorghum, Grade B, North East
  [ [3.3, 18, 4], [3.5, 12, 5], [3.4, 6, 4], [3.6, 3, 6] ] // only 4 -> below threshold, no north-east neighbours seeded -> insufficient data demo
    .forEach(([p, d, s]) => e.push(entry("sorghum", "northeast", "B", "FarmGate", p, d, s)));

  // Cattle, Grade B, Ngamiland (kg liveweight reference)
  [ [22.0, 14, 3], [23.5, 9, 4], [21.5, 6, 5], [22.8, 3, 3], [23.0, 1, 4] ]
    .forEach(([p, d, s]) => e.push(entry("cattle", "ngamiland", "B", "FarmGate", p, d, s)));

  // Goat, Grade B, Kgalagadi
  [ [28.0, 16, 6], [29.5, 10, 7], [27.0, 7, 6], [28.5, 4, 8] ] // 4 entries -> Low/fallback demo
    .forEach(([p, d, s]) => e.push(entry("goat", "kgalagadi", "B", "FarmGate", p, d, s)));

  // A couple of Community-reported (unverified) entries, shown on trend view but excluded from Fair Price Check
  e.push(entry("tomatoes", "kweneng", "B", "FarmGate", 12.5, 1, 9, "CommunityReported"));
  e.push(entry("onions", "central", "B", "FarmGate", 4.0, 1, 9, "CommunityReported"));

  return e;
}

const DEFAULT_SYSTEM_PARAMS = {
  aggregationWindowDays: 30,
  corroborationWindowHours: 72,
  corroborationTolerancePct: 15,
  minSampleSize: 5,
  minSubmitters: 2,
  outlierIqrMultiplier: 1.5,
  fairThresholdPct: 10,
  belowAverageThresholdPct: 25,
};

const SEED_ENTRIES = buildSeedEntries();

/** Pre-seeded anonymised Fair Price Check query history, so the Extension
 * Officer dashboard has realistic content before anyone runs a live check. */
function buildSeedQueryLog() {
  const combos = [
    ["tomatoes", "kweneng", "B", "Fair", 3.2],
    ["tomatoes", "kweneng", "B", "BelowAverage", -14.5],
    ["tomatoes", "southeast", "B", "SignificantlyUnderpaid", -31.0],
    ["onions", "central", "B", "Fair", 1.8],
    ["onions", "central", "B", "Fair", -4.1],
    ["onions", "northeast", "B", "BelowAverage", -18.2],
    ["butternut", "ngamiland", "A", "SignificantlyUnderpaid", -28.6],
    ["butternut", "northwest", "A", "Fair", 5.0],
    ["cabbage", "southern", "B", "BelowAverage", -12.4],
    ["cabbage", "southern", "B", "Fair", 0.5],
    ["maize", "central", "B", "Fair", 2.1],
    ["maize", "kgatleng", "B", "SignificantlyUnderpaid", -33.7],
    ["sorghum", "northeast", "B", "BelowAverage", -16.0],
    ["cattle", "ngamiland", "B", "Fair", -2.0],
    ["goat", "kgalagadi", "B", "BelowAverage", -19.9],
    ["tomatoes", "ghanzi", "C", "SignificantlyUnderpaid", -40.2],
    ["onions", "kweneng", "B", "Fair", 4.4],
    ["cabbage", "kgatleng", "B", "BelowAverage", -13.1],
  ];
  return combos.map(([commodity, district, grade, flag, deviationPct], i) => ({
    commodity, district, grade, flag, deviationPct, insufficient: false,
    timestamp: new Date(Date.now() - (i % 14 + 1) * 86400000).toISOString(),
  }));
}

const SEED_QUERY_LOG = buildSeedQueryLog();


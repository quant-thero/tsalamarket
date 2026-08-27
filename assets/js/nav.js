/* Shared top navigation, injected into #app-nav on every page. */
function renderNav(base, active) {
  const links = [
    { href: `${base}index.html`, key: "home", label: "Home" },
    { href: `${base}pages/check-price.html`, key: "check", label: "Check my offer" },
    { href: `${base}pages/dashboard.html`, key: "dashboard", label: "Price trends" },
    { href: `${base}pages/submit-entry.html`, key: "submit", label: "Submit a price" },
    { href: `${base}pages/extension-officer.html`, key: "extension", label: "Extension officer" },
    { href: `${base}pages/admin.html`, key: "admin", label: "Admin" },
    { href: `${base}pages/ussd-simulator.html`, key: "ussd", label: "USSD demo" },
  ];

  const linkHtml = links.map(l =>
    `<a href="${l.href}" class="${l.key === active ? "active" : ""}">${l.label}</a>`
  ).join("");

  document.getElementById("app-nav").innerHTML = `
    <div class="mock-banner">Demo build -- all prices, accounts and reports shown are synthetic data</div>
    <div class="topbar">
      <div class="topbar-inner">
        <a href="${base}index.html" class="brand">
          <span class="brand-mark">TM</span>
          Tsala Market
        </a>
        <div class="nav-links" id="nav-links">${linkHtml}</div>
        <button class="btn btn-outline btn-sm nav-toggle" id="nav-toggle" aria-label="Toggle navigation">Menu</button>
      </div>
    </div>
  `;

  const toggle = document.getElementById("nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => document.getElementById("nav-links").classList.toggle("open"));
  }
}

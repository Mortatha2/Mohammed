import { useState, useEffect, useRef } from "react";

/* ----------------------------------------------------------------------------
   A&A QUALITY AUTO — Sales & Service · Arlington, TX
   Performance-house build:
   - Animated entrance + mouse-parallax hero, ambient beams + grain
   - Infinite marquee, count-up instrument gauges, chrome headlines
   - Featured-vehicle spotlight, scroll-reveal everywhere
   - Full inventory CRUD, owner mode (passcode), persistent via window.storage
---------------------------------------------------------------------------- */

const INV_PREFIX = "inventory:";
const SETTINGS_KEY = "config:site";

const DEFAULT_SETTINGS = {
  phone: "817-633-5000",
  address: "2925 E Abram St, Arlington, TX 76010",
  hours: "Open 7 days a week · 8:00 AM – 7:00 PM",
  passcode: "aa2925",
  heroImage: "",
  heroHeadline: "Built to drive.\nKept on the road.",
};

const hasStorage = () =>
  typeof window !== "undefined" &&
  window.storage &&
  typeof window.storage.get === "function";

const money = (n) => {
  const v = Number(n);
  if (!v || isNaN(v)) return "Call for price";
  return "$" + v.toLocaleString("en-US");
};
const miles = (n) => {
  const v = Number(n);
  if (!v || isNaN(v)) return "—";
  return v.toLocaleString("en-US") + " mi";
};
const telHref = (p) => "tel:+1" + (p || "").replace(/[^0-9]/g, "");
const mapHref = (a) => "https://maps.google.com/?q=" + encodeURIComponent(a || "");
const newId = () => "car_" + Date.now() + Math.random().toString(36).slice(2, 7);

const STATUS = {
  available: { label: "Available", dot: "av" },
  pending: { label: "Sale Pending", dot: "pe" },
  sold: { label: "Sold", dot: "so" },
};

const EMPTY_FORM = {
  id: null, year: "", make: "", model: "", trim: "", price: "", mileage: "",
  transmission: "", drivetrain: "", fuel: "", exterior: "", interior: "", vin: "",
  status: "available", featured: false, description: "", images: [],
};

function compressImage(file, maxDim = 1100, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width); width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height); height = maxDim;
        }
        const c = document.createElement("canvas");
        c.width = width; c.height = height;
        c.getContext("2d").drawImage(img, 0, 0, width, height);
        try { resolve(c.toDataURL("image/jpeg", quality)); } catch (err) { reject(err); }
      };
      img.onerror = reject; img.src = e.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

/* ---- scroll reveal ---- */
function useReveal(deps) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const els = Array.from(document.querySelectorAll("[data-reveal]:not(.in)"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, deps);
}

/* ---- count up ---- */
function CountUp({ to, dur = 1500, decimals = 0, suffix = "", prefix = "" }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const run = () => {
      if (done.current) return;
      done.current = true;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        setVal(to * e);
        if (p < 1) requestAnimationFrame(tick);
        else setVal(to);
      };
      requestAnimationFrame(tick);
    };
    if (!("IntersectionObserver" in window)) { run(); return; }
    const io = new IntersectionObserver(
      (es) => es.forEach((en) => en.isIntersecting && run()),
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  const shown = decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString();
  return <span ref={ref}>{prefix}{shown}{suffix}</span>;
}

const CarIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M8 40v6a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2h32v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-6"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M8 40l3-12a5 5 0 0 1 4.7-3.4h32.6A5 5 0 0 1 53 28l3 12M8 40h48"
      stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <circle cx="19" cy="40" r="4" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="45" cy="40" r="4" stroke="currentColor" strokeWidth="2.5" />
  </svg>
);

const Slashes = ({ n = 2 }) => (
  <span className="aa-slashes" aria-hidden="true">
    {Array.from({ length: n }).map((_, i) => <span key={i} />)}
  </span>
);

const Logo = () => (
  <span className="aa-logo">
    <span className="aa-logo-text">A&amp;A</span>
    <Slashes />
  </span>
);

const MARQUEE = [
  "Quality Used Cars", "Full-Service Shop", "Body & Collision", "New & Used Tires",
  "Brakes & Alignment", "Oil & Maintenance", "Financing Available", "Trade-Ins Welcome",
];
const Marquee = () => (
  <div className="aa-marquee" aria-hidden="true">
    <div className="aa-marquee-track">
      {[...MARQUEE, ...MARQUEE].map((m, i) => (
        <span className="aa-mItem" key={i}>
          {m}
          <span className="aa-mSlash" />
        </span>
      ))}
    </div>
  </div>
);

export default function App() {
  const [cars, setCars] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [storageOn, setStorageOn] = useState(true);

  const [owner, setOwner] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [imgUrl, setImgUrl] = useState("");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftSettings, setDraftSettings] = useState(DEFAULT_SETTINGS);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("featured");
  const [toast, setToast] = useState("");
  const [scrolled, setScrolled] = useState(false);

  const fileRef = useRef(null);
  const heroFileRef = useRef(null);
  const heroRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!hasStorage()) { setStorageOn(false); setLoading(false); return; }
      try {
        try {
          const r = await window.storage.get(SETTINGS_KEY, true);
          if (active && r && r.value) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(r.value) });
        } catch (e) {}
        let keys = [];
        try {
          const list = await window.storage.list(INV_PREFIX, true);
          keys = (list && list.keys ? list.keys : []).map((k) =>
            typeof k === "string" ? k : k.key || k.name);
        } catch (e) {}
        const results = await Promise.allSettled(keys.map((k) => window.storage.get(k, true)));
        const loaded = [];
        for (const res of results) {
          if (res.status === "fulfilled" && res.value && res.value.value) {
            try { loaded.push(JSON.parse(res.value.value)); } catch (e) {}
          }
        }
        if (active) setCars(loaded);
      } catch (e) { if (active) setStorageOn(false); }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { setScrolled(window.scrollY > 40); ticking = false; });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const visibleKey = `${loading}-${cars.length}-${search}-${statusFilter}-${sort}-${owner}`;
  useReveal([visibleKey]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  function onHeroMove(e) {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.setProperty("--mx", x.toFixed(3));
      el.style.setProperty("--my", y.toFixed(3));
    });
  }
  function onHeroLeave() {
    const el = heroRef.current;
    if (!el) return;
    el.style.setProperty("--mx", "0");
    el.style.setProperty("--my", "0");
  }

  async function persistCar(car) {
    if (hasStorage()) {
      try { await window.storage.set(INV_PREFIX + car.id, JSON.stringify(car), true); }
      catch (e) { flash("Couldn't save to storage — kept for this session only."); }
    }
  }
  async function saveCar() {
    if (!form.make.trim() || !form.model.trim()) { flash("Please add at least a make and model."); return; }
    setBusy(true);
    const car = { ...form, id: form.id || newId(), createdAt: form.createdAt || Date.now(), updatedAt: Date.now() };
    await persistCar(car);
    setCars((prev) => {
      const i = prev.findIndex((c) => c.id === car.id);
      if (i === -1) return [car, ...prev];
      const copy = [...prev]; copy[i] = car; return copy;
    });
    setBusy(false); setFormOpen(false); setForm(EMPTY_FORM);
    flash(form.id ? "Listing updated." : "Vehicle added.");
  }
  async function removeCar(id) {
    if (!window.confirm("Remove this vehicle from your inventory? This can't be undone.")) return;
    if (hasStorage()) { try { await window.storage.delete(INV_PREFIX + id, true); } catch (e) {} }
    setCars((prev) => prev.filter((c) => c.id !== id));
    flash("Listing removed.");
  }
  function openAdd() { setForm(EMPTY_FORM); setImgUrl(""); setFormOpen(true); }
  function openEdit(car) { setForm({ ...EMPTY_FORM, ...car }); setImgUrl(""); setFormOpen(true); }

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const room = 8 - form.images.length;
    if (room <= 0) { flash("Up to 8 photos per vehicle."); return; }
    const out = [];
    for (const f of files.slice(0, room)) { try { out.push(await compressImage(f)); } catch (err) {} }
    setForm((f) => ({ ...f, images: [...f.images, ...out] }));
    if (fileRef.current) fileRef.current.value = "";
  }
  function addImgUrl() {
    const u = imgUrl.trim();
    if (!u) return;
    if (form.images.length >= 8) { flash("Up to 8 photos per vehicle."); return; }
    setForm((f) => ({ ...f, images: [...f.images, u] })); setImgUrl("");
  }
  function removeImg(idx) { setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) })); }

  async function onHeroFile(e) {
    const f = (e.target.files || [])[0];
    if (!f) return;
    try { const data = await compressImage(f, 1700, 0.78); setDraftSettings((s) => ({ ...s, heroImage: data })); } catch (err) {}
    if (heroFileRef.current) heroFileRef.current.value = "";
  }

  function tryAuth() {
    if (authInput === (settings.passcode || DEFAULT_SETTINGS.passcode)) {
      setOwner(true); setAuthOpen(false); setAuthInput(""); setAuthError("");
      flash("Owner mode on. You can now manage your site.");
    } else setAuthError("That passcode didn't match.");
  }
  async function saveSettings() {
    setSettings(draftSettings);
    if (hasStorage()) { try { await window.storage.set(SETTINGS_KEY, JSON.stringify(draftSettings), true); } catch (e) {} }
    setSettingsOpen(false); flash("Site info updated.");
  }

  function pickModel(car) {
    setSearch([car.make, car.model].filter(Boolean).join(" "));
    setStatusFilter("all");
    const el = document.getElementById("inventory");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  const visible = cars
    .filter((c) => statusFilter === "all" || c.status === statusFilter)
    .filter((c) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [c.year, c.make, c.model, c.trim, c.description].filter(Boolean).join(" ").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === "priceLow") return (a.price || 1e12) - (b.price || 1e12);
      if (sort === "priceHigh") return (b.price || 0) - (a.price || 0);
      if (sort === "mileageLow") return (a.mileage || 1e12) - (b.mileage || 1e12);
      if (sort === "newest") return (b.createdAt || 0) - (a.createdAt || 0);
      if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  const availableCount = cars.filter((c) => c.status === "available").length;
  const lineup = (availableCount ? cars.filter((c) => c.status === "available") : cars).slice(0, 10);
  const spotlight =
    cars.find((c) => c.featured && c.status !== "sold") ||
    cars.find((c) => c.status === "available") ||
    cars[0] ||
    null;
  const heroLines = (settings.heroHeadline || DEFAULT_SETTINGS.heroHeadline).split("\n");

  return (
    <div className="aa-root">
      <style>{CSS}</style>
      <div className="aa-grain" aria-hidden="true" />

      {/* ===== Header ===== */}
      <header className={"aa-header" + (scrolled ? " scrolled" : "")}>
        <div className="aa-wrap aa-headrow">
          <a href="#top" className="aa-brand">
            <Logo />
            <span className="aa-brand-sub">Quality Auto · Sales &amp; Service</span>
          </a>
          <nav className="aa-nav">
            <a href="#inventory">Inventory</a>
            <a href="#lineup">Lineup</a>
            <a href="#services">Service</a>
            <a href="#visit">Find Us</a>
          </nav>
          <a className="aa-callbtn" href={telHref(settings.phone)}>
            <PhoneGlyph /><span>{settings.phone}</span>
          </a>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section
        className="aa-hero"
        id="top"
        ref={heroRef}
        onMouseMove={onHeroMove}
        onMouseLeave={onHeroLeave}
      >
        <div
          className={"aa-hero-bg" + (settings.heroImage ? "" : " empty")}
          style={settings.heroImage ? { backgroundImage: `url(${settings.heroImage})` } : {}}
        />
        <div className="aa-hero-scrim" aria-hidden="true" />
        <div className="aa-beam b1" aria-hidden="true" />
        <div className="aa-beam b2" aria-hidden="true" />
        <span className="aa-shard s1" aria-hidden="true" />
        <span className="aa-shard s2" aria-hidden="true" />
        <span className="aa-shard s3" aria-hidden="true" />

        <div className="aa-wrap aa-hero-wrap">
          <div className="aa-hero-content">
            <span className="aa-eyebrow hero-eb">
              <span className="aa-live" /> Arlington, Texas · Family-owned
            </span>
            <h1 className="aa-h1">
              {heroLines.map((l, i) => (
                <span key={i} className={"aa-h1-line " + (i === heroLines.length - 1 ? "accent" : "chrome")}>
                  {l}
                </span>
              ))}
            </h1>
            <p className="aa-lead">
              Inspected pre-owned vehicles and a full-service shop under one roof — sales,
              body work, tires, brakes, and routine repair, done right.
            </p>
            <div className="aa-hero-cta">
              <a href="#inventory" className="aa-btn aa-btn-red">Browse inventory</a>
              <a href="#services" className="aa-btn aa-btn-glass">Our service shop</a>
            </div>

            <div className="aa-gauges">
              <div className="aa-gauge">
                <span className="aa-gauge-n"><CountUp to={availableCount} /></span>
                <span className="aa-gauge-l">In stock</span>
              </div>
              <div className="aa-gauge">
                <span className="aa-gauge-n"><CountUp to={4.2} decimals={1} suffix="★" /></span>
                <span className="aa-gauge-l">52 reviews</span>
              </div>
              <div className="aa-gauge">
                <span className="aa-gauge-n"><CountUp to={7} /></span>
                <span className="aa-gauge-l">Days open</span>
              </div>
            </div>
          </div>
        </div>

        <a href="#lineup" className="aa-scrollcue" aria-label="Scroll down">
          <span />
        </a>
      </section>

      {/* ===== Marquee ===== */}
      <Marquee />

      {/* ===== Featured spotlight ===== */}
      {spotlight && (
        <section className="aa-spotlight" data-reveal>
          <div className="aa-spot-num" aria-hidden="true">A&amp;A</div>
          <div className="aa-wrap aa-spot-grid">
            <div className="aa-spot-media">
              {spotlight.images && spotlight.images[0] ? (
                <img src={spotlight.images[0]} alt="" />
              ) : (
                <div className="aa-spot-noimg"><CarIcon size={90} /></div>
              )}
              <span className="aa-spot-flag">Featured</span>
            </div>
            <div className="aa-spot-info">
              <span className="aa-eyebrow"><Slashes /> Spotlight of the week</span>
              <h2 className="aa-spot-title">
                {[spotlight.year, spotlight.make, spotlight.model].filter(Boolean).join(" ")}
              </h2>
              {spotlight.trim && <p className="aa-spot-trim">{spotlight.trim}</p>}
              <div className="aa-spot-price">{money(spotlight.price)}</div>
              <div className="aa-spot-specs">
                <SpecBig k="Odometer" v={miles(spotlight.mileage)} />
                <SpecBig k="Drivetrain" v={spotlight.drivetrain || "—"} />
                <SpecBig k="Transmission" v={spotlight.transmission || "—"} />
                <SpecBig k="Fuel" v={spotlight.fuel || "—"} />
              </div>
              {spotlight.description && <p className="aa-spot-desc">{spotlight.description}</p>}
              <div className="aa-hero-cta">
                <a href={telHref(settings.phone)} className="aa-btn aa-btn-red">Ask about this vehicle</a>
                <a href="#inventory" className="aa-btn aa-btn-outline-light">See all inventory</a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== Lineup strip ===== */}
      {lineup.length > 0 && (
        <section className="aa-lineup" id="lineup">
          <div className="aa-wrap">
            <div className="aa-sec-head" data-reveal>
              <div>
                <span className="aa-eyebrow dark"><Slashes /> The lineup</span>
                <h2 className="aa-h2">On the lot now</h2>
              </div>
            </div>
            <div className="aa-lineup-row" data-reveal>
              {lineup.map((car) => (
                <button key={car.id} className="aa-lineup-item" onClick={() => pickModel(car)}>
                  <div className="aa-lineup-img">
                    {car.images && car.images[0] ? <img src={car.images[0]} alt="" loading="lazy" /> : <CarIcon size={46} />}
                  </div>
                  <span className="aa-lineup-name">{[car.make, car.model].filter(Boolean).join(" ") || "Vehicle"}</span>
                  <span className="aa-lineup-sub">{[car.year, money(car.price)].filter(Boolean).join(" · ")}</span>
                  <span className="aa-lineup-go">View →</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== Inventory ===== */}
      <section className="aa-section aa-inventory" id="inventory">
        <div className="aa-wrap">
          <div className="aa-sec-head" data-reveal>
            <div>
              <span className="aa-eyebrow dark"><Slashes /> Inventory</span>
              <h2 className="aa-h2">Find your next vehicle</h2>
            </div>
            {owner && <button className="aa-btn aa-btn-red aa-add" onClick={openAdd}>+ Add a vehicle</button>}
          </div>

          <div className="aa-controls" data-reveal>
            <input className="aa-search" placeholder="Search make, model, year…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="aa-chips">
              {[["all", "All"], ["available", "Available"], ["pending", "Pending"], ["sold", "Sold"]].map(([k, l]) => (
                <button key={k} className={"aa-chip" + (statusFilter === k ? " on" : "")} onClick={() => setStatusFilter(k)}>{l}</button>
              ))}
            </div>
            <select className="aa-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="featured">Featured first</option>
              <option value="newest">Newest</option>
              <option value="priceLow">Price: low to high</option>
              <option value="priceHigh">Price: high to low</option>
              <option value="mileageLow">Lowest mileage</option>
            </select>
          </div>

          {loading ? (
            <div className="aa-empty">Loading inventory…</div>
          ) : visible.length === 0 ? (
            <div className="aa-empty" data-reveal>
              {cars.length === 0 ? (
                <>
                  <CarIcon size={56} />
                  <p>No vehicles listed yet</p>
                  {owner ? (
                    <button className="aa-btn aa-btn-red" onClick={openAdd}>+ Add your first vehicle</button>
                  ) : (
                    <span className="aa-empty-sub">New arrivals every week. Call {settings.phone} for what's coming in.</span>
                  )}
                </>
              ) : (<p>No vehicles match those filters</p>)}
            </div>
          ) : (
            <div className="aa-grid">
              {visible.map((car, i) => (
                <CarCard
                  key={car.id}
                  car={car}
                  owner={owner}
                  phone={settings.phone}
                  index={i}
                  onEdit={() => openEdit(car)}
                  onDelete={() => removeCar(car.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== Services ===== */}
      <section className="aa-section aa-services" id="services">
        <div className="aa-services-slash" aria-hidden="true" />
        <div className="aa-grid-lines" aria-hidden="true" />
        <div className="aa-wrap">
          <div data-reveal>
            <span className="aa-eyebrow"><Slashes /> In the shop</span>
            <h2 className="aa-h2 chrome">More than a lot</h2>
            <p className="aa-services-lead">
              We don't just sell vehicles — we keep them running. Straight estimates, quality
              parts, and technicians who treat your vehicle like their own.
            </p>
          </div>
          <div className="aa-svc-grid">
            {SERVICES.map((s, i) => (
              <div className="aa-svc" key={i} data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="aa-svc-ico">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <span className="aa-svc-edge" aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="aa-svc-cta" data-reveal>
            <span>Need an estimate or a repair scheduled?</span>
            <a href={telHref(settings.phone)} className="aa-btn aa-btn-red">Call the shop · {settings.phone}</a>
          </div>
        </div>
      </section>

      {/* ===== Trust band ===== */}
      <section className="aa-trust">
        <div className="aa-wrap aa-trust-grid">
          <div className="aa-trust-item" data-reveal>
            <span className="aa-trust-n"><CountUp to={4.2} decimals={1} /></span>
            <span className="aa-trust-l">Star rating</span>
          </div>
          <div className="aa-trust-item" data-reveal style={{ transitionDelay: "80ms" }}>
            <span className="aa-trust-n"><CountUp to={52} suffix="+" /></span>
            <span className="aa-trust-l">Happy reviewers</span>
          </div>
          <div className="aa-trust-item" data-reveal style={{ transitionDelay: "160ms" }}>
            <span className="aa-trust-n">7</span>
            <span className="aa-trust-l">Days a week</span>
          </div>
          <div className="aa-trust-item" data-reveal style={{ transitionDelay: "240ms" }}>
            <span className="aa-trust-n">1</span>
            <span className="aa-trust-l">Family, one roof</span>
          </div>
        </div>
      </section>

      {/* ===== Visit ===== */}
      <section className="aa-section aa-visit" id="visit">
        <div className="aa-wrap aa-visit-grid">
          <div data-reveal>
            <span className="aa-eyebrow dark"><Slashes /> Come see us</span>
            <h2 className="aa-h2">Visit the lot</h2>
            <ul className="aa-info">
              <li><span className="aa-info-k">Address</span>
                <a href={mapHref(settings.address)} target="_blank" rel="noreferrer">{settings.address}</a></li>
              <li><span className="aa-info-k">Phone</span>
                <a href={telHref(settings.phone)}>{settings.phone}</a></li>
              <li><span className="aa-info-k">Hours</span><span>{settings.hours}</span></li>
            </ul>
            <div className="aa-hero-cta">
              <a href={mapHref(settings.address)} target="_blank" rel="noreferrer" className="aa-btn aa-btn-red">Get directions</a>
              <a href={telHref(settings.phone)} className="aa-btn aa-btn-outline">Call us</a>
            </div>
          </div>
          <div className="aa-visit-card" data-reveal>
            <Logo />
            <p>Buying or repairing, you deal with the same family every time. We keep it straight,
              keep it fair, and stand behind every vehicle we sell.</p>
            <div className="aa-visit-tags">
              <span>Financing available</span><span>Trade-ins welcome</span><span>Full-service shop</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="aa-footer">
        <div className="aa-foot-bigtext" aria-hidden="true">A&amp;A QUALITY AUTO</div>
        <div className="aa-wrap aa-footrow">
          <div>
            <Logo />
            <p className="aa-foot-sub">{settings.address}</p>
            <p className="aa-foot-sub">{settings.phone}</p>
            <p className="aa-foot-sub">{settings.hours}</p>
          </div>
          <div className="aa-foot-actions">
            {!owner ? (
              <button className="aa-owner-link" onClick={() => setAuthOpen(true)}>Owner sign-in</button>
            ) : (
              <div className="aa-owner-tools">
                <span className="aa-owner-on">● Owner mode</span>
                <button className="aa-owner-link" onClick={() => { setDraftSettings(settings); setSettingsOpen(true); }}>Site info</button>
                <button className="aa-owner-link" onClick={() => setOwner(false)}>Sign out</button>
              </div>
            )}
            <span className="aa-foot-copy">© {new Date().getFullYear()} A&amp;A Quality Auto. All rights reserved.</span>
          </div>
        </div>
        {!storageOn && (
          <div className="aa-wrap aa-storage-note">
            Heads up: saved storage isn't available in this preview, so changes won't persist between sessions here. Once published, they will.
          </div>
        )}
      </footer>

      {/* ===== Modals ===== */}
      {authOpen && (
        <Modal onClose={() => setAuthOpen(false)} title="Owner sign-in">
          <p className="aa-modal-sub">Enter your passcode to manage inventory and site info.</p>
          <input className="aa-field" type="password" placeholder="Passcode" value={authInput} autoFocus
            onChange={(e) => { setAuthInput(e.target.value); setAuthError(""); }}
            onKeyDown={(e) => e.key === "Enter" && tryAuth()} />
          {authError && <div className="aa-err">{authError}</div>}
          <div className="aa-modal-foot">
            <button className="aa-btn aa-btn-outline" onClick={() => setAuthOpen(false)}>Cancel</button>
            <button className="aa-btn aa-btn-red" onClick={tryAuth}>Sign in</button>
          </div>
        </Modal>
      )}

      {settingsOpen && (
        <Modal onClose={() => setSettingsOpen(false)} title="Site info">
          <label className="aa-lab">Hero headline (two lines)</label>
          <textarea className="aa-field aa-textarea" rows={2} value={draftSettings.heroHeadline}
            onChange={(e) => setDraftSettings({ ...draftSettings, heroHeadline: e.target.value })} />
          <label className="aa-lab">Hero photo</label>
          <div className="aa-hero-upload">
            <button className="aa-btn aa-btn-dark sm" onClick={() => heroFileRef.current && heroFileRef.current.click()}>
              {draftSettings.heroImage ? "Replace photo" : "Upload photo"}
            </button>
            <input ref={heroFileRef} type="file" accept="image/*" hidden onChange={onHeroFile} />
            {draftSettings.heroImage && (
              <button className="aa-btn aa-btn-outline sm" onClick={() => setDraftSettings({ ...draftSettings, heroImage: "" })}>Remove</button>
            )}
          </div>
          {draftSettings.heroImage && <div className="aa-hero-preview"><img src={draftSettings.heroImage} alt="" /></div>}
          <label className="aa-lab">Phone</label>
          <input className="aa-field" value={draftSettings.phone} onChange={(e) => setDraftSettings({ ...draftSettings, phone: e.target.value })} />
          <label className="aa-lab">Address</label>
          <input className="aa-field" value={draftSettings.address} onChange={(e) => setDraftSettings({ ...draftSettings, address: e.target.value })} />
          <label className="aa-lab">Hours</label>
          <input className="aa-field" value={draftSettings.hours} onChange={(e) => setDraftSettings({ ...draftSettings, hours: e.target.value })} />
          <label className="aa-lab">Owner passcode</label>
          <input className="aa-field" value={draftSettings.passcode} onChange={(e) => setDraftSettings({ ...draftSettings, passcode: e.target.value })} />
          <div className="aa-modal-foot">
            <button className="aa-btn aa-btn-outline" onClick={() => setSettingsOpen(false)}>Cancel</button>
            <button className="aa-btn aa-btn-red" onClick={saveSettings}>Save</button>
          </div>
        </Modal>
      )}

      {formOpen && (
        <Modal wide onClose={() => setFormOpen(false)} title={form.id ? "Edit listing" : "Add a vehicle"}>
          <div className="aa-form-grid">
            <Field label="Year"><input className="aa-field" value={form.year} inputMode="numeric" onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
            <Field label="Make *"><input className="aa-field" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></Field>
            <Field label="Model *"><input className="aa-field" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
            <Field label="Trim"><input className="aa-field" value={form.trim} onChange={(e) => setForm({ ...form, trim: e.target.value })} /></Field>
            <Field label="Price ($)"><input className="aa-field" value={form.price} inputMode="numeric" onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Mileage"><input className="aa-field" value={form.mileage} inputMode="numeric" onChange={(e) => setForm({ ...form, mileage: e.target.value })} /></Field>
            <Field label="Transmission"><input className="aa-field" value={form.transmission} placeholder="Automatic / Manual" onChange={(e) => setForm({ ...form, transmission: e.target.value })} /></Field>
            <Field label="Drivetrain"><input className="aa-field" value={form.drivetrain} placeholder="FWD / AWD / 4x4" onChange={(e) => setForm({ ...form, drivetrain: e.target.value })} /></Field>
            <Field label="Fuel"><input className="aa-field" value={form.fuel} placeholder="Gas / Diesel / Hybrid" onChange={(e) => setForm({ ...form, fuel: e.target.value })} /></Field>
            <Field label="Exterior color"><input className="aa-field" value={form.exterior} onChange={(e) => setForm({ ...form, exterior: e.target.value })} /></Field>
            <Field label="Interior color"><input className="aa-field" value={form.interior} onChange={(e) => setForm({ ...form, interior: e.target.value })} /></Field>
            <Field label="VIN (optional)"><input className="aa-field" value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} /></Field>
            <Field label="Status">
              <select className="aa-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="available">Available</option><option value="pending">Sale Pending</option><option value="sold">Sold</option>
              </select>
            </Field>
            <Field label="Featured">
              <label className="aa-toggle">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                <span>Pin to top, spotlight &amp; lineup</span>
              </label>
            </Field>
          </div>
          <Field label="Description" full>
            <textarea className="aa-field aa-textarea" rows={3} value={form.description}
              placeholder="Condition, options, recent service, financing notes…"
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <label className="aa-lab">Photos (up to 8)</label>
          <div className="aa-photo-tools">
            <button className="aa-btn aa-btn-dark sm" onClick={() => fileRef.current && fileRef.current.click()}>Upload photos</button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
            <div className="aa-url-add">
              <input className="aa-field sm" placeholder="…or paste an image URL" value={imgUrl}
                onChange={(e) => setImgUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImgUrl())} />
              <button className="aa-btn aa-btn-outline sm" onClick={addImgUrl}>Add</button>
            </div>
          </div>
          {form.images.length > 0 && (
            <div className="aa-thumbs">
              {form.images.map((src, i) => (
                <div className="aa-thumb" key={i}>
                  <img src={src} alt="" />
                  <button onClick={() => removeImg(i)} aria-label="Remove photo">×</button>
                  {i === 0 && <span className="aa-thumb-main">Cover</span>}
                </div>
              ))}
            </div>
          )}
          <div className="aa-modal-foot">
            <button className="aa-btn aa-btn-outline" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="aa-btn aa-btn-red" disabled={busy} onClick={saveCar}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add vehicle"}
            </button>
          </div>
        </Modal>
      )}

      {toast && <div className="aa-toast">{toast}</div>}
    </div>
  );
}

function CarCard({ car, owner, phone, index, onEdit, onDelete }) {
  const [idx, setIdx] = useState(0);
  const imgs = car.images && car.images.length ? car.images : [];
  const st = STATUS[car.status] || STATUS.available;
  const title = [car.year, car.make, car.model].filter(Boolean).join(" ");
  return (
    <article className={"aa-card" + (car.featured ? " feat" : "")} data-reveal style={{ transitionDelay: `${(index % 3) * 70}ms` }}>
      <div className="aa-card-media">
        {imgs.length ? (
          <>
            <img src={imgs[idx]} alt={title} loading="lazy" />
            {imgs.length > 1 && (
              <div className="aa-dots">
                {imgs.map((_, i) => (
                  <button key={i} className={"aa-dot" + (i === idx ? " on" : "")} onClick={() => setIdx(i)} aria-label={"Photo " + (i + 1)} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="aa-noimg"><CarIcon size={52} /><span>Photo coming soon</span></div>
        )}
        <span className={"aa-badge " + st.dot}><i />{st.label}</span>
        {car.featured && <span className="aa-feat-tag">Featured</span>}
      </div>
      <div className="aa-card-body">
        <h3 className="aa-car-title">{title || "Vehicle"}</h3>
        {car.trim && <p className="aa-car-trim">{car.trim}</p>}
        <div className="aa-price">{money(car.price)}</div>
        <div className="aa-specs">
          <Spec k="Odometer" v={miles(car.mileage)} />
          <Spec k="Trans" v={car.transmission || "—"} />
          <Spec k="Drive" v={car.drivetrain || "—"} />
          <Spec k="Fuel" v={car.fuel || "—"} />
        </div>
        {(car.exterior || car.interior) && (
          <p className="aa-colors">
            {car.exterior && <span>{car.exterior} exterior</span>}
            {car.exterior && car.interior && <span className="aa-dot-sep">·</span>}
            {car.interior && <span>{car.interior} interior</span>}
          </p>
        )}
        {car.description && <p className="aa-desc">{car.description}</p>}
        <div className="aa-card-foot">
          <a className="aa-btn aa-btn-red sm" href={telHref(phone)}>Ask about this</a>
          {owner && (
            <div className="aa-card-owner">
              <button className="aa-icobtn" onClick={onEdit}>Edit</button>
              <button className="aa-icobtn danger" onClick={onDelete}>Delete</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

const Spec = ({ k, v }) => (
  <div className="aa-spec"><span className="aa-spec-k">{k}</span><span className="aa-spec-v">{v}</span></div>
);
const SpecBig = ({ k, v }) => (
  <div className="aa-specbig"><span className="aa-specbig-k">{k}</span><span className="aa-specbig-v">{v}</span></div>
);
const Field = ({ label, children, full }) => (
  <div className={"aa-ffield" + (full ? " full" : "")}><label className="aa-lab">{label}</label>{children}</div>
);
function Modal({ title, children, onClose, wide }) {
  return (
    <div className="aa-overlay" onMouseDown={onClose}>
      <div className={"aa-modal" + (wide ? " wide" : "")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="aa-modal-head"><h3>{title}</h3><button className="aa-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="aa-modal-body">{children}</div>
      </div>
    </div>
  );
}
const PhoneGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6.5 3h3l1.5 5-2 1.5a12 12 0 0 0 5 5l1.5-2 5 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5a2 2 0 0 1 2-2Z"
      stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);
const svc = (d) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">{d}</svg>;
const SERVICES = [
  { title: "Body & collision", body: "Dents, panel repair, rust, and full repaints. We make wrecked and worn look right again.",
    icon: svc(<path d="M3 13l2-5h14l2 5v5h-3v-2H6v2H3v-5Zm4 0h10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />) },
  { title: "Tires & wheels", body: "New and quality used tires, mounting, balancing, rotations, flat repair, and alignments.",
    icon: svc(<><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" /></>) },
  { title: "Brakes & suspension", body: "Pads, rotors, shocks, and struts — so you stop smooth and ride steady.",
    icon: svc(<><circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" /><path d="M12 5v3M12 16v3M5 12h3M16 12h3" stroke="currentColor" strokeWidth="1.8" /></>) },
  { title: "Oil & maintenance", body: "Oil changes, fluids, filters, tune-ups, and inspections to keep miles trouble-free.",
    icon: svc(<path d="M7 8h7l3 3v5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8Zm0 3h6M5 8l2-3h4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />) },
  { title: "Engine & diagnostics", body: "Check-engine lights, electrical, A/C, and hard-to-find issues sorted out honestly.",
    icon: svc(<path d="M5 14v-2h2V9h3V7h4v2h2l2 2v3h-2v3H7v-3H5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />) },
  { title: "Inspections & general repair", body: "Pre-purchase checks and everyday fixes. If it's on a vehicle, chances are we handle it.",
    icon: svc(<path d="M14 4l2 2-2 2-2-2 2-2Zm-1 5L5 17l2 2 8-8M9 4H4v5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />) },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Saira:wght@400;500;600;700&family=Saira+Condensed:wght@500;600;700;800&family=Spline+Sans+Mono:wght@500;600;700&display=swap');

.aa-root{
  --bg:#08090c; --panel:#0f1116; --panel2:#14161d; --coal:#13151b; --line:#23262f;
  --red:#ff2b30; --red-2:#e30c12; --red-d:#c00a0f;
  --cyan:#34e3e0; --white:#f3f5f8; --mute:#8b92a2; --steel:#5c6373;
  --paper:#ffffff; --mist:#eef0f3; --ink:#0a0b0e; --line-l:#e3e6ea; --steel-l:#6b7280;
  --av:#23c55e; --pe:#f0a417; --so:#9aa1b1;
  --redgrad:linear-gradient(120deg,#ff3b40,#d2070d);
  font-family:'Saira',system-ui,sans-serif;
  color:var(--white); background:var(--bg);
  -webkit-font-smoothing:antialiased; line-height:1.5;
}
.aa-root *{box-sizing:border-box;}
.aa-root ::selection{background:var(--red); color:#fff;}
.aa-wrap{width:100%; max-width:1240px; margin:0 auto; padding:0 24px;}
.aa-root a{color:inherit; text-decoration:none;}

/* grain overlay */
.aa-grain{position:fixed; inset:0; z-index:200; pointer-events:none; opacity:.04; mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}

/* slash mark + logo */
.aa-slashes{display:inline-flex; gap:3px; align-items:center;}
.aa-slashes span{display:block; width:7px; height:19px; background:var(--redgrad); transform:skewX(-18deg); border-radius:1px;}
.aa-eyebrow .aa-slashes span{width:5px; height:13px;}
.aa-logo{display:inline-flex; align-items:center; gap:9px;}
.aa-logo-text{font-family:'Saira Condensed'; font-weight:800; font-size:30px; letter-spacing:.01em; text-transform:uppercase; line-height:1; color:currentColor;}
.aa-logo:hover .aa-slashes span{animation:slashKick .5s ease;}
@keyframes slashKick{50%{transform:skewX(-18deg) translateX(4px);}}

/* header */
.aa-header{position:sticky; top:0; z-index:60; background:rgba(8,9,12,.55); backdrop-filter:blur(14px) saturate(1.2);
  border-bottom:1px solid transparent; transition:.3s;}
.aa-header.scrolled{background:rgba(8,9,12,.9); border-bottom-color:var(--line);}
.aa-headrow{display:flex; align-items:center; gap:22px; height:74px; transition:.3s;}
.aa-header.scrolled .aa-headrow{height:62px;}
.aa-brand{display:flex; align-items:center; gap:14px; margin-right:auto; color:#fff;}
.aa-brand-sub{font-family:'Saira Condensed'; font-weight:600; font-size:12.5px; letter-spacing:.16em; text-transform:uppercase;
  color:var(--mute); padding-left:14px; border-left:1px solid #2a2e38;}
.aa-nav{display:flex; gap:30px;}
.aa-nav a{position:relative; font-family:'Saira Condensed'; font-weight:600; font-size:15.5px; letter-spacing:.08em; text-transform:uppercase; color:#cdd2dc;}
.aa-nav a::after{content:""; position:absolute; left:0; bottom:-6px; height:2px; width:0; background:var(--redgrad); transition:.25s;}
.aa-nav a:hover{color:#fff;}
.aa-nav a:hover::after{width:100%;}
.aa-callbtn{display:inline-flex; align-items:center; gap:8px; color:#fff; font-weight:600; font-size:15px;
  border:1.5px solid #2e323c; padding:9px 16px; border-radius:3px; transition:.2s;}
.aa-callbtn:hover{border-color:var(--red); color:var(--red); box-shadow:0 0 0 3px rgba(255,43,48,.12);}

/* hero */
.aa-hero{position:relative; min-height:88vh; display:flex; align-items:center; overflow:hidden;
  --mx:0; --my:0; background:var(--bg);}
.aa-hero-bg{position:absolute; inset:-6%; background-size:cover; background-position:center;
  transform:translate(calc(var(--mx)*-16px), calc(var(--my)*-16px)) scale(1.08); transition:transform .25s ease-out;}
.aa-hero-bg.empty{background:
  radial-gradient(80% 70% at 78% 20%, rgba(255,43,48,.18), transparent 60%),
  radial-gradient(60% 60% at 20% 90%, rgba(52,227,224,.07), transparent 60%),
  linear-gradient(160deg,#101319,#06070a);}
.aa-hero-scrim{position:absolute; inset:0; background:linear-gradient(95deg, rgba(8,9,12,.94) 0%, rgba(8,9,12,.78) 38%, rgba(8,9,12,.30) 70%, rgba(8,9,12,.55) 100%);}
.aa-beam{position:absolute; top:-30%; height:160%; width:160px; background:linear-gradient(var(--red-2),transparent); opacity:.16;
  filter:blur(6px); transform:skewX(-16deg); animation:beam 9s ease-in-out infinite;}
.aa-beam.b1{left:42%;}
.aa-beam.b2{left:62%; animation-delay:-4s; opacity:.1; background:linear-gradient(var(--cyan),transparent);}
@keyframes beam{0%,100%{transform:skewX(-16deg) translateX(-10px);}50%{transform:skewX(-16deg) translateX(40px);}}
.aa-shard{position:absolute; background:var(--redgrad); border-radius:2px; opacity:.85; box-shadow:0 0 30px rgba(255,43,48,.4);}
.aa-shard.s1{width:18px; height:120px; top:22%; left:48%; transform:skewX(-18deg) translate(calc(var(--mx)*30px), calc(var(--my)*30px)); animation:floaty 7s ease-in-out infinite;}
.aa-shard.s2{width:10px; height:70px; top:58%; left:40%; opacity:.6; transform:skewX(-18deg) translate(calc(var(--mx)*48px), calc(var(--my)*48px)); animation:floaty 6s ease-in-out infinite reverse;}
.aa-shard.s3{width:7px; height:46px; top:30%; left:67%; background:var(--cyan); box-shadow:0 0 24px rgba(52,227,224,.4); opacity:.5; transform:skewX(-18deg) translate(calc(var(--mx)*60px), calc(var(--my)*60px)); animation:floaty 8s ease-in-out infinite;}
@keyframes floaty{0%,100%{margin-top:0;}50%{margin-top:-16px;}}
.aa-hero-wrap{position:relative; z-index:5; width:100%;}
.aa-hero-content{max-width:620px; padding:60px 0;}
.aa-hero-content > *{opacity:0; animation:heroIn .8s cubic-bezier(.2,.7,.2,1) forwards;}
.aa-hero-content .hero-eb{animation-delay:.05s;}
.aa-hero-content .aa-h1{animation-delay:.16s;}
.aa-hero-content .aa-lead{animation-delay:.3s;}
.aa-hero-content .aa-hero-cta{animation-delay:.42s;}
.aa-hero-content .aa-gauges{animation-delay:.54s;}
@keyframes heroIn{from{opacity:0; transform:translateY(22px);} to{opacity:1; transform:none;}}
.aa-eyebrow{display:inline-flex; align-items:center; gap:10px; font-family:'Saira Condensed'; font-weight:700;
  font-size:14px; letter-spacing:.18em; text-transform:uppercase; color:#fff; margin-bottom:18px;}
.aa-eyebrow.dark{color:var(--ink);}
.aa-live{width:9px; height:9px; border-radius:50%; background:var(--cyan); box-shadow:0 0 0 0 rgba(52,227,224,.6); animation:pulse 2s infinite;}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(52,227,224,.5);}70%{box-shadow:0 0 0 9px rgba(52,227,224,0);}100%{box-shadow:0 0 0 0 rgba(52,227,224,0);}}
.aa-h1{font-family:'Saira Condensed'; font-weight:800; text-transform:uppercase; letter-spacing:.004em;
  font-size:clamp(50px,8vw,108px); line-height:.9; margin:0 0 20px;}
.aa-h1-line{display:block;}
.aa-h1-line.chrome{background:linear-gradient(180deg,#ffffff 8%,#cfd3da 46%,#9aa0ab 56%,#ffffff 96%);
  -webkit-background-clip:text; background-clip:text; color:transparent;}
.aa-h1-line.accent{background:var(--redgrad); -webkit-background-clip:text; background-clip:text; color:transparent;}
.aa-lead{max-width:480px; font-size:18.5px; color:#c4c9d3; margin:0 0 28px;}
.aa-hero-cta{display:flex; flex-wrap:wrap; gap:12px;}
.aa-gauges{display:flex; gap:14px; margin-top:44px;}
.aa-gauge{position:relative; min-width:118px; padding:16px 18px; background:rgba(18,20,27,.6); border:1px solid var(--line);
  border-radius:8px; backdrop-filter:blur(6px); overflow:hidden;}
.aa-gauge::before{content:""; position:absolute; top:0; left:0; width:100%; height:3px; background:var(--redgrad);}
.aa-gauge::after{content:""; position:absolute; right:10px; top:14px; width:30px; height:30px; border-radius:50%;
  border:2px solid #2a2e38; border-top-color:var(--cyan); opacity:.5;}
.aa-gauge-n{display:block; font-family:'Spline Sans Mono'; font-weight:700; font-size:34px; color:#fff; line-height:1;}
.aa-gauge-l{display:block; font-family:'Saira Condensed'; font-weight:600; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--mute); margin-top:8px;}
.aa-scrollcue{position:absolute; bottom:22px; left:50%; transform:translateX(-50%); z-index:6; width:26px; height:42px;
  border:2px solid rgba(255,255,255,.4); border-radius:14px; display:flex; justify-content:center; padding-top:7px;}
.aa-scrollcue span{width:4px; height:9px; background:#fff; border-radius:2px; animation:cue 1.6s ease-in-out infinite;}
@keyframes cue{0%{transform:translateY(0); opacity:1;}70%{transform:translateY(12px); opacity:0;}100%{opacity:0;}}

/* buttons */
.aa-btn{position:relative; display:inline-flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;
  font-family:'Saira Condensed'; font-weight:700; font-size:16px; letter-spacing:.06em; text-transform:uppercase;
  padding:14px 28px; border-radius:4px; border:2px solid transparent; transition:.18s; white-space:nowrap; overflow:hidden;}
.aa-btn.sm{padding:9px 16px; font-size:13.5px;}
.aa-btn-red{background:var(--redgrad); color:#fff; box-shadow:0 6px 24px rgba(255,43,48,.28);}
.aa-btn-red:hover{transform:translateY(-2px); box-shadow:0 10px 30px rgba(255,43,48,.42);}
.aa-btn-red:disabled{opacity:.6; cursor:default; transform:none;}
.aa-btn-glass{background:rgba(255,255,255,.06); color:#fff; border-color:rgba(255,255,255,.22); backdrop-filter:blur(6px);}
.aa-btn-glass:hover{border-color:#fff; background:rgba(255,255,255,.12);}
.aa-btn-dark{background:var(--ink); color:#fff; border-color:var(--ink);}
.aa-btn-dark:hover{background:#000;}
.aa-btn-outline{background:transparent; color:var(--ink); border-color:var(--ink);}
.aa-btn-outline:hover{background:var(--ink); color:#fff;}
.aa-btn-outline-light{background:transparent; color:#fff; border-color:rgba(255,255,255,.4);}
.aa-btn-outline-light:hover{border-color:#fff; background:rgba(255,255,255,.08);}

/* marquee */
.aa-marquee{position:relative; overflow:hidden; background:var(--redgrad); border-top:1px solid rgba(0,0,0,.2); border-bottom:1px solid rgba(0,0,0,.2);}
.aa-marquee-track{display:flex; width:max-content; animation:marq 32s linear infinite;}
.aa-marquee:hover .aa-marquee-track{animation-play-state:paused;}
.aa-mItem{display:inline-flex; align-items:center; font-family:'Saira Condensed'; font-weight:800; font-size:26px;
  letter-spacing:.04em; text-transform:uppercase; color:#fff; padding:15px 0;}
.aa-mSlash{display:inline-block; width:8px; height:22px; background:#0a0b0e; transform:skewX(-18deg); margin:0 26px; opacity:.55; border-radius:1px;}
@keyframes marq{from{transform:translateX(0);} to{transform:translateX(-50%);}}

/* spotlight */
.aa-spotlight{position:relative; background:linear-gradient(180deg,#0b0d12,#0e1016); overflow:hidden; padding:78px 0;}
.aa-spot-num{position:absolute; top:-26px; right:-10px; font-family:'Saira Condensed'; font-weight:800; font-size:clamp(120px,20vw,300px);
  color:#fff; opacity:.025; letter-spacing:.02em; pointer-events:none;}
.aa-spot-grid{position:relative; display:grid; grid-template-columns:1.05fr .95fr; gap:48px; align-items:center;}
.aa-spot-media{position:relative; border-radius:12px; overflow:hidden; aspect-ratio:16/11; background:#0e1014; border:1px solid var(--line);
  box-shadow:0 30px 80px rgba(0,0,0,.5);}
.aa-spot-media img{width:100%; height:100%; object-fit:cover; transition:transform .6s ease;}
.aa-spotlight:hover .aa-spot-media img{transform:scale(1.04);}
.aa-spot-noimg{width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#2c313b;
  background:linear-gradient(135deg,#181b22,#0e1014);}
.aa-spot-flag{position:absolute; top:14px; left:14px; font-family:'Saira Condensed'; font-weight:700; font-size:12.5px;
  letter-spacing:.08em; text-transform:uppercase; color:#fff; background:var(--redgrad); padding:6px 13px; border-radius:3px;}
.aa-spot-title{font-family:'Saira Condensed'; font-weight:800; text-transform:uppercase; letter-spacing:.01em;
  font-size:clamp(32px,4.4vw,52px); line-height:.98; margin:6px 0 0;
  background:linear-gradient(180deg,#fff 20%,#b9bec8 90%); -webkit-background-clip:text; background-clip:text; color:transparent;}
.aa-spot-trim{color:var(--mute); font-size:16px; margin:8px 0 0;}
.aa-spot-price{font-family:'Spline Sans Mono'; font-weight:700; font-size:38px; color:var(--red); margin:16px 0 20px;}
.aa-spot-specs{display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:22px;}
.aa-specbig{background:var(--panel2); border:1px solid var(--line); border-left:3px solid var(--cyan); border-radius:7px; padding:12px 14px; display:flex; flex-direction:column; gap:3px;}
.aa-specbig-k{font-family:'Saira Condensed'; font-weight:600; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--mute);}
.aa-specbig-v{font-family:'Spline Sans Mono'; font-weight:600; font-size:15px; color:#fff;}
.aa-spot-desc{color:#aeb4c0; font-size:15px; margin:0 0 22px; max-width:520px;}

/* lineup */
.aa-lineup{background:var(--paper); color:var(--ink); padding:64px 0;}
.aa-lineup-row{display:flex; gap:12px; overflow-x:auto; padding:4px 0 10px; scrollbar-width:thin;}
.aa-lineup-item{flex:0 0 auto; width:190px; background:var(--paper); border:1px solid var(--line-l); border-radius:8px;
  padding:16px 14px 16px; cursor:pointer; text-align:center; transition:.18s; display:flex; flex-direction:column; align-items:center; gap:3px;}
.aa-lineup-item:hover{border-color:var(--red); transform:translateY(-4px); box-shadow:0 16px 34px rgba(10,11,14,.14);}
.aa-lineup-img{width:100%; height:100px; display:flex; align-items:center; justify-content:center; color:#c3c7cf; margin-bottom:6px;}
.aa-lineup-img img{width:100%; height:100%; object-fit:contain;}
.aa-lineup-name{font-family:'Saira Condensed'; font-weight:700; font-size:17px; letter-spacing:.04em; text-transform:uppercase; color:var(--ink); line-height:1.05;}
.aa-lineup-sub{font-family:'Spline Sans Mono'; font-size:12px; color:var(--steel-l);}
.aa-lineup-go{font-family:'Saira Condensed'; font-weight:600; font-size:12.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--red); margin-top:6px; opacity:0; transform:translateY(4px); transition:.18s;}
.aa-lineup-item:hover .aa-lineup-go{opacity:1; transform:none;}

/* sections (light) */
.aa-section{padding:80px 0;}
.aa-inventory{background:var(--mist); color:var(--ink);}
.aa-sec-head{display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:26px;}
.aa-h2{font-family:'Saira Condensed'; font-weight:800; text-transform:uppercase; letter-spacing:.008em;
  font-size:clamp(34px,4.6vw,58px); margin:6px 0 0; line-height:.96; color:var(--ink);}
.aa-h2.chrome{background:linear-gradient(180deg,#fff 12%,#cfd3da 52%,#9aa0ab 60%,#fff 96%); -webkit-background-clip:text; background-clip:text; color:transparent;}

/* controls */
.aa-controls{display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-bottom:30px;}
.aa-search{flex:1; min-width:200px; padding:13px 16px; border:1.5px solid var(--line-l); border-radius:5px; font-size:15px; font-family:inherit; background:var(--paper);}
.aa-search:focus{outline:none; border-color:var(--ink); box-shadow:0 0 0 3px rgba(10,11,14,.06);}
.aa-chips{display:flex; gap:6px; flex-wrap:wrap;}
.aa-chip{padding:11px 17px; border:1.5px solid var(--line-l); background:var(--paper); border-radius:5px;
  font-family:'Saira Condensed'; font-weight:600; font-size:14px; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; color:var(--steel-l); transition:.15s;}
.aa-chip:hover{border-color:var(--ink);}
.aa-chip.on{background:var(--ink); color:#fff; border-color:var(--ink);}
.aa-select{padding:12px 14px; border:1.5px solid var(--line-l); border-radius:5px; background:var(--paper); font-family:inherit; font-size:14px; cursor:pointer;}

/* grid + cards */
.aa-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:26px;}
.aa-card{position:relative; background:var(--paper); border:1px solid var(--line-l); border-radius:9px; overflow:hidden;
  display:flex; flex-direction:column; transition:transform .2s, box-shadow .2s;}
.aa-card::after{content:""; position:absolute; left:0; bottom:0; height:4px; width:0; background:var(--redgrad); transition:.25s;}
.aa-card:hover{box-shadow:0 22px 50px rgba(10,11,14,.16); transform:translateY(-4px);}
.aa-card:hover::after{width:100%;}
.aa-card.feat{border-color:#c7cad0;}
.aa-card-media{position:relative; aspect-ratio:16/11; background:#0e1014; overflow:hidden;}
.aa-card-media img{width:100%; height:100%; object-fit:cover; display:block; transition:transform .5s ease;}
.aa-card:hover .aa-card-media img{transform:scale(1.06);}
.aa-noimg{width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:#3a4049; background:linear-gradient(135deg,#181b22,#0e1014);}
.aa-noimg span{font-family:'Saira Condensed'; font-weight:600; letter-spacing:.08em; text-transform:uppercase; font-size:12px;}
.aa-badge{position:absolute; top:12px; left:12px; display:inline-flex; align-items:center; gap:6px;
  font-family:'Saira Condensed'; font-weight:700; font-size:12px; letter-spacing:.07em; text-transform:uppercase; color:#fff;
  background:rgba(8,9,12,.82); padding:5px 11px; border-radius:3px; backdrop-filter:blur(2px); z-index:2;}
.aa-badge i{width:7px; height:7px; border-radius:50%; background:var(--so);}
.aa-badge.av i{background:var(--av);}
.aa-badge.pe i{background:var(--pe);}
.aa-feat-tag{position:absolute; top:12px; right:12px; z-index:2; font-family:'Saira Condensed'; font-weight:700; font-size:12px;
  letter-spacing:.07em; text-transform:uppercase; color:#fff; background:var(--redgrad); padding:5px 11px; border-radius:3px;}
.aa-dots{position:absolute; bottom:10px; right:10px; display:flex; gap:6px; z-index:2;}
.aa-dot{width:8px; height:8px; border-radius:50%; border:none; background:rgba(255,255,255,.5); cursor:pointer; padding:0;}
.aa-dot.on{background:var(--red);}
.aa-card-body{padding:18px 18px 20px; display:flex; flex-direction:column; flex:1;}
.aa-car-title{font-family:'Saira Condensed'; font-weight:700; text-transform:uppercase; letter-spacing:.02em; font-size:24px; margin:0; line-height:1.02; color:var(--ink);}
.aa-car-trim{margin:2px 0 0; color:var(--steel-l); font-size:14px;}
.aa-price{font-family:'Spline Sans Mono'; font-weight:700; font-size:26px; color:var(--red-2); margin:12px 0 14px;}
.aa-specs{display:grid; grid-template-columns:1fr 1fr; gap:8px;}
.aa-spec{background:var(--mist); border-radius:5px; padding:9px 11px; display:flex; flex-direction:column; gap:2px;}
.aa-spec-k{font-family:'Saira Condensed'; font-weight:600; font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--steel-l);}
.aa-spec-v{font-family:'Spline Sans Mono'; font-weight:600; font-size:13px; color:var(--ink);}
.aa-colors{margin:12px 0 0; font-size:13.5px; color:var(--steel-l);}
.aa-dot-sep{margin:0 7px;}
.aa-desc{margin:11px 0 0; font-size:14px; color:#4a4e57; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;}
.aa-card-foot{margin-top:auto; padding-top:16px; display:flex; align-items:center; justify-content:space-between; gap:10px;}
.aa-card-owner{display:flex; gap:6px;}
.aa-icobtn{font-family:'Saira Condensed'; font-weight:600; font-size:13px; letter-spacing:.05em; text-transform:uppercase; padding:8px 13px; border:1.5px solid var(--line-l); background:var(--paper); border-radius:4px; cursor:pointer; color:var(--ink);}
.aa-icobtn:hover{border-color:var(--ink);}
.aa-icobtn.danger{color:var(--red-2); border-color:#f0c9cb;}
.aa-icobtn.danger:hover{background:var(--red-2); color:#fff; border-color:var(--red-2);}
.aa-empty{text-align:center; padding:66px 20px; color:var(--steel-l); display:flex; flex-direction:column; align-items:center; gap:14px; background:var(--paper); border:1px solid var(--line-l); border-radius:9px;}
.aa-empty p{font-family:'Saira Condensed'; font-size:24px; text-transform:uppercase; letter-spacing:.03em; color:var(--ink); margin:0;}
.aa-empty-sub{max-width:380px; font-size:14.5px;}

/* services */
.aa-services{position:relative; background:var(--bg); color:#fff; overflow:hidden;}
.aa-services-slash{position:absolute; top:-10%; right:-70px; width:180px; height:120%; background:var(--redgrad); opacity:.9; clip-path:polygon(46% 0, 62% 0, 16% 100%, 0% 100%);}
.aa-grid-lines{position:absolute; inset:0; opacity:.5; background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px); background-size:60px 60px; mask-image:radial-gradient(70% 60% at 30% 40%,#000,transparent 80%); -webkit-mask-image:radial-gradient(70% 60% at 30% 40%,#000,transparent 80%);}
.aa-services .aa-wrap{position:relative; z-index:2;}
.aa-services-lead{max-width:620px; color:#aab0bc; font-size:16.5px; margin:14px 0 38px;}
.aa-svc-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:16px;}
.aa-svc{position:relative; background:var(--coal); border:1px solid #242833; border-radius:9px; padding:26px 24px; transition:.2s; overflow:hidden;}
.aa-svc:hover{border-color:var(--red); transform:translateY(-4px);}
.aa-svc-edge{position:absolute; left:0; top:0; width:3px; height:0; background:var(--redgrad); transition:.3s;}
.aa-svc:hover .aa-svc-edge{height:100%;}
.aa-svc-ico{width:50px; height:50px; border-radius:8px; background:rgba(255,43,48,.13); color:var(--red); display:flex; align-items:center; justify-content:center; margin-bottom:16px; transition:.2s;}
.aa-svc:hover .aa-svc-ico{background:var(--red); color:#fff; transform:rotate(-6deg);}
.aa-svc h3{font-family:'Saira Condensed'; font-weight:700; text-transform:uppercase; letter-spacing:.02em; font-size:20px; margin:0 0 8px;}
.aa-svc p{margin:0; color:#9aa1ae; font-size:14.5px;}
.aa-svc-cta{margin-top:34px; padding:26px 30px; background:linear-gradient(120deg,#13151b,#191c24); border:1px solid #242833; border-radius:10px;
  display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:16px;}
.aa-svc-cta span{font-family:'Saira Condensed'; font-weight:700; font-size:22px; text-transform:uppercase; letter-spacing:.02em;}

/* trust band */
.aa-trust{background:var(--redgrad); color:#fff;}
.aa-trust-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:24px; padding:50px 24px;}
.aa-trust-item{text-align:center; border-right:1px solid rgba(255,255,255,.22);}
.aa-trust-item:last-child{border-right:none;}
.aa-trust-n{display:block; font-family:'Spline Sans Mono'; font-weight:700; font-size:clamp(38px,5vw,58px); line-height:1; text-shadow:0 2px 0 rgba(0,0,0,.12);}
.aa-trust-l{display:block; font-family:'Saira Condensed'; font-weight:600; font-size:13px; letter-spacing:.12em; text-transform:uppercase; margin-top:10px; color:rgba(255,255,255,.9);}

/* visit */
.aa-visit{background:var(--paper); color:var(--ink);}
.aa-visit-grid{display:grid; grid-template-columns:1.05fr .95fr; gap:44px; align-items:center;}
.aa-info{list-style:none; padding:0; margin:18px 0 26px; display:flex; flex-direction:column; gap:14px;}
.aa-info li{display:flex; flex-direction:column; gap:3px; border-bottom:1px solid var(--line-l); padding-bottom:13px;}
.aa-info-k{font-family:'Saira Condensed'; font-weight:600; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--steel-l);}
.aa-info li a, .aa-info li span:last-child{font-size:17px; color:var(--ink); font-weight:500;}
.aa-info li a:hover{color:var(--red-2);}
.aa-visit-card{background:var(--bg); color:#fff; border-radius:12px; padding:36px; border-top:4px solid var(--red); box-shadow:0 24px 60px rgba(10,11,14,.18);}
.aa-visit-card .aa-logo{color:#fff; margin-bottom:16px;}
.aa-visit-card p{margin:0; color:#aab0bc; font-size:15.5px;}
.aa-visit-tags{display:flex; flex-wrap:wrap; gap:8px; margin-top:20px;}
.aa-visit-tags span{font-family:'Saira Condensed'; font-weight:600; font-size:12.5px; letter-spacing:.06em; text-transform:uppercase; color:#d6d9df; border:1px solid #2a2e38; padding:6px 12px; border-radius:3px;}

/* footer */
.aa-footer{position:relative; background:var(--bg); color:#fff; padding:54px 0 32px; overflow:hidden;}
.aa-foot-bigtext{position:absolute; left:0; right:0; bottom:-16px; text-align:center; font-family:'Saira Condensed'; font-weight:800;
  font-size:clamp(48px,13vw,180px); letter-spacing:.02em; color:#fff; opacity:.03; pointer-events:none; white-space:nowrap;}
.aa-footrow{position:relative; display:flex; justify-content:space-between; gap:30px; flex-wrap:wrap;}
.aa-footer .aa-logo{color:#fff; margin-bottom:12px;}
.aa-foot-sub{margin:4px 0 0; color:#9aa1ae; font-size:14px;}
.aa-foot-actions{display:flex; flex-direction:column; align-items:flex-end; gap:10px; text-align:right;}
.aa-owner-tools{display:flex; gap:16px; align-items:center; flex-wrap:wrap; justify-content:flex-end;}
.aa-owner-on{color:var(--av); font-size:12.5px; font-weight:600;}
.aa-owner-link{background:none; border:none; color:#9aa1ae; cursor:pointer; font-family:inherit; font-size:14px; text-decoration:underline; text-underline-offset:3px; padding:0;}
.aa-owner-link:hover{color:var(--red);}
.aa-foot-copy{color:#565d6b; font-size:12.5px;}
.aa-storage-note{position:relative; margin-top:22px; padding-top:16px; border-top:1px solid var(--line); color:#7b828f; font-size:12.5px;}

/* reveal */
[data-reveal]{opacity:0; transform:translateY(26px); transition:opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1);}
[data-reveal].in{opacity:1; transform:none;}

/* modal */
.aa-overlay{position:fixed; inset:0; background:rgba(8,9,12,.7); backdrop-filter:blur(4px); display:flex; align-items:flex-start; justify-content:center; padding:40px 16px; z-index:120; overflow:auto;}
.aa-modal{background:var(--paper); color:var(--ink); border-radius:10px; width:100%; max-width:440px; box-shadow:0 30px 70px rgba(0,0,0,.5); animation:pop .2s ease; border-top:4px solid var(--red);}
.aa-modal.wide{max-width:720px;}
@keyframes pop{from{opacity:0; transform:translateY(12px) scale(.98);} to{opacity:1; transform:none;}}
.aa-modal-head{display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid var(--line-l);}
.aa-modal-head h3{font-family:'Saira Condensed'; font-weight:700; text-transform:uppercase; letter-spacing:.02em; font-size:22px; margin:0;}
.aa-x{background:none; border:none; font-size:26px; line-height:1; color:var(--steel-l); cursor:pointer;}
.aa-modal-body{padding:22px;}
.aa-modal-sub{margin:0 0 16px; color:var(--steel-l); font-size:14.5px;}
.aa-modal-foot{display:flex; justify-content:flex-end; gap:10px; margin-top:22px;}
.aa-lab{display:block; font-family:'Saira Condensed'; font-weight:600; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--steel-l); margin:14px 0 6px;}
.aa-field{width:100%; padding:11px 13px; border:1.5px solid var(--line-l); border-radius:6px; font-size:15px; font-family:inherit; background:var(--paper); color:var(--ink);}
.aa-field.sm{padding:9px 12px; font-size:14px;}
.aa-field:focus{outline:none; border-color:var(--ink);}
.aa-textarea{resize:vertical;}
.aa-err{color:var(--red-2); font-size:13.5px; margin-top:8px; font-weight:500;}
.aa-form-grid{display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;}
.aa-ffield{display:flex; flex-direction:column;}
.aa-ffield .aa-lab{margin-top:0;}
.aa-ffield.full{grid-column:1/-1;}
.aa-toggle{display:flex; align-items:center; gap:9px; font-size:14px; color:var(--ink); cursor:pointer; padding-top:6px;}
.aa-toggle input{width:18px; height:18px; accent-color:var(--red);}
.aa-hero-upload{display:flex; gap:10px; flex-wrap:wrap; align-items:center;}
.aa-hero-preview{margin-top:12px; border:1px solid var(--line-l); border-radius:6px; overflow:hidden; aspect-ratio:16/7;}
.aa-hero-preview img{width:100%; height:100%; object-fit:cover; display:block;}
.aa-photo-tools{display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:4px;}
.aa-url-add{display:flex; gap:8px; flex:1; min-width:220px;}
.aa-thumbs{display:flex; flex-wrap:wrap; gap:10px; margin-top:14px;}
.aa-thumb{position:relative; width:84px; height:64px; border-radius:5px; overflow:hidden; border:1px solid var(--line-l);}
.aa-thumb img{width:100%; height:100%; object-fit:cover;}
.aa-thumb button{position:absolute; top:3px; right:3px; width:20px; height:20px; border-radius:50%; border:none; background:rgba(8,9,12,.8); color:#fff; cursor:pointer; font-size:14px; line-height:1; display:flex; align-items:center; justify-content:center;}
.aa-thumb-main{position:absolute; bottom:0; left:0; right:0; background:var(--redgrad); color:#fff; font-family:'Saira Condensed'; font-weight:600; font-size:10px; letter-spacing:.08em; text-align:center; padding:2px; text-transform:uppercase;}

/* toast */
.aa-toast{position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:var(--ink); color:#fff; padding:13px 24px; border-radius:5px; font-size:14.5px; z-index:140; box-shadow:0 12px 34px rgba(0,0,0,.4); border-left:4px solid var(--red);}

@media (max-width:980px){
  .aa-nav{display:none;}
  .aa-spot-grid, .aa-visit-grid{grid-template-columns:1fr; gap:30px;}
  .aa-trust-grid{grid-template-columns:1fr 1fr; gap:0;}
  .aa-trust-item{padding:22px 0;}
  .aa-trust-item:nth-child(2){border-right:none;}
  .aa-trust-item:nth-child(1),.aa-trust-item:nth-child(2){border-bottom:1px solid rgba(255,255,255,.22);}
}
@media (max-width:860px){
  .aa-hero{min-height:0; padding-top:10px;}
  .aa-hero-content{padding:54px 0 60px;}
  .aa-gauges{flex-wrap:wrap;}
  .aa-form-grid{grid-template-columns:1fr 1fr;}
  .aa-scrollcue{display:none;}
}
@media (max-width:560px){
  .aa-form-grid{grid-template-columns:1fr;}
  .aa-foot-actions{align-items:flex-start; text-align:left;}
  .aa-brand-sub{display:none;}
  .aa-callbtn span{display:none;}
  .aa-spot-specs{grid-template-columns:1fr;}
}
@media (prefers-reduced-motion:reduce){
  .aa-root *{animation:none !important; transition:none !important;}
  [data-reveal]{opacity:1 !important; transform:none !important;}
  .aa-hero-content > *{opacity:1 !important;}
}
`;

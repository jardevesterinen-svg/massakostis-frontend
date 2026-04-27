/* ==========================================================
   ASETUKSET
========================================================== */

const BACKEND_URL = "https://massakostis-backend-production-9111.up.railway.app";
const PUBLIC_URL = "https://pub-9f421e06dc9f4bd49ae0adcf5690c438.r2.dev";

/* ==========================================================
   GLOBAALI TILA
========================================================== */

let kohdeId = null;
let rappuLista = [];
let huoneistoLista = [];
let currentApartmentIndex = 0;
let LAUSELISTA = {};
let kaikkiKohteet = [];
let isLoadingApartment = false;

/* ==========================================================
   APUFUNKTIOT
========================================================== */

const slugify = s =>
  s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const storageKey = (apt) =>
  `apt_${kohdeId}_${slugify(apt)}`;

function showStatus(msg, id = "status_kartoitus") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => el.textContent = "", 2500);
}

/* ==========================================================
   LAUSEET
========================================================== */

async function loadLauseet() {
  const res = await fetch("lauseet.json");
  LAUSELISTA = await res.json();
}
loadLauseet();

/* ==========================================================
   AUTOSAVE (LOCAL ONLY)
========================================================== */

function autosave() {
  if (isLoadingApartment) return;
  saveApartmentDataLocal();
}

function collectApartmentData() {
  const data = {};
  const root = document.getElementById("dynaamiset_osiot");

  root.querySelectorAll("input, textarea, select").forEach(el => {
    if (el.type === "radio") {
      if (el.checked) data[el.name] = el.value;
    } else {
      data[el.id] = el.value;
    }
  });

  data._savedAt = Date.now();
  return data;
}

function saveApartmentDataLocal() {
  if (!kohdeId) return;

  const apt = huoneistoLista[currentApartmentIndex];
  if (!apt) return;

  const data = collectApartmentData();
  data.huoneisto = apt;

  localStorage.setItem(
    storageKey(apt),
    JSON.stringify(data)
  );

  showStatus("Tallennettu paikallisesti 💾");
}

/* ==========================================================
   SYNC BACKENDIIN
========================================================== */

async function syncApartmentToBackend(apt) {
  const key = storageKey(apt);
  const raw = localStorage.getItem(key);
  if (!raw) return;

  try {
    await fetch(`${BACKEND_URL}/upload-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kohde_id: kohdeId,
        huoneisto_slug: slugify(apt),
        data: JSON.parse(raw)
      })
    });

    localStorage.removeItem(key);
    showStatus("Synkronoitu ☁️");

  } catch {
    // Offline – jätetään localStorageen
  }
}

/* ==========================================================
   HUONEISTON LATAUS
========================================================== */

async function loadApartment(index) {
  isLoadingApartment = true;

  const apt = huoneistoLista[index];
  if (!apt) return;

  currentApartmentIndex = index;
  document.getElementById("currentAptInput").value = apt;

  const local = localStorage.getItem(storageKey(apt));
  if (local) {
    fillApartmentForm(JSON.parse(local));
    isLoadingApartment = false;
    return;
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/get-apartment/${kohdeId}/${slugify(apt)}`
    );

    if (res.status === 200) {
      fillApartmentForm(await res.json());
    } else {
      clearApartmentForm();
    }

  } catch {
    showStatus("Offline – käytetään paikallista dataa");
  }

  isLoadingApartment = false;
}

function fillApartmentForm(data) {
  const root = document.getElementById("dynaamiset_osiot");

  root.querySelectorAll("input, textarea, select").forEach(el => {
    if (el.type === "radio") {
      el.checked = data[el.name] === el.value;
    } else if (data[el.id] !== undefined) {
      el.value = data[el.id];
    }
  });
}

function clearApartmentForm() {
  const root = document.getElementById("dynaamiset_osiot");

  root.querySelectorAll("input, textarea, select").forEach(el => {
    if (el.type === "radio") el.checked = false;
    else el.value = "";
  });
}

/* ==========================================================
   KARTOITUSLOMAKE
========================================================== */

function buildApartmentForm() {
  const root = document.getElementById("dynaamiset_osiot");
  root.innerHTML = "";

  const osiot = Object.keys(LAUSELISTA)
    .map(k => k.replace(/_(havainnot|toimenpiteet)/, ""))
    .filter((v, i, a) => a.indexOf(v) === i);

  osiot.forEach(osio => {
    const sec = document.createElement("div");
    sec.innerHTML = `<h3>${osio.replace(/_/g, " ").toUpperCase()}</h3>`;

    const ks = document.createElement("select");
    ks.id = `${osio}_kuntoluokka`;
    ["", "1", "2", "3", "4"].forEach(v => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v || "–";
      ks.appendChild(o);
    });
    ks.addEventListener("change", autosave);

    sec.appendChild(document.createTextNode("Kuntoluokka:"));
    sec.appendChild(ks);

    root.appendChild(sec);
  });
}

/* ==========================================================
   NAVIGAATIO
========================================================== */

document.getElementById("prevApt").onclick = async () => {
  const apt = huoneistoLista[currentApartmentIndex];
  await syncApartmentToBackend(apt);

  if (currentApartmentIndex > 0) {
    loadApartment(currentApartmentIndex - 1);
  }
};

document.getElementById("nextApt").onclick = async () => {
  const apt = huoneistoLista[currentApartmentIndex];
  await syncApartmentToBackend(apt);

  if (currentApartmentIndex < huoneistoLista.length - 1) {
    loadApartment(currentApartmentIndex + 1);
  }
};

/* ==========================================================
   ONLINE-SYNKKAUS
========================================================== */

window.addEventListener("online", () => {
  huoneistoLista.forEach(syncApartmentToBackend);
});

/* ==========================================================
   PDF
========================================================== */

document.getElementById("btnCreatePdf").onclick = async () => {
  for (const apt of huoneistoLista) {
    await syncApartmentToBackend(apt);
  }

  const res = await fetch(
    `${BACKEND_URL}/generate-report/${kohdeId}`,
    { method: "POST" }
  );

  const data = await res.json();
  if (data.url) window.open(data.url, "_blank");
};

/* ==========================================================
   ASETUKSET
========================================================== */

const BACKEND_URL = "https://massakostis-backend-production-9111.up.railway.app";
const PUBLIC_URL = "https://pub-9f421e06dc9f4bd49ae0adcf5690c438.r2.dev";

/* ==========================================================
   GLOBAALI TILA
========================================================== */

let kohdeId = null;                    // aktiivinen kohde
let rappuLista = [];
let huoneistoLista = [];
let currentApartmentIndex = 0;
let LAUSELISTA = {};
let kaikkiKohteet = [];
let isLoadingApartment = false;

/* ==========================================================
   APUFUNKTIOT
========================================================== */

function slugify(text) {
    return text
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function showStatus(msg, id = "status_kartoitus") {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    setTimeout(() => el.textContent = "", 2500);
}

const storageKey = (apt) =>
    `apt_${kohdeId}_${slugify(apt)}`;

/* ==========================================================
   LAUSEET
========================================================== */

async function loadLauseet() {
    const res = await fetch("lauseet.json");
    LAUSELISTA = await res.json();
}
loadLauseet();

/* ==========================================================
   KOHDELISTA (VANHAT + UUDET)
========================================================== */

async function haeKohteet() {
    try {
        const res = await fetch(`${BACKEND_URL}/list-kohteet`);
        const data = await res.json();
        kaikkiKohteet = data.kohteet;
        renderKohdeLista(kaikkiKohteet);
    } catch (e) {
        console.error("Virhe kohdehaussa", e);
    }
}

function renderKohdeLista(lista) {
    const div = document.getElementById("kohdeHakulista");
    div.innerHTML = "";

    if (!lista || lista.length === 0) {
        div.innerHTML = "<em>Ei kohteita</em>";
        return;
    }

    lista.forEach(id => {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = id;
        b.style.width = "100%";
        b.style.marginBottom = "6px";
        b.onclick = () => lataaKohde(id);
        div.appendChild(b);
    });
}

document.getElementById("kohde_haku")?.addEventListener("input", () => {
    const q = document.getElementById("kohde_haku").value.toLowerCase();
    renderKohdeLista(
        kaikkiKohteet.filter(k => k.toLowerCase().includes(q))
    );
});

/* ==========================================================
   KOHDEEN LATAUS
========================================================== */

async function lataaKohde(id) {
    kohdeId = id;

    const res = await fetch(`${BACKEND_URL}/get-metadata/${id}`);
    const meta = await res.json();

    rappuLista = meta.raput || [];
    huoneistoLista = meta.huoneistot || [];
    currentApartmentIndex = 0;

    document.getElementById("kansiPreview").src =
        `${PUBLIC_URL}/kohteet/${id}/kansikuva.jpg`;

    buildApartmentForm();
    loadApartment(0);

    alert("Kohde ladattu");
}

/* ==========================================================
   AUTOSAVE – LOCAL FIRST
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
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({
                kohde_id: kohdeId,
                huoneisto_slug: slugify(apt),
                data: JSON.parse(raw)
            })
        });

        localStorage.removeItem(key);
        showStatus("Synkronoitu ☁️");

    } catch {
        // offline → yritetään myöhemmin
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

        if (res.status === 200)
            fillApartmentForm(await res.json());
        else
            clearApartmentForm();

    } catch {
        showStatus("Offline – paikallinen data käytössä");
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
   NAVIGAATIO
========================================================== */

document.getElementById("prevApt").onclick = async () => {
    const apt = huoneistoLista[currentApartmentIndex];
    await syncApartmentToBackend(apt);
    if (currentApartmentIndex > 0)
        loadApartment(currentApartmentIndex - 1);
};

document.getElementById("nextApt").onclick = async () => {
    const apt = huoneistoLista[currentApartmentIndex];
    await syncApartmentToBackend(apt);
    if (currentApartmentIndex < huoneistoLista.length - 1)
        loadApartment(currentApartmentIndex + 1);
};

window.addEventListener("online", () => {
    huoneistoLista.forEach(syncApartmentToBackend);
});

/* ==========================================================
   PDF
========================================================== */

document.getElementById("btnCreatePdf").onclick = async () => {
    for (const apt of huoneistoLista)
        await syncApartmentToBackend(apt);

    const res = await fetch(
        `${BACKEND_URL}/generate-report/${kohdeId}`,
        { method: "POST" }
    );
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
};

/* ==========================================================
   INIT
========================================================== */

window.addEventListener("load", haeKohteet);

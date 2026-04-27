/* ==========================================================
    ASETUKSET — PUBLIC R2 URL
========================================================== */

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
let offlineQueue = {};

/* ==========================================================
    LAUSELISTA
========================================================== */

async function loadLauseet() {
    const res = await fetch("lauseet.json");
    LAUSELISTA = await res.json();
}
loadLauseet();

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

function showStatus(msg, id = "status") {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    setTimeout(() => el.textContent = "", 2500);
}
function bindMaterialAutosave() {
    const materialFields = document.querySelectorAll(
        'input[name^="materiaalit_"], textarea[name^="materiaalit_"]'
    );

    materialFields.forEach(el => {
        el.addEventListener("change", autosave);
        el.addEventListener("input", autosave);
    });
}
/* ==========================================================
    TABIT
========================================================== */

document.getElementById("tabPerustiedot").addEventListener("click", () => {
    document.getElementById("perustiedotTab").style.display = "block";
    document.getElementById("kartoitusTab").style.display = "none";
    document.getElementById("tabPerustiedot").classList.add("active");
    document.getElementById("tabKartoitus").classList.remove("active");
});

document.getElementById("tabKartoitus").addEventListener("click", () => {
    if (!kohdeId) {
        alert("Täytä ensin perustiedot (kohteen nimi + päivämäärä).");
        return;
    }

    document.getElementById("perustiedotTab").style.display = "none";
    document.getElementById("kartoitusTab").style.display = "block";
    document.getElementById("tabPerustiedot").classList.remove("active");
    document.getElementById("tabKartoitus").classList.add("active");

    buildApartmentForm();
    bindMaterialAutosave(); 
    loadApartment(currentApartmentIndex);
});

/* ==========================================================
    KOHTEIDEN HAKU + SUODATUS
========================================================== */

async function haeKohteet() {
    try {
        const res = await fetch(
            "https://massakostis-backend-production-9111.up.railway.app/list-kohteet"
        );
        const data = await res.json();
        kaikkiKohteet = data.kohteet;
        renderKohdeLista(kaikkiKohteet);
    } catch (e) {
        console.error("Virhe kohdehaussa:", e);
    }
}

function renderKohdeLista(lista) {
    const div = document.getElementById("kohdeHakulista");
    div.innerHTML = "";

    if (!lista || lista.length === 0) {
        div.innerHTML = "<em>Ei kohteita.</em>";
        return;
    }

    lista.forEach(id => {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = id;
        b.style.width = "100%";
        b.style.marginBottom = "5px";
        b.onclick = () => lataaKohde(id);
        div.appendChild(b);
    });
}

document.getElementById("kohde_haku").addEventListener("input", () => {
    const q = document.getElementById("kohde_haku").value.toLowerCase();
    const filt = kaikkiKohteet.filter(k => k.toLowerCase().includes(q));
    renderKohdeLista(filt);
});

/* ==========================================================
    KOHDE-ID
========================================================== */

function updateKohdeId() {
    const nimi = document.getElementById("kohde_nimi").value.trim();
    const paiva = document.getElementById("kohde_paiva").value.trim();
    if (!nimi || !paiva) return null;
    kohdeId = `${slugify(nimi)}-${paiva}`;
    return kohdeId;
}

/* ==========================================================
    LATAA KOKO KOHDE (metadata + rappu + huoneistot + kansikuva)
========================================================== */

async function lataaKohde(id) {
    kohdeId = id;

    const res = await fetch(
        `https://massakostis-backend-production-9111.up.railway.app/get-metadata/${id}`
    );
    const meta = await res.json();

    document.getElementById("kohde_nimi").value = meta.kohde.nimi;
    document.getElementById("kohde_osoite").value = meta.kohde.osoite;
    document.getElementById("kohde_postinumero").value = meta.kohde.postinumero;
    document.getElementById("kohde_postitoimipaikka").value = meta.kohde.postitoimipaikka;
    document.getElementById("kohde_paiva").value = meta.kohde.paiva;
    document.getElementById("kohde_tarkastaja").value = meta.kohde.tarkastaja;

    Object.entries(meta.tilaaja).forEach(([k, v]) => {
        const f = document.getElementById("tilaaja_" + k);
        if (f) f.value = v;
    });

    rappuLista = meta.raput;
    renderRappuLista();
    regenerateApartments();

    // ✅ Näytä kansikuva
    const kp = document.getElementById("kansiPreview");
    kp.src = `${PUBLIC_URL}/kohteet/${id}/kansikuva.jpg`;
    kp.style.display = "block";

    alert("Kohde ladattu!");
}

/* ==========================================================
    PERUSTIETOJEN TALLENNUS
========================================================== */

async function saveMetadata() {
    const id = updateKohdeId();
    if (!id) return;

    const metadata = {
        tilaaja: {
            etunimi: document.getElementById("tilaaja_etunimi").value,
            sukunimi: document.getElementById("tilaaja_sukunimi").value,
            yritys: document.getElementById("tilaaja_yritys").value,
            sahkoposti: document.getElementById("tilaaja_email").value,
            puhelin: document.getElementById("tilaaja_puhelin").value,
            osoite: document.getElementById("tilaaja_osoite").value,
            postinumero: document.getElementById("tilaaja_postinumero").value,
            postitoimipaikka: document.getElementById("tilaaja_postitoimipaikka").value
        },
        kohde: {
            nimi: document.getElementById("kohde_nimi").value,
            osoite: document.getElementById("kohde_osoite").value,
            postinumero: document.getElementById("kohde_postinumero").value,
            postitoimipaikka: document.getElementById("kohde_postitoimipaikka").value,
            tarkastaja: document.getElementById("kohde_tarkastaja").value,
            paiva: document.getElementById("kohde_paiva").value
        },
        raput: rappuLista,
        huoneistot: huoneistoLista
    };

    try {
        await fetch(
            "https://massakostis-backend-production-9111.up.railway.app/save-metadata",
            {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({ kohde_id: kohdeId, metadata })
            }
        );

        showStatus("Tallennettu ✅");
    } catch {
        showStatus("Ei yhteyttä – tallennetaan myöhemmin");
    }
}

/* ==========================================================
    KANSIKUVA ESIKATSELU + TALLENNUS
========================================================== */

function previewKansikuva() {
    const input = document.getElementById("kansikuva");
    const prev = document.getElementById("kansiPreview");

    const file = input.files[0];
    if (!file) {
        prev.style.display = "none";
        prev.src = "";
        return;
    }

    prev.src = URL.createObjectURL(file);
    prev.style.display = "block";
}

async function uploadKansikuva() {
    if (!kohdeId) {
        alert("Täytä ensin kohteen nimi ja tarkastuspäivä.");
        return;
    }

    const input = document.getElementById("kansikuva");
    const file = input.files[0];
    if (!file) return;

    const form = new FormData();
    form.append("kohde_id", kohdeId);
    form.append("file", file);

    await fetch(
        "https://massakostis-backend-production-9111.up.railway.app/upload-kansikuva",
        { method: "POST", body: form }
    );

    showStatus("Kansikuva tallennettu ✅");
}

document.getElementById("kansikuva").addEventListener("change", () => {
    if (!kohdeId) updateKohdeId();
    previewKansikuva();
    uploadKansikuva();
});

/* ==========================================================
    RAPPUTOIMINNOT + HUONEISTOT
========================================================== */

function regenerateApartments() {
    huoneistoLista = [];
    rappuLista.forEach(r => {
        for (let i = r.alku; i <= r.loppu; i++) {
            huoneistoLista.push(`${r.rappu}${i}`);
        }
    });

    document.getElementById("huoneistoLista").textContent =
        huoneistoLista.join(", ");
}

function renderRappuLista() {
    const c = document.getElementById("rappuListaContainer");
    c.innerHTML = "";

    rappuLista.forEach((r, idx) => {
        const div = document.createElement("div");
        div.className = "rappu-row";

        div.innerHTML = `
            <div style="flex:1;"><strong>${r.rappu}</strong> (${r.alku}–${r.loppu})</div>
            <button class="btn" style="background:#8e44ad" onclick="editRappu(${idx})">Muokkaa</button>
            <button class="btn" style="background:#c0392b" onclick="deleteRappu(${idx})">Poista</button>
        `;

        c.appendChild(div);
    });
}

document.getElementById("btnLisaRappu").addEventListener("click", () => {
    const nimi = document.getElementById("rappu_nimi").value.trim();
    const alku = parseInt(document.getElementById("rappu_alku").value);
    const loppu = parseInt(document.getElementById("rappu_loppu").value);

    if (!nimi || isNaN(alku) || isNaN(loppu) || alku > loppu) {
        alert("Tarkista rappu ja numerot.");
        return;
    }

    rappuLista.push({ rappu:nimi, alku, loppu });
    regenerateApartments();
    renderRappuLista();
    saveMetadata();
});

function editRappu(i) {
    const r = rappuLista[i];

    const n = prompt("Rappu:", r.rappu);
    if (!n) return;

    const a = parseInt(prompt("Alku:", r.alku));
    const l = parseInt(prompt("Loppu:", r.loppu));

    if (isNaN(a) || isNaN(l) || a > l) {
        alert("Virhe alku/loppu.");
        return;
    }

    rappuLista[i] = { rappu:n.trim(), alku:a, loppu:l };
    regenerateApartments();
    renderRappuLista();
    saveMetadata();
}

function deleteRappu(i) {
    if (!confirm("Poistetaanko rappu?")) return;
    rappuLista.splice(i, 1);
    regenerateApartments();
    renderRappuLista();
    saveMetadata();
}

/* ==========================================================
    DYNAAMINEN KARTOITUSLOMAKE
========================================================== */

function createDropdown(osio, tyyppi) {
    const w = document.createElement("div");
    w.style.marginBottom = "20px";

    w.innerHTML = `<label>${tyyppi === "havainnot" ? "Havainnot" : "Toimenpiteet"}</label>`;

    const sel = document.createElement("select");
    sel.id = `${osio}_${tyyppi}_select`;
    w.appendChild(sel);

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "– valitse –";
    sel.appendChild(opt0);

    LAUSELISTA[`${osio}_${tyyppi}`].forEach(l => {
        const o = document.createElement("option");
        o.value = l;
        o.textContent = l;
        sel.appendChild(o);
    });

    const muu = document.createElement("input");
    muu.type = "text";
    muu.placeholder = "Muu...";
    muu.style.display = "none";
    w.appendChild(muu);

    const ta = document.createElement("textarea");
    ta.id = `${osio}_${tyyppi}_textarea`;
    ta.style.width = "100%";
    ta.style.height = "80px";
    w.appendChild(ta);

    sel.addEventListener("change", () => {
        if (sel.value === "Muu") {
            muu.style.display = "block";
            return;
        }
        if (sel.value) {
            ta.value += (ta.value ? "\n" : "") + sel.value;
            autosave();
        }
        sel.value = "";
        muu.style.display = "none";
    });

    muu.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            ta.value += (ta.value ? "\n" : "") + muu.value;
            muu.value = "";
            muu.style.display = "none";
            autosave();
            e.preventDefault();
        }
    });

    ta.addEventListener("input", autosave);

    return w;
}

function buildApartmentForm() {
    const root = document.getElementById("dynaamiset_osiot");
    root.innerHTML = "";

    const osiot = Object.keys(LAUSELISTA)
        .map(k=>k.replace("_havainnot","").replace("_toimenpiteet",""))
        .filter((v,i,a)=>a.indexOf(v)===i);

    osiot.forEach(osio => {

        let sec = document.createElement("div");
        sec.innerHTML = `<h3>${osio.replace(/_/g," ").toUpperCase()}</h3>`;

        sec.innerHTML += `<label>Kuntoluokka:</label>`;

        const ks = document.createElement("select");
        ks.id = `${osio}_kuntoluokka`;
        
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "– valitse –";
        ks.appendChild(empty);
        
        ["1","2","3","4"].forEach(t => {
            const o = document.createElement("option");
            o.value = t;
            o.textContent = t;
            ks.appendChild(o);
        });

        ks.addEventListener("change",autosave);
        sec.appendChild(ks);

        sec.innerHTML += `<div style="margin-top:10px;">Välittömästi huomiota vaativa:</div>`;
        const hu = document.createElement("div");
        hu.innerHTML = `
            <label><input type="radio" name="${osio}_huomio" value="Kyllä"> Kyllä</label>
            <label><input type="radio" name="${osio}_huomio" value="Ei" checked> Ei</label>
        `;
        hu.addEventListener("change",autosave);
        sec.appendChild(hu);

        sec.appendChild(createDropdown(osio,"havainnot"));
        sec.appendChild(createDropdown(osio,"toimenpiteet"));

        root.appendChild(sec);
    });
}

/* ==========================================================
    HUONEISTON LATAUS (data + kuvat)
========================================================== */

async function loadApartment(i) {
    
    const apt = huoneistoLista[i];
    const localKey = `offline_${kohdeId}_${apt}`;
    
    if (localStorage.getItem(localKey)) {
        currentApartmentIndex = i;
        document.getElementById("currentAptInput").value = apt;
    
        const local = JSON.parse(localStorage.getItem(localKey));
        fillApartmentForm(local.data);
    
        loadImagePreview(slugify(apt));
        isLoadingApartment = false;
        return;
    }

    isLoadingApartment = true;   // ⛔ estä autosave
    if (!kohdeId || huoneistoLista.length === 0) return;

    document.getElementById("currentAptInput").value = apt;
    const slug = slugify(apt);

    try {
        const res = await fetch(
            `https://massakostis-backend-production-9111.up.railway.app/get-apartment/${kohdeId}/${slug}`
        );

        if (res.status === 404) {
            clearApartmentForm();
        } else {
            fillApartmentForm(await res.json());
        }

    } catch {
        showStatus("Ei yhteyttä", "status_kartoitus");
    }

    document.getElementById("kuva1").value = "";
    document.getElementById("kuva2").value = "";
    loadImagePreview(slug);
    isLoadingApartment = false;  // ✅ autosave takaisin päälle
}

function loadImagePreview(slug) {

    const p1 = document.getElementById("preview1");
    const p2 = document.getElementById("preview2");

    p1.src = `${PUBLIC_URL}/kohteet/${kohdeId}/huoneistot/${slug}/kuva1.jpg`;
    p1.style.display = "block";

    p2.src = `${PUBLIC_URL}/kohteet/${kohdeId}/huoneistot/${slug}/kuva2.jpg`;
    p2.style.display = "block";
}

function fillApartmentForm(data) {
    const fields = document.querySelectorAll(
        "#dynaamiset_osiot input, #dynaamiset_osiot textarea, #dynaamiset_osiot select"
    );

    fields.forEach(el => {
        if (el.type === "radio") {
            if (data[el.name] === el.value) el.checked = true;
        } else if (data[el.id] !== undefined) {
            el.value = data[el.id];
        }
    });

    // ===== MATERIAALIT =====
    if (data.materiaalit_lattia_valinta) {
        document
            .querySelector(`input[name="materiaalit_lattia_valinta"][value="${data.materiaalit_lattia_valinta}"]`)
            ?.click();
    }
    document.getElementById("materiaalit_lattia_muu").value = data.materiaalit_lattia_muu || "";

    if (data.materiaalit_seinat_valinta) {
        document
            .querySelector(`input[name="materiaalit_seinat_valinta"][value="${data.materiaalit_seinat_valinta}"]`)
            ?.click();
    }
    document.getElementById("materiaalit_seinat_muu").value = data.materiaalit_seinat_muu || "";

    if (data.materiaalit_katto_valinta) {
        document
            .querySelector(`input[name="materiaalit_katto_valinta"][value="${data.materiaalit_katto_valinta}"]`)
            ?.click();
    }
    document.getElementById("materiaalit_katto_muu").value = data.materiaalit_katto_muu || "";

    document.querySelectorAll('input[name="materiaalit_vesiputket"]').forEach(cb => {
        cb.checked = (data.materiaalit_vesiputket || "").includes(cb.value);
    });

    document.querySelectorAll('input[name="materiaalit_lampoputket"]').forEach(cb => {
        cb.checked = (data.materiaalit_lampoputket || "").includes(cb.value);
    });
}

function clearApartmentForm() {
    const fields = document.querySelectorAll(
        "#dynaamiset_osiot input, #dynaamiset_osiot textarea, #dynaamiset_osiot select"
    );

    fields.forEach(el => {
        if (el.type === "radio") {
            if (el.value === "Ei") el.checked = true;
        } else {
            el.value = "";
        }
 
    // ===== NOLLAA MATERIAALIT =====
    document.querySelectorAll(
        'input[name^="materiaalit_"]'
    ).forEach(el => el.checked = false);

    document.getElementById("materiaalit_lattia_muu").value = "";
    document.getElementById("materiaalit_seinat_muu").value = "";
    document.getElementById("materiaalit_katto_muu").value = "";
 
    });

    document.getElementById("preview1").style.display = "none";
    document.getElementById("preview2").style.display = "none";
}

/* ==========================================================
    AUTOSAVE (HUONEISTO)
========================================================== */

function saveApartmentDataLocally(kohdeId, huoneisto, data) {
    const key = `offline_${kohdeId}_${huoneisto}`;
    localStorage.setItem(key, JSON.stringify({
        data,
        ts: Date.now()
    }));
}

function autosave() {
    if (isLoadingApartment) return;

    const data = collectApartmentData();
    const currentApt = huoneistoLista[currentApartmentIndex];
    if (!currentApt || !kohdeId) return;

    saveApartmentDataLocally(kohdeId, currentApt, data);

    if (navigator.onLine) {
        saveApartmentData();
    }
}

function collectApartmentData() {

    const data = {};

    // 1️⃣ Dynaamiset tarkastuskohteet (entinen logiikka)
    const dynaaminenRoot = document.getElementById("dynaamiset_osiot");
    const dynaamisetKentat = dynaaminenRoot.querySelectorAll(
        "input, textarea, select"
    );

    dynaamisetKentat.forEach(el => {
        if (el.type === "radio") {
            if (el.checked) data[el.name] = el.value;
        }
        else if (el.type === "checkbox") {
            if (!data[el.name]) data[el.name] = [];
            if (el.checked) data[el.name].push(el.value);
        }

        else {
            data[el.id] = el.value;
        }

    });

    // 2️⃣ MATERIAALIT (ULKOPUOLELLA dynaamisia osioita)
    data["materiaalit_lattia_valinta"] =
        document.querySelector('input[name="materiaalit_lattia_valinta"]:checked')?.value || "";

    data["materiaalit_lattia_muu"] =
        document.getElementById("materiaalit_lattia_muu")?.value || "";

    data["materiaalit_seinat_valinta"] =
        document.querySelector('input[name="materiaalit_seinat_valinta"]:checked')?.value || "";

    data["materiaalit_seinat_muu"] =
        document.getElementById("materiaalit_seinat_muu")?.value || "";

    data["materiaalit_katto_valinta"] =
        document.querySelector('input[name="materiaalit_katto_valinta"]:checked')?.value || "";

    data["materiaalit_katto_muu"] =
        document.getElementById("materiaalit_katto_muu")?.value || "";

    data["materiaalit_vesiputket"] =
        [...document.querySelectorAll('input[name="materiaalit_vesiputket"]:checked')]
            .map(e => e.value)
            .join(", ");

    data["materiaalit_lampoputket"] =
        [...document.querySelectorAll('input[name="materiaalit_lampoputket"]:checked')]
            .map(e => e.value)
            .join(", ");

    return data;
}


async function saveApartmentData() {
    if (!kohdeId) return;
    if (!huoneistoLista || huoneistoLista.length === 0) return;

    const apt = huoneistoLista[currentApartmentIndex];
    const slug = slugify(apt);

    const data = collectApartmentData();
    data.huoneisto = apt;

    try {
        await fetch(
            "https://massakostis-backend-production-9111.up.railway.app/upload-data",
            {
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({
                    kohde_id:kohdeId,
                    huoneisto_slug:slug,
                    data
                })
            }
        );

        showStatus("Tallennettu ✅", "status_kartoitus");

    } catch {
        showStatus("Ei yhteyttä – tallennetaan myöhemmin", "status_kartoitus");
    }
}

/* ==========================================================
    NAVIGAATIO
========================================================== */

document.getElementById("prevApt").addEventListener("click", () => {
    if (currentApartmentIndex > 0) {
        currentApartmentIndex--;
        loadApartment(currentApartmentIndex);
    }
});

document.getElementById("nextApt").addEventListener("click", () => {
    if (currentApartmentIndex < huoneistoLista.length - 1) {
        currentApartmentIndex++;
        loadApartment(currentApartmentIndex);
    }
});

document.getElementById("currentAptInput").addEventListener("change", () => {
    const val = document.getElementById("currentAptInput").value;
    const idx = huoneistoLista.indexOf(val);
    if (idx !== -1) {
        currentApartmentIndex = idx;
        loadApartment(idx);
    }
});

/* ==========================================================
    KUVA1 / KUVA2 ESIKATSELU + TALLENNUS
========================================================== */

function previewSelectedImage(fileInputId, previewId) {
    const input = document.getElementById(fileInputId);
    const preview = document.getElementById(previewId);
    const file = input.files[0];

    if (!file) {
        preview.style.display = "none";
        preview.src = "";
        return;
    }

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
}

async function uploadApartmentImage(index) {

    if (!kohdeId) {
        alert("Täytä ensin perustiedot.");
        return;
    }

    const apt = huoneistoLista[currentApartmentIndex];
    const slug = slugify(apt);

    const input = document.getElementById(`kuva${index}`);
    const file = input.files[0];
    if (!file) return;

    const form = new FormData();
    form.append("kohde_id", kohdeId);
    form.append("huoneisto_slug", slug);
    form.append("index", index);
    form.append("file", file);

    try {
        await fetch(
            "https://massakostis-backend-production-9111.up.railway.app/upload-image",
            { method:"POST", body:form }
        );

        showStatus(`Kuva ${index} tallennettu ✅`, "status_kartoitus");

    } catch {
        showStatus("Kuvan tallennus epäonnistui ❌", "status_kartoitus");
    }
}

document.getElementById("kuva1").addEventListener("change", () => {
    previewSelectedImage("kuva1","preview1");
    uploadApartmentImage(1);
});

document.getElementById("kuva2").addEventListener("change", () => {
    previewSelectedImage("kuva2","preview2");
    uploadApartmentImage(2);
});

/* ==========================================================
    SIVUN LATAUS
========================================================== */

window.addEventListener("load", () => {
    haeKohteet();
});
document.getElementById("btnCreatePdf").addEventListener("click", async () => {
    if (!kohdeId) {
        alert("Ei kohdetta ladattuna.");
        return;
    }

    const res = await fetch(
        `https://massakostis-backend-production-9111.up.railway.app/generate-report/${kohdeId}`,
        { method: "POST" }
    );

    const data = await res.json();

    if (data.url) {
        alert("PDF-raportti luotu!");
        // Valinta A = tallennus R2:een, ei automaattista avausta
        window.open(data.url, "_blank");
    } else {
        alert("Virhe PDF:n luonnissa.");
    }
});

/* ==========================================================
    SYNKRONOINTI KUN YHTEYS PALAA
========================================================== */

async function syncOfflineData() {
    if (!navigator.onLine) return;

    for (let key of Object.keys(localStorage)) {
        if (!key.startsWith("offline_")) continue;

        try {
            const [, kohdeId, apt] = key.split("_");
            const payload = JSON.parse(localStorage.getItem(key));

            await fetch(
                "https://massakostis-backend-production-9111.up.railway.app/upload-data",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        kohde_id: kohdeId,
                        huoneisto_slug: slugify(apt),
                        data: payload.data
                    })
                }
            );

            localStorage.removeItem(key);
        } catch {
            // jätetään jonoon
        }
    }
}
window.addEventListener("online", syncOfflineData);

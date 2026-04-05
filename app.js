/* ==========================================================
    GLOBAALIT TILAMUUTTUJAT
========================================================== */

let kohdeId = null;                 // esim: "asoy-merikotka-2026-04-05"
let rappuLista = [];                // [{ rappu:"Talo A", alku:1, loppu:24 }]
let huoneistoLista = [];            // ["Talo A1","Talo A2",...]
let currentApartmentIndex = 0;      // nykyinen huoneisto navigointiin

let LAUSELISTA = {};                // lauseet.json sisältö
let kaikkiKohteet = [];             // list-kohteet-endpointin tulokset

/* ==========================================================
    LAUSEET (HAVAINNOT + TOIMENPITEET)
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
    el.textContent = msg;
    setTimeout(() => el.textContent = "", 3000);
}

/* ==========================================================
    TABS (Perustiedot / Huoneistot)
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
    loadApartment(currentApartmentIndex);
});

/* ==========================================================
    KOHTEIDEN HAKU + SUODATUS
========================================================== */

async function haeKohteet() {
    try {
        const res = await fetch("https://massakostis-backend-production-9111.up.railway.app/list-kohteet");
        const data = await res.json();

        kaikkiKohteet = data.kohteet;
        renderKohdeLista(kaikkiKohteet);

    } catch (e) {
        console.error("kohteiden haku epäonnistui:", e);
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
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.textContent = id;
        btn.style.width = "100%";
        btn.style.marginBottom = "5px";
        btn.onclick = () => lataaKohde(id);
        div.appendChild(btn);
    });
}

document.getElementById("kohde_haku").addEventListener("input", () => {
    const q = document.getElementById("kohde_haku").value.toLowerCase();
    const filt = kaikkiKohteet.filter(k => k.toLowerCase().includes(q));
    renderKohdeLista(filt);
});

async function lataaKohde(id) {
    kohdeId = id;

    const res = await fetch(`https://massakostis-backend-production-9111.up.railway.app/get-metadata/${id}`);
    const meta = await res.json();

    // Kohdetiedot
    document.getElementById("kohde_nimi").value = meta.kohde.nimi;
    document.getElementById("kohde_osoite").value = meta.kohde.osoite;
    document.getElementById("kohde_postinumero").value = meta.kohde.postinumero;
    document.getElementById("kohde_postitoimipaikka").value = meta.kohde.postitoimipaikka;
    document.getElementById("kohde_paiva").value = meta.kohde.paiva;
    document.getElementById("kohde_tarkastaja").value = meta.kohde.tarkastaja;

    // Tilaaja
    Object.entries(meta.tilaaja).forEach(([k,v])=>{
        const f = document.getElementById("tilaaja_"+k);
        if (f) f.value = v;
    });

    // Raput
    rappuLista = meta.raput;
    renderRappuLista();
    regenerateApartments();

    alert("Kohde ladattu!");
}

/* ==========================================================
    KOHTEEN ID (nimi + päivämäärä)
========================================================== */

function updateKohdeId() {
    const nimi = document.getElementById("kohde_nimi").value.trim();
    const paiva = document.getElementById("kohde_paiva").value.trim();

    if (!nimi || !paiva) return null;

    kohdeId = `${slugify(nimi)}-${paiva}`;
    return kohdeId;
}

/* ==========================================================
    METADATA
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
        await fetch("https://massakostis-backend-production-9111.up.railway.app/save-metadata", {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ kohde_id: kohdeId, metadata })
        });
        showStatus("Tallennettu ✅");
    } catch {
        showStatus("Ei yhteyttä – tallennetaan myöhemmin");
    }
}

/* ==========================================================
    RAPUT + HUONEISTOLOGIIKKA
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
    const cont = document.getElementById("rappuListaContainer");
    cont.innerHTML = "";

    rappuLista.forEach((r, idx) => {
        const row = document.createElement("div");
        row.className = "rappu-row";

        row.innerHTML = `
            <div style="flex: 1;">
                <strong>${r.rappu}</strong> (${r.alku}–${r.loppu})
            </div>
            <button class="btn" style="background:#8e44ad" onclick="editRappu(${idx})">Muokkaa</button>
            <button class="btn" style="background:#c0392b" onclick="deleteRappu(${idx})">Poista</button>
        `;

        cont.appendChild(row);
    });
}

document.getElementById("btnLisaRappu").addEventListener("click", () => {
    const rappu = document.getElementById("rappu_nimi").value.trim();
    const alku = parseInt(document.getElementById("rappu_alku").value);
    const loppu = parseInt(document.getElementById("rappu_loppu").value);

    if (!rappu || isNaN(alku) || isNaN(loppu) || alku > loppu) {
        alert("Tarkista rappunimi ja numerot.");
        return;
    }

    rappuLista.push({ rappu, alku, loppu });
    regenerateApartments();
    renderRappuLista();
    saveMetadata();
});

function editRappu(i) {
    const r = rappuLista[i];

    const nimi = prompt("Rappu:", r.rappu);
    if (!nimi) return;

    const alku = parseInt(prompt("Alku:", r.alku));
    const loppu = parseInt(prompt("Loppu:", r.loppu));
    if (isNaN(alku) || isNaN(loppu) || alku > loppu) {
        alert("Virhe alku/loppu.");
        return;
    }

    rappuLista[i] = { rappu: nimi.trim(), alku, loppu };
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
    const wrap = document.createElement("div");
    wrap.style.marginBottom = "20px";

    wrap.innerHTML = `<label>${tyyppi === "havainnot" ? "Havainnot" : "Toimenpiteet"}</label>`;

    const select = document.createElement("select");
    select.id = `${osio}_${tyyppi}_select`;
    wrap.appendChild(select);

    const opt0 = document.createElement("option");
    opt0.textContent = "– valitse –";
    opt0.value = "";
    select.appendChild(opt0);

    LAUSELISTA[`${osio}_${tyyppi}`].forEach(l => {
        let o = document.createElement("option");
        o.value = l;
        o.textContent = l;
        select.appendChild(o);
    });

    const muu = document.createElement("input");
    muu.type = "text";
    muu.placeholder = "Muu...";
    muu.style.display = "none";
    wrap.appendChild(muu);

    const textarea = document.createElement("textarea");
    textarea.id = `${osio}_${tyyppi}_textarea`;
    textarea.style.width = "100%";
    textarea.style.height = "80px";
    wrap.appendChild(textarea);

    select.addEventListener("change", () => {
        if (select.value === "Muu") {
            muu.style.display = "block";
            return;
        }
        if (select.value) {
            textarea.value += (textarea.value ? "\n" : "") + select.value;
            autosave();
        }
        muu.style.display = "none";
        select.value = "";
    });

    muu.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            textarea.value += (textarea.value ? "\n" : "") + muu.value;
            muu.value = "";
            muu.style.display = "none";
            autosave();
            e.preventDefault();
        }
    });

    textarea.addEventListener("input", autosave);

    return wrap;
}

function buildApartmentForm() {
    const root = document.getElementById("dynaamiset_osiot");
    root.innerHTML = "";

    const osiot = Object.keys(LAUSELISTA)
        .map(k => k.replace("_havainnot", "").replace("_toimenpiteet", ""))
        .filter((v, i, a) => a.indexOf(v) === i);

    osiot.forEach(osio => {
        let sec = document.createElement("div");
        sec.innerHTML = `<h3>${osio.replace(/_/g, " ").toUpperCase()}</h3>`;

        // ✅ Kuntoluokka
        sec.innerHTML += `<label>Kuntoluokka:</label>`;
        const sel = document.createElement("select");
        sel.id = `${osio}_kuntoluokka`;
        ["★","★★","★★★","★★★★"].forEach(t => {
            let o = document.createElement("option");
            o.value = t;
            o.textContent = t;
            sel.appendChild(o);
        });
        sel.addEventListener("change", autosave);
        sec.appendChild(sel);

        // ✅ Huomiovaatimus
        sec.innerHTML += `<div style="margin-top:10px;">Välittömästi huomiota vaativa:</div>`;
        const huomDiv = document.createElement("div");
        huomDiv.innerHTML = `
            <label><input type="radio" name="${osio}_huomio" value="Kyllä"> Kyllä</label>
            <label><input type="radio" name="${osio}_huomio" value="Ei" checked> Ei</label>
        `;
        huomDiv.addEventListener("change", autosave);
        sec.appendChild(huomDiv);

        // ✅ Havainnot
        sec.appendChild(createDropdown(osio, "havainnot"));

        // ✅ Toimenpiteet
        sec.appendChild(createDropdown(osio, "toimenpiteet"));

        root.appendChild(sec);
    });
}

/* ==========================================================
    HUONEISTON LATAUS R2:sta
========================================================== */

async function loadApartment(i) {
    if (!kohdeId || huoneistoLista.length === 0) return;

    const apt = huoneistoLista[i];
    document.getElementById("currentAptInput").value = apt;

    const slug = slugify(apt);

    try {
        const res = await fetch(
            `https://massakostis-backend-production-9111.up.railway.app/get-apartment/${kohdeId}/${slug}`
        );

        if (res.status === 404) {
            clearApartmentForm();
            return;
        }

        const data = await res.json();
        fillApartmentForm(data);

    } catch {
        showStatus("Ei yhteyttä", "status_kartoitus");
    }
}

function fillApartmentForm(data) {
    const fields = document.querySelectorAll("#dynaamiset_osiot input, #dynaamiset_osiot textarea, #dynaamiset_osiot select");

    fields.forEach(el => {
        if (el.type === "radio") {
            if (data[el.name] === el.value) el.checked = true;
        } else if (data[el.id] !== undefined) {
            el.value = data[el.id];
        }
    });
}

function clearApartmentForm() {
    const fields = document.querySelectorAll("#dynaamiset_osiot input, #dynaamiset_osiot textarea, #dynaamiset_osiot select");
    fields.forEach(el => {
        if (el.type === "radio") {
            if (el.value === "Ei") el.checked = true;
        } else {
            el.value = "";
        }
    });
}

/* ==========================================================
    AUTOSAVE = TALLENNA JOKA MUUTOKSESTA
========================================================== */

function autosave() {
    saveApartmentData();
}

function collectApartmentData() {
    const root = document.getElementById("dynaamiset_osiot");
    const data = {};

    const fields = root.querySelectorAll("input, textarea, select");
    fields.forEach(el => {
        if (el.type === "radio") {
            if (el.checked) data[el.name] = el.value;
        } else {
            data[el.id] = el.value;
        }
    });

    return data;
}

async function saveApartmentData() {
    if (!kohdeId) return;
    if (huoneistoLista.length === 0) return;

    const aptLabel = huoneistoLista[currentApartmentIndex];
    const slug = slugify(aptLabel);

    const data = collectApartmentData();
    data.huoneisto = aptLabel;

    try {
        await fetch("https://massakostis-backend-production-9111.up.railway.app/upload-data", {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({
                kohde_id: kohdeId,
                huoneisto_slug: slug,
                data
            })
        });

        showStatus("Tallennettu ✅", "status_kartoitus");

    } catch {
        showStatus("Ei yhteyttä – tallennetaan myöhemmin", "status_kartoitus");
    }
}

/* ==========================================================
    HUONEISTONAVIGOINTI (← A12 →)
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
    const input = document.getElementById("currentAptInput").value.trim();
    const idx = huoneistoLista.indexOf(input);

    if (idx !== -1) {
        currentApartmentIndex = idx;
        loadApartment(idx);
    }
});
/* ==========================================================
    KUVIEN LATAUSLOGIIKKA
========================================================== */
async function uploadApartmentImage(index) {
    if (!kohdeId) {
        alert("Täytä perustiedot ensin.");
        return;
    }
    if (huoneistoLista.length === 0) {
        alert("Lisää rappu ja huoneistot ensin.");
        return;
    }

    const aptLabel = huoneistoLista[currentApartmentIndex];
    const slug = slugify(aptLabel);

    const fileInput = document.getElementById(`kuva${index}`);
    const file = fileInput.files[0];
    if (!file) return; // ei kuvaa → ei toimintaa

    const form = new FormData();
    form.append("kohde_id", kohdeId);
    form.append("huoneisto_slug", slug);
    form.append("index", index);      // "1" tai "2"
    form.append("file", file);

    try {
        await fetch(
            "https://massakostis-backend-production-9111.up.railway.app/upload-image",
            {
                method: "POST",
                body: form
            }
        );

        showStatus(`Kuva ${index} tallennettu ✅`, "status_kartoitus");

    } catch (err) {
        console.error(err);
        showStatus("Kuvan tallennus epäonnistui (ei yhteyttä)", "status_kartoitus");
    }
}

/* ==========================================================
    LATAA KOHDELISTA SIVUN LADATESSA
========================================================== */

window.addEventListener("load", () => {
    haeKohteet();
});

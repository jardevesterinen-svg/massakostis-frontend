/* ----------------------------------------------------------
   GLOBAALIT TILAMUUTTUJAT
-----------------------------------------------------------*/

let kohdeId = null;                 // esim. "asoy-merikotka-2026-04-05"
let rappuLista = [];                // [{ rappu:"A", alku:1, loppu:24 }]
let huoneistoLista = [];            // ["A1","A2","A3"]
let currentApartmentIndex = 0;      // minkä huoneiston tiedot näkyvät

let LAUSELISTA = {};                // lauseet.json sisältö

/* ----------------------------------------------------------
   LAUSEET.LOA
-----------------------------------------------------------*/

async function loadLauseet() {
    const res = await fetch("lauseet.json");
    LAUSELISTA = await res.json();
}
loadLauseet();

/* ----------------------------------------------------------
   APUFUNKTIOT
-----------------------------------------------------------*/

function slugify(text) {
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function showStatus(msg, elementId = "status") {
    const el = document.getElementById(elementId);
    el.textContent = msg;
    setTimeout(() => el.textContent = "", 3000);
}

/* ----------------------------------------------------------
   TABS
-----------------------------------------------------------*/

document.getElementById("tabPerustiedot").addEventListener("click", () => {
    document.getElementById("perustiedotTab").style.display = "block";
    document.getElementById("kartoitusTab").style.display = "none";
    document.getElementById("tabPerustiedot").classList.add("active");
    document.getElementById("tabKartoitus").classList.remove("active");
});

document.getElementById("tabKartoitus").addEventListener("click", () => {
    if (!kohdeId) {
        alert("Täytä perustiedot ensin.");
        return;
    }

    document.getElementById("perustiedotTab").style.display = "none";
    document.getElementById("kartoitusTab").style.display = "block";
    document.getElementById("tabPerustiedot").classList.remove("active");
    document.getElementById("tabKartoitus").classList.add("active");

    buildApartmentForm();
    loadApartment(currentApartmentIndex);
});

/* ----------------------------------------------------------
   KOHDE-ID
-----------------------------------------------------------*/

function updateKohdeId() {
    const nimi = document.getElementById("kohde_nimi").value.trim();
    const paiva = document.getElementById("kohde_paiva").value.trim();
    if (!nimi || !paiva) return null;

    kohdeId = `${slugify(nimi)}-${paiva}`;
    return kohdeId;
}

/* ----------------------------------------------------------
   METADATA
-----------------------------------------------------------*/

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

/* ----------------------------------------------------------
   RAPPU + HUONEISTOLOGIIKKA
-----------------------------------------------------------*/

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
        const div = document.createElement("div");
        div.className = "rappu-row";
        div.style.marginBottom = "5px";

        div.innerHTML = `
            <div style="flex:1;"><strong>${r.rappu}</strong> (${r.alku}–${r.loppu})</div>
            <button class="btn" style="background:#8e44ad" onclick="editRappu(${idx})">Muokkaa</button>
            <button class="btn" style="background:#c0392b" onclick="deleteRappu(${idx})">Poista</button>
        `;

        cont.appendChild(div);
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

/* ----------------------------------------------------------
   KARTAITUSLOMAKE (DYNAAMINEN) 
-----------------------------------------------------------*/

function createDropdown(osio, tyyppi) {
    const wrap = document.createElement("div");
    wrap.style.marginBottom = "20px";

    wrap.innerHTML = `<label>${tyyppi === "havainnot" ? "Havainnot" : "Toimenpiteet"}</label>`;

    const select = document.createElement("select");
    select.id = `${osio}_${tyyppi}_select`;
    wrap.appendChild(select);

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "– valitse –";
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

        // Kuntoluokka
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

        // Huomiovaatimus
        sec.innerHTML += `<div style="margin-top:10px;">Välittömästi huomiota vaativa:</div>`;
        const huomDiv = document.createElement("div");
        huomDiv.innerHTML = `
            <label><input type="radio" name="${osio}_huomio" value="Kyllä"> Kyllä</label>
            <label><input type="radio" name="${osio}_huomio" value="Ei" checked> Ei</label>
        `;
        huomDiv.addEventListener("change", autosave);
        sec.appendChild(huomDiv);

        sec.appendChild(createDropdown(osio, "havainnot"));
        sec.appendChild(createDropdown(osio, "toimenpiteet"));

        root.appendChild(sec);
    });
}

/* ----------------------------------------------------------
   HUONEISTON LATAUS R2:STA
-----------------------------------------------------------*/

async function loadApartment(i) {
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

    Object.keys(data).forEach(k => {
        const el = document.getElementById(k);
        if (el) {
            el.value = data[k];
        }

        // radio
        if (k.endsWith("_huomio")) {
            const radios = document.getElementsByName(k);
            radios.forEach(r => {
                r.checked = (r.value === data[k]);
            });
        }
    });
}

function clearApartmentForm() {
    const fields = document.querySelectorAll("#dynaamiset_osiot input, #dynaamiset_osiot textarea, #dynaamiset_osiot select");
    fields.forEach(f => {
        if (f.type === "radio") {
            if (f.value === "Ei") f.checked = true;
        } else {
            f.value = "";
        }
    });
}

/* ----------------------------------------------------------
   AUTOSAVE (reaaliaikainen)
-----------------------------------------------------------*/

function autosave() {
    saveApartmentData();
}

async function saveApartmentData() {
    if (!kohdeId) return;
    if (huoneistoLista.length === 0) return;

    const aptLabel = huoneistoLista[currentApartmentIndex];
    const slug = slugify(aptLabel);

    const data = collectApartmentData();
    data.huoneisto = aptLabel;

    try {
        await fetch(
            "https://massakostis-backend-production-9111.up.railway.app/upload-data",
            {
                method: "POST",
                headers: { "Content-Type":"application/json" },
                body: JSON.stringify({
                    kohde_id: kohdeId,
                    huoneisto_slug: slug,
                    data
                })
            }
        );

        showStatus("Tallennettu ✅", "status_kartoitus");

    } catch {
        showStatus("Ei yhteyttä – tallennetaan myöhemmin", "status_kartoitus");
    }
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

/* ----------------------------------------------------------
   NAVIGOINTI NUOLILLA
-----------------------------------------------------------*/

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

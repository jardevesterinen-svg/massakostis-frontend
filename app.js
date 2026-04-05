/* ----------------------------------------------------------
   GLOBAALIT TILAMUUTTUJAT
-----------------------------------------------------------*/

let kohdeId = null;                 // esim. "asoy-merikotka-2026-04-05"
let rappuLista = [];                // { rappu: "Talo A", alku: 1, loppu: 24 }
let huoneistoLista = [];            // ["Talo A1","Talo A2", ...]
let currentApartmentIndex = 0;      // minkä huoneiston data on näkyvissä

/* ----------------------------------------------------------
   APUFUNKTIOT
-----------------------------------------------------------*/

// Tekee merkkijonosta URL-ystävällisen tunnisteen
function slugify(text) {
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// Näytä statusviesti
function showStatus(msg, elementId = "status") {
    document.getElementById(elementId).textContent = msg;
    setTimeout(() => {
        document.getElementById(elementId).textContent = "";
    }, 3000);
}

/* ----------------------------------------------------------
   VÄLILEHTIEN VAIHTO
-----------------------------------------------------------*/

document.getElementById("tabPerustiedot").addEventListener("click", () => {
    document.getElementById("perustiedotTab").style.display = "block";
    document.getElementById("kartoitusTab").style.display = "none";
    document.getElementById("tabPerustiedot").classList.add("active");
    document.getElementById("tabKartoitus").classList.remove("active");
});

document.getElementById("tabKartoitus").addEventListener("click", () => {

    if (!kohdeId) {
        alert("Täytä ensin perustiedot: kohteen nimi ja tarkastuspäivä.");
        return;
    }

    document.getElementById("perustiedotTab").style.display = "none";
    document.getElementById("kartoitusTab").style.display = "block";
    document.getElementById("tabPerustiedot").classList.remove("active");
    document.getElementById("tabKartoitus").classList.add("active");

    loadApartment(currentApartmentIndex);
});

/* ----------------------------------------------------------
   KOHDE-ID:N MUODOSTUS
-----------------------------------------------------------*/

function updateKohdeId() {
    const nimi = document.getElementById("kohde_nimi").value.trim();
    const paiva = document.getElementById("kohde_paiva").value.trim();
    if (!nimi || !paiva) return null;

    const slug = slugify(nimi);
    kohdeId = `${slug}-${paiva}`;
    return kohdeId;
}

/* ----------------------------------------------------------
   METADATA-TALLENNUS R2:EEN (AUTOMAATTINEN)
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kohde_id: kohdeId, metadata })
        });

        showStatus("Perustiedot tallennettu ✅");
    } catch (err) {
        console.error(err);
        showStatus("Ei yhteyttä – tallennetaan myöhemmin", "status");
    }
}

/* ----------------------------------------------------------
   RAPPUJEN LISÄYS, MUOKKAUS JA POISTO
-----------------------------------------------------------*/

function renderRappuLista() {
    const container = document.getElementById("rappuListaContainer");
    container.innerHTML = "";

    rappuLista.forEach((r, index) => {
        const row = document.createElement("div");
        row.className = "rappu-row";
        row.style.marginBottom = "5px";

        row.innerHTML = `
            <div style="flex: 1;">
                <strong>${r.rappu}</strong> (${r.alku} – ${r.loppu})
            </div>
            <button class="btn" style="background:#8e44ad" onclick="editRappu(${index})">Muokkaa</button>
            <button class="btn" style="background:#c0392b" onclick="deleteRappu(${index})">Poista</button>
        `;

        container.appendChild(row);
    });
}

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

document.getElementById("btnLisaRappu").addEventListener("click", () => {
    const rappu = document.getElementById("rappu_nimi").value.trim();
    const alku = parseInt(document.getElementById("rappu_alku").value);
    const loppu = parseInt(document.getElementById("rappu_loppu").value);

    if (!rappu || isNaN(alku) || isNaN(loppu) || alku > loppu) {
        alert("Tarkista rappunimi ja alku/loppu numerot.");
        return;
    }

    rappuLista.push({ rappu, alku, loppu });
    regenerateApartments();
    renderRappuLista();
    saveMetadata();
});

/* ----------------------------------------------------------
   RAPPUJEN MUOKKAUS
-----------------------------------------------------------*/

function editRappu(index) {
    const r = rappuLista[index];

    const newName = prompt("Rappu (esim. Talo A):", r.rappu);
    if (!newName) return;

    const newStart = parseInt(prompt("Huoneiston alku:", r.alku));
    const newEnd = parseInt(prompt("Huoneiston loppu:", r.loppu));
    if (isNaN(newStart) || isNaN(newEnd) || newStart > newEnd) {
        alert("Virhe alku/loppu arvoissa.");
        return;
    }

    rappuLista[index] = { rappu: newName.trim(), alku: newStart, loppu: newEnd };
    regenerateApartments();
    renderRappuLista();
    saveMetadata();
}

/* ----------------------------------------------------------
   RAPPUJEN POISTO
-----------------------------------------------------------*/

function deleteRappu(index) {
    if (!confirm("Poistetaanko tämä rappu?")) return;

    rappuLista.splice(index, 1);
    regenerateApartments();
    renderRappuLista();
    saveMetadata();
}

/* ----------------------------------------------------------
   APARTMENT NAVIGATION
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

/* ----------------------------------------------------------
   HUONEISTON LATAUS R2:STA
-----------------------------------------------------------*/

async function loadApartment(index) {
    if (!kohdeId || huoneistoLista.length === 0) return;

    const aptLabel = huoneistoLista[index];
    document.getElementById("currentAptInput").value = aptLabel;

    const slug = slugify(aptLabel);

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

    } catch (err) {
        console.error(err);
        showStatus("Ei yhteyttä – näytetään tyhjä lomake");
    }
}

/* ----------------------------------------------------------
   LOMAKKEEN ESI- JA TYHJENTÄMINEN
-----------------------------------------------------------*/

function fillApartmentForm(data) {
    // TODO: Täytetään kartoituslomakkeen kentät seuraavassa versiossa
}

function clearApartmentForm() {
    // TODO: Tyhjennä lomake — seuraava versio
}

/* ----------------------------------------------------------
   AUTOSAVE – TALLENNA JOKA MUUTOKSESTA
-----------------------------------------------------------*/

function autosave() {
    if (!kohdeId) return;
    saveApartmentData();
}

async function saveApartmentData() {
    if (!kohdeId) return;

    const aptLabel = huoneistoLista[currentApartmentIndex];
    const slug = slugify(aptLabel);

    const data = {
        huoneisto: aptLabel,
        // TODO: lisää kartoituslomakkeen dynaamiset kentät
    };

    try {
        await fetch("https://massakostis-backend-production-9111.up.railway.app/upload-data", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ kohde_id: kohdeId, huoneisto_slug: slug, data })
        });

        showStatus("Tallennettu ✅", "status_kartoitus");

    } catch (err) {
        console.log(err);
        showStatus("Ei yhteyttä – tallennetaan myöhemmin", "status_kartoitus");
    }
}

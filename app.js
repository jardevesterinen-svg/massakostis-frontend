/* ==========================================================
    ASETUKSET — PUBLIC R2 URL
========================================================== */

const isDev = window.location.hostname !== "massakostis-frontend.pages.dev";

const PUBLIC_URL = isDev
  ? "https://pub-b2df8ec4cb9c4142a608f7618ac6ec66.r2.dev"
  : "https://pub-9f421e06dc9f4bd49ae0adcf5690c438.r2.dev"

const API_URL = isDev
  ? "https://massakostis-backend-dev-development.up.railway.app"
  : "https://massakostis-backend-production-9111.up.railway.app";

console.log("HOST:", window.location.hostname);
console.log("isDev:", isDev);
console.log("API_URL:", API_URL);

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
let bathroomCounts = {};
let extraBathrooms = [];

/* ==========================================================
    LAUSELISTA
========================================================== */

async function loadLauseet() {
    const res = await fetch("lauseet.json");
    LAUSELISTA = await res.json();
}
window.addEventListener("load", async () => {
    console.log("🚀 sivu ladattu");

    await loadLauseet();   // ⭐ ODOTETAAN
    console.log("✅ lauseet ladattu");

    buildApartmentForm();  // ⭐ nyt data on olemassa
    console.log("✅ formi rakennettu");

    bindMaterialAutosave();
    bindMetadataAutosave();
    haeKohteet();
    
    document.getElementById("btnCreatePdf").addEventListener("click", () => {
    console.log("📄 PDF nappia painettu");

    if (!kohdeId) {
        alert("Täytä ensin kohteen tiedot.");
        return;
    }
    const checkbox = document.getElementById("ei_tarkastettu");

    if (checkbox) {
        console.log("✅ checkbox löytyi loadissa");
    
        checkbox.addEventListener("change", function () {
            console.log("🔥 CHANGE toimii:", this.checked);
            toggleEiTarkastettu(this.checked);
            autosave();
        });
    }
    bindMetadataAutosave();
    generatePDF(kohdeId);
    });    
});

/* ==========================================================
    APUFUNKTIOT
========================================================== */

function bindMetadataAutosave() {
    const fields = document.querySelectorAll(
        "#perustiedotTab input, #perustiedotTab textarea"
    );

    console.log("🔵 löytyi kenttiä:", fields.length); // 🔥

    fields.forEach(el => {
        el.addEventListener("input", () => {
            console.log("🟢 autosave trigger:", el.id);
            saveMetadata();
        });
    });
}

function getBaseName(apt) {
    return apt.replace(/-\d+$/, "");
}

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

function toggleEiTarkastettu(checked) {
    console.log("🔥 toggleEiTarkastettu:", checked);
    console.log("🔥 toggle:", checked);
    const form = document.querySelector(".form-wrapper");
    const textarea = document.getElementById("ei_tarkastettu_syy");

    if (!form) return;

    if (checked) {
        form.classList.add("form-disabled");
        if (textarea) textarea.style.display = "block";  // ✅ näytä
    } else {
        form.classList.remove("form-disabled");
        if (textarea) {
            textarea.style.display = "none";
            textarea.value = ""; // ✅ tyhjennä
        }
    }
}

function bindEiTarkastettu() {
    const checkbox = document.getElementById("ei_tarkastettu");

    if (!checkbox) {
        console.log("❌ checkboxia ei vielä DOMissa");
        return;
    }

    console.log("✅ checkbox bindattu");

    checkbox.addEventListener("change", function () {
        console.log("🔥 toimii nyt:", this.checked);
        toggleEiTarkastettu(this.checked);
        autosave();
    });
}

function toggleMuu(prefix) {
    const muuField = document.getElementById(prefix + "_muu");
    const radios = document.querySelectorAll(`#${prefix} input[type="radio"]`);

    let show = false;

    radios.forEach(r => {
        if (r.checked && r.value === "Muu") {
            show = true;
        }
    });

    if (muuField) {
        muuField.style.display = show ? "block" : "none";
        if (!show) muuField.value = "";
    }
}

async function generatePDF(kohdeId) {
    const overlay = document.getElementById("pdfOverlay");
    if (!overlay) return;

    overlay.style.display = "flex";

    await new Promise(requestAnimationFrame);

    try {
        const res = await fetch(
            `${API_URL}/generate-report/${kohdeId}`,
            { method: "POST" }
        );

        const data = await res.json();

        if (!data.url) return;

        // ✅ TARKISTETAAN ONKO MOBIILI
        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            // 📱 mobiili → sama välilehti
            window.location.href = data.url;
        } else {
            // 💻 desktop → uusi välilehti
            window.open(data.url, "_blank");
        }

    } catch (err) {
        console.error(err);
    } finally {
        overlay.style.display = "none";
    }
}

function compressImage(file, maxWidth = 1600, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = e => img.src = e.target.result;
        reader.readAsDataURL(file);

        img.onload = () => {
            const canvas = document.createElement("canvas");

            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = height * (maxWidth / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(blob => resolve(blob), "image/jpeg", quality);
        };
    });
}

function bindMaterialAutosave() {
    console.log("🔗 bindMaterialAutosave() kutsuttu");
    const eiTarkastettu = document.getElementById("ei_tarkastettu");

    if (eiTarkastettu) {
        eiTarkastettu.addEventListener("change", () => {
            console.log("✅ Ei tarkastettu toggle");
            
            toggleEiTarkastettu(eiTarkastettu.checked);
            autosave();
        });
    }
    const syy = document.getElementById("ei_tarkastettu_syy");

    if (syy) {
        syy.addEventListener("input", () => {
            console.log("✅ Ei tarkastettu syy tallennettu");
            autosave();
        });
    }
    // Vesiputket
    document.querySelectorAll('input[name="materiaalit_vesiputket"]').forEach(cb => {
        cb.addEventListener("change", () => {
            console.log("✅ Vesiputki muuttui");
            autosave();
        });
    });

    // Lämpöputket
    document.querySelectorAll('input[name="materiaalit_lampoputket"]').forEach(cb => {
        cb.addEventListener("change", () => {
            console.log("✅ Lämpöputki muuttui");
            autosave();
        });
    });

    // Lattia
    document.querySelectorAll('input[name="materiaalit_lattia_valinta"]').forEach(rb => {
        rb.addEventListener("change", () => {
            console.log("✅ Lattia muuttui");
            autosave();
        });
    });

    // Seinät
    document.querySelectorAll('input[name="materiaalit_seinat_valinta"]').forEach(rb => {
        rb.addEventListener("change", () => {
            console.log("✅ Seinät muuttuivat");
            autosave();
        });
    });

    // Katto
    document.querySelectorAll('input[name="materiaalit_katto_valinta"]').forEach(rb => {
        rb.addEventListener("change", () => {
            console.log("✅ Katto muuttui");
            autosave();
        });
    });
    
    // Pintarakenteiden ikä
    document.querySelectorAll('input[name="pintarakenteiden_ika"]').forEach(rb => {
        rb.addEventListener("change", () => {
            console.log("✅ Pintarakenteiden ikä muuttui");
            autosave();
        });
    });

    // Märkätilan käyttöikä autosave
    document.querySelectorAll('input[name="kayttoika_jaljella"]').forEach(rb => {
        rb.addEventListener("change", () => {
            console.log("✅ Käyttöikä muuttui");
            autosave();
        });
    });

    // Muu-kentät
    document.querySelectorAll('input[id*="_muu"]').forEach(field => {
        field.addEventListener("change", () => {
            console.log("✅ Muu-kenttä muuttui");
            autosave();
        });
    });
    
    document.querySelectorAll('input[name="kokonaiskunto"]').forEach(rb => {
    rb.addEventListener("change", () => {
        console.log("✅ kokonaiskunto muuttui");
        autosave();
    });
});
``
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
    bindEiTarkastettu();
    loadApartment(currentApartmentIndex);
});

/* ==========================================================
    KOHTEIDEN HAKU + SUODATUS
========================================================== */

async function haeKohteet() {
    try {
        const res = await fetch(
        `${API_URL}/list-kohteet`
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
        `${API_URL}/get-metadata/${id}`
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
    extraBathrooms = meta.extraBathrooms || [];
    bathroomCounts = meta.bathroomCounts || {};

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
        huoneistot: huoneistoLista,
        extraBathrooms: extraBathrooms,
        bathroomCounts: bathroomCounts

    };

    try {
        await fetch(
            `${API_URL}/save-metadata`,
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

async function previewKansikuva() {
    const input = document.getElementById("kansikuva");
    const prev = document.getElementById("kansiPreview");

    const file = input.files[0];

    if (!file) {
        prev.style.display = "none";
        prev.src = "";
        return;
    }

    // 🔴 tämä siirrettiin tänne
    const compressed = await compressImage(file);

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
    
    const compressed = await compressImage(file);
    
    console.log("Original size:", file.size);
    console.log("Compressed size:", compressed.size);

    const form = new FormData();
    form.append("kohde_id", kohdeId);
    form.append("file", compressed, "image.jpg");

    await fetch(
        `${API_URL}/upload-kansikuva`,
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

    let baseList = [];

    // ✅ 1. peruslista
    rappuLista.forEach(r => {
        for (let i = r.alku; i <= r.loppu; i++) {
            baseList.push(`${r.rappu}${i}`);
        }
    });

    // ✅ 2. rakentaa lopullinen lista oikein järjestyksessä
    let finalList = [];

    baseList.forEach(base => {

        // etsi kaikki tähän baseen kuuluvat kylppärit
        const extras = extraBathrooms
            .filter(e => getBaseName(e) === base)
            .sort((a, b) => {
                const aNum = parseInt(a.split("-")[1]);
                const bNum = parseInt(b.split("-")[1]);
                return aNum - bNum;
            });

        if (extras.length > 0) {
            // ✅ korvaa A1 → A1-1, A1-2...
            finalList.push(...extras);
        } else {
            finalList.push(base);
        }
    });

    huoneistoLista = finalList;

    console.log("✅ FINAL LIST:", huoneistoLista);

    document.getElementById("huoneistoLista").textContent =
        huoneistoLista.join(", ");

}

function päivitaRappuJarjestys() {
    const rows = document.querySelectorAll("#rappuListaContainer .rappu-row");

    const uusiLista = [];

    rows.forEach(row => {

        const id = row.dataset.id;

        const found = rappuLista.find(r => 
            `${r.rappu}_${r.alku}_${r.loppu}` === id
        );

        if (found) {
            uusiLista.push(found);
        }
    });

    rappuLista = uusiLista;

    console.log("✅ uusi rappuLista:", rappuLista);

    regenerateApartments();
    saveMetadata();
}


function renderRappuLista() {
    const c = document.getElementById("rappuListaContainer");
    c.innerHTML = "";

    rappuLista.forEach((r, idx) => {
        const div = document.createElement("div");
        div.className = "rappu-row";
        div.dataset.index = idx;
        div.dataset.id = `${r.rappu}_${r.alku}_${r.loppu}`;

        div.innerHTML = `
            <span class="drag-handle">☰</span>
            <div style="flex:1;"><strong>${r.rappu}</strong> (${r.alku}–${r.loppu})</div>
            <button class="btn" style="background:#8e44ad" onclick="editRappu(${idx})">Muokkaa</button>
            <button class="btn" style="background:#c0392b" onclick="deleteRappu(${idx})">Poista</button>
        `;

        c.appendChild(div);
    });
   
    new Sortable(c, {
        handle: ".drag-handle",   // 👈 kahva
        animation: 150,
        fallbackOnBody: true,     // 👈 mobiilivarmempi
        delay: 100,               // 👈 estää väärät dragit mobiilissa
        onEnd: päivitaRappuJarjestys
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
    console.log("🔥 buildApartmentForm() käynnistyi");
    console.log("BUILD START:", huoneistoLista);
    const root = document.getElementById("dynaamiset_osiot");
    
    if (!root) {
        console.log("❌ dynaamiset_osiot EI löydy");
        return;
    }

    root.innerHTML = "";

    const osiot = Object.keys(LAUSELISTA)
        .map(k=>k.replace("_havainnot","").replace("_toimenpiteet",""))
        .filter((v,i,a)=>a.indexOf(v)===i);

    osiot.forEach(osio => {
        let sec = document.createElement("div");
        
        // ✅ Käytä appendChild kaikkiin
        const title = document.createElement("h3");
        title.textContent = osio.replace(/_/g," ").toUpperCase();
        sec.appendChild(title);

        const label1 = document.createElement("label");
        label1.textContent = "Kuntoluokka:";
        sec.appendChild(label1);

        const ks = document.createElement("select");
        ks.id = `kuntoluokka__${osio}`;
        
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
        
        ks.addEventListener("change", (e) => {
            console.log("🔵 Select change -event:", ks.id, "uusi arvo:", ks.value);
            autosave();
        });
        sec.appendChild(ks);

        const div2 = document.createElement("div");
        div2.style.marginTop = "10px";
        div2.textContent = "Välittömästi huomiota vaativa:";
        sec.appendChild(div2);

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
    if (!apt) {
        console.log("❌ Huoneisto ei ole olemassa indeksillä", i);
        return;
    }
    
    const localKey = `offline_${kohdeId}_${apt}`;
    const slug = slugify(apt);
    
    console.log("🔵 loadApartment kutsuttu:", apt, "slug:", slug);
    
    isLoadingApartment = true;
    
    currentApartmentIndex = i;
    document.getElementById("currentAptInput").value = apt;

    // ✅ NOLLAA AINA ENSIN
    clearApartmentForm();
    console.log("🧹 Lomake tyhjennetty");

    // 1️⃣ Tarkista offline-tallennus ensin
    if (localStorage.getItem(localKey)) {
        console.log("💾 Offline-tallennus löytyi!");
        const local = JSON.parse(localStorage.getItem(localKey));
        fillApartmentForm(local.data);
        loadImagePreview(slug);
        isLoadingApartment = false;
        return;
    }

    // 2️⃣ Yritä noutaa palvelimelta
    try {
        console.log("🌐 Noudetaan palvelimelta...");
        const res = await fetch(
            `${API_URL}/get-apartment/${kohdeId}/${slug}`
        );
        
        console.log("📡 Palvelin vastasi:", res.status);

        if (res.status === 200) {
            const data = await res.json();
            console.log("📦 Palvelimen data:", data);
            fillApartmentForm(data);
        }

    } catch (err) {
        console.log("🔴 Virhe:", err);
        showStatus("Ei yhteyttä", "status_kartoitus");
    }

    document.getElementById("kuva1").value = "";
    document.getElementById("kuva2").value = "";
    loadImagePreview(slug);
    isLoadingApartment = false;
}
console.log("btn löytyy:", document.getElementById("btnAddBathroom"));

document.getElementById("btnAddBathroom").addEventListener("click", () => {

    const apt = huoneistoLista[currentApartmentIndex];
    if (!apt) return;

    const base = getBaseName(apt);

    let count = bathroomCounts[base] || 1;
    count++;

    bathroomCounts[base] = count;

    // ✅ ensimmäinen lisäys
    if (count === 2) {
        huoneistoLista = huoneistoLista.filter(a => a !== base);
        extraBathrooms.push(`${base}-1`);
    }

    // ✅ uusi kylppäri
    const newApt = `${base}-${count}`;
    extraBathrooms.push(newApt);

    regenerateApartments();
    saveMetadata();
  
});

async function loadImagePreview(slug) {

    const p1 = document.getElementById("preview1");
    const p2 = document.getElementById("preview2");

    const ts = Date.now();

    const url1 = `${PUBLIC_URL}/kohteet/${kohdeId}/huoneistot/${slug}/kuva1.jpg`;
    const url2 = `${PUBLIC_URL}/kohteet/${kohdeId}/huoneistot/${slug}/kuva2.jpg`;

    // ✅ tyhjennä aina ensin (tärkein!)
    p1.src = "";
    p1.style.display = "none";

    p2.src = "";
    p2.style.display = "none";

    try {
        const res1 = await fetch(url1, { method: "HEAD" });
        if (res1.ok) {
            p1.src = url1 + "?t=" + ts;
            p1.style.display = "block";
        }
    } catch {}

    try {
        const res2 = await fetch(url2, { method: "HEAD" });
        if (res2.ok) {
            p2.src = url2 + "?t=" + ts;
            p2.style.display = "block";
        }
    } catch {}
}

async function removeImage(num) {

    const input = document.getElementById("kuva" + num);
    const preview = document.getElementById("preview" + num);

    input.value = "";
    preview.src = "";
    preview.style.display = "none";

    const filename = `kuva${num}.jpg`;
    const apt = huoneistoLista[currentApartmentIndex];

    console.log("DELETE ->", {
        kohdeId,
        huoneisto: apt,
        filename
    });

    try {
        const res = await fetch(`${API_URL}/delete-image`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                kohdeId,
                huoneisto: apt,
                filename
            })
        });

        console.log("STATUS:", res.status);

        if (!res.ok) {
            console.error("❌ backend virhe");
        } else {
            console.log("✅ poistettu myös R2:sta");
        }

    } catch (err) {
        console.error("❌ backend delete failed", err);
    }
}


function fillApartmentForm(data) {
    console.log("📝 fillApartmentForm() kutsuttu, data:", data);
    // ✅ Ei tarkastettu
    const eiTark = document.getElementById("ei_tarkastettu");
    
    if (eiTark) {
        eiTark.checked = !!data["ei_tarkastettu"];
        toggleEiTarkastettu(eiTark.checked);
    }
    if (data["ei_tarkastettu_syy"]) {
        const syyEl = document.getElementById("ei_tarkastettu_syy");
        if (syyEl) {
            syyEl.value = data["ei_tarkastettu_syy"];
            syyEl.style.display = "block";
        }
    }
    const fields = document.querySelectorAll(
        "#dynaamiset_osiot input, #dynaamiset_osiot textarea, #dynaamiset_osiot select"
    );

    fields.forEach(el => {
        if (el.type === "radio") {
            if (data[el.name] === el.value) el.checked = true;
        } 
        else if (el.tagName === "SELECT") {
            if (data[el.id] !== undefined) {
                el.value = data[el.id];
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        else if (data[el.id] !== undefined) {
            el.value = data[el.id];
        }
    });
    document.querySelectorAll('input[name="pintarakenteiden_ika"]').forEach(rb => rb.checked = false);
    document.querySelectorAll('input[name="kayttoika_jaljella"]').forEach(rb => rb.checked = false);
    // ✅ MATERIAALIEN KÄSITTELY - EI .get() !

    // Lattia
    if (data["materiaalit_lattia_valinta"]) {
        const el = document.querySelector(`input[name="materiaalit_lattia_valinta"][value="${data["materiaalit_lattia_valinta"]}"]`);
        if (el) el.checked = true;
    }
    if (data["materiaalit_lattia_muu"]) {
        const muuEl = document.getElementById("materiaalit_lattia_muu");
        if (muuEl) muuEl.value = data["materiaalit_lattia_muu"];
    }

    // Seinät
    if (data["materiaalit_seinat_valinta"]) {
        const el = document.querySelector(`input[name="materiaalit_seinat_valinta"][value="${data["materiaalit_seinat_valinta"]}"]`);
        if (el) el.checked = true;
    }
    if (data["materiaalit_seinat_muu"]) {
        const muuEl = document.getElementById("materiaalit_seinat_muu");
        if (muuEl) muuEl.value = data["materiaalit_seinat_muu"];
    }

    // Katto
    if (data["materiaalit_katto_valinta"]) {
        const el = document.querySelector(`input[name="materiaalit_katto_valinta"][value="${data["materiaalit_katto_valinta"]}"]`);
        if (el) el.checked = true;
    }
    if (data["materiaalit_katto_muu"]) {
        const muuEl = document.getElementById("materiaalit_katto_muu");
        if (muuEl) muuEl.value = data["materiaalit_katto_muu"];
    }

    // Vesiputket
    document.querySelectorAll('input[name="materiaalit_vesiputket"]').forEach(cb => cb.checked = false);
    if (data["materiaalit_vesiputket"]) {
        const vals = Array.isArray(data["materiaalit_vesiputket"]) ? data["materiaalit_vesiputket"] : [data["materiaalit_vesiputket"]];
        vals.forEach(val => {
            const el = document.querySelector(`input[name="materiaalit_vesiputket"][value="${val}"]`);
            if (el) el.checked = true;
        });
    }

    // Lämpöputket
    document.querySelectorAll('input[name="materiaalit_lampoputket"]').forEach(cb => cb.checked = false);
    if (data["materiaalit_lampoputket"]) {
        const vals = Array.isArray(data["materiaalit_lampoputket"]) ? data["materiaalit_lampoputket"] : [data["materiaalit_lampoputket"]];
        vals.forEach(val => {
            const el = document.querySelector(`input[name="materiaalit_lampoputket"][value="${val}"]`);
            if (el) el.checked = true;
        });
    }
    
    // Pintarakenteiden ikä
    if (data["pintarakenteiden_ika"]) {
        const el = document.querySelector(
            `input[name="pintarakenteiden_ika"][value="${data["pintarakenteiden_ika"]}"]`
        );
        if (el) el.checked = true;
    }

    // ✅ Märkätilan jäljellä oleva käyttöikä
    if (data["kayttoika_jaljella"]) {
        const el = document.querySelector(
            `input[name="kayttoika_jaljella"][value="${data["kayttoika_jaljella"]}"]`
        );
        if (el) el.checked = true;
    }

    if (data["kokonaiskunto"]) {
    const el = document.querySelector(
        `input[name="kokonaiskunto"][value="${data["kokonaiskunto"]}"]`
    );
    if (el) el.checked = true;
}
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
     const syy = document.getElementById("ei_tarkastettu_syy");
    if (syy) {
        syy.value = "";
        syy.style.display = "none";
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

    document.querySelectorAll('input[name="kokonaiskunto"]')
    .forEach(rb => rb.checked = false);
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
async function syncCurrentApartment() {
    const apt = huoneistoLista[currentApartmentIndex];
    const key = `offline_${kohdeId}_${apt}`;

    if (!localStorage.getItem(key)) return;
    if (!navigator.onLine) return;

    const payload = JSON.parse(localStorage.getItem(key));

    await fetch(
        `${API_URL}/upload-data`,
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
}

function saveApartmentData() {
    const currentApt = huoneistoLista[currentApartmentIndex];
    const data = collectApartmentData();

    if (!currentApt || !kohdeId) {
        console.log("❌ currentApt tai kohdeId puuttuu");
        return;
    }

    console.log("🌐 Lähetetään palvelimelle:", {
        kohde_id: kohdeId,
        huoneisto_slug: slugify(currentApt),
        data: data
    });

    fetch(`${API_URL}/upload-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            kohde_id: kohdeId,
            huoneisto_slug: slugify(currentApt),
            data: data
        })
    })
    .then(res => res.json())
    .then(result => {
        console.log("✅ Palvelimelle tallennettu:", result);
    })
    .catch(err => {
        console.log("🔴 Virhe palvelimelle tallennuksessa:", err);
    });
}
function autosave() {
    console.log("📞 autosave() kutsuttu");
    if (isLoadingApartment) {
        console.log("⛔ isLoadingApartment = TRUE, palautetaan");
        return;
    }

    const data = collectApartmentData();
    const currentApt = huoneistoLista[currentApartmentIndex];
    console.log("📦 Kerätään data huoneistolle:", currentApt);
    if (!currentApt || !kohdeId) {
        console.log("❌ currentApt tai kohdeId puuttuu");
        return;
    }

    saveApartmentDataLocally(kohdeId, currentApt, data);
    console.log("💾 Tallennettu lokaalisti");

    if (navigator.onLine) {
        console.log("🌐 Online - kutsutaan saveApartmentData()");
        saveApartmentData();
    } else {
        console.log("📴 Offline - ei palvelimeen tallennusta");
    }
}

function collectApartmentData() {
    const data = {};
    const syy = document.getElementById("ei_tarkastettu_syy");
    if (syy && syy.value) {
        data.ei_tarkastettu_syy = syy.value;
    }
    // ✅ KERÄÄ kaikki tavalliset kentät
    document.querySelectorAll("#dynaamiset_osiot input, #dynaamiset_osiot textarea, #dynaamiset_osiot select")
        .forEach(el => {

            // ohita radio (käsitellään erikseen)
            if (el.type === "radio") return;

            if (el.type === "checkbox") return;

            if (el.id) {
                data[el.id] = el.value;
            }
        });

    // ✅ Ei tarkastettu
    const eiTark = document.getElementById("ei_tarkastettu");
    if (eiTark) {
        console.log("✅ ei_tarkastettu:", eiTark.checked);
        data.ei_tarkastettu = eiTark.checked;
    }

    // ✅ Radiot
    const ika = document.querySelector('input[name="pintarakenteiden_ika"]:checked');
    if (ika) data.pintarakenteiden_ika = ika.value;

    const kayttoika = document.querySelector('input[name="kayttoika_jaljella"]:checked');
    if (kayttoika) data.kayttoika_jaljella = kayttoika.value;

    console.log("📦 Kerätyt tiedot:", data);
    
    if (eiTark !== null) {
        console.log("✅ ei_tarkastettu checked:", eiTark.checked);
        data.ei_tarkastettu = eiTark.checked;
    }
    
    const dynaamisetKentat = document.querySelectorAll(
        "#dynaamiset_osiot input, #dynaamiset_osiot textarea, #dynaamiset_osiot select"
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
            if (el.id.includes("kuntoluokka")) {
                console.log("💾 Tallennetaan kuntoluokka:", el.id, "=", el.value);
            }
        }
    });

    // ✅ LISÄÄ MATERIAALIT
    
    // Lattia
    const lattiaValinta = document.querySelector('input[name="materiaalit_lattia_valinta"]:checked');
    if (lattiaValinta) {
        data["materiaalit_lattia_valinta"] = lattiaValinta.value;
    }
    const lattiaMuu = document.getElementById("materiaalit_lattia_muu");
    if (lattiaMuu && lattiaMuu.value) {
        data["materiaalit_lattia_muu"] = lattiaMuu.value;
    }

    // Seinät
    const seinatValinta = document.querySelector('input[name="materiaalit_seinat_valinta"]:checked');
    if (seinatValinta) {
        data["materiaalit_seinat_valinta"] = seinatValinta.value;
    }
    const seinatMuu = document.getElementById("materiaalit_seinat_muu");
    if (seinatMuu && seinatMuu.value) {
        data["materiaalit_seinat_muu"] = seinatMuu.value;
    }

    // Katto
    const kattoValinta = document.querySelector('input[name="materiaalit_katto_valinta"]:checked');
    if (kattoValinta) {
        data["materiaalit_katto_valinta"] = kattoValinta.value;
    }
    const kattoMuu = document.getElementById("materiaalit_katto_muu");
    if (kattoMuu && kattoMuu.value) {
        data["materiaalit_katto_muu"] = kattoMuu.value;
    }

    // Vesiputket (checkboxes)
    const vesiputketChecked = document.querySelectorAll('input[name="materiaalit_vesiputket"]:checked');
    if (vesiputketChecked.length > 0) {
        data["materiaalit_vesiputket"] = Array.from(vesiputketChecked).map(cb => cb.value);
    }

    // Lämpöputket (checkboxes)
    const lampoputketChecked = document.querySelectorAll('input[name="materiaalit_lampoputket"]:checked');
    if (lampoputketChecked.length > 0) {
        data["materiaalit_lampoputket"] = Array.from(lampoputketChecked).map(cb => cb.value);
    }
    
    // Pintarakenteiden ikä (radio)
    const ikaValinta = document.querySelector('input[name="pintarakenteiden_ika"]:checked');
    if (ikaValinta) {
        data["pintarakenteiden_ika"] = ikaValinta.value;
    }
    
    // Märkätilan jäljellä oleva käyttöikä
    const kayttoikaValinta = document.querySelector('input[name="kayttoika_jaljella"]:checked');
    if (kayttoikaValinta) {
        data["kayttoika_jaljella"] = kayttoikaValinta.value;
    }

    const kokonais = document.querySelector('input[name="kokonaiskunto"]:checked');
    if (kokonais) {
        data.kokonaiskunto = kokonais.value;
    }
    console.log("📦 Kerätyt tiedot:", data);

    return data;
}
    
// ==========================================================
//  HUONEISTON SYNKKAUS ENNEN NAVIGAATIOTA
// ==========================================================

async function syncCurrentApartment() {
    if (!kohdeId) return;
    if (!huoneistoLista.length) return;

    const apt = huoneistoLista[currentApartmentIndex];
    const key = `offline_${kohdeId}_${apt}`;

    if (!localStorage.getItem(key)) return;
    if (!navigator.onLine) return;

    try {
        const payload = JSON.parse(localStorage.getItem(key));

        await fetch(
            `${API_URL}/upload-data`,
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

        // Kun backend on synkattu, poistetaan local-cache
        localStorage.removeItem(key);

    } catch (e) {
        console.warn("Huoneiston synkkaus epäonnistui:", e);
    }
}


// ==========================================================
//  NAVIGAATIO: EDELLINEN HUONEISTO
// ==========================================================

document.getElementById("prevApt").addEventListener("click", async () => {
    if (currentApartmentIndex <= 0) return;

    await syncCurrentApartment();

    currentApartmentIndex--;
    loadApartment(currentApartmentIndex);
});


// ==========================================================
//  NAVIGAATIO: SEURAAVA HUONEISTO
// ==========================================================

document.getElementById("nextApt").addEventListener("click", async () => {
    if (currentApartmentIndex >= huoneistoLista.length - 1) return;

    await syncCurrentApartment();

    currentApartmentIndex++;
    loadApartment(currentApartmentIndex);
});


// ==========================================================
//  NAVIGAATIO: SUORA VALINTA INPUTISTA
// ==========================================================

document.getElementById("currentAptInput").addEventListener("change", async () => {
    const val = document.getElementById("currentAptInput").value;
    const idx = huoneistoLista.indexOf(val);

    if (idx === -1 || idx === currentApartmentIndex) return;

    await syncCurrentApartment();

    currentApartmentIndex = idx;
    loadApartment(idx);
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

async function loadApartment(i) {
    
    const apt = huoneistoLista[i];
    if (!apt) {
        console.log("❌ Huoneisto ei ole olemassa indeksillä", i);
        return;
    }
    
    const localKey = `offline_${kohdeId}_${apt}`;
    const slug = slugify(apt);
    
    console.log("🔵 loadApartment kutsuttu:", apt, "slug:", slug);
    
    isLoadingApartment = true;
    
    currentApartmentIndex = i;
    document.getElementById("currentAptInput").value = apt;

    // ✅ NOLLAA AINA ENSIN
    clearApartmentForm();
    console.log("🧹 Lomake tyhjennetty");

    // 1️⃣ Tarkista offline-tallennus ensin
    if (localStorage.getItem(localKey)) {
        console.log("💾 Offline-tallennus löytyi!");
        const local = JSON.parse(localStorage.getItem(localKey));
        fillApartmentForm(local.data);
        loadImagePreview(slug);
        isLoadingApartment = false;
        return;
    }

    // 2️⃣ Yritä noutaa palvelimelta
    try {
        console.log("🌐 Noudetaan palvelimelta...");
        const res = await fetch(
            `${API_URL}/get-apartment/${kohdeId}/${slug}`
        );
        
        console.log("📡 Palvelin vastasi:", res.status);

        if (res.status === 200) {
            const data = await res.json();
            console.log("📦 Palvelimen data:", data);
            fillApartmentForm(data);
        }

    } catch (err) {
        console.log("🔴 Virhe:", err);
        showStatus("Ei yhteyttä", "status_kartoitus");
    }

    document.getElementById("kuva1").value = "";
    document.getElementById("kuva2").value = "";
    loadImagePreview(slug);
    isLoadingApartment = false;
}
async function uploadApartmentImage(index) {
    if (!kohdeId || !huoneistoLista.length) {
        alert("Kohde tai huoneisto ei ole valittuna.");
        return;
    }
   
    const apt = huoneistoLista[currentApartmentIndex];
    if (!apt) return;

    const slug = slugify(apt);
    const input = document.getElementById(`kuva${index}`);
    const file = input.files[0];
    if (!file) return;
    
    const compressed = await compressImage(file);

    console.log("Original:", file.size);
    console.log("Compressed:", compressed.size);

    const form = new FormData();
    form.append("kohde_id", kohdeId);
    form.append("huoneisto_slug", slug);
    form.append("index", index.toString());
    form.append("file", compressed, "image.jpg"); 

    try {
        const res = await fetch(
            `${API_URL}/upload-image`,
            {
                method: "POST",
                body: form
            }
        );

        if (!res.ok) {
            throw new Error(await res.text());
        }

        showStatus(`Kuva ${index} tallennettu ✅`, "status_kartoitus");
        
        const apt = huoneistoLista[currentApartmentIndex];
                const slug = slugify(apt);

                const url = `${PUBLIC_URL}/kohteet/${kohdeId}/huoneistot/${slug}/kuva${index}.jpg`;

                const preview = document.getElementById(`preview${index}`);

                // ✅ pakota uusi lataus (cache-busting)
                preview.src = url + "?t=" + Date.now();

    } catch (e) {
        console.error("Kuvan upload epäonnistui:", e);
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

document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "ei_tarkastettu") {

        const checked = e.target.checked;

        console.log("✅ checkbox klikattu:", checked);

        // ✅ VIIVE KORJAA BUGI
        setTimeout(() => {
            toggleEiTarkastettu(checked);
            autosave();
        }, 10);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const checkbox = document.getElementById("ei_tarkastettu");

    if (checkbox) {
        checkbox.addEventListener("change", function () {
            toggleEiTarkastettu(this.checked);
        });
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
                `${API_URL}/upload-data`,
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

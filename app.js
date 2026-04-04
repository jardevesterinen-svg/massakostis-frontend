//---------------------------------------------
// 1) Lataa lauseet.json
//---------------------------------------------
let LAUSEET = {};

async function lataaLauseet() {
    console.log("Ladataan lauseet.json...");
    const res = await fetch("lauseet.json");
    console.log("Status:", res.status);
    LAUSEET = await res.json();
    console.log("JSON ladattu:", LAUSEET);
    rakennaDynaamisetOsiot();
}
lataaLauseet();


//---------------------------------------------
// 2) Luo dropdown + Muu-kenttä + tekstialue
//---------------------------------------------
function rakennaValitsin(osio, tyyppi) {

    const wrapper = document.createElement("div");

    const label = document.createElement("label");
    label.textContent = (tyyppi === "havainnot") ? "Havainnot" : "Toimenpiteet";
    wrapper.appendChild(label);

    const select = document.createElement("select");
    select.id = `${osio}_${tyyppi}_select`;
    wrapper.appendChild(select);

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "– valitse –";
    select.appendChild(opt0);

    LAUSEET[`${osio}_${tyyppi}`].forEach(lause => {
        const opt = document.createElement("option");
        opt.value = lause;
        opt.textContent = lause;
        select.appendChild(opt);
    });

    const muu = document.createElement("input");
    muu.type = "text";
    muu.placeholder = "Muu...";
    muu.id = `${osio}_${tyyppi}_muu`;
    muu.style.display = "none";
    wrapper.appendChild(muu);

    const textarea = document.createElement("textarea");
    textarea.id = `${osio}_${tyyppi}_textarea`;
    textarea.style.height = "100px";
    wrapper.appendChild(textarea);

    select.addEventListener("change", () => {
        const v = select.value;

        if (v === "Muu") {
            muu.style.display = "block";
            return;
        }

        if (v) {
            textarea.value += (textarea.value ? "\n" : "") + v;
        }

        select.value = "";
        muu.style.display = "none";
    });

    muu.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            textarea.value += (textarea.value ? "\n" : "") + muu.value;
            muu.value = "";
            muu.style.display = "none";
        }
    });

    return wrapper;
}


//---------------------------------------------
// 3) Luo KAIKKI dynaamiset osiot
//---------------------------------------------
function rakennaDynaamisetOsiot() {

    const root = document.getElementById("dynaamiset_osiot");
    root.innerHTML = "";

    const osiot = new Set();

    Object.keys(LAUSEET).forEach(key => {
        const base = key.replace("_havainnot", "").replace("_toimenpiteet", "");
        osiot.add(base);
    });

    osiot.forEach(osio => {

        const sec = document.createElement("div");

        const otsikko = osio.replace(/_/g, " ").toUpperCase();
        sec.innerHTML = `<h3>${otsikko}</h3>`;

        //------------------------------------------------
        // ✅ Kuntoluokka (★–★★★★)
        //------------------------------------------------
        const kuntoLabel = document.createElement("label");
        kuntoLabel.textContent = "Kuntoluokka";
        sec.appendChild(kuntoLabel);

        const kunto = document.createElement("select");
        kunto.id = `${osio}_kuntoluokka`;
        ["★", "★★", "★★★", "★★★★"].forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            kunto.appendChild(opt);
        });
        sec.appendChild(kunto);

        //------------------------------------------------
        // ✅ Huomiovaatimus (Kyllä/Ei)
        //------------------------------------------------
        const huomioLabel = document.createElement("label");
        huomioLabel.textContent = "Välittömästi huomiota vaativa:";
        huomioLabel.style.marginTop = "10px";
        sec.appendChild(huomioLabel);

        const huomioDiv = document.createElement("div");
        huomioDiv.innerHTML = `
            <label><input type="radio" name="${osio}_huomio" value="Kyllä"> Kyllä</label>
            <label><input type="radio" name="${osio}_huomio" value="Ei" checked> Ei</label>
        `;
        sec.appendChild(huomioDiv);

        //------------------------------------------------
        // ✅ Havainnot
        //------------------------------------------------
        sec.appendChild(rakennaValitsin(osio, "havainnot"));

        //------------------------------------------------
        // ✅ Toimenpiteet
        //------------------------------------------------
        sec.appendChild(rakennaValitsin(osio, "toimenpiteet"));

        root.appendChild(sec);
    });
}


//---------------------------------------------
// 4) Lähetyslogiikka
//---------------------------------------------
document.getElementById("form").addEventListener("submit", async e => {
    e.preventDefault();

    const huoneisto = document.getElementById("huoneisto").value;
    const pvm = document.getElementById("pvm").value;
    const kuvaInput = document.getElementById("kuva").files[0];

    let varaaja = document.getElementById("varaaja").value;
    if (window.varaajaPiilotettu) varaaja = null;

    let osiotData = {};

    Object.keys(LAUSEET).forEach(key => {
        const base = key.replace("_havainnot", "").replace("_toimenpiteet", "");
        if (!osiotData[base]) osiotData[base] = {};

        if (key.endsWith("_havainnot")) {
            osiotData[base].havainnot =
                document.getElementById(`${base}_havainnot_textarea`).value;
        }

        if (key.endsWith("_toimenpiteet")) {
            osiotData[base].toimenpiteet =
                document.getElementById(`${base}_toimenpiteet_textarea`).value;
        }

        osiotData[base].kuntoluokka =
            document.getElementById(`${base}_kuntoluokka`).value;

        osiotData[base].huomiovaatimus =
            getRadioValue(`${base}_huomio`);
    });

    const data = {
        huoneisto,
        pvm,
        varaaja,
        osiot: osiotData,
        timestamp: Date.now()
    };

    const payload = {
        data,
        kuva: kuvaInput ? await fileToBase64(kuvaInput) : null,
        kuvanimi: kuvaInput ? kuvaInput.name : null
    };

    if (navigator.onLine) sendToServer(payload);
    else {
        savePending(payload);
        document.getElementById("status").textContent =
            "Tallennettu offline-tilassa ✅";
    }
});


//---------------------------------------------
// 5) Kuva + synkronointi
//---------------------------------------------
function fileToBase64(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

function getRadioValue(name) {
    const radios = document.getElementsByName(name);
    for (const r of radios) {
        if (r.checked) return r.value;
    }
    return null;
}

async function sendToServer(payload) {
    try {
        // ✅ Lähetä JSON Railway-backendille
        await fetch("https://massakostis-backend-production-9111.up.railway.app/upload-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload.data)
        });

        // ✅ Lähetä kuva Railway → R2
        if (payload.kuva) {
            const blob = await (await fetch(payload.kuva)).blob();
            const form = new FormData();
            form.append("file", blob, payload.kuvanimi);
            form.append("path",
                `huoneistot/${payload.data.huoneisto}/${payload.kuvanimi}`
            );

            await fetch("https://massakostis-backend-production-9111.up.railway.app/upload-image", {
                method: "POST",
                body: form
            });
        }

        document.getElementById("status").textContent =
            "Tallennus onnistui ✅";

    } catch (err) {
        console.error("Virhe backend-yhteydessä:", err);
        savePending(payload);
        document.getElementById("status").textContent =
            "Tallennettu offline-tilassa ✅ (ei yhteyttä)";
    }
}

async function syncPending() {
    if (!navigator.onLine) return;
    const items = await getAllPending();
    for (const it of items) {
        try {
            await sendToServer(it);
            clearPending(it.id);
        } catch { return; }
    }
}

window.addEventListener("online", syncPending);
window.addEventListener("load", () => navigator.onLine && syncPending());

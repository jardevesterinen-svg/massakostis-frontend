async function sendToServer(payload) {
    try {

        // ✅ Lähetä JSON-data Railway-backendille
        await fetch("https://massakostis-backend-production.up.railway.app/upload-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload.data)
        });

        // ✅ Lähetä kuva Railway-backendille (ja sieltä R2:een)
        if (payload.kuva) {
            const blob = await (await fetch(payload.kuva)).blob();
            const form = new FormData();
            form.append("file", blob, payload.kuvanimi);
            form.append("path",
                `huoneistot/${payload.data.huoneisto}/${payload.kuvanimi}`
            );

            await fetch("https://massakostis-backend-production.up.railway.app/upload-image", {
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

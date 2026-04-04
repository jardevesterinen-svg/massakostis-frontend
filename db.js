let db;

const request = indexedDB.open("kosteus_db", 1);

request.onupgradeneeded = (event) => {
    db = event.target.result;
    db.createObjectStore("pending", { autoIncrement: true });
};

request.onsuccess = (event) => {
    db = event.target.result;
};

request.onerror = (event) => {
    console.error("IndexedDB virhe:", event.target.errorCode);
};

function savePending(data) {
    const tx = db.transaction(["pending"], "readwrite");
    const store = tx.objectStore("pending");
    store.add(data);
}

function getAllPending() {
    if (!db) return [];   // estää virheen
    return new Promise((resolve) => {
        const tx = db.transaction(["pending"], "readonly");
        const store = tx.objectStore("pending");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
    });
}

function clearPending(id) {
    const tx = db.transaction(["pending"], "readwrite");
    const store = tx.objectStore("pending");
    store.delete(id);
}
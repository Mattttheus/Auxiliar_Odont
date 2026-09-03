// Scanner de código de barras/QR reutilizável via câmera do navegador (html5-qrcode).
let scannerInstance = null;

function ensureModal() {
    if (document.getElementById("modalScanner")) return;
    const div = document.createElement("div");
    div.innerHTML = `
    <div class="modal fade" id="modalScanner" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-upc-scan"></i> Escanear código de barras</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div id="scannerReader"></div>
            <p class="text-muted small mt-2 mb-0">Aponte a câmera para o código de barras ou QR do produto.</p>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
}

async function pararScanner() {
    if (scannerInstance) {
        try { await scannerInstance.stop(); } catch { /* já parado */ }
        try { await scannerInstance.clear(); } catch { /* nada a limpar */ }
        scannerInstance = null;
    }
}

/** Abre o modal de câmera e chama onResult(texto) assim que decodificar um código. */
export async function abrirScanner(onResult) {
    ensureModal();
    const modalEl = document.getElementById("modalScanner");
    const modal = new bootstrap.Modal(modalEl);

    modalEl.addEventListener("hidden.bs.modal", pararScanner, { once: true });
    modal.show();

    if (!window.Html5Qrcode) {
        await import("https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js");
    }

    scannerInstance = new window.Html5Qrcode("scannerReader");
    try {
        await scannerInstance.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
            async (decodedText) => {
                await pararScanner();
                modal.hide();
                onResult(decodedText);
            },
            () => { /* frame sem leitura, ignora */ }
        );
    } catch (err) {
        modal.hide();
        alert("Não foi possível acessar a câmera: " + err.message);
    }
}

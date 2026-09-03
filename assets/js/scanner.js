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
            <div id="scannerStatus" class="alert alert-warning d-none mt-2 mb-0 small"></div>
            <p class="text-muted small mt-2 mb-2">Aponte a câmera para o código de barras ou QR do produto.</p>
            <hr>
            <label class="form-label small">Ou digite o código manualmente</label>
            <div class="input-group">
              <input type="text" class="form-control" id="scannerManualInput" placeholder="Código de barras">
              <button type="button" class="btn btn-primary" id="scannerManualBtn">Buscar</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
}

function mostrarStatus(msg) {
    const el = document.getElementById("scannerStatus");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("d-none");
}


async function pararScanner() {
    if (scannerInstance) {
        try { await scannerInstance.stop(); } catch { /* já parado */ }
        try { await scannerInstance.clear(); } catch { /* nada a limpar */ }
        scannerInstance = null;
    }
}

let carregandoLib = null;

/** Carrega o script UMD da biblioteca via <script> tradicional (import() não é confiável para UMD). */
function carregarHtml5Qrcode() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (carregandoLib) return carregandoLib;

    carregandoLib = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Falha ao carregar a biblioteca de leitura de código de barras."));
        document.head.appendChild(script);
    });
    return carregandoLib;
}

/** Abre o modal de câmera e chama onResult(texto) assim que decodificar um código. */
export async function abrirScanner(onResult) {
    ensureModal();
    const modalEl = document.getElementById("modalScanner");
    const modal = new bootstrap.Modal(modalEl);
    const statusEl = document.getElementById("scannerStatus");
    statusEl.classList.add("d-none");

    modalEl.addEventListener("hidden.bs.modal", pararScanner, { once: true });

    // Busca manual funciona mesmo se a câmera não estiver disponível.
    const manualInput = document.getElementById("scannerManualInput");
    const manualBtn = document.getElementById("scannerManualBtn");
    manualInput.value = "";
    const buscarManual = () => {
        const codigo = manualInput.value.trim();
        if (!codigo) return;
        modal.hide();
        onResult(codigo);
    };
    manualBtn.onclick = buscarManual;
    manualInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); buscarManual(); } };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        mostrarStatus("Este navegador não permite acesso à câmera aqui. Use a busca manual abaixo.");
        modal.show();
        return;
    }

    try {
        await carregarHtml5Qrcode();
    } catch (err) {
        mostrarStatus(err.message + " Use a busca manual abaixo.");
        modal.show();
        return;
    }

    // Só inicia a câmera depois que o modal terminou a animação de abertura,
    // senão o contêiner ainda tem tamanho zero e a biblioteca falha silenciosamente.
    modalEl.addEventListener("shown.bs.modal", async () => {
        try {
            scannerInstance = new window.Html5Qrcode("scannerReader");
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
            mostrarStatus("Não foi possível acessar a câmera (" + err.message + "). Use a busca manual abaixo.");
        }
    }, { once: true });

    modal.show();
}




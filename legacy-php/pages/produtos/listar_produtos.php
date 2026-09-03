<?php
session_start();

if (!isset($_SESSION['usuario'])) {
    header('Location: ../login.php');
    exit;
}

include('../../config/conexao.php');

$success = '';
$error = '';

// REGISTRAR SAÍDA
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $produto_id =
    intval($_POST['produto_id']);

    $quantidade =
    intval($_POST['quantidade']);

    // Busca produto
    $stmt = $conn->prepare("
        SELECT
            id,
            nome,
            quantidade
        FROM produtos
        WHERE id = ?
    ");

    $stmt->bind_param(
        "i",
        $produto_id
    );

    $stmt->execute();

    $produto =
    $stmt
    ->get_result()
    ->fetch_assoc();

    if (!$produto) {

        $error =
        "Produto não encontrado.";

    }
    elseif ($quantidade <= 0) {

        $error =
        "Quantidade inválida.";

    }
    elseif (
        $quantidade >
        $produto['quantidade']
    ) {

        $error =
        "Estoque insuficiente! Disponível: "
        . $produto['quantidade'];

    }
    else {

        // Atualiza estoque
        $novo_estoque =
        $produto['quantidade']
        - $quantidade;

        $update =
        $conn->prepare("
            UPDATE produtos
            SET quantidade = ?
            WHERE id = ?
        ");

        $update->bind_param(
            "ii",
            $novo_estoque,
            $produto_id
        );

        $update->execute();

        // Histórico
        $usuario =
        $_SESSION['usuario'];

        $produto_nome =
        $produto['nome'];

        $acao =
        "Saída";

        $log =
        $conn->prepare("
            INSERT INTO historico
            (
                usuario,
                produto_nome,
                acao
            )
            VALUES (?, ?, ?)
        ");

        $log->bind_param(
            "sss",
            $usuario,
            $produto_nome,
            $acao
        );

        $log->execute();

        $success =
        "Saída registrada com sucesso!";
    }
}

// PRODUTOS
$result =
$conn->query("
    SELECT
        id,
        nome,
        quantidade,
        codigo_barras
    FROM produtos
    ORDER BY nome
");

include('../../includes/header.php');
?>

<style>
body {
    background: #f5f7fb;
}

.card-custom {
    border: none;
    border-radius: 24px;
    box-shadow: 0 5px 30px rgba(0, 0, 0, .08);
}

.form-control,
.form-select {
    border-radius: 14px;
    padding: 12px;
}

.btn-custom {
    border-radius: 14px;
    font-weight: 600;
}

#reader {
    width: 100%;
    min-height: 300px;
    border: 2px dashed #dc3545;
    border-radius: 18px;
    background: #fff;
    padding: 10px;
}

.status-box {
    background: #fff3f3;
    padding: 12px;
    border-radius: 12px;
}
</style>

<div class="container py-4">

    <div class="d-flex justify-content-between align-items-center mb-4">

        <div>

            <h2 class="fw-bold">
                📤 Saída de Produtos
            </h2>

            <p class="text-muted">
                Registrar retirada do estoque
            </p>

        </div>

        <a href="../dashboard.php" class="btn btn-primary btn-custom">

            Dashboard
        </a>

    </div>

    <div class="card card-custom">

        <div class="card-body p-4">

            <?php if($success): ?>
            <div class="alert alert-success rounded-4">
                <?= $success ?>
            </div>
            <?php endif; ?>

            <?php if($error): ?>
            <div class="alert alert-danger rounded-4">
                <?= $error ?>
            </div>
            <?php endif; ?>

            <div class="row">

                <!-- FORM -->
                <div class="col-md-7">

                    <form method="POST">

                        <div class="mb-3">

                            <label class="form-label">
                                Produto
                            </label>

                            <select name="produto_id" id="produto_id" class="form-select" required>

                                <option value="">
                                    Selecione...
                                </option>

                                <?php while(
                                    $p =
                                    $result->fetch_assoc()
                                ): ?>

                                <option value="<?= $p['id'] ?>"
                                    data-codigo="<?= htmlspecialchars($p['codigo_barras'] ?? '') ?>">

                                    <?= htmlspecialchars(
                                        $p['nome']
                                    ) ?>

                                    (<?= $p['quantidade'] ?>
                                    em estoque)

                                </option>

                                <?php endwhile; ?>

                            </select>

                        </div>

                        <div class="mb-3">

                            <label class="form-label">
                                Quantidade de Saída
                            </label>

                            <input type="number" min="1" name="quantidade" class="form-control" required>

                        </div>

                        <button class="btn btn-danger btn-custom">

                            <i class="bi bi-box-arrow-up"></i>
                            Registrar Saída

                        </button>

                    </form>

                </div>

                <!-- LEITOR -->
                <div class="col-md-5">

                    <h5>
                        QR Code / Código de Barras
                    </h5>

                    <div id="reader"></div>

                    <div id="statusScanner" class="status-box mt-3">

                        Scanner desligado
                    </div>

                    <div class="d-flex gap-2 mt-3">

                        <button type="button" class="btn btn-primary" onclick="abrirLeitor()">

                            📷 Abrir Leitor

                        </button>

                        <button type="button" class="btn btn-secondary" onclick="fecharLeitor()">

                            ❌ Fechar

                        </button>

                    </div>

                </div>

            </div>

        </div>

    </div>

</div>

<script src="https://unpkg.com/html5-qrcode"></script>

<script>
let scanner = null;
let scanning = false;

async function abrirLeitor() {

    if (scanning) return;

    const status =
        document.getElementById(
            "statusScanner"
        );

    try {

        scanner =
            new Html5Qrcode(
                "reader"
            );

        status.innerHTML =
            "📷 Abrindo câmera...";

        await scanner.start(

            {
                facingMode: "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                },

                formatsToSupport: [

                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E
                ]
            },

            function(decodedText) {

                procurarProduto(
                    decodedText
                );

                fecharLeitor();
            },

            function() {}
        );

        scanning = true;

    } catch (err) {

        console.error(err);

        alert(
            "Erro ao abrir câmera.\n" +
            "Use localhost."
        );
    }
}

async function fecharLeitor() {

    if (scanner && scanning) {

        await scanner.stop();
        await scanner.clear();

        scanner = null;
        scanning = false;

        document
            .getElementById(
                "statusScanner"
            ).innerHTML =
            "Scanner desligado";
    }
}

function procurarProduto(codigo) {

    const select =
        document.getElementById(
            "produto_id"
        );

    let encontrado =
        false;

    for (let option of
            select.options) {

        if (
            option.dataset.codigo &&
            option.dataset.codigo.trim() ===
            codigo.trim()
        ) {

            select.value =
                option.value;

            encontrado =
                true;

            document
                .getElementById(
                    "statusScanner"
                ).innerHTML =
                "✅ Produto encontrado:<br><strong>" +
                option.text +
                "</strong>";

            break;
        }
    }

    if (!encontrado) {

        alert(
            "Produto não encontrado.\nCódigo: " +
            codigo
        );
    }
}
</script>

<?php include('../../includes/footer.php'); ?>
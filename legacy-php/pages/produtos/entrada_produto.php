<?php
session_start();

if (!isset($_SESSION['usuario'])) {
    header('Location: ../login.php');
    exit;
}

include('../../config/conexao.php');

$success = '';
$error = '';

// REGISTRAR ENTRADA
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $produto_id =
    intval($_POST['produto_id']);

    $qtd_entrada =
    intval($_POST['quantidade']);

    // Buscar produto
    $stmt = $conn->prepare("
        SELECT
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
    elseif ($qtd_entrada <= 0) {

        $error =
        "Quantidade inválida.";

    }
    else {

        // Atualiza estoque
        $novo_estoque =
        $produto['quantidade']
        + $qtd_entrada;

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
        "Entrada";

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
        "Entrada registrada com sucesso!";
    }
}

// Produtos
$result =
$conn->query("
    SELECT
        id,
        nome,
        quantidade
    FROM produtos
    ORDER BY nome
");

$totalProdutos =
$conn->query("
    SELECT COUNT(*) c
    FROM produtos
")->fetch_assoc()['c'];

include('../../includes/header.php');
?>

<style>
body {
    background: #f5f7fb;
}

.page-title {
    font-weight: 700;
}

.card-custom {
    border: none;
    border-radius: 24px;
    box-shadow: 0 5px 30px rgba(0, 0, 0, .08);
}

.card-stat {
    border: none;
    border-radius: 22px;
    padding: 22px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, .08);
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
    border: 2px dashed #0d6efd;
    border-radius: 18px;
    padding: 10px;
}
</style>

<div class="container py-4">

    <!-- TOPO -->
    <div class="d-flex justify-content-between align-items-center mb-4">

        <div>

            <h2 class="page-title">
                <i class="bi bi-box-arrow-in-down"></i>
                Entrada de Produtos
            </h2>

            <p class="text-muted">
                Registrar entrada no estoque
            </p>

        </div>

        <a href="../dashboard.php" class="btn btn-primary btn-custom">

            Dashboard
        </a>

    </div>

    <!-- CARD -->
    <div class="row g-4">

        <div class="col-md-4">

            <div class="card-stat bg-primary text-white">

                <small>Total Produtos</small>

                <h2>
                    <?= $totalProdutos ?>
                </h2>

            </div>

        </div>

    </div>

    <!-- FORM -->
    <div class="card card-custom mt-4">

        <div class="card-body p-4">

            <h4 class="fw-bold mb-4">
                Registrar Entrada
            </h4>

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

                                <?php while (
                                    $p =
                                    $result
                                    ->fetch_assoc()
                                ): ?>

                                <option value="<?= $p['id'] ?>">

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
                                Quantidade
                            </label>

                            <input type="number" name="quantidade" class="form-control" min="1" required>

                        </div>

                        <button class="btn btn-success btn-custom">

                            <i class="bi bi-check-circle"></i>

                            Registrar Entrada

                        </button>

                    </form>

                </div>

                <!-- QR -->
                <div class="col-md-5">

                    <h5 class="mb-3">
                        QR / Código de Barras
                    </h5>

                    <div id="reader"></div>

                    <small class="text-muted">
                        Escaneie para localizar
                        produto automaticamente
                    </small>

                </div>

            </div>

        </div>

    </div>

</div>

<script src="https://unpkg.com/html5-qrcode"></script>

<script>
const scanner =
    new Html5Qrcode("reader");

scanner.start({
        facingMode: "environment"
    }, {
        fps: 10,
        qrbox: 220
    },

    function(decodedText) {

        const select =
            document.getElementById(
                "produto_id"
            );

        for (let option of
                select.options) {

            if (
                option.text
                .toLowerCase()
                .includes(
                    decodedText
                    .toLowerCase()
                )
            ) {
                select.value =
                    option.value;

                alert(
                    "Produto encontrado!"
                );

                break;
            }
        }
    }
);
</script>

<?php include('../../includes/footer.php'); ?>
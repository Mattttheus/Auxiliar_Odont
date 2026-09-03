<?php
session_start();

if (!isset($_SESSION['usuario'])) {
    header('Location: ../login.php');
    exit;
}

include("../../config/conexao.php");

$success = '';
$error = '';

// REGISTRAR SAÍDA
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $produto_id = intval($_POST['produto_id']);
    $quantidade = intval($_POST['quantidade']);

    // Buscar produto
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

    $produto = $stmt
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

        if ($update->execute()) {

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
        else {

            $error =
            "Erro ao atualizar estoque.";
        }
    }
}

// Buscar produtos
$produtos = $conn->query("
    SELECT
        id,
        nome,
        quantidade
    FROM produtos
    ORDER BY nome
");

include("../../includes/header.php");
?>

<div class="container mt-4">

    <div class="d-flex justify-content-between align-items-center mb-4">

        <h3>
            <i class="bi bi-box-arrow-up"></i>
            Saída de Produtos
        </h3>

        <div>

            <a class="btn btn-secondary" href="listar_produtos.php">

                <i class="bi bi-box"></i>
                Produtos

            </a>

            <a class="btn btn-success" href="../dashboard.php">

                <i class="bi bi-house"></i>
                Menu

            </a>

        </div>

    </div>

    <div class="card shadow-sm">

        <div class="card-body">

            <h4 class="card-title mb-4">
                Registrar Saída
            </h4>

            <?php if (isset($success)): ?>

            <div class="alert alert-success">
                <?= $success ?>
            </div>

            <?php endif; ?>

            <?php if (isset($error)): ?>

            <div class="alert alert-danger">
                <?= $error ?>
            </div>

            <?php endif; ?>

            <form method="POST">

                <div class="mb-3">

                    <label class="form-label">
                        Produto
                    </label>

                    <select name="produto_id" class="form-select" required>

                        <option value="">
                            Selecione...
                        </option>

                        <?php while(
                            $p =
                            $produtos
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
                        Quantidade de Saída
                    </label>

                    <input class="form-control" name="quantidade" type="number" min="1" required>

                </div>

                <button class="btn btn-danger">

                    <i class="bi bi-box-arrow-up"></i>

                    Registrar Saída

                </button>

            </form>

        </div>

    </div>

</div>

<?php include("../../includes/footer.php"); ?>
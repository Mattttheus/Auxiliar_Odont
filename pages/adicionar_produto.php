<?php
session_start();
if (!isset($_SESSION['usuario'])) { header('Location: login.php'); exit; }
include("../config/conexao.php");
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nome = $conn->real_escape_string($_POST['nome']);
    $descricao = $conn->real_escape_string($_POST['descricao']);
    $preco = floatval($_POST['preco']);
    $quantidade = intval($_POST['quantidade']);
    $validade = $_POST['validade'];
    $data_atual = date('Y-m-d');
    $data_validade = date('Y-m-d', strtotime($validade));
    $diferenca = strtotime($data_validade) - strtotime($data_atual);
    $qtd_validade = floor($diferenca / (60 * 60 * 24));
    $produtos_validade = ($qtd_validade >= 0) ? 1 : 0;
    $sql = "INSERT INTO produtos (nome, descricao, preco, quantidade, validade) VALUES ('$nome','$descricao',$preco,$quantidade,$validade)";
    if ($conn->query($sql)) {
        header('Location: produtos.php'); exit;
    } else {
        $error = $conn->error;
    }
}
include("../includes/header.php");
?>
<div class="d-flex justify-content-between align-items-center">
    <h3>Produtos</h3>
    <div>
        <a class="btn btn-secondary" href="exportar_produtos.php">
            <i class="bi bi-download"></i> Exportar CSV
        </a>
        <a class="btn btn-success" href="editar_produto.php">
            <i class="bi bi-plus-lg"></i> Editar
        </a>
        </a>
        <a class="btn btn-success" href="dashboard.php">
            <i class="bi bi-plus-lg"></i>Menu
        </a>
    </div>
</div>
<div class="card">
    <div class="card-body">
        <h4 class="card-title">Adicionar Produto</h4>
        <?php if (isset($error)): ?><div class="alert alert-danger"><?= $error ?></div><?php endif; ?>
        <form method="POST">
            <div class="mb-3">
                <label class="form-label">Nome</label>
                <input class="form-control" name="nome" required>
            </div>
            <div class="mb-3">
                <label class="form-label">Descrição</label>
                <textarea class="form-control" name="descricao"></textarea>
            </div>
            <div class="mb-3">
                <label class="form-label">Preço</label>
                <input class="form-control" name="preco" type="number" step="0.01" required>
            </div>
            <div class="mb-3">
                <label class="form-label">Quantidade</label>
                <input class="form-control" name="quantidade" type="number" required>
            </div>
            <div class="mb-3">
                <label class="form-label">Validade</label>
                <input class="form-control" name="validade" type="date" required>
            </div>

            <button class="btn btn-primary">Adicionar</button>
        </form>
    </div>
</div>

<?php include("../includes/footer.php"); ?>
<?php
session_start();
if (!isset($_SESSION['usuario'])) { header('Location: login.php'); exit; }
include("../config/conexao.php");
if (!isset($_GET['id'])) { die('Produto não encontrado'); }
$id = intval($_GET['id']);
$res = $conn->query("SELECT * FROM produtos WHERE id=$id");
if ($res->num_rows === 0) { die('Produto não encontrado'); }
$produto = $res->fetch_assoc();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nome = $conn->real_escape_string($_POST['nome']);
    $descricao = $conn->real_escape_string($_POST['descricao']);
    $preco = floatval($_POST['preco']);
    $quantidade = intval($_POST['quantidade']);
    $validade = $_POST['validade'];
    $sql = "UPDATE produtos SET nome='$nome', descricao='$descricao', preco=$preco, quantidade=$quantidade validade=$validade WHERE id=$id";
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
        <a class="btn btn-secondary" href="../pages/produtos/exportar_produtos.php ">
            <i class="bi bi-download"></i> Exportar CSV
        </a>
        <a class="btn btn-success" href="adicionar_produto.php">
            <i class="bi bi-plus-lg"></i> Novo
        </a>
        </a>
        <a class="btn btn-success" href="../dashboard.php">
            <i class="bi bi-plus-lg"></i>Menu
        </a>
        <a class="btn btn-success" href="../deletar_produto.php?id=<?= $produto['id'] ?>">
            <i class="bi bi-plus-lg"></i> deletar
        </a>
        <a class="btn btn-success" href="../editar_produto.php?id=<?= $produto['id'] ?>">
            <i class="bi bi-plus-lg"></i> Editar
        </a>
    </div>
</div>
<div class="card">
    <div class="card-body">
        <h4 class="card-title">Editar Produto #<?= $produto['id'] ?></h4>
        <?php if (isset($error)): ?><div class="alert alert-danger"><?= $error ?></div><?php endif; ?>
        <form method="POST">
            <div class="mb-3">
                <label class="form-label">Nome</label>
                <input class="form-control" name="nome" value="<?= htmlspecialchars($produto['nome']) ?>" required>
            </div>
            <div class="mb-3">
                <label class="form-label">Descrição</label>
                <textarea class="form-control"
                    name="descricao"><?= htmlspecialchars($produto['descricao']) ?></textarea>
            </div>
            <div class="mb-3">
                <label class="form-label">Preço</label>
                <input class="form-control" name="preco" type="number" step="0.01" value="<?= $produto['preco'] ?>"
                    required>
            </div>
            <div class="mb-3">
                <label class="form-label">Quantidade</label>
                <input class="form-control" name="quantidade" type="number" value="<?= $produto['quantidade'] ?>"
                    required>
            </div>
            <div class="mb-3">
                <label class="form-label">Validade</label>
                <input class="form-control" name="validade" type="date" required>
            </div>
            <button class="btn btn-primary">Salvar</button>
            <a class="btn btn-secondary" href="produtos.php">Voltar</a>
        </form>
    </div>
</div>
<?php include("../includes/footer.php"); ?>
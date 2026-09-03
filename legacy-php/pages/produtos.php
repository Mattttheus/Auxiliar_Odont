<?php
session_start();

if (!isset($_SESSION['usuario'])) {
    header('Location: login.php');
    exit;
}

include("../config/conexao.php");

// FILTRO
$filtro = $_GET['filter'] ?? 'todos';

$sql = "SELECT * FROM produtos";

switch ($filtro) {

    case 'vencidos':
        $sql .= " WHERE validade < CURDATE()";
        break;

    case 'prestes':
        $sql .= " WHERE validade BETWEEN CURDATE()
                  AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)";
        break;

    case 'baixo':
        $sql .= " WHERE quantidade <= 5";
        break;
}

$sql .= " ORDER BY id DESC";

$res = $conn->query($sql);

// CARDS
$totalProdutos =
$conn->query("SELECT COUNT(*) c FROM produtos")
->fetch_assoc()['c'];

$totalVencidos =
$conn->query("
SELECT COUNT(*) c
FROM produtos
WHERE validade < CURDATE()
")->fetch_assoc()['c'];

$totalPrestes =
$conn->query("
SELECT COUNT(*) c
FROM produtos
WHERE validade BETWEEN CURDATE()
AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
")->fetch_assoc()['c'];

$totalBaixo =
$conn->query("
SELECT COUNT(*) c
FROM produtos
WHERE quantidade <= 5
")->fetch_assoc()['c'];

include("../includes/header.php");
?>

<style>
body{
    background:#f5f7fb;
}

.page-title{
    font-weight:700;
}

.card-dashboard{
    border:none;
    border-radius:22px;
    padding:22px;
    box-shadow:0 4px 20px rgba(0,0,0,.08);
    transition:.3s;
}

.card-dashboard:hover{
    transform:translateY(-3px);
}

.card-custom{
    border:none;
    border-radius:24px;
    box-shadow:0 5px 30px rgba(0,0,0,.08);
}

.table thead{
    background:#0d6efd;
    color:#fff;
}

.table tbody tr{
    transition:.2s;
}

.table tbody tr:hover{
    background:#f8fbff;
}

.badge-status{
    padding:8px 12px;
    border-radius:12px;
    font-size:12px;
}

.search-box{
    border-radius:14px;
    padding:12px;
}

.btn-custom{
    border-radius:14px;
    font-weight:600;
}

.low-stock{
    color:#dc3545;
    font-weight:bold;
}

.filter-btn{
    border-radius:12px;
}

.icon-card{
    font-size:32px;
    opacity:.85;
}
</style>

<div class="container-fluid py-4">

    <!-- TOPO -->
    <div class="d-flex justify-content-between align-items-center flex-wrap mb-4">

        <div>
            <h2 class="page-title">
                <i class="bi bi-box-seam"></i>
                Gestão de Produtos
            </h2>
            <p class="text-muted">
                Controle completo do estoque odontológico
            </p>
        </div>

        <div class="d-flex gap-2">

            <a class="btn btn-secondary btn-custom"
               href="exportar_produtos.php">

                <i class="bi bi-download"></i>
                CSV
            </a>

            <a class="btn btn-success btn-custom"
               href="editar_produto.php">

                <i class="bi bi-plus-lg"></i>
                Novo Produto
            </a>

            <a class="btn btn-primary btn-custom"
               href="dashboard.php">

                <i class="bi bi-house"></i>
                Dashboard
            </a>

        </div>
    </div>

    <!-- CARDS -->
    <div class="row g-4 mb-4">

        <div class="col-md-3">
            <div class="card-dashboard bg-white">
                <div class="d-flex justify-content-between">
                    <div>
                        <small>Total Produtos</small>
                        <h2><?= $totalProdutos ?></h2>
                    </div>
                    <i class="bi bi-box icon-card text-primary"></i>
                </div>
            </div>
        </div>

        <div class="col-md-3">
            <div class="card-dashboard bg-danger text-white">
                <div class="d-flex justify-content-between">
                    <div>
                        <small>Vencidos</small>
                        <h2><?= $totalVencidos ?></h2>
                    </div>
                    <i class="bi bi-exclamation-triangle icon-card"></i>
                </div>
            </div>
        </div>

        <div class="col-md-3">
            <div class="card-dashboard bg-warning">
                <div class="d-flex justify-content-between">
                    <div>
                        <small>Próximos (7 dias)</small>
                        <h2><?= $totalPrestes ?></h2>
                    </div>
                    <i class="bi bi-hourglass-split icon-card"></i>
                </div>
            </div>
        </div>

        <div class="col-md-3">
            <div class="card-dashboard bg-dark text-white">
                <div class="d-flex justify-content-between">
                    <div>
                        <small>Estoque Baixo</small>
                        <h2><?= $totalBaixo ?></h2>
                    </div>
                    <i class="bi bi-archive icon-card"></i>
                </div>
            </div>
        </div>

    </div>

    <!-- CARD TABELA -->
    <div class="card card-custom">

        <div class="card-body">

            <div class="d-flex justify-content-between align-items-center flex-wrap mb-4">

                <div class="d-flex gap-2 flex-wrap">

                    <a href="?filter=todos"
                       class="btn btn-outline-primary filter-btn">
                       Todos
                    </a>

                    <a href="?filter=vencidos"
                       class="btn btn-outline-danger filter-btn">
                       Vencidos
                    </a>

                    <a href="?filter=prestes"
                       class="btn btn-outline-warning filter-btn">
                       Próximos
                    </a>

                    <a href="?filter=baixo"
                       class="btn btn-outline-dark filter-btn">
                       Estoque Baixo
                    </a>

                </div>

                <div style="width:300px;">
                    <input
                        type="text"
                        id="search"
                        class="form-control search-box"
                        placeholder="🔍 Buscar produto..."
                    >
                </div>

            </div>

            <div class="table-responsive">

                <table
                    class="table align-middle"
                    id="tableProdutos">

                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Produto</th>
                            <th>Preço</th>
                            <th>Qtd</th>
                            <th>Validade</th>
                            <th>Status</th>
                            <th width="170">
                                Ações
                            </th>
                        </tr>
                    </thead>

                    <tbody>

                    <?php while($p = $res->fetch_assoc()): ?>

                    <?php
                        $hoje = strtotime(date('Y-m-d'));
                        $validade = strtotime($p['validade']);

                        $dias =
                        ($validade - $hoje) / 86400;

                        if($dias < 0){
                            $status =
                            '<span class="badge bg-danger badge-status">
                            Vencido
                            </span>';
                        }
                        elseif($dias <= 7){
                            $status =
                            '<span class="badge bg-warning text-dark badge-status">
                            Próximo
                            </span>';
                        }
                        else{
                            $status =
                            '<span class="badge bg-success badge-status">
                            OK
                            </span>';
                        }
                    ?>

                    <tr>

                        <td>
                            #<?= $p['id'] ?>
                        </td>

                        <td class="fw-semibold">
                            <?= htmlspecialchars($p['nome']) ?>
                        </td>

                        <td>
                            R$
                            <?= number_format($p['preco'],2,',','.') ?>
                        </td>

                        <td class="<?= $p['quantidade'] <= 5 ? 'low-stock' : '' ?>">

                            <?= $p['quantidade'] ?>

                            <?php if($p['quantidade'] <= 5): ?>
                                <i class="bi bi-exclamation-circle-fill"></i>
                            <?php endif; ?>

                        </td>

                        <td>
                            <?= date(
                                'd/m/Y',
                                strtotime($p['validade'])
                            ) ?>
                        </td>

                        <td>
                            <?= $status ?>
                        </td>

                        <td>

                            <a
                                href="editar_produto.php?id=<?= $p['id'] ?>"
                                class="btn btn-info btn-sm text-white">

                                <i class="bi bi-pencil-square"></i>
                            </a>

                            <?php if (
                                isset($_SESSION['role']) &&
                                $_SESSION['role'] === 'admin'
                            ): ?>

                            <a
                                href="deletar_produto.php?id=<?= $p['id'] ?>"
                                class="btn btn-danger btn-sm"
                                onclick="return confirm('Excluir produto?')">

                                <i class="bi bi-trash"></i>

                            </a>

                            <?php endif; ?>

                        </td>

                    </tr>

                    <?php endwhile; ?>

                    </tbody>
                </table>

            </div>
        </div>
    </div>
</div>

<script>
document
.getElementById('search')
.addEventListener('keyup', function(){

    let termo =
    this.value.toLowerCase();

    let linhas =
    document.querySelectorAll(
        '#tableProdutos tbody tr'
    );

    linhas.forEach(linha => {

        let texto =
        linha.innerText.toLowerCase();

        linha.style.display =
        texto.includes(termo)
        ? ''
        : 'none';

    });

});
</script>

<?php include("../includes/footer.php"); ?>
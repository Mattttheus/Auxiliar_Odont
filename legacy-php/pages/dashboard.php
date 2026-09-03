<?php
session_start();

if (!isset($_SESSION["usuario"])) {
    header("Location: login.php");
    exit;
}

include("../config/conexao.php");

// Produtos
$produtos = [];
$quantidades = [];
$valores = [];

// Produtos próximos do vencimento
$produtos_validade = [];
$qtd_validade = [];

// Consulta única
$res = $conn->query("
    SELECT id, nome, quantidade, preco, validade
    FROM produtos
");

while ($r = $res->fetch_assoc()) {

    $produtos[] = $r["nome"];
    $quantidades[] = (int)$r["quantidade"];
    $valores[] = (float)$r["preco"] * (int)$r["quantidade"];

    $dias = (strtotime($r["validade"]) - time()) / 86400;

    if ($dias >= 0 && $dias <= 7) {
        $produtos_validade[] = $r["nome"];
        $qtd_validade[] = (int)$r["quantidade"];
    }
}

// Alertas
$vencidos_q = $conn->query("
    SELECT id,nome,validade
    FROM produtos
    WHERE validade < CURDATE()
");

$prestes_q = $conn->query("
    SELECT id,nome,validade
    FROM produtos
    WHERE validade BETWEEN CURDATE()
    AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
");

$total_vencendo = $prestes_q->num_rows;

include("../includes/header.php");
?>

<div class="container-fluid py-4">

    <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold">
            <i class="bi bi-speedometer2"></i>
            Dashboard - Auxiliar Odont
        </h2>

        <span class="badge bg-primary p-3">
            Bem-vindo, <?= htmlspecialchars($_SESSION["usuario"]) ?>
        </span>
    </div>

    
    <!-- ALERTAS -->

    <?php if($vencidos_q->num_rows > 0): ?>
    <div class="alert alert-danger shadow-sm border-0 rounded-4 d-flex justify-content-between">

        <div>
            <h5>
                <i class="bi bi-exclamation-triangle-fill"></i>
                Produtos vencidos
            </h5>

            <p>
                Existem
                <strong><?= $vencidos_q->num_rows ?></strong>
                produto(s) vencido(s).
            </p>

            <ul>
                <?php foreach($vencidos_q as $p): ?>
                    <li>
                        <?= htmlspecialchars($p["nome"]) ?>
                        —
                        <?= date("d/m/Y", strtotime($p["validade"])) ?>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>

        <div class="text-end">
            <a href="/Auxiliar_Odont/pages/produtos/listar_produtos.php?filter=vencidos"
               class="btn btn-light mb-2">
                Ver detalhes
            </a>

            <button
                onclick="playBeep('red')"
                class="btn btn-danger">
                Tocar alerta
            </button>
        </div>
    </div>
    <?php endif; ?>

    <?php if($prestes_q->num_rows > 0): ?>
    <div class="alert alert-warning shadow-sm border-0 rounded-4 d-flex justify-content-between">

        <div>
            <h5>
                <i class="bi bi-hourglass-split"></i>
                Produtos próximos do vencimento
            </h5>

            <p>
                <?= $prestes_q->num_rows ?>
                produto(s) vencem nos próximos 7 dias.
            </p>

            <ul>
                <?php foreach($prestes_q as $p): ?>
                    <li>
                        <?= htmlspecialchars($p["nome"]) ?>
                        —
                        <?= date("d/m/Y", strtotime($p["validade"])) ?>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>

        <div class="text-end">
            <a href="/Auxiliar_Odont/pages/produtos/listar_produtos.php?filter=prestes"
               class="btn btn-light mb-2">
                Ver detalhes
            </a>

            <button
                onclick="playBeep('yellow')"
                class="btn btn-warning">
                Tocar alerta
            </button>
        </div>
    </div>
    <?php endif; ?>

    <!-- CARDS -->

    <div class="row g-4">

        <div class="col-md-4">
            <div class="card shadow border-0 rounded-4 p-4">
                <h6 class="text-muted">Total de Itens</h6>
                <h2><?= array_sum($quantidades) ?></h2>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card shadow border-0 rounded-4 p-4">
                <h6 class="text-muted">Valor do Estoque</h6>
                <h2>
                    R$
                    <?= number_format(array_sum($valores),2,",",".") ?>
                </h2>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card shadow border-0 rounded-4 p-4">
                <h6 class="text-muted">Vencendo (7 dias)</h6>
                <h2><?= $total_vencendo ?></h2>
            </div>
        </div>

    </div>

    <!-- GRÁFICOS -->

    <div class="row mt-4 g-4">

        <div class="col-md-6">
            <div class="card shadow border-0 rounded-4 p-4">
                <h5>Consumo do Estoque</h5>
                <canvas id="chart1"></canvas>
            </div>
        </div>

        <div class="col-md-6">
            <div class="card shadow border-0 rounded-4 p-4">
                <h5>Valor do Estoque</h5>
                <canvas id="chart2"></canvas>
            </div>
        </div>

    </div>

    <div class="card mt-4 shadow border-0 rounded-4 p-4">
        <h5>Produtos Próximos do Prazo</h5>
        <canvas id="chart3"></canvas>
    </div>

</div>

<script>

const produtos = <?= json_encode($produtos) ?>;
const quantidades = <?= json_encode($quantidades) ?>;
const valores = <?= json_encode($valores) ?>;

const produtos_validade =
<?= json_encode($produtos_validade) ?>;

const qtd_validade =
<?= json_encode($qtd_validade) ?>;

// Estoque
new Chart(document.getElementById('chart1'), {
    type: 'bar',
    data: {
        labels: produtos,
        datasets: [{
            label: 'Quantidade',
            data: quantidades
        }]
    }
});

// Valor
new Chart(document.getElementById('chart2'), {
    type: 'pie',
    data: {
        labels: produtos,
        datasets: [{
            label: 'Valor',
            data: valores
        }]
    }
});

// Próximos do vencimento
new Chart(document.getElementById('chart3'), {
    type: 'bar',
    data: {
        labels: produtos_validade,
        datasets: [{
            label: 'Qtd vencendo',
            data: qtd_validade
        }]
    }
});

</script>

<?php include("../includes/footer.php"); ?>
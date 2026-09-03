<?php
session_start();

if (!isset($_SESSION['usuario'])) {
    header('Location: ../../login.php');
    exit;
}

require_once('../../config/conexao.php');

// Verifica conexão
if ($conn->connect_error) {
    die("Erro na conexão: " . $conn->connect_error);
}

/* ==================================
   HISTÓRICO GERAL (CORRIGIDO)
================================== */
$sqlHistorico = "
    SELECT
        h.id,

        COALESCE(u.nome, 'Usuário removido')
            AS usuario_nome,

        COALESCE(p.nome, 'Produto removido')
            AS produto_nome,

        h.acao,
        h.descricao,
        h.data_acao

    FROM historico h

    LEFT JOIN usuarios u
        ON h.usuario_id = u.id

    LEFT JOIN produtos p
        ON h.produto_id = p.id

    ORDER BY h.data_acao DESC
";

$result = $conn->query($sqlHistorico);

if (!$result) {
    die("Erro histórico: " . $conn->error);
}

/* ==================================
   HISTÓRICO DE SAÍDAS
================================== */
$sqlSaidas = "
    SELECT
        s.id,
        s.quantidade,
        s.observacao,
        s.data_saida,

        p.nome AS produto_nome,

        COALESCE(
            u.nome,
            'Usuário removido'
        ) AS usuario_nome

    FROM saidas_produtos s

    INNER JOIN produtos p
        ON s.produto_id = p.id

    LEFT JOIN usuarios u
        ON s.usuario_id = u.id

    ORDER BY s.data_saida DESC
";

$res = $conn->query($sqlSaidas);

if (!$res) {
    die("Erro saídas: " . $conn->error);
}

/* ==================================
   ESTATÍSTICAS
================================== */
$totalHistorico = 0;
$totalSaidas = 0;

$qHistorico = $conn->query("
    SELECT COUNT(*) AS total
    FROM historico
");

if ($qHistorico) {
    $dados = $qHistorico->fetch_assoc();
    $totalHistorico = $dados['total'];
}

$qSaidas = $conn->query("
    SELECT COUNT(*) AS total
    FROM saidas_produtos
");

if ($qSaidas) {
    $dados = $qSaidas->fetch_assoc();
    $totalSaidas = $dados['total'];
}

include('../../includes/header.php');
?>

<div class="container py-4">

    <!-- TOPO -->
    <div class="d-flex justify-content-between align-items-center mb-4">

        <div>
            <h2 class="fw-bold">
                <i class="bi bi-clock-history"></i>
                Histórico do Sistema
            </h2>

            <small class="text-muted">
                Histórico de ações e saídas do estoque
            </small>
        </div>

        <a href="../dashboard.php" class="btn btn-primary">

            <i class="bi bi-house-door-fill"></i>
            Dashboard
        </a>

    </div>

    <!-- CARDS -->
    <div class="row mb-4">

        <div class="col-md-6 mb-3">

            <div class="card border-0 shadow bg-primary text-white">

                <div class="card-body text-center">

                    <h5>Total de Ações</h5>

                    <h1>
                        <?= $totalHistorico ?>
                    </h1>

                </div>

            </div>

        </div>

        <div class="col-md-6 mb-3">

            <div class="card border-0 shadow bg-success text-white">

                <div class="card-body text-center">

                    <h5>Total de Saídas</h5>

                    <h1>
                        <?= $totalSaidas ?>
                    </h1>

                </div>

            </div>

        </div>

    </div>

    <!-- ABAS -->
    <ul class="nav nav-tabs mb-4">

        <li class="nav-item">

            <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#historico">

                <i class="bi bi-journal-text"></i>
                Histórico Geral
            </button>

        </li>

        <li class="nav-item">

            <button class="nav-link" data-bs-toggle="tab" data-bs-target="#saidas">

                <i class="bi bi-box-arrow-right"></i>
                Histórico de Saídas
            </button>

        </li>

    </ul>

    <div class="tab-content">

        <!-- HISTÓRICO -->
        <div class="tab-pane fade show active" id="historico">

            <div class="card shadow border-0">

                <div class="card-body">

                    <div class="table-responsive">

                        <table class="table table-hover align-middle">

                            <thead class="table-primary">

                                <tr>
                                    <th>ID</th>
                                    <th>Usuário</th>
                                    <th>Produto</th>
                                    <th>Ação</th>
                                    <th>Descrição</th>
                                    <th>Data</th>
                                </tr>

                            </thead>

                            <tbody>

                                <?php if ($result->num_rows > 0): ?>

                                <?php while ($row = $result->fetch_assoc()): ?>

                                <tr>

                                    <td>
                                        <?= $row['id'] ?>
                                    </td>

                                    <td>
                                        <?= htmlspecialchars(
                                                $row['usuario_nome']
                                            ) ?>
                                    </td>

                                    <td>
                                        <?= htmlspecialchars(
                                                $row['produto_nome']
                                            ) ?>
                                    </td>

                                    <td>

                                        <?php
                                            $acao = strtolower(
                                                trim($row['acao'])
                                            );

                                            if ($acao === 'entrada') {
                                                echo '<span class="badge bg-success">Entrada</span>';
                                            } elseif ($acao === 'saida') {
                                                echo '<span class="badge bg-danger">Saída</span>';
                                            } else {
                                                echo '<span class="badge bg-primary">'
                                                    . htmlspecialchars($row['acao'])
                                                    . '</span>';
                                            }
                                            ?>

                                    </td>

                                    <td>
                                        <?= htmlspecialchars(
                                                $row['descricao'] ?? '-'
                                            ) ?>
                                    </td>

                                    <td>
                                        <?= date(
                                                'd/m/Y H:i',
                                                strtotime($row['data_acao'])
                                            ) ?>
                                    </td>

                                </tr>

                                <?php endwhile; ?>

                                <?php else: ?>

                                <tr>
                                    <td colspan="6" class="text-center text-muted">

                                        Nenhum histórico encontrado.

                                    </td>
                                </tr>

                                <?php endif; ?>

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>

        </div>

        <!-- SAÍDAS -->
        <div class="tab-pane fade" id="saidas">

            <div class="card shadow border-0">

                <div class="card-body">

                    <div class="table-responsive">

                        <table class="table table-hover align-middle">

                            <thead class="table-success">

                                <tr>
                                    <th>ID</th>
                                    <th>Produto</th>
                                    <th>Quantidade</th>
                                    <th>Usuário</th>
                                    <th>Observação</th>
                                    <th>Data</th>
                                </tr>

                            </thead>

                            <tbody>

                                <?php if ($res->num_rows > 0): ?>

                                <?php while ($r = $res->fetch_assoc()): ?>

                                <tr>

                                    <td>
                                        <?= $r['id'] ?>
                                    </td>

                                    <td>
                                        <?= htmlspecialchars(
                                                $r['produto_nome']
                                            ) ?>
                                    </td>

                                    <td>
                                        <?= $r['quantidade'] ?>
                                    </td>

                                    <td>
                                        <?= htmlspecialchars(
                                                $r['usuario_nome']
                                            ) ?>
                                    </td>

                                    <td>
                                        <?= htmlspecialchars(
                                                $r['observacao'] ?? '-'
                                            ) ?>
                                    </td>

                                    <td>
                                        <?= date(
                                                'd/m/Y H:i',
                                                strtotime($r['data_saida'])
                                            ) ?>
                                    </td>

                                </tr>

                                <?php endwhile; ?>

                                <?php else: ?>

                                <tr>
                                    <td colspan="6" class="text-center text-muted">

                                        Nenhuma saída registrada.

                                    </td>
                                </tr>

                                <?php endif; ?>

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>

        </div>

    </div>

</div>

<?php include('../../includes/footer.php'); ?>
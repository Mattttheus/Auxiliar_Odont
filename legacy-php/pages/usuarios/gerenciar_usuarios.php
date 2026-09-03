<?php
session_start();

if (!isset($_SESSION['usuario']) || ($_SESSION['role'] ?? '') !== 'admin') {
    header("Location: ../../login.php");
    exit;
}

require_once("../../config/conexao.php");

// Busca usuários
$sql = "SELECT * FROM usuarios ORDER BY id DESC";
$resultado = $conn->query($sql);
?>

<!doctype html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gerenciar Usuários</title>

    <!-- Bootstrap -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

    <style>
    body {
        background: #f4f6f9;
    }

    .container-box {
        background: white;
        border-radius: 20px;
        padding: 30px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, .08);
        margin-top: 40px;
    }

    .table thead {
        background: #0d6efd;
        color: white;
    }

    .btn-action {
        min-width: 90px;
    }

    .badge-status {
        font-size: 13px;
        padding: 8px 10px;
    }
    </style>
</head>

<body>

    <div class="container">

        <div class="container-box">

            <div class="d-flex justify-content-between align-items-center mb-4">

                <div>
                    <h2 class="fw-bold">
                        <i class="bi bi-people-fill"></i>
                        Gerenciar Usuários
                    </h2>

                    <p class="text-muted mb-0">
                        Usuários cadastrados no sistema
                    </p>
                </div>

                <a href="criar_usuario.php" class="btn btn-success">
                    <i class="bi bi-person-plus-fill"></i>
                    Criar Usuário
                </a>

            </div>

            <!-- Mensagens -->
            <?php if (isset($_GET['msg'])): ?>

            <?php if ($_GET['msg'] == 'criado'): ?>
            <div class="alert alert-success">
                Usuário criado com sucesso.
            </div>
            <?php endif; ?>

            <?php if ($_GET['msg'] == 'editado'): ?>
            <div class="alert alert-primary">
                Usuário atualizado com sucesso.
            </div>
            <?php endif; ?>

            <?php if ($_GET['msg'] == 'excluido'): ?>
            <div class="alert alert-danger">
                Usuário excluído com sucesso.
            </div>
            <?php endif; ?>

            <?php endif; ?>

            <div class="table-responsive">

                <table class="table table-hover table-bordered align-middle">

                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Perfil</th>
                            <th>Status</th>
                            <th>Criado em</th>
                            <th width="240">Ações</th>
                        </tr>
                    </thead>

                    <tbody>

                        <?php if ($resultado && $resultado->num_rows > 0): ?>

                        <?php while ($usuario = $resultado->fetch_assoc()): ?>

                        <tr>

                            <td>
                                <?= $usuario['id'] ?>
                            </td>

                            <td>
                                <?= htmlspecialchars($usuario['nome']) ?>
                            </td>

                            <td>
                                <?= htmlspecialchars($usuario['email']) ?>
                            </td>

                            <td>
                                <?php if ($usuario['role'] === 'admin'): ?>
                                <span class="badge bg-danger">
                                    ADMIN
                                </span>
                                <?php else: ?>
                                <span class="badge bg-primary">
                                    USER
                                </span>
                                <?php endif; ?>
                            </td>

                            <td>
                                <?php if ($usuario['ativo'] == 1): ?>
                                <span class="badge bg-success badge-status">
                                    Ativo
                                </span>
                                <?php else: ?>
                                <span class="badge bg-secondary badge-status">
                                    Inativo
                                </span>
                                <?php endif; ?>
                            </td>

                            <td>
                                <?= date('d/m/Y H:i', strtotime($usuario['criado_em'])) ?>
                            </td>

                            <td>

                                <!-- EDITAR -->
                                <a href="editar_usuario.php?id=<?= $usuario['id'] ?>"
                                    class="btn btn-warning btn-sm btn-action">

                                    <i class="bi bi-pencil-square"></i>
                                    Editar
                                </a>

                                <!-- EXCLUIR -->
                                <?php
                                $usuarioLogadoId = $_SESSION['usuario_id'] ?? 0;

                                if ($usuario['id'] != $usuarioLogadoId):
                                ?>

                                <a href="excluir_usuario.php?id=<?= $usuario['id'] ?>"
                                    class="btn btn-danger btn-sm btn-action"
                                    onclick="return confirm('Deseja realmente excluir este usuário?')">

                                    <i class="bi bi-trash-fill"></i>
                                    Excluir
                                </a>

                                <?php else: ?>

                                <button class="btn btn-secondary btn-sm btn-action" disabled>
                                    Seu usuário
                                </button>

                                <?php endif; ?>

                            </td>

                        </tr>

                        <?php endwhile; ?>

                        <?php else: ?>

                        <tr>
                            <td colspan="7" class="text-center">
                                Nenhum usuário cadastrado.
                            </td>
                        </tr>

                        <?php endif; ?>

                    </tbody>

                </table>

            </div>

        </div>

    </div>

</body>

</html>
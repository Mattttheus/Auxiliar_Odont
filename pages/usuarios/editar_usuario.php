<?php
session_start();

if (!isset($_SESSION['usuario']) || ($_SESSION['role'] ?? '') !== 'admin') {
    header("Location: ../../login.php");
    exit;
}

require_once("../../config/conexao.php");

if (!isset($_GET['id'])) {
    header("Location: gerenciar_usuarios.php");
    exit;
}

$id = intval($_GET['id']);

// Buscar usuário
$stmt = $conn->prepare("SELECT * FROM usuarios WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows === 0) {
    header("Location: gerenciar_usuarios.php");
    exit;
}

$usuario = $result->fetch_assoc();

// Atualizar usuário
if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $nome  = trim($_POST['nome']);
    $email = trim($_POST['email']);
    $role  = $_POST['role'];
    $ativo = intval($_POST['ativo']);
    $senha = trim($_POST['senha']);

    // Atualizar sem trocar senha
    if (empty($senha)) {

        $sql = "UPDATE usuarios
                SET nome=?, email=?, role=?, ativo=?
                WHERE id=?";

        $stmt = $conn->prepare($sql);
        $stmt->bind_param(
            "sssii",
            $nome,
            $email,
            $role,
            $ativo,
            $id
        );

    } else {

        // Atualizar com nova senha
        $senhaHash = password_hash($senha, PASSWORD_DEFAULT);

        $sql = "UPDATE usuarios
                SET nome=?, email=?, senha=?, role=?, ativo=?
                WHERE id=?";

        $stmt = $conn->prepare($sql);
        $stmt->bind_param(
            "ssssii",
            $nome,
            $email,
            $senhaHash,
            $role,
            $ativo,
            $id
        );
    }

    if ($stmt->execute()) {
        header("Location: gerenciar_usuarios.php?msg=editado");
        exit;
    }

    $erro = "Erro ao atualizar usuário.";
}
?>

<!doctype html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <title>Editar Usuário</title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>

<body style="background:#f4f6f9;">

    <div class="container mt-5">

        <div class="card shadow p-4 rounded-4">

            <h2 class="mb-4">
                Editar Usuário
            </h2>

            <?php if (isset($erro)): ?>
            <div class="alert alert-danger">
                <?= $erro ?>
            </div>
            <?php endif; ?>

            <form method="POST">

                <div class="mb-3">
                    <label class="form-label">
                        Nome
                    </label>

                    <input type="text" name="nome" class="form-control"
                        value="<?= htmlspecialchars($usuario['nome']) ?>" required>
                </div>

                <div class="mb-3">
                    <label class="form-label">
                        Email
                    </label>

                    <input type="email" name="email" class="form-control"
                        value="<?= htmlspecialchars($usuario['email']) ?>" required>
                </div>

                <div class="mb-3">
                    <label class="form-label">
                        Nova Senha
                    </label>

                    <input type="password" name="senha" class="form-control">

                    <small class="text-muted">
                        Deixe vazio para manter a senha atual.
                    </small>
                </div>

                <div class="mb-3">
                    <label class="form-label">
                        Perfil
                    </label>

                    <select name="role" class="form-select">

                        <option value="admin" <?= $usuario['role'] === 'admin' ? 'selected' : '' ?>>
                            Admin
                        </option>

                        <option value="user" <?= $usuario['role'] === 'user' ? 'selected' : '' ?>>
                            Usuário
                        </option>

                    </select>
                </div>

                <div class="mb-4">
                    <label class="form-label">
                        Status
                    </label>

                    <select name="ativo" class="form-select">

                        <option value="1" <?= $usuario['ativo'] == 1 ? 'selected' : '' ?>>
                            Ativo
                        </option>

                        <option value="0" <?= $usuario['ativo'] == 0 ? 'selected' : '' ?>>
                            Inativo
                        </option>

                    </select>
                </div>

                <button class="btn btn-success">
                    Salvar Alterações
                </button>

                <a href="gerenciar_usuarios.php" class="btn btn-secondary">
                    Voltar
                </a>

            </form>

        </div>

    </div>

</body>

</html>
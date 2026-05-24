<?php
session_start();

if (!isset($_SESSION['usuario']) || ($_SESSION['role'] ?? '') !== 'admin') {
    header("Location: ../../login.php");
    exit;
}

require_once("../../config/conexao.php");

$erro = "";
$sucesso = "";

// Cadastro
if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $nome  = trim($_POST['nome']);
    $email = trim($_POST['email']);
    $senha = trim($_POST['senha']);
    $role  = $_POST['role'];
    $ativo = intval($_POST['ativo']);

    // Validação
    if (
        empty($nome) ||
        empty($email) ||
        empty($senha)
    ) {

        $erro = "Preencha todos os campos obrigatórios.";

    } else {

        // Verificar email já cadastrado
        $check = $conn->prepare(
            "SELECT id
             FROM usuarios
             WHERE email = ?"
        );

        $check->bind_param("s", $email);
        $check->execute();

        $result = $check->get_result();

        if ($result->num_rows > 0) {

            $erro = "Este email já está cadastrado.";

        } else {

            // Criptografar senha
            $senhaHash = password_hash(
                $senha,
                PASSWORD_DEFAULT
            );

            // Inserir usuário
            $sql = "
                INSERT INTO usuarios
                (
                    nome,
                    email,
                    senha,
                    role,
                    ativo
                )
                VALUES (?, ?, ?, ?, ?)
            ";

            $stmt = $conn->prepare($sql);

            $stmt->bind_param(
                "ssssi",
                $nome,
                $email,
                $senhaHash,
                $role,
                $ativo
            );

            if ($stmt->execute()) {

                header(
                    "Location: gerenciar_usuarios.php?msg=criado"
                );

                exit;

            } else {

                $erro = "Erro ao cadastrar usuário.";
            }
        }
    }
}
?>

<!doctype html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title>Criar Usuário</title>

    <!-- Bootstrap -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

    <style>
    body {
        background: #f4f6f9;
    }

    .card-custom {
        max-width: 700px;
        margin: auto;
        border-radius: 20px;
        border: none;
    }
    </style>
</head>

<body>

    <div class="container mt-5">

        <div class="card shadow-lg card-custom p-4">

            <h2 class="mb-4 fw-bold">

                <i class="bi bi-person-plus-fill"></i>
                Criar Usuário

            </h2>

            <?php if (!empty($erro)): ?>

            <div class="alert alert-danger">
                <?= $erro ?>
            </div>

            <?php endif; ?>

            <form method="POST">

                <!-- Nome -->
                <div class="mb-3">

                    <label class="form-label">
                        Nome
                    </label>

                    <input type="text" name="nome" class="form-control" required>

                </div>

                <!-- Email -->
                <div class="mb-3">

                    <label class="form-label">
                        Email
                    </label>

                    <input type="email" name="email" class="form-control" required>

                </div>

                <!-- Senha -->
                <div class="mb-3">

                    <label class="form-label">
                        Senha
                    </label>

                    <input type="password" name="senha" class="form-control" required>

                </div>

                <!-- Perfil -->
                <div class="mb-3">

                    <label class="form-label">
                        Perfil
                    </label>

                    <select name="role" class="form-select">

                        <option value="user">
                            Usuário
                        </option>

                        <option value="admin">
                            Administrador
                        </option>

                    </select>

                </div>

                <!-- Status -->
                <div class="mb-4">

                    <label class="form-label">
                        Status
                    </label>

                    <select name="ativo" class="form-select">

                        <option value="1">
                            Ativo
                        </option>

                        <option value="0">
                            Inativo
                        </option>

                    </select>

                </div>

                <div class="d-flex gap-2">

                    <button type="submit" class="btn btn-success">

                        <i class="bi bi-check-circle-fill"></i>
                        Criar Usuário

                    </button>

                    <a href="gerenciar_usuarios.php" class="btn btn-secondary">

                        <i class="bi bi-arrow-left"></i>
                        Voltar

                    </a>

                </div>

            </form>

        </div>

    </div>

</body>

</html>
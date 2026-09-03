<?php
session_start();
include("../config/conexao.php");

// Check if there are any users; if none, allow initial admin creation
$res = $conn->query("SELECT COUNT(*) AS c FROM usuarios");
$hasUsers = ($res->fetch_assoc()['c'] > 0);

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $nome = $conn->real_escape_string($_POST['nome']);
    $email = $conn->real_escape_string($_POST['email']);
    $senha = password_hash($_POST['senha'], PASSWORD_DEFAULT);
    $role = 'user';
    if (!$hasUsers) {
        $role = 'admin';
    } else {
        if (isset($_SESSION['usuario']) && $_SESSION['role'] === 'admin' && isset($_POST['role'])) {
            $role = $conn->real_escape_string($_POST['role']);
        }
    }
    $sql = "INSERT INTO usuarios (nome, email, senha, role) VALUES ('$nome', '$email', '$senha', '$role')";
    if ($conn->query($sql)) {
        header('Location: login.php');
        exit;
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
    <h4 class="card-title">Cadastro de Usuário</h4>
    <?php if (isset($error)): ?>
      <div class="alert alert-danger"><?= $error ?></div>
    <?php endif; ?>
    <form method="POST">
      <div class="mb-3">
        <label class="form-label">Nome</label>
        <input class="form-control" name="nome" required>
      </div>
      <div class="mb-3">
        <label class="form-label">E-mail</label>
        <input type="email" class="form-control" name="email" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Senha</label>
        <input type="password" class="form-control" name="senha" required>
      </div>
      <?php if ($hasUsers && isset($_SESSION['role']) && $_SESSION['role'] === 'admin'): ?>
      <div class="mb-3">
        <label class="form-label">Perfil</label>
        <select class="form-select" name="role">
          <option value="user">Usuário</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <?php endif; ?>
      <button class="btn btn-primary">Cadastrar</button>
    </form>
  </div>
</div>
<?php include("../includes/footer.php"); ?>
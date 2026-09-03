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

// Não permitir excluir o próprio usuário
if (
    isset($_SESSION['usuario_id']) &&
    $id == $_SESSION['usuario_id']
) {
    header("Location: gerenciar_usuarios.php");
    exit;
}

// Verifica se usuário existe
$stmt = $conn->prepare(
    "SELECT id FROM usuarios WHERE id = ?"
);

$stmt->bind_param("i", $id);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows === 0) {
    header("Location: gerenciar_usuarios.php");
    exit;
}

// Excluir usuário
$stmt = $conn->prepare(
    "DELETE FROM usuarios WHERE id = ?"
);

$stmt->bind_param("i", $id);

if ($stmt->execute()) {
    header("Location: gerenciar_usuarios.php?msg=excluido");
    exit;
}

header("Location: gerenciar_usuarios.php");
exit;
<?php
session_start();
if (!isset($_SESSION['usuario'])) {
    header('Location: ../login.php');
    exit;
}

include('../../config/conexao.php');

// Verifica se veio um ID válido via GET
if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
    die("<script>alert('ID inválido.'); window.location='listar_produtos.php';</script>");
}

$id = intval($_GET['id']);

// Busca produto antes de deletar (opcional, apenas para log)
$busca = $conn->prepare("SELECT nome FROM produtos WHERE id = ?");
$busca->bind_param("i", $id);
$busca->execute();
$resultado = $busca->get_result();
$produto = $resultado->fetch_assoc();

if (!$produto) {
    die("<script>alert('Produto não encontrado.'); window.location='listar_produtos.php';</script>");
}

// Deleta o produto
$stmt = $conn->prepare("DELETE FROM produtos WHERE id = ?");
$stmt->bind_param("i", $id);

if ($stmt->execute()) {
    // Aqui você pode adicionar o registro no histórico de exclusões
    echo "<script>alert('Produto \"{$produto['nome']}\" excluído com sucesso!'); window.location='listar_produtos.php';</script>";
} else {
    echo "<script>alert('Erro ao excluir o produto.'); window.location='listar_produtos.php';</script>";
}
?>

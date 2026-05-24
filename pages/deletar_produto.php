<?php
session_start();
if (!isset($_SESSION['usuario']) || $_SESSION['role'] !== 'admin') { header('Location: login.php'); exit; }
include("../config/conexao.php");
if (!isset($_GET['id'])) { die('Produto não encontrado'); }
$id = intval($_GET['id']);
$conn->query("DELETE FROM produtos WHERE id=$id");
header('Location: produtos.php');
exit;
?>
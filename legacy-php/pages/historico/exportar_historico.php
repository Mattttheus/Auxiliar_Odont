<?php
session_start();
if (!isset($_SESSION['usuario'])) { header('Location: ../login.php'); exit; }
include('../../config/conexao.php');

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=historico_saidas.csv');

$out = fopen('php://output', 'w');
fputcsv($out, ['id', 'produto', 'quantidade', 'data_saida', 'usuario']);

$res = $conn->query(
	"SELECT s.id, p.nome AS produto, s.quantidade, s.data_saida,
	        COALESCE(u.nome, IF(s.observacao LIKE 'Importado da planilha%', 'Importação da planilha', 'Usuário removido')) AS usuario
	 FROM saidas_produtos s
	 JOIN produtos p ON s.produto_id = p.id
	 LEFT JOIN usuarios u ON s.usuario_id = u.id
	 ORDER BY s.data_saida DESC"
);

while ($r = $res->fetch_assoc()) {
	fputcsv($out, [
		$r['id'],
		$r['produto'],
		$r['quantidade'],
		$r['data_saida'],
		$r['usuario']
	]);
}

fclose($out);
exit;

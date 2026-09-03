<?php
include('../../config/conexao.php');

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=historico_saidas.csv');

$out = fopen('php://output', 'w');
fputcsv($out, ['id', 'produto', 'quantidade', 'data_saida', 'usuario']);

$res = $conn->query(
	"SELECT s.id, p.nome AS produto, s.quantidade, s.data_saida, s.usuario
	 FROM saidas_produtos s
	 JOIN produtos p ON s.produto_id = p.id
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
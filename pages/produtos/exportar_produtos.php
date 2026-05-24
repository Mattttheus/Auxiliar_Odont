<?php
include('../../config/conexao.php');
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=produtos_export.csv');
$out = fopen('php://output','w');
fputcsv($out, ['id','nome','descricao','preco','quantidade','validade']);
$res = $conn->query("SELECT id,nome,descricao,preco,quantidade,validade FROM produtos ORDER BY id DESC");
while($r=$res->fetch_assoc()){ fputcsv($out, $r); }
fclose($out);
exit;
?>
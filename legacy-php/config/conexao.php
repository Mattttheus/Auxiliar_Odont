<?php
// MySQL local do WAMP: root sem senha, acessível só deste computador.
// Banco próprio: o estoque_db pertence ao projeto Auxiliar_Obras.
mysqli_report(MYSQLI_REPORT_OFF);
$host="localhost";
$user="root";
$pass="";
$db="auxiliar_odont";
$conn=new mysqli($host,$user,$pass,$db);
if($conn->connect_error){ die("Falha na conexão: ".$conn->connect_error); }
$conn->set_charset("utf8mb4");

// Conta desativada perde o acesso na próxima página, mesmo com a sessão aberta.
if (session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['user_id'])) {
    $ativa = $conn->query("SELECT ativo FROM usuarios WHERE id=" . intval($_SESSION['user_id']))->fetch_assoc();
    if (!$ativa || !$ativa['ativo']) {
        $raiz = substr($_SERVER['SCRIPT_NAME'], 0, strrpos($_SERVER['SCRIPT_NAME'], '/pages/'));
        header("Location: $raiz/logout.php");
        exit;
    }
}
?>

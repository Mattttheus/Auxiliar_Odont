<?php
$host="localhost";
$user="root";
$pass="4605";
$db="estoque_db";
$conn=new mysqli($host,$user,$pass,$db);
if($conn->connect_error){ die("Falha na conexão: ".$conn->connect_error); }
?>

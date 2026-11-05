<?php
// Exporta as respostas da API para a prévia de demonstração do GitHub Pages (previa/dados/),
// lida por assets/js/previa.js quando não há servidor.
//
// Uso: php banco/gerar_previa.php <banco de demonstração> <id do administrador nesse banco>
//
// A prévia é pública: use uma cópia com movimentações simuladas e usuários anonimizados.
// O banco real (auxiliar_odont) é recusado de propósito.
declare(strict_types=1);

[, $banco, $admin] = $argv + [null, null, null];
if (!$banco || !ctype_digit((string) $admin)) {
    fwrite(STDERR, "Uso: php banco/gerar_previa.php <banco de demonstração> <id do administrador>\n");
    exit(1);
}
if ($banco === 'auxiliar_odont') {
    fwrite(STDERR, "Recusado: a prévia é pública e não pode vir do banco real. Use uma cópia de demonstração.\n");
    exit(1);
}
putenv("AUXILIAR_DB=$banco");
$api = dirname(__DIR__) . '/api';
require "$api/nucleo.php";
foreach (glob("$api/modulos/*.php") as $modulo) {
    require $modulo;
}
$_SESSION = ['usuario_id' => (int) $admin];
if (!pode(usuario_atual(), 'financeiro')) {
    fwrite(STDERR, "O usuário $admin precisa ser administrador ativo em $banco.\n");
    exit(1);
}

$pasta = dirname(__DIR__) . '/previa/dados';
if (!is_dir($pasta)) {
    mkdir($pasta, 0777, true);
}
array_map('unlink', glob("$pasta/*.json"));
$total = 0;
$gravar = function (string $nome, $dados) use ($pasta, &$total) {
    $json = json_encode($dados, JSON_UNESCAPED_UNICODE);
    file_put_contents("$pasta/$nome.json", $json);
    $total += strlen($json);
};
$acao = fn(string $nome, array $dados = []) => ('acao_' . str_replace('.', '_', $nome))($dados);

foreach ([
    'sessao', 'produtos.listar', 'produtos.conferencia', 'saidas.listar', 'historico.listar', 'configuracoes.obter',
    'compras.sugerir', 'compras.listas', 'fornecedores.listar', 'cotacoes.listar', 'envios.config',
    'usuarios.listar', 'usuarios.pendentes', 'movimentacoes.desde',
] as $nome) {
    $gravar($nome, $acao($nome));
}

// Lotes de todos os produtos num arquivo só: { id do produto: [lotes] }.
$lotes = [];
foreach (linhas('SELECT DISTINCT produto_id FROM lotes WHERE quantidade > 0') as $l) {
    $lotes[$l['produto_id']] = $acao('lotes.listar', ['produto_id' => (int) $l['produto_id']]);
}
$gravar('lotes', (object) $lotes);

// Variantes por parâmetro; sem arquivo para a combinação pedida, a prévia usa o padrão.
$gravar('planejamento.projecao', $acao('planejamento.projecao', ['base' => 180, 'ajuste' => 0]));
foreach ([[90, 0], [180, 0], [365, 0], [180, -20], [180, 20], [180, 50]] as [$base, $ajuste]) {
    $gravar("planejamento.projecao__base-{$base}__ajuste-{$ajuste}", $acao('planejamento.projecao', ['base' => $base, 'ajuste' => $ajuste]));
}
$gravar('financeiro.analise', $acao('financeiro.analise', ['granularidade' => 'mensal', 'base' => 180]));
foreach (array_keys(GRANULARIDADES) as $granularidade) {
    foreach (BASES_APRENDIZADO as $base) {
        $gravar("financeiro.analise__granularidade-{$granularidade}__base-{$base}", $acao('financeiro.analise', ['granularidade' => $granularidade, 'base' => $base]));
    }
}
foreach (array_keys(TIPOS_ENVIO) as $tipo) {
    foreach (array_keys(DIAS_FREQUENCIA) as $frequencia) {
        $gravar("envios.previa__tipo-{$tipo}__frequencia-{$frequencia}", $acao('envios.previa', ['tipo' => $tipo, 'frequencia' => $frequencia, 'incluir_valores' => 1, 'cotar_fornecedores' => $tipo === 'compras' ? 1 : 0]));
    }
}

printf("%d arquivos, %.1f MB em %s\n", count(glob("$pasta/*.json")), $total / 1e6, $pasta);

<?php
// Análise financeira e de estoque por período: o realizado nos períodos anteriores, o período
// atual (realizado até hoje + previsão até o fim) e a previsão dos próximos, em semanas,
// meses, bimestres, trimestres ou semestres.
declare(strict_types=1);

// Quantos períodos anteriores e futuros cada granularidade mostra.
const GRANULARIDADES = ['semanal' => [8, 4], 'mensal' => [6, 3], 'bimestral' => [3, 2], 'trimestral' => [4, 2], 'semestral' => [2, 1]];
const MESES_GRANULARIDADE = ['mensal' => 1, 'bimestral' => 2, 'trimestral' => 3, 'semestral' => 6];
const MESES_ABREVIADOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function inicio_periodo(string $data, string $granularidade): string
{
    $t = strtotime($data);
    if ($granularidade === 'semanal') {
        return date('Y-m-d', strtotime('-' . (date('N', $t) - 1) . ' days', $t));
    }
    $mes = (int) date('n', $t);
    $mes -= ($mes - 1) % MESES_GRANULARIDADE[$granularidade];
    return sprintf('%s-%02d-01', date('Y', $t), $mes);
}

function deslocar_periodo(string $inicio, string $granularidade, int $n): string
{
    return $granularidade === 'semanal'
        ? date('Y-m-d', strtotime(sprintf('%+d days', 7 * $n), strtotime($inicio)))
        : date('Y-m-d', strtotime(sprintf('%+d months', MESES_GRANULARIDADE[$granularidade] * $n), strtotime($inicio)));
}

function rotulo_periodo(string $inicio, string $fim, string $granularidade): string
{
    $mes = (int) date('n', strtotime($inicio));
    $ano = date('Y', strtotime($inicio));
    switch ($granularidade) {
        case 'semanal':
            return date('d/m', strtotime($inicio)) . ' a ' . date('d/m', strtotime($fim));
        case 'mensal':
            return MESES_ABREVIADOS[$mes - 1] . "/$ano";
        case 'bimestral':
            return MESES_ABREVIADOS[$mes - 1] . '–' . MESES_ABREVIADOS[$mes] . "/$ano";
        case 'trimestral':
            return intdiv($mes - 1, 3) + 1 . "º tri $ano";
        default:
            return ($mes === 1 ? '1º' : '2º') . " sem $ano";
    }
}

function acao_financeiro_analise(array $dados): array
{
    $granularidade = $dados['granularidade'] ?? 'mensal';
    if (!isset(GRANULARIDADES[$granularidade])) {
        falhar('Escolha semanal, mensal, bimestral, trimestral ou semestral.');
    }
    return analise_periodos($granularidade, (int) ($dados['base'] ?? BASE_PADRAO));
}

function analise_periodos(string $granularidade, int $base): array
{
    $plano = calcular_planejamento($base, 0, true);
    $hoje = $plano['hoje'];
    [$passados, $futuros] = GRANULARIDADES[$granularidade];
    $atual = inicio_periodo($hoje, $granularidade);
    $inicioJanela = deslocar_periodo($atual, $granularidade, -$passados);

    $custos = array_column(array_map(fn($p) => ['id' => $p['produto_id'], 'c' => $p['custo_referencia']], $plano['produtos']), 'c', 'id');
    $quantidades = array_column($plano['produtos'], 'quantidade', 'produto_id');

    // ---------- REALIZADO, DIA A DIA ----------
    $entradas = [];
    foreach (linhas(
        'SELECT DATE(data_entrada) dia, SUM(quantidade) un, COALESCE(SUM(quantidade * custo_unitario), 0) valor, SUM(custo_unitario IS NULL) sem_custo, COUNT(*) n
         FROM entradas_produtos WHERE data_entrada >= ? GROUP BY dia',
        [$inicioJanela]
    ) as $l) {
        $entradas[$l['dia']] = $l;
    }
    $porFornecedor = linhas(
        "SELECT DATE(data_entrada) dia, COALESCE(fornecedor_nome, 'Sem fornecedor') fornecedor, COALESCE(SUM(quantidade * custo_unitario), 0) valor, COUNT(*) n
         FROM entradas_produtos WHERE data_entrada >= ? GROUP BY dia, fornecedor",
        [$inicioJanela]
    );
    // Saída sem custo gravado (anterior ao controle de custos) vale pelo custo de referência atual.
    $saidas = [];
    foreach (linhas(
        'SELECT DATE(data_saida) dia, produto_id, SUM(quantidade) un, COALESCE(SUM(quantidade * custo_unitario), 0) valor,
            SUM(CASE WHEN custo_unitario IS NULL THEN quantidade ELSE 0 END) un_sem_custo, COUNT(*) n
         FROM saidas_produtos WHERE data_saida >= ? GROUP BY dia, produto_id',
        [$inicioJanela]
    ) as $l) {
        $dia = $l['dia'];
        $saidas[$dia] ??= ['un' => 0, 'valor' => 0.0, 'n' => 0];
        $saidas[$dia]['un'] += (int) $l['un'];
        $saidas[$dia]['n'] += (int) $l['n'];
        $saidas[$dia]['valor'] += (float) $l['valor'] + (int) $l['un_sem_custo'] * ($custos[$l['produto_id']] ?? 0);
    }
    // Movimentos que mudam o saldo, para reconstruir o estoque no fim de cada período passado.
    $movimentos = linhas(
        "SELECT produto_id, DATE(data_entrada) dia, quantidade delta FROM entradas_produtos WHERE data_entrada >= ?
         UNION ALL SELECT produto_id, DATE(data_saida), -quantidade FROM saidas_produtos WHERE data_saida >= ?
         UNION ALL SELECT produto_id, DATE(data_acao), quantidade FROM historico WHERE acao IN ('Ajuste', 'Cadastro') AND produto_id IS NOT NULL AND data_acao >= ?",
        [$inicioJanela, $inicioJanela, $inicioJanela]
    );
    $previstas = linhas('SELECT * FROM planejamento_previsoes');
    $previstas = array_combine(array_column($previstas, 'mes'), $previstas) ?: [];

    $somaDias = function (array $porDia, string $de, string $ate, string $campo) {
        $total = 0;
        foreach ($porDia as $dia => $l) {
            if ($dia >= $de && $dia <= $ate) {
                $total += $l[$campo];
            }
        }
        return $total;
    };
    $estoqueEm = function (string $fim) use ($movimentos, $quantidades, $custos): array {
        $saldo = $quantidades;
        foreach ($movimentos as $m) {
            if ($m['dia'] > $fim && isset($saldo[$m['produto_id']])) {
                $saldo[$m['produto_id']] -= (int) $m['delta'];
            }
        }
        $unidades = $valor = 0;
        foreach ($saldo as $id => $qtd) {
            $qtd = max(0, $qtd);
            $unidades += $qtd;
            $valor += $qtd * ($custos[$id] ?? 0);
        }
        return [$unidades, round($valor, 2)];
    };

    // ---------- PERÍODOS ----------
    $periodos = [];
    for ($n = -$passados; $n <= $futuros; $n++) {
        $inicio = deslocar_periodo($atual, $granularidade, $n);
        $fim = date('Y-m-d', strtotime('-1 day', strtotime(deslocar_periodo($inicio, $granularidade, 1))));
        $tipo = $fim < $hoje ? 'anterior' : ($inicio > $hoje ? 'futuro' : 'atual');
        $ateRealizado = min($fim, $hoje);

        $p = [
            'inicio' => $inicio,
            'fim' => $fim,
            'rotulo' => rotulo_periodo($inicio, $fim, $granularidade),
            'tipo' => $tipo,
            'progresso' => $tipo === 'atual' ? round((dias_ate($hoje, $inicio) + 1) / (dias_ate($fim, $inicio) + 1), 3) : ($tipo === 'anterior' ? 1 : 0),
            'longo_prazo' => dias_ate($fim, $hoje) > max(HORIZONTES),
            'parcial' => dias_ate($fim, $hoje) > DIAS_PREVISAO,
            'compras_un' => 0, 'compras_valor' => 0.0, 'entradas' => 0, 'entradas_sem_custo' => 0,
            'consumo_un' => 0, 'consumo_valor' => 0.0, 'saidas' => 0,
            'consumo_previsto_un' => 0.0, 'consumo_previsto_valor' => 0.0,
            'compras_previstas_un' => 0, 'compras_previstas_valor' => 0.0, 'compras_previstas_itens' => 0, 'compras_previstas_sem_custo' => 0,
            'estoque_fim_un' => null, 'estoque_fim_valor' => null,
            'fornecedores' => [],
            'previsto_registrado' => null,
        ];
        if ($tipo !== 'futuro') {
            $p['compras_un'] = (int) $somaDias($entradas, $inicio, $ateRealizado, 'un');
            $p['compras_valor'] = round((float) $somaDias($entradas, $inicio, $ateRealizado, 'valor'), 2);
            $p['entradas'] = (int) $somaDias($entradas, $inicio, $ateRealizado, 'n');
            $p['entradas_sem_custo'] = (int) $somaDias($entradas, $inicio, $ateRealizado, 'sem_custo');
            $p['consumo_un'] = (int) $somaDias($saidas, $inicio, $ateRealizado, 'un');
            $p['consumo_valor'] = round((float) $somaDias($saidas, $inicio, $ateRealizado, 'valor'), 2);
            $p['saidas'] = (int) $somaDias($saidas, $inicio, $ateRealizado, 'n');
            [$p['estoque_fim_un'], $p['estoque_fim_valor']] = $estoqueEm($ateRealizado);
            $fornecedores = [];
            foreach ($porFornecedor as $f) {
                if ($f['dia'] >= $inicio && $f['dia'] <= $ateRealizado) {
                    $fornecedores[$f['fornecedor']] ??= ['fornecedor' => $f['fornecedor'], 'valor' => 0.0, 'entradas' => 0];
                    $fornecedores[$f['fornecedor']]['valor'] += (float) $f['valor'];
                    $fornecedores[$f['fornecedor']]['entradas'] += (int) $f['n'];
                }
            }
            usort($fornecedores, fn($a, $b) => $b['valor'] <=> $a['valor']);
            $p['fornecedores'] = array_slice($fornecedores, 0, 5);
        }
        if ($tipo !== 'anterior') {
            foreach ($plano['futuro']['consumo_un'] as $d => $qtd) {
                $data = date('Y-m-d', strtotime("$hoje +$d days"));
                if ($data >= $inicio && $data <= $fim) {
                    $p['consumo_previsto_un'] += $qtd;
                    $p['consumo_previsto_valor'] += $plano['futuro']['consumo_valor'][$d];
                }
            }
            foreach ($plano['futuro']['compras'] as $data => $c) {
                if ($data >= max($inicio, $hoje) && $data <= $fim) {
                    $p['compras_previstas_un'] += $c['un'];
                    $p['compras_previstas_valor'] += $c['valor'];
                    $p['compras_previstas_itens'] += $c['itens'];
                    $p['compras_previstas_sem_custo'] += $c['sem_custo'];
                }
            }
            $p['consumo_previsto_un'] = round($p['consumo_previsto_un'], 1);
            $p['consumo_previsto_valor'] = round($p['consumo_previsto_valor'], 2);
            $p['compras_previstas_valor'] = round($p['compras_previstas_valor'], 2);
        }
        if ($granularidade === 'mensal' && isset($previstas[substr($inicio, 0, 7)])) {
            $r = $previstas[substr($inicio, 0, 7)];
            $p['previsto_registrado'] = [
                'gerado_em' => str_replace(' ', 'T', $r['gerado_em']),
                'consumo_un' => (float) $r['consumo_un'],
                'consumo_valor' => (float) $r['consumo_valor'],
                'compras_valor' => (float) $r['compras_valor'],
            ];
        }
        $periodos[] = $p;
    }

    return [
        'granularidade' => $granularidade,
        'hoje' => $hoje,
        'periodos' => $periodos,
        'aprendizado' => $plano['aprendizado'],
        'parametros' => $plano['parametros'],
        'itens_sem_custo' => count(array_filter($custos, fn($c) => $c === null)),
        'itens' => count($custos),
        'consumo_previsto_sem_custo' => $plano['futuro']['itens_consumo_sem_custo'],
        'demonstrativo' => $plano['demonstrativo'],
    ];
}

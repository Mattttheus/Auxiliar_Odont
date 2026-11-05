<?php
// Planejamento de compras e previsão de estoque. Aprende o consumo de cada produto com o
// histórico de saídas, projeta o estoque dia a dia (lotes, vencimentos e pedidos em aberto)
// e transforma a necessidade em compras programadas por janela de 30 dias e gasto previsto.
// A tela mostra 30, 60 e 90 dias; a análise financeira e os e-mails usam o horizonte inteiro.
declare(strict_types=1);

const HORIZONTES = [30, 60, 90];   // janelas exibidas no planejamento
const JANELA_DIAS = 30;
const DIAS_PREVISAO = 390;         // 13 janelas: cobre o próximo semestre inteiro
const SEMANAS_PREVISAO = 56;       // 392 dias
const BASES_APRENDIZADO = [90, 180, 365];
const BASE_PADRAO = 180;

// Nível de serviço pela curva ABC: a chance de não faltar durante o prazo de entrega e o
// fator z da distribuição normal que dá essa chance.
const NIVEL_SERVICO = ['A' => [98, 2.054], 'B' => [95, 1.645], 'C' => [90, 1.282]];

// Suavização exponencial de Holt: peso do nível, peso da tendência e amortecimento da tendência.
const HOLT_ALFA = 0.3;
const HOLT_BETA = 0.1;
const HOLT_FI = 0.9;
const SEMANAS_MINIMAS_HOLT = 8;
const CROSTON_ALFA = 0.15;

/**
 * Aprende o comportamento semanal de um produto:
 *   sem_historico: nenhuma saída na base, previsão zero;
 *   media: pouco histórico (menos de 8 semanas ou de 3 semanas com consumo), média simples;
 *   croston: consumo intermitente (mais da metade das semanas sem saída), em que a tendência
 *            seria ruído: suaviza à parte o tamanho de cada consumo e o intervalo entre eles
 *            (Croston com a correção de Syntetos-Boylan);
 *   holt: nível e tendência por suavização exponencial, com a tendência amortecida para não
 *         extrapolar. O desvio é o erro das previsões de uma semana à frente.
 */
function aprender_consumo(array $semanas): array
{
    $n = count($semanas);
    $total = array_sum($semanas);
    $media = $n ? $total / $n : 0.0;
    if ($n === 0 || $total <= 0) {
        return ['metodo' => 'sem_historico', 'nivel' => 0.0, 'tendencia' => 0.0, 'desvio' => 0.0, 'media' => 0.0];
    }
    $desvio = $n > 1 ? sqrt(array_sum(array_map(fn($v) => ($v - $media) ** 2, $semanas)) / ($n - 1)) : 0.0;
    $comConsumo = count(array_filter($semanas, fn($v) => $v > 0));
    if ($n < SEMANAS_MINIMAS_HOLT || $comConsumo < 3) {
        return ['metodo' => 'media', 'nivel' => $media, 'tendencia' => 0.0, 'desvio' => $desvio, 'media' => $media];
    }

    if ($comConsumo * 2 < $n) {
        $tamanho = $intervalo = null;
        $desde = 0;
        foreach ($semanas as $real) {
            $desde++;
            if ($real <= 0) {
                continue;
            }
            $tamanho = $tamanho === null ? (float) $real : $tamanho + CROSTON_ALFA * ($real - $tamanho);
            $intervalo = $intervalo === null ? (float) $desde : $intervalo + CROSTON_ALFA * ($desde - $intervalo);
            $desde = 0;
        }
        $nivel = (1 - CROSTON_ALFA / 2) * $tamanho / $intervalo;
        return ['metodo' => 'croston', 'nivel' => $nivel, 'tendencia' => 0.0, 'desvio' => $desvio, 'media' => $media];
    }

    $aquecimento = 4;
    $nivel = array_sum(array_slice($semanas, 0, $aquecimento)) / $aquecimento;
    $tendencia = 0.0;
    $erros = [];
    foreach ($semanas as $t => $real) {
        $previsto = $nivel + HOLT_FI * $tendencia;
        if ($t >= $aquecimento) {
            $erros[] = $real - max(0.0, $previsto);
        }
        $novoNivel = HOLT_ALFA * $real + (1 - HOLT_ALFA) * $previsto;
        $tendencia = HOLT_BETA * ($novoNivel - $nivel) + (1 - HOLT_BETA) * HOLT_FI * $tendencia;
        $nivel = $novoNivel;
    }
    if (count($erros) >= 4) {
        $desvio = sqrt(array_sum(array_map(fn($e) => $e ** 2, $erros)) / count($erros));
    }
    return ['metodo' => 'holt', 'nivel' => $nivel, 'tendencia' => $tendencia, 'desvio' => $desvio, 'media' => $media];
}

/** Consumo previsto por semana: nível + tendência amortecida, nunca negativo. */
function prever_semanas(array $modelo, float $fator): array
{
    $previsao = [];
    $amortecida = 0.0;
    $peso = 1.0;
    for ($h = 1; $h <= SEMANAS_PREVISAO; $h++) {
        $peso *= HOLT_FI;
        $amortecida += $peso;
        $previsao[] = max(0.0, ($modelo['nivel'] + $modelo['tendencia'] * $amortecida) * $fator);
    }
    return $previsao;
}

/**
 * Curva ABC com a mesma regra de assets/js/curva-abc.js: em ordem decrescente, classe A até
 * 80% do total, B até 95% e C o restante; empates ficam na mesma classe e quem não teve
 * consumo é C. Recebe [id => ['valor' => ..., 'nome' => ...]] e devolve [id => classe].
 */
function classificar_abc(array $itens): array
{
    uasort($itens, fn($a, $b) => [$b['valor'], $a['nome']] <=> [$a['valor'], $b['nome']]);
    $total = array_sum(array_column($itens, 'valor'));
    $classes = [];
    $acumulado = 0.0;
    $anterior = null;
    foreach ($itens as $id => $item) {
        $classe = 'C';
        if ($item['valor'] > 0) {
            if ($anterior && $anterior['valor'] == $item['valor']) {
                $classe = $anterior['classe'];
            } elseif ($acumulado * 100 < 80 * $total) {
                $classe = 'A';
            } elseif ($acumulado * 100 < 95 * $total) {
                $classe = 'B';
            }
        }
        $acumulado += $item['valor'];
        $anterior = ['valor' => $item['valor'], 'classe' => $classe];
        $classes[$id] = $classe;
    }
    return $classes;
}

function dias_ate(string $data, string $hoje): int
{
    return (int) round((strtotime($data) - strtotime($hoje)) / 86400);
}

/**
 * Lotes do produto como [dia em que vence, quantidade], do que vence antes ao último. O saldo
 * do produto é o que vale: se os lotes somam mais, sobra nos que vencem por último; se somam
 * menos, a diferença não tem validade. Sem lotes, vale a validade do cadastro.
 */
function lotes_do_produto(array $produto, array $lotes, string $hoje): array
{
    $quantidade = (int) $produto['quantidade'];
    if ($quantidade <= 0) {
        return [];
    }
    if (!$lotes) {
        return [[$produto['validade'] === null ? PHP_INT_MAX : dias_ate($produto['validade'], $hoje), (float) $quantidade]];
    }
    usort($lotes, fn($a, $b) => $a[0] <=> $b[0]);
    $resultado = [];
    $restante = $quantidade;
    foreach ($lotes as [$vence, $qtd]) {
        $usa = min($qtd, $restante);
        if ($usa > 0) {
            $resultado[] = [$vence, (float) $usa];
        }
        $restante -= $usa;
    }
    if ($restante > 0) {
        $resultado[] = [PHP_INT_MAX, (float) $restante];
    }
    return $resultado;
}

/**
 * Simula o estoque dia a dia sem novas compras: chegam os pedidos em aberto, os lotes não
 * usados vencem no fim do dia da validade (perda) e o consumo previsto sai primeiro do lote
 * que vence antes (FEFO); o que não houver para atender é falta. Guarda o estado no fim de
 * cada janela de 30 dias, o primeiro dia abaixo do estoque de proteção e o primeiro dia de
 * falta. Contar a partir da proteção, e não do ponto de pedido, também antecipa as quedas
 * bruscas, como um lote grande que vence de uma vez.
 */
function simular_estoque(array $lotes, array $chegadas, array $consumoDiario, int $protecao): array
{
    $saldo = (float) array_sum(array_column($lotes, 1));
    $diaAbaixo = $saldo < $protecao - 1e-9 ? 0 : null;
    $diaRuptura = null;
    $demanda = $consumo = $perdas = $falta = 0.0;
    $janelas = [];

    for ($dia = 1; $dia <= DIAS_PREVISAO; $dia++) {
        if (isset($chegadas[$dia])) {
            $lotes[] = [PHP_INT_MAX, (float) $chegadas[$dia]];
        }
        foreach ($lotes as $i => [$vence, $qtd]) {
            if ($vence < $dia) {
                $perdas += $qtd;
                unset($lotes[$i]);
            }
        }
        $pedido = $consumoDiario[$dia - 1];
        $demanda += $pedido;
        $restante = $pedido;
        foreach ($lotes as $i => $lote) {
            if ($restante <= 1e-9) {
                break;
            }
            $tira = min($restante, $lote[1]);
            $lotes[$i][1] -= $tira;
            $restante -= $tira;
        }
        $lotes = array_values(array_filter($lotes, fn($l) => $l[1] > 1e-9));
        $consumo += $pedido - $restante;
        $falta += $restante;
        $saldo = (float) array_sum(array_column($lotes, 1));

        if ($diaAbaixo === null && $saldo < $protecao - 1e-9) {
            $diaAbaixo = $dia;
        }
        if ($diaRuptura === null && $restante > 1e-9) {
            $diaRuptura = $dia;
        }
        if ($dia % JANELA_DIAS === 0) {
            $janelas[$dia] = compact('demanda', 'consumo', 'perdas', 'falta', 'saldo');
        }
    }
    return ['dia_abaixo' => $diaAbaixo, 'dia_ruptura' => $diaRuptura, 'janelas' => $janelas];
}

function acao_planejamento_projecao(array $dados): array
{
    $base = (int) ($dados['base'] ?? BASE_PADRAO);
    $ajuste = ($dados['ajuste'] ?? '') === '' ? 0 : inteiro($dados, 'ajuste');
    $plano = calcular_planejamento($base, $ajuste, pode(usuario_atual(), 'financeiro'));
    unset($plano['futuro']);
    return $plano;
}

/**
 * Calcula o plano completo. $ajuste é o cenário de demanda em % (0 = o que foi aprendido).
 * Com $verCustos a resposta inclui custos, gastos e valores; sem, só quantidades.
 * 'futuro' (uso interno) traz o consumo previsto dia a dia e as compras pela data do pedido,
 * para a análise por período.
 */
function calcular_planejamento(int $base, int $ajuste, bool $verCustos): array
{
    if (!in_array($base, BASES_APRENDIZADO, true)) {
        $base = BASE_PADRAO;
    }
    if ($ajuste < -50 || $ajuste > 200) {
        falhar('O cenário de demanda deve ficar entre -50% e +200%.');
    }
    $fator = 1 + $ajuste / 100;
    $cfg = configuracoes();
    $prazo = (int) $cfg['dias_reposicao'];
    $hoje = date('Y-m-d');
    $diaDe = fn(int $d) => date('Y-m-d', strtotime("$hoje +$d days"));

    // ---------- BASE DE APRENDIZADO: semanas completas até hoje ----------
    $primeira = array_filter([
        linha('SELECT DATE(MIN(data_saida)) d FROM saidas_produtos')['d'],
        linha('SELECT DATE(MIN(data_entrada)) d FROM entradas_produtos')['d'],
    ]);
    $diasComDados = $primeira ? dias_ate($hoje, min($primeira)) + 1 : 0;
    $semanas = min(intdiv($base, 7), (int) ceil($diasComDados / 7));
    $inicioBase = $semanas ? date('Y-m-d', strtotime("$hoje -" . (7 * $semanas - 1) . ' days')) : $hoje;

    $series = [];
    $saidasBase = 0;
    if ($semanas) {
        $saidasBase = (int) linha('SELECT COUNT(*) n FROM saidas_produtos WHERE data_saida >= ?', [$inicioBase])['n'];
        foreach (linhas(
            'SELECT produto_id, DATEDIFF(?, DATE(data_saida)) atras, SUM(quantidade) q FROM saidas_produtos WHERE data_saida >= ? GROUP BY produto_id, atras',
            [$hoje, $inicioBase]
        ) as $l) {
            $indice = $semanas - 1 - intdiv((int) $l['atras'], 7);
            if ($l['atras'] >= 0 && $indice >= 0) {
                $series[$l['produto_id']] ??= array_fill(0, $semanas, 0);
                $series[$l['produto_id']][$indice] += (int) $l['q'];
            }
        }
    }
    $ultimaSaida = linha('SELECT DATE(MAX(data_saida)) d FROM saidas_produtos')['d'];

    // ---------- ESTOQUE, LOTES, PEDIDOS EM ABERTO E CUSTOS ----------
    $produtos = linhas('SELECT * FROM produtos ORDER BY nome');
    $lotes = [];
    foreach (linhas('SELECT produto_id, validade, quantidade FROM lotes WHERE quantidade > 0') as $l) {
        $lotes[$l['produto_id']][] = [$l['validade'] === null ? PHP_INT_MAX : dias_ate($l['validade'], $hoje), (int) $l['quantidade']];
    }
    // Lista aberta chega no prazo de entrega a partir de hoje; pedido enviado, no prazo contado do envio.
    $chegadas = [];
    $pendentes = [];
    foreach (linhas(
        "SELECT i.produto_id, i.quantidade, l.status, DATEDIFF(CURDATE(), DATE(l.atualizado_em)) desde
         FROM listas_compra_itens i JOIN listas_compra l ON l.id = i.lista_id
         WHERE l.status IN ('aberta', 'enviada') AND i.produto_id IS NOT NULL"
    ) as $i) {
        $dia = max(1, $i['status'] === 'enviada' ? $prazo - (int) $i['desde'] : $prazo);
        if ($dia <= DIAS_PREVISAO) {
            $chegadas[$i['produto_id']][$dia] = ($chegadas[$i['produto_id']][$dia] ?? 0) + (int) $i['quantidade'];
        }
        $pendentes[$i['produto_id']] = ($pendentes[$i['produto_id']] ?? 0) + (int) $i['quantidade'];
    }
    $listasAbertas = (int) linha("SELECT COUNT(*) n FROM listas_compra WHERE status IN ('aberta', 'enviada')")['n'];
    $ultimoCusto = array_column(linhas(
        'SELECT e.produto_id, e.custo_unitario FROM entradas_produtos e
         JOIN (SELECT produto_id, MAX(id) id FROM entradas_produtos WHERE custo_unitario IS NOT NULL GROUP BY produto_id) u ON u.id = e.id'
    ), 'custo_unitario', 'produto_id');

    // ---------- CURVA ABC: por valor quando todo item consumido tem custo; senão por quantidade ----------
    $custos = [];
    foreach ($produtos as $p) {
        $ultimo = $ultimoCusto[$p['id']] ?? null;
        $custos[$p['id']] = $ultimo !== null ? (float) $ultimo : ($p['custo_medio'] === null ? null : (float) $p['custo_medio']);
    }
    $consumidos = array_keys(array_filter($series, fn($s) => array_sum($s) > 0));
    $semCustoConsumidos = count(array_filter($consumidos, fn($id) => $custos[$id] === null));
    $porValor = $consumidos && $semCustoConsumidos === 0;
    $classes = $produtos ? classificar_abc(array_combine(
        array_column($produtos, 'id'),
        array_map(fn($p) => [
            'nome' => $p['nome'],
            'valor' => array_sum($series[$p['id']] ?? []) * ($porValor ? $custos[$p['id']] : 1),
        ], $produtos)
    )) : [];

    // ---------- PROJEÇÃO POR PRODUTO ----------
    // Para a análise por período: consumo pelo dia em que acontece; compra pelo dia em que o
    // pedido precisa ser feito, que é quando o dinheiro é comprometido.
    $futuro = [
        'consumo_un' => array_fill(1, DIAS_PREVISAO, 0.0),
        'consumo_valor' => array_fill(1, DIAS_PREVISAO, 0.0),
        'compras' => [],
        'itens_consumo_sem_custo' => 0,
    ];
    $resultado = [];
    $metodos = ['holt' => 0, 'croston' => 0, 'media' => 0, 'sem_historico' => 0];
    foreach ($produtos as $p) {
        $id = (int) $p['id'];
        $quantidade = (int) $p['quantidade'];
        $minimo = (int) $p['estoque_minimo'];
        $custo = $custos[$id];
        $serie = $series[$id] ?? array_fill(0, $semanas, 0);
        $modelo = aprender_consumo($serie);
        $metodos[$modelo['metodo']]++;
        $previsao = prever_semanas($modelo, $fator);
        $semAjuste = prever_semanas($modelo, 1.0);
        $diaria = [];
        for ($d = 1; $d <= DIAS_PREVISAO; $d++) {
            $diaria[] = $previsao[intdiv($d - 1, 7)] / 7;
        }
        if (array_sum($diaria) > 0 && $custo === null) {
            $futuro['itens_consumo_sem_custo']++;
        }
        foreach ($diaria as $d => $qtd) {
            $futuro['consumo_un'][$d + 1] += $qtd;
            $futuro['consumo_valor'][$d + 1] += $custo === null ? 0 : $qtd * $custo;
        }

        $classe = $classes[$id] ?? 'C';
        [$nivelServico, $z] = NIVEL_SERVICO[$classe];
        $desvio = $modelo['desvio'] * $fator;
        $seguranca = (int) ceil(round($z * $desvio * sqrt(max(1, $prazo) / 7), 6));
        $protecao = max($minimo, $seguranca);
        $pontoPedido = $protecao + array_sum(array_slice($diaria, 0, $prazo));

        $todosLotes = lotes_do_produto($p, $lotes[$id] ?? [], $hoje);
        $vencido = array_sum(array_map(fn($l) => $l[0] < 0 ? $l[1] : 0, $todosLotes));
        $validos = array_values(array_filter($todosLotes, fn($l) => $l[0] >= 0));
        $comValidade = array_values(array_filter($validos, fn($l) => $l[0] !== PHP_INT_MAX));
        $sim = simular_estoque($validos, $chegadas[$id] ?? [], $diaria, $protecao);
        // Pedir um prazo de entrega antes de o estoque ficar abaixo da proteção.
        $diaPedido = $sim['dia_abaixo'] === null ? null : max(0, $sim['dia_abaixo'] - $prazo);

        $janelas = [];
        $programadas = [];
        $acumuladoAnterior = 0;
        $primeiraCompra = null;
        foreach ($sim['janelas'] as $dias => $e) {
            $necessario = (int) ceil(round($protecao + $e['falta'] - $e['saldo'], 6));
            $acumulado = max($acumuladoAnterior, $necessario, 0);
            $compra = $acumulado - $acumuladoAnterior;
            $pedirAte = null;
            if ($compra > 0) {
                $inicio = $dias - JANELA_DIAS;
                // A primeira compra vence um prazo de entrega antes de o estoque cair abaixo da
                // proteção; as seguintes, um prazo antes do início da janela que abastecem.
                $dia = $primeiraCompra === null
                    ? min($diaPedido ?? max(0, $inicio - $prazo), $dias)
                    : max($diaPedido ?? 0, $inicio - $prazo, 0);
                $primeiraCompra ??= $dia;
                $pedirAte = $diaDe($dia);
                $futuro['compras'][$pedirAte] ??= ['un' => 0, 'valor' => 0.0, 'itens' => 0, 'sem_custo' => 0];
                $futuro['compras'][$pedirAte]['un'] += $compra;
                $futuro['compras'][$pedirAte]['itens']++;
                if ($custo === null) {
                    $futuro['compras'][$pedirAte]['sem_custo']++;
                } else {
                    $futuro['compras'][$pedirAte]['valor'] += $compra * $custo;
                }
                $programada = ['inicio' => $inicio, 'dias' => $dias, 'compra' => $compra, 'pedir_ate' => $pedirAte];
                if ($verCustos) {
                    $programada['gasto'] = $custo === null ? null : round($compra * $custo, 2);
                }
                $programadas[] = $programada;
            }
            if (in_array($dias, HORIZONTES, true)) {
                $h = [
                    'dias' => $dias,
                    'demanda' => round($e['demanda'], 2),
                    'perdas' => round($e['perdas'], 2),
                    'falta' => round($e['falta'], 2),
                    'saldo' => round($e['saldo'], 2),
                    'compra' => $compra,
                    'compra_acumulada' => $acumulado,
                    'pedir_ate' => $pedirAte,
                ];
                if ($verCustos) {
                    $h['gasto'] = $custo === null ? null : round($compra * $custo, 2);
                }
                $janelas[] = $h;
            }
            $acumuladoAnterior = $acumulado;
        }

        $mediaSemanal = $modelo['media'];
        $tendencia = $mediaSemanal > 0 ? (array_sum(array_slice($semAjuste, 0, 13)) / 13 - $mediaSemanal) / $mediaSemanal * 100 : null;
        $h90 = end($janelas);
        $motivos = [];
        if ($quantidade === 0) {
            $motivos[] = 'Sem estoque';
        } elseif ($quantidade < $minimo) {
            $motivos[] = 'Abaixo do mínimo';
        }
        if ($vencido > 0) {
            $motivos[] = "$vencido un. vencidas";
        }
        if ($sim['dia_ruptura'] !== null && $sim['dia_ruptura'] <= max(HORIZONTES) && $quantidade > 0) {
            $motivos[] = 'Acaba em ' . date('d/m', strtotime($diaDe($sim['dia_ruptura'])));
        }
        if ($h90['perdas'] > 0) {
            $motivos[] = ceil($h90['perdas']) . ' un. vencem antes do uso';
        }
        if ($tendencia !== null && $tendencia >= 10) {
            $motivos[] = 'Consumo em alta (+' . round($tendencia) . '%)';
        }
        if (!empty($pendentes[$id])) {
            $motivos[] = "{$pendentes[$id]} un. em listas abertas";
        }

        $item = [
            'produto_id' => $id,
            'nome' => $p['nome'],
            'codigo_barras' => $p['codigo_barras'],
            'categoria' => $p['categoria'],
            'unidade' => $p['unidade'],
            'localizacao' => $p['localizacao'],
            'quantidade' => $quantidade,
            'estoque_minimo' => $minimo,
            'vencido' => $vencido,
            'validade_proxima' => $comValidade ? $diaDe($comValidade[0][0]) : null,
            'qtd_validade_proxima' => $comValidade ? $comValidade[0][1] : 0,
            'pendente' => $pendentes[$id] ?? 0,
            'classe' => $classe,
            'nivel_servico' => $nivelServico,
            'metodo' => $modelo['metodo'],
            'consumo_base' => array_sum($serie),
            'media_semanal' => round($mediaSemanal, 3),
            'demanda_semanal' => round($previsao[0], 3),
            'tendencia_pct' => $tendencia === null ? null : round($tendencia, 1),
            'desvio_semanal' => round($desvio, 3),
            'estoque_seguranca' => $seguranca,
            'protecao' => $protecao,
            'ponto_pedido' => (int) ceil(round($pontoPedido, 6)),
            'dia_pedido' => $diaPedido,
            'data_pedido' => $diaPedido === null ? null : $diaDe($diaPedido),
            'dia_ruptura' => $sim['dia_ruptura'],
            'data_ruptura' => $sim['dia_ruptura'] === null ? null : $diaDe($sim['dia_ruptura']),
            'horizontes' => $janelas,
            'compras_programadas' => $programadas,
            'motivo' => implode(' · ', $motivos),
            'serie' => array_sum($serie) > 0 ? $serie : [],
            'previsao' => array_sum($serie) > 0 ? array_map(fn($v) => round($v, 3), array_slice($previsao, 0, 13)) : [],
        ];
        if ($verCustos) {
            $item['custo_medio'] = $p['custo_medio'] === null ? null : (float) $p['custo_medio'];
            $item['ultimo_custo'] = isset($ultimoCusto[$id]) ? (float) $ultimoCusto[$id] : null;
            $item['custo_referencia'] = $custo;
        }
        $resultado[] = $item;
    }

    $plano = [
        'hoje' => $hoje,
        'parametros' => [
            'base_dias' => $base,
            'ajuste' => $ajuste,
            'prazo_entrega' => $prazo,
            'dias_alerta_validade' => (int) $cfg['dias_alerta_validade'],
            'horizontes' => HORIZONTES,
            'niveis_servico' => array_map(fn($n) => $n[0], NIVEL_SERVICO),
            'criterio_abc' => $porValor ? 'valor' : 'quantidade',
            'consumidos_sem_custo' => $semCustoConsumidos,
        ],
        'aprendizado' => [
            'inicio' => $semanas ? $inicioBase : null,
            'semanas' => $semanas,
            'saidas' => $saidasBase,
            'ultima_saida' => $ultimaSaida,
            'produtos_com_consumo' => count($consumidos),
            'metodos' => $metodos,
        ],
        'demonstrativo' => demonstrativo($resultado, $custos, $listasAbertas, $verCustos),
        'curva_compras' => $verCustos ? curva_compras($hoje) : null,
        'produtos' => $resultado,
        'futuro' => $futuro,
    ];
    if ($ajuste === 0) {
        registrar_previsao_do_mes($plano);
    }
    return $plano;
}

/** Totais de hoje e de cada horizonte. Valores em reais só para quem vê custos. */
function demonstrativo(array $itens, array $custos, int $listasAbertas, bool $verCustos): array
{
    $valor = fn(array $i, float $qtd) => $custos[$i['produto_id']] === null ? 0.0 : $qtd * $custos[$i['produto_id']];
    $atual = [
        'itens' => count($itens),
        'unidades' => array_sum(array_column($itens, 'quantidade')),
        'sem_estoque' => count(array_filter($itens, fn($i) => $i['quantidade'] === 0)),
        'abaixo_minimo' => count(array_filter($itens, fn($i) => $i['quantidade'] < $i['estoque_minimo'])),
        'abaixo_protecao' => count(array_filter($itens, fn($i) => $i['quantidade'] - $i['vencido'] < $i['protecao'])),
        'vencidos' => array_sum(array_column($itens, 'vencido')),
        'pendente' => array_sum(array_column($itens, 'pendente')),
        'listas_abertas' => $listasAbertas,
    ];
    if ($verCustos) {
        $atual['valor_estoque'] = round(array_sum(array_map(fn($i) => $valor($i, $i['quantidade'] - $i['vencido']), $itens)), 2);
        $atual['valor_vencidos'] = round(array_sum(array_map(fn($i) => $valor($i, $i['vencido']), $itens)), 2);
        $atual['itens_sem_custo'] = count(array_filter($itens, fn($i) => $custos[$i['produto_id']] === null));
    }

    $futuro = [];
    foreach (HORIZONTES as $k => $dias) {
        $h = fn(array $i) => $i['horizontes'][$k];
        $soma = fn(string $campo) => round(array_sum(array_map(fn($i) => $h($i)[$campo], $itens)), 2);
        $comSaldo = fn(array $i) => max(0, $h($i)['saldo'] + $h($i)['compra_acumulada'] - $h($i)['falta']);
        $comCompra = array_filter($itens, fn($i) => $h($i)['compra'] > 0);
        $linha = [
            'dias' => $dias,
            'demanda' => $soma('demanda'),
            'perdas' => $soma('perdas'),
            'itens_com_perda' => count(array_filter($itens, fn($i) => $h($i)['perdas'] > 0)),
            'falta' => $soma('falta'),
            'itens_ruptura' => count(array_filter($itens, fn($i) => $h($i)['falta'] > 0)),
            'itens_abaixo_protecao' => count(array_filter($itens, fn($i) => $h($i)['saldo'] < $i['protecao'])),
            'saldo' => $soma('saldo'),
            'compra_itens' => count($comCompra),
            'compra_unidades' => array_sum(array_map(fn($i) => $h($i)['compra'], $itens)),
            'compra_acumulada' => array_sum(array_map(fn($i) => $h($i)['compra_acumulada'], $itens)),
            'saldo_com_compras' => round(array_sum(array_map($comSaldo, $itens)), 2),
        ];
        if ($verCustos) {
            $linha['valor_demanda'] = round(array_sum(array_map(fn($i) => $valor($i, $h($i)['demanda']), $itens)), 2);
            $linha['valor_perdas'] = round(array_sum(array_map(fn($i) => $valor($i, $h($i)['perdas']), $itens)), 2);
            $linha['valor_saldo'] = round(array_sum(array_map(fn($i) => $valor($i, $h($i)['saldo']), $itens)), 2);
            $linha['gasto'] = round(array_sum(array_map(fn($i) => $valor($i, $h($i)['compra']), $itens)), 2);
            $linha['gasto_acumulado'] = round(array_sum(array_map(fn($i) => $valor($i, $h($i)['compra_acumulada']), $itens)), 2);
            $linha['valor_saldo_com_compras'] = round(array_sum(array_map(fn($i) => $valor($i, $comSaldo($i)), $itens)), 2);
            $linha['compras_sem_custo'] = count(array_filter($comCompra, fn($i) => $custos[$i['produto_id']] === null));
        }
        $futuro[] = $linha;
    }
    return ['atual' => $atual, 'futuro' => $futuro];
}

/** Compras realizadas nos últimos 6 meses (entradas com custo informado), mês a mês. */
function curva_compras(string $hoje): array
{
    $inicio = date('Y-m-01', strtotime(date('Y-m-01', strtotime($hoje)) . ' -5 months'));
    $porMes = [];
    foreach (linhas(
        "SELECT DATE_FORMAT(data_entrada, '%Y-%m') mes, COUNT(*) entradas, SUM(custo_unitario IS NULL) sem_custo,
            COALESCE(SUM(quantidade * custo_unitario), 0) valor
         FROM entradas_produtos WHERE data_entrada >= ? GROUP BY mes",
        [$inicio]
    ) as $l) {
        $porMes[$l['mes']] = $l;
    }
    $meses = [];
    for ($m = 0; $m < 6; $m++) {
        $mes = date('Y-m', strtotime("$inicio +$m months"));
        $meses[] = [
            'mes' => $mes,
            'entradas' => (int) ($porMes[$mes]['entradas'] ?? 0),
            'sem_custo' => (int) ($porMes[$mes]['sem_custo'] ?? 0),
            'valor' => round((float) ($porMes[$mes]['valor'] ?? 0), 2),
        ];
    }
    return $meses;
}

/**
 * Guarda, uma vez por mês, o que o sistema previu para o mês corrente (realizado até agora +
 * previsto para o restante). No mês seguinte a análise financeira compara com o realizado,
 * e o erro mostra o quanto confiar na previsão.
 */
function registrar_previsao_do_mes(array $plano): void
{
    $mes = substr($plano['hoje'], 0, 7);
    if (linha('SELECT 1 x FROM planejamento_previsoes WHERE mes = ?', [$mes])) {
        return;
    }
    $inicio = "$mes-01 00:00:00";
    $realizado = linha(
        'SELECT COALESCE(SUM(s.quantidade), 0) un FROM saidas_produtos s WHERE s.data_saida >= ?',
        [$inicio]
    );
    $comprado = linha('SELECT COALESCE(SUM(quantidade * custo_unitario), 0) valor FROM entradas_produtos WHERE data_entrada >= ?', [$inicio]);
    $consumoUn = (float) $realizado['un'];
    $consumoValor = 0.0;
    $compras = (float) $comprado['valor'];
    foreach ($plano['futuro']['consumo_un'] as $d => $qtd) {
        $data = date('Y-m-d', strtotime("{$plano['hoje']} +$d days"));
        if (substr($data, 0, 7) !== $mes) {
            break;
        }
        $consumoUn += $qtd;
        $consumoValor += $plano['futuro']['consumo_valor'][$d];
    }
    foreach ($plano['futuro']['compras'] as $data => $c) {
        if (substr($data, 0, 7) === $mes) {
            $compras += $c['valor'];
        }
    }
    executar(
        'INSERT IGNORE INTO planejamento_previsoes (mes, base_dias, consumo_un, consumo_valor, compras_valor) VALUES (?, ?, ?, ?, ?)',
        [$mes, (int) $plano['parametros']['base_dias'], round($consumoUn, 2), round($consumoValor, 2), round($compras, 2)]
    );
}

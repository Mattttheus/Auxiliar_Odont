<?php
// E-mail: servidor SMTP, envios periódicos (compras a fazer, aviso de estoque e análise
// financeira e preditiva), pedidos e cotações para fornecedores e o registro de cada envio.
//
// Não há tarefa agendada no Windows: cada tela, ao abrir, chama envios.verificar, e o envio
// vencido sai na primeira visita depois do horário. Quem pegar o envio adia o horário em uma
// hora antes de enviar, então duas telas abertas não mandam em dobro, e uma falha tenta de
// novo depois de uma hora.
declare(strict_types=1);

// Quantos dias cada frequência cobre: é o horizonte das compras e dos avisos do envio.
const DIAS_FREQUENCIA = ['diaria' => 1, 'semanal' => 7, 'quinzenal' => 14, 'mensal' => 30, 'bimestral' => 60, 'trimestral' => 90, 'semestral' => 180];
const MESES_FREQUENCIA = ['mensal' => 1, 'bimestral' => 2, 'trimestral' => 3, 'semestral' => 6];
const TIPOS_ENVIO = ['compras' => 'Compras a fazer', 'estoque' => 'Aviso de estoque', 'analise' => 'Análise financeira e preditiva'];

function config_smtp(): array
{
    return linha('SELECT * FROM relatorio_email WHERE id = 1') ?? [];
}

function smtp_configurado(array $cfg): bool
{
    return !empty($cfg['smtp_host']) && !empty($cfg['remetente_email']);
}

function nome_remetente(): string
{
    return config_smtp()['remetente_nome'] ?? 'Auxiliar Odont';
}

/** Certificados raiz para conferir o servidor: o do php.ini ou o que vem no phpMyAdmin do WAMP. */
function arquivo_certificados(): ?string
{
    $candidatos = array_merge(
        [ini_get('openssl.cafile') ?: null],
        glob(dirname(__DIR__, 4) . '/apps/phpmyadmin*/vendor/composer/ca-bundle/res/cacert.pem') ?: []
    );
    foreach ($candidatos as $arquivo) {
        if ($arquivo && is_file($arquivo)) {
            return $arquivo;
        }
    }
    return null;
}

function cabecalho_codificado(string $texto): string
{
    return '=?UTF-8?B?' . base64_encode(str_replace(["\r", "\n"], ' ', $texto)) . '?=';
}

function html_para_texto(string $html): string
{
    $texto = preg_replace(['/<(br|\/p|\/tr|\/h\d|\/li)[^>]*>/i', '/<\/t[dh]>/i'], ["\n", "\t"], $html);
    $texto = html_entity_decode(strip_tags($texto), ENT_QUOTES, 'UTF-8');
    return trim(preg_replace("/\n\s*\n\s*\n+/", "\n\n", $texto));
}

/** Lista de e-mails separados por vírgula, ponto e vírgula ou linha; todos precisam ser válidos. */
function lista_emails(string $texto): array
{
    $emails = array_values(array_unique(array_filter(array_map('trim', preg_split('/[,;\s]+/', $texto)))));
    foreach ($emails as $email) {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            falhar("E-mail inválido: $email");
        }
    }
    if (count($emails) > 20) {
        falhar('Informe no máximo 20 destinatários.');
    }
    return $emails;
}

/**
 * Cliente SMTP simples: TLS (STARTTLS, porta 587), SSL (porta 465) ou sem criptografia, com
 * AUTH LOGIN. Para o Gmail, o usuário é o endereço e a senha é uma "senha de app".
 */
function smtp_enviar(array $cfg, array $para, string $assunto, string $html): void
{
    if (!smtp_configurado($cfg)) {
        falhar('O servidor de e-mail ainda não foi salvo: preencha servidor, usuário, senha de app e e-mail do remetente em Financeiro → Envios automáticos e clique em Salvar.');
    }
    $host = $cfg['smtp_host'];
    $seguranca = $cfg['smtp_seguranca'];
    $contexto = [];
    if ($seguranca !== 'nenhuma') {
        $certificados = arquivo_certificados();
        if (!$certificados) {
            falhar('Não encontrei os certificados raiz para a conexão segura. Informe openssl.cafile no php.ini do WAMP.', 502);
        }
        $contexto = ['ssl' => ['peer_name' => $host, 'verify_peer' => true, 'verify_peer_name' => true, 'cafile' => $certificados]];
    }
    $endereco = ($seguranca === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . (int) $cfg['smtp_porta'];
    $conexao = @stream_socket_client($endereco, $erro, $mensagem, 15, STREAM_CLIENT_CONNECT, stream_context_create($contexto));
    if (!$conexao) {
        falhar("Não foi possível conectar ao servidor de e-mail $host ($mensagem).", 502);
    }
    stream_set_timeout($conexao, 20);

    $ler = function (array $esperados) use ($conexao): string {
        $resposta = '';
        while (($linha = fgets($conexao, 2048)) !== false) {
            $resposta .= $linha;
            if (strlen($linha) < 4 || $linha[3] === ' ') {
                break;
            }
        }
        if (!in_array((int) substr($resposta, 0, 3), $esperados, true)) {
            throw new ErroApi('O servidor de e-mail recusou: ' . (trim($resposta) ?: 'sem resposta'), 502);
        }
        return $resposta;
    };
    $comando = function (string $linha, array $esperados) use ($conexao, $ler): string {
        fwrite($conexao, $linha . "\r\n");
        return $ler($esperados);
    };

    try {
        $ler([220]);
        $comando('EHLO auxiliar-odont.local', [250]);
        if ($seguranca === 'tls') {
            $comando('STARTTLS', [220]);
            if (!@stream_socket_enable_crypto($conexao, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
                throw new ErroApi('Falha na conexão segura (TLS) com o servidor de e-mail.', 502);
            }
            $comando('EHLO auxiliar-odont.local', [250]);
        }
        if (!empty($cfg['smtp_usuario'])) {
            $comando('AUTH LOGIN', [334]);
            $comando(base64_encode($cfg['smtp_usuario']), [334]);
            $comando(base64_encode((string) $cfg['smtp_senha']), [235]);
        }
        $remetente = $cfg['remetente_email'];
        $comando("MAIL FROM:<$remetente>", [250]);
        foreach ($para as $email) {
            $comando("RCPT TO:<$email>", [250, 251]);
        }
        $comando('DATA', [354]);

        $limite = 'ao' . bin2hex(random_bytes(12));
        $dominio = substr(strrchr($remetente, '@'), 1) ?: 'auxiliar-odont.local';
        $mensagem = implode("\r\n", [
            'Date: ' . date('r'),
            'From: ' . cabecalho_codificado($cfg['remetente_nome'] ?: 'Auxiliar Odont') . " <$remetente>",
            'To: ' . implode(', ', $para),
            'Subject: ' . cabecalho_codificado($assunto),
            'Message-ID: <' . bin2hex(random_bytes(10)) . "@$dominio>",
            'MIME-Version: 1.0',
            "Content-Type: multipart/alternative; boundary=\"$limite\"",
            '',
            "--$limite",
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            rtrim(chunk_split(base64_encode(html_para_texto($html)))),
            "--$limite",
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            rtrim(chunk_split(base64_encode($html))),
            "--$limite--",
        ]);
        fwrite($conexao, $mensagem . "\r\n.\r\n");
        $ler([250]);
        try {
            $comando('QUIT', [221]);
        } catch (ErroApi $e) {
            // A mensagem já foi aceita; uma despedida malfeita não é falha de envio.
        }
    } finally {
        fclose($conexao);
    }
}

/** Envia e grava o resultado no registro de envios; em caso de erro, grava e repassa o erro. */
function enviar_registrando(array $para, string $assunto, string $html, string $origem, ?string $tipo, ?int $programacaoId): void
{
    $registrar = fn(bool $ok, ?string $erro) => executar(
        'INSERT INTO relatorio_envios (origem, tipo, programacao_id, assunto, destinatarios, ok, erro) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$origem, $tipo, $programacaoId, mb_substr($assunto, 0, 200), implode(', ', $para), $ok ? 1 : 0, $erro]
    );
    try {
        smtp_enviar(config_smtp(), $para, $assunto, $html);
    } catch (Throwable $e) {
        $erro = $e instanceof ErroApi ? $e->getMessage() : 'Erro interno ao enviar.';
        if (!$e instanceof ErroApi) {
            error_log('Auxiliar Odont (e-mail): ' . $e);
        }
        $registrar(false, $erro);
        throw new ErroApi($erro, 502);
    }
    $registrar(true, null);
}

// ---------- CONTEÚDO DOS E-MAILS ----------
function h(?string $texto): string
{
    return htmlspecialchars((string) $texto, ENT_QUOTES, 'UTF-8');
}

function reais(?float $valor): string
{
    return $valor === null ? '—' : 'R$ ' . number_format($valor, 2, ',', '.');
}

function numero_br(float $valor, int $casas = 0): string
{
    return number_format($valor, $casas, ',', '.');
}

function data_br(?string $data): string
{
    return $data ? date('d/m/Y', strtotime($data)) : '—';
}

function endereco_sistema(): string
{
    $host = $_SERVER['HTTP_HOST'] ?? '192.168.1.51';
    $pasta = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/Auxiliar_Odont/api/index.php')), '/\\');
    return "http://$host$pasta/";
}

function tabela_email(array $cabecalho, array $linhas, string $vazio = 'Nada a listar.'): string
{
    if (!$linhas) {
        return '<p style="color:#64748b;margin:6px 0 16px">' . h($vazio) . '</p>';
    }
    $th = implode('', array_map(fn($c) => '<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #cbd5e1;font-size:13px;color:#475569">' . h($c) . '</th>', $cabecalho));
    $tr = implode('', array_map(fn($l) => '<tr>' . implode('', array_map(fn($c) => '<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:13px">' . $c . '</td>', $l)) . '</tr>', $linhas));
    return "<table style=\"border-collapse:collapse;width:100%;margin:6px 0 18px\"><thead><tr>$th</tr></thead><tbody>$tr</tbody></table>";
}

function email_layout(string $titulo, string $subtitulo, string $corpo, ?string $pagina = null): string
{
    $link = $pagina ? '<p style="margin-top:20px"><a href="' . h(endereco_sistema() . $pagina) . '" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Abrir no sistema</a></p>' : '';
    return '<!DOCTYPE html><html><body style="margin:0;background:#f4f6f9;font-family:Segoe UI,Arial,sans-serif;color:#1e293b">'
        . '<div style="max-width:760px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:14px;padding:24px">'
        . '<div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">' . h(nome_remetente()) . '</div>'
        . '<h2 style="margin:4px 0 2px">' . h($titulo) . '</h2><div style="color:#64748b;margin-bottom:18px">' . h($subtitulo) . '</div>'
        . $corpo . $link
        . '</div><p style="font-size:11px;color:#94a3b8;text-align:center">Gerado automaticamente pelo Auxiliar Odont em ' . date('d/m/Y H:i') . '.</p></div></body></html>';
}

function resumo_email(array $itens): string
{
    $celulas = implode('', array_map(fn($i) => '<td style="padding:10px 12px;background:#f1f5f9;border-radius:10px"><div style="font-size:12px;color:#64748b">' . h($i[0]) . '</div><div style="font-size:20px;font-weight:600">' . h($i[1]) . '</div></td>', $itens));
    return "<table style=\"border-collapse:separate;border-spacing:8px;margin:0 -8px 12px\"><tr>$celulas</tr></table>";
}

/** Compras com pedido até o fim do horizonte, da mais urgente para a mais distante. */
function compras_no_horizonte(array $plano, int $dias): array
{
    $limite = date('Y-m-d', strtotime("{$plano['hoje']} +$dias days"));
    $compras = [];
    foreach ($plano['produtos'] as $p) {
        foreach ($p['compras_programadas'] as $c) {
            if ($c['pedir_ate'] <= $limite) {
                $compras[] = ['produto' => $p, 'compra' => $c];
            }
        }
    }
    usort($compras, fn($a, $b) => [$a['compra']['pedir_ate'], $a['produto']['nome']] <=> [$b['compra']['pedir_ate'], $b['produto']['nome']]);
    return $compras;
}

function email_compras(array $plano, string $frequencia, bool $valores, ?string $notaCotacao = null): array
{
    $dias = DIAS_FREQUENCIA[$frequencia];
    $compras = compras_no_horizonte($plano, $dias);
    $total = 0.0;
    $semCusto = 0;
    $linhas = array_map(function ($c) use ($valores, $plano, &$total, &$semCusto) {
        $p = $c['produto'];
        $atrasado = $c['compra']['pedir_ate'] <= $plano['hoje'];
        $custo = $p['custo_referencia'] ?? null;
        $custo === null ? $semCusto++ : $total += $custo * $c['compra']['compra'];
        $linha = [
            '<strong>' . h($p['nome']) . '</strong>' . ($p['codigo_barras'] ? '<br><span style="color:#64748b">' . h($p['codigo_barras']) . '</span>' : ''),
            numero_br($c['compra']['compra']) . ' ' . h($p['unidade'] ?? ''),
            ($atrasado ? '<strong style="color:#b91c1c">Hoje</strong>' : data_br($c['compra']['pedir_ate'])),
            'Classe ' . h($p['classe']),
        ];
        if ($valores) {
            $linha[] = $custo === null ? 'sem custo' : reais($custo * $c['compra']['compra']);
        }
        $linha[] = h($p['motivo'] ?: 'Reposição prevista');
        return $linha;
    }, $compras);
    $cabecalho = ['Produto', 'Comprar', 'Pedir até', 'Curva'];
    if ($valores) {
        $cabecalho[] = 'Valor previsto';
    }
    $cabecalho[] = 'Motivo';
    $resumo = [['Itens a comprar', (string) count($compras)], ['Pedir hoje', (string) count(array_filter($compras, fn($c) => $c['compra']['pedir_ate'] <= $plano['hoje']))]];
    if ($valores) {
        $resumo[] = ['Gasto previsto', reais($total) . ($semCusto ? " + $semCusto sem custo" : '')];
    }
    $corpo = resumo_email($resumo)
        . ($notaCotacao ? '<p style="background:#eff6ff;padding:10px 12px;border-radius:8px">' . h($notaCotacao) . '</p>' : '')
        . tabela_email($cabecalho, $linhas, 'Nenhuma compra prevista para o período.');
    $assunto = "Compras a fazer — próximos $dias dia(s) — " . date('d/m/Y');
    return [$assunto, email_layout('Compras a fazer', "Pedidos que precisam sair até " . data_br(date('Y-m-d', strtotime("+$dias days"))) . ', pela previsão de consumo', $corpo, 'planejamento.html#compras')];
}

function email_estoque(array $plano, string $frequencia): array
{
    $dias = max(7, DIAS_FREQUENCIA[$frequencia]);
    $produtos = $plano['produtos'];
    $nome = fn($p) => '<strong>' . h($p['nome']) . '</strong>';
    $sem = array_filter($produtos, fn($p) => $p['quantidade'] === 0);
    $abaixo = array_filter($produtos, fn($p) => $p['quantidade'] > 0 && $p['quantidade'] < $p['estoque_minimo']);
    $noMinimo = array_filter($produtos, fn($p) => $p['quantidade'] > 0 && $p['quantidade'] === $p['estoque_minimo']);
    $vencidos = array_filter($produtos, fn($p) => $p['vencido'] > 0);
    $limite = date('Y-m-d', strtotime("+$dias days"));
    $vencendo = array_filter($produtos, fn($p) => $p['validade_proxima'] !== null && $p['validade_proxima'] <= $limite);
    $ruptura = array_filter($produtos, fn($p) => $p['quantidade'] > 0 && $p['dia_ruptura'] !== null && $p['dia_ruptura'] <= $dias);
    $normais = count($produtos) - count($sem) - count($abaixo) - count($noMinimo);

    $corpo = resumo_email([
        ['Sem estoque', (string) count($sem)],
        ['Abaixo do mínimo', (string) count($abaixo)],
        ['No mínimo', (string) count($noMinimo)],
        ['Vencem em ' . $dias . ' dias', (string) count($vencendo)],
        ['Estoque saudável', $produtos ? round($normais / count($produtos) * 100) . '%' : '—'],
    ])
        . '<h3 style="margin:14px 0 4px">Sem estoque</h3>' . tabela_email(['Produto', 'Mínimo', 'Local'], array_map(fn($p) => [$nome($p), (string) $p['estoque_minimo'], h($p['localizacao'] ?? '')], $sem), 'Nenhum produto zerado.')
        . '<h3 style="margin:14px 0 4px">Abaixo do mínimo</h3>' . tabela_email(['Produto', 'Estoque', 'Mínimo'], array_map(fn($p) => [$nome($p), (string) $p['quantidade'], (string) $p['estoque_minimo']], $abaixo), 'Nenhum produto abaixo do mínimo.')
        . '<h3 style="margin:14px 0 4px">Acaba nos próximos ' . $dias . ' dias, pelo consumo previsto</h3>' . tabela_email(['Produto', 'Estoque', 'Acaba em'], array_map(fn($p) => [$nome($p), (string) $p['quantidade'], data_br($p['data_ruptura'])], $ruptura), 'Nenhuma falta prevista no período.')
        . '<h3 style="margin:14px 0 4px">Validade</h3>' . tabela_email(['Produto', 'Situação'], array_map(fn($p) => [$nome($p), $p['vencido'] > 0 ? "<strong style=\"color:#b91c1c\">{$p['vencido']} un. vencidas</strong>" : "{$p['qtd_validade_proxima']} un. vencem em " . data_br($p['validade_proxima'])], array_merge($vencidos, array_filter($vencendo, fn($p) => $p['vencido'] == 0))), 'Nenhum lote vencido ou vencendo no período.');
    return ['Aviso de estoque — ' . date('d/m/Y'), email_layout('Aviso de estoque', "Situação de hoje e o que acontece nos próximos $dias dias", $corpo, 'planejamento.html#saude')];
}

function email_analise(string $frequencia, bool $valores): array
{
    $granularidade = in_array($frequencia, ['diaria', 'semanal', 'quinzenal'], true) ? 'semanal' : $frequencia;
    $analise = analise_periodos($granularidade, BASE_PADRAO);
    $periodos = $analise['periodos'];
    $atual = array_values(array_filter($periodos, fn($p) => $p['tipo'] === 'atual'))[0];
    $indice = array_search($atual, $periodos, true);
    $colunas = array_values(array_filter([$periodos[$indice - 1] ?? null, $atual, $periodos[$indice + 1] ?? null]));
    $linha = fn(string $rotulo, callable $valor) => array_merge(['<strong>' . h($rotulo) . '</strong>'], array_map($valor, $colunas));
    $linhas = [
        $linha('Consumo (un.)', fn($p) => numero_br($p['consumo_un'] + $p['consumo_previsto_un'])),
        $linha('Entradas (un.)', fn($p) => $p['tipo'] === 'futuro' ? numero_br($p['compras_previstas_un']) . ' previstas' : numero_br($p['compras_un']) . ($p['tipo'] === 'atual' ? ' + ' . numero_br($p['compras_previstas_un']) . ' previstas' : '')),
    ];
    if ($valores) {
        $linhas[] = $linha('Consumo (R$)', fn($p) => reais($p['consumo_valor'] + $p['consumo_previsto_valor']));
        $linhas[] = $linha('Compras (R$)', fn($p) => reais($p['compras_valor'] + $p['compras_previstas_valor']));
        $linhas[] = $linha('Estoque no fim (R$)', fn($p) => $p['estoque_fim_valor'] === null ? 'previsão' : reais($p['estoque_fim_valor']));
    }
    $cabecalho = array_merge([''], array_map(fn($p) => $p['rotulo'] . ($p['tipo'] === 'atual' ? ' (atual)' : ($p['tipo'] === 'futuro' ? ' (previsto)' : '')), $colunas));
    $progresso = round($atual['progresso'] * 100);
    $corpo = resumo_email([
        ['Período atual', $atual['rotulo']],
        ['Decorrido', "$progresso%"],
        ['Base de aprendizado', $analise['aprendizado']['semanas'] . ' semanas'],
    ])
        . tabela_email($cabecalho, $linhas)
        . '<p style="color:#64748b;font-size:12px">O período atual soma o realizado até hoje e a previsão até o fim. ' . ($valores && $analise['itens_sem_custo'] ? "{$analise['itens_sem_custo']} produto(s) ainda sem custo ficam fora dos valores." : '') . '</p>';
    return ["Análise financeira e preditiva — {$atual['rotulo']}", email_layout('Análise financeira e preditiva', "Período anterior, atual e próximo ($granularidade)", $corpo, 'financeiro.html')];
}

function email_pedido_fornecedor(array $lista, array $fornecedor, array $itens): string
{
    $corpo = '<p>Olá' . ($fornecedor['contato'] ? ', ' . h($fornecedor['contato']) : '') . '.</p>'
        . '<p>Gostaríamos de fazer o pedido abaixo. Por favor, confirme a disponibilidade, o valor e o prazo de entrega respondendo este e-mail.</p>'
        . tabela_email(['Produto', 'Unidade', 'Quantidade'], array_map(fn($i) => [h($i['produto_nome']), h($i['unidade'] ?? ''), '<strong>' . numero_br((float) $i['quantidade']) . '</strong>'], $itens))
        . ($lista['observacao'] ? '<p>' . nl2br(h($lista['observacao'])) . '</p>' : '')
        . '<p>Obrigado,<br>' . h(nome_remetente()) . '</p>';
    return email_layout("Pedido de compra #{$lista['id']}", $fornecedor['nome'], $corpo);
}

function email_cotacao(array $cotacao, array $fornecedor, array $itens): string
{
    $corpo = '<p>Olá' . ($fornecedor['contato'] ? ', ' . h($fornecedor['contato']) : '') . '.</p>'
        . '<p>Pedimos a cotação dos itens abaixo. Responda este e-mail com o <strong>preço unitário</strong> de cada item, o <strong>prazo de entrega</strong> e a condição de pagamento'
        . ($cotacao['prazo_resposta'] ? ' até <strong>' . data_br($cotacao['prazo_resposta']) . '</strong>' : '') . '.</p>'
        . tabela_email(['Produto', 'Unidade', 'Quantidade', 'Preço unitário'], array_map(fn($i) => [h($i['produto_nome']), h($i['unidade'] ?? ''), '<strong>' . numero_br((float) $i['quantidade']) . '</strong>', '&nbsp;'], $itens))
        . ($cotacao['observacao'] ? '<p>' . nl2br(h($cotacao['observacao'])) . '</p>' : '')
        . '<p>Obrigado,<br>' . h(nome_remetente()) . '</p>';
    return email_layout("Solicitação de cotação #{$cotacao['id']}", $fornecedor['nome'], $corpo);
}

/**
 * Monta o e-mail de uma programação. Compras com cotação automática abre uma solicitação de
 * cotação com os mesmos itens e a envia aos fornecedores ativos com e-mail.
 */
function montar_envio(array $prog, bool $executar): array
{
    $valores = (bool) $prog['incluir_valores'];
    if ($prog['tipo'] === 'analise') {
        return email_analise($prog['frequencia'], $valores);
    }
    $plano = calcular_planejamento(BASE_PADRAO, 0, true);
    if ($prog['tipo'] === 'estoque') {
        return email_estoque($plano, $prog['frequencia']);
    }
    $nota = null;
    if (!empty($prog['cotar_fornecedores'])) {
        $compras = compras_no_horizonte($plano, DIAS_FREQUENCIA[$prog['frequencia']]);
        $itens = [];
        foreach ($compras as $c) {
            $id = $c['produto']['produto_id'];
            $itens[$id] = ['produto_id' => $id, 'quantidade' => ($itens[$id]['quantidade'] ?? 0) + $c['compra']['compra']];
        }
        if (!$itens) {
            $nota = 'Sem itens para cotar neste período.';
        } elseif (!$executar) {
            $nota = 'No envio, uma solicitação de cotação com estes itens vai para os fornecedores ativos com e-mail.';
        } else {
            $resultado = criar_cotacao('Cotação automática ' . date('d/m/Y'), null, date('Y-m-d', strtotime('+3 days')), array_values($itens), null, 'automatico');
            $nota = "Solicitação de cotação #{$resultado['id']} enviada para {$resultado['enviados']} fornecedor(es)"
                . ($resultado['falhas'] ? ", com {$resultado['falhas']} falha(s)" : '') . '. Registre os preços respondidos em Cotações.';
        }
    }
    return email_compras($plano, $prog['frequencia'], $valores, $nota);
}

// ---------- AGENDA ----------
/** Próximo horário de envio depois de $agora. */
function calcular_proximo_envio(array $prog, int $agora): string
{
    $hora = (int) $prog['hora'];
    $inicioDoDia = fn(int $t) => strtotime(date('Y-m-d', $t) . sprintf(' %02d:00:00', $hora));
    $frequencia = $prog['frequencia'];
    if ($frequencia === 'diaria') {
        $t = $inicioDoDia($agora);
        return date('Y-m-d H:i:s', $t > $agora ? $t : strtotime('+1 day', $t));
    }
    if ($frequencia === 'semanal' || $frequencia === 'quinzenal') {
        $diferenca = (int) $prog['dia_semana'] - (int) date('N', $agora);
        $t = strtotime("$diferenca days", $inicioDoDia($agora));
        while ($t <= $agora) {
            $t = strtotime('+7 days', $t);
        }
        if ($frequencia === 'quinzenal' && !empty($prog['ultimo_envio']) && $t < strtotime($prog['ultimo_envio']) + 13 * 86400) {
            $t = strtotime('+7 days', $t);
        }
        return date('Y-m-d H:i:s', $t);
    }
    $passo = MESES_FREQUENCIA[$frequencia];
    $mes = (int) date('n', $agora);
    $mes -= ($mes - 1) % $passo;
    for ($i = 0; ; $i++) {
        $t = mktime($hora, 0, 0, $mes + $i * $passo, min(28, (int) $prog['dia_mes']), (int) date('Y', $agora));
        if ($t > $agora) {
            return date('Y-m-d H:i:s', $t);
        }
    }
}

function campos_programacao(array $dados): array
{
    $tipo = $dados['tipo'] ?? '';
    $frequencia = $dados['frequencia'] ?? '';
    if (!isset(TIPOS_ENVIO[$tipo])) {
        falhar('Tipo de envio inválido.');
    }
    if (!isset(DIAS_FREQUENCIA[$frequencia])) {
        falhar('Frequência inválida.');
    }
    $campos = [
        'tipo' => $tipo,
        'frequencia' => $frequencia,
        'dia_semana' => inteiro($dados, 'dia_semana'),
        'dia_mes' => inteiro($dados, 'dia_mes'),
        'hora' => inteiro($dados, 'hora'),
        'destinatarios' => implode(', ', lista_emails(texto($dados, 'destinatarios'))),
        'incluir_valores' => !empty($dados['incluir_valores']) ? 1 : 0,
        'cotar_fornecedores' => $tipo === 'compras' && !empty($dados['cotar_fornecedores']) ? 1 : 0,
        'ativo' => !empty($dados['ativo']) ? 1 : 0,
    ];
    if ($campos['destinatarios'] === '') {
        falhar('Informe ao menos um destinatário.');
    }
    if ($campos['dia_semana'] < 1 || $campos['dia_semana'] > 7 || $campos['dia_mes'] < 1 || $campos['dia_mes'] > 28 || $campos['hora'] < 0 || $campos['hora'] > 23) {
        falhar('Dia ou hora do envio inválidos.');
    }
    return $campos;
}

// ---------- AÇÕES ----------
function acao_envios_config(array $dados): array
{
    $smtp = config_smtp();
    $smtp['tem_senha'] = !empty($smtp['smtp_senha']);
    unset($smtp['smtp_senha']);
    $smtp['certificados'] = arquivo_certificados() !== null;
    return [
        'smtp' => $smtp,
        'programacoes' => array_map(fn($p) => datas_iso($p, ['proximo_envio', 'ultimo_envio', 'criado_em', 'atualizado_em']), linhas('SELECT * FROM envios_programados ORDER BY tipo, id')),
        'envios' => array_map(fn($e) => datas_iso($e, ['enviado_em']), linhas('SELECT * FROM relatorio_envios ORDER BY enviado_em DESC, id DESC LIMIT 30')),
    ];
}

function acao_envios_smtp_salvar(array $dados): array
{
    $seguranca = $dados['smtp_seguranca'] ?? 'tls';
    if (!in_array($seguranca, ['tls', 'ssl', 'nenhuma'], true)) {
        falhar('Tipo de segurança inválido.');
    }
    $porta = inteiro($dados, 'smtp_porta');
    if ($porta < 1 || $porta > 65535) {
        falhar('Porta inválida.');
    }
    $host = texto($dados, 'smtp_host', 150);
    if ($host !== '' && !preg_match('/^[A-Za-z0-9.-]+$/', $host)) {
        falhar('Servidor inválido: use só o nome, como smtp.gmail.com.');
    }
    $campos = [
        'smtp_host' => $host ?: null,
        'smtp_porta' => $porta,
        'smtp_seguranca' => $seguranca,
        'smtp_usuario' => texto_ou_nulo($dados, 'smtp_usuario', 150),
        'remetente_email' => email_valido_ou_falha(texto_ou_nulo($dados, 'remetente_email', 150), 'e-mail do remetente'),
        'remetente_nome' => str_replace(["\r", "\n"], ' ', texto($dados, 'remetente_nome', 100)) ?: 'Auxiliar Odont',
    ];
    // Senha em branco mantém a atual; "apagar_senha" remove.
    $senha = (string) ($dados['smtp_senha'] ?? '');
    if ($senha !== '') {
        $campos['smtp_senha'] = $senha;
    } elseif (!empty($dados['apagar_senha'])) {
        $campos['smtp_senha'] = null;
    }
    executar('UPDATE relatorio_email SET ' . implode(', ', array_map(fn($c) => "$c = ?", array_keys($campos))) . ' WHERE id = 1', array_values($campos));
    return [];
}

function acao_envios_testar(array $dados): array
{
    $para = lista_emails(texto($dados, 'email'));
    if (!$para) {
        falhar('Informe o e-mail que vai receber o teste.');
    }
    $html = email_layout('E-mail de teste', 'O servidor de e-mail está configurado', '<p>Se você recebeu esta mensagem, os envios automáticos do Auxiliar Odont já podem ser ativados.</p>');
    enviar_registrando($para, 'Teste de e-mail — Auxiliar Odont', $html, 'manual', 'teste', null);
    return [];
}

function acao_envios_programacao_salvar(array $dados): array
{
    $campos = campos_programacao($dados);
    $id = ($dados['id'] ?? '') === '' || $dados['id'] === null ? null : inteiro($dados, 'id');
    $anterior = $id ? linha('SELECT * FROM envios_programados WHERE id = ?', [$id]) : null;
    if ($id && !$anterior) {
        falhar('Envio programado não encontrado.', 404);
    }
    $campos['proximo_envio'] = $campos['ativo'] ? calcular_proximo_envio($campos + ['ultimo_envio' => $anterior['ultimo_envio'] ?? null], time()) : null;
    if ($id) {
        executar('UPDATE envios_programados SET ' . implode(', ', array_map(fn($c) => "$c = ?", array_keys($campos))) . ', ultimo_erro = NULL WHERE id = ?', [...array_values($campos), $id]);
    } else {
        executar('INSERT INTO envios_programados (' . implode(', ', array_keys($campos)) . ') VALUES (' . implode(', ', array_fill(0, count($campos), '?')) . ')', array_values($campos));
        $id = db()->insert_id;
    }
    return ['id' => $id, 'proximo_envio' => str_replace(' ', 'T', (string) $campos['proximo_envio'])];
}

function acao_envios_programacao_excluir(array $dados): array
{
    executar('DELETE FROM envios_programados WHERE id = ?', [inteiro($dados, 'id')]);
    return [];
}

/** Prévia do e-mail, sem enviar e sem abrir cotação. */
function acao_envios_previa(array $dados): array
{
    $prog = ['tipo' => $dados['tipo'] ?? '', 'frequencia' => $dados['frequencia'] ?? '', 'incluir_valores' => !empty($dados['incluir_valores']), 'cotar_fornecedores' => !empty($dados['cotar_fornecedores'])];
    if (!isset(TIPOS_ENVIO[$prog['tipo']]) || !isset(DIAS_FREQUENCIA[$prog['frequencia']])) {
        falhar('Escolha o tipo e a frequência.');
    }
    [$assunto, $html] = montar_envio($prog, false);
    return ['assunto' => $assunto, 'html' => $html];
}

function enviar_programacao(array $prog, string $origem): void
{
    [$assunto, $html] = montar_envio($prog, true);
    enviar_registrando(lista_emails($prog['destinatarios']), $assunto, $html, $origem, $prog['tipo'], (int) $prog['id']);
}

function acao_envios_enviar_agora(array $dados): array
{
    session_write_close();
    $prog = linha('SELECT * FROM envios_programados WHERE id = ?', [inteiro($dados, 'id')]);
    if (!$prog) {
        falhar('Envio programado não encontrado.', 404);
    }
    enviar_programacao($prog, 'manual');
    return [];
}

/** Chamada pelas telas: envia o que venceu. A resposta não traz nada do conteúdo. */
function acao_envios_verificar(array $dados): array
{
    session_write_close();
    if (!smtp_configurado(config_smtp())) {
        return ['enviados' => 0];
    }
    $enviados = 0;
    foreach (linhas('SELECT id FROM envios_programados WHERE ativo = 1 AND proximo_envio <= NOW() ORDER BY proximo_envio LIMIT 3') as $v) {
        $reservado = executar('UPDATE envios_programados SET proximo_envio = NOW() + INTERVAL 1 HOUR WHERE id = ? AND ativo = 1 AND proximo_envio <= NOW()', [(int) $v['id']])->affected_rows;
        if ($reservado !== 1) {
            continue;
        }
        $prog = linha('SELECT * FROM envios_programados WHERE id = ?', [(int) $v['id']]);
        try {
            enviar_programacao($prog, 'automatico');
            $prog['ultimo_envio'] = date('Y-m-d H:i:s');
            executar('UPDATE envios_programados SET ultimo_envio = NOW(), ultimo_erro = NULL, proximo_envio = ? WHERE id = ?', [calcular_proximo_envio($prog, time()), (int) $prog['id']]);
            $enviados++;
        } catch (Throwable $e) {
            executar('UPDATE envios_programados SET ultimo_erro = ? WHERE id = ?', [$e instanceof ErroApi ? $e->getMessage() : 'Erro interno ao enviar.', (int) $prog['id']]);
        }
    }
    return ['enviados' => $enviados];
}

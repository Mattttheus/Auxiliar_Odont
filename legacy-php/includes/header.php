<?php 
if (session_status() === PHP_SESSION_NONE) session_start(); 
?>
<!doctype html>
<html lang="pt-br">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Auxiliar Odont - Controle de Estoque</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="/Auxiliar_Odont/assets/css/custom.css" rel="stylesheet">
</head>

<body class="theme-light">
    <?php if (isset($_SESSION['usuario'])): ?>
    <button class="menu-toggle btn btn-primary" id="menuToggle" title="Abrir menu"><i class="bi bi-list"></i></button>

    <div class="sidebar" id="sidebarMenu">
        <h4><i class="bi bi-box-seam"></i> Auxiliar Odont</h4>
        <a href="/Auxiliar_Odont/pages/dashboard.php"><i class="bi bi-house-door"></i> Dashboard</a>
        <a href="/Auxiliar_Odont/pages/produtos.php"><i class="bi bi-box"></i> Produtos</a>
        <a href="/Auxiliar_Odont/pages/usuarios/gerenciar_usuarios.php"><i class="bi bi-people"></i> Usuários</a>
        <a href="/Auxiliar_Odont/pages/historico/historico_saidas.php"><i class="bi bi-clock-history"></i> Histórico</a>
        <a href="/Auxiliar_Odont/pages/produtos/entrada_produto.php"><i class="bi bi-box-arrow-in-down"></i> Entrada</a>
        <a href="/Auxiliar_Odont/pages/produtos/saida_produto.php"><i class="bi bi-box-arrow-up"></i> Saída</a>

        <hr />
        <div class="px-3 d-flex flex-column gap-2">
            <div class="d-flex justify-content-between align-items-center">
                <div class="voice-btn">
                    <button id="voiceControlBtn" class="btn btn-outline-primary btn-sm" type="button"
                        title="Ativar comando de voz">
                        <i id="voiceIcon" class="bi bi-mic-fill"></i> <span id="voiceLabel">Ouvir</span>
                    </button>
                </div>
                <div class="top-actions">
                    <button id="themeToggle" class="btn btn-outline-secondary btn-sm" title="Alternar tema"><i
                            id="themeIcon" class="bi bi-moon-fill"></i></button>
                </div>
            </div>
        </div>
        <hr />
        <a href="/Auxiliar_Odont/logout.php"><i class="bi bi-box-arrow-right"></i> Sair</a>
    </div>

    <script>
    document.getElementById("menuToggle").addEventListener("click", function() {
        document.getElementById("sidebarMenu").classList.toggle("show");
    });

    // Voice control (Web Speech API) - prototype
    const voiceBtn = document.getElementById("voiceControlBtn");
    const voiceLabel = document.getElementById("voiceLabel");
    const voiceIcon = document.getElementById("voiceIcon");
    let recognition = null;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SR();
        recognition.lang = 'pt-BR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            voiceLabel.textContent = 'Ouvindo...';
            voiceIcon.className = 'bi bi-mic';
            voiceBtn.classList.add('btn-danger');
        };
        recognition.onend = () => {
            voiceLabel.textContent = 'Ouvir';
            voiceIcon.className = 'bi bi-mic-fill';
            voiceBtn.classList.remove('btn-danger');
        };
        recognition.onerror = (e) => {
            console.log('Voice error', e);
        };

        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript.toLowerCase().trim();
            handleVoiceCommand(text);
        };
    } else {
        voiceBtn.disabled = true;
        voiceLabel.textContent = 'Sem voz';
    }

    voiceBtn.addEventListener('click', () => {
        if (!recognition) return alert('Web Speech API não disponível (use Chrome/Edge).');
        try {
            recognition.start();
        } catch (e) {
            console.log(e);
        }
    });

    function handleVoiceCommand(text) {
        if (text.includes('dashboard') || text.includes('painel')) {
            window.location.href = '/Auxiliar_Odont/pages/dashboard.php';
            return;
        }
        if (text.includes('produto') || text.includes('produtos')) {
            if (text.includes('vencid') || text.includes('vencidos') || text.includes('vencimento')) {
                window.location.href = '/Auxiliar_Odont/pages/produtos/listar_produtos.php?filter=vencidos';
            } else if (text.includes('próximo') || text.includes('proximo') || text.includes('perto')) {
                window.location.href = '../Auxiliar_Odont/pages/produtos/listar_produtos.php?filter=prestes';
            } else {
                window.location.href = '../Auxiliar_Odont/pages/produtos/listar_produtos.php';
            }
            return;
        }
        if (text.includes('usuário') || text.includes('usuario') || text.includes('usuários')) {
            window.location.href = '../Auxiliar_Odont/pages/usuarios/gerenciar_usuarios.php';
            return;
        }

        if (text.includes('sair') || text.includes('fechar')) {
            window.location.href = '../Auxiliar_Odont/logout.php';
            return;
        }

        alert('Comando não reconhecido: ' + text);
    }
    </script>
    <?php endif; ?>

    <div class="main-content">
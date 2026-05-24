    </div>
    <footer>
      <small>© <?= date("Y") ?> - Auxiliar Odont | Sistema de Controle de Estoque</small>
    </footer>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("themeIcon");
    function applyTheme(t){
      document.body.classList.remove("theme-light","theme-dark");
      document.body.classList.add(t);
      localStorage.setItem("siteTheme", t);
      if (themeIcon) themeIcon.className = t === "theme-dark" ? "bi bi-sun-fill" : "bi bi-moon-fill";
    }
    const saved = localStorage.getItem("siteTheme") || "theme-light";
    applyTheme(saved);
    if (themeToggle) themeToggle.addEventListener("click", ()=> applyTheme(document.body.classList.contains("theme-dark") ? "theme-light" : "theme-dark"));

    window.playBeep = function(type) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        if (type === "red") { o.frequency.value = 520; }
        else if (type === "yellow") { o.frequency.value = 360; }
        else { o.frequency.value = 440; }
        g.gain.value = 0.001;
        o.connect(g); g.connect(ctx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.65);
        setTimeout(()=>{ o.stop(); ctx.close(); }, 750);
      } catch(e){ console.warn("playBeep falhou", e); }
    };
    </script>
  </body>
</html>

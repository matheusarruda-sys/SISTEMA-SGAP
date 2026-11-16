// =====================================================
// CONFIGURAÇÃO DO SUPABASE E SESSÃO (config.js)
// =====================================================
const URL_SUPABASE = "https://nrqkpgrxmijmkoblksfi.supabase.co";
const CHAVE_ANON_SUPABASE = "sb_publishable_HyGCbAzBzn9RlzegCqMVeA_YcelsdS3";
const clienteSupabase = window.supabase.createClient(URL_SUPABASE, CHAVE_ANON_SUPABASE);

const PAGINAS_ADMINISTRACAO = ["controle.html", "classificacao.html", "log.html"];
window.ACESSO_NEGADO = false;

function obterUsuarioLogado() {
    const dadosSalvos = sessionStorage.getItem("sgap_usuario");
    return dadosSalvos ? JSON.parse(dadosSalvos) : null;
}

function ehAdministrador(usuario = obterUsuarioLogado()) {
    if (!usuario) return false;
    return String(usuario.nivel_acesso ?? "").trim() === "1";
}

function obterNomePaginaAtual() {
    const caminho = window.location.pathname || "";
    const arquivo = caminho.split("/").pop() || "";
    return arquivo.split("?")[0].split("#")[0].toLowerCase();
}

function ehPaginaAdministracao() {
    return PAGINAS_ADMINISTRACAO.includes(obterNomePaginaAtual());
}

function obterTimestampLocalISO() {
    const agora = new Date();
    const offsetMs = agora.getTimezoneOffset() * 60000;
    return new Date(agora.getTime() - offsetMs).toISOString().slice(0, 19);
}

// =====================================================
// CONTROLE GLOBAL DO MENU MOBILE (SIDEBAR)
// =====================================================
function configurarMenuMobileGlobal() {
    if (window.__sgapMenuMobileConfigurado) return;
    window.__sgapMenuMobileConfigurado = true;

    if (!document.getElementById("sgapMobileMenuFixStyles")) {
        const estilo = document.createElement("style");
        estilo.id = "sgapMobileMenuFixStyles";
        estilo.textContent = `
            @media (max-width: 767.98px) {
                .sidebar {
                    transform: translateX(-100%) !important;
                }
                .sidebar.open,
                .sidebar.active {
                    transform: translateX(0) !important;
                }
                .mobile-backdrop.active,
                .mobile-backdrop.open {
                    display: block !important;
                }
            }
            .close-mobile-btn,
            .open-mobile-btn {
                cursor: pointer;
                pointer-events: auto !important;
                position: relative;
                z-index: 60;
            }
            .close-mobile-btn *,
            .open-mobile-btn * {
                pointer-events: none !important;
            }
        `;
        (document.head || document.documentElement).appendChild(estilo);
    }

    const abrirMenu = () => {
        const sidebar = document.querySelector(".sidebar");
        const backdrop = document.querySelector(".mobile-backdrop");
        sidebar?.classList.add("open");
        backdrop?.classList.add("active");
    };

    const fecharMenu = () => {
        const sidebar = document.querySelector(".sidebar");
        const backdrop = document.querySelector(".mobile-backdrop");
        sidebar?.classList.remove("open", "active");
        backdrop?.classList.remove("active", "open");
    };

    window.abrirMenuMobile = abrirMenu;
    window.fecharMenuMobile = fecharMenu;

    document.addEventListener(
        "click",
        (evento) => {
            const alvo = evento.target instanceof Element ? evento.target : evento.target?.parentElement;
            if (!alvo) return;

            if (alvo.closest(".close-mobile-btn")) {
                evento.preventDefault();
                evento.stopImmediatePropagation();
                fecharMenu();
                return;
            }

            if (alvo.closest(".open-mobile-btn")) {
                evento.preventDefault();
                evento.stopImmediatePropagation();
                abrirMenu();
                return;
            }

            if (alvo.closest(".mobile-backdrop")) {
                evento.stopImmediatePropagation();
                fecharMenu();
            }
        },
        true
    );

    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            fecharMenu();
        }
    });
}

configurarMenuMobileGlobal();

// =====================================================
// MODAIS GRÁFICOS GLOBAIS (CONFIRMAÇÃO E ALERTA/ERRO)
// =====================================================
function injetarEstilosModalConfirmacao() {
    if (document.getElementById("sgapConfirmStyles")) return;

    const estilo = document.createElement("style");
    estilo.id = "sgapConfirmStyles";
    estilo.textContent = `
        .sgap-confirm-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.58);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            z-index: 99999;
            visibility: visible !important;
            opacity: 0;
            transition: opacity 0.18s ease;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .sgap-confirm-overlay.sgap-visible {
            opacity: 1;
        }
        .sgap-confirm-overlay.sgap-closing {
            opacity: 0;
        }
        .sgap-confirm-card {
            background: #ffffff;
            width: 100%;
            max-width: 420px;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.22), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
            border: 1px solid #e2e8f0;
            transform: scale(0.94) translateY(8px);
            transition: transform 0.18s ease;
        }
        .sgap-confirm-overlay.sgap-visible .sgap-confirm-card {
            transform: scale(1) translateY(0);
        }
        .sgap-confirm-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 16px;
        }
        .sgap-confirm-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .sgap-icon-danger {
            background: #fef2f2;
            color: #dc2626;
            border: 1px solid #fee2e2;
        }
        .sgap-icon-warning {
            background: #fffbeb;
            color: #d97706;
            border: 1px solid #fef3c7;
        }
        .sgap-icon-primary {
            background: #eff6ff;
            color: #2563eb;
            border: 1px solid #dbeafe;
        }
        .sgap-confirm-close {
            background: transparent;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            padding: 6px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s ease, color 0.15s ease;
        }
        .sgap-confirm-close:hover {
            background: #f1f5f9;
            color: #334155;
        }
        .sgap-confirm-title {
            margin: 0 0 8px 0;
            font-size: 1.125rem;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.35;
        }
        .sgap-confirm-message {
            margin: 0;
            font-size: 0.925rem;
            color: #475569;
            line-height: 1.55;
        }
        .sgap-confirm-detail {
            margin-top: 12px;
            padding: 10px 12px;
            background: #f8fafc;
            border-left: 3px solid #94a3b8;
            border-radius: 6px;
            font-size: 0.85rem;
            color: #334155;
            line-height: 1.45;
        }
        .sgap-confirm-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 24px;
        }
        .sgap-btn-cancel,
        .sgap-btn-confirm {
            padding: 10px 16px;
            border-radius: 10px;
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            border: 1px solid transparent;
        }
        .sgap-btn-cancel {
            background: #ffffff;
            color: #334155;
            border-color: #cbd5e1;
        }
        .sgap-btn-cancel:hover {
            background: #f8fafc;
            border-color: #94a3b8;
        }
        .sgap-btn-danger {
            background: #dc2626;
            color: #ffffff;
        }
        .sgap-btn-danger:hover {
            background: #b91c1c;
        }
        .sgap-btn-warning {
            background: #d97706;
            color: #ffffff;
        }
        .sgap-btn-warning:hover {
            background: #b45309;
        }
        .sgap-btn-primary {
            background: #2563eb;
            color: #ffffff;
        }
        .sgap-btn-primary:hover {
            background: #1d4ed8;
        }
        .sgap-btn-cancel:focus-visible,
        .sgap-btn-confirm:focus-visible {
            outline: 2px solid #2563eb;
            outline-offset: 2px;
        }
    `;
    (document.head || document.documentElement).appendChild(estilo);
}

function aguardarBodyDisponivel() {
    if (document.body) return Promise.resolve();
    return new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });
}

function confirmarAcao({
    titulo = "Confirmar ação",
    mensagem = "Deseja realmente prosseguir com esta operação?",
    detalhe = "",
    textoConfirmar = "Confirmar",
    textoCancelar = "Cancelar",
    tipo = "danger"
} = {}) {
    return new Promise(async (resolve) => {
        await aguardarBodyDisponivel();
        injetarEstilosModalConfirmacao();

        const overlayExistente = document.getElementById("sgapConfirmOverlay");
        if (overlayExistente) overlayExistente.remove();

        const iconesSVG = {
            danger: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
            warning: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            primary: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`
        };

        const tipoValido = ["danger", "warning", "primary"].includes(tipo) ? tipo : "danger";

        const overlay = document.createElement("div");
        overlay.id = "sgapConfirmOverlay";
        overlay.className = "sgap-confirm-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "sgapConfirmTitle");

        overlay.innerHTML = `
            <div class="sgap-confirm-card">
                <div class="sgap-confirm-header">
                    <div class="sgap-confirm-icon sgap-icon-${tipoValido}">
                        ${iconesSVG[tipoValido]}
                    </div>
                    <button type="button" class="sgap-confirm-close" aria-label="Fechar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="sgap-confirm-body">
                    <h3 id="sgapConfirmTitle" class="sgap-confirm-title"></h3>
                    <p class="sgap-confirm-message"></p>
                    ${detalhe ? `<div class="sgap-confirm-detail"></div>` : ""}
                </div>
                <div class="sgap-confirm-footer">
                    <button type="button" class="sgap-btn-cancel"></button>
                    <button type="button" class="sgap-btn-confirm sgap-btn-${tipoValido}"></button>
                </div>
            </div>
        `;

        overlay.querySelector(".sgap-confirm-title").textContent = titulo;
        overlay.querySelector(".sgap-confirm-message").textContent = mensagem;
        if (detalhe) {
            overlay.querySelector(".sgap-confirm-detail").textContent = detalhe;
        }

        const btnCancelar = overlay.querySelector(".sgap-btn-cancel");
        const btnConfirmar = overlay.querySelector(".sgap-btn-confirm");
        const btnFechar = overlay.querySelector(".sgap-confirm-close");

        btnCancelar.textContent = textoCancelar;
        btnConfirmar.textContent = textoConfirmar;

        let finalizado = false;
        const fechar = (resultado) => {
            if (finalizado) return;
            finalizado = true;
            document.removeEventListener("keydown", aoPressionarTecla, true);
            overlay.classList.add("sgap-closing");
            setTimeout(() => {
                overlay.remove();
                resolve(resultado);
            }, 150);
        };

        const aoPressionarTecla = (evento) => {
            if (evento.key === "Escape") {
                evento.stopImmediatePropagation();
                fechar(false);
            }
        };

        btnCancelar.addEventListener("click", () => fechar(false));
        btnFechar.addEventListener("click", () => fechar(false));
        btnConfirmar.addEventListener("click", () => fechar(true));
        overlay.addEventListener("click", (evento) => {
            if (evento.target === overlay) fechar(false);
        });
        document.addEventListener("keydown", aoPressionarTecla, true);

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("sgap-visible"));
        btnCancelar.focus();
    });
}

function exibirAlerta({
    titulo = "Atenção",
    mensagem = "",
    detalhe = "",
    textoBotao = "Entendi",
    tipo = "danger"
} = {}) {
    return new Promise(async (resolve) => {
        await aguardarBodyDisponivel();
        injetarEstilosModalConfirmacao();

        const overlayExistente = document.getElementById("sgapConfirmOverlay");
        if (overlayExistente) overlayExistente.remove();

        const iconesSVG = {
            danger: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            warning: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            primary: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
        };

        const tipoValido = ["danger", "warning", "primary"].includes(tipo) ? tipo : "danger";

        const overlay = document.createElement("div");
        overlay.id = "sgapConfirmOverlay";
        overlay.className = "sgap-confirm-overlay";
        overlay.setAttribute("role", "alertdialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "sgapAlertTitle");

        overlay.innerHTML = `
            <div class="sgap-confirm-card">
                <div class="sgap-confirm-header">
                    <div class="sgap-confirm-icon sgap-icon-${tipoValido}">
                        ${iconesSVG[tipoValido]}
                    </div>
                    <button type="button" class="sgap-confirm-close" aria-label="Fechar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="sgap-confirm-body">
                    <h3 id="sgapAlertTitle" class="sgap-confirm-title"></h3>
                    <p class="sgap-confirm-message"></p>
                    ${detalhe ? `<div class="sgap-confirm-detail"></div>` : ""}
                </div>
                <div class="sgap-confirm-footer">
                    <button type="button" class="sgap-btn-confirm sgap-btn-${tipoValido}"></button>
                </div>
            </div>
        `;

        overlay.querySelector(".sgap-confirm-title").textContent = titulo;
        overlay.querySelector(".sgap-confirm-message").textContent = mensagem;
        if (detalhe) {
            overlay.querySelector(".sgap-confirm-detail").textContent = detalhe;
        }

        const btnOk = overlay.querySelector(".sgap-btn-confirm");
        const btnFechar = overlay.querySelector(".sgap-confirm-close");
        btnOk.textContent = textoBotao;

        let finalizado = false;
        const fechar = () => {
            if (finalizado) return;
            finalizado = true;
            document.removeEventListener("keydown", aoPressionarTecla, true);
            overlay.classList.add("sgap-closing");
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 150);
        };

        const aoPressionarTecla = (evento) => {
            if (evento.key === "Escape" || evento.key === "Enter") {
                evento.preventDefault();
                evento.stopImmediatePropagation();
                fechar();
            }
        };

        btnOk.addEventListener("click", fechar);
        btnFechar.addEventListener("click", fechar);
        overlay.addEventListener("click", (evento) => {
            if (evento.target === overlay) fechar();
        });
        document.addEventListener("keydown", aoPressionarTecla, true);

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("sgap-visible"));
        btnOk.focus();
    });
}

window.confirmarAcao = confirmarAcao;
window.exibirAlerta = exibirAlerta;

// =====================================================
// SISTEMA GLOBAL DE AUDITORIA (LogAtividade)
// =====================================================
async function registrarLog(modulo, descricao, idUsuarioExplicito = null) {
    try {
        const usuarioSessao = obterUsuarioLogado();
        const idUsuario = Number(idUsuarioExplicito ?? usuarioSessao?.id_usuario);

        if (!idUsuario || Number.isNaN(idUsuario)) {
            console.warn("Log ignorado: ID_usuario não identificado.", { modulo, descricao });
            return false;
        }

        const moduloFormatado = String(modulo || "SISTEMA")
            .trim()
            .toUpperCase()
            .slice(0, 100);

        const descricaoFormatada = String(descricao || "")
            .trim()
            .slice(0, 255);

        if (!descricaoFormatada) return false;

        const { error: erro } = await clienteSupabase
            .from("logatividade")
            .insert([
                {
                    data_atividade: obterTimestampLocalISO(),
                    modulo_atividade: moduloFormatado,
                    descricao: descricaoFormatada,
                    id_usuario: idUsuario
                }
            ]);

        if (erro) {
            console.error("Erro ao gravar log de atividade:", erro);
            return false;
        }

        return true;
    } catch (erroInesperado) {
        console.error("Falha inesperada ao registrar log:", erroInesperado);
        return false;
    }
}

window.registrarLog = registrarLog;
window.ehAdministrador = ehAdministrador;

// =====================================================
// BLOQUEIO DE ACESSO À ÁREA ADMINISTRATIVA (NÍVEL 1)
// =====================================================
async function bloquearAcessoNaoAutorizado(paginaAtual) {
    window.ACESSO_NEGADO = true;
    document.documentElement.style.visibility = "hidden";

    await registrarLog(
        "SEGURANÇA",
        `Tentativa de acesso não autorizado à página administrativa (${paginaAtual}).`
    );

    await exibirAlerta({
        titulo: "Acesso Negado",
        mensagem: "Esta área é restrita a administradores (Nível 1).",
        detalhe: "A tentativa de acesso foi registrada no histórico de auditoria do sistema.",
        textoBotao: "Voltar ao Início",
        tipo: "danger"
    });

    window.location.replace("Inicial.html");
}

function mostrarMenuAdministracao() {
  const secaoAdmin = document.getElementById("secao-admin");
  if (secaoAdmin) {
    secaoAdmin.style.display = "";
  }
}


function exigirNivelAdministrador() {
    const usuario = obterUsuarioLogado();
    if (!usuario) {
        window.location.replace("index.html");
        return false;
    }

    if (!ehAdministrador(usuario)) {
        if (!window.ACESSO_NEGADO) {
            bloquearAcessoNaoAutorizado(obterNomePaginaAtual());
        }
        return false;
    }

    return true;
}

window.exigirNivelAdministrador = exigirNivelAdministrador;

(function verificarPermissaoImediata() {
    const pagina = obterNomePaginaAtual();
    if (pagina === "index.html" || pagina === "") {
        return;
    }

    const usuario = obterUsuarioLogado();
    if (!usuario) {
        window.ACESSO_NEGADO = true;
        document.documentElement.style.visibility = "hidden";
        window.location.replace("index.html");
        return;
    }

    if (ehPaginaAdministracao() && !ehAdministrador(usuario)) {
        bloquearAcessoNaoAutorizado(pagina);
    }
})();

function carregarDadosNaTela(usuario) {
    const campoNome = document.getElementById("nomeUsuarioLogado");
    const campoNivel = document.getElementById("nivelUsuarioLogado");
    const elementoAvatar = document.querySelector(".user-avatar");

    if (campoNome) campoNome.textContent = usuario.nome;
    if (campoNivel) campoNivel.textContent = (usuario.nivel_acesso || "").trim();

    if (elementoAvatar && usuario.nome) {
        elementoAvatar.textContent = usuario.nome.trim().charAt(0).toUpperCase();
        elementoAvatar.title = usuario.nome;
    }
}

async function encerrarSessao() {
    await registrarLog("SISTEMA", "Encerrou a sessão no sistema.");
    sessionStorage.removeItem("sgap_usuario");
    window.location.replace("index.html");
}

// =====================================================
// PROTEÇÃO DAS PÁGINAS INTERNAS E MENU
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("loginForm") || window.ACESSO_NEGADO) {
        return;
    }

    const usuario = obterUsuarioLogado();

    if (!usuario) {
        window.location.replace("index.html");
        return;
    }

    if (ehPaginaAdministracao() && !ehAdministrador(usuario)) {
        bloquearAcessoNaoAutorizado(obterNomePaginaAtual());
        return;
    }

    carregarDadosNaTela(usuario);

    if (ehAdministrador(usuario)) {
        mostrarMenuAdministracao();
    } 

    const botaoLogout = document.querySelector(".btn-logout");
    if (botaoLogout) {
        botaoLogout.addEventListener("click", encerrarSessao);
    }
});
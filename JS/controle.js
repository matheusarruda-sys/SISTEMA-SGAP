// =====================================================
// CONTROLE DE USUÁRIOS (controle.js)
// =====================================================
let listaUsuarios = [];
let listaAssociacoes = [];
let usuarioEmEdicaoId = null;

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

function obterSessaoAtual() {
    const dados = sessionStorage.getItem("sgap_usuario");
    return dados ? JSON.parse(dados) : null;
}

function aplicarMascaraCPF(valor) {
    return String(valor || "")
        .replace(/\D/g, "")
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function obterNomeAssociacao(idAssociacao) {
    const associacao = listaAssociacoes.find((a) => a.id_associacao === idAssociacao);
    return associacao ? associacao.nome : "Sem associação";
}

function formatarBadgeNivel(nivel) {
    const valor = String(nivel || "").trim();
    if (valor === "1") {
        return `<span class="badge-level level-admin">Administrador (Nível 1)</span>`;
    }
    if (valor === "2") {
        return `<span class="badge-level level-manager">Gerente (Nível 2)</span>`;
    }
    return `<span class="badge-level level-manager">Nível ${escaparHTML(valor || "-")}</span>`;
}

// =====================================================
// CARREGAMENTO DE DADOS (USUÁRIOS E ASSOCIAÇÕES)
// =====================================================
async function carregarDadosControle() {
    const corpoTabela = document.querySelector(".data-table tbody");
    if (!corpoTabela) return;

    corpoTabela.innerHTML = `<tr><td colspan="5">Carregando usuários...</td></tr>`;

    const [resUsuarios, resAssociacoes] = await Promise.all([
        clienteSupabase
            .from("usuarios")
            .select("id_usuario, nome, id_associacao, cpf, local_residencia, nivel_acesso, bloqueado")
            .order("id_usuario", { ascending: true }),

        clienteSupabase
            .from("associacoes")
            .select("id_associacao, nome")
            .order("nome", { ascending: true })
    ]);

    if (resUsuarios.error) {
        console.error("Erro ao carregar usuários:", resUsuarios.error);
        corpoTabela.innerHTML = `<tr><td colspan="5">Erro ao carregar usuários do banco.</td></tr>`;
        return;
    }

    if (resAssociacoes.error) {
        console.error("Erro ao carregar associações:", resAssociacoes.error);
    }

    listaUsuarios = resUsuarios.data || [];
    listaAssociacoes = resAssociacoes.data || [];

    preencherSelectAssociacoes();
    filtrarUsuarios();
}

function preencherSelectAssociacoes() {
    const selectAssoc = document.getElementById("nu-assoc-select");
    if (!selectAssoc) return;

    const opcoes = listaAssociacoes
        .map(
            (assoc) =>
                `<option value="${assoc.id_associacao}">${escaparHTML(assoc.nome)}</option>`
        )
        .join("");

    selectAssoc.innerHTML = `<option value="">-- Selecione uma instituição --</option>${opcoes}`;
}

function renderizarTabelaUsuarios(usuarios) {
    const corpoTabela = document.querySelector(".data-table tbody");
    if (!corpoTabela) return;

    if (usuarios.length === 0) {
        corpoTabela.innerHTML = `<tr><td colspan="5">Nenhum usuário encontrado.</td></tr>`;
        return;
    }

    const usuarioLogado = obterSessaoAtual();

    corpoTabela.innerHTML = usuarios
        .map((user) => {
            const ePropriaConta = usuarioLogado && usuarioLogado.id_usuario === user.id_usuario;
            const nomeAssociacao = obterNomeAssociacao(user.id_associacao);

            const badgeStatus = user.bloqueado
                ? `<span class="badge-status status-blocked">Bloqueado</span>`
                : `<span class="badge-status status-active">Ativo</span>`;

            const botaoBloqueio = user.bloqueado
                ? `<button type="button" class="btn-icon" title="Desbloquear" onclick="alternarBloqueioUsuario(${user.id_usuario}, false)">
                       <i data-lucide="unlock"></i>
                   </button>`
                : `<button type="button" class="btn-icon" title="Bloquear" onclick="alternarBloqueioUsuario(${user.id_usuario}, true)">
                       <i data-lucide="lock"></i>
                   </button>`;

            const colunaAcoes = ePropriaConta
                ? `<span class="own-account-label">Sua Conta</span>`
                : `
                    <div class="table-actions">
                        <button type="button" class="btn-icon" title="Editar" onclick="prepararEdicaoUsuario(${user.id_usuario})">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button type="button" class="btn-icon-danger" title="Excluir" onclick="excluirUsuario(${user.id_usuario})">
                            <i data-lucide="trash-2"></i>
                        </button>
                        ${botaoBloqueio}
                    </div>
                `;

            return `
                <tr>
                    <td>
                        <div class="user-fullname">${escaparHTML(user.nome)}</div>
                        <div class="user-doc">${escaparHTML(user.cpf || "-")}</div>
                    </td>
                    <td>
                        <div class="user-assoc">${escaparHTML(nomeAssociacao)}</div>
                        <div class="user-location">${escaparHTML(user.local_residencia || "-")}</div>
                    </td>
                    <td>${formatarBadgeNivel(user.nivel_acesso)}</td>
                    <td>${badgeStatus}</td>
                    <td class="text-right">${colunaAcoes}</td>
                </tr>
            `;
        })
        .join("");

    lucide.createIcons();
}

function filtrarUsuarios() {
    const campoBusca = document.getElementById("search-usuarios");
    const termo = (campoBusca?.value || "").trim().toLowerCase();

    if (!termo) {
        renderizarTabelaUsuarios(listaUsuarios);
        return;
    }

    const filtrados = listaUsuarios.filter((user) => {
        const nomeAssoc = obterNomeAssociacao(user.id_associacao);
        return [user.nome, user.cpf, nomeAssoc, user.local_residencia].some((campo) =>
            (campo || "").toLowerCase().includes(termo)
        );
    });

    renderizarTabelaUsuarios(filtrados);
}

// =====================================================
// CONTROLE DO MODAL (ETAPA 1 E ETAPA 2)
// =====================================================
function abrirModalNovoUsuario() {
    usuarioEmEdicaoId = null;

    const modal = document.getElementById("modalUser");
    const titulo = document.getElementById("modalUserTitle");
    const etapa1 = document.getElementById("user-step-1");
    const etapa2 = document.getElementById("formUser");
    const selectAssoc = document.getElementById("nu-assoc-select");
    const campoSenha = document.getElementById("nu-senha");

    titulo.textContent = "Cadastrar Novo Usuário";
    etapa2.reset();
    selectAssoc.value = "";

    campoSenha.required = true;
    campoSenha.placeholder = "••••••••";

    etapa1.classList.remove("hidden");
    etapa2.classList.add("hidden");
    modal.classList.remove("hidden");
    selectAssoc.focus();
}

async function avancarParaEtapa2() {
    const selectAssoc = document.getElementById("nu-assoc-select");
    const idAssociacao = selectAssoc.value;

    if (!idAssociacao) {
        await exibirAlerta({
            titulo: "Seleção Obrigatória",
            mensagem: "Selecione uma instituição ou associação para continuar.",
            tipo: "warning"
        });
        selectAssoc.focus();
        return;
    }

    const nomeAssociacao = selectAssoc.options[selectAssoc.selectedIndex].text;

    document.getElementById("nu-assoc").value = idAssociacao;
    document.getElementById("nu-assoc-display").value = nomeAssociacao;

    document.getElementById("user-step-1").classList.add("hidden");
    document.getElementById("formUser").classList.remove("hidden");
    document.getElementById("nu-nome").focus();
}

function prepararEdicaoUsuario(idUsuario) {
    const usuario = listaUsuarios.find((u) => u.id_usuario === idUsuario);
    if (!usuario) return;

    usuarioEmEdicaoId = usuario.id_usuario;

    const modal = document.getElementById("modalUser");
    const titulo = document.getElementById("modalUserTitle");
    const etapa1 = document.getElementById("user-step-1");
    const etapa2 = document.getElementById("formUser");
    const campoSenha = document.getElementById("nu-senha");

    titulo.textContent = "Editar Usuário";

    document.getElementById("nu-assoc").value = usuario.id_associacao || "";
    document.getElementById("nu-assoc-display").value = obterNomeAssociacao(usuario.id_associacao);
    document.getElementById("nu-nome").value = usuario.nome || "";
    document.getElementById("nu-rg").value = aplicarMascaraCPF(usuario.cpf || "");
    document.getElementById("nu-nivel").value = String(usuario.nivel_acesso || "2").trim();
    document.getElementById("nu-local").value = usuario.local_residencia || "";

    campoSenha.value = "";
    campoSenha.required = false;
    campoSenha.placeholder = "Deixe em branco para manter a atual";

    etapa1.classList.add("hidden");
    etapa2.classList.remove("hidden");
    modal.classList.remove("hidden");
    document.getElementById("nu-nome").focus();
}

function fecharModalUsuario() {
    const modal = document.getElementById("modalUser");
    const etapa1 = document.getElementById("user-step-1");
    const etapa2 = document.getElementById("formUser");

    modal.classList.add("hidden");
    etapa2.reset();
    etapa1.classList.remove("hidden");
    etapa2.classList.add("hidden");
    usuarioEmEdicaoId = null;
}

// =====================================================
// OPERAÇÕES DE ESCRITA NO SUPABASE (INSERT / UPDATE / DELETE)
// =====================================================
async function salvarUsuario(evento) {
    evento.preventDefault();

    const botaoSalvar = document.querySelector("#formUser button[type='submit']");

    const idAssociacao = parseInt(document.getElementById("nu-assoc").value, 10);
    const nome = document.getElementById("nu-nome").value.trim();
    const cpfFormatado = aplicarMascaraCPF(document.getElementById("nu-rg").value);
    const cpfDigitos = cpfFormatado.replace(/\D/g, "");
    const senha = document.getElementById("nu-senha").value;
    const nivelAcesso = document.getElementById("nu-nivel").value;
    const localResidencia = document.getElementById("nu-local").value.trim();

    if (!idAssociacao || !nome || !localResidencia) {
        await exibirAlerta({
            titulo: "Campos Obrigatórios",
            mensagem: "Preencha todos os campos obrigatórios.",
            tipo: "warning"
        });
        return;
    }

    if (cpfDigitos.length !== 11) {
        await exibirAlerta({
            titulo: "CPF Inválido",
            mensagem: "Informe um CPF válido com 11 dígitos.",
            tipo: "warning"
        });
        document.getElementById("nu-rg").focus();
        return;
    }

    if (usuarioEmEdicaoId === null && senha.length < 6) {
        await exibirAlerta({
            titulo: "Senha Muito Curta",
            mensagem: "A senha deve conter pelo menos 6 caracteres.",
            tipo: "warning"
        });
        document.getElementById("nu-senha").focus();
        return;
    }

    if (usuarioEmEdicaoId !== null && senha.length > 0 && senha.length < 6) {
        await exibirAlerta({
            titulo: "Senha Muito Curta",
            mensagem: "A nova senha deve conter pelo menos 6 caracteres.",
            tipo: "warning"
        });
        document.getElementById("nu-senha").focus();
        return;
    }

    const cpfDuplicado = listaUsuarios.some(
        (u) =>
            (u.cpf || "").replace(/\D/g, "") === cpfDigitos &&
            u.id_usuario !== usuarioEmEdicaoId
    );

    if (cpfDuplicado) {
        await exibirAlerta({
            titulo: "CPF Duplicado",
            mensagem: "Já existe outro usuário cadastrado com este CPF.",
            tipo: "warning"
        });
        document.getElementById("nu-rg").focus();
        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
        let erroOperacao = null;
        const editandoId = usuarioEmEdicaoId;

        if (editandoId !== null) {
            const dadosAtualizacao = {
                nome,
                cpf: cpfFormatado,
                nivel_acesso: nivelAcesso,
                local_residencia: localResidencia
            };

            if (senha.length > 0) {
                dadosAtualizacao.senha = senha;
            }

            const { error } = await clienteSupabase
                .from("usuarios")
                .update(dadosAtualizacao)
                .eq("id_usuario", editandoId);
            erroOperacao = error;
        } else {
            const { error } = await clienteSupabase
                .from("usuarios")
                .insert([
                    {
                        nome,
                        id_associacao: idAssociacao,
                        cpf: cpfFormatado,
                        senha,
                        local_residencia: localResidencia,
                        nivel_acesso: nivelAcesso,
                        bloqueado: false
                    }
                ]);
            erroOperacao = error;
        }

        if (erroOperacao) {
            console.error("Erro ao salvar usuário:", erroOperacao);
            if (erroOperacao.code === "23505") {
                await exibirAlerta({
                    titulo: "CPF Duplicado",
                    mensagem: "Este CPF já está cadastrado no sistema.",
                    tipo: "warning"
                });
            } else {
                await exibirAlerta({
                    titulo: "Erro ao Salvar",
                    mensagem: "Não foi possível salvar o usuário. Verifique as permissões da tabela no Supabase.",
                    tipo: "danger"
                });
            }
            return;
        }

        if (editandoId !== null) {
            const infoSenha = senha.length > 0 ? " (com alteração de senha)" : "";
            await registrarLog("USUÁRIOS", `Editou o usuário #${editandoId} (${nome})${infoSenha}.`);
        } else {
            const nomeAssoc = obterNomeAssociacao(idAssociacao);
            await registrarLog("USUÁRIOS", `Cadastrou o usuário "${nome}" (Nível ${nivelAcesso}) em "${nomeAssoc}".`);
        }

        fecharModalUsuario();
        await carregarDadosControle();

    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar Usuário";
    }
}

async function alternarBloqueioUsuario(idUsuario, bloquear) {
    const usuario = listaUsuarios.find((u) => u.id_usuario === idUsuario);
    if (!usuario) return;

    const confirmou = await confirmarAcao({
        titulo: bloquear ? "Bloquear Acesso do Usuário" : "Desbloquear Acesso do Usuário",
        mensagem: bloquear
            ? `Deseja realmente bloquear o acesso de "${usuario.nome}"?`
            : `Deseja realmente reativar o acesso de "${usuario.nome}"?`,
        detalhe: bloquear
            ? "O usuário ficará impedido de autenticar no sistema até ser desbloqueado."
            : "O usuário voltará a ter acesso imediato conforme seu nível de permissão.",
        textoConfirmar: bloquear ? "Bloquear conta" : "Desbloquear conta",
        textoCancelar: "Cancelar",
        tipo: bloquear ? "danger" : "primary"
    });
    if (!confirmou) return;

    const { error: erro } = await clienteSupabase
        .from("usuarios")
        .update({ bloqueado: bloquear })
        .eq("id_usuario", idUsuario);

    if (erro) {
        console.error("Erro ao alterar status de bloqueio:", erro);
        await exibirAlerta({
            titulo: "Erro ao Atualizar",
            mensagem: "Não foi possível atualizar o status do usuário.",
            tipo: "danger"
        });
        return;
    }

    const acaoLog = bloquear ? "Bloqueou" : "Desbloqueou";
    await registrarLog("USUÁRIOS", `${acaoLog} a conta de acesso do usuário #${idUsuario} (${usuario.nome}).`);
    await carregarDadosControle();
}

async function excluirUsuario(idUsuario) {
    const usuario = listaUsuarios.find((u) => u.id_usuario === idUsuario);
    if (!usuario) return;

    const confirmou = await confirmarAcao({
        titulo: "Excluir Conta de Usuário",
        mensagem: `Deseja realmente excluir o usuário "${usuario.nome}"?`,
        detalhe: "Caso o usuário possua histórico de auditoria, utilize a opção Bloquear.",
        textoConfirmar: "Sim, excluir",
        textoCancelar: "Cancelar",
        tipo: "danger"
    });
    if (!confirmou) return;

    const { error: erro } = await clienteSupabase
        .from("usuarios")
        .delete()
        .eq("id_usuario", idUsuario);

    if (erro) {
        console.error("Erro ao excluir usuário:", erro);
        if (erro.code === "23503") {
            await exibirAlerta({
                titulo: "Exclusão Bloqueada",
                mensagem: "Não é possível excluir este usuário porque existem registros de auditoria ou atividades vinculados a ele.",
                detalhe: "Utilize a opção Bloquear para revogar o acesso sem apagar o histórico.",
                tipo: "warning"
            });
        } else {
            await exibirAlerta({
                titulo: "Erro ao Excluir",
                mensagem: "Erro ao excluir o usuário. Verifique as permissões no Supabase.",
                tipo: "danger"
            });
        }
        return;
    }

    await registrarLog("USUÁRIOS", `Excluiu o usuário #${idUsuario} (${usuario.nome}).`);
    await carregarDadosControle();
}

// =====================================================
// INICIALIZAÇÃO DOS EVENTOS
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    if (!exigirNivelAdministrador()) return;
    carregarDadosControle();

    document.getElementById("search-usuarios")?.addEventListener("input", filtrarUsuarios);
    document.querySelector(".action-bar .btn-primary")?.addEventListener("click", abrirModalNovoUsuario);

    document.getElementById("nu-rg")?.addEventListener("input", (evento) => {
        evento.target.value = aplicarMascaraCPF(evento.target.value);
    });

    document.querySelector("#user-step-1 .btn-primary")?.addEventListener("click", avancarParaEtapa2);
    document.querySelector("#user-step-1 .btn-secondary")?.addEventListener("click", fecharModalUsuario);

    document.getElementById("formUser")?.addEventListener("submit", salvarUsuario);
    document.querySelector("#formUser .btn-secondary")?.addEventListener("click", fecharModalUsuario);
    document.querySelector("#modalUser .close-modal-btn")?.addEventListener("click", fecharModalUsuario);

    document.getElementById("modalUser")?.addEventListener("click", (evento) => {
        if (evento.target.id === "modalUser") fecharModalUsuario();
    });

    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") fecharModalUsuario();
    });

    const sidebar = document.querySelector(".sidebar");
    const backdrop = document.querySelector(".mobile-backdrop");
    document.querySelector(".open-mobile-btn")?.addEventListener("click", () => {
        sidebar?.classList.add("open");
        backdrop?.classList.add("active");
    });
    document.querySelector(".close-mobile-btn")?.addEventListener("click", () => {
        sidebar?.classList.remove("open");
        backdrop?.classList.remove("active");
    });
    backdrop?.addEventListener("click", () => {
        sidebar?.classList.remove("open");
        backdrop?.classList.remove("active");
    });
});
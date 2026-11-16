// =====================================================
// GERENCIAMENTO DE ASSOCIAÇÕES E ÓRGÃOS (associacao.js)
// =====================================================
let listaAssociacoes = [];
let associacaoEmEdicaoId = null;

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

// =====================================================
// LISTAGEM E BUSCA EM TEMPO REAL
// =====================================================
async function carregarAssociacoes() {
    const corpoTabela = document.querySelector(".data-table tbody");
    if (!corpoTabela) return;

    corpoTabela.innerHTML = `<tr><td colspan="6">Carregando instituições...</td></tr>`;

    const { data, error: erro } = await clienteSupabase
        .from("associacoes")
        .select("id_associacao, nome, ramo_atuacao, lider, local_operacao, local_fundacao, fim_lucrativo, protegido")
        .order("id_associacao", { ascending: true });

    if (erro) {
        console.error("Erro ao buscar associações:", erro);
        corpoTabela.innerHTML = `<tr><td colspan="6">Erro ao carregar dados do banco.</td></tr>`;
        return;
    }

    listaAssociacoes = data || [];
    filtrarAssociacoes();
}

function renderizarTabela(associacoes) {
    const corpoTabela = document.querySelector(".data-table tbody");
    if (!corpoTabela) return;

    if (associacoes.length === 0) {
        corpoTabela.innerHTML = `<tr><td colspan="6">Nenhuma instituição encontrada.</td></tr>`;
        return;
    }

    corpoTabela.innerHTML = associacoes
        .map((item) => {
            const eProtegido = Boolean(item.protegido);
            const tipoLucro = item.fim_lucrativo ? "Fins Lucrativos" : "Sem Fins Lucrativos";
            const badgeOrigem = eProtegido
                ? `<span class="badge-origin origin-native">Nativo</span>`
                : `<span class="badge-origin origin-manual">Manual</span>`;

            const colunaAcoes = eProtegido
                ? `<span class="protected-label">Protegido</span>`
                : `
                    <div class="table-actions">
                        <button type="button" class="btn-icon" title="Editar" onclick="prepararEdicao(${item.id_associacao})">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button type="button" class="btn-icon-danger" title="Excluir" onclick="excluirAssociacao(${item.id_associacao})">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                `;

            return `
                <tr>
                    <td>
                        <div class="inst-info-cell">
                            <div class="inst-icon-box">
                                <i data-lucide="building"></i>
                            </div>
                            <div>
                                <div class="inst-name">${escaparHTML(item.nome)}</div>
                                <div class="inst-profit-type">${tipoLucro}</div>
                            </div>
                        </div>
                    </td>
                    <td class="inst-leader">${escaparHTML(item.lider || "-")}</td>
                    <td class="inst-ramo">${escaparHTML(item.ramo_atuacao || "-")}</td>
                    <td>
                        <div class="inst-location">${escaparHTML(item.local_operacao || "-")}</div>
                        <div class="inst-foundation">Fundação: ${escaparHTML(item.local_fundacao || "-")}</div>
                    </td>
                    <td>${badgeOrigem}</td>
                    <td class="text-right">${colunaAcoes}</td>
                </tr>
            `;
        })
        .join("");

    lucide.createIcons();
}

function filtrarAssociacoes() {
    const campoBusca = document.getElementById("search-associacoes");
    const termo = (campoBusca?.value || "").trim().toLowerCase();

    if (!termo) {
        renderizarTabela(listaAssociacoes);
        return;
    }

    const filtradas = listaAssociacoes.filter((item) =>
        [
            item.nome,
            item.lider,
            item.ramo_atuacao,
            item.local_operacao,
            item.local_fundacao
        ].some((campo) => (campo || "").toLowerCase().includes(termo))
    );

    renderizarTabela(filtradas);
}

// =====================================================
// CONTROLE DO MODAL (CRIAR / EDITAR)
// =====================================================
async function abrirModalAssociacao(associacao = null) {
    const modal = document.getElementById("modalAssociacao");
    const titulo = document.getElementById("modalAssociacaoTitle");

    const campoNome = document.getElementById("na-nome");
    const campoRamo = document.getElementById("na-ramo");
    const campoLider = document.getElementById("na-lider");
    const campoLocalOp = document.getElementById("na-local-op");
    const campoLocalFund = document.getElementById("na-local-fund");
    const campoLucrativo = document.getElementById("na-lucrativo");

    if (associacao) {
        if (associacao.protegido) {
            await exibirAlerta({
                titulo: "Registro Protegido",
                mensagem: "Registros nativos protegidos não podem ser editados.",
                tipo: "warning"
            });
            return;
        }
        associacaoEmEdicaoId = associacao.id_associacao;
        titulo.textContent = "Editar Associação/Órgão";
        campoNome.value = associacao.nome || "";
        campoRamo.value = associacao.ramo_atuacao || "";
        campoLider.value = associacao.lider || "";
        campoLocalOp.value = associacao.local_operacao || "";
        campoLocalFund.value = associacao.local_fundacao || "";
        campoLucrativo.checked = Boolean(associacao.fim_lucrativo);
    } else {
        associacaoEmEdicaoId = null;
        titulo.textContent = "Cadastrar Associação/Órgão";
        document.getElementById("formAssociacao").reset();
    }

    modal.classList.remove("hidden");
    campoNome.focus();
}

function fecharModalAssociacao() {
    const modal = document.getElementById("modalAssociacao");
    const formulario = document.getElementById("formAssociacao");

    modal.classList.add("hidden");
    formulario.reset();
    associacaoEmEdicaoId = null;
}

function prepararEdicao(idAssociacao) {
    const associacao = listaAssociacoes.find((item) => item.id_associacao === idAssociacao);
    if (associacao) {
        abrirModalAssociacao(associacao);
    }
}

// =====================================================
// OPERAÇÕES DE ESCRITA NO SUPABASE (INSERT / UPDATE / DELETE)
// =====================================================
async function salvarAssociacao(evento) {
    evento.preventDefault();

    const botaoSalvar = document.querySelector("#formAssociacao button[type='submit']");

    const dados = {
        nome: document.getElementById("na-nome").value.trim(),
        ramo_atuacao: document.getElementById("na-ramo").value.trim(),
        lider: document.getElementById("na-lider").value.trim(),
        local_operacao: document.getElementById("na-local-op").value.trim(),
        local_fundacao: document.getElementById("na-local-fund").value.trim(),
        fim_lucrativo: document.getElementById("na-lucrativo").checked
    };

    if (!dados.nome || !dados.ramo_atuacao || !dados.lider || !dados.local_operacao || !dados.local_fundacao) {
        await exibirAlerta({
            titulo: "Campos Obrigatórios",
            mensagem: "Preencha todos os campos obrigatórios.",
            tipo: "warning"
        });
        return;
    }

    const jaExiste = listaAssociacoes.some(
        (item) =>
            item.nome.toLowerCase() === dados.nome.toLowerCase() &&
            item.id_associacao !== associacaoEmEdicaoId
    );

    if (jaExiste) {
        await exibirAlerta({
            titulo: "Instituição Duplicada",
            mensagem: "Já existe uma associação ou órgão cadastrado com esse nome.",
            tipo: "warning"
        });
        document.getElementById("na-nome").focus();
        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
        let erroOperacao = null;
        const editandoId = associacaoEmEdicaoId;

        if (editandoId !== null) {
            const { error } = await clienteSupabase
                .from("associacoes")
                .update(dados)
                .eq("id_associacao", editandoId)
                .eq("protegido", false);
            erroOperacao = error;
        } else {
            const { error } = await clienteSupabase
                .from("associacoes")
                .insert([{ ...dados, protegido: false }]);
            erroOperacao = error;
        }

        if (erroOperacao) {
            console.error("Erro ao salvar associação:", erroOperacao);
            await exibirAlerta({
                titulo: "Erro ao Salvar",
                mensagem: "Não foi possível salvar o registro. Verifique as permissões da tabela no Supabase.",
                tipo: "danger"
            });
            return;
        }

        if (editandoId !== null) {
            await registrarLog("ASSOCIAÇÕES", `Editou a instituição #${editandoId} (${dados.nome}).`);
        } else {
            await registrarLog("ASSOCIAÇÕES", `Cadastrou a instituição "${dados.nome}".`);
        }

        fecharModalAssociacao();
        await carregarAssociacoes();

    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar Registro";
    }
}

async function excluirAssociacao(idAssociacao) {
    const associacao = listaAssociacoes.find((item) => item.id_associacao === idAssociacao);
    if (!associacao) return;

    if (associacao.protegido) {
        await exibirAlerta({
            titulo: "Registro Protegido",
            mensagem: "Registros nativos protegidos não podem ser excluídos.",
            tipo: "warning"
        });
        return;
    }

    const confirmou = await confirmarAcao({
        titulo: "Excluir Associação / Órgão",
        mensagem: `Deseja realmente excluir a instituição "${associacao.nome}"?`,
        detalhe: "O registro será removido permanentemente do cadastro base.",
        textoConfirmar: "Sim, excluir",
        textoCancelar: "Cancelar",
        tipo: "danger"
    });
    if (!confirmou) return;

    const { error: erro } = await clienteSupabase
        .from("associacoes")
        .delete()
        .eq("id_associacao", idAssociacao)
        .eq("protegido", false);

    if (erro) {
        console.error("Erro ao excluir associação:", erro);
        if (erro.code === "23503") {
            await exibirAlerta({
                titulo: "Exclusão Bloqueada",
                mensagem: "Não é possível excluir esta instituição porque existem usuários ou destinações vinculados a ela.",
                tipo: "warning"
            });
        } else {
            await exibirAlerta({
                titulo: "Erro ao Excluir",
                mensagem: "Erro ao excluir a instituição. Verifique as permissões no Supabase.",
                tipo: "danger"
            });
        }
        return;
    }

    await registrarLog("ASSOCIAÇÕES", `Excluiu a instituição #${idAssociacao} (${associacao.nome}).`);
    await carregarAssociacoes();
}

// =====================================================
// INICIALIZAÇÃO DOS EVENTOS
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    carregarAssociacoes();

    document.getElementById("search-associacoes")?.addEventListener("input", filtrarAssociacoes);
    document.querySelector(".action-bar .btn-primary")?.addEventListener("click", () => abrirModalAssociacao());
    document.getElementById("formAssociacao")?.addEventListener("submit", salvarAssociacao);

    document.querySelector("#modalAssociacao .btn-secondary")?.addEventListener("click", fecharModalAssociacao);
    document.querySelector("#modalAssociacao .close-modal-btn")?.addEventListener("click", fecharModalAssociacao);

    document.getElementById("modalAssociacao")?.addEventListener("click", (evento) => {
        if (evento.target.id === "modalAssociacao") fecharModalAssociacao();
    });

    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") fecharModalAssociacao();
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
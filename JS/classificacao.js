// =====================================================
// GERENCIAMENTO DE CATEGORIAS (classificacao.js)
// =====================================================
let listaCategorias = [];
let categoriaEmEdicaoId = null;

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

// =====================================================
// LISTAGEM E BUSCA EM TEMPO REAL
// =====================================================
async function carregarCategorias() {
    const corpoTabela = document.getElementById("tabelaCategoriasBody");
    if (!corpoTabela) return;

    corpoTabela.innerHTML = `<tr><td colspan="3">Carregando categorias...</td></tr>`;

    const { data, error: erro } = await clienteSupabase
        .from("categoria")
        .select("id_categoria, nome")
        .order("id_categoria", { ascending: true });

    if (erro) {
        console.error("Erro ao buscar categorias:", erro);
        corpoTabela.innerHTML = `<tr><td colspan="3">Erro ao carregar dados do banco.</td></tr>`;
        return;
    }

    listaCategorias = data || [];
    filtrarCategorias();
}

function renderizarTabela(categorias) {
    const corpoTabela = document.getElementById("tabelaCategoriasBody");
    if (!corpoTabela) return;

    if (categorias.length === 0) {
        corpoTabela.innerHTML = `<tr><td colspan="3">Nenhuma categoria encontrada.</td></tr>`;
        return;
    }

    corpoTabela.innerHTML = categorias
        .map(
            (cat) => `
            <tr>
                <td class="category-id">#${cat.id_categoria}</td>
                <td class="category-name">${escaparHTML(cat.nome)}</td>
                <td class="text-right">
                    <div class="table-actions">
                        <button type="button" class="btn-icon" title="Editar" onclick="prepararEdicao(${cat.id_categoria})">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button type="button" class="btn-icon-danger" title="Excluir" onclick="excluirCategoria(${cat.id_categoria})">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `
        )
        .join("");

    lucide.createIcons();
}

function filtrarCategorias() {
    const campoBusca = document.getElementById("search-classificacoes");
    const termo = (campoBusca?.value || "").trim().toLowerCase();

    if (!termo) {
        renderizarTabela(listaCategorias);
        return;
    }

    const filtradas = listaCategorias.filter(
        (cat) =>
            cat.nome.toLowerCase().includes(termo) ||
            String(cat.id_categoria).includes(termo.replace("#", ""))
    );

    renderizarTabela(filtradas);
}

// =====================================================
// CONTROLE DO MODAL (CRIAR / EDITAR)
// =====================================================
function abrirModalCategoria(categoria = null) {
    const modal = document.getElementById("modalClassificacao");
    const titulo = document.getElementById("modalClassTitle");
    const campoNome = document.getElementById("nc-nome");

    if (categoria) {
        categoriaEmEdicaoId = categoria.id_categoria;
        titulo.textContent = "Editar Categoria";
        campoNome.value = categoria.nome;
    } else {
        categoriaEmEdicaoId = null;
        titulo.textContent = "Nova Categoria";
        campoNome.value = "";
    }

    modal.classList.remove("hidden");
    campoNome.focus();
}

function fecharModalCategoria() {
    const modal = document.getElementById("modalClassificacao");
    const formulario = document.getElementById("formClassificacao");

    modal.classList.add("hidden");
    formulario.reset();
    categoriaEmEdicaoId = null;
}

function prepararEdicao(idCategoria) {
    const categoria = listaCategorias.find((item) => item.id_categoria === idCategoria);
    if (categoria) {
        abrirModalCategoria(categoria);
    }
}

// =====================================================
// OPERAÇÕES DE ESCRITA NO SUPABASE (INSERT / UPDATE / DELETE)
// =====================================================
async function salvarCategoria(evento) {
    evento.preventDefault();

    const campoNome = document.getElementById("nc-nome");
    const botaoSalvar = document.getElementById("btnSalvarCategoria");
    const nome = campoNome.value.trim();

    if (!nome) {
        await exibirAlerta({
            titulo: "Campo Obrigatório",
            mensagem: "Informe o nome da categoria.",
            tipo: "warning"
        });
        campoNome.focus();
        return;
    }

    const jaExiste = listaCategorias.some(
        (cat) =>
            cat.nome.toLowerCase() === nome.toLowerCase() &&
            cat.id_categoria !== categoriaEmEdicaoId
    );

    if (jaExiste) {
        await exibirAlerta({
            titulo: "Categoria Duplicada",
            mensagem: "Já existe uma categoria cadastrada com esse nome.",
            tipo: "warning"
        });
        campoNome.focus();
        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
        let erroOperacao = null;
        const editandoId = categoriaEmEdicaoId;

        if (editandoId !== null) {
            const { error } = await clienteSupabase
                .from("categoria")
                .update({ nome })
                .eq("id_categoria", editandoId);
            erroOperacao = error;
        } else {
            const { error } = await clienteSupabase
                .from("categoria")
                .insert([{ nome }]);
            erroOperacao = error;
        }

        if (erroOperacao) {
            console.error("Erro ao salvar categoria:", erroOperacao);
            await exibirAlerta({
                titulo: "Erro ao Salvar",
                mensagem: "Não foi possível salvar a categoria. Verifique as permissões da tabela no Supabase.",
                tipo: "danger"
            });
            return;
        }

        if (editandoId !== null) {
            await registrarLog("CATEGORIAS", `Editou a categoria #${editandoId} para "${nome}".`);
        } else {
            await registrarLog("CATEGORIAS", `Cadastrou a categoria "${nome}".`);
        }

        fecharModalCategoria();
        await carregarCategorias();

    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar";
    }
}

async function excluirCategoria(idCategoria) {
    const categoria = listaCategorias.find((item) => item.id_categoria === idCategoria);
    if (!categoria) return;

    const confirmou = await confirmarAcao({
        titulo: "Excluir Categoria",
        mensagem: `Deseja realmente excluir a categoria "${categoria.nome}"?`,
        detalhe: "Esta ação não poderá ser desfeita caso não haja produtos vinculados.",
        textoConfirmar: "Sim, excluir",
        textoCancelar: "Cancelar",
        tipo: "danger"
    });
    if (!confirmou) return;

    const { error: erro } = await clienteSupabase
        .from("categoria")
        .delete()
        .eq("id_categoria", idCategoria);

    if (erro) {
        console.error("Erro ao excluir categoria:", erro);
        if (erro.code === "23503") {
            await exibirAlerta({
                titulo: "Exclusão Bloqueada",
                mensagem: "Não é possível excluir esta categoria porque existem produtos vinculados a ela.",
                tipo: "warning"
            });
        } else {
            await exibirAlerta({
                titulo: "Erro ao Excluir",
                mensagem: "Erro ao excluir a categoria. Verifique as permissões no Supabase.",
                tipo: "danger"
            });
        }
        return;
    }

    await registrarLog("CATEGORIAS", `Excluiu a categoria #${idCategoria} (${categoria.nome}).`);
    await carregarCategorias();
}

// =====================================================
// INICIALIZAÇÃO DOS EVENTOS
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    if (!exigirNivelAdministrador()) return;
    carregarCategorias();

    document.getElementById("search-classificacoes")?.addEventListener("input", filtrarCategorias);
    document.getElementById("btnNovaCategoria")?.addEventListener("click", () => abrirModalCategoria());
    document.getElementById("formClassificacao")?.addEventListener("submit", salvarCategoria);
    document.getElementById("btnCancelarModal")?.addEventListener("click", fecharModalCategoria);
    document.querySelector("#modalClassificacao .btn-secondary")?.addEventListener("click", fecharModalCategoria);
    document.querySelector("#modalClassificacao .close-modal-btn")?.addEventListener("click", fecharModalCategoria);

    document.getElementById("modalClassificacao")?.addEventListener("click", (evento) => {
        if (evento.target.id === "modalClassificacao") fecharModalCategoria();
    });

    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") fecharModalCategoria();
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
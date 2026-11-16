// =====================================================
// GERENCIAMENTO DE PRODUTOS E DESTINAÇÃO (produtos.js)
// =====================================================
let listaProdutos = [];
let listaCategorias = [];
let listaAssociacoes = [];
let listaUsuarios = [];
let listaDestinacoes = [];
let produtoEmEdicaoId = null;

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

function formatarDataBR(dataISO) {
    if (!dataISO) return "-";
    const [ano, mes, dia] = dataISO.split("T")[0].split("-");
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : dataISO;
}

function formatarMoedaBRL(valor) {
    const numero = Number(valor || 0);
    return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function obterNomeCategoria(idCategoria) {
    const cat = listaCategorias.find((c) => c.id_categoria === idCategoria);
    return cat ? cat.nome : "Sem categoria";
}

function obterAssociacao(idAssociacao) {
    return listaAssociacoes.find((a) => a.id_associacao === idAssociacao) || null;
}

function obterUsuario(idUsuario) {
    return listaUsuarios.find((u) => u.id_usuario === idUsuario) || null;
}

// =====================================================
// CARREGAMENTO INICIAL DOS DADOS
// =====================================================
async function carregarDadosProdutos() {
    const grid = document.getElementById("gridProdutos");
    if (!grid) return;

    grid.innerHTML = `<p>Carregando produtos apreendidos...</p>`;

    const [resProdutos, resCategorias, resAssociacoes, resUsuarios, resDestinacoes] = await Promise.all([
        clienteSupabase
            .from("prodapreend")
            .select("id_apreend, nome, id_categoria, data_apren, motivoapreend, localizacao_atual, qtde_lote, status, valor")
            .order("id_apreend", { ascending: false }),

        clienteSupabase
            .from("categoria")
            .select("id_categoria, nome")
            .order("nome", { ascending: true }),

        clienteSupabase
            .from("associacoes")
            .select("id_associacao, nome, local_operacao")
            .order("nome", { ascending: true }),

        clienteSupabase
            .from("usuarios")
            .select("id_usuario, nome, id_associacao, nivel_acesso, bloqueado")
            .order("nome", { ascending: true }),

        clienteSupabase
            .from("prodapreend_destinacao")
            .select("id_destinacao, id_apreend, funcao, id_associacao_destino, id_responsavel")
            .order("id_destinacao", { ascending: false })
    ]);

    if (resProdutos.error) {
        console.error("Erro ao carregar produtos:", resProdutos.error);
        grid.innerHTML = `<p>Erro ao carregar produtos do banco de dados.</p>`;
        return;
    }

    listaProdutos = resProdutos.data || [];
    listaCategorias = resCategorias.data || [];
    listaAssociacoes = resAssociacoes.data || [];
    listaUsuarios = resUsuarios.data || [];
    listaDestinacoes = resDestinacoes.data || [];

    preencherSelectsModais();
    filtrarProdutos();
}

function preencherSelectsModais() {
    const selectCategoria = document.getElementById("np-class");
    if (selectCategoria) {
        const opcoesCat = listaCategorias
            .map((cat) => `<option value="${cat.id_categoria}">${escaparHTML(cat.nome)}</option>`)
            .join("");
        selectCategoria.innerHTML = listaCategorias.length
            ? opcoesCat
            : `<option value="">Nenhuma categoria cadastrada</option>`;
    }

    const selectAssoc = document.getElementById("nd-associacao");
    if (selectAssoc) {
        const opcoesAssoc = listaAssociacoes
            .map((assoc) => `<option value="${assoc.id_associacao}">${escaparHTML(assoc.nome)}</option>`)
            .join("");
        selectAssoc.innerHTML = `<option value="">Selecione a instituição...</option>${opcoesAssoc}`;
    }

    const selectUser = document.getElementById("nd-user");
    if (selectUser) {
        const usuariosAtivos = listaUsuarios.filter((u) => !u.bloqueado);
        const opcoesUser = usuariosAtivos
            .map((u) => {
                const assoc = obterAssociacao(u.id_associacao);
                const sufixoAssoc = assoc ? ` (${assoc.nome})` : "";
                return `<option value="${u.id_usuario}">${escaparHTML(u.nome + sufixoAssoc)}</option>`;
            })
            .join("");
        selectUser.innerHTML = `<option value="">Selecione...</option>${opcoesUser}`;
    }
}

// =====================================================
// RENDERIZAÇÃO DOS CARDS E BUSCA EM TEMPO REAL
// =====================================================
function renderizarCardsProdutos(produtos) {
    const grid = document.getElementById("gridProdutos");
    if (!grid) return;

    if (produtos.length === 0) {
        grid.innerHTML = `<p>Nenhum produto apreendido encontrado.</p>`;
        return;
    }

    grid.innerHTML = produtos
        .map((prod) => {
            const status = (prod.status || "Em Depósito").trim();
            const statusNorm = status.toLowerCase();
            const nomeCategoria = obterNomeCategoria(prod.id_categoria);
            const infoLote = prod.qtde_lote ? ` (Lote: ${prod.qtde_lote} un)` : "";

            let classeCard = "card-status-deposito";
            let badgeHTML = `<span class="badge-status status-deposito">${escaparHTML(status)}</span>`;
            let acoesRapidasHTML = "";
            let classeTituloId = "";
            let botaoRodapeHTML = "";

            if (statusNorm === "recebido") {
                classeCard = "card-status-recebido";
                badgeHTML = `<span class="badge-status status-recebido"><i data-lucide="check"></i> Recebido</span>`;
                botaoRodapeHTML = `
                    <button type="button" class="btn-secondary btn-full" onclick="abrirModalViewDestino(${prod.id_apreend})">
                        <i data-lucide="eye"></i> Detalhes do Destino
                    </button>
                `;
            } else if (statusNorm === "destinado") {
                classeCard = "card-status-destinado";
                badgeHTML = `<span class="badge-status status-destinado">Destinado</span>`;
                botaoRodapeHTML = `
                    <button type="button" class="btn-secondary btn-full" onclick="abrirModalViewDestino(${prod.id_apreend})">
                        <i data-lucide="eye"></i> Detalhes do Destino
                    </button>
                `;
            } else {
                classeCard = "card-status-deposito";
                badgeHTML = `<span class="badge-status status-deposito">${escaparHTML(status)}</span>`;
                classeTituloId = "has-actions";
                acoesRapidasHTML = `
                    <div class="card-quick-actions">
                        <button type="button" class="btn-card-action" title="Editar" onclick="prepararEdicaoProduto(${prod.id_apreend})">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button type="button" class="btn-card-action action-danger" title="Excluir" onclick="excluirProduto(${prod.id_apreend})">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                `;
                botaoRodapeHTML = `
                    <button type="button" class="btn-primary btn-full" onclick="abrirModalDestino(${prod.id_apreend})">
                        <i data-lucide="send"></i> Atribuir Destinação
                    </button>
                `;
            }

            return `
                <div class="product-card ${classeCard}">
                    ${acoesRapidasHTML}
                    <div class="product-card-body">
                        <div class="product-card-meta">
                            ${badgeHTML}
                            <span class="product-id ${classeTituloId}">ID: #${prod.id_apreend}</span>
                        </div>
                        <h3 class="product-title ${classeTituloId}">${escaparHTML(prod.nome)}</h3>
                        <div class="product-details">
                            <p class="detail-item">
                                <i data-lucide="tag"></i>
                                <span><strong>Classe:</strong> ${escaparHTML(nomeCategoria)}${infoLote}</span>
                            </p>
                            <p class="detail-item">
                                <i data-lucide="banknote"></i>
                                <span><strong>Valor:</strong> ${formatarMoedaBRL(prod.valor)}</span>
                            </p>
                            <p class="detail-item">
                                <i data-lucide="map-pin"></i>
                                <span><strong>Custódia:</strong> ${escaparHTML(prod.localizacao_atual || "-")}</span>
                            </p>
                            <p class="detail-item">
                                <i data-lucide="calendar"></i>
                                <span><strong>Apreendido:</strong> ${formatarDataBR(prod.data_apren)}</span>
                            </p>
                            <p class="detail-item">
                                <i data-lucide="info"></i>
                                <span><strong>Motivo:</strong> ${escaparHTML(prod.motivoapreend || "-")}</span>
                            </p>
                        </div>
                    </div>
                    <div class="product-card-footer">
                        ${botaoRodapeHTML}
                    </div>
                </div>
            `;
        })
        .join("");

    lucide.createIcons();
}

function filtrarProdutos() {
    const campoBusca = document.getElementById("search-produtos");
    const termo = (campoBusca?.value || "").trim().toLowerCase();

    if (!termo) {
        renderizarCardsProdutos(listaProdutos);
        return;
    }

    const filtrados = listaProdutos.filter((prod) => {
        const nomeCat = obterNomeCategoria(prod.id_categoria);
        return [
            String(prod.id_apreend),
            prod.nome,
            nomeCat,
            prod.localizacao_atual,
            prod.motivoapreend,
            prod.status
        ].some((campo) => (campo || "").toLowerCase().includes(termo));
    });

    renderizarCardsProdutos(filtrados);
}

// =====================================================
// MODAL 1: CADASTRO E EDIÇÃO DE PRODUTO (ProdApreend)
// =====================================================
function alternarCampoLote(ativo) {
    const containerQtd = document.getElementById("np-qtd-container");
    const inputQtd = document.getElementById("np-qtd");

    containerQtd.classList.toggle("hidden", !ativo);
    inputQtd.required = ativo;
    if (!ativo) inputQtd.value = "";
}

function abrirModalProduto(produto = null) {
    const modal = document.getElementById("modalProduto");
    const titulo = document.getElementById("modalProdutoTitle");
    const form = document.getElementById("formProduto");

    form.reset();

    if (produto) {
        produtoEmEdicaoId = produto.id_apreend;
        titulo.textContent = `Editar Produto #${produto.id_apreend}`;

        document.getElementById("np-nome").value = produto.nome || "";
        document.getElementById("np-class").value = produto.id_categoria || "";
        document.getElementById("np-data").value = produto.data_apren ? produto.data_apren.split("T")[0] : "";
        document.getElementById("np-valor").value = produto.valor ?? "";
        document.getElementById("np-local").value = produto.localizacao_atual || "";
        document.getElementById("np-motivo").value = produto.motivoapreend || "";

        const temLote = Boolean(produto.qtde_lote && produto.qtde_lote > 0);
        document.getElementById("np-lote").checked = temLote;
        alternarCampoLote(temLote);
        if (temLote) {
            document.getElementById("np-qtd").value = produto.qtde_lote;
        }
    } else {
        produtoEmEdicaoId = null;
        titulo.textContent = "Registrar Produto Apreendido";
        document.getElementById("np-data").value = new Date().toISOString().split("T")[0];
        alternarCampoLote(false);
    }

    modal.classList.remove("hidden");
    document.getElementById("np-nome").focus();
}

function fecharModalProduto() {
    document.getElementById("modalProduto").classList.add("hidden");
    document.getElementById("formProduto").reset();
    alternarCampoLote(false);
    produtoEmEdicaoId = null;
}

function prepararEdicaoProduto(idApreend) {
    const produto = listaProdutos.find((p) => p.id_apreend === idApreend);
    if (produto) abrirModalProduto(produto);
}

async function salvarProduto(evento) {
    evento.preventDefault();

    const botaoSalvar = document.querySelector("#formProduto button[type='submit']");

    const nome = document.getElementById("np-nome").value.trim();
    const idCategoria = parseInt(document.getElementById("np-class").value, 10);
    const dataApren = document.getElementById("np-data").value || null;
    const valor = parseFloat(document.getElementById("np-valor").value);
    const localizacaoAtual = document.getElementById("np-local").value.trim();
    const motivoApreend = document.getElementById("np-motivo").value.trim();
    const eLote = document.getElementById("np-lote").checked;
    const qtdeLote = eLote ? parseInt(document.getElementById("np-qtd").value, 10) : null;

    if (!nome || !idCategoria || !localizacaoAtual || !motivoApreend) {
        await exibirAlerta({
            titulo: "Campos Obrigatórios",
            mensagem: "Preencha todos os campos obrigatórios.",
            tipo: "warning"
        });
        return;
    }

    if (Number.isNaN(valor) || valor < 0) {
        await exibirAlerta({
            titulo: "Valor Inválido",
            mensagem: "Informe um valor estimado válido.",
            tipo: "warning"
        });
        document.getElementById("np-valor").focus();
        return;
    }

    if (eLote && (!qtdeLote || qtdeLote <= 0)) {
        await exibirAlerta({
            titulo: "Quantidade Inválida",
            mensagem: "Informe uma quantidade válida para o lote.",
            tipo: "warning"
        });
        document.getElementById("np-qtd").focus();
        return;
    }

    const dadosProduto = {
        nome,
        id_categoria: idCategoria,
        data_apren: dataApren,
        motivoapreend: motivoApreend,
        localizacao_atual: localizacaoAtual,
        qtde_lote: qtdeLote,
        valor
    };

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
        let erroOperacao = null;
        const editandoId = produtoEmEdicaoId;

        if (editandoId !== null) {
            const { error } = await clienteSupabase
                .from("prodapreend")
                .update(dadosProduto)
                .eq("id_apreend", editandoId);
            erroOperacao = error;
        } else {
            const { error } = await clienteSupabase
                .from("prodapreend")
                .insert([{ ...dadosProduto, status: "Em Depósito" }]);
            erroOperacao = error;
        }

        if (erroOperacao) {
            console.error("Erro ao salvar produto:", erroOperacao);
            await exibirAlerta({
                titulo: "Erro ao Salvar",
                mensagem: "Não foi possível salvar o produto. Verifique as permissões no Supabase.",
                tipo: "danger"
            });
            return;
        }

        if (editandoId !== null) {
            await registrarLog("PRODUTOS", `Editou o produto apreendido #${editandoId} (${nome}).`);
        } else {
            await registrarLog("PRODUTOS", `Registrou novo produto apreendido: "${nome}".`);
        }

        fecharModalProduto();
        await carregarDadosProdutos();

    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar Registro";
    }
}

async function excluirProduto(idApreend) {
    const produto = listaProdutos.find((p) => p.id_apreend === idApreend);
    if (!produto) return;

    const confirmou = await confirmarAcao({
        titulo: "Excluir Produto Apreendido",
        mensagem: `Deseja realmente excluir o bem "#${produto.id_apreend} - ${produto.nome}"?`,
        detalhe: "Esta ação removerá definitivamente o registro do inventário.",
        textoConfirmar: "Sim, excluir",
        textoCancelar: "Cancelar",
        tipo: "danger"
    });
    if (!confirmou) return;

    const { error: erro } = await clienteSupabase
        .from("prodapreend")
        .delete()
        .eq("id_apreend", idApreend);

    if (erro) {
        console.error("Erro ao excluir produto:", erro);
        if (erro.code === "23503") {
            await exibirAlerta({
                titulo: "Exclusão Bloqueada",
                mensagem: "Este produto possui histórico de destinação vinculado e não pode ser excluído.",
                tipo: "warning"
            });
        } else {
            await exibirAlerta({
                titulo: "Erro ao Excluir",
                mensagem: "Erro ao excluir o produto. Verifique as permissões no Supabase.",
                tipo: "danger"
            });
        }
        return;
    }

    await registrarLog("PRODUTOS", `Excluiu o produto apreendido #${idApreend} (${produto.nome}).`);
    await carregarDadosProdutos();
}

// =====================================================
// MODAL 3: ATRIBUIR DESTINAÇÃO (ProdApreend_destinacao)
// =====================================================
function abrirModalDestino(idApreend) {
    const produto = listaProdutos.find((p) => p.id_apreend === idApreend);
    if (!produto) return;

    const modal = document.getElementById("modalDestino");
    const form = document.getElementById("formDestino");
    form.reset();

    document.getElementById("nd-prodId").value = produto.id_apreend;
    document.getElementById("nd-prodInfo").innerHTML = `
        <p class="summary-title">Item selecionado:</p>
        <p class="summary-text"><strong>#${produto.id_apreend} - ${escaparHTML(produto.nome)}</strong> (${escaparHTML(produto.localizacao_atual || "Sem local")})</p>
    `;

    modal.classList.remove("hidden");
    document.getElementById("nd-funcao").focus();
}

function fecharModalDestino() {
    document.getElementById("modalDestino").classList.add("hidden");
    document.getElementById("formDestino").reset();
}

async function salvarDestinacao(evento) {
    evento.preventDefault();

    const botaoSalvar = document.querySelector("#formDestino button[type='submit']");

    const idApreend = parseInt(document.getElementById("nd-prodId").value, 10);
    const funcao = document.getElementById("nd-funcao").value.trim();
    const idAssociacaoDestino = parseInt(document.getElementById("nd-associacao").value, 10);
    const idResponsavel = parseInt(document.getElementById("nd-user").value, 10);

    if (!idApreend || !funcao || !idAssociacaoDestino || !idResponsavel) {
        await exibirAlerta({
            titulo: "Campos Obrigatórios",
            mensagem: "Preencha todos os campos da destinação.",
            tipo: "warning"
        });
        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
        const { error: erroInsert } = await clienteSupabase
            .from("prodapreend_destinacao")
            .insert([
                {
                    id_apreend: idApreend,
                    funcao,
                    id_associacao_destino: idAssociacaoDestino,
                    id_responsavel: idResponsavel
                }
            ]);

        if (erroInsert) {
            console.error("Erro ao registrar destinação:", erroInsert);
            await exibirAlerta({
                titulo: "Erro ao Registrar",
                mensagem: "Não foi possível registrar a destinação. Verifique as permissões no Supabase.",
                tipo: "danger"
            });
            return;
        }

        const { error: erroUpdate } = await clienteSupabase
            .from("prodapreend")
            .update({ status: "Destinado" })
            .eq("id_apreend", idApreend);

        if (erroUpdate) {
            console.error("Erro ao atualizar status do produto:", erroUpdate);
        }

        const produto = listaProdutos.find((p) => p.id_apreend === idApreend);
        const associacao = obterAssociacao(idAssociacaoDestino);
        const infoProd = produto ? `#${idApreend} (${produto.nome})` : `#${idApreend}`;
        const infoAssoc = associacao ? associacao.nome : `Associação #${idAssociacaoDestino}`;

        await registrarLog("DESTINAÇÕES", `Atribuiu destinação do item ${infoProd} para "${infoAssoc}".`);

        fecharModalDestino();
        await carregarDadosProdutos();

    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar Destinação";
    }
}

// =====================================================
// MODAL 2: VISUALIZAR DETALHES DO DESTINO
// =====================================================
function abrirModalViewDestino(idApreend) {
    const produto = listaProdutos.find((p) => p.id_apreend === idApreend);
    const destinacao = listaDestinacoes.find((d) => d.id_apreend === idApreend);
    const conteudo = document.getElementById("viewDestinoContent");

    if (!produto || !conteudo) return;

    const associacao = destinacao ? obterAssociacao(destinacao.id_associacao_destino) : null;
    const responsavel = destinacao ? obterUsuario(destinacao.id_responsavel) : null;

    const textoDestino = associacao
        ? `${associacao.nome}${associacao.local_operacao ? ` - ${associacao.local_operacao}` : ""}`
        : "Não informado";

    const textoResponsavel = responsavel
        ? `${responsavel.nome} (Nível ${String(responsavel.nivel_acesso || "-").trim()})`
        : "Não informado";

    const eRecebido = (produto.status || "").trim().toLowerCase() === "recebido";
    const badgeEntrega = eRecebido
        ? `<span class="badge-status status-recebido"><i data-lucide="check"></i> Confirmado / Recebido</span>`
        : `<span class="badge-status status-destinado">Aguardando Confirmação de Recebimento</span>`;

    conteudo.innerHTML = `
        <div class="history-item">
            <p class="history-label">Bem Apreendido</p>
            <p class="history-value">#${produto.id_apreend} - ${escaparHTML(produto.nome)}</p>
        </div>
        <div class="history-item">
            <p class="history-label">Função / Finalidade</p>
            <p class="history-value">${escaparHTML(destinacao?.funcao || "Não registrada")}</p>
        </div>
        <div class="history-item">
            <p class="history-label">Instituição / Local de Destino</p>
            <p class="history-value">${escaparHTML(textoDestino)}</p>
        </div>
        <div class="history-item">
            <p class="history-label">Custodiante Responsável</p>
            <p class="history-value">${escaparHTML(textoResponsavel)}</p>
        </div>
        <div class="history-item">
            <p class="history-label">Status da Entrega</p>
            ${badgeEntrega}
        </div>
    `;

    document.getElementById("modalViewDestino").classList.remove("hidden");
    lucide.createIcons();
}

function fecharModalViewDestino() {
    document.getElementById("modalViewDestino").classList.add("hidden");
}

// =====================================================
// INICIALIZAÇÃO DOS EVENTOS
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    carregarDadosProdutos();

    document.getElementById("search-produtos")?.addEventListener("input", filtrarProdutos);
    document.getElementById("btnRegistrarProduto")?.addEventListener("click", () => abrirModalProduto());
    document.getElementById("btnExportarPdf")?.addEventListener("click", exportarProdutosPDF);

    document.getElementById("np-lote")?.addEventListener("change", (evento) => {
        alternarCampoLote(evento.target.checked);
    });

    document.getElementById("nd-user")?.addEventListener("change", (evento) => {
        const idUser = parseInt(evento.target.value, 10);
        const usuario = obterUsuario(idUser);
        const selectAssoc = document.getElementById("nd-associacao");
        if (usuario && usuario.id_associacao && selectAssoc && !selectAssoc.value) {
            selectAssoc.value = usuario.id_associacao;
        }
    });

    document.getElementById("formProduto")?.addEventListener("submit", salvarProduto);
    document.getElementById("formDestino")?.addEventListener("submit", salvarDestinacao);

    document.querySelector("#modalProduto .btn-secondary")?.addEventListener("click", fecharModalProduto);
    document.querySelector("#modalProduto .close-modal-btn")?.addEventListener("click", fecharModalProduto);
    document.getElementById("modalProduto")?.addEventListener("click", (e) => {
        if (e.target.id === "modalProduto") fecharModalProduto();
    });

    document.querySelector("#modalViewDestino .btn-secondary")?.addEventListener("click", fecharModalViewDestino);
    document.querySelector("#modalViewDestino .close-modal-btn-dark")?.addEventListener("click", fecharModalViewDestino);
    document.getElementById("modalViewDestino")?.addEventListener("click", (e) => {
        if (e.target.id === "modalViewDestino") fecharModalViewDestino();
    });

    document.querySelector("#modalDestino .btn-secondary")?.addEventListener("click", fecharModalDestino);
    document.querySelector("#modalDestino .close-modal-btn")?.addEventListener("click", fecharModalDestino);
    document.getElementById("modalDestino")?.addEventListener("click", (e) => {
        if (e.target.id === "modalDestino") fecharModalDestino();
    });

    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            fecharModalProduto();
            fecharModalViewDestino();
            fecharModalDestino();
        }
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

// =====================================================
// EXPORTAÇÃO DE RELATÓRIO EM PDF (TODOS OS PRODUTOS)
// =====================================================
function exportarProdutosPDF() {
    if (!listaProdutos || listaProdutos.length === 0) {
        exibirAlerta({
            titulo: "Sem Registros",
            mensagem: "Não há produtos apreendidos cadastrados para gerar o PDF.",
            tipo: "warning"
        });
        return;
    }

    const produtosOrdenados = [...listaProdutos].sort((a, b) => a.id_apreend - b.id_apreend);

    const valorTotal = produtosOrdenados.reduce(
        (soma, item) => soma + Number(item.valor || 0),
        0
    );

    const dadosSessao = sessionStorage.getItem("sgap_usuario");
    const usuarioLogado = dadosSessao ? JSON.parse(dadosSessao) : null;
    const nomeEmissor = usuarioLogado?.nome || "Usuário do Sistema";
    const dataEmissao = new Date().toLocaleString("pt-BR");

    if (!window.jspdf || !window.jspdf.jsPDF) {
        exportarProdutosImpressaoFallback(produtosOrdenados, valorTotal, nomeEmissor, dataEmissao);
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 24, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SGAP - Sistema de Gestão e Aplicação de Produtos", 14, 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Relatório Geral de Produtos Apreendidos", 14, 17);

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    doc.text(
        `Emitido em: ${dataEmissao}   |   Responsável: ${nomeEmissor}   |   Total de itens: ${produtosOrdenados.length}   |   Valor total estimado: ${formatarMoedaBRL(valorTotal)}`,
        14,
        31
    );

    const linhas = produtosOrdenados.map((prod) => [
        `#${prod.id_apreend}`,
        prod.nome || "-",
        obterNomeCategoria(prod.id_categoria),
        prod.qtde_lote ? `${prod.qtde_lote} un` : "Unitário",
        formatarDataBR(prod.data_apren),
        prod.localizacao_atual || "-",
        prod.motivoapreend || "-",
        (prod.status || "Em Depósito").trim(),
        formatarMoedaBRL(prod.valor)
    ]);

    doc.autoTable({
        startY: 36,
        head: [[
            "ID",
            "Produto / Descrição",
            "Categoria",
            "Lote",
            "Apreensão",
            "Localização Atual",
            "Motivo",
            "Status",
            "Valor"
        ]],
        body: linhas,
        foot: [[
            "",
            `Total de registros: ${produtosOrdenados.length}`,
            "",
            "",
            "",
            "",
            "",
            "Valor Total:",
            formatarMoedaBRL(valorTotal)
        ]],
        styles: {
            fontSize: 8,
            cellPadding: 2.5,
            valign: "middle",
            textColor: [15, 23, 42]
        },
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: "bold"
        },
        footStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: "bold"
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { cellWidth: 14 },
            1: { cellWidth: 46 },
            2: { cellWidth: 28 },
            3: { cellWidth: 18 },
            4: { cellWidth: 22 },
            5: { cellWidth: 42 },
            6: { cellWidth: 48 },
            7: { cellWidth: 24 },
            8: { cellWidth: 27, halign: "right" }
        },
        didDrawPage: (dadosPagina) => {
            const totalPaginas = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(
                `Página ${dadosPagina.pageNumber} de ${totalPaginas}`,
                283,
                204,
                { align: "right" }
            );
        }
    });

    const dataArquivo = new Date().toISOString().split("T")[0];
    doc.save(`produtos-apreendidos-${dataArquivo}.pdf`);
}

function exportarProdutosImpressaoFallback(produtos, valorTotal, nomeEmissor, dataEmissao) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const linhasHTML = produtos
        .map(
            (prod) => `
            <tr>
                <td>#${prod.id_apreend}</td>
                <td>${escaparHTML(prod.nome)}</td>
                <td>${escaparHTML(obterNomeCategoria(prod.id_categoria))}</td>
                <td>${prod.qtde_lote ? `${prod.qtde_lote} un` : "Unitário"}</td>
                <td>${formatarDataBR(prod.data_apren)}</td>
                <td>${escaparHTML(prod.localizacao_atual || "-")}</td>
                <td>${escaparHTML(prod.motivoapreend || "-")}</td>
                <td>${escaparHTML((prod.status || "Em Depósito").trim())}</td>
                <td style="text-align:right;">${formatarMoedaBRL(prod.valor)}</td>
            </tr>
        `
        )
        .join("");

    const docPrint = iframe.contentWindow.document;
    docPrint.open();
    docPrint.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Produtos Apreendidos - SGAP</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 20px; }
                h1 { font-size: 16px; margin-bottom: 4px; }
                p { font-size: 11px; color: #475569; margin-bottom: 14px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
                th { background-color: #1e293b; color: #ffffff; }
                tr:nth-child(even) { background-color: #f8fafc; }
                tfoot td { font-weight: bold; background-color: #f1f5f9; }
            </style>
        </head>
        <body>
            <h1>SGAP - Relatório Geral de Produtos Apreendidos</h1>
            <p>Emitido em: ${dataEmissao} | Responsável: ${escaparHTML(nomeEmissor)} | Total: ${produtos.length} itens</p>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Produto</th>
                        <th>Categoria</th>
                        <th>Lote</th>
                        <th>Apreensão</th>
                        <th>Localização</th>
                        <th>Motivo</th>
                        <th>Status</th>
                        <th style="text-align:right;">Valor</th>
                    </tr>
                </thead>
                <tbody>${linhasHTML}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="8" style="text-align:right;">Valor Total Estimado:</td>
                        <td style="text-align:right;">${formatarMoedaBRL(valorTotal)}</td>
                    </tr>
                </tfoot>
            </table>
        </body>
        </html>
    `);
    docPrint.close();

    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
}
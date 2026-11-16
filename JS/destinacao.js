// =====================================================
// MONITORAMENTO E RECEBIMENTO DE DESTINAÇÕES (destinacao.js)
// =====================================================
let listaDestinacoes = [];
let listaProdutos = [];
let listaAssociacoes = [];
let listaUsuarios = [];
let listaConfirmacoes = [];
let urlImagemTemporaria = null;

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

function obterProduto(idApreend) {
    return listaProdutos.find((p) => p.id_apreend === idApreend) || null;
}

function obterAssociacao(idAssociacao) {
    return listaAssociacoes.find((a) => a.id_associacao === idAssociacao) || null;
}

function obterUsuario(idUsuario) {
    return listaUsuarios.find((u) => u.id_usuario === idUsuario) || null;
}

function obterConfirmacao(idDestinacao) {
    return listaConfirmacoes.find((c) => c.id_destinacao === idDestinacao) || null;
}

// =====================================================
// CONVERSÃO DE IMAGEM <-> BYTEA POSTGRESQL (\x...)
// =====================================================
function arquivoParaByteaHex(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => {
            const bytes = new Uint8Array(leitor.result);
            let hex = "\\x";
            for (let i = 0; i < bytes.length; i++) {
                hex += bytes[i].toString(16).padStart(2, "0");
            }
            resolve(hex);
        };
        leitor.onerror = () => reject(new Error("Falha ao ler o arquivo de imagem."));
        leitor.readAsArrayBuffer(arquivo);
    });
}

function byteaHexParaObjectUrl(valorBytea) {
    if (!valorBytea || typeof valorBytea !== "string") return null;

    if (valorBytea.startsWith("data:image")) {
        return valorBytea;
    }

    const hexLimpo = valorBytea.startsWith("\\x") ? valorBytea.slice(2) : valorBytea;
    if (hexLimpo.length < 2 || hexLimpo.length % 2 !== 0) return null;

    const bytes = new Uint8Array(hexLimpo.length / 2);
    for (let i = 0; i < hexLimpo.length; i += 2) {
        bytes[i / 2] = parseInt(hexLimpo.substring(i, i + 2), 16);
    }

    const blob = new Blob([bytes], { type: "image/jpeg" });
    return URL.createObjectURL(blob);
}

// =====================================================
// CARREGAMENTO DE DADOS DO SUPABASE
// =====================================================
async function carregarDadosDestinacoes() {
    const grid = document.getElementById("gridDestinacoes");
    if (!grid) return;

    grid.innerHTML = `<p>Carregando destinações...</p>`;

    const [resDestinacoes, resProdutos, resAssociacoes, resUsuarios, resConfirmacoes] = await Promise.all([
        clienteSupabase
            .from("prodapreend_destinacao")
            .select("id_destinacao, id_apreend, funcao, id_associacao_destino, id_responsavel")
            .order("id_destinacao", { ascending: false }),

        clienteSupabase
            .from("prodapreend")
            .select("id_apreend, nome, localizacao_atual, status, qtde_lote, valor"),

        clienteSupabase
            .from("associacoes")
            .select("id_associacao, nome, local_operacao")
            .order("nome", { ascending: true }),

        clienteSupabase
            .from("usuarios")
            .select("id_usuario, nome, id_associacao, bloqueado")
            .order("nome", { ascending: true }),

        clienteSupabase
            .from("destinacao_confir")
            .select("id_confir, id_destinacao, imgprova, observacao")
            .order("id_confir", { ascending: false })
    ]);

    if (resDestinacoes.error) {
        console.error("Erro ao carregar destinações:", resDestinacoes.error);
        grid.innerHTML = `<p>Erro ao carregar destinações do banco de dados.</p>`;
        return;
    }

    listaDestinacoes = resDestinacoes.data || [];
    listaProdutos = resProdutos.data || [];
    listaAssociacoes = resAssociacoes.data || [];
    listaUsuarios = resUsuarios.data || [];
    listaConfirmacoes = resConfirmacoes.data || [];

    preencherSelectsEdicao();
    filtrarDestinacoes();
}

function preencherSelectsEdicao() {
    const selectAssoc = document.getElementById("ed-associacao");
    if (selectAssoc) {
        const opcoesAssoc = listaAssociacoes
            .map((a) => `<option value="${a.id_associacao}">${escaparHTML(a.nome)}</option>`)
            .join("");
        selectAssoc.innerHTML = `<option value="">Selecione a instituição...</option>${opcoesAssoc}`;
    }

    const selectUser = document.getElementById("ed-user");
    if (selectUser) {
        const usuariosAtivos = listaUsuarios.filter((u) => !u.bloqueado);
        const opcoesUser = usuariosAtivos
            .map((u) => {
                const assoc = obterAssociacao(u.id_associacao);
                const sufixo = assoc ? ` (${assoc.nome})` : "";
                return `<option value="${u.id_usuario}">${escaparHTML(u.nome + sufixo)}</option>`;
            })
            .join("");
        selectUser.innerHTML = `<option value="">Selecione...</option>${opcoesUser}`;
    }
}

// =====================================================
// RENDERIZAÇÃO DOS CARDS E BUSCA EM TEMPO REAL
// =====================================================
function renderizarCardsDestinacoes(destinacoes) {
    const grid = document.getElementById("gridDestinacoes");
    const contador = document.getElementById("contadorDestinacoes");

    if (contador) {
        contador.textContent = `Total: ${destinacoes.length}`;
    }

    if (!grid) return;

    if (destinacoes.length === 0) {
        grid.innerHTML = `<p>Nenhuma destinação registrada no momento.</p>`;
        return;
    }

    grid.innerHTML = destinacoes
        .map((dest) => {
            const produto = obterProduto(dest.id_apreend);
            const associacao = obterAssociacao(dest.id_associacao_destino);
            const responsavel = obterUsuario(dest.id_responsavel);
            const confirmacao = obterConfirmacao(dest.id_destinacao);

            const statusProduto = (produto?.status || "").trim().toLowerCase();
            const foiRecebido = Boolean(confirmacao) || statusProduto === "recebido";

            const nomeProduto = produto ? produto.nome : `Produto #${dest.id_apreend}`;
            const localDestino = associacao?.local_operacao || produto?.localizacao_atual || "-";
            const nomeResponsavel = responsavel?.nome || "Não atribuído";
            const nomeAssociacao = associacao?.nome || "Não informada";

            if (foiRecebido) {
                return `
                    <div class="destinacao-card card-received">
                        <div class="card-body">
                            <div class="card-header-row">
                                <h3 class="destinacao-title">${escaparHTML(nomeProduto)}</h3>
                                <span class="badge-status status-received">
                                    <i data-lucide="check"></i> Recebido
                                </span>
                            </div>

                            <div class="purpose-box">
                                <p class="purpose-label">Finalidade Aplicada:</p>
                                <p class="purpose-text">"${escaparHTML(dest.funcao || "Sem finalidade informada")}"</p>
                            </div>

                            <div class="details-list">
                                <div class="detail-row">
                                    <i data-lucide="map-pin"></i>
                                    <span><strong>Local:</strong> ${escaparHTML(localDestino)}</span>
                                </div>
                                <div class="detail-row">
                                    <i data-lucide="user-check"></i>
                                    <span><strong>Custodiante:</strong> ${escaparHTML(nomeResponsavel)}</span>
                                </div>
                                <div class="detail-row">
                                    <i data-lucide="building"></i>
                                    <span><strong>Associação:</strong> ${escaparHTML(nomeAssociacao)}</span>
                                </div>
                            </div>
                        </div>

                        <div class="card-footer-row">
                            <button type="button" class="btn-link-full" onclick="abrirModalDetalhesRecebimento(${dest.id_destinacao})">
                                <i data-lucide="eye"></i> Detalhes do Recebimento (Bloqueado)
                            </button>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="destinacao-card card-in-transit">
                    <div class="card-body">
                        <div class="card-header-row">
                            <h3 class="destinacao-title">${escaparHTML(nomeProduto)}</h3>
                            <span class="badge-status status-transit">Em trânsito</span>
                        </div>

                        <div class="purpose-box">
                            <p class="purpose-label">Finalidade Aplicada:</p>
                            <p class="purpose-text">"${escaparHTML(dest.funcao || "Sem finalidade informada")}"</p>
                        </div>

                        <div class="details-list">
                            <div class="detail-row">
                                <i data-lucide="map-pin"></i>
                                <span><strong>Local:</strong> ${escaparHTML(localDestino)}</span>
                            </div>
                            <div class="detail-row">
                                <i data-lucide="user-check"></i>
                                <span><strong>Custodiante:</strong> ${escaparHTML(nomeResponsavel)}</span>
                            </div>
                            <div class="detail-row">
                                <i data-lucide="building"></i>
                                <span><strong>Associação:</strong> ${escaparHTML(nomeAssociacao)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="card-footer-row">
                        <button type="button" class="btn-success-light" onclick="abrirModalRecebimento(${dest.id_destinacao})">
                            <i data-lucide="thumbs-up"></i> Recebido 
                        </button>
                        <button type="button" class="btn-link-action" onclick="abrirModalEditarDestinacao(${dest.id_destinacao})">
                            <i data-lucide="edit-2"></i> Editar
                        </button>
                        <button type="button" class="btn-link-danger" onclick="revogarDestinacao(${dest.id_destinacao})">
                            <i data-lucide="trash-2"></i> Revogar
                        </button>
                    </div>
                </div>
            `;
        })
        .join("");

    lucide.createIcons();
}

function filtrarDestinacoes() {
    const campoBusca = document.getElementById("search-destinacao");
    const termo = (campoBusca?.value || "").trim().toLowerCase();

    if (!termo) {
        renderizarCardsDestinacoes(listaDestinacoes);
        return;
    }

    const filtradas = listaDestinacoes.filter((dest) => {
        const produto = obterProduto(dest.id_apreend);
        const associacao = obterAssociacao(dest.id_associacao_destino);
        const responsavel = obterUsuario(dest.id_responsavel);

        return [
            String(dest.id_destinacao),
            String(dest.id_apreend),
            produto?.nome,
            dest.funcao,
            associacao?.nome,
            associacao?.local_operacao,
            responsavel?.nome
        ].some((campo) => (campo || "").toLowerCase().includes(termo));
    });

    renderizarCardsDestinacoes(filtradas);
}

// =====================================================
// 1. EDITAR DESTINAÇÃO
// =====================================================
function abrirModalEditarDestinacao(idDestinacao) {
    const dest = listaDestinacoes.find((d) => d.id_destinacao === idDestinacao);
    if (!dest) return;

    if (obterConfirmacao(idDestinacao)) {
        alert("Esta destinação já teve o recebimento confirmado e não pode ser editada.");
        return;
    }

    const produto = obterProduto(dest.id_apreend);
    const nomeProduto = produto ? `#${produto.id_apreend} - ${produto.nome}` : `Produto #${dest.id_apreend}`;

    document.getElementById("ed-destinacaoId").value = dest.id_destinacao;
    document.getElementById("ed-prodInfo").innerHTML = `
        <p class="summary-title">Item em Trânsito:</p>
        <p class="summary-text"><strong>${escaparHTML(nomeProduto)}</strong></p>
    `;

    document.getElementById("ed-funcao").value = dest.funcao || "";
    document.getElementById("ed-associacao").value = dest.id_associacao_destino || "";
    document.getElementById("ed-user").value = dest.id_responsavel || "";

    document.getElementById("modalEditarDestinacao").classList.remove("hidden");
    document.getElementById("ed-funcao").focus();
}

function fecharModalEditarDestinacao() {
    document.getElementById("modalEditarDestinacao").classList.add("hidden");
    document.getElementById("formEditarDestinacao").reset();
}

async function salvarEdicaoDestinacao(evento) {
    evento.preventDefault();

    const botaoSalvar = document.querySelector("#formEditarDestinacao button[type='submit']");

    const idDestinacao = parseInt(document.getElementById("ed-destinacaoId").value, 10);
    const funcao = document.getElementById("ed-funcao").value.trim();
    const idAssociacaoDestino = parseInt(document.getElementById("ed-associacao").value, 10);
    const idResponsavel = parseInt(document.getElementById("ed-user").value, 10);

    if (!idDestinacao || !funcao || !idAssociacaoDestino || !idResponsavel) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
        const { error: erro } = await clienteSupabase
            .from("prodapreend_destinacao")
            .update({
                funcao,
                id_associacao_destino: idAssociacaoDestino,
                id_responsavel: idResponsavel
            })
            .eq("id_destinacao", idDestinacao);

        if (erro) {
            console.error("Erro ao editar destinação:", erro);
            alert("Não foi possível atualizar a destinação. Verifique as permissões no Supabase.");
            return;
        }

        const dest = listaDestinacoes.find((d) => d.id_destinacao === idDestinacao);
        const produto = dest ? obterProduto(dest.id_apreend) : null;
        const associacao = obterAssociacao(idAssociacaoDestino);
        const infoBem = produto ? ` (${produto.nome})` : "";
        const infoAssoc = associacao ? ` para "${associacao.nome}"` : "";

        await registrarLog("DESTINAÇÕES", `Editou a destinação #${idDestinacao}${infoBem}${infoAssoc}.`);

        fecharModalEditarDestinacao();
        await carregarDadosDestinacoes();

    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar Alterações";
    }
}

// =====================================================
// 2. REVOGAR DESTINAÇÃO
// =====================================================
async function revogarDestinacao(idDestinacao) {
    const dest = listaDestinacoes.find((d) => d.id_destinacao === idDestinacao);
    if (!dest) return;

    if (obterConfirmacao(idDestinacao)) {
        alert("Não é possível revogar uma destinação que já foi confirmada como recebida.");
        return;
    }

    const produto = obterProduto(dest.id_apreend);
    const nomeProduto = produto ? produto.nome : `Produto #${dest.id_apreend}`;

    const confirmou = await confirmarAcao({
        titulo: "Revogar Destinação",
        mensagem: `Deseja realmente revogar a destinação de "${nomeProduto}"?`,
        detalhe: 'O vínculo de envio será cancelado e o bem voltará para o status "Em Depósito".',
        textoConfirmar: "Sim, revogar",
        textoCancelar: "Manter destinação",
        tipo: "warning"
    });
    if (!confirmou) return;

    // 1. Remove o registro da destinação
    const { error: erroDelete } = await clienteSupabase
        .from("prodapreend_destinacao")
        .delete()
        .eq("id_destinacao", idDestinacao);

    if (erroDelete) {
        console.error("Erro ao revogar destinação:", erroDelete);
        alert("Não foi possível revogar a destinação. Verifique as permissões no Supabase.");
        return;
    }

    // 2. Retorna o status do produto para 'Em Depósito'
    const { error: erroUpdate } = await clienteSupabase
        .from("prodapreend")
        .update({ status: "Em Depósito" })
        .eq("id_apreend", dest.id_apreend);

    if (erroUpdate) {
        console.error("Erro ao retornar status do produto:", erroUpdate);
    }

    await registrarLog("DESTINAÇÕES", `Revogou a destinação #${idDestinacao} do bem #${dest.id_apreend} (${nomeProduto}).`);
    await carregarDadosDestinacoes();
}

// =====================================================
// 3. RECEBIMENTO DAS DESTINAÇÕES (Destinacao_confir)
// =====================================================
function limparPreviewImagem() {
    const preview = document.getElementById("nr-preview");
    const uploadContent = document.querySelector("#modalRecebimento .upload-content");

    if (preview) {
        preview.removeAttribute("src");
        preview.classList.add("hidden");
        preview.style.display = "none";
    }
    if (uploadContent) {
        uploadContent.classList.remove("hidden");
        uploadContent.style.display = "";
    }
}

function abrirModalRecebimento(idDestinacao) {
    const dest = listaDestinacoes.find((d) => d.id_destinacao === idDestinacao);
    if (!dest) return;

    const produto = obterProduto(dest.id_apreend);
    const nomeProduto = produto ? `#${produto.id_apreend} - ${produto.nome}` : `Produto #${dest.id_apreend}`;

    const form = document.getElementById("formRecebimento");
    const inputImagem = document.getElementById("nr-imagem");

    form.reset();
    if (inputImagem) {
        inputImagem.value = "";
        inputImagem.removeAttribute("required");
    }
    limparPreviewImagem();

    document.getElementById("nr-destinacaoId").value = dest.id_destinacao;
    document.getElementById("nr-prodInfo").innerHTML = `
        <p class="summary-title">Confirmação de Entrega:</p>
        <p class="summary-text"><strong>${escaparHTML(nomeProduto)}</strong></p>
    `;

    document.getElementById("modalRecebimento").classList.remove("hidden");
}

function fecharModalRecebimento() {
    const inputImagem = document.getElementById("nr-imagem");
    document.getElementById("modalRecebimento").classList.add("hidden");
    document.getElementById("formRecebimento").reset();
    if (inputImagem) inputImagem.value = "";
    limparPreviewImagem();
}

function preVisualizarComprovante(evento) {
    const arquivo = evento.target.files?.[0];
    const preview = document.getElementById("nr-preview");
    const uploadContent = document.querySelector("#modalRecebimento .upload-content");

    if (!arquivo) {
        limparPreviewImagem();
        return;
    }

    if (!arquivo.type.startsWith("image/")) {
        alert("Selecione um ficheiro de imagem válido (PNG, JPG ou GIF).");
        evento.target.value = "";
        limparPreviewImagem();
        return;
    }

    const tamanhoMaximoBytes = 5 * 1024 * 1024; // 5MB
    if (arquivo.size > tamanhoMaximoBytes) {
        alert("A imagem selecionada ultrapassa o limite de 5MB.");
        evento.target.value = "";
        limparPreviewImagem();
        return;
    }

    const leitor = new FileReader();
    leitor.onload = (e) => {
        if (preview) {
            preview.src = e.target.result;
            preview.classList.remove("hidden");
            preview.style.display = "block";
        }
        if (uploadContent) {
            uploadContent.classList.add("hidden");
        }
    };
    leitor.readAsDataURL(arquivo);
}

// Redimensiona e comprime a imagem antes de converter para BYTEA (\x...)
function imagemComprimidaParaByteaHex(arquivo, larguraMax = 1280, qualidade = 0.8) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = (evento) => {
            const img = new Image();
            img.onload = () => {
                let largura = img.width;
                let altura = img.height;

                if (largura > larguraMax) {
                    altura = Math.round((altura * larguraMax) / largura);
                    largura = larguraMax;
                }

                const canvas = document.createElement("canvas");
                canvas.width = largura;
                canvas.height = altura;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, largura, altura);

                canvas.toBlob(
                    async (blob) => {
                        if (!blob) {
                            reject(new Error("Falha ao processar a imagem."));
                            return;
                        }
                        const buffer = await blob.arrayBuffer();
                        const bytes = new Uint8Array(buffer);
                        let hex = "\\x";
                        for (let i = 0; i < bytes.length; i++) {
                            hex += bytes[i].toString(16).padStart(2, "0");
                        }
                        resolve(hex);
                    },
                    "image/jpeg",
                    qualidade
                );
            };
            img.onerror = () => reject(new Error("Ficheiro de imagem inválido."));
            img.src = evento.target.result;
        };
        leitor.onerror = () => reject(new Error("Erro ao ler o ficheiro."));
        leitor.readAsDataURL(arquivo);
    });
}

async function confirmarRecebimento(evento) {
    evento.preventDefault();

    const botaoConfirmar = document.querySelector("#formRecebimento button[type='submit']");
    const idDestinacao = parseInt(document.getElementById("nr-destinacaoId").value, 10);
    const inputImagem = document.getElementById("nr-imagem");
    const arquivo = inputImagem?.files?.[0];
    const observacao = document.getElementById("nr-obs").value.trim();

    if (!idDestinacao) return;

    if (!arquivo) {
        alert("Por favor, anexe uma foto comprovando o recebimento antes de confirmar.");
        inputImagem?.click();
        return;
    }

    const dest = listaDestinacoes.find((d) => d.id_destinacao === idDestinacao);
    if (!dest) return;

    botaoConfirmar.disabled = true;
    botaoConfirmar.textContent = "Registrando...";

    try {
        const imgByteaHex = await imagemComprimidaParaByteaHex(arquivo);

        const { error: erroInsert } = await clienteSupabase
            .from("destinacao_confir")
            .insert([
                {
                    id_destinacao: idDestinacao,
                    imgprova: imgByteaHex,
                    observacao: observacao || null
                }
            ]);

        if (erroInsert) {
            console.error("Erro ao confirmar recebimento:", erroInsert);
            alert("Não foi possível gravar o recebimento. Verifique as permissões RLS da tabela destinacao_confir no Supabase.");
            return;
        }

        const associacaoDestino = obterAssociacao(dest.id_associacao_destino);
        const dadosAtualizacaoProduto = { status: "Recebido" };
        if (associacaoDestino?.local_operacao) {
            dadosAtualizacaoProduto.localizacao_atual = associacaoDestino.local_operacao;
        }

        const { error: erroUpdate } = await clienteSupabase
            .from("prodapreend")
            .update(dadosAtualizacaoProduto)
            .eq("id_apreend", dest.id_apreend);

        if (erroUpdate) {
            console.error("Erro ao atualizar status do produto:", erroUpdate);
        }

        const produto = obterProduto(dest.id_apreend);
        const infoBem = produto ? `#${produto.id_apreend} (${produto.nome})` : `#${dest.id_apreend}`;
        await registrarLog("DESTINAÇÕES", `Confirmou o recebimento da destinação #${idDestinacao} - bem ${infoBem}.`);

        fecharModalRecebimento();
        await carregarDadosDestinacoes();

    } catch (erro) {
        console.error("Erro ao processar comprovante:", erro);
        alert("Falha ao processar o ficheiro de imagem.");
    } finally {
        botaoConfirmar.disabled = false;
        botaoConfirmar.innerHTML = `<i data-lucide="check-circle"></i> Confirmar Recebimento`;
        lucide.createIcons();
    }
}

// =====================================================
// 4. VISUALIZAR DETALHES DO RECEBIMENTO (BLOQUEADO)
// =====================================================
function abrirModalDetalhesRecebimento(idDestinacao) {
    const dest = listaDestinacoes.find((d) => d.id_destinacao === idDestinacao);
    const confir = obterConfirmacao(idDestinacao);
    const corpoModal = document.getElementById("detalhesRecebimentoBody");

    if (!dest || !corpoModal) return;

    if (urlImagemTemporaria) {
        URL.revokeObjectURL(urlImagemTemporaria);
        urlImagemTemporaria = null;
    }

    const produto = obterProduto(dest.id_apreend);
    const associacao = obterAssociacao(dest.id_associacao_destino);
    const responsavel = obterUsuario(dest.id_responsavel);

    const nomeProduto = produto ? `#${produto.id_apreend} - ${produto.nome}` : `Produto #${dest.id_apreend}`;
    urlImagemTemporaria = confir?.imgprova ? byteaHexParaObjectUrl(confir.imgprova) : null;

    const imagemHTML = urlImagemTemporaria
        ? `<img src="${urlImagemTemporaria}" alt="Comprovante de recebimento" style="width:100%; max-height:240px; object-fit:contain; border-radius:8px; border:1px solid #cbd5e1; background:#f8fafc;">`
        : `<p class="summary-text">Nenhuma imagem de comprovante armazenada.</p>`;

    corpoModal.innerHTML = `
        <div class="summary-box">
            <p class="summary-title">Bem Recebido (Registro Bloqueado):</p>
            <p class="summary-text"><strong>${escaparHTML(nomeProduto)}</strong></p>
            <p class="summary-text">Destino: ${escaparHTML(associacao?.nome || "-")} | Custodiante: ${escaparHTML(responsavel?.nome || "-")}</p>
        </div>

        <div class="form-group">
            <label class="form-label">Comprovante Fotográfico</label>
            ${imagemHTML}
        </div>

        <div class="form-group">
            <label class="form-label">Observações do Recebedor</label>
            <p class="summary-text">${escaparHTML(confir?.observacao || "Nenhuma observação registrada.")}</p>
        </div>
    `;

    document.getElementById("modalDetalhesRecebimento").classList.remove("hidden");
}

function fecharModalDetalhesRecebimento() {
    document.getElementById("modalDetalhesRecebimento").classList.add("hidden");
    if (urlImagemTemporaria) {
        URL.revokeObjectURL(urlImagemTemporaria);
        urlImagemTemporaria = null;
    }
}

function formatarMoedaBRL(valor) {
    const numero = Number(valor || 0);
    return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// =====================================================
// EXPORTAÇÃO DE RELATÓRIO EM PDF (DESTINAÇÕES ATIVAS)
// =====================================================
function exportarDestinacoesPDF() {
    if (!listaDestinacoes || listaDestinacoes.length === 0) {
        alert("Não há destinações registradas para gerar o PDF.");
        return;
    }

    // Ordena por ID crescente para o relatório
    const destinacoesOrdenadas = [...listaDestinacoes].sort(
        (a, b) => a.id_destinacao - b.id_destinacao
    );

    let totalRecebidas = 0;
    let totalEmTransito = 0;
    let valorTotal = 0;

    const registrosPreparados = destinacoesOrdenadas.map((dest) => {
        const produto = obterProduto(dest.id_apreend);
        const associacao = obterAssociacao(dest.id_associacao_destino);
        const responsavel = obterUsuario(dest.id_responsavel);

        const foiRecebido =
            Boolean(obterConfirmacao(dest.id_destinacao)) ||
            (produto?.status || "").trim().toLowerCase() === "recebido";

        if (foiRecebido) {
            totalRecebidas++;
        } else {
            totalEmTransito++;
        }

        const valorItem = Number(produto?.valor || 0);
        valorTotal += valorItem;

        return {
            id: `#${dest.id_destinacao}`,
            bem: produto ? `#${produto.id_apreend} - ${produto.nome}` : `Produto #${dest.id_apreend}`,
            finalidade: dest.funcao || "-",
            associacao: associacao?.nome || "-",
            localidade: associacao?.local_operacao || produto?.localizacao_atual || "-",
            custodiante: responsavel?.nome || "-",
            status: foiRecebido ? "Recebido" : "Em trânsito",
            valorFormatado: formatarMoedaBRL(valorItem)
        };
    });

    const dadosSessao = sessionStorage.getItem("sgap_usuario");
    const usuarioLogado = dadosSessao ? JSON.parse(dadosSessao) : null;
    const nomeEmissor = usuarioLogado?.nome || "Usuário do Sistema";
    const dataEmissao = new Date().toLocaleString("pt-BR");

    // Fallback caso a biblioteca jsPDF não tenha carregado por falta de internet
    if (!window.jspdf || !window.jspdf.jsPDF) {
        exportarDestinacoesImpressaoFallback(
            registrosPreparados,
            totalEmTransito,
            totalRecebidas,
            valorTotal,
            nomeEmissor,
            dataEmissao
        );
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Cabeçalho do documento (idêntico ao de Produtos Apreendidos)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 24, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SGAP - Sistema de Gestão e Aplicação de Produtos", 14, 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Relatório Geral de Destinações Ativas", 14, 17);

    // Resumo de emissão
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    doc.text(
        `Emitido em: ${dataEmissao}   |   Responsável: ${nomeEmissor}   |   Total: ${registrosPreparados.length} (${totalEmTransito} em trânsito, ${totalRecebidas} recebidas)   |   Valor total estimado: ${formatarMoedaBRL(valorTotal)}`,
        14,
        31
    );

    // Linhas da tabela
    const linhas = registrosPreparados.map((item) => [
        item.id,
        item.bem,
        item.finalidade,
        item.associacao,
        item.localidade,
        item.custodiante,
        item.status,
        item.valorFormatado
    ]);

    doc.autoTable({
        startY: 36,
        head: [[
            "ID",
            "Bem Destinado",
            "Finalidade",
            "Associação / Órgão",
            "Localidade",
            "Custodiante",
            "Status",
            "Valor"
        ]],
        body: linhas,
        foot: [[
            "",
            `Total de destinações: ${registrosPreparados.length}`,
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
            1: { cellWidth: 48 },
            2: { cellWidth: 52 },
            3: { cellWidth: 42 },
            4: { cellWidth: 34 },
            5: { cellWidth: 32 },
            6: { cellWidth: 22 },
            7: { cellWidth: 25, halign: "right" }
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
    doc.save(`destinacoes-ativas-${dataArquivo}.pdf`);
}

function exportarDestinacoesImpressaoFallback(
    registros,
    totalEmTransito,
    totalRecebidas,
    valorTotal,
    nomeEmissor,
    dataEmissao
) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const linhasHTML = registros
        .map(
            (item) => `
            <tr>
                <td>${escaparHTML(item.id)}</td>
                <td>${escaparHTML(item.bem)}</td>
                <td>${escaparHTML(item.finalidade)}</td>
                <td>${escaparHTML(item.associacao)}</td>
                <td>${escaparHTML(item.localidade)}</td>
                <td>${escaparHTML(item.custodiante)}</td>
                <td>${escaparHTML(item.status)}</td>
                <td style="text-align:right;">${escaparHTML(item.valorFormatado)}</td>
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
            <title>Relatório Geral de Destinações Ativas - SGAP</title>
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
            <h1>SGAP - Relatório Geral de Destinações Ativas</h1>
            <p>Emitido em: ${dataEmissao} | Responsável: ${escaparHTML(nomeEmissor)} | Total: ${registros.length} (${totalEmTransito} em trânsito, ${totalRecebidas} recebidas)</p>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Bem Destinado</th>
                        <th>Finalidade</th>
                        <th>Associação / Órgão</th>
                        <th>Localidade</th>
                        <th>Custodiante</th>
                        <th>Status</th>
                        <th style="text-align:right;">Valor</th>
                    </tr>
                </thead>
                <tbody>${linhasHTML}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="7" style="text-align:right;">Valor Total Estimado:</td>
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

// =====================================================
// INICIALIZAÇÃO DOS EVENTOS
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    carregarDadosDestinacoes();

    // Busca e PDF
    document.getElementById("search-destinacao")?.addEventListener("input", filtrarDestinacoes);
    document.getElementById("btnExportarPdfDestinacoes")?.addEventListener("click", exportarDestinacoesPDF);

    // Modal 1: Recebimento
    document.getElementById("nr-imagem")?.addEventListener("change", preVisualizarComprovante);
    document.getElementById("formRecebimento")?.addEventListener("submit", confirmarRecebimento);
    document.querySelector("#modalRecebimento .btn-secondary")?.addEventListener("click", fecharModalRecebimento);
    document.querySelector("#modalRecebimento .close-modal-btn")?.addEventListener("click", fecharModalRecebimento);
    document.getElementById("modalRecebimento")?.addEventListener("click", (e) => {
        if (e.target.id === "modalRecebimento") fecharModalRecebimento();
    });

    // Modal 2: Editar Destinação
    document.getElementById("formEditarDestinacao")?.addEventListener("submit", salvarEdicaoDestinacao);
    document.querySelector("#modalEditarDestinacao .btn-secondary")?.addEventListener("click", fecharModalEditarDestinacao);
    document.querySelector("#modalEditarDestinacao .close-modal-btn")?.addEventListener("click", fecharModalEditarDestinacao);
    document.getElementById("modalEditarDestinacao")?.addEventListener("click", (e) => {
        if (e.target.id === "modalEditarDestinacao") fecharModalEditarDestinacao();
    });

    // Modal 3: Detalhes do Recebimento
    document.querySelector("#modalDetalhesRecebimento .btn-secondary")?.addEventListener("click", fecharModalDetalhesRecebimento);
    document.querySelector("#modalDetalhesRecebimento .close-modal-btn")?.addEventListener("click", fecharModalDetalhesRecebimento);
    document.getElementById("modalDetalhesRecebimento")?.addEventListener("click", (e) => {
        if (e.target.id === "modalDetalhesRecebimento") fecharModalDetalhesRecebimento();
    });

    // Tecla ESC fecha os modais
    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            fecharModalRecebimento();
            fecharModalEditarDestinacao();
            fecharModalDetalhesRecebimento();
        }
    });

    // Controle do menu lateral no mobile
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

    const dropzone = document.querySelector("#modalRecebimento .upload-dropzone");
    const inputImagem = document.getElementById("nr-imagem");

    dropzone?.addEventListener("click", (evento) => {
        if (evento.target !== inputImagem && !evento.target.closest("label[for='nr-imagem']")) {
            inputImagem?.click();
        }
    });
});
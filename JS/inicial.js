// =====================================================
// CARREGAMENTO DO DASHBOARD (inicial.js)
// =====================================================
function descreverNivelAcesso(nivel) {
    const nivelLimpo = String(nivel || "").trim();
    const mapaNiveis = {
        "1": "Administrador (Nível 1)",
        "2": "Gestor (Nível 2)",
    };
    return mapaNiveis[nivelLimpo] || `Nível ${nivelLimpo || "-"}`;
}

function preencherBoasVindas(usuario) {
    const campoNome = document.getElementById("boasVindasNome");
    const campoNivel = document.getElementById("boasVindasNivel");

    if (campoNome) campoNome.textContent = usuario.nome;
    if (campoNivel) campoNivel.textContent = descreverNivelAcesso(usuario.nivel_acesso);
}

async function carregarMetricasDashboard() {
    const elTotalProdutos = document.getElementById("totalProdutos");
    const elProdutosDestinados = document.getElementById("produtosDestinados");
    const elDestinacoesRecebidas = document.getElementById("destinacoesRecebidas");

    try {
        // Executa as 3 contagens simultaneamente usando head: true (retorna só o total, sem baixar linhas)
        const [resProdutos, resDestinados, resRecebidas] = await Promise.all([
            clienteSupabase
                .from("prodapreend")
                .select("*", { count: "exact", head: true }),

            clienteSupabase
                .from("prodapreend_destinacao")
                .select("*", { count: "exact", head: true }),

            clienteSupabase
                .from("destinacao_confir")
                .select("*", { count: "exact", head: true })
        ]);

        if (resProdutos.error) console.error("Erro em prodapreend:", resProdutos.error);
        if (resDestinados.error) console.error("Erro em prodapreend_destinacao:", resDestinados.error);
        if (resRecebidas.error) console.error("Erro em destinacao_confir:", resRecebidas.error);

        if (elTotalProdutos) elTotalProdutos.textContent = resProdutos.count ?? 0;
        if (elProdutosDestinados) elProdutosDestinados.textContent = resDestinados.count ?? 0;
        if (elDestinacoesRecebidas) elDestinacoesRecebidas.textContent = resRecebidas.count ?? 0;

    } catch (erro) {
        console.error("Erro ao carregar métricas do dashboard:", erro);
        if (elTotalProdutos) elTotalProdutos.textContent = "0";
        if (elProdutosDestinados) elProdutosDestinados.textContent = "0";
        if (elDestinacoesRecebidas) elDestinacoesRecebidas.textContent = "0";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const dadosSalvos = sessionStorage.getItem("sgap_usuario");
    if (!dadosSalvos) return;

    const usuario = JSON.parse(dadosSalvos);
    preencherBoasVindas(usuario);
    carregarMetricasDashboard();
});
// AUDITORIA E VISUALIZAÇÃO DE LOGS (log.js)
// =====================================================
let listaLogs = [];
let listaUsuarios = [];

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

function obterNomeUsuario(idUsuario) {
    const usuario = listaUsuarios.find((u) => u.id_usuario === idUsuario);
    return usuario ? usuario.nome : `Usuário #${idUsuario}`;
}

function formatarDataHoraBR(valorTimestamp) {
    if (!valorTimestamp) return "-";

    const data = new Date(valorTimestamp);
    if (Number.isNaN(data.getTime())) return String(valorTimestamp);

    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, "0");
    const minuto = String(data.getMinutes()).padStart(2, "0");
    const segundo = String(data.getSeconds()).padStart(2, "0");

    return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
}

// =====================================================
// CARREGAMENTO DE LOGS E USUÁRIOS DO SUPABASE
// =====================================================
async function carregarLogsAuditoria() {
    const corpoTabela = document.querySelector(".data-table tbody");
    if (!corpoTabela) return;

    corpoTabela.innerHTML = `<tr><td colspan="4">Carregando registros de auditoria...</td></tr>`;

    const [resLogs, resUsuarios] = await Promise.all([
        clienteSupabase
            .from("logatividade")
            .select("id_log, data_atividade, modulo_atividade, descricao, id_usuario")
            .order("data_atividade", { ascending: false })
            .order("id_log", { ascending: false }),

        clienteSupabase
            .from("usuarios")
            .select("id_usuario, nome")
    ]);

    if (resLogs.error) {
        console.error("Erro ao carregar logs de atividade:", resLogs.error);
        corpoTabela.innerHTML = `<tr><td colspan="4">Erro ao carregar registros do banco de dados.</td></tr>`;
        return;
    }

    if (resUsuarios.error) {
        console.error("Erro ao carregar usuários dos logs:", resUsuarios.error);
    }

    listaLogs = resLogs.data || [];
    listaUsuarios = resUsuarios.data || [];

    filtrarLogs();
}

function renderizarTabelaLogs(logs) {
    const corpoTabela = document.querySelector(".data-table tbody");
    if (!corpoTabela) return;

    if (logs.length === 0) {
        corpoTabela.innerHTML = `<tr><td colspan="4">Nenhum registro de atividade encontrado.</td></tr>`;
        return;
    }

    corpoTabela.innerHTML = logs
        .map((log) => {
            const dataFormatada = formatarDataHoraBR(log.data_atividade);
            const nomeUsuario = obterNomeUsuario(log.id_usuario);
            const modulo = (log.modulo_atividade || "SISTEMA").trim().toUpperCase();

            return `
                <tr>
                    <td class="log-timestamp">${escaparHTML(dataFormatada)}</td>
                    <td class="log-user">${escaparHTML(nomeUsuario)}</td>
                    <td>
                        <span class="module-badge">${escaparHTML(modulo)}</span>
                    </td>
                    <td class="log-action">${escaparHTML(log.descricao || "-")}</td>
                </tr>
            `;
        })
        .join("");
}

function filtrarLogs() {
    const campoBusca = document.getElementById("search-auditoria");
    const termo = (campoBusca?.value || "").trim().toLowerCase();

    if (!termo) {
        renderizarTabelaLogs(listaLogs);
        return;
    }

    const filtrados = listaLogs.filter((log) => {
        const dataFormatada = formatarDataHoraBR(log.data_atividade);
        const nomeUsuario = obterNomeUsuario(log.id_usuario);

        return [
            String(log.id_log),
            dataFormatada,
            nomeUsuario,
            log.modulo_atividade,
            log.descricao
        ].some((campo) => (campo || "").toLowerCase().includes(termo));
    });

    renderizarTabelaLogs(filtrados);
}

// =====================================================
// EXPORTAÇÃO DOS LOGS EM PDF
// =====================================================
function exportarLogsPDF() {
    if (!listaLogs || listaLogs.length === 0) {
        alert("Não há registros de auditoria para exportar.");
        return;
    }

    const usuarioLogado = obterUsuarioLogado();
    const nomeEmissor = usuarioLogado?.nome || "Usuário do Sistema";
    const dataEmissao = new Date().toLocaleString("pt-BR");

    const registrosPreparados = listaLogs.map((log) => ({
        id: `#${log.id_log}`,
        dataHora: formatarDataHoraBR(log.data_atividade),
        usuario: obterNomeUsuario(log.id_usuario),
        modulo: (log.modulo_atividade || "SISTEMA").trim().toUpperCase(),
        descricao: log.descricao || "-"
    }));

    if (!window.jspdf || !window.jspdf.jsPDF) {
        exportarLogsImpressaoFallback(registrosPreparados, nomeEmissor, dataEmissao);
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Cabeçalho institucional
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 24, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SGAP - Sistema de Gestão e Aplicação de Produtos", 14, 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Relatório de Auditoria de Acesso e Operações", 14, 17);

    // Resumo da emissão
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    doc.text(
        `Emitido em: ${dataEmissao}   |   Responsável: ${nomeEmissor}   |   Total de eventos auditados: ${registrosPreparados.length}`,
        14,
        31
    );

    const linhas = registrosPreparados.map((item) => [
        item.id,
        item.dataHora,
        item.usuario,
        item.modulo,
        item.descricao
    ]);

    doc.autoTable({
        startY: 36,
        head: [["ID", "Data / Hora", "Usuário", "Módulo", "Ação / Detalhes"]],
        body: linhas,
        foot: [[
            "",
            "",
            "",
            "Total de registros:",
            `${registrosPreparados.length} eventos`
        ]],
        styles: {
            fontSize: 8.5,
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
            0: { cellWidth: 16 },
            1: { cellWidth: 38 },
            2: { cellWidth: 48 },
            3: { cellWidth: 32 },
            4: { cellWidth: 135 }
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
    doc.save(`auditoria-logs-sgap-${dataArquivo}.pdf`);
}

function exportarLogsImpressaoFallback(registros, nomeEmissor, dataEmissao) {
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
                <td>${escaparHTML(item.dataHora)}</td>
                <td>${escaparHTML(item.usuario)}</td>
                <td>${escaparHTML(item.modulo)}</td>
                <td>${escaparHTML(item.descricao)}</td>
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
            <title>Relatório de Auditoria - SGAP</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 20px; }
                h1 { font-size: 16px; margin-bottom: 4px; }
                p { font-size: 11px; color: #475569; margin-bottom: 14px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
                th { background-color: #1e293b; color: #ffffff; }
                tr:nth-child(even) { background-color: #f8fafc; }
            </style>
        </head>
        <body>
            <h1>SGAP - Relatório de Auditoria de Acesso e Operações</h1>
            <p>Emitido em: ${dataEmissao} | Responsável: ${escaparHTML(nomeEmissor)} | Total: ${registros.length} eventos</p>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Data / Hora</th>
                        <th>Usuário</th>
                        <th>Módulo</th>
                        <th>Ação / Detalhes</th>
                    </tr>
                </thead>
                <tbody>${linhasHTML}</tbody>
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
    if (!exigirNivelAdministrador()) return;
    carregarLogsAuditoria();

    document.getElementById("search-auditoria")?.addEventListener("input", filtrarLogs);
    document.querySelector(".btn-export")?.addEventListener("click", exportarLogsPDF);

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
});
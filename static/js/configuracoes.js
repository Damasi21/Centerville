// ============================================================
// Configuracoes
// Navegacao por duplo clique nas tabelas de apoio.
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    // ------------------------------------------------------------
    // Segmentacao
    // ------------------------------------------------------------
    document.querySelectorAll(".linha-segmentacao").forEach(linha => {
        linha.addEventListener("dblclick", () => {
            window.location.href = `/configuracoes/segmentacao/${linha.dataset.id}/editar/`;
        });
    });

    // ------------------------------------------------------------
    // Origem de cliente
    // ------------------------------------------------------------
    document.querySelectorAll(".linha-origem").forEach(linha => {
        linha.addEventListener("dblclick", () => {
            window.location.href = `/configuracoes/origem/${linha.dataset.id}/editar/`;
        });
    });

    // ------------------------------------------------------------
    // Atividades
    // ------------------------------------------------------------
    document.querySelectorAll(".linha-atividade").forEach(linha => {
        linha.addEventListener("dblclick", () => {
            window.location.href = `/configuracoes/atividades/${linha.dataset.id}/editar/`;
        });
    });

    // ------------------------------------------------------------
    // Tipos de atividade
    // ------------------------------------------------------------
    document.querySelectorAll(".linha-tipo-categoria-atividade").forEach(linha => {
        linha.addEventListener("dblclick", () => {
            window.location.href = `/configuracoes/tipos-atividade/${linha.dataset.id}/editar/`;
        });
    });

    // ------------------------------------------------------------
    // Usuarios
    // ------------------------------------------------------------
    document.querySelectorAll(".linha-usuario").forEach(linha => {
        linha.addEventListener("dblclick", () => {
            window.location.href = `/configuracoes/usuarios/${linha.dataset.id}/editar/`;
        });
    });
});

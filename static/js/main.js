// ============================================================
// Main
// Comportamentos globais compartilhados pelo sistema.
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("JS Centerville carregado com sucesso.");

    // ------------------------------------------------------------
    // Cards com destaque no hover
    // ------------------------------------------------------------
    const cards = document.querySelectorAll(".hover-card");
    cards.forEach(card => {
        card.addEventListener("mouseenter", () => card.classList.add("shadow-lg"));
        card.addEventListener("mouseleave", () => card.classList.remove("shadow-lg"));
    });

    // ------------------------------------------------------------
    // Mensagens Django exibidas em modais Bootstrap
    // ------------------------------------------------------------
    const dataTag = document.getElementById("modal-messages-data");
    if (!dataTag) return;

    const data = JSON.parse(dataTag.textContent);
    data.messages.forEach(msg => {
        if (msg.text === "cliente_excluido") {
            new bootstrap.Modal(document.getElementById("clienteExcluidoModal")).show();
            return;
        }

        if (msg.tag === "success") {
            new bootstrap.Modal(document.getElementById("salvoSucessoModal")).show();
            return;
        }

        if (msg.tag === "error") {
            document.getElementById("erroSalvarTexto").textContent = msg.text;
            new bootstrap.Modal(document.getElementById("erroSalvarModal")).show();
        }
    });
});

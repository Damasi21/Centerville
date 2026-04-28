// static/js/main.js

document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ JS Centerville carregado com sucesso!");

    // Efeito de destaque nos cards da home
    const cards = document.querySelectorAll('.hover-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => card.classList.add('shadow-lg'));
        card.addEventListener('mouseleave', () => card.classList.remove('shadow-lg'));
    });
});

let perfilSelecionado = null;
let respostas = {};
let modoSelecionado = null;


function selecionarPerfil(perfil) {
    perfilSelecionado = perfil;
    respostas = {};
    renderQuestionario(perfil);
}

function renderQuestionario(perfil) {
    const container = document.getElementById("questionario-container");
    container.innerHTML = "";

    if (perfil === "executor") {
        container.innerHTML = `
            <h5>De quem você compra fibra?</h5>

            <button class="btn btn-outline-secondary" onclick="responderFibra('LAUMAN')">Lauman</button>
            <button class="btn btn-outline-secondary" onclick="responderFibra('CONCREFIBER')">Concrefiber</button>
            <button class="btn btn-outline-secondary" onclick="responderFibra('OUTROS')">Outros</button>

            <div id="campo-outros" class="mt-3"></div>
            <div id="texto-gerado" class="mt-3 alert alert-info"></div>
        `;
    }
}


function responderFibra(valor) {
    const clienteNome = document.querySelector("#cliente_id option:checked").text;

    if (valor === "OUTROS") {
        document.getElementById("campo-outros").innerHTML = `
            <input type="text" class="form-control" placeholder="Nome do concorrente"
                   onblur="finalizarFibraOutro(this.value)">
        `;
        return;
    }

    const texto = `${clienteNome} compra fibra da ${valor}`;
    document.getElementById("texto-gerado").innerText = texto;

    respostas["fibra_fornecedor"] = valor;
    respostas["texto"] = texto;
}


function selecionarModo(modo) {
    modoSelecionado = modo;
    respostas = {};

    // limpa questionário anterior
    const questionario = document.getElementById("questionario-container");
    if (questionario) questionario.innerHTML = "";

    const perfilContainer = document.getElementById("perfil-container");

    if (modo === "spin") {
        perfilContainer.classList.remove("d-none");
    } else {
        perfilContainer.classList.add("d-none");

        // placeholder futuro (ex: WhatsApp)
        questionario.innerHTML = `
            <div class="alert alert-info">
                Modo <strong>Envio via WhatsApp</strong> em desenvolvimento.
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", function () {

    const btnSpin = document.getElementById("btn-spin");
    const perfilContainer = document.getElementById("perfil-container");

    if (btnSpin && perfilContainer) {
        btnSpin.addEventListener("click", function () {
            modoSelecionado = "spin";
            respostas = {};

            // limpa perguntas (por enquanto)
            const questionario = document.getElementById("questionario-container");
            if (questionario) questionario.innerHTML = "";

            // MOSTRA os tipos de cliente
            perfilContainer.classList.remove("d-none");
        });
    }
});



// ============================================================
// FUNÇÃO DE MÁSCARA PARA CPF / CNPJ
// ============================================================
function aplicarMascaraCnpjCpf(valor) {
    valor = valor.replace(/\D/g, ""); // só números

    if (valor.length <= 11) {
        // ----- CPF -----
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
        // ----- CNPJ -----
        valor = valor.replace(/^(\d{2})(\d)/, "$1.$2");
        valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        valor = valor.replace(/\.(\d{3})(\d)/, ".$1/$2");
        valor = valor.replace(/(\d{4})(\d)/, "$1-$2");
    }

    return valor;
}

// ============================================================
// DOMContentLoaded — CÓDIGO PRINCIPAL
// ============================================================
document.addEventListener("DOMContentLoaded", () => {

    // -------------------------------------------
    // BOTÃO INCLUIR (CLIENTES x OBRAS por aba ativa)
    // -------------------------------------------
    // -------------------------------------------
    // BOTÃO INCLUIR (CLIENTE x OBRA)
    // - Se existir aba ativa, decide pela aba
    // - Se não existir abas, pergunta (Cliente ou Obra)
    // -------------------------------------------
    const btnIncluir = document.querySelector("#btnIncluir");
    if (btnIncluir) {
        btnIncluir.addEventListener("click", () => {

            const tabClientes = document.getElementById("tab-clientes");
            const tabObras = document.getElementById("tab-obras");

            // Caso 1: existem abas (cadastro com 2 tabs)
            if (tabClientes && tabObras) {
                if (tabClientes.classList.contains("active")) {
                    window.location.href = "/clientes/novo/";
                    return;
                }
                if (tabObras.classList.contains("active")) {
                    window.location.href = "/obras/novo/";
                    return;
                }
            }

        // Caso 2: não existem abas ainda -> mostra 2 opções
        const irParaObra = confirm("Deseja incluir uma OBRA?\n\nOK = Obra\nCancelar = Cliente");
        window.location.href = irParaObra ? "/obras/novo/" : "/clientes/novo/";
    });
}


    // -------------------------------------------
    // CLICK PARA EDITAR (CLIENTES) - usa data-url
    // -------------------------------------------
    document.querySelectorAll(".linha-cliente").forEach((linha) => {
        linha.addEventListener("click", function () {
            const url = this.dataset.url;
            if (url) window.location.href = url;
        });
    });

    // -------------------------------------------
    // CLICK PARA EDITAR (OBRAS) - usa data-url
    // -------------------------------------------
    document.querySelectorAll(".linha-obra").forEach((linha) => {
        linha.addEventListener("click", function () {
            const url = this.dataset.url;
            if (url) window.location.href = url;
        });
    });

    // -------------------------------------------
    // SELECT2
    // -------------------------------------------
    if (window.jQuery && $.fn.select2) {
        if ($("#id_segmentacao").length) $("#id_segmentacao").select2({ width: "100%" });
        if ($("#id_origem").length) $("#id_origem").select2({ width: "100%" });
    }

    // -------------------------------------------
    // MÁSCARA CPF / CNPJ
    // -------------------------------------------
    const campoCnpj = document.getElementById("id_cnpj_cpf");
    if (campoCnpj) {
        // aplica ao carregar (no modo editar)
        campoCnpj.value = aplicarMascaraCnpjCpf(campoCnpj.value);

        // aplica enquanto digita / cola
        campoCnpj.addEventListener("input", () => {
            const caret = campoCnpj.selectionStart;
            campoCnpj.value = aplicarMascaraCnpjCpf(campoCnpj.value);
            campoCnpj.setSelectionRange(caret, caret);
        });
    }

    // -------------------------------------------
    // CNPJ VIA API
    // -------------------------------------------
    const btnBuscar = document.getElementById("btnBuscarCNPJ");
    if (btnBuscar && campoCnpj) {
        btnBuscar.addEventListener("click", async () => {

            let cnpj = campoCnpj.value.replace(/\D/g, "");
            if (cnpj.length !== 14) {
                alert("Digite um CNPJ válido com 14 dígitos.");
                return;
            }

            try {
                const resposta = await fetch(`/api/buscar_cnpj/${cnpj}/`);
                const dados = await resposta.json();

                if (dados.status === "ERROR") {
                    alert("Erro ao consultar CNPJ: " + dados.message);
                    return;
                }

                document.getElementById("id_razao_social").value = dados.nome || "";
                document.getElementById("id_nome_fantasia").value = dados.fantasia || "";
                document.getElementById("id_endereco").value = dados.logradouro || "";
                document.getElementById("id_numero").value = dados.numero || "";
                document.getElementById("id_complemento").value = dados.complemento || "";
                document.getElementById("id_bairro").value = dados.bairro || "";
                document.getElementById("id_cep").value = dados.cep || "";
                document.getElementById("id_cidade").value = dados.municipio || "";
                document.getElementById("id_estado").value = dados.uf || "";

            } catch (err) {
                alert("Erro: " + err.message);
            }
        });
    }

    // -------------------------------------------
    // FORM: CONTATOS + LIMPAR MÁSCARA ANTES DE ENVIAR
    // -------------------------------------------
    const form = document.getElementById("formCliente");
    if (form) {
        form.addEventListener("submit", () => {

            // tira pontuação antes de mandar pro backend
            if (campoCnpj) {
                campoCnpj.value = campoCnpj.value.replace(/\D/g, "");
            }

            const contatos = [];
            document.querySelectorAll("#lista-contatos tr").forEach(tr => {
                contatos.push({
                    nome: tr.querySelector(".nome")?.value || "",
                    telefone1: tr.querySelector(".telefone1")?.value.replace(/\D/g, "") || "",
                    telefone2: tr.querySelector(".telefone2")?.value.replace(/\D/g, "") || "",
                    email: tr.querySelector(".email")?.value || "",
                    linkedin: tr.querySelector(".linkedin")?.value || ""
                });
            });

            const campoJson = document.getElementById("contatos_json");
            if (campoJson) {
                campoJson.value = JSON.stringify(contatos);
            }
        });
    }

    // -------------------------------------------
    // ADICIONAR CONTATO
    // -------------------------------------------
    const btnAdd = document.getElementById("btnAddContato");
    if (btnAdd) {
        btnAdd.addEventListener("click", () => {
            const lista = document.getElementById("lista-contatos");
            if (!lista) return;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><input type="text" class="form-control nome"></td>
                <td><input type="text" class="form-control telefone1"></td>
                <td><input type="text" class="form-control telefone2"></td>
                <td><input type="url" class="form-control linkedin" placeholder="https://linkedin.com/in/..."></td>
                <td><input type="email" class="form-control email"></td>
                <td>
                    <button type="button" class="btn btn-danger btn-sm" onclick="removerContato(this)">X</button>
                </td>
            `;
            lista.appendChild(tr);
        });
    }

    // -------------------------------------------
    // CANCELAR
    // -------------------------------------------
    const btnCancelar = document.getElementById("btnCancelar");
    if (btnCancelar) {
        btnCancelar.addEventListener("click", (e) => {
            e.preventDefault();
            const sair = confirm("Deseja sair sem salvar?");
            if (sair) window.location.href = "/clientes/";
        });
    }

    // ============================================================
    // ANEXOS — AUTOUPLOAD AO ESCOLHER ARQUIVO
    // ============================================================
    const inputAnexo = document.getElementById("inputAnexo");
    const listaAnexos = document.getElementById("lista-anexos");

    if (inputAnexo && listaAnexos) {

        inputAnexo.addEventListener("change", async () => {

            if (!inputAnexo.files.length) return;

            const file = inputAnexo.files[0];

            const formCliente = document.getElementById("formCliente");
            const clienteId = formCliente?.getAttribute("data-cliente-id");

            if (!clienteId) {
                alert("Salve o cliente antes de anexar arquivos.");
                inputAnexo.value = "";
                return;
            }

            const formData = new FormData();
            formData.append("arquivo", file);

            try {
                const response = await fetch(`/clientes/${clienteId}/anexos/upload/`, {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": getCookie("csrftoken")
                    },
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    alert(data.error || "Erro ao enviar arquivo");
                    return;
                }

                const tr = document.createElement("tr");
                tr.setAttribute("data-anexo-id", data.id);

                tr.innerHTML = `
                    <td>${data.nome}</td>
                    <td class="text-center">
                        <button type="button"
                                class="btn btn-success btn-sm me-1"
                                title="Enviar pelo WhatsApp">
                            <i class="bi bi-whatsapp"></i>
                        </button>

                        <a class="btn btn-outline-primary btn-sm me-1"
                        href="${data.url}"
                        target="_blank"
                        title="Visualizar anexo">
                            <i class="bi bi-eye"></i>
                        </a>

                        <a class="btn btn-outline-secondary btn-sm me-1"
                        href="${data.url}"
                        download
                        title="Baixar anexo">
                            <i class="bi bi-download"></i>
                        </a>

                        <button type="button"
                                class="btn btn-outline-danger btn-sm btn-excluir-anexo"
                                title="Excluir anexo">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;

                listaAnexos.appendChild(tr);

                inputAnexo.value = "";

            } catch (e) {
                alert("Erro ao enviar anexo.");
            }
        });
    }

    // -------------------------------------------
    // MASCARAS
    // -------------------------------------------
    document.addEventListener("input", (e) => {
        if (e.target.classList.contains("nome")) {
            const pos = e.target.selectionStart;
            e.target.value = capitalizarNome(e.target.value);
            e.target.setSelectionRange(pos, pos);
        }
    });

    document.addEventListener("input", (e) => {
        if (
            e.target.classList.contains("telefone1") ||
            e.target.classList.contains("telefone2")
        ) {
            const pos = e.target.selectionStart;
            e.target.value = aplicarMascaraTelefone(e.target.value);
            e.target.setSelectionRange(pos, pos);
        }
    });


    // ============================================================
    // INDICAÇÃO — MODAL + BUSCA + SELEÇÃO
    // ============================================================
    const btnBuscarIndicacao = document.getElementById("btnBuscarIndicacao");
    const btnLimparIndicacao = document.getElementById("btnLimparIndicacao");
    const inputIndicacaoNome = document.getElementById("indicacao_nome");
    const inputIndicacaoId = document.getElementById("id_indicacao");

    const modalIndicacaoEl = document.getElementById("modalBuscarIndicacao");
    const campoBuscaIndicacao = document.getElementById("buscaIndicacao");
    const tbodyIndicacao = document.getElementById("listaIndicacaoResultados");

    function renderLinhaIndicacao(item) {
        const cnpj = (item.cnpj_cpf || "").toString();
        const cidade = `${item.cidade || ""}${item.estado ? " (" + item.estado + ")" : ""}`;

        return `
        <tr>
            <td>${item.nome || ""}</td>
            <td>${cnpj}</td>
            <td>${cidade}</td>
            <td class="text-end">
            <button type="button" class="btn btn-sm btn-primary btn-selecionar-indicacao"
                    data-id="${item.id}" data-nome="${(item.nome || "").replace(/"/g, "&quot;")}">
                Selecionar
            </button>
            </td>
        </tr>
        `;
    }

    async function buscarIndicacao(q) {
        if (!tbodyIndicacao) return;

        const termo = (q || "").trim();
        if (termo.length < 2) {
            tbodyIndicacao.innerHTML = `<tr><td colspan="4" class="text-muted">Digite pelo menos 2 letras...</td></tr>`;
            return;
        }

        tbodyIndicacao.innerHTML = `<tr><td colspan="4" class="text-muted">Buscando...</td></tr>`;

        try {
            const res = await fetch(`/api/clientes/indicacao/?q=${encodeURIComponent(termo)}`);
            const data = await res.json();

            if (!Array.isArray(data) || data.length === 0) {
                tbodyIndicacao.innerHTML = `<tr><td colspan="4" class="text-muted">Nenhum cliente encontrado.</td></tr>`;
                return;
            }

            tbodyIndicacao.innerHTML = data.map(renderLinhaIndicacao).join("");

        } catch (e) {
            tbodyIndicacao.innerHTML = `<tr><td colspan="4" class="text-danger">Erro ao buscar clientes.</td></tr>`;
        }
    }

    // abrir modal
    if (btnBuscarIndicacao && modalIndicacaoEl) {
        btnBuscarIndicacao.addEventListener("click", () => {
            const modal = new bootstrap.Modal(modalIndicacaoEl);
            modal.show();

            setTimeout(() => {
                if (campoBuscaIndicacao) campoBuscaIndicacao.focus();
            }, 250);
        });
    }

    // debounce na busca
    if (campoBuscaIndicacao) {
        let timer = null;
        campoBuscaIndicacao.addEventListener("input", () => {
            clearTimeout(timer);
            timer = setTimeout(() => buscarIndicacao(campoBuscaIndicacao.value), 300);
        });
    }

    // selecionar cliente (delegação)
    if (tbodyIndicacao) {
        tbodyIndicacao.addEventListener("click", (e) => {
            const btn = e.target.closest(".btn-selecionar-indicacao");
            if (!btn) return;

            const id = btn.getAttribute("data-id");
            const nome = btn.getAttribute("data-nome") || "";

            if (inputIndicacaoId) inputIndicacaoId.value = id || "";
            if (inputIndicacaoNome) inputIndicacaoNome.value = nome;

            // fechar modal
            if (modalIndicacaoEl) {
                const instance = bootstrap.Modal.getInstance(modalIndicacaoEl);
                if (instance) instance.hide();
            }
        });
    }

    // limpar indicação
    if (btnLimparIndicacao) {
        btnLimparIndicacao.addEventListener("click", () => {
            if (inputIndicacaoId) inputIndicacaoId.value = "";
            if (inputIndicacaoNome) inputIndicacaoNome.value = "";
            if (campoBuscaIndicacao) campoBuscaIndicacao.value = "";
            if (tbodyIndicacao) tbodyIndicacao.innerHTML = `<tr><td colspan="4" class="text-muted">Digite para buscar...</td></tr>`;
        });
    }

}); // fim do DOMContentLoaded


// -------------------------------------------
// REMOVER CONTATO (global para ser chamado no onclick)
// -------------------------------------------
function removerContato(botao) {
    const linha = botao.closest("tr");
    if (linha) linha.remove();
}

// --------------MASCARA EM CONTATO NOME--------------
function capitalizarNome(nome) {
    return nome
        .toLowerCase()
        .split(" ")
        .filter(p => p.trim() !== "")
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
}

// --------------MASCARA EM CONTATO NUMERO DE TELEFONE--------------
function aplicarMascaraTelefone(valor) {
    valor = valor.replace(/\D/g, "");

    if (valor.length <= 10) {
        // Fixo: (99) 9999-9999
        valor = valor.replace(/^(\d{2})(\d)/, "($1) $2");
        valor = valor.replace(/(\d{4})(\d)/, "$1-$2");
    } else {
        // Celular: (99) 99999-9999
        valor = valor.replace(/^(\d{2})(\d)/, "($1) $2");
        valor = valor.replace(/(\d{5})(\d)/, "$1-$2");
    }

    return valor;
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + "=")) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// ============================================================
// ANEXOS — EXCLUIR (GLOBAL, FUNCIONA EM ELEMENTOS DINÂMICOS)
// ============================================================
document.addEventListener("click", async (e) => {

    const btn = e.target.closest(".btn-excluir-anexo");
    if (!btn) return;

    const tr = btn.closest("tr");
    const anexoId = tr?.getAttribute("data-anexo-id");

    if (!anexoId) return;

    const confirmar = confirm("Deseja realmente excluir este anexo?");
    if (!confirmar) return;

    try {
        const response = await fetch(
            `/clientes/anexos/${anexoId}/excluir/`,
            {
                method: "DELETE",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken")
                }
            }
        );

        if (!response.ok) {
            alert("Erro ao excluir o anexo.");
            return;
        }

        tr.remove();

    } catch (e) {
        alert("Erro ao excluir o anexo.");
    }
});

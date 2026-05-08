let dadosPdfAtual = null;
const PDF_UPLOAD_MAX_SIZE = 20 * 1024 * 1024;

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

function mostrarAlerta(tipo, mensagem) {
    const alerta = document.getElementById("alertaPdf");
    if (!alerta) return;

    alerta.className = `alert alert-${tipo}`;
    alerta.innerHTML = mensagem;
}

function limparAlerta() {
    const alerta = document.getElementById("alertaPdf");
    if (!alerta) return;

    alerta.className = "alert d-none";
    alerta.innerHTML = "";
}

async function lerRespostaJson(resposta) {
    const contentType = resposta.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        const dados = await resposta.json();
        if (!resposta.ok) {
            throw new Error(dados.error || `HTTP ${resposta.status}`);
        }
        return dados;
    }

    const textoResposta = await resposta.text();
    const textoLimpo = textoResposta
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    let detalhe = textoLimpo ? textoLimpo.slice(0, 220) : `HTTP ${resposta.status}`;

    if (resposta.status === 403) {
        detalhe = "A sessao expirou ou o token de seguranca nao foi aceito. Atualize a pagina, faca login novamente e tente de novo.";
    } else if (resposta.status === 413) {
        detalhe = "O PDF ultrapassou o limite de upload configurado no servidor. Aumente o client_max_body_size do Nginx/Proxy para pelo menos 25M e reinicie o servico.";
    } else if (resposta.status >= 500) {
        detalhe = "Erro interno no servidor. Confira o log do Django/Gunicorn para ver a causa real.";
    }

    throw new Error(detalhe);
}

function texto(valor) {
    return valor || "-";
}

function renderGrid(itens) {
    const tbody = document.querySelector("#gridPdf tbody");
    if (!tbody) return;

    if (!Array.isArray(itens) || itens.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    Nenhum item encontrado no PDF.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = itens.map(item => `
        <tr>
            <td>${texto(item.numero_proposta)}</td>
            <td>${texto(item.produto)}</td>
            <td class="text-end">${texto(item.quantidade)}</td>
            <td>${texto(item.unidade)}</td>
            <td class="text-end">${texto(item.valor_unitario)}</td>
            <td class="text-end">${texto(item.subtotal)}</td>
            <td>${texto(item.cnpj_faturamento)}</td>
            <td>${texto(item.linha_produto)}</td>
        </tr>
    `).join("");
}

function atualizarResumo(dados) {
    document.getElementById("pdfCliente").textContent = texto(dados.cliente);
    document.getElementById("pdfCnpj").textContent = texto(dados.cnpj);
    document.getElementById("pdfProposta").textContent = texto(dados.numero_proposta);

    const status = document.getElementById("pdfClienteStatus");
    if (!status) return;

    if (dados.cliente_existe) {
        status.textContent = `Cadastrado: ${dados.cliente_nome_sistema || ""}`;
        return;
    }

    status.innerHTML = `
        Nao cadastrado
        <a class="btn btn-sm btn-outline-primary ms-2" href="${dados.cadastro_url}">
            Cadastrar cliente?
        </a>
    `;
}

function propostaJaExiste(dados) {
    return dados && dados.proposta_existe;
}

function mensagemPropostaExistente(dados) {
    const numero = dados?.numero_proposta || "";
    const cliente = dados?.proposta_existente_cliente || "";
    const sufixo = cliente ? ` para o cliente ${cliente}` : "";
    return `Ja existe a proposta ${numero}${sufixo}. A importacao foi cancelada.`;
}

async function revalidarClientePendente(dados) {
    if (!dados || !dados.cnpj || dados.cliente_existe) return dados;

    const atualizado = { ...dados };

    try {
        const resposta = await fetch(`/api/clientes/busca/?q=${encodeURIComponent(dados.cnpj)}`);
        const clientes = await resposta.json();
        const cnpjLimpo = dados.cnpj.replace(/\D/g, "");
        const cliente = Array.isArray(clientes)
            ? clientes.find(item => (item.cnpj_cpf || "").replace(/\D/g, "") === cnpjLimpo)
            : null;

        if (cliente) {
            atualizado.cliente_existe = true;
            atualizado.cliente_id = cliente.id;
            atualizado.cliente_nome_sistema = cliente.nome || "";
        }
    } catch (e) {
        return atualizado;
    }

    return atualizado;
}

async function carregarDadosPendentes() {
    const script = document.getElementById("dados-pdf-pendentes");
    if (!script || !script.textContent.trim()) return;

    try {
        let dados = JSON.parse(script.textContent);
        if (!dados || !Array.isArray(dados.itens)) return;

        dados = await revalidarClientePendente(dados);
        dadosPdfAtual = dados;
        atualizarResumo(dados);
        renderGrid(dados.itens);

        const btnSalvar = document.getElementById("btnSalvarPdf");
        if (btnSalvar) btnSalvar.disabled = !dados.cliente_existe || propostaJaExiste(dados);

        if (propostaJaExiste(dados)) {
            mostrarAlerta("warning", mensagemPropostaExistente(dados));
        } else if (dados.cliente_existe) {
            mostrarAlerta("info", "Dados do PDF restaurados. O cliente ja foi localizado; confira o grid e salve no banco.");
        } else {
            const link = `<a href="${dados.cadastro_url}" class="alert-link">Cadastrar o cliente?</a>`;
            mostrarAlerta("warning", `Dados do PDF restaurados, mas o cliente ainda nao foi localizado. ${link}`);
        }
    } catch (e) {
        return;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("arquivoPdf");
    const btnLer = document.getElementById("btnLerPdf");
    const btnSalvar = document.getElementById("btnSalvarPdf");

    carregarDadosPendentes();

    if (btnLer && input) {
        btnLer.addEventListener("click", async () => {
            limparAlerta();
            btnSalvar.disabled = true;
            dadosPdfAtual = null;

            if (!input.files.length) {
                mostrarAlerta("warning", "Selecione um arquivo PDF.");
                return;
            }

            const arquivo = input.files[0];
            if (arquivo.size > PDF_UPLOAD_MAX_SIZE) {
                mostrarAlerta("warning", "O PDF ultrapassou o limite de 20 MB.");
                renderGrid([]);
                return;
            }

            const formData = new FormData();
            formData.append("arquivo", arquivo);

            btnLer.disabled = true;
            btnLer.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Lendo...';

            try {
                const resposta = await fetch("/api/leitor-pdf/ler/", {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": getCookie("csrftoken")
                    },
                    body: formData
                });

                const dados = await lerRespostaJson(resposta);
                if (!resposta.ok || !dados.ok) {
                    mostrarAlerta("danger", dados.error || "Erro ao ler PDF.");
                    renderGrid([]);
                    return;
                }

                dadosPdfAtual = dados;
                atualizarResumo(dados);
                renderGrid(dados.itens);

                if (propostaJaExiste(dados)) {
                    btnSalvar.disabled = true;
                    mostrarAlerta("warning", mensagemPropostaExistente(dados));
                } else if (dados.cliente_existe) {
                    btnSalvar.disabled = false;
                    mostrarAlerta("success", "PDF lido com sucesso. Confira o grid e salve no banco.");
                } else {
                    const link = `<a href="${dados.cadastro_url}" class="alert-link">Cadastrar o cliente?</a>`;
                    mostrarAlerta("warning", `Cliente nao localizado pelo CNPJ. ${link}`);
                }
            } catch (e) {
                mostrarAlerta("danger", `Erro ao ler PDF: ${e.message}`);
                renderGrid([]);
            } finally {
                btnLer.disabled = false;
                btnLer.innerHTML = '<i class="bi bi-file-earmark-text"></i> Ler PDF';
            }
        });
    }

    if (btnSalvar) {
        btnSalvar.addEventListener("click", async () => {
            if (!dadosPdfAtual) return;
            if (propostaJaExiste(dadosPdfAtual)) {
                mostrarAlerta("warning", mensagemPropostaExistente(dadosPdfAtual));
                btnSalvar.disabled = true;
                return;
            }

            btnSalvar.disabled = true;
            btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Salvando...';

            try {
                const resposta = await fetch("/api/leitor-pdf/salvar/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken")
                    },
                    body: JSON.stringify(dadosPdfAtual)
                });

                const dados = await lerRespostaJson(resposta);
                if (!resposta.ok || !dados.ok) {
                    const cadastro = dados.cadastro_url
                        ? ` <a href="${dados.cadastro_url}" class="alert-link">Cadastrar cliente?</a>`
                        : "";
                    mostrarAlerta("danger", `${dados.error || "Erro ao salvar."}${cadastro}`);
                    return;
                }

                dadosPdfAtual = null;
                btnSalvar.disabled = true;
                mostrarAlerta("success", `${dados.message} A proposta ja aparece na aba CRM do cliente ${dados.cliente_nome}.`);
            } catch (e) {
                mostrarAlerta("danger", `Erro ao salvar: ${e.message}`);
            } finally {
                btnSalvar.disabled = !dadosPdfAtual;
                btnSalvar.innerHTML = '<i class="bi bi-database-check"></i> Salvar no BD';
            }
        });
    }
});

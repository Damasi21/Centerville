console.log("obra.js atualizado v2");


function limparCep(v) {
  return (v || "").toString().replace(/\D/g, "");
}

document.addEventListener("DOMContentLoaded", () => {
  const cepInput = document.getElementById("id_cep");
  const btnBuscarCEP = document.getElementById("btnBuscarCEP");

  async function buscarViaCep() {
    if (!cepInput) return;

    const cep = limparCep(cepInput.value);
    if (cep.length !== 8) {
      alert("Digite um CEP válido com 8 dígitos.");
      return;
    }

    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();

      if (data.erro) {
        alert("CEP não encontrado.");
        return;
      }

      // Preenche campos (se existirem)
      const endereco = document.getElementById("id_endereco");
      const bairro = document.getElementById("id_bairro");
      const cidade = document.getElementById("id_cidade");
      const estado = document.getElementById("id_estado");

      if (endereco) endereco.value = data.logradouro || "";
      if (bairro) bairro.value = data.bairro || "";
      if (cidade) cidade.value = data.localidade || "";

      // estado é select
      if (estado) estado.value = data.uf || "";

    } catch (e) {
      alert("Erro ao consultar ViaCEP.");
    }
  }

  if (btnBuscarCEP) btnBuscarCEP.addEventListener("click", buscarViaCep);

  // opcional: buscar ao sair do campo
  if (cepInput) {
    cepInput.addEventListener("blur", () => {
      const cep = limparCep(cepInput.value);
      if (cep.length === 8) buscarViaCep();
    });
  }
});

// --------------------------ANEXO OBRA -----------------------------------------------------
  const btnAbrirModalAnexosObra = document.getElementById("btnAbrirModalAnexosObra");
  const inputAnexoObra = document.getElementById("inputAnexoObra");
  const btnAdicionarAnexoObra = document.getElementById("btnAdicionarAnexoObra");
  const listaAnexosObra = document.getElementById("lista-anexos-obra");
  const formObra = document.getElementById("formObra");
  const obraId = formObra?.getAttribute("data-obra-id");

  if (btnAbrirModalAnexosObra) {
    btnAbrirModalAnexosObra.addEventListener("click", () => {
      if (!obraId) {
        alert("Salve a obra antes de anexar arquivos.");
        return;
      }

      const modalEl = document.getElementById("modalAnexosObra");
      if (!modalEl) return;

      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    });
  }

  if (btnAdicionarAnexoObra && inputAnexoObra && listaAnexosObra) {
    btnAdicionarAnexoObra.addEventListener("click", async () => {
      if (!obraId) {
        alert("Salve a obra antes de anexar arquivos.");
        return;
      }

      if (!inputAnexoObra.files.length) {
        alert("Selecione um arquivo.");
        return;
      }

      const file = inputAnexoObra.files[0];
      const formData = new FormData();
      formData.append("arquivo", file);

      try {
        const response = await fetch(`/obras/${obraId}/anexos/upload/`, {
          method: "POST",
          headers: {
            "X-CSRFToken": getCookie("csrftoken")
          },
          body: formData
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.error || "Erro ao enviar arquivo.");
          return;
        }

        const linhaVazia = listaAnexosObra.querySelector("td[colspan='2']");
        if (linhaVazia) {
          linhaVazia.closest("tr").remove();
        }

        const tr = document.createElement("tr");
        tr.setAttribute("data-anexo-id", data.id);
        tr.innerHTML = `
          <td>${data.nome}</td>
          <td class="text-center">
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
                    class="btn btn-outline-danger btn-sm btn-excluir-anexo-obra"
                    title="Excluir anexo">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        `;
        listaAnexosObra.appendChild(tr);

        inputAnexoObra.value = "";

      } catch (e) {
        alert("Erro ao enviar anexo.");
      }
    });
  }

// -------------------------------------------------------------------------------

let clientesSelecionados = []; // [{id, nome, segmentacao}]


async function buscarClientesModal(q) {
  const tbody = document.getElementById("listaClientesModalObra");
  if (!tbody) return;

  if (!q || q.trim().length < 2) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-muted">Digite pelo menos 2 letras...</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="3" class="text-muted">Buscando...</td></tr>`;

  try {
    const res = await fetch(`/api/clientes/busca/?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-muted">Nenhum cliente encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    data.forEach(item => {
      const jaSelecionado = clientesSelecionados.some(c => Number(c.id) === Number(item.id));

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.nome}</td>
        <td><span class="text-muted">${item.segmentacao || ""}</span></td>
        <td class="text-end">
          <button type="button" class="btn btn-sm ${jaSelecionado ? "btn-secondary" : "btn-primary"}" ${jaSelecionado ? "disabled" : ""}>
            ${jaSelecionado ? "Adicionado" : "Adicionar"}
          </button>
        </td>
      `;

        tr.querySelector("button").addEventListener("click", () => {

          const idNum = Number(item.id);

          // não duplica
          if (!clientesSelecionados.some(c => Number(c.id) === idNum)) {
            clientesSelecionados.push({
              id: idNum,
              nome: item.nome,
              segmentacao: item.segmentacao || ""
            });
          }
            renderClientesSelecionados();
          tr.querySelector("button").className = "btn btn-sm btn-secondary";
          tr.querySelector("button").textContent = "Adicionado";
          tr.querySelector("button").disabled = true;
        });

      tbody.appendChild(tr);
    });

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-danger">Erro ao buscar clientes.</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {

  const btnAbrir = document.getElementById("btnAbrirModalClientesObra");
  const inputBusca = document.getElementById("buscaClienteObra");

  // ✅ carrega selecionados já salvos (modo editar)
  const hiddenClientes = document.getElementById("clientes_json");
  if (hiddenClientes) {
    const raw = hiddenClientes.value || "[]";
    try {
      clientesSelecionados = JSON.parse(raw);
    } catch (e) {
      console.error("Erro ao carregar clientes iniciais da obra:", e, raw);
      clientesSelecionados = [];
    }
  }

  // garante render inicial
  renderClientesSelecionados();


  if (btnAbrir) {
    btnAbrir.addEventListener("click", () => {
      const modalEl = document.getElementById("modalSelecionarClienteObra");
      if (!modalEl) return;
      const modal = new bootstrap.Modal(modalEl);
      modal.show();

      // foca no campo
      setTimeout(() => inputBusca?.focus(), 250);
    });
  }

  // busca ao digitar
  if (inputBusca) {
    let timer = null;
    inputBusca.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => buscarClientesModal(inputBusca.value), 300);
    });
  }

  
});
// -------------------------------------------------------------------------------

function renderClientesSelecionados() {
  const hidden = document.getElementById("clientes_json");
  const buscaTexto = document.getElementById("clienteBuscaTexto");
  const lista = document.getElementById("clientesSelecionadosObra");

  if (!hidden) return;

  // salva os IDs no hidden para o backend
  hidden.value = JSON.stringify(
    clientesSelecionados.map(c => ({ id: c.id }))
  );

  // mostra os nomes no campo visual
  if (buscaTexto) {
    if (clientesSelecionados.length === 0) {
      buscaTexto.value = "";
      buscaTexto.placeholder = "Clique na lupa para buscar...";
    } else {
      buscaTexto.value = clientesSelecionados.map(c => c.nome).join(", ");
    }
  }

  // monta a lista visual com botão de excluir
  if (lista) {
    lista.innerHTML = "";

    if (clientesSelecionados.length === 0) {
      lista.innerHTML = `
        <li class="list-group-item text-muted">
          Nenhum cliente selecionado.
        </li>
      `;
      return;
    }

    clientesSelecionados.forEach(c => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between align-items-center";

      li.innerHTML = `
        <div>
          <div class="fw-semibold">${c.nome}</div>
          <div class="small text-muted">${c.segmentacao || ""}</div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-danger" title="Remover">
          <i class="bi bi-x"></i>
        </button>
      `;

      li.querySelector("button").addEventListener("click", () => {
        clientesSelecionados = clientesSelecionados.filter(
          x => Number(x.id) !== Number(c.id)
        );
        renderClientesSelecionados();
      });

      lista.appendChild(li);
    });
  }
}

// --------------exclusao de anexo obra -----------------------------------------------------------------

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-excluir-anexo-obra");
  if (!btn) return;

  const tr = btn.closest("tr");
  const anexoId = tr?.getAttribute("data-anexo-id");
  if (!anexoId) return;

  const confirmar = confirm("Deseja realmente excluir este anexo?");
  if (!confirmar) return;

  try {
    const response = await fetch(`/obras/anexos/${anexoId}/excluir/`, {
      method: "DELETE",
      headers: {
        "X-CSRFToken": getCookie("csrftoken")
      }
    });

    if (!response.ok) {
      alert("Erro ao excluir o anexo.");
      return;
    }

    tr.remove();

  } catch (e) {
    alert("Erro ao excluir o anexo.");
  }
});

//-----------------------------------------------------------------

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
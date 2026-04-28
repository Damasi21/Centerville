let chatSelecionado = null;

function debounce(fn, wait = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function escapeHtml(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function badgesFromTags(segmentacoes, status) {
  const parts = [];
  (segmentacoes || []).forEach((t) => {
    parts.push(`<span class="badge text-bg-secondary me-1">${escapeHtml(t)}</span>`);
  });
  if (status) {
    parts.push(`<span class="badge text-bg-success me-1">${escapeHtml(status)}</span>`);
  }
  return parts.join("");
}

function aplicarDestaqueSelecionado(div, isSelected) {
  if (isSelected) {
    div.classList.add("border-success");
    div.style.background = "#f3fff5";
  } else {
    div.classList.remove("border-success");
    div.style.background = "";
  }
}

async function carregarConversas(q = "") {
  const box = document.getElementById("listaConversas");
  box.innerHTML = `<div class="text-muted small">Carregando...</div>`;

  let data;
  try {
    const res = await fetch(`/api/crm/wpp/chats/?q=${encodeURIComponent(q)}`);
    data = await res.json();
  } catch {
    box.innerHTML = `<div class="text-danger small">Erro ao carregar conversas</div>`;
    return;
  }

  box.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    box.innerHTML = `<div class="text-muted small">Nenhuma conversa encontrada</div>`;
    chatSelecionado = null;
    return;
  }

  data.forEach((item) => {
    const div = document.createElement("div");
    div.className = "border p-2 position-relative";
    div.style.cursor = "pointer";

    const tagsHtml = badgesFromTags(item.segmentacoes, item.status);
    const preview = (item.ultimo_texto || "").trim();

    // botão topo direito: + (sem cadastro) ou lápis (com cadastro)
    const btnIcon = item.cadastrado ? "bi-pencil" : "bi-plus-lg";
    const btnTitle = item.cadastrado ? "Abrir cadastro do cliente" : "Cadastrar cliente";
    const btnClass = item.cadastrado ? "btn-outline-secondary" : "btn-success";

    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div class="fw-semibold">${escapeHtml(item.nome || "")}</div>
          <div class="small text-muted">${escapeHtml(formatTelefoneBr(item.telefone || ""))}</div>
        </div>

        <button class="btn btn-sm ${btnClass}" title="${btnTitle}">
          <i class="bi ${btnIcon}"></i>
        </button>
      </div>

      <div class="mt-2">${tagsHtml || `<span class="text-muted small">Sem tags</span>`}</div>

      <div class="small text-muted mt-2" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${escapeHtml(preview)}
      </div>
    `;

    aplicarDestaqueSelecionado(div, item.chat_id === chatSelecionado);

    // clique: selecionar (apenas visual)
    div.addEventListener("click", () => {
      chatSelecionado = item.chat_id;
      [...box.children].forEach((child) => aplicarDestaqueSelecionado(child, false));
      aplicarDestaqueSelecionado(div, true);
    });

    // duplo clique: abrir modal com conversa completa
    div.addEventListener("dblclick", async () => {
      await abrirModalConversa(item);
    });

    // ação do botão (cadastro)
    div.querySelector("button").addEventListener("click", (e) => {
      e.stopPropagation();

      if (item.cadastrado && item.cliente_id) {
        window.open(`/clientes/${item.cliente_id}/`, "_blank");
        return;
      }

      // sem cadastro: abre “novo cliente” com querystring (para prefill futuro)
      const url = `/clientes/novo/?telefone=${encodeURIComponent(item.telefone || "")}&nome=${encodeURIComponent(item.nome || "")}`;
      window.open(url, "_blank");
    });

    box.appendChild(div);
  });

  // auto-seleciona o primeiro
  if (!chatSelecionado && data.length > 0) {
    chatSelecionado = data[0].chat_id;
    const first = box.firstElementChild;
    if (first) aplicarDestaqueSelecionado(first, true);
  }
}

async function abrirModalConversa(item) {
  const titulo = document.getElementById("modalConversaTitulo");
  const body = document.getElementById("modalConversaBody");

  titulo.textContent = `${item.nome || item.telefone || "Conversa"} • ${item.telefone || ""}`;
  body.innerHTML = `<div class="text-muted small">Carregando conversa...</div>`;

  let msgs;
  try {
    const res = await fetch(`/api/crm/wpp/chats/${encodeURIComponent(item.chat_id)}/timeline/?limit=300`);
    msgs = await res.json();
  } catch {
    body.innerHTML = `<div class="text-danger small">Erro ao carregar conversa</div>`;
    return;
  }

  body.innerHTML = "";
  if (!Array.isArray(msgs) || msgs.length === 0) {
    body.innerHTML = `<div class="text-muted small">Sem mensagens</div>`;
  } else {
    msgs.forEach((m) => {
      const isMine = (m.tipo || "").toLowerCase() === "você";

      const wrap = document.createElement("div");
      wrap.className = "d-flex mb-2";
      wrap.style.justifyContent = isMine ? "flex-end" : "flex-start";

      const bubble = document.createElement("div");
      bubble.className = "border p-2";
      bubble.style.maxWidth = "85%";
      bubble.style.borderRadius = "12px";
      bubble.style.background = isMine ? "#eef6ff" : "#ffffff";

      bubble.innerHTML = `
        <div class="d-flex justify-content-between gap-2">
          <div class="fw-semibold small">${escapeHtml(m.tipo || "")}</div>
          <div class="small text-muted">${escapeHtml(m.data || "")}</div>
        </div>
        <div class="small" style="white-space:pre-wrap;">${escapeHtml(m.texto || "")}</div>
      `;

      wrap.appendChild(bubble);
      body.appendChild(wrap);
    });

    body.scrollTop = body.scrollHeight;
  }

  const modal = new bootstrap.Modal(document.getElementById("modalConversa"));
  modal.show();
}

/* =========================
   TIMELINE (interações internas)
   ========================= */

async function carregarTimelineInterna(q = "") {
  const box = document.getElementById("timelineAtividades");
  box.innerHTML = `<div class="text-muted small">Carregando...</div>`;

  let data;
  try {
    const res = await fetch(`/api/crm/timeline/?q=${encodeURIComponent(q)}`);
    data = await res.json();
  } catch {
    box.innerHTML = `<div class="text-danger small">Erro ao carregar timeline</div>`;
    return;
  }

  box.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    box.innerHTML = `<div class="text-muted small">Nenhuma atividade encontrada</div>`;
    return;
  }

  data.forEach((it) => {
    const div = document.createElement("div");
    div.className = "border p-2";

    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div class="fw-semibold">${escapeHtml(it.cliente_nome || "")}</div>
          <div class="small text-muted">${escapeHtml(it.tipo || "")} • ${escapeHtml(it.quando || "")}</div>
        </div>

        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-primary" title="Visualizar">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-sm btn-outline-secondary" title="Abrir cadastro do cliente">
            <i class="bi bi-pencil"></i>
          </button>
        </div>
      </div>

      <div class="small text-muted mt-2">${escapeHtml(it.resumo || "")}</div>
    `;

    // olho: abre modal com conteúdo
    div.querySelector(".btn-outline-primary").addEventListener("click", () => {
      abrirModalAtividade(it);
    });

    // lápis: abre cadastro do cliente
    div.querySelector(".btn-outline-secondary").addEventListener("click", () => {
      if (it.cliente_id) window.open(`/clientes/${it.cliente_id}/`, "_blank");
    });

    box.appendChild(div);
  });
}

function abrirModalAtividade(it) {
  const titulo = document.getElementById("modalAtividadeTitulo");
  const body = document.getElementById("modalAtividadeBody");

  titulo.textContent = `${it.cliente_nome || "Cliente"} • ${it.tipo || ""} • ${it.quando || ""}`;

  const respostas = it.respostas_json ? JSON.stringify(it.respostas_json, null, 2) : "";

  body.innerHTML = `
    <div class="mb-3">
      <div class="fw-semibold mb-1">Texto gerado</div>
      <div class="border p-2 small" style="white-space:pre-wrap;">${escapeHtml(it.texto_gerado || "")}</div>
    </div>

    <div>
      <div class="fw-semibold mb-1">Respostas (JSON)</div>
      <pre class="border p-2 small mb-0" style="white-space:pre-wrap;">${escapeHtml(respostas)}</pre>
    </div>
  `;

  const modal = new bootstrap.Modal(document.getElementById("modalAtividade"));
  modal.show();
}

/* =========================
   INIT
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  const buscaContatos = document.getElementById("buscaContatos");
  const btnAtualizar = document.getElementById("btnAtualizarWpp");

  const buscaClienteTimeline = document.getElementById("buscaClienteTimeline");

  buscaContatos.addEventListener(
    "input",
    debounce((e) => carregarConversas(e.target.value), 250)
  );

  btnAtualizar.addEventListener("click", async () => {
    btnAtualizar.disabled = true;
    btnAtualizar.textContent = "Atualizando...";

    try {
      await fetch("/api/crm/wpp/sync/", { method: "POST" });
    } catch (e) {
      // silencioso; mesmo se sync falhar, recarrega o que tiver no banco
    }

    await carregarConversas(buscaContatos.value);

    btnAtualizar.disabled = false;
    btnAtualizar.textContent = "Atualizar";
  });


  buscaClienteTimeline.addEventListener(
    "input",
    debounce((e) => carregarTimelineInterna(e.target.value), 250)
  );

  carregarConversas();
  carregarTimelineInterna();
});

/* =========================
   funcao para simplificar telefone no card do whats
========================= */

function formatTelefoneBr(raw) {
  const d = (raw || "").replace(/\D/g, "");
  // remove 55 se vier com DDI
  const n = d.startsWith("55") ? d.slice(2) : d;

  if (n.length === 10) {
    // (DD) XXXX-XXXX
    return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  }
  if (n.length === 11) {
    // (DD) 9XXXX-XXXX
    return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  }
  return raw || "";
}


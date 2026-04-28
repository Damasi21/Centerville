// ========================================================
// MAPA DE CLIENTES + MARCADORES MANUAIS (PERSISTENTES)
// static/js/mapa.js
// ========================================================

let map;
let lastManualMarker = null;

document.addEventListener("DOMContentLoaded", function () {

    // ========================================================
    // 1) Inicializa o mapa
    // ========================================================
    map = L.map('map').setView([-14.2350, -51.9253], 4);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // ========================================================
    // 2) ÍCONES
    // ========================================================
    const icons = {
        "construtora": L.icon({
            iconUrl: "/static/img/marker-red.png",
            iconSize: [32,40],
            iconAnchor: [20, 40]
        }),
        "executor de piso": L.icon({
            iconUrl: "/static/img/marker-yellow.png",
            iconSize: [32, 40],
            iconAnchor: [20, 40]
        }),
        "concreteira": L.icon({
            iconUrl: "/static/img/marker-green.png",
            iconSize: [32,40],
            iconAnchor: [20,40]
        }),
        "parceiros/influenciadores": L.icon({
            iconUrl: "/static/img/marker-blue.png",
            iconSize: [32, 40],
            iconAnchor: [20, 40]
        }),
        "outros": L.icon({
            iconUrl: "/static/img/marker-purple.png",
            iconSize: [32, 40],
            iconAnchor: [20, 40]
        }),

        "obra": L.icon({
            iconUrl: "/static/img/marker-orange.png",
            iconSize: [32, 30],
            iconAnchor: [20, 40]
        }),    

        "default": L.icon({
            iconUrl: "/static/img/marker-grey.png",
            iconSize: [32, 32],
            iconAnchor: [20, 40]
        })
    };


 // ========================================================
// 3) CLIENTES NO MAPA (COM FILTROS)
// ========================================================
const markersGroup = L.featureGroup().addTo(map);

function limparClientesDoMapa() {
    markersGroup.clearLayers();
}

function montarQueryFiltros() {
    const segmentacao = (document.getElementById("filtroSegmentacao")?.value || "").trim();
    const cidade = (document.getElementById("filtroCidade")?.value || "").trim();

    const params = new URLSearchParams();
    if (segmentacao) params.set("segmentacao", segmentacao);
    if (cidade) params.set("cidade", cidade);

    const qs = params.toString();
    return qs ? `?${qs}` : "";
}

function carregarClientes() {
    limparClientesDoMapa();

    const qs = montarQueryFiltros();

    fetch(`/api/clientes/mapa/${qs}`)
        .then(res => res.json())
        .then(dados => {

            dados.forEach(c => {
                if (!c.lat || !c.lon) return;

                let icon = icons["default"];

                if (Array.isArray(c.segmentacoes) && c.segmentacoes.length > 0) {
                    const seg = c.segmentacoes[0].toLowerCase().trim();
                    icon = icons[seg] || icons["default"];
                }

                const marker = L.marker([c.lat, c.lon], { icon }).addTo(markersGroup);

                marker.bindPopup(`
                    <div style="min-width: 280px;">
                        <div><strong>Cliente:</strong> ${c.nome || ""}</div>
                        <div><strong>Segmentação:</strong> ${(c.segmentacoes || []).join(", ") || "Não informado"}</div>
                        <div><strong>Cidade:</strong> ${c.cidade || ""}${c.estado ? " - " + c.estado : ""}</div>
                        <div><strong>Status:</strong> ${c.status || "Não informado"}</div>
                        <br>
                        <a href="/clientes/${c.id}/" class="btn btn-sm btn-light">Abrir cadastro</a>
                    </div>
                `);
            });

            if (markersGroup.getLayers().length) {
                if (!jaCentralizouBrasil) {
                    map.setView([-14.2350, -51.9253], 4);
                    jaCentralizouBrasil = true;
                }
            }    
        });
}

// ========================================================
// 3.1) CARREGAR OPÇÕES DOS FILTROS
// ========================================================
function popularSelect(selectId, itens) {
    const sel = document.getElementById(selectId);
    if (!sel) return;

    // mantém a primeira opção (Todos / Todas)
    const first = sel.querySelector("option");
    sel.innerHTML = "";
    if (first) sel.appendChild(first);

    (itens || []).forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
    });
}

fetch("/api/clientes/mapa/filtros/")
    .then(res => res.json())
    .then(data => {
        popularSelect("filtroSegmentacao", data.segmentacoes);
        //popularSelect("filtroCidade", data.cidades);
    });

// ========================================================
// 3.2) BOTÕES
// ========================================================
document.getElementById("btnAplicarFiltros")?.addEventListener("click", () => {
    carregarClientes();
});

document.getElementById("btnLimparFiltros")?.addEventListener("click", () => {
    const st = document.getElementById("filtroStatus");
    const cd = document.getElementById("filtroCidade");
    if (st) st.value = "";
    if (cd) cd.value = "";
    carregarClientes();
});

/* ✅ COLOQUE AQUI */
carregarClientes();


// ========================================================
// 3.3) BUSCA AO DIGITAR (CIDADE)
// ========================================================
function debounce(fn, wait) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

const inputCidade = document.getElementById("filtroCidade");
if (inputCidade) {
    inputCidade.addEventListener("input", debounce(() => {
        carregarClientes();
    }, 350));
}

// ========================================================
// 3.4) OBRAS NO MAPA
// ========================================================
const obrasGroup = L.featureGroup().addTo(map);

function limparObrasDoMapa() {
    obrasGroup.clearLayers();
}

function carregarObras() {
    limparObrasDoMapa();

    fetch("/api/obras/mapa/")
        .then(res => res.json())
        .then(dados => {
            dados.forEach(o => {
                if (o.lat == null || o.lon == null) return;

                const marker = L.marker([o.lat, o.lon], { icon: icons["obra"] }).addTo(obrasGroup);

                marker.bindPopup(`
                    <b>Obra:</b> ${o.nome}<br>
                    <b>Cidade:</b> ${o.cidade} - ${o.estado}<br>
                    <b>Endereço:</b> ${o.endereco || ""} ${o.numero || ""}<br>
                    <b>Bairro:</b> ${o.bairro || ""}<br>
                    <b>Clientes:</b> ${(o.clientes || []).join(", ") || "Não informado"}<br><br>
                    <a href="/obras/${o.id}/" class="btn btn-sm btn-warning">Abrir obra</a>
                `);
            });

            console.log("Obras carregadas:", dados.length);
        })
        .catch((err) => {
            console.error("Erro ao carregar obras no mapa:", err);
        });
}

carregarObras();

// ========================================================
// BUSCAR CIDADE (QUALQUER) E CENTRALIZAR O MAPA
// ========================================================
let markerCidade = null;
let jaCentralizouBrasil = false;

function irParaCidade(texto) {
    const q = (texto || "").trim();
    if (!q) return;

    fetch(`/api/geocode/?q=${encodeURIComponent(q)}`)
        .then(res => res.json().then(data => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
            if (!ok || !data.ok) {
                alert(data.error || "Não foi possível localizar a cidade.");
                return;
            }

            const lat = data.lat;
            const lon = data.lon;
            const label = data.display || q;

            map.flyTo([lat, lon], 12, { duration: 0.8 });

            if (markerCidade) map.removeLayer(markerCidade);

            markerCidade = L.marker([lat, lon]).addTo(map)
                .bindPopup(label)
                .openPopup();
        })
        .catch(() => alert("Erro ao buscar cidade."));
}

// Clique na lupa
document.getElementById("btnBuscarCidade")?.addEventListener("click", () => {
    irParaCidade(document.getElementById("buscaCidade")?.value);
});

// Enter no input
document.getElementById("buscaCidade")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        irParaCidade(e.target.value);
    }
});

// ✅ AO DIGITAR (debounce)
const buscaCidadeInput = document.getElementById("buscaCidade");
if (buscaCidadeInput) {
    const debounced = debounce(() => {
        const v = buscaCidadeInput.value.trim();
        if (v.length >= 3) irParaCidade(v);
    }, 700);

    buscaCidadeInput.addEventListener("input", debounced);
}

    // ========================================================
    // 4) MARCADORES MANUAIS – CARREGAR DO BANCO
    // ========================================================
    fetch("/api/mapa/marcadores-manuais/")
        .then(res => res.json())
        .then(lista => {
            lista.forEach(m => {
                const marker = L.marker([m.lat, m.lon], { icon: icons["default"] }).addTo(map);

                marker._isManual = true;
                marker._id = m.id;
                marker._texto = m.texto || "";

                marker.bindPopup(popupFinal(marker._texto));
            });
        });

    // garante referência correta ao abrir popup
    map.on("popupopen", e => {
        if (e.popup && e.popup._source && e.popup._source._isManual) {
            lastManualMarker = e.popup._source;
        }
    });

    // ========================================================
    // 5) DOUBLE CLICK → MODAL
    // ========================================================
    map.on("dblclick", function (e) {
        document.getElementById("novoLat").value = e.latlng.lat;
        document.getElementById("novoLon").value = e.latlng.lng;

        window.modalNovoMarcador = new bootstrap.Modal(
            document.getElementById("modalNovoMarcador")
        );
        window.modalNovoMarcador.show();
    });

    // ========================================================
    // 6) CONFIRMAR NOVO MARCADOR
    // ========================================================
    document.getElementById("btnConfirmarNovoMarcador")
        .addEventListener("click", function () {

            window.modalNovoMarcador.hide();

            const lat = parseFloat(document.getElementById("novoLat").value);
            const lon = parseFloat(document.getElementById("novoLon").value);

            const marker = L.marker([lat, lon], { icon: icons["default"] }).addTo(map);

            marker._isManual = true;
            marker._id = null;
            marker._texto = "";

            lastManualMarker = marker;

            abrirPopupEdicao(marker);
        });

});

// ========================================================
// POPUPS
// ========================================================
function popupFinal(texto) {
    return `
        ${texto.replace(/\n/g, "<br>")}<br><br>
        <button class="btn btn-warning btn-sm" onclick="editarMarcadorManual()">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="excluirMarcadorManual()">Excluir</button>
    `;
}

function abrirPopupEdicao(marker) {
    marker.bindPopup(`
        <div class="popup-marcador-manual">
            <textarea
                id="textoMarcador"
                class="form-control"
                rows="6"
                placeholder="Digite a cidade (ex: Cuiabá, MT)"
                style="resize: vertical;"
            >${marker._texto || ""}</textarea>

            <div class="mt-2 text-end">
                <button class="btn btn-success btn-sm" onclick="salvarMarcadorManual()">
                    Salvar
                </button>
            </div>
        </div>
    `, {
        maxWidth: 320
    }).openPopup();
}


// ========================================================
// SALVAR (POST / PUT)
// ========================================================
function salvarMarcadorManual() {

    if (!lastManualMarker) return;

    const texto = document.getElementById("textoMarcador").value.trim();
    if (!texto) {
        alert("Digite algum texto.");
        return;
    }

    lastManualMarker._texto = texto;

    const base = "/api/mapa/marcadores-manuais/";
    const temId = !!lastManualMarker._id;
    const url = temId ? `${base}${lastManualMarker._id}/` : base;
    const method = temId ? "PUT" : "POST";

    const latlng = lastManualMarker.getLatLng();
    const payload = temId
        ? { texto }
        : { lat: latlng.lat, lon: latlng.lng, texto };

    fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (!temId && data.id) lastManualMarker._id = data.id;
        lastManualMarker.bindPopup(popupFinal(texto)).openPopup();
    })
    .catch(() => alert("Erro ao salvar marcador."));
}

// ========================================================
// EDITAR
// ========================================================
function editarMarcadorManual() {
    if (!lastManualMarker) return;
    abrirPopupEdicao(lastManualMarker);
}

// ========================================================
// EXCLUIR (DELETE)
// ========================================================
function excluirMarcadorManual() {

    if (!lastManualMarker) return;
    if (!confirm("Deseja excluir este marcador?")) return;

    const id = lastManualMarker._id;

    if (id) {
        fetch(`/api/mapa/marcadores-manuais/${id}/`, { method: "DELETE" })
            .then(() => {
                map.removeLayer(lastManualMarker);
                lastManualMarker = null;
            })
            .catch(() => alert("Erro ao excluir marcador."));
    } else {
        map.removeLayer(lastManualMarker);
        lastManualMarker = null;
    }
}

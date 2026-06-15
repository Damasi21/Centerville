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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // ========================================================
    // 2) ÍCONES
    // ========================================================
    function tipoMarcadorPorSegmentacao(segmentacao) {
        const seg = (segmentacao || "").toLowerCase().trim();
        const tipos = {
            "construtora": "construtora",
            "executor de piso": "executor",
            "concreteira": "concreteira",
            "parceiros/influenciadores": "parceiro",
            "outros": "outros"
        };

        return tipos[seg] || "cliente";
    }

    function criarIconeMapa(tipo) {
        return L.divIcon({
            className: `map-marker map-marker-${tipo || "cliente"}`,
            html: '<span class="map-marker-pin"><span class="map-marker-core"></span></span>',
            iconSize: [34, 42],
            iconAnchor: [17, 40],
            popupAnchor: [0, -36]
        });
    }


 // ========================================================
// 3) CLIENTES NO MAPA (COM FILTROS)
// ========================================================
const markersGroup = L.featureGroup().addTo(map);
const marcadoresManuaisGroup = L.featureGroup().addTo(map);

function limparClientesDoMapa() {
    markersGroup.clearLayers();
}

function filtroSegmentacaoAtivo() {
    return !!(document.getElementById("filtroSegmentacao")?.value || "").trim();
}

function atualizarMarcadoresManuaisVisibilidade() {
    if (filtroSegmentacaoAtivo()) {
        if (map.hasLayer(marcadoresManuaisGroup)) {
            map.removeLayer(marcadoresManuaisGroup);
        }
        return;
    }

    if (!map.hasLayer(marcadoresManuaisGroup)) {
        marcadoresManuaisGroup.addTo(map);
    }
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
    atualizarMarcadoresManuaisVisibilidade();

    const qs = montarQueryFiltros();

    fetch(`/api/clientes/mapa/${qs}`)
        .then(res => res.json())
        .then(dados => {

            dados.forEach(c => {
                if (!c.lat || !c.lon) return;

                let tipoMarcador = "cliente";

                if (Array.isArray(c.segmentacoes) && c.segmentacoes.length > 0) {
                    tipoMarcador = tipoMarcadorPorSegmentacao(c.segmentacoes[0]);
                }

                const marker = L.marker([c.lat, c.lon], {
                    icon: criarIconeMapa(tipoMarcador)
                }).addTo(markersGroup);

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
    const sg = document.getElementById("filtroSegmentacao");
    const cd = document.getElementById("filtroCidade");
    if (sg) sg.value = "";
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

    // ========================================================
    // 4) MARCADORES MANUAIS – CARREGAR DO BANCO
    // ========================================================
    fetch("/api/mapa/marcadores-manuais/")
        .then(res => res.json())
        .then(lista => {
            lista.forEach(m => {
                const marker = L.marker([m.lat, m.lon], {
                    icon: criarIconeMapa("manual")
                }).addTo(marcadoresManuaisGroup);

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

            const marker = L.marker([lat, lon], {
                icon: criarIconeMapa("manual")
            }).addTo(marcadoresManuaisGroup);

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

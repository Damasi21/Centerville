document.addEventListener("DOMContentLoaded", () => {
    let textareaAtual = null;
    let formAtual = null;
    const modalEl = document.getElementById("modalTextoAtividade");
    const modalCampo = document.getElementById("modalTextoAtividadeCampo");
    const modalSalvar = document.getElementById("modalTextoAtividadeSalvar");
    const modalMic = document.getElementById("modalTextoAtividadeMic");
    const modalMicStatus = document.getElementById("modalTextoAtividadeMicStatus");
    const modalMicErro = document.getElementById("modalTextoAtividadeMicErro");
    let gravador = null;
    let audioChunks = [];
    let streamAtual = null;

    if (modalEl && modalEl.parentElement !== document.body) {
        document.body.appendChild(modalEl);
    }

    const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

    function aplicarTextoPronto(select) {
        if (select.classList.contains("crm-select-bloqueado")) {
            return;
        }

        const option = select.options[select.selectedIndex];
        const texto = option?.dataset?.texto || "";
        const container = select.closest("form");
        const textarea = container?.querySelector("textarea[name='texto']");

        if (!textarea || !texto) return;

        const textoAtual = textarea.value.trim();
        const textoAnterior = textarea.dataset.textoProntoAtual || "";

        if (!textoAtual || textoAtual === textoAnterior) {
            textarea.value = texto;
            textarea.dataset.textoProntoAtual = texto;
        }
    }

    function bloquearSelectDoForm(form) {
        const select = form?.querySelector(".crm-tipo-select");
        if (!select) return;
        select.dataset.valorBloqueado = select.value;
        select.classList.add("crm-select-bloqueado");
    }

    function desbloquearSelectDoForm(form) {
        const select = form?.querySelector(".crm-tipo-select");
        if (!select) return;
        select.classList.remove("crm-select-bloqueado");
    }

    function marcarLinhaComoSalva(form) {
        const status = form?.closest("tr")?.querySelector(".crm-status-texto");
        if (!status) return;
        status.innerHTML = '<span class="badge bg-primary">Salvo</span>';
    }

    function marcarLinhaComoPendente(form) {
        const status = form?.closest("tr")?.querySelector(".crm-status-texto");
        if (!status) return;
        status.innerHTML = '<span class="text-muted">Pendente</span>';
    }

    function tipoCategoriaDoForm(form) {
        const formId = form?.id;
        if (!formId) return null;
        return document.querySelector(`select[name="tipo_categoria"][form="${formId}"]`);
    }

    async function salvarTextoAtividade(form, texto) {
        const tipoCategoria = tipoCategoriaDoForm(form);

        if (!tipoCategoria?.value) {
            throw new Error("Selecione o Tipo antes de salvar o texto.");
        }

        const formData = new FormData(form);
        formData.set("texto", texto);
        formData.set("tipo_categoria", tipoCategoria.value);

        const response = await fetch(form.dataset.salvarTextoUrl, {
            method: "POST",
            headers: {"X-CSRFToken": getCsrfToken()},
            body: formData,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload.ok === false) {
            throw new Error(payload.error || "Nao foi possivel salvar o texto da atividade.");
        }

        return payload;
    }

    function getCsrfToken() {
        const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : "";
    }

    function mostrarErroAudio(mensagem) {
        if (!modalMicErro) return;
        modalMicErro.textContent = mensagem;
        modalMicErro.classList.remove("d-none");
    }

    function limparErroAudio() {
        if (!modalMicErro) return;
        modalMicErro.textContent = "";
        modalMicErro.classList.add("d-none");
    }

    function setStatusAudio(texto) {
        if (modalMicStatus) modalMicStatus.textContent = texto;
    }

    function setBotaoGravando(gravando) {
        if (!modalMic) return;
        modalMic.classList.toggle("btn-danger", gravando);
        modalMic.classList.toggle("btn-outline-danger", !gravando);
        modalMic.innerHTML = gravando
            ? '<i class="bi bi-stop-circle"></i> Parar gravacao'
            : '<i class="bi bi-mic"></i> Gravar audio';
    }

    function pararStreamAudio() {
        streamAtual?.getTracks().forEach((track) => track.stop());
        streamAtual = null;
    }

    async function enviarAudio(blob) {
        if (!modalMic?.dataset.url) return;

        const formData = new FormData();
        formData.append("audio", blob, "atividade.webm");
        setStatusAudio("Transcrevendo audio...");

        const response = await fetch(modalMic.dataset.url, {
            method: "POST",
            headers: {"X-CSRFToken": getCsrfToken()},
            body: formData,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.ok) {
            throw new Error(payload.error || "Nao foi possivel transcrever o audio.");
        }

        const textoTranscrito = (payload.texto || "").trim();
        if (textoTranscrito) {
            const textoAtual = modalCampo.value.trim();
            modalCampo.value = textoAtual ? `${textoAtual}\n${textoTranscrito}` : textoTranscrito;
        }

        setStatusAudio("Transcricao adicionada ao texto.");
    }

    async function iniciarGravacao() {
        limparErroAudio();

        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            mostrarErroAudio("Este navegador nao permite gravacao de audio nesta tela.");
            return;
        }

        streamAtual = await navigator.mediaDevices.getUserMedia({audio: true});
        audioChunks = [];
        gravador = new MediaRecorder(streamAtual);

        gravador.addEventListener("dataavailable", (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        });

        gravador.addEventListener("stop", async () => {
            setBotaoGravando(false);
            pararStreamAudio();

            try {
                const blob = new Blob(audioChunks, {type: gravador.mimeType || "audio/webm"});
                await enviarAudio(blob);
            } catch (error) {
                mostrarErroAudio(error.message || "Erro ao transcrever o audio.");
                setStatusAudio("");
            } finally {
                gravador = null;
                audioChunks = [];
            }
        });

        gravador.start();
        setBotaoGravando(true);
        setStatusAudio("Gravando... clique novamente para parar.");
    }

    function pararGravacao() {
        if (gravador && gravador.state !== "inactive") {
            gravador.stop();
            setStatusAudio("Preparando audio...");
        }
    }

    document.querySelectorAll(".crm-tipo-select").forEach((select) => {
        select.addEventListener("change", () => aplicarTextoPronto(select));
        aplicarTextoPronto(select);
    });

    document.querySelectorAll(".crm-texto-btn").forEach((button) => {
        button.addEventListener("click", () => {
            if (!modal || !modalCampo || !modalSalvar) return;

            const somenteLeitura = button.dataset.readonly === "true";
            const form = button.closest("form");
            formAtual = somenteLeitura ? null : form;
            textareaAtual = somenteLeitura ? null : form?.querySelector("textarea[name='texto']");

            modalCampo.value = somenteLeitura ? (button.dataset.texto || "") : (textareaAtual?.value || "");
            modalCampo.readOnly = somenteLeitura;
            modalSalvar.classList.toggle("d-none", somenteLeitura);
            modalMic?.classList.toggle("d-none", somenteLeitura);
            setStatusAudio("");
            limparErroAudio();
            modal.show();
        });
    });

    document.querySelectorAll(".crm-editar-tipo-btn").forEach((button) => {
        button.addEventListener("click", () => {
            const form = button.closest("tr")?.querySelector("form");
            desbloquearSelectDoForm(form);
            marcarLinhaComoPendente(form);
        });
    });

    modalMic?.addEventListener("click", async () => {
        try {
            if (gravador && gravador.state === "recording") {
                pararGravacao();
                return;
            }
            await iniciarGravacao();
        } catch (error) {
            setBotaoGravando(false);
            pararStreamAudio();
            mostrarErroAudio(error.message || "Nao foi possivel acessar o microfone.");
            setStatusAudio("");
        }
    });

    modalEl?.addEventListener("hidden.bs.modal", () => {
        pararGravacao();
        pararStreamAudio();
        setBotaoGravando(false);
        setStatusAudio("");
    });

    modalSalvar?.addEventListener("click", async () => {
        if (textareaAtual && modalCampo) {
            try {
                modalSalvar.disabled = true;
                await salvarTextoAtividade(formAtual, modalCampo.value);
                textareaAtual.value = modalCampo.value;
                textareaAtual.dataset.textoProntoAtual = modalCampo.value;
                bloquearSelectDoForm(formAtual);
                marcarLinhaComoSalva(formAtual);
                modal?.hide();
            } catch (error) {
                alert(error.message || "Erro ao salvar o texto.");
            } finally {
                modalSalvar.disabled = false;
            }
            return;
        }
        modal?.hide();
    });

});

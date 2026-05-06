from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from .models import Cliente, Contato, Segmentacao, OrigemCliente
from .forms import ClienteForm, SegmentacaoForm, OrigemClienteForm, UsuarioForm
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
import requests
import json
import re
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import MarcadorManual
from .models import CRMRegistro
from .models import AnexoCliente
from django.utils.dateparse import parse_datetime
from django.utils import timezone
from django.db.models import Q
from .models import Obra,ObraCliente
from .forms import ObraForm
from .models import AnexoObra
from django.utils.http import url_has_allowed_host_and_scheme
def index(request):
    return render(request, "index.html")


def tela_login(request):
    if request.user.is_authenticated:
        return redirect("index")

    can_create_first_user = not User.objects.exists()

    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        next_url = request.POST.get("next") or request.GET.get("next")
        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            if not request.POST.get("remember"):
                request.session.set_expiry(0)

            if next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
                return redirect(next_url)

            return redirect("index")

        messages.error(request, "Usuario ou senha invalidos.")

    return render(request, "tela_login.html", {"can_create_first_user": can_create_first_user})


def sair(request):
    logout(request)
    return redirect("tela_login")

#--------------------------------------------------------------
# LISTAGEM DE CLIENTES
#--------------------------------------------------------------
def clientes_list(request):
    clientes = Cliente.objects.all().order_by("-id")
    obras = Obra.objects.all().order_by("-id")
    return render(request, "cadastro_clientes.html", {
        "clientes": clientes,
        "obras": obras,
    })

# ----------------------------------------------------------
# NOVO CLIENTE
# ----------------------------------------------------------
def cliente_novo(request):

    if request.method == "POST":
        form = ClienteForm(request.POST)

        if form.is_valid():
            # NÃO salva ainda, vamos montar o endereço e setar lat/lon
            cliente = form.save(commit=False)

            # Usa os dados JÁ VALIDADOS do form
            endereco_str = f"{form.cleaned_data.get('endereco') or ''}, " \
                           f"{form.cleaned_data.get('numero') or ''}, " \
                           f"{form.cleaned_data.get('bairro') or ''}, " \
                           f"{form.cleaned_data.get('cidade') or ''}, " \
                           f"{form.cleaned_data.get('estado') or ''}, " \
                           f"{form.cleaned_data.get('cep') or ''}"

            # Geocodifica
            lat, lon = geocodificar_endereco(endereco_str)

            # Tentativa 2 → usar apenas cidade + estado
            if lat is None or lon is None:
                cidade_estado = f"{form.cleaned_data.get('cidade')}, {form.cleaned_data.get('estado')}"
                lat, lon = geocodificar_endereco(cidade_estado)

            # Se conseguir coordenadas, grava; senão deixa como None
            cliente.latitude = lat
            cliente.longitude = lon

            # ⚠ OPCIONAL: se você QUISER garantir um ponto qualquer no mapa
            # mesmo sem geocodificação, descomente as 2 linhas abaixo:
            #
            # if cliente.latitude is None or cliente.longitude is None:
            #     cliente.latitude, cliente.longitude = -23.5505, -46.6333  # São Paulo centro

            cliente.save()
            form.save_m2m()  # segmentação / status

            # Contatos (JSON vindo do form via clientes.js)
            contatos_json = request.POST.get("contatos_json")
            if contatos_json:
                try:
                    contatos = json.loads(contatos_json)
                    for c in contatos:
                        Contato.objects.create(
                            cliente=cliente,
                            nome=c.get("nome", ""),
                            telefone1=c.get("telefone1", ""),
                            telefone2=c.get("telefone2", ""),
                            linkedin=c.get("linkedin", ""),
                            email=c.get("email", ""),
                            
                        )
                except Exception as e:
                    print(f"⚠ Erro ao salvar contatos JSON: {e}")

            messages.success(request, "Cliente cadastrado com sucesso!")
            # Continua indo pra lista de clientes
            return redirect("cadastro_clientes")

        else:
            # Se não é válido, mostra erros normalmente
            print("❌ Form ClienteForm inválido:", form.errors)

    else:
        form = ClienteForm()

    return render(request, "clientes.form.html", {"form": form, "modo": "novo"})


# ----------------------------------------------------------
# EDITAR CLIENTE
# ----------------------------------------------------------
def cliente_editar(request, id):
    cliente = get_object_or_404(Cliente, id=id)

    if request.method == "POST":
        form = ClienteForm(request.POST, instance=cliente)

        if form.is_valid():
            cliente = form.save(commit=False)

            # Valores vindos do form (frontend)
            lat_input = request.POST.get("latitude")
            lon_input = request.POST.get("longitude")

            # ---------------------------------------------------
            # 1) SE O USUÁRIO DIGITOU LAT/LON MANUALMENTE
            # ---------------------------------------------------
            if lat_input or lon_input:
                try:
                    cliente.latitude = float(lat_input.replace(",", ".")) if lat_input else None
                    cliente.longitude = float(lon_input.replace(",", ".")) if lon_input else None
                except:
                    print("⚠ Erro convertendo lat/lon manual.")
                    cliente.latitude = None
                    cliente.longitude = None

            # ---------------------------------------------------
            # 2) SENÃO → GEOCODIFICA SEMPRE O ENDEREÇO ATUALIZADO
            # ---------------------------------------------------
            else:
                endereco_str = f"{form.cleaned_data.get('endereco') or ''}, " \
                               f"{form.cleaned_data.get('numero') or ''}, " \
                               f"{form.cleaned_data.get('bairro') or ''}, " \
                               f"{form.cleaned_data.get('cidade') or ''}, " \
                               f"{form.cleaned_data.get('estado') or ''}, " \
                               f"{form.cleaned_data.get('cep') or ''}"

                print(f"🔎 Re-geocodificando cliente (editar): {endereco_str}")
                lat, lon = geocodificar_endereco(endereco_str)

                cliente.latitude = lat
                cliente.longitude = lon

            # ---------------------------------------------------
            # SALVAR CLIENTE
            # ---------------------------------------------------
            cliente.save()
            form.save_m2m()

            # ---------------------------------------------------
            # ATUALIZAR CONTATOS
            # ---------------------------------------------------
            cliente.contatos.all().delete()   # remove contatos antigos

            contatos_json = request.POST.get("contatos_json")
            if contatos_json:
                try:
                    contatos = json.loads(contatos_json)
                    for c in contatos:
                        Contato.objects.create(
                            cliente=cliente,
                            nome=c.get("nome", ""),
                            telefone1=c.get("telefone1", ""),
                            telefone2=c.get("telefone2", ""),
                            linkedin=c.get("linkedin", ""),
                            email=c.get("email", ""),
                            
                        )
                except Exception as e:
                    print(f"⚠ Erro salvando contatos: {e}")

            messages.success(request, "Cliente atualizado com sucesso!")
            return redirect("cadastro_clientes")

    else:
        form = ClienteForm(instance=cliente)

    return render(request, "clientes.form.html", {
        "form": form,
        "cliente": cliente,
        "modo": "editar",
        "obras": cliente.obras.all().order_by("-id")
    })

# ----------------------------------------------------------
# EXCLUIR CLIENTE
# ----------------------------------------------------------

def cliente_excluir(request, id):
    cliente = get_object_or_404(Cliente, id=id)

    cliente.delete()
    messages.success(request, "cliente_excluido")
    return redirect("cadastro_clientes")

# ----------------------------------------------------------
# ANEXO CLIENTE
# ----------------------------------------------------------

@require_http_methods(["POST"])
def anexo_upload(request, id):
    cliente = get_object_or_404(Cliente, id=id)

    arquivo = request.FILES.get("arquivo")
    if not arquivo:
        return JsonResponse({"error": "Arquivo não enviado"}, status=400)

    anexo = AnexoCliente.objects.create(
        cliente=cliente,
        arquivo=arquivo,
        nome_original=arquivo.name
    )

    return JsonResponse({
        "id": anexo.id,
        "nome": anexo.nome_original,
        "url": anexo.arquivo.url
    })
    
# ----------------------------------------------------------
# EXCLUIR ANEXO CLIENTE
# ----------------------------------------------------------

@require_http_methods(["DELETE"])
def anexo_excluir(request, id):
    anexo = get_object_or_404(AnexoCliente, id=id)

    # apaga o arquivo físico
    if anexo.arquivo:
        anexo.arquivo.delete(save=False)

    # apaga o registro
    anexo.delete()

    return JsonResponse({"status": "ok"})


# ----------------------------------------------------------
# GEOCODIFICAÇÃO BACKEND
# ----------------------------------------------------------
def geocodificar_endereco(endereco):
    """
    Tenta geocodificar o endereço.
    Se der erro, loga no console e retorna (None, None).
    """
    try:
        if not endereco or endereco.strip() == ",":
            print("⚠ geocodificar_endereco: endereço vazio")
            return None, None

        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": endereco.replace("(", ", ").replace(")", ""),  # "Sorocaba (SP)" -> "Sorocaba, SP"
            "format": "json",
            "limit": 1,
            "countrycodes": "br",
        }
        headers = {"User-Agent": "CENTERVILLE-App"}

        print(f"🔎 Geocodificando endereço: {endereco}")
        r = requests.get(url, params=params, headers=headers, timeout=10)

        if r.status_code != 200:
            print(f"⚠ Erro HTTP Nominatim: {r.status_code} - {r.text[:200]}")
            return None, None

        data = r.json()
        if not data:
            print("⚠ Nominatim não retornou resultados para esse endereço.")
            return None, None

        lat = float(data[0]["lat"])
        lon = float(data[0]["lon"])
        display = data[0].get("display_name", "")

        print(f"✅ Coordenadas obtidas: lat={lat}, lon={lon}")
        return lat, lon

    except Exception as e:
        print(f"❌ Erro em geocodificar_endereco: {e}")
        return None, None
#--------------------------------------------------------------

def geocodificar_cidade(cidade_txt: str):
    try:
        if not cidade_txt or not cidade_txt.strip():
            return None, None, None

        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": cidade_txt.replace("(", ", ").replace(")", ""),
            "format": "jsonv2",
            "limit": 5,
            "countrycodes": "br",
            "addressdetails": 1,
        }
        headers = {"User-Agent": "CENTERVILLE-App", "Accept-Language": "pt-BR"}

        r = requests.get(url, params=params, headers=headers, timeout=10)
        if r.status_code != 200:
            return None, None, None

        data = r.json()
        if not data:
            return None, None, None

        # Preferir resultados "place" que sejam cidades
        preferidos = {"city", "town", "municipality", "village", "hamlet"}
        melhor = None
        melhor_score = -1

        for item in data:
            cls = (item.get("class") or "").lower()
            typ = (item.get("type") or "").lower()
            importance = float(item.get("importance") or 0)

            score = 0
            if cls == "place" and typ in preferidos:
                score = 100
            elif cls == "boundary" and typ == "administrative":
                score = 50
            else:
                score = 10

            # desempate por importance
            score += importance

            if score > melhor_score:
                melhor_score = score
                melhor = item

        if not melhor:
            melhor = data[0]

        lat = float(melhor["lat"])
        lon = float(melhor["lon"])
        display = melhor.get("display_name") or cidade_txt

        return lat, lon, display

    except Exception:
        return None, None, None

#--------------------------------------------------------------
# API PARA MAPA
#--------------------------------------------------------------
@require_http_methods(["GET"])
def api_clientes_mapa(request):

    segmentacao = (request.GET.get("segmentacao") or "").strip()
    cidade = (request.GET.get("cidade") or "").strip()

    qs = Cliente.objects.all()

    # só clientes com coordenadas
    qs = qs.exclude(latitude__isnull=True).exclude(longitude__isnull=True)

    # 🔹 FILTRO POR SEGMENTAÇÃO (ManyToMany)
    if segmentacao:
        qs = qs.filter(segmentacao__nome__iexact=segmentacao)

    # 🔹 FILTRO POR CIDADE
    if cidade:
        qs = qs.filter(cidade__icontains=cidade)

    dados = []
    for c in qs:
        segmentacoes = [s.nome.lower() for s in c.segmentacao.all()]

        dados.append({
            "id": c.id,
            "nome": c.nome_interno,
            "cnpj_cpf": c.cnpj_cpf,
            "cidade": c.cidade,
            "estado": c.estado,
            "segmentacoes": segmentacoes,
            "lat": c.latitude,
            "lon": c.longitude,
        })

    return JsonResponse(dados, safe=False)

#--------------------------------------------------------------
def mapa_clientes(request):
    return render(request, "mapa_clientes.html")

#--------------------------------------------------------------

@require_http_methods(["GET"])
def api_clientes_mapa_filtros(request):
    # cidades (somente onde existe coordenada)
    cidades = (
        Cliente.objects
        .exclude(latitude__isnull=True).exclude(longitude__isnull=True)
        .exclude(cidade__isnull=True).exclude(cidade__exact="")
        .values_list("cidade", flat=True)
        .distinct()
        .order_by("cidade")
    )

    # origens cadastradas (lista geral)
    segmentacoes_list = Segmentacao.objects.all().order_by("nome").values_list("nome", flat=True)


    return JsonResponse({
        "cidades": list(cidades),
        "segmentacoes": list(segmentacoes_list),
    })

#--------------------------------------------------------------

@require_http_methods(["GET"])
def api_geocode(request):
    q = (request.GET.get("q") or "").strip()
    if not q:
        return JsonResponse({"ok": False, "error": "Informe uma cidade."}, status=400)

    lat, lon, display = geocodificar_cidade(q)

    # fallback: força Brasil
    if lat is None or lon is None:
        lat, lon, display = geocodificar_cidade(f"{q}, Brasil")

    if lat is None or lon is None:
        return JsonResponse({"ok": False, "error": "Cidade não encontrada."}, status=404)

    return JsonResponse({"ok": True, "lat": lat, "lon": lon, "display": display})


#--------------------------------------------------------------
# CONFIGURAÇÕES
#--------------------------------------------------------------
def configuracoes(request):
    return render(request, "configuracoes.html")


#--------------------------------------------------------------
# SEGMENTAÇÃO CRUD
#--------------------------------------------------------------
def segmentacao_list(request):
    segmentacoes = Segmentacao.objects.all().order_by("nome")
    return render(request, "segmentacao_list.html", {"segmentacoes": segmentacoes})


def segmentacao_novo(request):
    if request.method == "POST":
        form = SegmentacaoForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("segmentacao_list")
    else:
        form = SegmentacaoForm()
    return render(request, "segmentacao_form.html", {"form": form, "modo": "novo"})


def segmentacao_editar(request, id):
    seg = get_object_or_404(Segmentacao, id=id)
    if request.method == "POST":
        form = SegmentacaoForm(request.POST, instance=seg)
        if form.is_valid():
            form.save()
            return redirect("segmentacao_list")
    else:
        form = SegmentacaoForm(instance=seg)
    return render(request, "segmentacao_form.html", {"form": form, "modo": "editar"})


def segmentacao_excluir(request, id):
    seg = get_object_or_404(Segmentacao, id=id)
    seg.delete()
    return redirect("segmentacao_list")


#--------------------------------------------------------------
# STATUS CRUD
#--------------------------------------------------------------
def origemcliente_list(request):
    origens = OrigemCliente.objects.all().order_by("nome")
    return render(request, "origemcliente_list.html", {"origens": origens})


def origemcliente_novo(request):
    if request.method == "POST":
        form = OrigemClienteForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("origemcliente_list")
    else:
        form = OrigemClienteForm()
    return render(request, "origemcliente_form.html", {"form": form, "modo": "novo"})


def origemcliente_editar(request, id):
    origem = get_object_or_404(OrigemCliente, id=id)
    if request.method == "POST":
        form = OrigemClienteForm(request.POST, instance=origem)
        if form.is_valid():
            form.save()
            return redirect("origemcliente_list")
    else:
        form = OrigemClienteForm(instance=origem)
    return render(request, "origemcliente_form.html", {"form": form, "modo": "editar"})


def origemcliente_excluir(request, id):
    origem = get_object_or_404(OrigemCliente, id=id)
    origem.delete()
    return redirect("origemcliente_list")


#--------------------------------------------------------------
# USUARIOS CRUD
#--------------------------------------------------------------
def usuario_admin_principal():
    return User.objects.order_by("id").first()


def usuario_requer_superuser(request):
    admin = usuario_admin_principal()

    if admin and request.user.id != admin.id:
        messages.error(request, "Apenas o usuario Admin pode gerenciar usuarios.")
        return redirect("configuracoes")

    return None


def usuario_list(request):
    bloqueio = usuario_requer_superuser(request)
    if bloqueio:
        return bloqueio

    usuarios = User.objects.all().order_by("username")
    admin = usuario_admin_principal()
    return render(request, "usuario_list.html", {
        "usuarios": usuarios,
        "admin_principal_id": admin.id if admin else None,
    })


def usuario_novo(request):
    bloqueio = usuario_requer_superuser(request)
    if bloqueio:
        return bloqueio

    primeiro_usuario = not User.objects.exists()

    if request.method == "POST":
        form = UsuarioForm(request.POST)
        if form.is_valid():
            usuario = form.save()

            if primeiro_usuario:
                usuario.is_superuser = True
                usuario.is_staff = True
                login(request, usuario, backend="django.contrib.auth.backends.ModelBackend")
            else:
                usuario.is_superuser = False
                usuario.is_staff = False

            usuario.save()

            messages.success(request, "Usuario cadastrado com sucesso!")
            return redirect("usuario_list")
    else:
        form = UsuarioForm(initial={"is_active": True})

    return render(request, "usuario_form.html", {
        "form": form,
        "modo": "novo",
        "primeiro_usuario": primeiro_usuario,
    })


def usuario_editar(request, id):
    bloqueio = usuario_requer_superuser(request)
    if bloqueio:
        return bloqueio

    usuario = get_object_or_404(User, id=id)

    if request.method == "POST":
        form = UsuarioForm(request.POST, instance=usuario)
        if form.is_valid():
            usuario = form.save()
            admin = usuario_admin_principal()

            if admin and usuario.id == admin.id:
                usuario.is_superuser = True
                usuario.is_staff = True
            else:
                usuario.is_superuser = False
                usuario.is_staff = False

            usuario.save()
            messages.success(request, "Usuario atualizado com sucesso!")
            return redirect("usuario_list")
    else:
        form = UsuarioForm(instance=usuario)

    return render(request, "usuario_form.html", {"form": form, "modo": "editar", "usuario": usuario})


def usuario_excluir(request, id):
    bloqueio = usuario_requer_superuser(request)
    if bloqueio:
        return bloqueio

    usuario = get_object_or_404(User, id=id)
    admin = usuario_admin_principal()

    if admin and usuario.id == admin.id:
        messages.error(request, "O usuario Admin principal nao pode ser excluido.")
        return redirect("usuario_list")

    if request.user.id == usuario.id:
        messages.error(request, "Voce nao pode excluir o usuario que esta usando agora.")
        return redirect("usuario_list")

    usuario.delete()
    messages.success(request, "Usuario excluido com sucesso!")
    return redirect("usuario_list")

#--------------------------------------------------------------
# BUSCAR CNPJ VIA API
#--------------------------------------------------------------

@require_http_methods(["GET"])
def buscar_cnpj(request, cnpj):
    cnpj = "".join([c for c in (cnpj or "") if c.isdigit()])

    if len(cnpj) != 14:
        return JsonResponse({"status": "ERROR", "message": "CNPJ inválido."}, status=400)

    try:
        url = f"https://open.cnpja.com/office/{cnpj}"
        r = requests.get(url, timeout=15)

        if r.status_code == 404:
            return JsonResponse({"status": "ERROR", "message": "CNPJ não encontrado."}, status=404)

        if r.status_code != 200:
            return JsonResponse({"status": "ERROR", "message": "Erro ao consultar CNPJá."}, status=502)

        raw = r.json()

        # Alguns retornos vêm como { office: {...}, company: {...} }
        # Outros vêm direto como "office" no topo
        office = raw.get("office") if isinstance(raw, dict) else None
        if not isinstance(office, dict):
            office = raw if isinstance(raw, dict) else {}

        company = raw.get("company") if isinstance(raw, dict) else None
        if not isinstance(company, dict):
            company = office.get("company", {}) if isinstance(office, dict) else {}

        # address pode estar no topo OU dentro de office
        address = office.get("address") if isinstance(office, dict) else {}
        if not isinstance(address, dict) or not address:
            address = raw.get("address", {}) if isinstance(raw, dict) else {}
        if not isinstance(address, dict):
            address = {}

        def pick_str(*vals):
            for v in vals:
                if isinstance(v, str) and v.strip():
                    return v.strip()
            return ""

        # Razão social
        nome = pick_str(
            company.get("name"),
            company.get("nome"),
            company.get("razao_social"),
            office.get("name"),
            office.get("nome"),
            office.get("razao_social"),
            raw.get("name") if isinstance(raw, dict) else "",
            raw.get("nome") if isinstance(raw, dict) else "",
            raw.get("razao_social") if isinstance(raw, dict) else "",
        )

        # Nome fantasia (tenta várias chaves possíveis)
        fantasia = pick_str(
            office.get("alias"),
            office.get("fantasia"),
            office.get("tradeName"),
            office.get("trade_name"),
            office.get("nome_fantasia"),

            company.get("alias"),
            company.get("fantasia"),
            company.get("tradeName"),
            company.get("trade_name"),
            company.get("nome_fantasia"),

            raw.get("alias") if isinstance(raw, dict) else "",
            raw.get("fantasia") if isinstance(raw, dict) else "",
            raw.get("tradeName") if isinstance(raw, dict) else "",
            raw.get("trade_name") if isinstance(raw, dict) else "",
            raw.get("nome_fantasia") if isinstance(raw, dict) else "",
        )

        return JsonResponse({
            "status": "OK",
            "nome": nome,
            "fantasia": fantasia,

            "logradouro": pick_str(address.get("street"), address.get("logradouro")),
            "numero": pick_str(address.get("number"), address.get("numero")),
            "complemento": pick_str(address.get("details"), address.get("complemento")),
            "bairro": pick_str(address.get("district"), address.get("bairro")),
            "cep": pick_str(address.get("zip"), address.get("cep")),
            "municipio": pick_str(address.get("city"), address.get("municipio"), address.get("cidade")),
            "uf": pick_str(address.get("state"), address.get("uf")),
        })

    except Exception as e:
        return JsonResponse({"status": "ERROR", "message": f"Erro ao consultar CNPJá: {e}"}, status=500)

#--------------------------------------------------------------
# OUTRAS PÁGINAS
#--------------------------------------------------------------
def cadastro_produtos(request):
    return render(request, 'cadastro_produtos.html')


def cadastro_materiais_concorrentes(request):
    return render(request, 'cadastro_materiais_concorrentes.html')


def proposta_tecnica(request):
    return render(request, 'proposta_tecnica.html')

#--------------------------------------------------------------
# MARCADORES DE MAPAS 
#--------------------------------------------------------------

@csrf_exempt
@require_http_methods(["GET", "POST"])
def api_marcadores_manuais(request):
    if request.method == "GET":
        marcadores = MarcadorManual.objects.all().order_by("id")
        dados = [{
            "id": m.id,
            "lat": m.latitude,
            "lon": m.longitude,
            "texto": m.texto or "",
        } for m in marcadores]
        return JsonResponse(dados, safe=False)

    # POST - criar
    try:
        body = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"error": "JSON inválido"}, status=400)

    lat = body.get("lat")
    lon = body.get("lon")
    texto = body.get("texto", "")

    if lat is None or lon is None:
        return JsonResponse({"error": "lat e lon são obrigatórios"}, status=400)

    m = MarcadorManual.objects.create(latitude=float(lat), longitude=float(lon), texto=texto)
    return JsonResponse({"id": m.id, "lat": m.latitude, "lon": m.longitude, "texto": m.texto})


@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def api_marcador_manual_detalhe(request, id):
    m = get_object_or_404(MarcadorManual, id=id)

    if request.method == "PUT":
        try:
            body = json.loads(request.body.decode("utf-8"))
        except Exception:
            return JsonResponse({"error": "JSON inválido"}, status=400)

        m.texto = body.get("texto", "")
        m.save()
        return JsonResponse({"status": "ok"})

    # DELETE
    m.delete()
    return JsonResponse({"status": "deleted"})

#--------------------------------------------------------------
# CRM 
#--------------------------------------------------------------


def crm_list(request):
    registros = CRMRegistro.objects.select_related("cliente").order_by("-criado_em")

    return render(request, "crm_list.html")


# ----------------------------------------------------------
# CRM - NOVO REGISTRO
# ----------------------------------------------------------
def crm_novo(request):

    # por enquanto, apenas renderiza a tela
    # depois vamos tratar POST (salvar)
    clientes = Cliente.objects.all().order_by("nome_interno")

    return render(request, "crm_novo.html", {
        "clientes": clientes
    })

# ----------------------------------------------------------
# CRM - DETALHE
# ----------------------------------------------------------
def crm_detalhe(request, id):
    registro = get_object_or_404(CRMRegistro, id=id)

    return render(request, "crm_detalhe.html", {
        "registro": registro
    })


@require_http_methods(["GET"])
def api_crm_timeline(request):
    q = (request.GET.get("q") or "").strip()

    qs = (
        CRMRegistro.objects
        .select_related("cliente")
        .all()
        .order_by("-criado_em", "-id")
    )

    if q:
        qs = qs.filter(
            Q(cliente__nome_interno__icontains=q) |
            Q(cliente__razao_social__icontains=q) |
            Q(cliente__nome_fantasia__icontains=q) |
            Q(cliente__cnpj_cpf__icontains=q)
        )

    data = []
    for r in qs[:200]:
        data.append({
            "id": r.id,
            "tipo": f"FORM - {r.get_perfil_display()}",
            "cliente_id": r.cliente_id,
            "cliente_nome": r.cliente.nome_interno,
            "quando": r.criado_em.strftime("%d/%m/%Y %H:%M"),
            "resumo": (r.texto_gerado or "")[:160],
            "texto_gerado": r.texto_gerado or "",
            "respostas_json": r.respostas_json or {},
        })

    return JsonResponse(data, safe=False)

#--------------------busca indicação --------------------------------------


@require_http_methods(["GET"])
def api_clientes_busca(request):
    q = (request.GET.get("q") or "").strip()

    qs = Cliente.objects.all().order_by("nome_interno")

    if q:
        qs = qs.filter(
            Q(nome_interno__icontains=q) |
            Q(razao_social__icontains=q) |
            Q(nome_fantasia__icontains=q) |
            Q(cnpj_cpf__icontains=q) |
            Q(cidade__icontains=q)
        )

    data = []
    for c in qs[:50]:
        data.append({
            "id": c.id,
            "nome": c.nome_interno or c.razao_social,
            "cnpj_cpf": c.cnpj_cpf or "",
            "cidade": c.cidade or "",
            "estado": c.estado or "",
        })

    return JsonResponse(data, safe=False)



# ----------------------------------------------------------
# NOVA OBRA
# ----------------------------------------------------------
def obra_nova(request):

    if request.method == "POST":
        form = ObraForm(request.POST)

        if form.is_valid():
            obra = form.save(commit=False)

            # ---------------------------------------------------
            # LAT / LON manual ou automático
            # ---------------------------------------------------
            lat_input = request.POST.get("latitude")
            lon_input = request.POST.get("longitude")

            if lat_input or lon_input:
                try:
                    obra.latitude = float(lat_input.replace(",", ".")) if lat_input else None
                    obra.longitude = float(lon_input.replace(",", ".")) if lon_input else None
                except:
                    obra.latitude = None
                    obra.longitude = None
            else:
                endereco_str = f"{form.cleaned_data.get('endereco') or ''}, " \
                               f"{form.cleaned_data.get('numero') or ''}, " \
                               f"{form.cleaned_data.get('bairro') or ''}, " \
                               f"{form.cleaned_data.get('cidade') or ''}, " \
                               f"{form.cleaned_data.get('estado') or ''}, " \
                               f"{form.cleaned_data.get('cep') or ''}"

                lat, lon = geocodificar_endereco(endereco_str)

                if lat is None or lon is None:
                    cidade_estado = f"{form.cleaned_data.get('cidade')}, {form.cleaned_data.get('estado')}"
                    lat, lon = geocodificar_endereco(cidade_estado)

                obra.latitude = lat
                obra.longitude = lon

            obra.save()

            # ---------------------------------------------------
            # VÍNCULO COM CLIENTES (clientes_json)
            # ---------------------------------------------------
            clientes_json = request.POST.get("clientes_json", "[]")

            try:
                lista = json.loads(clientes_json)
            except:
                lista = []

            for item in lista:
                cid = item.get("id")
                if cid:
                    ObraCliente.objects.get_or_create(
                        obra=obra,
                        cliente_id=cid
                    )

            messages.success(request, "Obra cadastrada com sucesso!")
            return redirect("obra_editar", id=obra.id)

        else:
            print("❌ ObraForm inválido:", form.errors)

    else:
        form = ObraForm()

    return render(request, "obras.form.html", {
        "form": form,
        "modo": "novo"
    })


# ------------------EDITAR OBRA----------------------------------------
# ------------------EDITAR OBRA----------------------------------------
def obra_editar(request, id):
    obra = get_object_or_404(Obra, id=id)

    if request.method == "POST":
        form = ObraForm(request.POST, instance=obra)
        if form.is_valid():
            obra = form.save()

            # ---------------------------------------------
            # ATUALIZAR VÍNCULO COM CLIENTES (lista final)
            # ---------------------------------------------
            clientes_json = request.POST.get("clientes_json", "[]")
            try:
                lista = json.loads(clientes_json)
            except:
                lista = []

            ids_finais = set()
            for item in lista:
                cid = item.get("id")
                if cid:
                    ids_finais.add(int(cid))

            # remove os que não estão mais na tela
            ObraCliente.objects.filter(obra=obra).exclude(cliente_id__in=ids_finais).delete()

            # cria os novos que faltam
            for cid in ids_finais:
                ObraCliente.objects.get_or_create(obra=obra, cliente_id=cid)

            messages.success(request, "Obra atualizada com sucesso!")
            return redirect("obra_editar", id=obra.id)

    else:
        form = ObraForm(instance=obra)

    # dados para preencher a lista visual ao carregar a tela (chips)
    clientes_iniciais = []
    for c in obra.clientes.prefetch_related("segmentacao").all():
        segs = [s.nome for s in c.segmentacao.all()]
        clientes_iniciais.append({
            "id": c.id,
            "nome": c.nome_interno or c.nome_fantasia or c.razao_social or "",
            "segmentacao": ", ".join(segs) if segs else ""
        })

    return render(request, "obras.form.html", {
        "form": form,
        "modo": "editar",
        "obra": obra,
        "clientes_iniciais_json": json.dumps(clientes_iniciais, ensure_ascii=False),
    })


# ------------------EXCLUIR OBRA----------------------------------------
def obra_excluir(request, id):
    obra = get_object_or_404(Obra, id=id)
    obra.delete()
    messages.success(request, "Obra excluída com sucesso!")
    return redirect("cadastro_clientes")


# -----------------------------------------------------------------------
# ------------------MARCADOR DE OBRA----------------------------------------


@require_http_methods(["GET"])
def api_busca_clientes(request):
    q = (request.GET.get("q") or "").strip()

    qs = Cliente.objects.all().order_by("nome_interno")

    if q:
        qs = qs.filter(
            Q(nome_interno__icontains=q) |
            Q(nome_fantasia__icontains=q) |
            Q(razao_social__icontains=q) |
            Q(cnpj_cpf__icontains=q)
        )

    data = []
    for c in qs[:50]:
        # segmentação: seu model parece ser ManyToMany
        segs = [s.nome for s in c.segmentacao.all()]
        data.append({
            "id": c.id,
            "nome": c.nome_interno or c.nome_fantasia or c.razao_social or "",
            "segmentacao": ", ".join(segs) if segs else "",
        })

    return JsonResponse(data, safe=False)

@require_http_methods(["GET"])
def api_obras_mapa(request):
    qs = (
        Obra.objects
        .exclude(latitude__isnull=True)
        .exclude(longitude__isnull=True)
        .order_by("-id")
    )

    dados = []
    for o in qs:
        clientes_nomes = [c.nome_interno or c.razao_social for c in o.clientes.all()]

        dados.append({
            "id": o.id,
            "nome": o.nome,
            "cidade": o.cidade or "",
            "estado": o.estado or "",
            "endereco": o.endereco or "",
            "numero": o.numero or "",
            "bairro": o.bairro or "",
            "lat": o.latitude,
            "lon": o.longitude,
            "clientes": clientes_nomes,
        })

    return JsonResponse(dados, safe=False)

# -----------------------------------------------------------------------
# ------------------ANEXO DE OBRA----------------------------------------

@require_http_methods(["POST"])
def anexo_obra_upload(request, id):
    obra = get_object_or_404(Obra, id=id)

    arquivo = request.FILES.get("arquivo")
    if not arquivo:
        return JsonResponse({"error": "Arquivo não enviado"}, status=400)

    anexo = AnexoObra.objects.create(
        obra=obra,
        arquivo=arquivo,
        nome_original=arquivo.name
    )

    return JsonResponse({
        "id": anexo.id,
        "nome": anexo.nome_original,
        "url": anexo.arquivo.url
    })


@require_http_methods(["DELETE"])
def anexo_obra_excluir(request, id):
    anexo = get_object_or_404(AnexoObra, id=id)

    if anexo.arquivo:
        anexo.arquivo.delete(save=False)

    anexo.delete()

    return JsonResponse({"status": "ok"})

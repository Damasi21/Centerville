from django.db import models
from django.utils import timezone


#----------------------------------------------------------------------------------------------

class Segmentacao(models.Model):
    nome = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nome

#----------------------------------------------------------------------------------------------

class OrigemCliente(models.Model):
    nome = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nome

#----------------------------------CLIENTES----------------------------------------------------
class Cliente(models.Model):

    # Dados principais
    cnpj_cpf = models.CharField(max_length=20, unique=True)
    razao_social = models.CharField(max_length=150)
    nome_fantasia = models.CharField(max_length=150, blank=True, null=True)
    nome_interno = models.CharField(max_length=150)



    # Endereço
    endereco = models.CharField(max_length=150, blank=True, null=True)
    numero = models.CharField(max_length=20, blank=True, null=True)
    complemento = models.CharField(max_length=100, blank=True, null=True)
    bairro = models.CharField(max_length=100, blank=True, null=True)
    cidade = models.CharField(max_length=100, blank=True, null=True)
    estado = models.CharField(max_length=2, blank=True, null=True)
    cep = models.CharField(max_length=12, blank=True, null=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    # Estrangeiros (FK → tabelas que vamos cadastrar futuramente)
    segmentacao = models.ManyToManyField(Segmentacao, blank=True)
    origem = models.ForeignKey(OrigemCliente, on_delete=models.SET_NULL, null=True, blank=True, related_name="clientes")

    indicacao = models.ForeignKey("self",on_delete=models.SET_NULL,null=True,blank=True,related_name="clientes_indicados",help_text="Cliente que indicou este cadastro")

    data_cadastro = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.razao_social

    linkedin = models.URLField(
        blank=True,
        null=True,
        help_text="Link do LinkedIn da empresa"
    )
    instagram = models.URLField(
        blank=True,
        null=True,
        help_text="Link do Instagram da empresa"
    )

    observacoes_crm = models.TextField(blank=True, null=True)
    data_cadastro = models.DateTimeField(auto_now_add=True)
    

#---------------------- CONTATOS DE CLIENTES -----------------------------------

class Contato(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="contatos")
    nome = models.CharField(max_length=150)
    telefone1 = models.CharField(max_length=30, blank=True, null=True)
    telefone2 = models.CharField(max_length=30, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    linkedin = models.URLField(blank=True, null=True)

    def __str__(self):
        return self.nome


# ---------------------- OBRAS -----------------------------------

# models.py

class Obra(models.Model):
    nome = models.CharField(max_length=150)

    endereco = models.CharField(max_length=150, blank=True, null=True)
    numero = models.CharField(max_length=20, blank=True, null=True)
    complemento = models.CharField(max_length=100, blank=True, null=True)
    bairro = models.CharField(max_length=100, blank=True, null=True)
    cidade = models.CharField(max_length=100, blank=True, null=True)
    estado = models.CharField(max_length=2, blank=True, null=True)
    cep = models.CharField(max_length=12, blank=True, null=True)

    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    clientes = models.ManyToManyField(
        "Cliente",
        through="ObraCliente",
        related_name="obras",
        blank=True
    )

    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nome


class ObraCliente(models.Model):
    obra = models.ForeignKey(Obra, on_delete=models.CASCADE)
    cliente = models.ForeignKey("Cliente", on_delete=models.CASCADE)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("obra", "cliente")


#---------------------- MAPAS -----------------------------------


class MarcadorManual(models.Model):
    latitude = models.FloatField()
    longitude = models.FloatField()
    texto = models.TextField(blank=True, default="")
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"MarcadorManual {self.id} ({self.latitude}, {self.longitude})"

#---------------------- CRM-----------------------------------


class CRMRegistro(models.Model):
    PERFIL_CHOICES = [
        ("executor", "Executor de Piso"),
        ("construtora", "Construtora"),
        ("concreteira", "Concreteira"),
        ("outros", "Outros"),
    ]

    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name="crm_registros"
    )

    perfil = models.CharField(
        max_length=20,
        choices=PERFIL_CHOICES
    )

    texto_gerado = models.TextField()

    respostas_json = models.JSONField()

    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.cliente.nome_interno} - {self.get_perfil_display()}"


# ---------------------- ANEXOS DE CLIENTES ----------------------

class AnexoCliente(models.Model):
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name="anexos"
    )
    arquivo = models.FileField(upload_to="anexos_clientes/")
    nome_original = models.CharField(max_length=255)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nome_original

# ---------------------- ANEXOS DE OBRAS ----------------------

class AnexoObra(models.Model):
    obra = models.ForeignKey(
        Obra,
        on_delete=models.CASCADE,
        related_name="anexos"
    )
    arquivo = models.FileField(upload_to="anexos_obras/")
    nome_original = models.CharField(max_length=255)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nome_original





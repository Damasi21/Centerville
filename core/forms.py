from django import forms
from .models import Cliente
from .models import Segmentacao, OrigemCliente
from django.forms import inlineformset_factory
from .models import Contato
from django.core.exceptions import ValidationError
from .models import Cliente, Obra




#-----------------------------------CLIENTES---------------------------------------------------
class ClienteForm(forms.ModelForm):

    class Meta:
        model = Cliente
        fields = [
            "cnpj_cpf",
            "razao_social",
            "nome_fantasia",
            "nome_interno",
            "endereco",
            "numero",
            "complemento",
            "bairro",
            "cidade",
            "estado",
            "cep",
            "segmentacao",
            "origem",
            "instagram",
            "linkedin",
            "observacoes_crm",
            "latitude",
            "longitude",
            "indicacao",
        ]

        widgets = {
            "cnpj_cpf": forms.TextInput(attrs={"class": "form-control"}),
            "razao_social": forms.TextInput(attrs={"class": "form-control"}),
            "nome_fantasia": forms.TextInput(attrs={"class": "form-control"}),
            "nome_interno": forms.TextInput(attrs={"class": "form-control"}),

            "endereco": forms.TextInput(attrs={"class": "form-control"}),
            "numero": forms.TextInput(attrs={"class": "form-control"}),
            "complemento": forms.TextInput(attrs={"class": "form-control"}),
            "bairro": forms.TextInput(attrs={"class": "form-control"}),
            "cidade": forms.TextInput(attrs={"class": "form-control"}),
            'estado': forms.Select(choices=[
                ('AC', 'AC'), ('AL', 'AL'), ('AP', 'AP'), ('AM', 'AM'), ('BA', 'BA'),
                ('CE', 'CE'), ('DF', 'DF'), ('ES', 'ES'), ('GO', 'GO'), ('MA', 'MA'),
                ('MT', 'MT'), ('MS', 'MS'), ('MG', 'MG'), ('PA', 'PA'), ('PB', 'PB'),
                ('PR', 'PR'), ('PE', 'PE'), ('PI', 'PI'), ('RJ', 'RJ'), ('RN', 'RN'),
                ('RS', 'RS'), ('RO', 'RO'), ('RR', 'RR'), ('SC', 'SC'), ('SP', 'SP'),
                ('SE', 'SE'), ('TO', 'TO')
            ], attrs={'class': 'form-select'}),
            "cep": forms.TextInput(attrs={"class": "form-control"}),

            "segmentacao": forms.SelectMultiple(attrs={"class": "form-select", "id": "id_segmentacao"}),
            "origem": forms.Select(attrs={"class": "form-select", "id": "id_origem"}),

            'latitude': forms.NumberInput(attrs={'class': 'form-control', 'step': 'any',}),
            'longitude': forms.NumberInput(attrs={'class': 'form-control', 'step': 'any',}),

            "linkedin": forms.URLInput(attrs={"class": "form-control","placeholder": "https://www.linkedin.com/company/..."}),
            "instagram": forms.URLInput(attrs={"class": "form-control","placeholder": "https://www.instagram.com/..."}),
            "observacoes_crm": forms.Textarea(attrs={
                "class": "form-control",
                "rows": 5,
                "placeholder": "Descreva quem é o cliente, o que ele faz, perfil comercial, atuação, pontos importantes, etc."
            }),
            "indicacao": forms.HiddenInput(attrs={"id": "id_indicacao"}),

    }

        

    # Aceita vírgula/ponto e valida o range
    def clean_latitude(self):
        val = self.cleaned_data.get('latitude')
        if isinstance(val, str):
            val = val.replace(',', '.').strip() or None
        if val in (None, ''):
            return None
        try:
            val = float(val)
        except ValueError:
            raise forms.ValidationError("Latitude inválida.")
        if not (-90 <= val <= 90):
            raise forms.ValidationError("Latitude deve estar entre -90 e 90.")
        return val

    def clean_longitude(self):
        val = self.cleaned_data.get('longitude')
        if isinstance(val, str):
            val = val.replace(',', '.').strip() or None
        if val in (None, ''):
            return None
        try:
            val = float(val)
        except ValueError:
            raise forms.ValidationError("Longitude inválida.")
        if not (-180 <= val <= 180):
            raise forms.ValidationError("Longitude deve estar entre -180 e 180.")
        return val

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["nome_interno"].required = True

    #--------------------------------VALIDACAO DE CNPJ ---------------------------------------------------
    def clean_cnpj_cpf(self):
        valor = self.cleaned_data["cnpj_cpf"]
        valor = valor.replace(".", "").replace("-", "").replace("/", "").strip()

        if not valor.isdigit():
            raise ValidationError("CPF/CNPJ deve conter apenas números.")

        if len(valor) not in (11, 14):
            raise ValidationError("CPF/CNPJ deve ter 11 (CPF) ou 14 (CNPJ) dígitos.")

        qs = Cliente.objects.filter(cnpj_cpf=valor)

        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise ValidationError("Já existe um cliente cadastrado com este CPF/CNPJ.")

        return valor


#----------- CONFIGURACOES------------------------------------------------------------------------
#-----------------------------------SEGMENTAÇÃO---------------------------------------------------
class SegmentacaoForm(forms.ModelForm):
    class Meta:
        model = Segmentacao
        fields = ["nome"]
        widgets = {
            "nome": forms.TextInput(attrs={"class": "form-control"}),
        }

#-----------------------------------STATUS---------------------------------------------------------
class OrigemClienteForm(forms.ModelForm):
    class Meta:
        model = OrigemCliente
        fields = ["nome"]
        widgets = {
            "nome": forms.TextInput(attrs={"class": "form-control"}),
        }

#---------------------------------CONTATOS DE CLIENTES--------------------------------------------------------

ContatoFormSet = inlineformset_factory(
    Cliente,
    Contato,
    fields=['nome', 'telefone1', 'telefone2', 'email'],
    extra=1,          # quantos formulários vazios aparecem
    can_delete=True,
    widgets={
        'nome': forms.TextInput(attrs={'class': 'form-control'}),
        'telefone1': forms.TextInput(attrs={'class': 'form-control'}),
        'telefone2': forms.TextInput(attrs={'class': 'form-control'}),
        'email': forms.EmailInput(attrs={'class': 'form-control'}),
    }
)

#-----------------------------------OBRAS---------------------------------------------------
class ObraForm(forms.ModelForm):

    class Meta:
        model = Obra
        fields = [
            "nome",
            "endereco",
            "numero",
            "bairro",
            "cidade",
            "estado",
            "cep",
            "latitude",
            "longitude",
        ]

        widgets = {
            "nome": forms.TextInput(attrs={"class": "form-control"}),

            "endereco": forms.TextInput(attrs={"class": "form-control"}),
            "numero": forms.TextInput(attrs={"class": "form-control"}),
            "bairro": forms.TextInput(attrs={"class": "form-control"}),
            "cidade": forms.TextInput(attrs={"class": "form-control"}),

            "estado": forms.Select(choices=[
                ('AC', 'AC'), ('AL', 'AL'), ('AP', 'AP'), ('AM', 'AM'), ('BA', 'BA'),
                ('CE', 'CE'), ('DF', 'DF'), ('ES', 'ES'), ('GO', 'GO'), ('MA', 'MA'),
                ('MT', 'MT'), ('MS', 'MS'), ('MG', 'MG'), ('PA', 'PA'), ('PB', 'PB'),
                ('PR', 'PR'), ('PE', 'PE'), ('PI', 'PI'), ('RJ', 'RJ'), ('RN', 'RN'),
                ('RS', 'RS'), ('RO', 'RO'), ('RR', 'RR'), ('SC', 'SC'), ('SP', 'SP'),
                ('SE', 'SE'), ('TO', 'TO')
            ], attrs={'class': 'form-select'}),

            "cep": forms.TextInput(attrs={"class": "form-control", "id": "id_cep"}),
            "latitude": forms.NumberInput(attrs={"class": "form-control", "step": "any"}),
            "longitude": forms.NumberInput(attrs={"class": "form-control", "step": "any"}),
        }

    def clean_latitude(self):
        val = self.cleaned_data.get("latitude")
        if isinstance(val, str):
            val = val.replace(",", ".").strip() or None
        if val in (None, ""):
            return None
        try:
            val = float(val)
        except ValueError:
            raise forms.ValidationError("Latitude inválida.")
        if not (-90 <= val <= 90):
            raise forms.ValidationError("Latitude deve estar entre -90 e 90.")
        return val

    def clean_longitude(self):
        val = self.cleaned_data.get("longitude")
        if isinstance(val, str):
            val = val.replace(",", ".").strip() or None
        if val in (None, ""):
            return None
        try:
            val = float(val)
        except ValueError:
            raise forms.ValidationError("Longitude inválida.")
        if not (-180 <= val <= 180):
            raise forms.ValidationError("Longitude deve estar entre -180 e 180.")
        return val

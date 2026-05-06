from django.conf import settings
from django.contrib.auth.models import User
from django.shortcuts import redirect
from django.urls import reverse


class LoginObrigatorioMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        login_url = reverse("tela_login")

        rotas_livres = (
            login_url,
            reverse("sair"),
            settings.STATIC_URL,
            settings.MEDIA_URL,
            "/admin/",
        )

        if request.user.is_authenticated or path.startswith(rotas_livres):
            return self.get_response(request)

        # Permite criar o primeiro usuario para nao travar uma base nova.
        if not User.objects.exists() and path.startswith("/configuracoes/usuarios/novo/"):
            return self.get_response(request)

        return redirect(f"{login_url}?next={path}")

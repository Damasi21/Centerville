from django.urls import path
from . import views
from .views import api_clientes_mapa

urlpatterns = [
    path('', views.index, name='index'),
    path("login/", views.tela_login, name="tela_login"),
    path("sair/", views.sair, name="sair"),
    path("leitor-pdf/", views.leitor_pdf, name="leitor_pdf"),
    path("api/leitor-pdf/ler/", views.api_leitor_pdf_ler, name="api_leitor_pdf_ler"),
    path("api/leitor-pdf/salvar/", views.api_leitor_pdf_salvar, name="api_leitor_pdf_salvar"),


#---------------------------------CLIENTES-------------------------------------------------
    path("clientes/", views.clientes_list, name="cadastro_clientes"),
    path("clientes/novo/", views.cliente_novo, name="cliente_novo"),
    path("clientes/<int:id>/", views.cliente_editar, name="cliente_editar"),
    path("clientes/<int:id>/excluir/", views.cliente_excluir, name="cliente_excluir"),

    path("clientes/<int:id>/anexos/upload/", views.anexo_upload, name="anexo_upload"),
    path("clientes/anexos/<int:id>/excluir/",views.anexo_excluir,name="anexo_excluir"),

    path("api/buscar_cnpj/<str:cnpj>/", views.buscar_cnpj, name="buscar_cnpj"),
    path("api/clientes/busca/", views.api_clientes_busca, name="api_clientes_busca"),
    path("api/clientes/indicacao/", views.api_clientes_busca, name="api_clientes_indicacao"),


#----------------------------------------------------------------------------------------
#-----------------------------------MAPAS-----------------------------------------------------

    path("clientes/mapa/", views.mapa_clientes, name="mapa_clientes"),
    path("api/clientes/mapa/", api_clientes_mapa, name="api_clientes_mapa"),

    path("api/mapa/marcadores-manuais/", views.api_marcadores_manuais, name="api_marcadores_manuais"),
    path("api/mapa/marcadores-manuais/<int:id>/", views.api_marcador_manual_detalhe, name="api_marcador_manual_detalhe"),
    path("api/clientes/mapa/filtros/", views.api_clientes_mapa_filtros, name="api_clientes_mapa_filtros"),
    path("api/geocode/", views.api_geocode, name="api_geocode"),
    path("api/obras/mapa/", views.api_obras_mapa, name="api_obras_mapa"),



#-----------------------------------CRM-----------------------------------------------------

    path("crm/", views.crm_list, name="crm_list"),
    path("crm/novo/", views.crm_novo, name="crm_novo"),
    path("crm/<int:id>/", views.crm_detalhe, name="crm_detalhe"),


 #---------------------------------CONFIGURAÇÕES------------------------------------------
    path("configuracoes/", views.configuracoes, name="configuracoes"),

    

    # SEGMENTAÇÃO
    path("configuracoes/segmentacao/", views.segmentacao_list, name="segmentacao_list"),
    path("configuracoes/segmentacao/novo/", views.segmentacao_novo, name="segmentacao_novo"),
    path("configuracoes/segmentacao/<int:id>/editar/", views.segmentacao_editar, name="segmentacao_editar"),
    path("configuracoes/segmentacao/<int:id>/excluir/", views.segmentacao_excluir, name="segmentacao_excluir"),

    #origem
    path("configuracoes/origem/", views.origemcliente_list, name="origemcliente_list"),
    path("configuracoes/origem/novo/", views.origemcliente_novo, name="origemcliente_novo"),
    path("configuracoes/origem/<int:id>/editar/", views.origemcliente_editar, name="origemcliente_editar"),
    path("configuracoes/origem/<int:id>/excluir/", views.origemcliente_excluir, name="origemcliente_excluir"),

    # usuarios
    path("configuracoes/usuarios/", views.usuario_list, name="usuario_list"),
    path("configuracoes/usuarios/novo/", views.usuario_novo, name="usuario_novo"),
    path("configuracoes/usuarios/<int:id>/editar/", views.usuario_editar, name="usuario_editar"),
    path("configuracoes/usuarios/<int:id>/excluir/", views.usuario_excluir, name="usuario_excluir"),

#----------------------------------------------------------------------------------------


    path('produtos/', views.cadastro_produtos, name='cadastro_produtos'),
    path('materiais-concorrentes/', views.cadastro_materiais_concorrentes, name='cadastro_materiais_concorrentes'),
    path('proposta-tecnica/', views.proposta_tecnica, name='proposta_tecnica'),


#---------------------------------OBRAS-------------------------------------------------

    path("obras/novo/", views.obra_nova, name="obra_nova"),
    path("obras/<int:id>/", views.obra_editar, name="obra_editar"),
    path("obras/<int:id>/excluir/", views.obra_excluir, name="obra_excluir"),
    path("api/clientes/busca/", views.api_busca_clientes, name="api_busca_clientes"),

    path("obras/<int:id>/anexos/upload/", views.anexo_obra_upload, name="anexo_obra_upload"),
    path("obras/anexos/<int:id>/excluir/", views.anexo_obra_excluir, name="anexo_obra_excluir"),
    


]

# Contador de Músicos

Sistema web responsivo para celulares, tablets e computadores, feito com PHP, JavaScript e CSS. A aplicação funciona sem banco de dados e sem servidor de sincronização: cada aparelho salva sua própria contagem no navegador e, ao final do dia, o coordenador importa os arquivos dos celulares para gerar um único relatório consolidado.

## Versão Atual

A versão principal está em `public/`.

```text
public/
  index.php                 Entrada PHP opcional
  index.html                Entrada estática sem PHP
  manifest.webmanifest      Configuração PWA
  service-worker.js         Cache offline
  assets/
    css/app.css             Interface responsiva branco/cinza
    js/app.js               Contagem, armazenamento e relatório
    img/logo-ccb-light.svg  Logo correta usada no sistema
    img/logo-ccb.svg        Alias do mesmo arquivo para compatibilidade
```

## Como Funciona Sem Servidor

O sistema usa `localStorage` no próprio navegador. Isso significa:

- cada celular guarda sua contagem localmente;
- não existe banco de dados remoto;
- não existe login obrigatório;
- não existe dependência de Firebase ou outro backend;
- o relatório final é feito em um aparelho coordenador.

## Login e Perfis

O controle de acesso é local, definido no próprio JavaScript em `public/assets/js/app.js`.

Usuários padrão:

```text
admin / admin123
contador / contador123
```

Perfis:

- `administrador`: acessa a página Admin e os logs.
- `contador`: acessa evento, contagem, consolidação e relatório.

Importante: como o sistema não usa servidor, esse login serve para controle operacional no aparelho. Para segurança forte seria necessário backend.

## Logs de Acesso

Os logs são salvos no `localStorage` do navegador em que o sistema está sendo usado. A página `Admin` permite:

- criar usuários;
- editar nome, senha e perfil;
- resetar senha dos usuários;
- excluir usuários;
- visualizar logins, logouts, troca de telas e ações principais;
- exportar logs em JSON;
- limpar logs locais.

Perfis administráveis:

- `Administrador`: gerencia usuários, perfis e logs.
- `Contador`: registra contagens, consolida arquivos e gera relatório.

Ao entrar como `contador`, o usuário deve escolher o grupo instrumental que vai contar. Na aba `Contagem`, ele verá somente esse grupo. O administrador continua visualizando todos os grupos.

Fluxo recomendado:

1. Abra o sistema em todos os celulares.
2. Configure a mesma data do evento em todos.
3. Cada equipe faz sua contagem pelo próprio aparelho.
4. Cada celular acessa `Consolidar` e clica em `Exportar contagem JSON`.
5. O coordenador recebe os arquivos JSON e importa todos em `Consolidar`.
6. O coordenador acessa `Relatório` e clica em `Imprimir / Salvar PDF`.

Se o mesmo celular for importado mais de uma vez, a versão mais recente substitui a anterior. Isso evita contagem duplicada quando alguém exporta novamente.

## Rodar Para Testar

Como PHP não está instalado neste ambiente, a prévia local pode ser aberta pela versão estática:

```powershell
python -m http.server 8790 --bind 127.0.0.1 --directory public
```

Depois acesse:

```text
http://127.0.0.1:8790
```

Com PHP instalado, também funciona assim:

```powershell
php -S 127.0.0.1:8790 -t public
```

## Uso Offline

O projeto inclui `manifest.webmanifest` e `service-worker.js`. Depois de abrir uma vez em um navegador moderno, o app pode ficar disponível offline no aparelho, dependendo das permissões do navegador.

## Relatório PDF

O sistema não usa biblioteca de PDF no servidor. O relatório é renderizado em HTML/CSS e o usuário salva como PDF usando a impressão do navegador:

```text
Relatório > Imprimir / Salvar PDF
```

## Observação Importante

Sem servidor central não existe sincronização automática em tempo real entre celulares. A forma confiável de juntar várias contagens sem backend é a consolidação por exportação/importação de arquivos JSON.

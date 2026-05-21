# Implantação Web

## Opção 1: Sem Servidor, Abrindo Arquivo

Abra diretamente:

```text
public/index.html
```

Essa opção funciona para a contagem e armazenamento local. Alguns recursos de PWA/cache offline podem ser bloqueados pelo navegador quando aberto via arquivo local.

## Opção 2: Servidor Local Simples

Com Python:

```powershell
python -m http.server 8790 --bind 127.0.0.1 --directory public
```

Acesse:

```text
http://127.0.0.1:8790
```

Com PHP:

```powershell
php -S 127.0.0.1:8790 -t public
```

## Opção 3: Hospedagem Estática

Pode hospedar a pasta `public/` em qualquer hospedagem simples, inclusive sem banco de dados.

Arquivos necessários:

```text
public/index.html
public/index.php
public/assets/css/app.css
public/assets/js/app.js
public/assets/img/logo-ccb-light.svg
public/assets/img/logo-ccb.svg
public/manifest.webmanifest
public/service-worker.js
```

## Operação No Dia Do Evento

1. Abra o sistema em cada celular.
2. Configure a mesma data.
3. Cada celular faz sua contagem.
4. Cada celular exporta seu JSON.
5. O coordenador importa os arquivos.
6. O coordenador gera o PDF pelo navegador.

## Backup

Para guardar os dados do dia:

- exporte o relatório final JSON;
- salve o PDF gerado pelo navegador;
- opcionalmente salve também os JSONs individuais de cada celular.

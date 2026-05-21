# Arquitetura Web Sem Backend

## Tecnologias

- PHP: entrada opcional em `public/index.php`.
- HTML: estrutura principal em `public/index.html`.
- JavaScript: regras de contagem, armazenamento, importação e relatório.
- CSS: layout responsivo, impressão e identidade visual branco/cinza.
- PWA: manifesto e service worker para cache offline.

## Arquitetura

```text
Navegador do celular
  ├─ Interface HTML/CSS
  ├─ JavaScript
  │   ├─ Catálogo de grupos e instrumentos
  │   ├─ Contadores por botões
  │   ├─ Cálculo de totais
  │   ├─ localStorage
  │   ├─ Exportação JSON
  │   ├─ Importação JSON
  │   └─ Relatório HTML para impressão/PDF
  └─ Cache PWA offline
```

## Consolidação Sem Servidor

```text
Celular A conta Cordas
Celular B conta Madeiras
Celular C conta Metais

Cada celular exporta:
  contagem-AAAA-MM-DD-nome.json

Coordenador importa os arquivos:
  -> o sistema soma as contagens
  -> ignora arquivos de outra data
  -> substitui versão antiga do mesmo celular
  -> gera um único relatório final
```

## Por Que Não Há Sincronização Automática

Sincronização automática entre vários celulares exige algum ponto compartilhado: servidor, Firebase, banco remoto, rede local com serviço ativo ou outro backend. Como o requisito atual é não depender de servidor no final, o sistema usa consolidação manual por arquivo.

Essa abordagem é simples, auditável e funciona mesmo sem internet.

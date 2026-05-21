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
  │   ├─ Adaptação da contagem por tipo de evento
  │   ├─ Contadores por botões
  │   ├─ Cálculo de totais
  │   ├─ localStorage
  │   ├─ Login local por usuário e senha
  │   ├─ Administração local de usuários e perfis
  │   ├─ Logs locais de acesso
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

## Controle De Acesso

O login é local e definido no JavaScript. A sessão e os logs ficam no `localStorage`.

Sem backend, esse controle não impede adulteração por alguém com acesso técnico ao navegador/código. Ele é adequado para organização de uso e auditoria local, não para segurança forte.

O administrador pode criar, editar, resetar senhas e excluir usuários pela aba `Admin`. O sistema preserva pelo menos um administrador para evitar bloqueio total do acesso.

Usuários com perfil `contador` escolhem um ou mais grupos instrumentais no login. Essa escolha fica na sessão local e limita a aba `Contagem` aos grupos selecionados.

## Contagem Por Tipo De Evento

- `Ensaio Regional`: mostra todos os grupos de contagem do relatório.
- `Reunião de encarregados e instrutores`: mostra somente os grupos instrumentais `Cordas`, `Teclas`, `Madeiras` e `Metais`; dentro de cada grupo, cada instrumento é contado como instrutores daquele instrumento.

Arquivos importados só entram no relatório se tiverem a mesma data e o mesmo tipo de evento do aparelho coordenador.

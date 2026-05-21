# Wireframes Web Responsivos

## Login

```text
┌──────────────────────────────┐
│ [Logo CCB]                   │
│ Acesso ao sistema            │
│ Usuário                      │
│ Senha                        │
│ Grupo para contagem          │
│ [Entrar]                     │
└──────────────────────────────┘
```

## Evento

```text
┌──────────────────────────────┐
│ [Logo CCB] Contador          │
│ [Evento][Contagem][...]      │
├──────────────────────────────┤
│ Evento do dia                │
│ Nome do evento               │
│ Tipo de evento               │
│ Data                         │
│ Local                        │
│ Encarregado Regional         │
│ Ancião                       │
│ Região                       │
│ Nome deste aparelho          │
└──────────────────────────────┘
```

## Contagem No Celular

```text
┌──────────────────────────────┐
│ Grupos: Cordas Teclas ...    │
├──────────────────────────────┤
│ Grupo neste aparelho     000 │
│ Total consolidado        000 │
├──────────────────────────────┤
│ Violinos                     │
│ [-]          000          [+]│
│ Violas                       │
│ [-]          000          [+]│
└──────────────────────────────┘
```

Na `Reunião de encarregados e instrutores`, os grupos instrumentais permanecem, mas os itens aparecem como instrutores por instrumento:

```text
Cordas
  Instrutores - Violinos
  Instrutores - Violas
  Instrutores - Violoncelos
```

## Consolidação Sem Servidor

```text
┌──────────────────────────────┐
│ Exportar deste aparelho      │
│ [Exportar contagem JSON]     │
├──────────────────────────────┤
│ Importar de outros celulares │
│ [Importar arquivos]          │
├──────────────────────────────┤
│ Celulares importados         │
│ Celular Cordas   total 000   │
│ Celular Madeiras total 000   │
└──────────────────────────────┘
```

## Relatório Final

```text
┌──────────────────────────────┐
│ [Logo CCB] Relatório         │
│ Evento | Data | Local        │
├──────────────────────────────┤
│ Totais gerais                │
├──────────────────────────────┤
│ Gráfico de pizza             │
├──────────────────────────────┤
│ Tabelas por grupo            │
│ Cordas | Teclas | Madeiras   │
└──────────────────────────────┘
```

## Administração

```text
┌──────────────────────────────┐
│ Administração                │
│ Usuários e perfis            │
│ Nome | Usuário | Senha       │
│ Perfil: Administrador        │
│ [Salvar usuário]             │
│ Ações: Editar | Resetar senha │
├──────────────────────────────┤
│ [Exportar logs] [Limpar]     │
├──────────────────────────────┤
│ Data | Usuário | Ação        │
│ ...                          │
└──────────────────────────────┘
```

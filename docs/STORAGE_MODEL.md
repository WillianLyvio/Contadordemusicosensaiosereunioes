# Modelo de Armazenamento Sem Servidor

## LocalStorage

Chave usada:

```text
contador-musicos-web-v1
contador-musicos-auth-v1
contador-musicos-access-logs-v1
contador-musicos-users-v1
```

Estrutura:

```json
{
  "schemaVersion": 1,
  "deviceId": "device-uuid",
  "deviceName": "Aparelho principal",
  "activeTab": "event",
  "selectedGroup": "cordas",
  "event": {
    "name": "Contagem de Músicos e Organistas",
    "type": "Ensaio Regional",
    "date": "2026-05-21",
    "local": "Cuiabá",
    "regionalLeader": "Nome do Encarregado Regional ou ministrante",
    "elder": "Nome do Ancião",
    "region": "Região Oeste"
  },
  "counts": {
    "cordas": {
      "violinos": 0,
      "violas": 0,
      "violoncelos": 0
    }
  },
  "imports": {
    "2026-05-21:device-uuid": {
      "schemaVersion": 1,
      "kind": "device-counts",
      "deviceId": "device-uuid",
      "deviceName": "Celular Madeiras",
      "exportedAt": "2026-05-21T12:00:00.000Z",
      "event": {},
      "counts": {}
    }
  }
}
```

## Usuários

Os usuários administráveis ficam em:

```text
contador-musicos-users-v1
```

Exemplo:

```json
[
  {
    "username": "admin",
    "password": "admin123",
    "name": "Administrador",
    "role": "administrador"
  },
  {
    "username": "contador",
    "password": "contador123",
    "name": "Contador",
    "role": "contador"
  }
]
```

Sem servidor, os dados de usuário são locais ao navegador.

## Regra de Consolidação

- A contagem local do coordenador é sempre considerada.
- Arquivos importados precisam ter a mesma data do evento atual.
- Arquivos importados precisam ter o mesmo tipo de evento do aparelho coordenador.
- Arquivos do próprio aparelho são ignorados para evitar duplicidade.
- Se o mesmo aparelho for importado duas vezes, fica a exportação mais recente.
- O relatório final soma a contagem local com todas as importações válidas.

## Logs De Acesso

Os logs ficam em:

```text
contador-musicos-access-logs-v1
```

Cada registro contém:

```json
{
  "at": "2026-05-21T12:00:00.000Z",
  "username": "admin",
  "name": "Administrador",
  "role": "administrador",
  "countGroups": ["cordas", "madeiras"],
  "action": "login_success",
  "details": "Entrada no sistema",
  "deviceName": "Aparelho principal"
}
```

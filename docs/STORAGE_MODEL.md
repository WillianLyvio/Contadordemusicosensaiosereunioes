# Modelo de Armazenamento Sem Servidor

## LocalStorage

Chave usada:

```text
contador-musicos-web-v1
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
    "date": "2026-05-21",
    "local": "Cuiabá",
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

## Regra de Consolidação

- A contagem local do coordenador é sempre considerada.
- Arquivos importados precisam ter a mesma data do evento atual.
- Arquivos do próprio aparelho são ignorados para evitar duplicidade.
- Se o mesmo aparelho for importado duas vezes, fica a exportação mais recente.
- O relatório final soma a contagem local com todas as importações válidas.

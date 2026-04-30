# SDR Smart Hub — Backend

Backend NestJS com integração Apify para busca e enriquecimento de leads.

## Stack
- NestJS 10
- PostgreSQL + TypeORM
- JWT Auth
- Apify API

## Setup local

```bash
cd backend
cp .env.example .env
# edite o .env com suas credenciais
npm install
npm run start:dev
```

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/v1/apify-leads/search | Buscar leads via Apify |
| GET | /api/v1/apify-leads/searches | Histórico de buscas |
| GET | /api/v1/apify-leads/searches/:id | Detalhes de uma busca |

## Exemplo de uso

```json
POST /api/v1/apify-leads/search
Authorization: Bearer <jwt_token>

{
  "source": "google",
  "query": "clínicas estéticas em Porto Alegre",
  "limit": 50
}
```

## Sources disponíveis
- `google` → Google Maps / Places (recomendado para negócios locais)
- `instagram` → Perfis e posts do Instagram
- `linkedin` → Empresas no LinkedIn
- `website` → Crawler de sites

## Deploy no EasyPanel

1. Crie um novo serviço no projeto
2. Fonte: GitHub → branch `main` → caminho `/backend`
3. Build: Dockerfile
4. Porta: 3001
5. Configure as variáveis de ambiente do `.env.example`
6. Certifique-se de ter um serviço PostgreSQL rodando no EasyPanel

## Variáveis de ambiente obrigatórias

```
JWT_SECRET=
DB_HOST=
DB_PORT=5432
DB_USER=
DB_PASS=
DB_NAME=sdr_smart_hub
APIFY_API_TOKEN=
```

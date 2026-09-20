# Leila Hair & Beauty - Backend

API backend desenvolvida com [Node.js](https://nodejs.org/), [TypeScript](https://www.typescriptlang.org/), [Express](https://expressjs.com/), [PostgreSQL](https://www.postgresql.org/), [Prisma ORM](https://www.prisma.io/), [Swagger (OpenAPI)](https://swagger.io/) e [ESLint](https://eslint.org/).

---

##  Requisitos

* **Node.js**: versão 20 ou superior
* **npm**: gerenciador de pacotes padrão
* **Docker & Docker Compose**: para execução do banco de dados PostgreSQL

---

##  Guia Rápido: Como Rodar o Projeto do Zero

### 1. Configurar Variáveis de Ambiente

Crie o arquivo `.env` a partir do modelo de exemplo:

```bash
cp .env.example .env
```

> **Nota**: O `.env.example` já vem pré-configurado com a porta `5433` para o PostgreSQL (evitando conflito com a porta padrão `5432` de outros projetos) e credenciais de administrador para o seed.

### 2. Instalar as Dependências

```bash
npm install
```

### 3. Subir o Banco de Dados (Docker)

Você pode subir o container do PostgreSQL (`salao-postgres`) de duas formas:

**Via script npm:**
```bash
npm run db:up
```

**Ou diretamente via Docker Compose:**
```bash
docker compose up -d
```

> **Verificar status do container:**
> ```bash
> docker ps
> ```
> O container `salao-postgres` deve aparecer com status `Up` e `(healthy)`.
>
> **Acompanhar logs do banco de dados:**
> ```bash
> docker logs -f salao-postgres
> ```

### 4. Executar as Migrações

Aplique as migrações do Prisma para criar as tabelas e constraints (`CHECK constraints` de preços e durações) no banco de dados:

```bash
npm run db:migrate
```

### 5. Popular o Banco com o Seed

Execute o seed idempotente para criar o usuário administrador (dona do salão), usuário cliente de exemplo e os serviços iniciais:

```bash
npm run db:seed
```

### 6. Iniciar o Servidor em Desenvolvimento

Inicie a aplicação com hot-reload (via `tsx`):

```bash
npm run dev
```

A API estará disponível em: **[http://localhost:3001](http://localhost:3001)**

---

##  Scripts de Banco de Dados e Docker

| Comando npm | Comando Docker equivalente | Descrição |
| :--- | :--- | :--- |
| `npm run db:up` | `docker compose up -d` | Sobe o container PostgreSQL (`porta 5433:5432`) em segundo plano |
| `npm run db:down` | `docker compose down` | Para e remove o container e a rede do banco de dados |
| `npm run db:migrate` | `npx prisma migrate dev` | Executa as migrações pendentes do Prisma no banco |
| `npm run db:seed` | `npx prisma db seed` | Executa o script de seed para popular os dados iniciais |
| `npm run db:studio` | `npx prisma studio` | Abre o painel visual do Prisma Studio no navegador |

---

##  Outros Comandos

### Build de Produção

Compila o código TypeScript para JavaScript (gerado no diretório `dist/`):

```bash
npm run build
```

### Execução da Versão Compilada

Inicia a versão de produção a partir dos arquivos compilados em `dist/`:

```bash
npm run start
```

### Verificação de Lint

Executa a análise estática de código com o ESLint:

```bash
npm run lint
```

---

##  Documentação Interativa (Swagger)

A interface interativa do Swagger OpenAPI está acessível diretamente pelo navegador:

* **URL**: [http://localhost:3001/api-docs](http://localhost:3001/api-docs)

---

##  Endpoint de Health Check

Validação rápida de status da API:

* **Método**: `GET`
* **URL**: [http://localhost:3001/health](http://localhost:3001/health)
* **Exemplo de resposta (HTTP 200)**:

```json
{
  "status": "ok",
  "uptime": 12.345,
  "timestamp": "2026-09-20T17:20:00.000Z"
}
```

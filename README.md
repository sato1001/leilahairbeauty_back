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

> **Nota**: O `.env.example` já vem pré-configurado com a porta `5433` para o PostgreSQL (evitando conflito com a porta padrão `5432` de outros projetos), credenciais de administrador para o seed e configurações do JWT.

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

##  Execução de Testes

Para executar os testes automatizados da aplicação:

```bash
npm test
```

A suíte cobre cenários de registro, validação, normalização de email, hash de senhas, login, geração de JWT, middlewares e proteção de rotas.

---

##  Endpoints de Autenticação

### 1. Registro de Usuário (`POST /auth/register`)

Cadastra um novo cliente na plataforma. O role atribuído é sempre `CLIENT`.

* **URL**: `http://localhost:3001/auth/register`
* **Headers**: `Content-Type: application/json`
* **Exemplo de Request**:

```json
{
  "name": "João da Silva",
  "email": "joao@email.com",
  "phone": "18999999999",
  "password": "SenhaSegura123"
}
```

* **Exemplo de Resposta (HTTP 201 Created)**:

```json
{
  "user": {
    "id": 3,
    "name": "João da Silva",
    "email": "joao@email.com",
    "phone": "18999999999",
    "role": "CLIENT"
  }
}
```

---

### 2. Login (`POST /auth/login`)

Autentica um usuário existente e retorna o token JWT.

* **URL**: `http://localhost:3001/auth/login`
* **Headers**: `Content-Type: application/json`
* **Exemplo de Request**:

```json
{
  "email": "joao@email.com",
  "password": "SenhaSegura123"
}
```

* **Exemplo de Resposta (HTTP 200 OK)**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 3,
    "name": "João da Silva",
    "email": "joao@email.com",
    "phone": "18999999999",
    "role": "CLIENT"
  }
}
```

---

### 3. Dados do Usuário Autenticado (`GET /auth/me`)

Retorna os dados públicos do usuário logado a partir do token JWT.

* **URL**: `http://localhost:3001/auth/me`
* **Headers**: `Authorization: Bearer <seu_token_jwt>`
* **Exemplo de Resposta (HTTP 200 OK)**:

```json
{
  "user": {
    "id": 3,
    "name": "João da Silva",
    "email": "joao@email.com",
    "phone": "18999999999",
    "role": "CLIENT"
  }
}
```

---

##  Endpoints de Serviços (`/services`)

Gerenciamento do catálogo de serviços do salão com suporte a **Soft Delete**.

### 1. Listar Serviços Ativos (`GET /services`)
* **Acesso**: Público.
* **Comportamento**: Retorna apenas os serviços com `active: true`.
* **Resposta (HTTP 200 OK)**:
```json
{
  "services": [
    {
      "id": 1,
      "name": "Corte Feminino",
      "description": "Corte personalizado com lavagem",
      "duration_minutes": 45,
      "price": 80,
      "active": true,
      "created_at": "2026-09-20T17:36:57.368Z",
      "updated_at": "2026-09-20T17:36:57.368Z"
    }
  ]
}
```

### 2. Buscar Serviço por ID (`GET /services/:id`)
* **Acesso**: Público.
* **Comportamento**: Retorna os detalhes de um serviço ativo. Retorna `404 Not Found` caso o serviço não exista ou esteja desativado.

### 3. Criar Serviço (`POST /services`)
* **Acesso**: Restrito a administradores (`ADMIN`).
* **Headers**: `Authorization: Bearer <token_admin>`
* **Request**:
```json
{
  "name": "Design de Sobrancelhas",
  "description": "Alinhamento e design facial",
  "duration_minutes": 30,
  "price": 45.00
}
```
* **Resposta (HTTP 201 Created)**

### 4. Atualizar Serviço (`PATCH /services/:id`)
* **Acesso**: Restrito a administradores (`ADMIN`).
* **Headers**: `Authorization: Bearer <token_admin>`
* **Request**: campos parciais (`name`, `description`, `duration_minutes`, `price`, `active`).

### 5. Exclusão Lógica (`DELETE /services/:id`)
* **Acesso**: Restrito a administradores (`ADMIN`).
* **Headers**: `Authorization: Bearer <token_admin>`
* **Regra de Negócio (Soft Delete)**:
  * O método HTTP permanece `DELETE`.
  * O registro **não é removido fisicamente do banco de dados**.
  * O status é alterado para `active = false`.
  * Preserva integralmente o histórico de agendamentos (`appointment_services`) e o `price_charged` registrado.
  * O serviço desativado deixa de aparecer na listagem pública `GET /services` e retorna `404` em `GET /services/:id`.
* **Resposta (HTTP 200 OK)**:
```json
{
  "message": "Serviço desativado com sucesso",
  "service": {
    "id": 1,
    "name": "Corte Feminino",
    "active": false,
    "updated_at": "2026-09-20T22:30:00.000Z"
  }
}
```

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

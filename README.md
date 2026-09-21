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

##  Endpoints de Agendamentos (`/appointments`)

Gerenciamento de agendamentos online e presenciais do salão, com cálculo automático de duração e horário de término, prevenção de sobreposição de horários e integridade transacional.

### 1. Criar Agendamento (`POST /appointments`)
* **Acesso**: Requer autenticação (`CLIENT` ou `ADMIN`).
* **Headers**: `Authorization: Bearer <token_jwt>`
* **Regras de Negócio**:
  * **Perfil CLIENT**:
    * O agendamento é atribuído automaticamente ao próprio cliente (`clientId = userId`, `createdBy = userId`).
    * Canal definido como `ONLINE`.
    * Status inicial definido como `PENDING`.
  * **Perfil ADMIN**:
    * Requer informar o `client_id` de um usuário com perfil `CLIENT`.
    * Canal definido como `PHONE` (ou balcão).
    * Status inicial definido como `CONFIRMED`.
  * **Cálculo de Duração e Término**:
    * Duração total calculada somando os minutos de todos os serviços solicitados.
    * `ends_at = scheduled_at + duracao_total`.
  * **Snapshot de Preço**:
    * Os preços atuais dos serviços são congelados na tabela `appointment_services` no campo `price_charged`.
  * **Validações**:
    * Serviços duplicados no mesmo agendamento são rejeitados (`400 Bad Request`).
    * Serviço inexistente retorna `404 Not Found`.
    * Serviço desativado (`active: false`) retorna `422 Unprocessable Entity`.
    * Data no passado é rejeitada (`400 Bad Request`).
  * **Proteção contra Conflito de Horário**:
    * Validação em nível de serviço e garantia física no PostgreSQL via **Exclusion Constraint** (`EXCLUDE USING gist ...`).
    * Agendamentos sobrepostos com status `PENDING` ou `CONFIRMED` retornam `409 Conflict`.
    * Intervalos contíguos (ex: 14:00-14:30 e 14:30-15:00) são permitidos.
  * **Sugestão de Mesma Semana**:
    * Caso o cliente já possua outro agendamento ativo na mesma semana (segunda a domingo no fuso `America/Sao_Paulo`), a resposta inclui um objeto `suggestion` para facilitar a conciliação de horários (sem bloquear a criação).

* **Exemplo de Requisição (CLIENT)**:
```json
{
  "scheduled_at": "2026-10-15T14:00:00.000Z",
  "services": [1, 2]
}
```

* **Exemplo de Resposta (HTTP 201 Created)**:
```json
{
  "appointment": {
    "id": 10,
    "client_id": 3,
    "client": {
      "id": 3,
      "name": "Maria Oliveira",
      "email": "maria@email.com",
      "phone": "18999991111"
    },
    "created_by": 3,
    "scheduled_at": "2026-10-15T14:00:00.000Z",
    "ends_at": "2026-10-15T15:15:00.000Z",
    "duration": 75,
    "total": 120.00,
    "status": "PENDING",
    "channel": "ONLINE",
    "services": [
      {
        "service_id": 1,
        "service_name": "Corte Feminino",
        "price_charged": 80.00,
        "status": "PENDING"
      },
      {
        "service_id": 2,
        "service_name": "Escova",
        "price_charged": 40.00,
        "status": "PENDING"
      }
    ],
    "created_at": "2026-09-21T01:30:00.000Z",
    "updated_at": "2026-09-21T01:30:00.000Z"
  },
  "suggestion": {
    "suggested_date": "2026-10-14T10:00:00.000Z",
    "reference_appointment_id": 8
  }
}
```

---

### 2. Buscar Agendamento por ID (`GET /appointments/:id`)
* **Acesso**: Requer autenticação (`CLIENT` ou `ADMIN`).
* **Headers**: `Authorization: Bearer <token_jwt>`
* **Regras de Autorização**:
  * Usuários `CLIENT` só podem visualizar seus próprios agendamentos. A tentativa de acessar agendamento de outro cliente retorna `404 Not Found` (evitando enumeração de recursos).
  * Usuários `ADMIN` podem visualizar qualquer agendamento.
* **Resposta (HTTP 200 OK)**:
```json
{
  "appointment": {
    "id": 10,
    "client_id": 3,
    "client": {
      "id": 3,
      "name": "Maria Oliveira",
      "email": "maria@email.com",
      "phone": "18999991111"
    },
    "scheduled_at": "2026-10-15T14:00:00.000Z",
    "ends_at": "2026-10-15T15:15:00.000Z",
    "duration": 75,
    "total": 120.00,
    "status": "PENDING",
    "channel": "ONLINE",
    "services": [
      {
        "service_id": 1,
        "service_name": "Corte Feminino",
        "price_charged": 80.00,
        "status": "PENDING"
      }
    ]
  }
}
```

---

### 3. Listar Agendamentos (`GET /appointments`)
* **Acesso**: Requer autenticação (`CLIENT` ou `ADMIN`).
* **Headers**: `Authorization: Bearer <token_jwt>`
* **Parâmetros de Query**:
  * `page` (opcional, padrão: `1`): número da página.
  * `limit` (opcional, padrão: `10`, máx: `100`): itens por página.
  * `status` (opcional): filtro por enum (`PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`).
  * `client_id` (opcional, apenas para `ADMIN`): filtra agendamentos de um cliente específico.
  * `start_date` (opcional): formato `YYYY-MM-DD` (início do dia em `America/Sao_Paulo`).
  * `end_date` (opcional): formato `YYYY-MM-DD` (fim do dia em `America/Sao_Paulo`).
* **Comportamento por Perfil**:
  * `CLIENT`: retorna exclusivamente os agendamentos pertencentes ao usuário logado.
  * `ADMIN`: retorna agendamentos do sistema todo, com suporte aos filtros avançados.
* **Resposta (HTTP 200 OK)**:
```json
{
  "appointments": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### 4. Alterar Horário ou Serviços (`PATCH /appointments/:id`)
* **Acesso**: Requer autenticação (`CLIENT` ou `ADMIN`).
* **Headers**: `Authorization: Bearer <token_jwt>`
* **Regras de Negócio**:
  * É obrigatório enviar pelo menos um dos campos: `scheduled_at` ou `services`.
  * **Regra de 48 Horas (CLIENT)**:
    * Clientes só podem alterar agendamentos com antecedência mínima de **48 horas corridas** em relação ao horário agendado atual. Tentativas com menos de 48h retornam `403 Forbidden`.
    * Administradores podem alterar a qualquer momento.
  * **Status Permitidos**: Apenas agendamentos em status `PENDING` ou `CONFIRMED` podem ser alterados. Agendamentos `CANCELLED` ou `COMPLETED` retornam `422 Unprocessable Entity`.
  * **Transição de Status**:
    * Se alterado por **CLIENT**: caso esteja `CONFIRMED`, o status retorna para `PENDING` (exige nova confirmação da equipe). Se já estiver `PENDING`, permanece `PENDING`.
    * Se alterado por **ADMIN**: o status é preservado intacto.
  * **Preservação de Snapshot de Preço**:
    * Serviços já existentes que continuam no agendamento mantêm o seu `price_charged` histórico original.
    * Novos serviços adicionados recebem snapshot do preço atual cadastrado em `services`.
    * Serviços removidos são deletados de `appointment_services`.
  * **Recálculo de Duração e Conflitos**:
    * Recalcula `duration` e `ends_at`.
    * Verifica sobreposição ignorando o próprio agendamento (`409 Conflict` se houver colisão).
* **Exemplo de Requisição**:
```json
{
  "scheduled_at": "2026-10-16T10:00:00.000Z",
  "services": [1, 3]
}
```
* **Exemplo de Resposta (HTTP 200 OK)**:
```json
{
  "appointment": {
    "id": 10,
    "client_id": 3,
    "scheduled_at": "2026-10-16T10:00:00.000Z",
    "ends_at": "2026-10-16T11:00:00.000Z",
    "duration": 60,
    "total": 110.00,
    "status": "PENDING",
    "services": [ ... ]
  }
}
```

---

### 5. Cancelar Agendamento (`DELETE /appointments/:id`)
* **Acesso**: Requer autenticação (`CLIENT` ou `ADMIN`).
* **Headers**: `Authorization: Bearer <token_jwt>`
* **Regras de Negócio**:
  * Realiza **exclusão lógica** (soft delete): o registro físico no banco é preservado.
  * O status do agendamento passa para `CANCELLED`.
  * **Regra de 48 Horas (CLIENT)**:
    * Clientes só podem cancelar com antecedência mínima de **48 horas corridas**. Tentativas com menos de 48h retornam `403 Forbidden`.
    * Administradores podem cancelar a qualquer momento.
  * **Validação de Status**: Não é possível cancelar agendamentos já em `CANCELLED` ou `COMPLETED` (`422 Unprocessable Entity`).
  * **Cascata em Itens**: Serviços em status não finalizados (`PENDING`, `IN_PROGRESS`) passam para `CANCELLED`. Itens já `COMPLETED` são preservados no histórico.
* **Exemplo de Resposta (HTTP 200 OK)**:
```json
{
  "message": "Agendamento cancelado com sucesso",
  "appointment": {
    "id": 10,
    "status": "CANCELLED",
    "updated_at": "2026-09-21T02:00:00.000Z"
  }
}
```

---

### 6. Confirmar Agendamento (`PATCH /appointments/:id/confirm`)
* **Acesso**: Exclusivo para administradores (`ADMIN`).
* **Headers**: `Authorization: Bearer <token_jwt>`
* **Regras de Negócio**:
  * Transição permitida: exclusivamente de `PENDING` para `CONFIRMED`.
  * Tentativas de confirmar a partir de outro status retornam `422 Unprocessable Entity`.
  * Não administradores recebem `403 Forbidden`.
* **Exemplo de Resposta (HTTP 200 OK)**:
```json
{
  "message": "Agendamento confirmado com sucesso",
  "appointment": {
    "id": 10,
    "status": "CONFIRMED",
    "updated_at": "2026-09-21T02:05:00.000Z"
  }
}
```

---

### 7. Concluir Agendamento (`PATCH /appointments/:id/complete`)
* **Acesso**: Exclusivo para administradores (`ADMIN`).
* **Headers**: `Authorization: Bearer <token_jwt>`
* **Regras de Negócio**:
  * Transição permitida: exclusivamente de `CONFIRMED` para `COMPLETED`.
  * Tentativas de concluir agendamentos em `PENDING`, `CANCELLED` ou já `COMPLETED` retornam `422 Unprocessable Entity`.
  * Atualiza o status do agendamento para `COMPLETED` e cascateia status `COMPLETED` para itens de serviço ativos.
* **Exemplo de Resposta (HTTP 200 OK)**:
```json
{
  "message": "Agendamento concluído com sucesso",
  "appointment": {
    "id": 10,
    "status": "COMPLETED",
    "updated_at": "2026-09-21T02:10:00.000Z"
  }
}
```

---

### Ciclo de Vida e Matriz de Transição de Status

```text
       ┌───────────┐
       │  PENDING  │ ◄── (CLIENT altera agendamento CONFIRMED)
       └─────┬─────┘
             │ (ADMIN /confirm)
             ▼
       ┌───────────┐
       │ CONFIRMED │
       └─────┬─────┘
             │ (ADMIN /complete)
             ▼
       ┌───────────┐
       │ COMPLETED │ (Terminal)
       └───────────┘

  Qualquer PENDING ou CONFIRMED ──(DELETE /appointments/:id)──► CANCELLED (Terminal)
```

| Status Atual | Ação | Novo Status | Quem pode executar | Regras especiais |
| :--- | :--- | :--- | :--- | :--- |
| `PENDING` | `PATCH /appointments/:id/confirm` | `CONFIRMED` | `ADMIN` | — |
| `CONFIRMED` | `PATCH /appointments/:id/complete` | `COMPLETED` | `ADMIN` | Cascateia `COMPLETED` aos itens |
| `PENDING` / `CONFIRMED` | `DELETE /appointments/:id` | `CANCELLED` | `CLIENT` / `ADMIN` | `CLIENT` exige antecedência ≥ 48h |
| `PENDING` | `PATCH /appointments/:id` | `PENDING` | `CLIENT` / `ADMIN` | `CLIENT` exige antecedência ≥ 48h |
| `CONFIRMED` | `PATCH /appointments/:id` (CLIENT) | `PENDING` | `CLIENT` | Exige ≥ 48h; requer nova confirmação |
| `CONFIRMED` | `PATCH /appointments/:id` (ADMIN) | `CONFIRMED` | `ADMIN` | Mantém confirmação existente |
| `CANCELLED` / `COMPLETED` | Qualquer mutação | Rejeitado (422) | — | Estados terminais são imutáveis |

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

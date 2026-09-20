# Leila Hair & Beauty - Backend

Estrutura inicial do backend desenvolvida com [Node.js](https://nodejs.org/), [TypeScript](https://www.typescriptlang.org/), [Express](https://expressjs.com/), [Swagger (OpenAPI)](https://swagger.io/) e [ESLint](https://eslint.org/).

## Requisitos

- **Node.js**: versão 20 ou superior
- **npm**: gerenciador de pacotes padrão

## Instalação das dependências

Para instalar as dependências do projeto, execute:

```bash
npm install
```

## Execução em desenvolvimento

Para iniciar o servidor em modo de desenvolvimento com hot-reload (via `tsx`):

```bash
npm run dev
```

O servidor será iniciado por padrão em [http://localhost:3001](http://localhost:3001).

## Build de produção

Para compilar o código TypeScript para JavaScript (gerado no diretório `dist/`):

```bash
npm run build
```

## Execução da versão compilada

Após realizar o build, execute a versão de produção compilada:

```bash
npm run start
```

## Verificação de Lint

Para executar o linter do projeto com ESLint:

```bash
npm run lint
```

## Documentação Interativa (Swagger)

A documentação interativa OpenAPI/Swagger está disponível em:

- **URL**: [http://localhost:3001/api-docs](http://localhost:3001/api-docs)

## Endpoint de Health Check

- **Método**: `GET`
- **URL**: `http://localhost:3001/health`
- **Exemplo de resposta (HTTP 200)**:

```json
{
  "status": "ok",
  "uptime": 12.345,
  "timestamp": "2026-09-20T17:20:00.000Z"
}
```

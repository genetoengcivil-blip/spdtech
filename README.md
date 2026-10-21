# Lume - E-commerce Digital

Uma plataforma de e-commerce para venda de cursos, e-books e templates digitais.

## Tecnologias

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Framework**: TanStack Start
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth
- **ORM**: Drizzle ORM
- **Build Tool**: Vite

## Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Supabase
SUPABASE_URL=seu_projeto_supabase_url
SUPABASE_PUBLISHABLE_KEY=sua_chave_publica_supabase
SUPABASE_PROJECT_ID=seu_projeto_id
VITE_SUPABASE_URL=seu_projeto_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica_supabase
VITE_SUPABASE_PROJECT_ID=seu_projeto_id

# Opcional: Database para desenvolvimento local (Drizzle)
DATABASE_URL=postgresql://usuario:senha@localhost:5432/lume
```

### 2. Instalação

```bash
# Instalar dependências
bun install

# Configurar banco de dados
# Execute o arquivo supabase_schema_consolidated.sql no seu projeto Supabase
```

### 3. Scripts

```bash
# Desenvolvimento
bun run dev

# Build
bun run build

# Preview
bun run preview

# Testes
bun run test

# Lint
bun run lint

# Formatar
bun run format
```

## Estrutura do Projeto

```
src/
├── components/     # Componentes reutilizáveis
├── hooks/         # Custom hooks
├── integrations/  # Integrações com serviços externos
├── lib/          # Utilitários e configurações
├── routes/       # Rotas da aplicação
└── server.ts     # Configuração do servidor
```

## Deploy

### GitHub

1. Crie um novo repositório no GitHub
2. Adicione os arquivos do projeto
3. Crie um arquivo `.gitignore` para evitar upload de arquivos desnecessários

### Vercel

1. Conecte seu repositório ao Vercel
2. Adicione as variáveis de ambiente no painel do Vercel
3. Deploy automático será acionado no push para o branch principal

## Banco de Dados

O schema do banco de dados está consolidado em `supabase_schema_consolidated.sql`. Execute este arquivo no SQL Editor do seu projeto Supabase para criar todas as tabelas, funções e políticas necessárias.

## Licença

MIT
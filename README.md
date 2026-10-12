# Bro English

App for a small English class: class calendar, shared expenses and tuition split, vocabulary and spaced-repetition study. Built with Nuxt 4 and MongoDB, deployed on Vercel at https://bro-english.vercel.app.

- **Calendar**: which days had class; tuition is charged per class held.
- **Expenses**: shared bills, who paid and who splits them, monthly summary per person.
- **Vocabulary / Study**: words from each lesson and daily review.
- **Zalo Agent** (`/agent`): reads the class group chat sent by smax.ai to `/api/webhooks/zalo`, marks cancelled or moved classes and records bill photos as expenses.

Environment variables are described in [ENV_SETUP.md](ENV_SETUP.md).

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

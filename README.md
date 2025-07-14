# Vision Monorepo

This is the monorepo for the `@rodrigopsasaki/vision` ecosystem — structured context and observability tools for Node.js.

## Packages

| Package                                       | Description                                                |
| --------------------------------------------- | ---------------------------------------------------------- |
| [`@rodrigopsasaki/vision`](./packages/vision) | Canonical context and structured observability for Node.js |

## Getting Started

Clone the repo and install dependencies:

```bash
pnpm install
```

### Build everything

```bash
turbo run build
```

### Develop a specific package

```bash
cd packages/vision
pnpm dev
```

### Run all tests

```bash
turbo run test
```

## Tooling

- **Monorepo:** [Turborepo](https://turbo.build)
- **Package manager:** [pnpm](https://pnpm.io)
- **TypeScript builds:** [tsup](https://tsup.egoist.dev)
- **Testing:** [Vitest](https://vitest.dev)

## License

MIT © [Rodrigo Sasaki](https://github.com/rodrigopsasaki)

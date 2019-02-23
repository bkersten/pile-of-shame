
# Pile of Shame

Browser extension to archive old tabs to a bookmark folder

## Development

```bash
yarn install
```

### Running

```bash
web-ext run -s ./src --browser-console
```

### Building for distribution

```bash
export __jwt_issuer__=""
export __jwt_secret__=""

web-ext sign -s ./src --api-key "$__jwt_issuer__" --api-secret "$__jwt_secret__"
```

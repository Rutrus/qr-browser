# QR Browser (Rust + WASM)

Aplicacion web minima para:

- Generar QR desde texto.
- Leer QR desde imagen pegada (`Ctrl+V`) o archivo subido.
- Ejecutar toda la logica de QR dentro de WASM (Rust).

## Requisitos

- Rust toolchain
- `wasm-pack`

## Build WASM

```bash
make build-wasm
```

Esto genera los artefactos en `web/pkg`.

## Ejecutar en local

```bash
make serve
```

Abrir:

- [http://localhost:8080](http://localhost:8080)

## Test unitarios

```bash
cargo test
```

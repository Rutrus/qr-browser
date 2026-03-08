WASM_OUT=web/pkg

.PHONY: build-wasm serve clean

build-wasm:
	wasm-pack build --target web --release --out-dir $(WASM_OUT)

serve:
	python3 -m http.server 8080 -d web

clean:
	rm -rf target $(WASM_OUT)

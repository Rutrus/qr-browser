use std::sync::Once;

use qrcodegen::{QrCode, QrCodeEcc};
use wasm_bindgen::prelude::*;

static PANIC_HOOK: Once = Once::new();

#[wasm_bindgen(start)]
pub fn init() {
    PANIC_HOOK.call_once(console_error_panic_hook::set_once);
}

#[wasm_bindgen]
pub fn generate_qr_svg(text: &str) -> Result<String, JsValue> {
    generate_qr_svg_advanced(text, "M", 4)
}

#[wasm_bindgen]
pub fn generate_qr_svg_advanced(
    text: &str,
    redundancy: &str,
    border: i32,
) -> Result<String, JsValue> {
    if text.trim().is_empty() {
        return Err(JsValue::from_str("Text for QR generation cannot be empty."));
    }
    if !(0..=32).contains(&border) {
        return Err(JsValue::from_str("Border must be between 0 and 32."));
    }

    let ecc = parse_redundancy(redundancy)?;
    let qr = QrCode::encode_text(text, ecc)
        .map_err(|err| JsValue::from_str(&format!("Could not generate QR: {err:?}")))?;

    Ok(qr_to_svg(&qr, border))
}

#[wasm_bindgen]
pub fn decode_qr_from_rgba(width: u32, height: u32, rgba: &[u8]) -> Result<String, JsValue> {
    let expected_len = (width as usize)
        .checked_mul(height as usize)
        .and_then(|pixels| pixels.checked_mul(4))
        .ok_or_else(|| JsValue::from_str("Invalid image dimensions."))?;

    if rgba.len() != expected_len {
        return Err(JsValue::from_str(
            "RGBA buffer does not match the provided dimensions.",
        ));
    }

    let grayscale = rgba_to_grayscale(rgba);
    decode_from_grayscale(width, height, &grayscale)
}

fn rgba_to_grayscale(rgba: &[u8]) -> Vec<u8> {
    rgba.chunks_exact(4)
        .map(|px| {
            let r = px[0] as u32;
            let g = px[1] as u32;
            let b = px[2] as u32;
            ((r * 299 + g * 587 + b * 114) / 1000) as u8
        })
        .collect()
}

fn decode_from_grayscale(width: u32, height: u32, grayscale: &[u8]) -> Result<String, JsValue> {
    let mut decoder = quircs::Quirc::default();
    let codes = decoder.identify(width as usize, height as usize, grayscale);

    for code in codes {
        let code =
            code.map_err(|err| JsValue::from_str(&format!("Error identifying QR: {err}")))?;
        let decoded = code.decode().map_err(|err| {
            JsValue::from_str(&format!("QR detected but decoding failed: {err}"))
        })?;
        let text = String::from_utf8(decoded.payload)
            .map_err(|_| JsValue::from_str("QR payload is not valid UTF-8."))?;
        return Ok(text);
    }

    Err(JsValue::from_str("No QR code detected in the provided image."))
}

fn qr_to_svg(qr: &QrCode, border: i32) -> String {
    let size = qr.size();
    let dimension = size + border * 2;
    let mut svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {dimension} {dimension}\" width=\"{dimension}\" height=\"{dimension}\" shape-rendering=\"crispEdges\">\
<rect width=\"100%\" height=\"100%\" fill=\"#FFFFFF\"/>\
<path d=\""
    );

    for y in 0..size {
        for x in 0..size {
            if qr.get_module(x, y) {
                let x_pos = x + border;
                let y_pos = y + border;
                svg.push_str(&format!("M{x_pos},{y_pos}h1v1h-1z"));
            }
        }
    }

    svg.push_str("\" fill=\"#000000\"/></svg>");
    svg
}

fn parse_redundancy(redundancy: &str) -> Result<QrCodeEcc, JsValue> {
    match redundancy.trim().to_ascii_uppercase().as_str() {
        "L" | "LOW" => Ok(QrCodeEcc::Low),
        "M" | "MEDIUM" => Ok(QrCodeEcc::Medium),
        "Q" | "QUARTILE" => Ok(QrCodeEcc::Quartile),
        "H" | "HIGH" => Ok(QrCodeEcc::High),
        _ => Err(JsValue::from_str(
            "Invalid redundancy. Use one of: L, M, Q, H.",
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn convierte_rgba_a_grises() {
        let rgba = vec![255, 0, 0, 255, 0, 255, 0, 255];
        let gray = rgba_to_grayscale(&rgba);
        assert_eq!(gray.len(), 2);
        assert!(gray[0] < gray[1]);
    }

    #[test]
    fn genera_svg_valido() {
        let svg = generate_qr_svg("hola").expect("Debe generar SVG");
        assert!(svg.contains("<svg"));
        assert!(svg.contains("</svg>"));
    }

    #[test]
    fn genera_svg_avanzado_valido() {
        let svg = generate_qr_svg_advanced("hola", "H", 2).expect("Debe generar SVG");
        assert!(svg.contains("viewBox"));
    }
}

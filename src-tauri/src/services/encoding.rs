use encoding_rs::{Encoding as RsEncoding, GB18030, GBK, UTF_16BE, UTF_16LE, UTF_8, WINDOWS_1252};
use serde::{Deserialize, Serialize};

pub const BOM_UTF8: [u8; 3] = [0xEF, 0xBB, 0xBF];

/// The encodings Npcc can read and write. Names match `Encoding` in
/// `src/shared/types.ts` one-to-one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Encoding {
    #[serde(rename = "utf-8")]
    Utf8,
    #[serde(rename = "utf-8-bom")]
    Utf8Bom,
    #[serde(rename = "gbk")]
    Gbk,
    #[serde(rename = "gb18030")]
    Gb18030,
    #[serde(rename = "utf-16le")]
    Utf16Le,
    #[serde(rename = "utf-16be")]
    Utf16Be,
    #[serde(rename = "latin1")]
    Latin1,
}

impl Default for Encoding {
    fn default() -> Self {
        Encoding::Utf8
    }
}

impl Encoding {
    pub fn rs(self) -> &'static RsEncoding {
        match self {
            Encoding::Utf8 | Encoding::Utf8Bom => UTF_8,
            Encoding::Gbk => GBK,
            Encoding::Gb18030 => GB18030,
            Encoding::Utf16Le => UTF_16LE,
            Encoding::Utf16Be => UTF_16BE,
            Encoding::Latin1 => WINDOWS_1252,
        }
    }
}

/// Cuts a leading BOM from `bytes`, whatever its flavour.
pub fn strip_bom(bytes: &[u8]) -> &[u8] {
    if bytes.starts_with(&BOM_UTF8) {
        &bytes[3..]
    } else if bytes.starts_with(&[0xFF, 0xFE]) || bytes.starts_with(&[0xFE, 0xFF]) {
        &bytes[2..]
    } else {
        bytes
    }
}

/// Detection order: BOM -> strict UTF-8 -> chardetng guess -> round-trip check
/// -> ISO-8859-1, which always round-trips and therefore never corrupts data.
pub fn detect(bytes: &[u8]) -> Encoding {
    if bytes.starts_with(&BOM_UTF8) {
        return Encoding::Utf8Bom;
    }
    if bytes.starts_with(&[0xFF, 0xFE]) {
        return Encoding::Utf16Le;
    }
    if bytes.starts_with(&[0xFE, 0xFF]) {
        return Encoding::Utf16Be;
    }
    if bytes.is_empty() || std::str::from_utf8(bytes).is_ok() {
        return Encoding::Utf8;
    }

    let mut detector = chardetng::EncodingDetector::new();
    let sample_len = bytes.len().min(1024 * 1024);
    detector.feed(&bytes[..sample_len], true);
    let guessed = detector.guess(None, true);

    let candidate = match guessed.name() {
        "GBK" => Encoding::Gbk,
        "gb18030" => Encoding::Gb18030,
        "UTF-16LE" => Encoding::Utf16Le,
        "UTF-16BE" => Encoding::Utf16Be,
        "windows-1252" | "ISO-8859-1" | "ISO-8859-15" => Encoding::Latin1,
        // Anything outside our supported set (Big5, Shift_JIS, ...) is still
        // very often GB18030-compatible; the round-trip check below decides.
        _ => Encoding::Gb18030,
    };

    if roundtrip_ok(bytes, candidate) {
        return candidate;
    }
    Encoding::Latin1
}

fn roundtrip_ok(bytes: &[u8], encoding: Encoding) -> bool {
    let (text, _) = decode(bytes, encoding);
    let (encoded, _) = encode(&text, encoding);
    encoded == bytes
}

/// Decodes `bytes`, stripping any BOM. The flag reports invalid sequences.
///
/// UTF-16 is decoded by hand: `encoding_rs` maps its *output* encoding to UTF-8,
/// which would silently turn a UTF-16 file into mixed-up bytes on save.
pub fn decode(bytes: &[u8], encoding: Encoding) -> (String, bool) {
    let body = strip_bom(bytes);
    if matches!(encoding, Encoding::Utf16Le | Encoding::Utf16Be) {
        let little_endian = encoding == Encoding::Utf16Le;
        let units: Vec<u16> = body
            .chunks_exact(2)
            .map(|pair| {
                if little_endian {
                    u16::from_le_bytes([pair[0], pair[1]])
                } else {
                    u16::from_be_bytes([pair[0], pair[1]])
                }
            })
            .collect();
        // An odd trailing byte means the file is not valid UTF-16.
        return (String::from_utf16_lossy(&units), body.len() % 2 == 1);
    }
    let (cow, _actual, had_errors) = encoding.rs().decode(body);
    (cow.into_owned(), had_errors)
}

/// Encodes `text`, adding the BOM the target encoding expects.
pub fn encode(text: &str, encoding: Encoding) -> (Vec<u8>, bool) {
    if matches!(encoding, Encoding::Utf16Le | Encoding::Utf16Be) {
        let little_endian = encoding == Encoding::Utf16Le;
        let mut out = Vec::with_capacity(text.len() * 2 + 2);
        if little_endian {
            out.extend_from_slice(&[0xFF, 0xFE]);
        } else {
            out.extend_from_slice(&[0xFE, 0xFF]);
        }
        for unit in text.encode_utf16() {
            let pair = if little_endian {
                unit.to_le_bytes()
            } else {
                unit.to_be_bytes()
            };
            out.extend_from_slice(&pair);
        }
        return (out, false);
    }

    let (cow, _actual, had_errors) = encoding.rs().encode(text);
    let body = strip_bom(&cow);
    if encoding == Encoding::Utf8Bom {
        let mut out = Vec::with_capacity(body.len() + BOM_UTF8.len());
        out.extend_from_slice(&BOM_UTF8);
        out.extend_from_slice(body);
        (out, had_errors)
    } else {
        (body.to_vec(), had_errors)
    }
}

/// Convenience wrapper: detect the encoding, then decode.
pub fn decode_auto(bytes: &[u8]) -> (String, Encoding, bool) {
    let encoding = detect(bytes);
    let (text, had_errors) = decode(bytes, encoding);
    (text, encoding, had_errors)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_utf8_plain() {
        let bytes = "hello 世界".as_bytes();
        assert_eq!(detect(bytes), Encoding::Utf8);
        let (text, had_errors) = decode(bytes, Encoding::Utf8);
        assert_eq!(text, "hello 世界");
        assert!(!had_errors);
    }

    #[test]
    fn detects_and_preserves_utf8_bom() {
        let mut bytes = Vec::from(BOM_UTF8);
        bytes.extend_from_slice("bom".as_bytes());
        assert_eq!(detect(&bytes), Encoding::Utf8Bom);
        let (text, _) = decode(&bytes, Encoding::Utf8Bom);
        assert_eq!(text, "bom");
        let (encoded, _) = encode(&text, Encoding::Utf8Bom);
        assert_eq!(encoded, bytes);
    }

    #[test]
    fn gbk_roundtrip_keeps_bytes() {
        // 中文 in GBK
        let bytes: Vec<u8> = vec![0xD6, 0xD0, 0xCE, 0xC4];
        let encoding = detect(&bytes);
        assert_eq!(encoding, Encoding::Gbk);
        let (text, _) = decode(&bytes, encoding);
        assert_eq!(text, "中文");
        let (back, had_errors) = encode(&text, Encoding::Gbk);
        assert!(!had_errors);
        assert_eq!(back, bytes);
    }

    #[test]
    fn utf16le_bom_roundtrip() {
        let (bytes, _) = encode("npcc 编辑器", Encoding::Utf16Le);
        assert_eq!(detect(&bytes), Encoding::Utf16Le);
        let (text, _) = decode(&bytes, Encoding::Utf16Le);
        assert_eq!(text, "npcc 编辑器");
        let (back, _) = encode(&text, Encoding::Utf16Le);
        assert_eq!(back, bytes);
    }

    #[test]
    fn utf16be_roundtrip() {
        let (bytes, _) = encode("a中", Encoding::Utf16Be);
        assert_eq!(&bytes[..2], &[0xFE, 0xFF]);
        assert_eq!(detect(&bytes), Encoding::Utf16Be);
        let (text, had_errors) = decode(&bytes, Encoding::Utf16Be);
        assert_eq!(text, "a中");
        assert!(!had_errors);
        assert_eq!(encode(&text, Encoding::Utf16Be).0, bytes);
    }

    #[test]
    fn bom_never_reaches_the_editor() {
        let mut bytes = Vec::from(BOM_UTF8);
        bytes.extend_from_slice("hi".as_bytes());
        let (text, _) = decode(&bytes, Encoding::Utf8Bom);
        assert_eq!(text, "hi");
        assert!(!text.contains('\u{feff}'));
    }

    #[test]
    fn unrepresentable_characters_are_reported() {
        let (_, had_errors) = encode("emoji 😀", Encoding::Gbk);
        assert!(had_errors);
    }

    #[test]
    fn latin1_always_roundtrips() {
        let bytes: Vec<u8> = vec![0xE9, 0xE8, 0x20, 0xFF];
        let encoding = detect(&bytes);
        let (text, _) = decode(&bytes, encoding);
        let (back, _) = encode(&text, encoding);
        assert_eq!(back, bytes);
    }
}

use serde::{Deserialize, Serialize};

/// Line endings Npcc can read, report and write back.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Eol {
    #[serde(rename = "lf")]
    Lf,
    #[serde(rename = "crlf")]
    Crlf,
    #[serde(rename = "cr")]
    Cr,
}

impl Default for Eol {
    fn default() -> Self {
        Eol::Crlf
    }
}

/// Picks the most frequent line ending; ties prefer CRLF, then LF.
pub fn detect(text: &str) -> Eol {
    let bytes = text.as_bytes();
    let mut crlf = 0usize;
    let mut lf = 0usize;
    let mut cr = 0usize;
    let mut i = 0usize;
    while i < bytes.len() {
        match bytes[i] {
            b'\r' => {
                if i + 1 < bytes.len() && bytes[i + 1] == b'\n' {
                    crlf += 1;
                    i += 2;
                    continue;
                }
                cr += 1;
            }
            b'\n' => lf += 1,
            _ => {}
        }
        i += 1;
    }
    if crlf == 0 && lf == 0 && cr == 0 {
        return Eol::Lf;
    }
    if crlf >= lf && crlf >= cr {
        Eol::Crlf
    } else if lf >= cr {
        Eol::Lf
    } else {
        Eol::Cr
    }
}

/// Converts every line ending in `text` to `eol`. The editor always holds LF.
pub fn normalize(text: &str, eol: Eol) -> String {
    let unified = to_lf(text);
    match eol {
        Eol::Lf => unified,
        Eol::Crlf => unified.replace('\n', "\r\n"),
        Eol::Cr => unified.replace('\n', "\r"),
    }
}

/// Collapses CRLF and lone CR into LF so CodeMirror sees a single line separator.
pub fn to_lf(text: &str) -> String {
    if !text.contains('\r') {
        return text.to_owned();
    }
    let mut out = String::with_capacity(text.len());
    let bytes = text.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() {
        if bytes[i] == b'\r' {
            // Keep any multi-byte character intact: we only strip CR bytes.
            out.push('\n');
            if i + 1 < bytes.len() && bytes[i + 1] == b'\n' {
                i += 2;
            } else {
                i += 1;
            }
            continue;
        }
        let rest = &text[i..];
        let ch = rest.chars().next().unwrap_or('\0');
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_crlf() {
        assert_eq!(detect("a\r\nb\r\nc"), Eol::Crlf);
    }

    #[test]
    fn detects_lf() {
        assert_eq!(detect("a\nb\nc"), Eol::Lf);
    }

    #[test]
    fn detects_cr() {
        assert_eq!(detect("a\rb\rc"), Eol::Cr);
    }

    #[test]
    fn empty_text_is_lf() {
        assert_eq!(detect(""), Eol::Lf);
    }

    #[test]
    fn mixed_endings_prefer_the_majority() {
        assert_eq!(detect("a\r\nb\nc\r\nd"), Eol::Crlf);
        assert_eq!(detect("a\nb\nc\r\n"), Eol::Lf);
    }

    #[test]
    fn normalizes_to_crlf_and_back() {
        let lf = to_lf("a\r\nb\rc\nd");
        assert_eq!(lf, "a\nb\nc\nd");
        assert_eq!(normalize(&lf, Eol::Crlf), "a\r\nb\r\nc\r\nd");
        assert_eq!(normalize(&lf, Eol::Cr), "a\rb\rc\rd");
        assert_eq!(normalize(&lf, Eol::Lf), "a\nb\nc\nd");
    }

    #[test]
    fn to_lf_keeps_multibyte_characters() {
        let text = "中文\r\n行\n尾\r结束";
        assert_eq!(to_lf(text), "中文\n行\n尾\n结束");
    }
}

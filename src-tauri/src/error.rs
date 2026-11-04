use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};
use std::io;

/// Every command returns this error type; it serialises to `{ code, message }`
/// so the renderer can branch on `code` instead of parsing prose.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("file not found: {0}")]
    NotFound(String),
    #[error("permission denied: {0}")]
    PermissionDenied(String),
    #[error("file is read-only: {0}")]
    ReadOnly(String),
    #[error("file is too large ({0} bytes)")]
    FileTooLarge(u64),
    #[error("invalid argument: {0}")]
    Invalid(String),
    #[error("io error: {0}")]
    Io(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::NotFound(_) => "not_found",
            AppError::PermissionDenied(_) => "permission_denied",
            AppError::ReadOnly(_) => "read_only",
            AppError::FileTooLarge(_) => "file_too_large",
            AppError::Invalid(_) => "invalid_argument",
            AppError::Io(_) => "io_error",
        }
    }
}

impl From<io::Error> for AppError {
    fn from(err: io::Error) -> Self {
        match err.kind() {
            io::ErrorKind::NotFound => AppError::NotFound(err.to_string()),
            io::ErrorKind::PermissionDenied => AppError::PermissionDenied(err.to_string()),
            _ => AppError::Io(err.to_string()),
        }
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

use std::fmt::{self, Display};

#[derive(Debug, Copy, Clone)]
pub enum RadarError {
    CatchRateTooHigh(u32),
}

impl Display for RadarError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CatchRateTooHigh(r) => write!(
                f,
                "Catch rate is in thousandths, but <{}> is over 1000 (> 100%)",
                r
            ),
        }
    }
}

use wasm_bindgen::prelude::*;
use pokeradar;

pub use pokeradar::Config;

#[wasm_bindgen]
pub fn run_shiny_mc(config: &Config) -> Box<[f64]> {
    pokeradar::find_shiny(*config)
        .flat_map(|x| [x.q02, x.q25, x.q50, x.q75, x.q98])
        .collect()
}
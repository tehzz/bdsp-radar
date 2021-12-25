use pokeradar;
use wasm_bindgen::prelude::*;
use copyless::BoxHelper;

pub use pokeradar::Config;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn run_shiny_mc(config: &Config) -> Box<[f64]> {
    pokeradar::find_shiny(*config)
        .flat_map(|x| [x.q09, x.q25, x.q50, x.q75, x.q91])
        .collect()
}

#[wasm_bindgen]
pub fn run_shiny_mc_single_chain(config: &Config, target: usize) -> Box<[f64]> {
    let x = pokeradar::mc_find_radar_shiny(*config, target);

    Box::alloc().init([x.q09, x.q25, x.q50, x.q75, x.q91])
}

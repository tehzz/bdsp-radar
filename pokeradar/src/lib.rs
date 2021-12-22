mod errors;

use rand::prelude::*;
#[cfg(not(target_arch = "wasm32"))]
use rayon::prelude::*;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

pub use errors::RadarError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub struct Config {
    pub chain_start: u8,
    pub chain_max: u8,
    pub sample_size: u32,
    pub total_shinies: u32,
    // in thousandths
    pub pkmn_wildrate: u32,
    // in seconds for "time_for_.."
    pub time_for_catch: u32,
    pub time_for_run: u32,
    pub time_for_reroll: u32,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl Config {
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(constructor))]
    pub fn new_web() -> Self {
        Self {
            chain_start: 1,
            chain_max: 40,
            sample_size: 1_000,
            total_shinies: 1,
            pkmn_wildrate: 10_0,
            time_for_catch: 50,
            time_for_run: 30,
            time_for_reroll: 10,
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            chain_start: 0,
            chain_max: 40,
            sample_size: 3_000,
            total_shinies: 1,
            pkmn_wildrate: 10_0,
            time_for_catch: 50,
            time_for_run: 30,
            time_for_reroll: 10,
        }
    }
}

const RADAR_ODDS: &[u32] = &[
    4096, 3855, 3640, 3449, 3277, 3121, 2979, 2849, 2731, 2621, 2521, 2427, 2341, 2259, 2185, 2114,
    2048, 1986, 1927, 1872, 1820, 1771, 1724, 1680, 1638, 1598, 1560, 1524, 1489, 1456, 1310, 1285,
    1260, 1236, 1213, 1192, 993, 799, 400, 200, 99,
];
const FULL_ODDS: u32 = RADAR_ODDS[0];
const FINAL_ODDS: u32 = RADAR_ODDS[40];

#[cfg(not(target_arch = "wasm32"))]
pub fn find_shiny(config: Config) -> Result<Vec<Percentiles>, RadarError> {
    if config.pkmn_wildrate > 1000 {
        return Err(RadarError::CatchRateTooHigh(config.pkmn_wildrate));
    }

    let chain_range = config.chain_start as usize..=config.chain_max as usize;
    let find_shiny = |len| mc_find_radar_shiny(config, len);

    let mc_summary = chain_range.into_par_iter().map(find_shiny).collect();

    Ok(mc_summary)
}

#[cfg(target_arch = "wasm32")]
pub fn find_shiny(config: Config) -> impl Iterator<Item = Percentiles> {
    let chain_range = config.chain_start as usize..=config.chain_max as usize;
    let find_shiny = move |len| mc_find_radar_shiny(config, len);

    chain_range.into_iter().map(find_shiny)
}

fn encountered_correct_pkmn(rng: &mut ThreadRng, rate: u32) -> bool {
    rng.gen_ratio(rate, 1000)
}

fn mc_find_radar_shiny(config: Config, target_chain_size: usize) -> Percentiles {
    let mut rng = thread_rng();
    let mut set = Vec::with_capacity(config.sample_size as usize);
    let found_all_shines = |cur| cur >= config.total_shinies;

    for _ in 0..config.sample_size {
        let mut time = 0u32;
        let mut current_chain = 0;
        let mut snum = 0u32; // number of shinies

        while !found_all_shines(snum) {
            let current_odds = RADAR_ODDS.get(current_chain).copied().unwrap_or(FINAL_ODDS);
            let patch_roll = check_four_patches(&mut rng, current_odds);
            let patch_shiny_count = patch_roll as u32;

            let building_chain =
                current_chain < target_chain_size && !found_all_shines(snum + patch_shiny_count);
            let catch_shiny_and_cont = patch_roll && !found_all_shines(snum + patch_shiny_count);

            if building_chain || catch_shiny_and_cont {
                let correct_pkmn =
                    current_chain != 0 || encountered_correct_pkmn(&mut rng, config.pkmn_wildrate);
                let encountered_shiny = patch_roll || encounter_full_odds(&mut rng);

                // know we know that the shiny (if found either in the patches or in the encounter) is the target pokemon
                // then, catch it to continue the chain
                if correct_pkmn {
                    snum += encountered_shiny as u32;
                    time = time.saturating_add(config.time_for_catch);
                } else {
                    // flee battle from wrong pokemon
                    time = time.saturating_add(config.time_for_run)
                }

                // roll to see if the chain continues
                if correct_pkmn && chain_continues(&mut rng) {
                    current_chain += 1;
                } else {
                    current_chain = 0;
                    time = time.saturating_add(config.time_for_reroll);
                }
            } else if !patch_roll {
                // at the target chain, but didn't find a shiny, so reroll radar
                time = time.saturating_add(config.time_for_reroll);
            } else {
                // else, catch the final shiny
                // but we don't count that time it takes to do that, as the user has reached their goal
                snum += patch_shiny_count;
            }
        }

        // all shiny/shinies found; record time it took to find
        set.push(time);
    }

    set.sort_unstable();
    Percentiles::from(set.as_slice())
}

fn check_four_patches(rng: &mut ThreadRng, out_of: u32) -> bool {
    (0..3).map(|_| rng.gen_ratio(1, out_of)).any(|b| b)
}

fn encounter_full_odds(rng: &mut ThreadRng) -> bool {
    rng.gen_ratio(1, FULL_ODDS)
}

fn chain_continues(rng: &mut ThreadRng) -> bool {
    rng.gen_ratio(93, 100)
}

/// Get the 2nd, 25th, 50th, 75th, and 98th percentile for
/// the number of seconds needed to find a pokeradar shiny
#[derive(Debug, Clone, Copy)]
pub struct Percentiles {
    pub q09: f64,
    pub q25: f64,
    pub q50: f64,
    pub q75: f64,
    pub q91: f64,
}

// assumes sorted data
impl From<&[u32]> for Percentiles {
    fn from(data: &[u32]) -> Self {
        debug_assert!(data.len() > 2, "need data to find percentiles");

        Self {
            q09: quantile(data, 0.09),
            q25: quantile(data, 0.25),
            q50: quantile(data, 0.50),
            q75: quantile(data, 0.75),
            q91: quantile(data, 0.91),
        }
    }
}

// https://en.wikipedia.org/wiki/Quartile#Method_4
fn quantile(data: &[u32], q: f64) -> f64 {
    let nplus = (data.len() + 1) as f64;
    let k = (q * nplus) as usize;
    let alpha = q * nplus - (q * nplus).trunc();

    data[k] as f64 + alpha * (data[k + 1] - data[k]) as f64
}

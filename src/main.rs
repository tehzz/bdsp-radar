
use rand::prelude::*;
use rayon::prelude::*;


const MAX_CHAIN: usize = 40;
const SAMPLE_SIZE: u64 = 30_000;
const RADAR_ODDS: &[u32] = &[
    4096, 3855, 3640, 3449, 3277, 3121, 2979, 2849, 2731, 2621,
    2521, 2427, 2341, 2259, 2185, 2114, 2048, 1986, 1927, 1872,
    1820, 1771, 1724, 1680, 1638, 1598, 1560, 1524, 1489, 1456,
    1310, 1285, 1260, 1236, 1213, 1192,  993,  799,  400,  200, 
      99
];
const FULL_ODDS: u32 = RADAR_ODDS[0];

// timings in seconds
const TIME_TO_CATCH: u64 = 50;
const TIME_TO_RUN: u64 = 30;
const REROLL_RADAR: u64 = 10;
const TARGET_PKMN_THOUSANDTHS: u32 = 10_0;

fn main() {
    println!("staring run of {} iterations up to chain of {}", SAMPLE_SIZE, MAX_CHAIN);
    let run = mc_shiny_iters();

    for (run, p) in run.into_iter().enumerate() {
        println!("{}\t{:.2} min [{:.2} to {:.2}; 99th of {:.2}]", run, p.median / 60., p.q25 / 60., p.q75 / 60., p.q99 / 60.);
    }
}

fn mc_shiny_iters() -> Vec<Percentiles> {
    (0..=MAX_CHAIN)
        .into_par_iter()
        .map(mc_shiny_chain_to)
        .collect()
}

fn mc_shiny_chain_to(target_chain_size: usize) -> Percentiles {
    let mut rng = thread_rng();
    let mut set = Vec::with_capacity(SAMPLE_SIZE as usize);

    for _ in 0..SAMPLE_SIZE {
        let mut time = 0;
        let mut current_chain = 0;
        let mut shiny = false;

        // start and build the chain
        while current_chain < target_chain_size && !shiny {
            // start a chain
            if current_chain == 0 {
                shiny = check_four_patches(&mut rng, FULL_ODDS);
                // is the encounter our pokemon?
                if rng.gen_ratio(TARGET_PKMN_THOUSANDTHS, 1000) {
                    // full odds shiny check (Phil got a shiny magnemite in non-shiny grass)
                    shiny |= rng.gen_ratio(1, FULL_ODDS);

                    if !shiny {
                        // have to continue the chain
                        time += TIME_TO_CATCH;
                        if rng.gen_ratio(93, 100) {
                            // chain continues
                            current_chain += 1;
                        }
                    }
                } else {
                    // not the correct pokemon; run and reroll
                    time += TIME_TO_RUN + REROLL_RADAR;
                    // hope you didn't find a shiny of the wrong pokemon lol
                    shiny = false;
                }
            } else {
                // continue a chain
                let current_odds = RADAR_ODDS[current_chain];
                shiny = check_four_patches(&mut rng, current_odds) || rng.gen_ratio(1, FULL_ODDS);
    
                if !shiny {
                    if rng.gen_ratio(93, 100) {
                        current_chain += 1;
                        time += TIME_TO_CATCH;
                    } else {
                        current_chain = 0;
                        //time += FAILED_CHAIN_RESTART;
                    }
                }
            }
        }
        // chain has made it to target length
        let odds = RADAR_ODDS[current_chain];
        if target_chain_size == 0 {
            while !shiny {
                shiny = check_four_patches(&mut rng, FULL_ODDS);
                // is the encounter our pokemon?
                if rng.gen_ratio(TARGET_PKMN_THOUSANDTHS, 1000) {
                    // full odds shiny check (Phil got a shiny magnemite in non-shiny grass)
                    shiny |= rng.gen_ratio(1, FULL_ODDS);
    
                    if !shiny {
                        // have to continue the chain
                        time += TIME_TO_CATCH;
                        if rng.gen_ratio(93, 100) {
                            // chain continues
                            current_chain += 1;
                        }
                    }
                } else {
                    // not the correct pokemon; run and reroll
                    time += TIME_TO_RUN + REROLL_RADAR;
                    // hope you didn't find a shiny of the wrong pokemon lol
                    shiny = false;
                }
            }
        } else {
            // normal chain; assured the pokemon in the grass
            while !shiny {
                time += REROLL_RADAR;
                shiny = check_four_patches(&mut rng, odds);
            }
        }

        // shiny finally found!
        set.push(time);
    }

    set.sort_unstable();


    Percentiles::from(set.as_slice())
}


fn check_four_patches(rng: &mut ThreadRng, out_of: u32) -> bool {
    (0..3).map(|_| rng.gen_ratio(1, out_of)).any(|b| b)
}


#[derive(Debug, Clone, Copy)]
struct Percentiles {
    min: u64,
    q25: f64,
    median: f64,
    q75: f64,
    q99: f64,
    max: u64,
}

// assumes sorted data
impl From<&[u64]> for Percentiles {
    fn from(data: &[u64]) -> Self {
        assert!(data.len() > 2, "need data to find percentiles");

        Self {
            min: *data.first().unwrap(),
            q25: quantile(data, 0.25),
            median: quantile(data, 0.5),
            q75: quantile(data, 0.75),
            q99: quantile(data, 0.99),
            max: *data.last().unwrap(),
        }
        
    }
}

// https://en.wikipedia.org/wiki/Quartile#Method_4
fn quantile(data: &[u64], q: f64) -> f64 {
    let nplus = (data.len() + 1) as f64;
    let k = (q * nplus) as usize;
    let alpha = q * nplus - (q * nplus).trunc();

    data[k] as f64 + alpha * (data[k + 1] - data[k]) as f64
}


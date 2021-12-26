# BDSP Pokeradar Shiny Simulator
A simple Monte Carlo simulation of shiny hunting with the Brilliant Diamond/Shining Pearl Pokeradar.

Run your simulations @ https://tehzz.github.io/bdsp-radar/

The code is based on the famous [Optimal Chain Length is 17](https://www.reddit.com/r/PokemonBDSP/comments/r5ngul/pok%C3%A9radar_shiny_chaining_optimal_chain_length_is/) reddit post. This repository extends the original work to add in the encounter rate of the target pokemon, as well as adding the ability to catch multiple shinies.

In short, it simulates how long it will take to find a shiny while using the pokeradar for a chain of a given length. 


## Parameters

* **Starting Chain** - the smallest chain to simulate
* **Max Chain** - the largest chain to simulate 
  * All chains between **Starting** and **Max** are simulated
* **Sampling Runs** - the number of times to simulate a shiny hunt at a chain length
* **Total Shinies** - the total number of shinies to find before the hunt simulation is complete
* **Pokemon Encounter Rate** - the encounter rate (to the tenth of a percent) of the target pokemon
* **Time to Catch** - how long (in seconds) it takes on average to capture the target pokemon
  * A turn 1 quick ball capture is around **~35 seconds**, depending on route, affection, ability, etc.
  * A false swipe then capture is around **~45 seconds**
* **Time to Run** - how long (in seconds) it takes on average from the wrong pokemon while starting a chain
* **Time to Re-roll Pokeradar** - how long (in seconds) it takes on average to walk 50 steps, re-roll the radar, and enter a grass patch

## Assumptions
* The player always has and does the optimal radar move:
  * Enters a grass patch four spaces away
  * Catches a pokemon
* Four patches always appear
* When the target chain length is reached, the player always rerolls to get four new patches
* Shinies appear in an optimal patch
  * This is only important when simulating a mutli-shiny [> 1] run

## Todos
### Figure out how grass patches are distributed
Right now, the code assumes that there will (a) be four patches and (b) at least one patch will four tiles away. Ideally, this distribution would be simulated as well for both continuing the chain, and capturing a shiny in a non-optimal patch

## Building
The main "mathy" code is in Rust and is compiled to WASM for running the browser. There is also a stand-alone CLI app for running the simulations directly on your computer

### Website
1. [Install wasm-pack](https://rustwasm.github.io/wasm-pack/)
2. Run `./build.sh` 
3. Run a local server for the `www` subdirectory (e.g., `python3 -m http.server`)

### CLI
1. [Install Cargo/Rust](https://rustup.rs)
2. `cargo run --release --bin shunter -- {options}` or `cargo install --bin shunter`


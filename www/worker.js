importScripts("./pkg/radarweb.js")

console.log("initializing worker")

const {Config, run_shiny_mc} = wasm_bindgen

async function init_wasm_worker() {
    onmessage = event => {
        console.log("pre init message", event)
    }
    // load wasm
    await wasm_bindgen('./pkg/radarweb_bg.wasm')

    let config = new Config()

    onmessage = event => {
        const d = event.data

        switch (d.cmd) {
            case "RUN": {
                console.log("starting run")
                let data = parse_quartile_data(run_shiny_mc(config), config.chain_start);

                self.postMessage({kind: "FINISHED_RUN", data})
                break;
            }
            case "GET": {
                let val;
                switch (d.param) {
                    case "chainStart": val = config.chain_start; break;
                    case "chainMax": val = config.chain_max; break;
                    case "sampleSize": val = config.sample_size; break;
                    case "totalShinies": val = config.total_shinies; break;
                    case "pkmnWildrate": val = config.pkmn_wildrate; break;
                    case "timeForCatch": val = config.time_for_catch; break;
                    case "timeForRun": val = config.time_for_run; break;
                    case "timeForReroll": val = config.time_for_reroll; break;
                    default: val = null;
                }

                postMessage({kind: "GET_CONFIG", id: d.param, val: val})
                break;
            }
            case "SET": {
                const val = d.val;

                console.log("set", d);

                switch (d.param) {
                    case "chainStart": config.chain_start = val; break;
                    case "chainMax": config.chain_max = val; break;
                    case "sampleSize": config.sample_size = val; break;
                    case "totalShinies": config.total_shinies = val; break;
                    case "pkmnWildrate": config.pkmn_wildrate = val; break;
                    case "timeForCatch": config.time_for_catch = val; break;
                    case "timeForRun": config.time_for_run = val; break;
                    case "timeForReroll": config.time_for_reroll = val; break;
                    default: console.error("unknown config set paramter", d)
                }
                break;
            }
            default:
                console.error("unknown event message: ", d)
        }
    }
    postMessage("initialized")
}

init_wasm_worker()

// helpers

/**
 * 
 * @param {Float64Array} raw 
 * @param {number} startedAt
 * @returns 
 */
function parse_quartile_data(raw, startedAt) {
    if (raw.length % 5 !== 0) {
        console.error(raw)
        throw new Error("Data from MC Rust simulation was not in set of five")
    }

    let summary = [];
    for (let i = 0; i < raw.length; i += 5) {
        let datum = {
            chainLen: startedAt + i / 5,
            q09: raw[i + 0],
            q25: raw[i + 1],
            q50: raw[i + 2],
            q75: raw[i + 3],
            q91: raw[i + 4],
        }

        summary.push(datum)
    }

    return summary
}

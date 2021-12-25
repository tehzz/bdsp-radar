importScripts("./pkg/radarweb.js")

const {run_shiny_mc_single_chain, Config} = wasm_bindgen

async function init_actor() {
    // load wasm
    await wasm_bindgen('./pkg/radarweb_bg.wasm')

    self.onmessage = evt => runSimulation(evt.data)

    self.postMessage('initialized')
}

function runSimulation(msg) {
    const {settings, target} = msg
    const config = settingsToConfig(settings)
    console.log("running for chain length", target)

    let result = run_shiny_mc_single_chain(config, target)

    self.postMessage({chainLen: target, raw: result}, [result.buffer])
}

function settingsToConfig(settings) {
    let config = new Config()
    config.chain_start = settings.chain_start
    config.chain_max = settings.chain_max
    config.sample_size = settings.sample_size
    config.total_shinies = settings.total_shinies
    config.pkmn_wildrate = settings.pkmn_wildrate * 10
    config.time_for_catch = settings.time_for_catch
    config.time_for_run = settings.time_for_run
    config.time_for_reroll = settings.time_for_reroll

    return config
}

init_actor()

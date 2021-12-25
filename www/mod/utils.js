/**
 * This class mirrors the `Config` rust struct, with the notable 
 * exception of `pkmn_wildrate`. Here, that field is in percent,
 * while in Config, it is in integer thousandths
 */
 class Settings {
    constructor() {
        this.chain_start     = 1
        this.chain_max       = 40
        this.sample_size     = 15000
        this.total_shinies   = 1
        this.pkmn_wildrate   = 10.0
        this.time_for_catch  = 50
        this.time_for_run    = 25
        this.time_for_reroll = 10
    }
}

/**
 * Keep track of simulation progress and report total time when done
 */
class StatusTimer {
    constructor(id) {
        this.id = id
        this.startTime = null
        this.stopTime = null
        this.finished = false
        this.splits = 0
        this.total = 0
    }

    start(total) {
        this.startTime = performance.now()
        this.stopTime = null
        this.finished = false
        this.splits = 0
        this.total = total
    }
    split() {
        if (this.startTime === null) {
            console.error("Timer not started when split")
            throw new Error('timer split before started')
        }
        this.splits += 1;
        if (this.splits >= this.total) {
            this.done()
        }
    }
    done() {
        this.stopTime = performance.now()
        this.finished = true
    }
    render() {
        const el = document.createElement('div')
        el.id = this.id
        if (this.finished) {
            const time = (this.stopTime - this.startTime) / 1000
            el.textContent = `Simulation completed in ${time.toFixed(2)} seconds`
        } else if (this.startTime === null) {
            el.textContext = 'Timer not started'
        } else {
            el.textContent = `Running [${this.splits} chains finished of ${this.total} total]`
            el.classList.add('spinner')
        }

        return el
    }
}


export { Settings, StatusTimer };

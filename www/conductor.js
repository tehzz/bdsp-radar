/**
 * 
 * @param {Settings} settings 
 * @param {WorkerPool} pool
 * @param {MessageEvent} evt 
 */
function listener(settings, pool, evt) {
    const d = evt.data

    switch (d.cmd) {
        case "GET": {
            let val;
            switch (d.param) {
                case "chainStart"   : val = settings.chain_start;     break;
                case "chainMax"     : val = settings.chain_max;       break;
                case "sampleSize"   : val = settings.sample_size;     break;
                case "totalShinies" : val = settings.total_shinies;   break;
                case "pkmnWildrate" : val = settings.pkmn_wildrate;   break;
                case "timeForCatch" : val = settings.time_for_catch;  break;
                case "timeForRun"   : val = settings.time_for_run;    break;
                case "timeForReroll": val = settings.time_for_reroll; break;
                default: val = null;
            }

            postMessage({kind: "GET_CONFIG", id: d.param, val: val})
            break;
        }
        case "SET": {
            const val = d.val;

            switch (d.param) {
                case "chainStart"   : settings.chain_start = val;     break;
                case "chainMax"     : settings.chain_max = val;       break;
                case "sampleSize"   : settings.sample_size = val;     break;
                case "totalShinies" : settings.total_shinies = val;   break;
                case "pkmnWildrate" : settings.pkmn_wildrate = val;   break;
                case "timeForCatch" : settings.time_for_catch = val;  break;
                case "timeForRun"   : settings.time_for_run = val;    break;
                case "timeForReroll": settings.time_for_reroll = val; break;
                default: console.error("unknown config set paramter", d)
            }
            break;
        }
        case "RUN": {
            console.log('starting run with worker pool', settings)
            for (let i = settings.chain_start; i <= settings.chain_max; i++) {
                let msg = {settings, target: i}
                pool.queueJob(msg, finalizeAndReturnData, this)
            }
            break;
        }
        default:
            console.error("unknown event message: ", d)
    }
}

function finalizeAndReturnData(data) {
    const {raw, chainLen} = data
    const datum = {
        chainLen,
        q09: raw[0],
        q25: raw[1],
        q50: raw[2],
        q75: raw[3],
        q91: raw[4],
    }

    postMessage({kind: "FINISHED_CHAIN", data: datum})
}

/**
 * This class mirrors the `Config` rust struct
 * Unfortunately, the WASM Config object seems to lack a 
 * clone or copy routine, so it ends up being easier to create
 * a new Config from Settings as needed
 */
class Settings {
    constructor() {
        this.chain_start     = 1
        this.chain_max       = 40
        this.sample_size     = 5000
        this.total_shinies   = 1
        this.pkmn_wildrate   = 100
        this.time_for_catch  = 50
        this.time_for_run    = 25
        this.time_for_reroll = 10
    }
}

const WorkerStatus = {
    INIT: 0,
    READY: 1,
    RUNNING: 2,
}

class WorkerPool {
    constructor(url) {
        this.workers = []
        this.jobs = []

        const threads = Math.max(getThreadCount(), 1)

        for (let i = 0; i < threads; i++) {
            let worker = new Worker(url)
            worker.onmessage = evt => {
                this.workers[i].status = WorkerStatus.READY
                if (this.jobs.length) {
                    this.nextJob()
                }
            }

            this.workers.push({
                w: worker,
                status: WorkerStatus.INIT,
            })
        }
    }

    queueJob(msg, cb, ctx) {
        const job = {msg, cb, ctx}
        this.jobs.push(job)
        this.nextJob()
    }

    nextJob() {
        if (this.jobs.length) {
            for (const wkr of this.workers) {
                if (wkr.status === WorkerStatus.READY) {
                    const job = this.jobs.shift()
                    wkr.w.onmessage = e => {
                        wkr.status = WorkerStatus.READY

                        job.cb.call(job.ctx, e.data)
                        this.nextJob()
                    }

                    wkr.status = WorkerStatus.RUNNING
                    wkr.w.postMessage(job.msg)
                    break;
                }
            }
        }
    }
}

function getThreadCount() {
    const reported = navigator.hardwareConcurrency

    if (reported === undefined) {
        // probably safari on macos or safari on iOS?
        // apple reports 8 for macOS, and 2 for iOS
        const isSafari = navigator.vendor && 
            navigator.vendor.indexOf('Apple') > -1 &&
            navigator.userAgent &&
            navigator.userAgent.indexOf('CriOS') === -1 &&
            navigator.userAgent.indexOf('FxiOS') === -1
            
        const isIOS = [
            'iPad Simulator',
            'iPhone Simulator',
            'iPod Simulator',
            'iPad',
            'iPhone',
            'iPod'
          ].includes(navigator.platform)

        let guess = isSafari && isIOS ? 2 : isSafari ? 8 : 2;
        return guess - 1
    } else {
        return reported - 1
    }
    

}
// --------------------------------------------------------

function init_conductor() {
    // load Settings, start worker pool, and attach listeners
    let settings = new Settings()
    let pool = new WorkerPool('./actor.js')
    
    self.onmessage = evt => listener(settings, pool, evt)

    postMessage("initialized")
}
// start worker 
init_conductor()

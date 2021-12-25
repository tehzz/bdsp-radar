// ---------- classes and types ----------
class StatusTimer {
    constructor() {
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
        el.id = ELEMENTS.timer
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

/**
 * The returned data from a simulation
 * @typedef {Object} SimulationData
 * @property {number} chainLen - the target length of radar chain
 * @property {number} q09 - the 9th quantitle
 * @property {number} q25 - the 25th quantitle (Q1)
 * @property {number} q50 - the 50th quantitle (median / Q2)
 * @property {number} q75 - the 75th quantitle (Q3)
 * @property {number} q91 - the 91st quantitle
 */


// ---------- global values ----------
const valChecker = { 
    // store as a integer in 1000ths, turn to a percent (100ths)
    "pkmnWildrate": {
        get: (val) => val / 10,
        set: (val) => val * 10,
    }
}

const TIMER = new StatusTimer()

const ELEMENTS = {
    loader: "spinner",
    plot: "boxPlot",
    results: "results",
    resTable: "radarDataTable",
    timer: "statusTimer"
}

/** @type {?SimulationData[]} */
let SAVED_DATA = null;

const TimeUnits = {
    "min": {
        factor: 60,
        short: "min",
        long: "minutes"
    },
    "hr": {
        factor: 60 * 60,
        short: "hr",
        long: "hours"
    },
    "days": {
        factor: 60 * 60 * 24,
        short: "days",
        long: "days"
    },
}
let REPORTING_UNIT = TimeUnits["min"]

// ---------- actual main function ----------
if (window.Worker) {
    const radarWorker = new Worker("./conductor.js")
    radarWorker.onmessage = (e) => {
        radarWorker.onmessage = workerReceiver;
        initializeParameters(radarWorker);
    }
} else {
    console.error("Workers not supported in your browser")
}

// ---------- callback and receiver routines ----------
/**
 * The main receiver for getting data back from the simulation
 * @param {MessageEvent} evt - from the main orchestrator worker
 */
function workerReceiver(evt) {
    const d = evt.data;

    switch (d.kind) {
        case "GET_CONFIG":
        {
            if (d.val === null) { 
                console.error("received empty get value from config", d)
            }
            const val = valChecker[d.id] === undefined ? 
                d.val : 
                valChecker[d.id].get(d.val);

            document.getElementById(d.id).value = val;
            break;
        }
        case "FINISHED_CHAIN":
        {
            const resEl = document.getElementById(ELEMENTS['results'])
            let res = d.data
            console.log("new data for len " + res.chainLen)
            TIMER.split()

            if (SAVED_DATA === null) {
                // first result of chain
                SAVED_DATA = []
                SAVED_DATA[res.chainLen] = res
                
                const radio = createUnitRadio();
                resEl.appendChild(radio)

                plotData(SAVED_DATA, resEl)

                let tbl = createTable(SAVED_DATA);
                resEl.appendChild(tbl)
                Sortable.initTable(tbl)
            } else {
                SAVED_DATA[res.chainLen] = res
                updateResultsInfo(SAVED_DATA)
            }
            
            document.getElementById(ELEMENTS.timer).replaceWith(TIMER.render())
            break;
        }
        default:
            console.error("Unsupported data from worker", d);
    }
}

/**
 * Initialize the HTML form inputs with the current settings for the simulation,
 * then attach event listener for updating the values and starting a run of the simulation
 * @param {Worker} worker 
 */
function initializeParameters(worker) {
    const params = [
        "chainStart", 
        "chainMax", 
        "sampleSize", 
        "totalShinies", 
        "pkmnWildrate", 
        "timeForCatch", 
        "timeForRun",
        "timeForReroll"
    ]

    for (const param of params) {
        worker.postMessage({cmd: "GET", param})
        document
            .getElementById(param)
            .addEventListener("change", evt => setParamter(worker, evt))
    }

    document
        .getElementById("mcParameters")
        .addEventListener("submit", e => startWorker(worker, e))
}

/**
 * Set the changed simulation parameter in `worker`
 * @param {Worker} worker 
 * @param {Event} evt 
 */
function setParamter(worker, evt) {
    let param = evt.target.id;
    let val = evt.target.value;
    
    if (valChecker[param] !== undefined) {
        val = valChecker[param].set(val)
    }

    worker.postMessage({cmd:"SET", param, val})
}

/**
 * Start the simulation, clear the old data and results, and add the progress timer
 * @param {Worker} worker 
 * @param {Event} evt 
 */
function startWorker(worker, evt) {
    evt.preventDefault()

    const formdata = new FormData(evt.target)
    TIMER.start(formdata.get('chainMax') - formdata.get('chainStart') + 1)

    const resdiv = document.getElementById(ELEMENTS.results)
    while(resdiv.firstChild && resdiv.removeChild(resdiv.firstChild));
    resdiv.appendChild(TIMER.render())
        
    SAVED_DATA = null;
    worker.postMessage({cmd: "RUN"})
}

// ---------- helper routines ----------

/**
 * Create a new graph element with Plotly
 * @param {SimulationData[]} data - quantitle data in seconds
 * @param {HTMLElement} el 
 */
function plotData(data, el) {
    let plot = document.createElement("div");
    plot.id = ELEMENTS.plot
    
    let layout = getPlotLayout(true)
    let config = getPlotConfig()
    let toPlot = getPlotData(data)

    Plotly.newPlot(plot, [toPlot], layout, config)
    el.appendChild(plot)
    window.dispatchEvent(new Event('resize'))
}

/**
 * Update an existing Plotly graph
 * @param {SimulationData[]} data - quantitle data in seconds
 * @param {HTMLElement} plotEl 
 */
function updatePlot(data, plotEl) {
    let layout = getPlotLayout()
    let config = getPlotConfig()
    let toPlot = getPlotData(data)

    Plotly.react(plotEl, [toPlot], layout, config)
}

/**
 * get the layout object for Plotly
 * @param {boolean} newPlot 
 * @returns 
 */
function getPlotLayout(newPlot = false) {
    return {
        title: `Chain Length vs. Time to Find Shiny (${REPORTING_UNIT.short})`,
        yaxis: {
            title: {text: REPORTING_UNIT.long},
            type: "linear",
        },
        xaxis: {
            title: {text: "Target Chain Length"}
        },
        autosize: newPlot
    };
}

/**
 * get the config object for Plotly
 * @returns 
 */
function getPlotConfig() {
    return {
        responsive: true,
    }
}

/**
 * Format the simulation data into the form the Plotly expects for 
 * box plots
 * @param {SimulationData[]} raw - data array (possibly with holes)
 * @returns 
 */
function getPlotData(raw) {
    let res = {
        x: [],
        lowerfence: [],
        q1: [],
        median: [],
        q3: [],
        upperfence: [],
        type: "box",
        name: "radar chain stats",
    }
    const factor = REPORTING_UNIT.factor
    for (let chain of raw) {
        if (chain !== undefined) {
            res.x.push(chain.chainLen)
            res.lowerfence.push(roundNum(chain.q09 / factor))
            res.q1.push(roundNum(chain.q25 / factor))
            res.median.push(roundNum(chain.q50 / factor))
            res.q3.push(roundNum(chain.q75 / factor))
            res.upperfence.push(roundNum(chain.q91 / factor))
        }
    }

    return res
}

/**
 * Round a floating point number to two decimals
 * @param {number} n 
 * @returns {number}
 */
function roundNum(n) {
    return +(Math.round(n + "e+2") + "e-2")
}

/**
 * Just like `getPlotData`, the data input array will be sparse
 * until all of the results stream from the worker threads
 * @param {SimulationData[]} data 
 * @returns HTMLTableElement
 */
function createTable(data) {
    const hdrs = ['Chain Length', 'Median', 'IQR', 'Q9', 'Q25', 'Q75', 'Q91']
    
    const tbl = document.createElement('table')
    const thead = document.createElement('thead')
    const headtr = document.createElement('tr')
    for (let hdr of hdrs) {
        const th = document.createElement('th')
        th.textContent = hdr
        headtr.appendChild(th)
    }
    thead.appendChild(headtr)
    tbl.appendChild(thead)

    const tbody = document.createElement('tbody')
    const factor = REPORTING_UNIT.factor
    for (let datum of data) {
        if (datum !== undefined) {
            let tr = document.createElement('tr')
            tr.appendChild(makeDataCell(datum.chainLen, false))
            tr.appendChild(makeDataCell(datum.q50 / factor))
            tr.appendChild(makeDataCell((datum.q75 - datum.q25) / factor))
            tr.appendChild(makeDataCell(datum.q09 / factor))
            tr.appendChild(makeDataCell(datum.q25 / factor))
            tr.appendChild(makeDataCell(datum.q75 / factor))
            tr.appendChild(makeDataCell(datum.q91 / factor))
    
            tbody.appendChild(tr)
        }
    }
    tbl.appendChild(tbody)
    tbl.setAttribute("data-sortable", "")
    tbl.classList.add("sortable-theme-light")
    tbl.id = ELEMENTS.resTable

    return tbl
}

/**
 * 
 * @param {number} x 
 * @returns HTMLTableCellElement
 */
function makeDataCell(x, fixed = true) {
    const td = document.createElement('td')
    if (fixed) {
        td.textContent = x.toFixed(2)
    } else {
        td.textContent = x
    }

    return td
}

// routines to make the unit selector
function createUnitRadio() {
    const f = document.createElement('form')
    f.id = "unitSelector"
    for (const [unit, info] of Object.entries(TimeUnits)) {
        let radio = makeRadioButton(
            "unit", 
            info.long, 
            "unit" + unit, 
            unit, 
            info.short === REPORTING_UNIT.short
        );
        f.appendChild(radio)
    }
    f.addEventListener('submit', e => e.preventDefault())
    f.addEventListener('change', updateTimeUnit)

    return f
}

function makeRadioButton(name, label, id, value, checked = false) {
    const c = document.createElement('div')
    const i = document.createElement('input')
    i.type = "radio"
    i.id = id
    i.name = name
    i.value = value
    i.checked = checked

    const l = document.createElement('label')
    l.textContent = label
    l.htmlFor = id

    c.appendChild(i)
    c.appendChild(l)
    return c
}

function updateTimeUnit(evt) {
    const unit = evt.srcElement.value
    const info = TimeUnits[unit]

    if (info === undefined) {
        console.error("unknown unit", unit)
    } else {
        console.log("updating unit to", unit)
        REPORTING_UNIT = info
        updateResultsInfo(SAVED_DATA)
    }
}

function updateResultsInfo(data) {
    updatePlot(data, document.getElementById(ELEMENTS.plot))
    const tbl = createTable(data)
    document.getElementById(ELEMENTS.resTable).replaceWith(tbl)
    Sortable.initTable(tbl)
}

import { Settings, StatusTimer } from './mod/utils.js'
import { WorkerPool } from './mod/pool.js'

// ---------- types ----------
/**
 * The important data from a simulation
 * @typedef {Object} SimulationData
 * @property {number} chainLen - the target length of radar chain
 * @property {number} q09 - the 9th quantitle
 * @property {number} q25 - the 25th quantitle (Q1)
 * @property {number} q50 - the 50th quantitle (median / Q2)
 * @property {number} q75 - the 75th quantitle (Q3)
 * @property {number} q91 - the 91st quantitle
 */

/**
 * The raw data from a simulation
 * @typedef {Object} RawSimData
 * @property {number} chainLen
 * @property {Float64Array} raw - [f64; 5]
 */

// ---------- global values ----------
/** HTML element IDs */
const ELEMENTS = {
    params: "mcParameters",
    paramFields: "mcParaFields",
    loader: "spinner",
    plot: "boxPlot",
    results: "results",
    resTable: "radarDataTable",
    timer: "statusTimer"
}

/** Key to convert input element id to field in Settings/Config struct */
const InputToSet = {
    'chainStart': 'chain_start',
    'chainMax': 'chain_max',
    'sampleSize': 'sample_size',
    'totalShinies': 'total_shinies',
    'pkmnWildrate': 'pkmn_wildrate',
    'timeForCatch': 'time_for_catch',
    'timeForRun': 'time_for_run',
    'timeForReroll': 'time_for_reroll',
}

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

/** @type {?SimulationData[]} */
let SAVED_DATA = null;
const TIMER = new StatusTimer(ELEMENTS.timer)

// ---------- actual main function ----------
function main() {
    if (!window.Worker) {
        console.error("Workers not supported")
        throw new Error("Need web workers")
    }

    const pool = new WorkerPool('./actor.js')
    initializeParameters(pool)
}

main()

// ---------- setup, callback, and receiver routines ----------

/**
 * Initialize the HTML input elements to default values,
 * and attach a submit listener to the HTML form
 * @param {WorkerPool} pool 
 */
function initializeParameters(pool) {
    const defaultSettings = new Settings()

    for (const [id, key] of Object.entries(InputToSet)) {
        document.getElementById(id).value = defaultSettings[key]
    }

    document
        .getElementById(ELEMENTS.params)
        .addEventListener("submit", e => runSimulation(pool, e))
}

/**
 * The function invoked on parameters form submit to start running 
 * the radar simulation in the worker pool
 * @param {WorkerPool} pool 
 * @param {Event} evt
 */
function runSimulation(pool, evt) {
    evt.preventDefault()

    const formdata = new FormData(evt.target)
    const settings = formToSettings(formdata)

    disableParameterEntry()

    TIMER.start(settings.chain_max - settings.chain_start + 1)

    const resdiv = document.getElementById(ELEMENTS.results)
    while(resdiv.firstChild && resdiv.removeChild(resdiv.firstChild));
    resdiv.appendChild(TIMER.render())
        
    SAVED_DATA = null;
    for (let i = settings.chain_start; i <= settings.chain_max; i++) {
        let msg = {settings, target: i}
        pool.queueJob(msg, saveRunData, this)
    }
}

/**
 * @param {FormData} formData 
 * @returns {Settings}
 */
 function formToSettings(formData) {
    let settings = new Settings()
    for (const [id, key] of Object.entries(InputToSet)) {
        settings[key] = formData.get(id)
    }

    return settings
}

/**
 * The callback function that is invoked when a Web Worker actor finished a run
 * and reports back the raw length and [f64] data
 * This saves the data and either draws or updates the results HTML elements
 * @param {RawSimData} rawData 
 */
function saveRunData(rawData) {
    const resEl = document.getElementById(ELEMENTS['results'])
    const res = rawToLabeled(rawData)

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

    if (TIMER.isFinished()) {
        enableParameterEntry()
    }
}

/**
 * @param {RawSimData} rawData 
 * @returns {SimulationData}
 */
function rawToLabeled(rawData) {
    const {raw, chainLen} = rawData
    return {
        chainLen,
        q09: raw[0],
        q25: raw[1],
        q50: raw[2],
        q75: raw[3],
        q91: raw[4],
    }
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

/**
 * Event listener for a change in the Unit form
 * @param {Event} evt 
 */
function updateTimeUnit(evt) {
    const unit = evt.target.value
    const info = TimeUnits[unit]

    if (info === undefined) {
        console.error("unknown unit", unit)
    } else {
        console.log("updating unit to", unit)
        REPORTING_UNIT = info
        updateResultsInfo(SAVED_DATA)
    }
}

/**
 * 
 * @param {SimulationData[]} data 
 */
function updateResultsInfo(data) {
    updatePlot(data, document.getElementById(ELEMENTS.plot))
    const tbl = createTable(data)
    document.getElementById(ELEMENTS.resTable).replaceWith(tbl)
    Sortable.initTable(tbl)
}

/** Disable the parameters field while a simulation is runnning */
function disableParameterEntry() {
    document.getElementById(ELEMENTS.paramFields).disabled = true
}

/** Enable the parameters field after a simulation has finished */
function enableParameterEntry() {
    document.getElementById(ELEMENTS.paramFields).disabled = false
}

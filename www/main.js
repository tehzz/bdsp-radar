// global values
const valChecker = { 
    // store as a integer in 1000ths, turn to a percent (100ths)
    "pkmnWildrate": {
        get: (val) => val / 10,
        set: (val) => val * 10,
    }
}

let timerStart = null;
const timer = {
    start: () => {
        timerStart = performance.now()
    },
    end: () => {
        if (timerStart === null) {
            console.error("missing timer start value")
        }
        const delta = performance.now() - timerStart
        timerStart = null
        return delta
    }
}

const ELEMENTS = {
    loader: "spinner",
    plot: "boxPlot",
    results: "results",
    resTable: "radarDataTable",
}

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

// actual main function
if (window.Worker) {
    const radarWorker = new Worker("./worker.js")
    radarWorker.onmessage = (e) => {
        radarWorker.onmessage = workerReceiver;
        initializeParameters(radarWorker);
    }
} else {
    console.error("Workers not supported in your browser")
}

// other functions (callback routines and helpers)
function workerReceiver(evt) {
    const d = evt.data;

    switch (d.kind) {
        case "GET_CONFIG":
            if (d.val === null) { 
                console.error("received empty get value from config", d)
            }
            const val = valChecker[d.id] === undefined ? 
                d.val : 
                valChecker[d.id].get(d.val);

            document.getElementById(d.id).value = val;
            break;
        case "FINISHED_RUN":
        {
            let delta = timer.end();
            console.log("finished timer:", delta);
            document.getElementById(ELEMENTS['loader']).remove()

            SAVED_DATA = d.data
            
            const resEl = document.getElementById(ELEMENTS['results'])

            const radio = createUnitRadio();
            resEl.appendChild(radio)

            plotData(d.data, resEl)

            let tbl = createTable(d.data);
            resEl.appendChild(tbl)
            Sortable.initTable(tbl)

            const timeReport = document.createElement('p')
            timeReport.textContent = `Time to run: ${delta / 1000} seconds`
            resEl.appendChild(timeReport)

            break;
        }
        default:
            console.error("Unsupported data from worker", d);
    }
}

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

function setParamter(worker, evt) {
    let param = evt.target.id;
    let val = evt.target.value;
    
    if (valChecker[param] !== undefined) {
        val = valChecker[param].set(val)
    }

    worker.postMessage({cmd:"SET", param, val})
}

function startWorker(worker, evt) {
    evt.preventDefault()
    document
        .getElementById("results")
        .innerHTML = `<div id="${ELEMENTS['loader']}" class="loader">Loading...</div>`;
        
    SAVED_DATA = null;
    timer.start()
    worker.postMessage({cmd: "RUN"})
}

function plotData(data, el) {
    let plot = document.createElement("div");
    plot.id = "boxPlot"
    //plot.style = "width:90%"
    
    let layout = getPlotLayout(true)
    let config = getPlotConfig()
    let toPlot = getPlotData(data)

    Plotly.newPlot(plot, [toPlot], layout, config)
    el.appendChild(plot)
    window.dispatchEvent(new Event('resize'))
}

function updatePlot(data, plotEl) {
    let layout = getPlotLayout()
    let config = getPlotConfig()
    let toPlot = getPlotData(data)

    Plotly.react(plotEl, [toPlot], layout, config)
}

// get the layout object for Plotly
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

// get the config object for Plotly
function getPlotConfig() {
    return {
        responsive: true,
    }
}

// format the mc chain data for Plotly box plots
function getPlotData(raw) {
    let res = {
        x0: raw[0].chainLen,
        dx: 1,
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
        res.lowerfence.push(roundNum(chain.q09 / factor))
        res.q1.push(roundNum(chain.q25 / factor))
        res.median.push(roundNum(chain.q50 / factor))
        res.q3.push(roundNum(chain.q75 / factor))
        res.upperfence.push(roundNum(chain.q91 / factor))
    }

    return res
}
/**
 * 
 * @param {number} n 
 * @returns {number}
 */
function roundNum(n) {
    return +(Math.round(n + "e+2") + "e-2")
}

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
        updatePlot(SAVED_DATA, document.getElementById(ELEMENTS.plot))
        const tbl = createTable(SAVED_DATA)
        document.getElementById(ELEMENTS.resTable).replaceWith(tbl)
        Sortable.initTable(tbl)
    }
}
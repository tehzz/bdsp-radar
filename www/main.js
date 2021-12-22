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
    loader: "spinner"
}


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
            plotData(d.data)

            let tbl = createTable(d.data);
            document.getElementById("results").appendChild(tbl)
            Sortable.initTable(tbl)
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
    
    timer.start()
    worker.postMessage({cmd: "RUN"})
}

function plotData(data) {
    let plot = document.createElement("div");
    plot.id = "boxPlot"
    plot.style = "width:90%"
    
    let layout = {
        title: 'Chain Length vs. Time to Find Shiny (min)',
        yaxis: {
            title: {text: "Minutes"},
            type: "linear",
        },
        xaxis: {
            title: {text: "Target Chain Length"}
        },
        autosize: true
    };

    let config = {
        responsive: true,
    }
    
    let toPlot = {
        x0: data[0].chainLen,
        dx: 1,
        lowerfence: [],
        q1: [],
        median: [],
        q3: [],
        upperfence: [],
        type: "box",
        name: "radar chain stats",
    }
    for (let chain of data) {
        toPlot.lowerfence.push(roundNum(chain.q02 / 60))
        toPlot.q1.push(roundNum(chain.q25 / 60))
        toPlot.median.push(roundNum(chain.q50 / 60))
        toPlot.q3.push(roundNum(chain.q75 / 60))
        toPlot.upperfence.push(roundNum(chain.q98 / 60))
    }

    Plotly.newPlot(plot, [toPlot], layout, config)
    document.getElementById("results").appendChild(plot)
    window.dispatchEvent(new Event('resize'))
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
    const hdrs = ['Chain Length', 'Median', 'IQR', 'Q2', 'Q25', 'Q75', 'Q98']
    
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
    for (let datum of data) {
        let tr = document.createElement('tr')
        tr.appendChild(makeDataCell(datum.chainLen, false))
        tr.appendChild(makeDataCell(datum.q50 / 60))
        tr.appendChild(makeDataCell((datum.q75 - datum.q25) / 60))
        tr.appendChild(makeDataCell(datum.q02 / 60))
        tr.appendChild(makeDataCell(datum.q25 / 60))
        tr.appendChild(makeDataCell(datum.q75 / 60))
        tr.appendChild(makeDataCell(datum.q98 / 60))

        tbody.appendChild(tr)
    }
    tbl.appendChild(tbody)
    tbl.setAttribute("data-sortable", "")
    tbl.classList.add("sortable-theme-light")
    tbl.id = "radarDataTable"

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
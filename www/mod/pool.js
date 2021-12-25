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
        return guess
    } else {
        return reported
    }
}

export { WorkerPool };

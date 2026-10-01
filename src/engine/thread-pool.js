/**
 * ThreadPool - Object pool for Thread objects.
 * Reduces GC pressure by reusing Thread instances instead of creating new ones.
 *
 * Threads are one of the most frequently allocated objects in the VM:
 * - Each script execution creates a new Thread
 * - Clone creation/destruction creates/destroys Threads
 * - Broadcast events can create hundreds of Threads in a single frame
 *
 * Pool strategy:
 * - Free list: reused Threads are stored in an array
 * - Max size: prevents unbounded memory growth
 * - Auto-reset: threads are fully reset before reuse
 * - Thread pools are per-Runtime instance
 */
class ThreadPool {
    /**
     * @param {number} maxSize Maximum number of threads to keep in the pool. Default 500.
     */
    constructor (maxSize) {
        /** @type {Array<Thread>} */
        this._freeList = [];

        /**
         * Maximum number of threads to keep in the free list.
         * After this, excess threads are left for GC.
         * @type {number}
         */
        this._maxSize = typeof maxSize === 'number' ? maxSize : 500;

        /**
         * Total number of threads created by this pool.
         * @type {number}
         */
        this._created = 0;

        /**
         * Total number of threads acquired from the pool.
         * @type {number}
         */
        this._acquired = 0;

        /**
         * Total number of threads returned to the pool.
         * @type {number}
         */
        this._returned = 0;
    }

    /**
     * Acquire a thread from the pool, or create a new one if none are available.
     * @param {string} firstBlock ID of the first block to execute
     * @returns {Thread} A Thread instance, either recycled or newly created
     */
    acquire (firstBlock) {
        const thread = this._freeList.pop();
        if (thread) {
            this._acquired++;
            thread.topBlock = firstBlock;
            return thread;
        }
        this._created++;
        // Dynamic import to avoid circular dependency
        const Thread = require('./thread');
        const newThread = new Thread(firstBlock);
        // Mark the thread as pool-managed so dispose knows to return it to the pool
        newThread._fromPool = true;
        return newThread;
    }

    /**
     * Return a thread to the pool for reuse.
     * The thread's internal state is fully reset.
     * @param {Thread} thread The thread to release
     */
    release (thread) {
        if (!thread._fromPool) {
            // Thread was not created by the pool, let GC handle it
            return;
        }

        // Full reset of thread state
        this._resetThread(thread);

        // Return to pool if under max size
        if (this._freeList.length < this._maxSize) {
            this._returned++;
            this._freeList.push(thread);
        }
    }

    /**
     * Reset a thread to its initial state for reuse.
     * Must clear ALL properties set by Thread constructor and during execution.
     * @param {Thread} thread The thread to reset
     * @private
     */
    _resetThread (thread) {
        // Clear execution stack - reuse arrays instead of creating new ones
        thread.stack.length = 0;
        thread.stackFrames.length = 0;

        // Reset all scalar/object fields to defaults
        thread.status = 0; // Thread.STATUS_RUNNING
        thread.isKilled = false;
        thread.inThreadList = false;
        thread.target = null;
        thread.blockContainer = null;
        thread.requestScriptGlowInFrame = false;
        thread.blockGlowInFrame = null;
        thread.warpTimer = null;
        thread.justReported = null;
        thread.triedToCompile = false;
        thread.isCompiled = false;
        thread.stackClick = false;
        thread.updateMonitor = false;
        thread.timer = null;
        thread.generator = null;
        thread.procedures = null;
        thread.executableHat = false;
        thread.compatibilityStackFrame = null;
        // Drop memoized block-container resolutions: the next user of this
        // thread may run in a different target/container, so cached owners
        // from the previous execution must not leak across reuse.
        thread.invalidateBlocksForIdCache();
        // topBlock is set by acquire()
    }

    /**
     * Get current pool statistics for debugging/monitoring.
     * @returns {{free: number, created: number, acquired: number, returned: number}}
     */
    getStats () {
        return {
            free: this._freeList.length,
            created: this._created,
            acquired: this._acquired,
            returned: this._returned
        };
    }

    /**
     * Drain the pool, releasing all cached threads.
     * Call this during project stop/restart to free memory.
     */
    drain () {
        this._freeList.length = 0;
    }
}

module.exports = ThreadPool;

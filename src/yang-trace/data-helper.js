'use strict';

let mapping = {};
const offsetTime = 1000 * 60 * 10, //
    DataHelper = module.exports = {
    // buf: Buffer.alloc(0),
    clean() {
        mapping = {};
    },

    unique(item) {
        let now = Date.now();
        Object.keys(mapping).forEach(key => {
            let time = mapping[key];
            if (time + offsetTime < now) {
                delete mapping[key];
            }
        });
        //
        if (!item) {return;}
        let key = `${item.type}-${item.action}-${item.content}`;
        if (mapping[key]) {return;}
        mapping[key] = item.time;
        return item;
    },

    split(buf, sep, options) {
        if (!Number.isInteger(sep)) {
            options = sep;
            sep = null;
        }
        sep = sep || 0x0;
        options = Object.assign({sep: 0x0, len: Number.MAX_VALUE}, options || {});
        let array = [],
            index = -1;
        while(~(index = buf.indexOf(sep)) && array.length < options.len) {
            array.push(buf.slice(0, index));
            buf = buf.slice(index + 1);
        }
        array.length < options.len && array.push(buf);
        return array;
    },

    analyse(buf) {
        let array = this.split(buf, 0xa);
        if (this.buf) {
            array[0] = Buffer.concat([this.buf, array[0]]);
        }
        this.buf = array.pop();
        return array;
    },

    roundPoint(...args) {
        let sum = args.reduce((previous, current) => previous + current) + args.length;
        return (sum + 4 - 1) & ~ (4 - 1);
    },

    factory: {
        timeSpace: 0,
        statusCode: 'K_SEED,K_RDY,K_PEND,K_SUSPENDED,K_PEND_SUSPENDED,K_SLEEP,K_SLEEP_SUSPENDED,K_DELETED'.split(','),
        // 101
        0x101(buf) {
            this.timeSpace = buf.readInt32LE(buf.length - 4);
        },

        0x102(buf) { // task_switch
            let // count = buf.readInt32LE(4); // 参数个数
                statusFrom = this.statusCode[buf.readInt32LE(8)],
                statusTo = this.statusCode[buf.readInt32LE(12)],
                tasks = DataHelper.split(buf.slice(16), {len: 2}),
                taskFrom = tasks[0].toString(),
                taskTo = tasks[1].toString(),
                timeIndex = 16 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'task',
                action: 'switch',
                time: Date.now() + time - this.timeSpace,
                content: `${taskFrom} switch to ${taskTo}`
            };
        },
        0x103(buf) { // task_create
            // no data
            let status = this.statusCode[buf.readInt32LE(8)],
                tasks = DataHelper.split(buf.slice(12), {len: 1}),
                taskName = tasks[0].toString(),
                timeIndex = 12 + DataHelper.roundPoint(tasks[0].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'task',
                action: 'create',
                time: Date.now() + time - this.timeSpace,
                content: `create ${taskName}`
            };
        },
        0x104(buf) {
            // no data
            let statusFrom = this.statusCode[buf.readInt32LE(8)],
                statusTo = this.statusCode[buf.readInt32LE(12)],
                tasks = DataHelper.split(buf.slice(16), {len: 2}),
                taskFrom = tasks[0].toString(),
                taskTo = tasks[1].toString(),
                timeIndex = 16 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'task',
                action: 'intrpt_task_switch',
                time: Date.now() + time - this.timeSpace,
                content: `interrupt ${taskFrom} switch to ${taskTo}`
            };
        },
        0x105(buf) {
            // no data
            let statusCurrent = this.statusCode[buf.readInt32LE(8)],
                statusChanged = this.statusCode[buf.readInt32LE(12)],
                tasks = DataHelper.split(buf.slice(16), {len: 2}),
                priIndex = 16 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                taskCurrent = tasks[0].toString(),
                taskChanged = tasks[1].toString(),
                pri = buf.readInt32LE(priIndex),
                timeIndex = 16 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, 4),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'task',
                action: 'pri_change',
                time: Date.now() + time - this.timeSpace,
                content: `${taskCurrent} change ${taskChanged} pri to ${pri}`
            };
        },
        0x106(buf) {
            // no data
            let statusFrom = this.statusCode[buf.readInt32LE(8)],
                statusTo = this.statusCode[buf.readInt32LE(12)],
                tasks = DataHelper.split(buf.slice(16), {len: 2}),
                taskFrom = tasks[0].toString(),
                taskTo = tasks[1].toString(),
                timeIndex = 16 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'task',
                action: 'suspend',
                time: Date.now() + time - this.timeSpace,
                content: `${taskFrom} suspend to ${taskTo}`
            };
        },
        0x107(buf) {
            // no data
            let statusFrom = this.statusCode[buf.readInt32LE(8)],
                statusTo = this.statusCode[buf.readInt32LE(12)],
                tasks = DataHelper.split(buf.slice(16), {len: 2}),
                taskFrom = tasks[0].toString(),
                taskTo = tasks[1].toString(),
                timeIndex = 16 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'task',
                action: 'resume',
                time: Date.now() + time - this.timeSpace,
                content: `${taskFrom} resume ${taskTo}`
            };
        },
        0x108(buf) {
            // no data
            let statusFrom = this.statusCode[buf.readInt32LE(8)],
                statusTo = this.statusCode[buf.readInt32LE(12)],
                tasks = DataHelper.split(buf.slice(16), {len: 2}),
                taskFrom = tasks[0].toString(),
                taskTo = tasks[1].toString(),
                timeIndex = 16 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'task',
                action: 'del',
                time: Date.now() + time - this.timeSpace,
                content: `${taskFrom} delete ${taskTo}`
            };
        },
        0x109(buf) {
            // no data
            let statusFrom = this.statusCode[buf.readInt32LE(8)],
                statusTo = this.statusCode[buf.readInt32LE(12)],
                tasks = DataHelper.split(buf.slice(16), {len: 2}),
                taskFrom = tasks[0].toString(),
                taskTo = tasks[1].toString(),
                timeIndex = 16 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'task',
                action: 'wait_abort',
                time: Date.now() + time - this.timeSpace,
                content: `${taskFrom} abort ${taskTo}`
            };
        },
        0x10a(buf) {
            // no data
            let status = this.statusCode[buf.readInt32LE(8)],
                tasks = DataHelper.split(buf.slice(12), {len: 1}),
                index = 12 + DataHelper.roundPoint(tasks[0].length),
                taskName = tasks[0].toString(),
                ticks = buf.readInt32LE(index),
                timeIndex = 12 + DataHelper.roundPoint(tasks[0].length, 4),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'task',
                action: 'sleep',
                time: Date.now() + time - this.timeSpace,
                content: `task name is ${taskName} sleep ${ticks} ticks`
            };
        },
        // // 201
        0x201(buf) {
            let status = this.statusCode[buf.readInt32LE(8)],
                tasks = DataHelper.split(buf.slice(12), {len: 2}),
                taskName = tasks[0].toString(),
                semName = tasks[1].toString(),
                timeIndex = 12 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'sem',
                action: 'create',
                time: Date.now() + time - this.timeSpace,
                sem: semName,
                content: `${taskName} create sem ${semName}`
            };
        },
        0x202(buf) {
            // no data
            let status = this.statusCode[buf.readInt32LE(8)],
                tasks = DataHelper.split(buf.slice(12), {len: 2}),
                taskName = tasks[0].toString(),
                semName = tasks[1].toString(),
                timeIndex = 12 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'sem',
                action: 'overflow',
                time: Date.now() + time - this.timeSpace,
                sem: semName,
                content: `${taskName} exec sem ${semName}`
            };
        },
        0x203(buf) {
            // error data
            // warning
            // console.log(buf);
            let status = this.statusCode[buf.readInt32LE(8)],
                tasks = DataHelper.split(buf.slice(12), {len: 2}),
                taskName = tasks[0].toString(),
                semName = tasks[1].toString(),
                timeIndex = 12 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'sem',
                action: 'cnt_increase',
                time: Date.now() + time - this.timeSpace,
                sem: semName,
                content: `${taskName} sem ${semName} increase count`
            };
        },
        0x204(buf) {
            let status = this.statusCode[buf.readInt32LE(8)],
                tasks = DataHelper.split(buf.slice(12), {len: 2}),
                taskName = tasks[0].toString(),
                semName = tasks[1].toString(),
                timeIndex = 12 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'sem',
                action: 'get_success',
                time: Date.now() + time - this.timeSpace,
                sem: semName,
                content: `${taskName} get sem ${semName}`
            };
        },
        0x205(buf) {
            // TODO
            // waitOption have some problem
            let status = this.statusCode[buf.readInt32LE(8)],
                tasks = DataHelper.split(buf.slice(12), {len: 2}),
                index = 12 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                taskName = tasks[0].toString(),
                semName = tasks[1].toString(),
                waitOption = buf.length - index < 4 ? false : buf.readInt32LE(index),
                timeIndex = null, time = this.timeSpace;
            if (waitOption) {
                timeIndex = 12 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, 4),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            }
            //
            return {
                type: 'sem',
                action: 'get_blk',
                time: Date.now() + time - this.timeSpace,
                sem: semName,
                content: `${taskName} wait sem ${semName} ${waitOption} ticks`
            };
        },
        0x206(buf) {
            let statusSem = this.statusCode[buf.readInt32LE(8)],
                statusWake = this.statusCode[buf.readInt32LE(12)],
                tasks = DataHelper.split(buf.slice(16), {len: 3}),
                index = 16 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, tasks[2].length),
                taskWakeSem = tasks[0].toString(),
                taskWake = tasks[1].toString(),
                taskSem = tasks[2].toString(),
                wakeAll = buf.readInt32LE(index),
                timeIndex = 16 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, tasks[2].length, 4),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'sem',
                action: 'task_wake',
                time: Date.now() + time - this.timeSpace,
                sem: taskSem,
                content: `${taskWakeSem} wake ${taskWake} by sem ${taskSem}`
            };
        },
        0x207(buf) {
            let status = this.statusCode[buf.readInt32LE(8)],
                tasks = DataHelper.split(buf.slice(12), {len: 2}),
                taskName = tasks[0].toString(),
                semName = tasks[1].toString(),
                timeIndex = 12 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'sem',
                action: 'del',
                time: Date.now() + time - this.timeSpace,
                sem: semName,
                content: `${taskName} delete sem ${semName}`
            };
        },
        // // 301
        0x301(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                oTask = tasks[0].toString(),
                mTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'mutex',
                action: 'create',
                time: Date.now() + time - this.timeSpace,
                content: `${oTask} create mutex ${mTask}`
            };
        },
        0x302(buf) {
            let tasks = this.statusCode[buf.readInt32LE(8)],
                index = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                oTask = tasks[0].toString(),
                mTask = tasks[1].toString(),
                pri = buf.readInt32LE(index),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, 4),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'mutex',
                action: 'release',
                time: Date.now() + time - this.timeSpace,
                content: `${oTask} release mutex ${mTask}`
            };
        },
        0x303(buf) {
            // TODO
            // waitOption have some problem
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                index = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                oTask = tasks[0].toString(),
                mTask = tasks[1].toString(),
                waitOption = buf.length - index < 4 ? false : buf.readInt32LE(index),
                timeIndex = null, time = this.timeSpace;
            //
            if (waitOption) {
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, 4),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            }
            //
            return {
                type: 'mutex',
                action: 'get',
                time: Date.now() + time - this.timeSpace,
                content: `${oTask} get mutex ${mTask} wait ${waitOption}`
            };
        },
        0x304(buf) {
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                oTask = tasks[0].toString(),
                mTask = tasks[1].toString(),
                timeIndex = DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'mutex',
                action: 'task_pri_inv',
                time: Date.now() + time - this.timeSpace,
                content: `${oTask} pri inv mutex ${mTask}`
            };
            // console.log(`task ${array[0]} pri inv mutex ${array[1]}`);
        },
        0x305(buf) {
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                index = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                oTask = tasks[0].toString(),
                mTask = tasks[1].toString(),
                waitOption = buf.readInt32LE(index),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, 4),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'mutex',
                action: 'get_blk',
                time: Date.now() + time - this.timeSpace,
                content: `${oTask} get mutex ${mTask} wait ${waitOption}`
            };
        },
        0x306(buf) {
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                oTask = tasks[0].toString(),
                mTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'mutex',
                action: 'release_success',
                time: Date.now() + time - this.timeSpace,
                content: `${oTask} release mutex ${mTask}`
            };
            // console.log(`task ${array[0]} release mutex ${array[1]}`);
        },
        0x307(buf) {
            let tasks = DataHelper.split(buf.slice(8), {len: 3}),
                oTask = tasks[0].toString(),
                wTask = tasks[1].toString(),
                mTask = tasks[2].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, tasks[2].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'mutex',
                action: 'task_wake',
                time: Date.now() + time - this.timeSpace,
                content: `${oTask} wate ${wTask} by mutex ${mTask}`
            };
            // console.log(`task ${array[0]} wake ${array[1]} by mutex ${array[2]}`);
        },
        0x308(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                oTask = tasks[0].toString(),
                mTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'mutex',
                action: 'del',
                time: Date.now() + time - this.timeSpace,
                content: `${oTask} delete mutex ${mTask}`
            };
            // console.log(`task ${array[0]} delete mutex ${array[1]}`);
        },
        // // 401
        0x401(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                index = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                cTask = tasks[0].toString(),
                eTask = tasks[1].toString(),
                flags = buf.readInt32LE(index),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, flagsBuf.length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'event',
                action: 'create',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} create event ${eTask} flags_init ${flags}`
            };
        },
        0x402(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                cTask = tasks[0].toString(),
                eTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'event',
                action: 'get',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} get event ${eTask} success`
            };
        },
        0x403(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                index = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                cTask = tasks[0].toString(),
                eTask = tasks[1].toString(),
                waitOption = buf.readInt32LE(index),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, waitBuf.length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'event',
                action: 'get_blk',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} wait event ${eTask} ${waitOption} ticks`
            };
        },
        0x404(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 3}),
                cTask = tasks[0].toString(),
                wTask = tasks[1].toString(),
                eTask = tasks[2].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, tasks[2].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'event',
                action: 'task_wake',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} wake ${wTask} by event ${eTask}`
            };
        },
        0x405(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                cTask = tasks[0].toString(),
                eTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'event',
                action: 'del',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} delete event ${eTask}`
            };
        },
        // // 501
        0x501(buf) {
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                taskName = tasks[0].toString(),
                eventName = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'bufQueue',
                action: 'create',
                time: Date.now() + time - this.timeSpace,
                content: `${taskName} create event ${eventName}`
            };
        },
        0x502(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                index = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                cTask = tasks[0].toString(),
                bTask = tasks[1].toString(),
                msgSize = buf.readInt32LE(index),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, msgSizeBuf.length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'bufQueue',
                action: 'max',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} get mutex ${bTask} wait ${msgSize} ticks`
            };
        },
        0x503(buf) {
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                index = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                cTask = tasks[0].toString(),
                bTask = tasks[1].toString(),
                msgSize = buf.readInt32LE(index),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, 4),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'bufQueue',
                action: 'post',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} post msg to buf_queue ${bTask} size ${msgSize}`
            };
        },
        0x504(buf) {
            let tasks = DataHelper.split(buf.slice(8), {len: 3}),
                taskName = tasks[0].toString(),
                wakeName = tasks[1].toString(),
                eventName = tasks[2].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, tasks[2].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'bufQueue',
                action: 'task_wake',
                time: Date.now() + time - this.timeSpace,
                content: `${taskName} wake ${wakeName} by event ${eventName}`
            };
        },
        0x505(buf) {
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                index = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                taskName = tasks[0].toString(),
                bufQueue = tasks[1].toString(),
                waitOption = buf.length - index < 4 ? false : buf.readInt32LE(index),
                timeIndex = null, time = this.timeSpace;
            //
            if (waitOption) {
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length, 4),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            }
            //
            return {
                type: 'bufQueue',
                action: 'get_blk',
                time: Date.now() + time - this.timeSpace,
                content: `${taskName} get buf_queue ${bufQueue} wait ${waitOption} ticks`
            };
        },
        // // 601
        0x601(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                cTask = tasks[0].toString(),
                tTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'timer',
                action: 'create',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} create timer ${tTask}`
            };
        },
        0x602(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                cTask = tasks[0].toString(),
                tTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'timer',
                action: 'del',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} delete timer ${tTask}`
            };
        },
        // // etc
        0x701(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                cTask = tasks[0].toString(),
                pTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'mem',
                action: 'mblk_pool_create',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} create timer ${pTask}`
            };
        },
        0x801(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                cTask = tasks[0].toString(),
                pTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'mem',
                action: 'pool_create',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} create mm pool ${pTask}`
            };
        },
        0x901(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                cTask = tasks[0].toString(),
                rTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'mem',
                action: 'region_create',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} create mm region ${rTask}`
            };
        },
        0xa01(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                cTask = tasks[0].toString(),
                wTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'workQueue',
                action: 'init',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} create work ${wTask}`
            };
        },
        0xa02(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                cTask = tasks[0].toString(),
                wTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'workQueue',
                action: 'create',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} create workqueue ${wTask}`
            };
        },
        0xa03(buf) {
            // no data
            let tasks = DataHelper.split(buf.slice(8), {len: 2}),
                cTask = tasks[0].toString(),
                wTask = tasks[1].toString(),
                timeIndex = 8 + DataHelper.roundPoint(tasks[0].length, tasks[1].length),
                time = buf.length - timeIndex < 4 ? this.timeSpace : buf.readInt32LE(timeIndex);
            //
            return {
                type: 'workQueue',
                action: 'del',
                time: Date.now() + time - this.timeSpace,
                content: `${cTask} delete workqueue ${wTask}`
            };
        }
    }
};

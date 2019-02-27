const offsetTime = 1000 * 60 * 60,// * 24 * 365,
    color = ['#ff9797', '#FFC78E', '#FFFF93', '#CCFF80', '#84C1FF', '#A6A6D2', '#C07AB8'];
//
let dataSource = {},
    utility = {
        count: 0,
        getVisItem(item) {
            return {
                id: this.count++,
                content: item.content,
                editable: false,
                start: item.time,
                end: item.time + offsetTime,
                group: item.sem || item.type,
                style: `background-color: ${this.randomColor()}`
            }
        },
        randomColor() {
            let index = Math.floor(Math.random() * color.length);
            return color[index];
        }
    };

module.exports = {
    groups: [
        {id: 'task', content: 'task'},
        {id: 'sem', content: 'semaphore'},
        {id: 'mutex', content: 'mutex'},
        {id: 'event', content: 'event'},
        {id: 'bufQueue', content: 'buffer queue'},
        {id: 'timer', content: 'timer'},
        {id: 'mem', content: 'memory'},
        {id: 'workQueue', content: 'work queue'}
    ],
    //
    clean() {
        dataSource = {};
    },

    push(datas, prop) {
        datas.forEach(item => {
            let array = dataSource[item[prop || 'type']] || (dataSource[item[prop || 'type']] = []);
            if (!array) {return console.warn('Can not fint key:', item.type);}
            let last = array[array.length - 1];
            last && (last.end = item.time);
            let visItem = utility.getVisItem(item);
            visItem.content && array.push(visItem);
        });
    },

    recycle() {
        let now = Date.now(),
            distance = 1000 * 60 * 10;
        //
        Object.values(dataSource).forEach(array => {
            if (array.length < 2) {return;}
            let len = array.length - 1;
            for(let i = len; i >= 0; i--) {
                if (array[i].end + distance > now) {continue;}
                array.splice(0, i + 1);
                break;
            }
        });
    },

    getData() {
        return dataSource;
    }
};

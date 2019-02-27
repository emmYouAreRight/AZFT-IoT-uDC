const Vue = require('vue/dist/vue.common');
const io = require('socket.io-client');
let socket;
const app = new Vue({
    el: '#image-footprint',
    data: {
        imageFootprints: [],
        selectedReport: 0
    },
    created: function() {
        const _this = this;
        //console.log(`${location.host}/imagefootprint/reports`);
        this.refresh();
        socket && socket.close && socket.close();
        socket = io("/imagefootprint");
        socket.on("imageFootprint", imageFootprint => {
            //console.log('coming', imageFootprint);
            imageFootprint.forEach(data2 => {
                data2.forEach(report => {
                    report.push(["Total", report.reduce((prev, curr) => prev + curr[1], 0),report.reduce((prev, curr) => prev + curr[2], 0)]);
                });
            });
            this.imageFootprints = imageFootprint;
        });
    },
    methods: {
        refresh: function() {
            $.get(`http://${location.host}/imagefootprint/reports`, {}, data => {
                //console.log(data);
                data.forEach(data2 => {
                    data2.forEach(report => {
                        report.push(["Total", report.reduce((prev, curr) => prev + curr[1], 0),report.reduce((prev, curr) => prev + curr[2], 0)]);
                    });
                });
                this.imageFootprints = data;
            }, "json");
        }
    },
    computed: {
        currentReport: function() {
            return this.imageFootprints.length > 0 ? this.imageFootprints[0] : [];
        },
        prevReport: function() {
            return this.imageFootprints.length > 1 ? this.imageFootprints[1] : [];
        },
        fullReport: function() {
            let ret = [];
            if (this.currentReport.length != this.prevReport.length) {
                for (let i = 0; i < this.currentReport.length; i++) {
                    currentReport = this.currentReport[i];
                    ret.push(currentReport.map(report => {
                        return [report[0], {
                            curr: report[1],
                            delta: 0
                        }, {
                            curr: report[2],
                            delta: 0
                        }]
                    }));
                }
            } else  {
                for (let i = 0; i < this.currentReport.length; i++) {
                    currentReport = this.currentReport[i];
                    prevReport = this.prevReport[i];
                    ret.push(currentReport.map(report => {
                        let prev = prevReport.filter(report2 => report2[0] === report[0]);
                        if (prev && prev[0]) {
                            return [report[0], {
                                curr: report[1],
                                delta: prev[0][1] == 0 ? report[1] == 0 ? 0 : Infinity : ((report[1] - prev[0][1])/prev[0][1]*100).toFixed(2)
                            }, {
                                curr: report[2],
                                delta: prev[0][2] == 0 ? report[2] == 0 ? 0 : Infinity : ((report[2] - prev[0][2])/prev[0][2]*100).toFixed(2)
                            }]
                        } else {
                            return [report[0],{
                                curr: report[1],
                                delta: "/"
                            },{
                                curr: report[2],
                                delta: "/"
                            }]
                        }
                    }).concat(prevReport.filter(report2 => currentReport.filter(report => report[0] === report2[0]).length === 0).map(report2 => {
                        return [report2[0], {
                            curr: 0,
                            delta: "-"
                        }, {
                            curr: 0,
                            delta: "-"
                        }]
                    })));
                }
            }
            //console.log(ret);
            return ret;
        }
    }
});
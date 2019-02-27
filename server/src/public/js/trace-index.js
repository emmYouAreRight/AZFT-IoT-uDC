'use strict';
const Vue = require('vue/dist/vue.common'),
    vis = require('vis'),
    io = require('socket.io-client'),
    taskDataSource = require('./modules/task-data'),
    taskTitle = 'Task,Semaphore,Mutex,Event,Buffer Queue,Timer,Memory,Work queue'.split(',');
//
let taskTimeline = null,
    socket = null,
    interval = null,
    viewModel = new Vue({
        el: '.ui.modal',
        data: {
            title: '',
            loading: true,
            table: taskTitle.map(title => {
                return {title: title, value: 'hello'};
            })
        },
        methods: {
            async show(id) {
                this.title = id;
                $(this.$el).modal('show');
                this.loading = true;
                //
                if (!taskTimeline) {
                    //
                    let groups = new vis.DataSet(taskDataSource.groups),
                        items = new vis.DataSet([]);
                    taskTimeline = new vis.Timeline($(this.$el).find('.timeline-chart').get(0), items, groups, {
                        editable: true,
                        // zoomable: false,
                        stack: false,
                        start: new Date(),
                        end: new Date(Date.now() + 60000),
                        rollingMode: {
                            follow: true,
                            offset: .8
                        }
                    });
                }
                taskTimeline.setItems([]);
                //
                socket = io('/trace');
                await new Promise((resolve, reject) => socket.on('connect', () => resolve()));
                socket.emit('trace:id', `task ${id}`);
                viewModel.loading = false;
                taskDataSource.clean(); // clean data
                socket.on('trace:task', data => {
                    // console.log(data);
                    taskDataSource.push(data);
                });
                socket.on('disconnect', () => {
                    clearInterval(interval);
                });
                $(this.$el).modal('refresh');
                let count = 0;
                clearInterval(interval);
                interval = setInterval(() => {
                    let dataSource = Object.values(taskDataSource.getData());
                    taskDataSource.recycle();
                    if (!dataSource.length) {return;}
                    dataSource = Object.values(dataSource, []).reduce((previous, current) => {
                        return previous.concat(current);
                    });
                    taskTimeline.setItems(new vis.DataSet(dataSource));
                }, 256);
            }
        },
        mounted() {
            $(this.$el).modal({
                // observeChanges: true,
                onHidden() {
                    socket && socket.disconnect();
                }
            });
        }
    });
//
new Vue({
    el: 'div[data-tab="tasks"]',
    data: {
        loading: true,
        tasks: []
    },

    methods: {
        async onClickRefresh() {
            this.loading = true;
            let data = await $.getJSON('/trace/tasks');
            this.tasks = data.tasks;
            this.loading = false;
        },

        async onClickTask(id) {
            await viewModel.show(id);
        }
    },

    async mounted() {
        await this.onClickRefresh();
    }
});
//
// semaphore view
let semaphoreTimeline = null;
new Vue({
    el: 'div[data-tab="semaphore"]',
    data: {
        loading: true
    },
    methods: {
        async onClickRefresh() {
            this.loading = true;
            //
            if (!semaphoreTimeline) {
                semaphoreTimeline = new vis.Timeline($(this.$el).find('.timeline-chart').get(0), [], [], {
                    editable: true,
                    stack: false,
                    start: new Date(),
                    end: new Date(Date.now() + 60000),
                    rollingMode: {
                        follow: true,
                        offset: .8
                    }
                });
            }
            semaphoreTimeline.setItems([]);
            socket = io('/trace');
            await new Promise((resolve, reject) => socket.on('connect', () => resolve()));
            socket.emit('trace:id', 'event ' + 0x200);
            this.loading = false;
            viewModel.loading = false;
            taskDataSource.clean(); // clean data
            socket.on('trace:task', data => {
                // console.log(data);
                taskDataSource.push(data, 'sem');
            });
            socket.on('disconnect', () => {
                clearInterval(interval);
            });
            let count = 0;
            clearInterval(interval);
            interval = setInterval(() => {
                let dataSource = Object.values(taskDataSource.getData()),
                    groups = {};
                taskDataSource.recycle();
                if (!dataSource.length) {return;}
                dataSource = Object.values(dataSource, []).reduce((previous, current) => {
                    return previous.concat(current);
                });
                // update group
                dataSource.forEach(item => groups[item.group] = 1);
                semaphoreTimeline.setGroups(Object.keys(groups).map(item => {return {id: item, content: item};}));
                // console.log(dataSource);
                // update data
                semaphoreTimeline.setItems(dataSource);
            }, 256);
            //
        }
    },
    mounted() {
        let self = this;
        $('.menu .item').tab({
            async onVisible(id) {
                socket && socket.disconnect();
                if (id === 'semaphore') {
                    await self.onClickRefresh();
                }
            }
        });
    }
});
//
$(window).on('beforeunload', () => socket && socket.disconnect());

const Vue = require('vue/dist/vue.common');
const app = new Vue({
    el: '#component',
    data: {
        componentList: [],
        location: '',
        filterText: '',
        selection: {},
        working: 'Loading'
    },
    created: function() {
        this.location = window.location.search.slice(1).split('&').filter(res => res.split('=')[0] === 'location')[0].split('=')[1];
        $('.ui.modal')
            .modal({
                onDeny: () => {
                },
                onApprove: () => {
                    this.submitAddComponent();
                }
            });
        this.update();
    },
    computed: {
        componentListSorted: function() {
            return this.componentList
            .filter(item => item.name.includes(this.filterText) || item.path.includes(this.filterText))
            .sort((a,b) => /*(b.used - a.used) * 99999 + (a.removeAble - b.removeAble) * 999 +*/ a.name.localeCompare(b.name));
        }
    },
    methods: {
        update: function() {
            $.get('/component/list', {
                location: this.location
            }, data => {
                //console.log(data);
                this.working = false;
                app.componentList = JSON.parse(data);
                app.componentList.forEach(component => {
                    this.selection[component.name] = 'keep';
                })
            });
        },
        toggle: function(component) {
            if (!component.used) {
                this.onAdd(component);
            } else {
                this.onRemove(component);
            }
        },
        onRemote: function() {
            $('.ui.modal')
            .modal('show');
        },
        submitAddComponent: async function() {
            return new Promise((resolve, reject) => {
                let url = $('.modal input').val().trim();
                console.log(url);
                this.working = `Adding ${url}`;
                $.post('/component/addRemote', {
                    url: url,
                    location: this.location
                }, ret => {
                    $(".component-dimmer").dimmer("hide");
                    if (ret.error) {
                        console.log(ret.error);
                        reject(ret.error);
                    }
                    resolve(ret);
                    this.update();
                });
            });
        },
        onAdd: async function(component) {
            return new Promise((resolve, reject) => {
                $(".component-dimmer").dimmer("show");
                $(".component-dimmer").dimmer("set active");
                this.working = `Adding ${component.name}`;
                $.post('/component/add', {
                    component: component,
                    location: this.location
                }, ret => {
                    $(".component-dimmer").dimmer("hide");
                    if (ret.error) {
                        console.log(ret.error);
                        reject(ret.error);
                    }
                    resolve(ret);
                    this.update();
                });
            });
        },
        onRemove: async function(component) {
            return new Promise((resolve, reject) => {
                $(".component-dimmer").dimmer("show");
                $(".component-dimmer").dimmer("set active");
                this.working = `Removing ${component.name}`;
                $.post('/component/remove', {
                    component: component,
                    location: this.location
                }, ret => {
                    this.working = false;
                    $(".component-dimmer").dimmer("hide");
                    if (ret.error) {
                        console.log(ret.error);
                        reject(ret.error);
                    }
                    resolve(ret);
                    this.update();
                });
            });
        },
        onSubmit: async function() {
            let targetComponent = Object.keys(this.selection);
            $(".component-dimmer").dimmer("show");
            $(".component-dimmer").dimmer("set active");
            for (let component of targetComponent) {
                let componentVO = this.componentList.find(item => item.name == component);
                if (!componentVO) continue;
                try {
                    switch (this.selection[component]) {
                        case 'add': 
                            this.working = `Adding ${component}`;
                            await this.onAdd(componentVO);
                            break;
                        case 'remove':
                        this.working = `Removing ${component}`;
                            await this.onRemove(componentVO);
                            break;
                    }
                } catch(err) {
                    console.log(err);
                }
            }
            this.working = false;
            $(".component-dimmer").dimmer("hide");
            this.update();
        }
    }
});
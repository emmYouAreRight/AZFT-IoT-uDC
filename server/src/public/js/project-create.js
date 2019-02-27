'use strict';
const parameters = require('./modules/parameters'),
    Vue = require('vue/dist/vue.common'),
    patrn = /^[\w\-\.\:\/\\]+$/i,
    errorModel = new Vue({
        el: 'div.error-dialog',
        data: {
            enableSubmitBtn: false,
            title: 'Error',
            content: ''
        },
        methods: {
            show(content, options) {
                options = options || {};
                this.content = content;
                this.enableSubmitBtn = options.enableSubmitBtn || false;
                this.title = options.title || 'Error';
                $(this.$el).modal('show');
            }
        },
        mounted() {
            let self = this;
            $(this.$el).modal({
                allowMultiple: true,
                onApprove() {
                    self.$emit('approve');
                },
                onHidden() {
                    self.$nextTick(() => {
                        $('form.ui input[name="location"]').get(0).select();
                    });
                }
            });
        }
    }),
    sdkModel = new Vue({
        el: 'div.sdk-path',
        data: {
            url: ''
        },
        methods: {
            show() {
                this.url = '/sdk/index';
                $(this.$el).modal('show');
            },
            onClose() {
                // it will trigger saving data and query data together when input-area get focus and click cancel button.
                // in this case, it can not get the right query value.
                // so use nextTick to keep the query data action in the back of queue.
                let self = this;
                self.$nextTick(async function() {
                    let sdk = await $.getJSON('/sdk/load');
                    if (!sdk.sdkPath.length) {
                        return errorModel.show('You have not set SDK path in editor. please set a SDK path at least.');
                    }
                    $(self.$el).modal('hide');
                    self.$emit('hide', sdk);
                });
            }
        },
        mounted() {
            $(this.$el).modal({closable: false});
        }
    });
//
new Vue({
    el: '.main',
    data: {
        loading: false,
        templates: [],
        templateId: '',
        sdkPath: '',
        location: {val: '', error: ''},
        hardwareBoard: 'mk3060',
        boards: ['mk3060', 'b_l475e', 'esp32devkitc']
    },
    methods: {
        onClickItem(id) {
            this.templateId = id;
        },
        async onChangeSdk() {
            let sdkItem = this.sdkPaths.find(item => item.sdk === this.sdkPath),
                response = await $.post('/project/templates', {sdkPath: this.sdkPath});
            //this.toolChain = sdkItem.toolChain;
            if (!response) {return;}
            this.templates = response.templates;
            this.templateId = response.templates.length ? response.templates[0].filePath : '';
        },

        async onLocationBlur() {
            let ret = {error: 0};
            if (!this.location.val) {
                $('form.ui input[name="location"]').get(0).focus();
                return ret = {error: 1, msg: this.location.error = 'Location path is required!'};
            }
            //
            if (!this.location.val.match(patrn)) {
                $('form.ui input[name="location"]').get(0).focus();
                return ret = {error: 1, msg: this.location.error = 'The characters of path must be in the range: [a-z, A-Z, 0-9, _, -, ., /, \\]'};
            }
            //
            ret = await $.post('/project/validate', {location: this.location.val});
            if (ret.error && ret.error !== 2) {
                this.location.error = ret.msg;
                $('form.ui input[name="location"]').get(0).select();
                return ret;
            }
            this.location.error = '';
            return ret;
        },

        async onSubmit() {
            if (!this.templateId) {
                return errorModel.show('Can not find template!');
            }
            let valid = await this.onLocationBlur();
            if (valid.error) {
                valid.error === 2 && errorModel.show(valid.msg, {enableSubmitBtn: true, title: 'Warning'});
                return;
            }
            await this.scaffold();
        },
        //
        async scaffold() {
            this.loading = true;
            let ret = await $.post('/project/scaffold', {
                location: this.location.val,
                sdkPath: this.sdkPath,
                //toolChain: this.toolChain,
                templateId: this.templateId,
                hardwareBoard: this.hardwareBoard
            });
            this.loading = false;
            location.href = parameters.parse('/success.html');
        }
    },

    async mounted() {
        let self = this;
        sdkModel.$on('hide', sdk => {
            self.sdkPaths = sdk.sdkPaths;
            self.sdkPath = sdk.sdkPaths[0].sdk;
            //self.toolChain = sdk.sdkPaths[0].toolChain;
            this.onChangeSdk();
        });
        errorModel.$on('approve', () => {
            self.scaffold();
        });
        //
        let sdk = await $.getJSON('/sdk/load');
        if (sdk.sdkPaths.length) {
            sdkModel.$emit('hide', sdk);
        } else {
            sdkModel.show();
        }
        let home = await $.getJSON('/project/homedir');
        $('form.ui input[name="location"]').prop('placeholder', home.homedir);
        this.location.val = home.homedir;
    }
});

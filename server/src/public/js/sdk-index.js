'use strict';
const Vue = require('vue/dist/vue.common'),
    patrn = /^[\w\-\.\:\/\\\(\s]+$/i,
    defaultItem = {
        sdk: {
            val: '',
            editable: true,
            error: '',
            placeholder: ''
        },
        version: {
            val: '',
            editable: true,
            error: ''
        }
    };
//
new Vue({
    el: 'form.main',
    data: {
        sdkPaths: [],
        hasGcc: false
    },
    methods: {
        onClickAdd() {
            this.sdkPaths.push($.extend(true, {}, defaultItem));
            let lastIndex = this.sdkPaths.length - 1;
            this.$nextTick(async function() {
                await this.onSdkBlur(lastIndex);
                await this.onVersionBlur(lastIndex);
            });
        },

        onClickMinus(index) {
            let self = this;
            self.sdkPaths.splice(index, 1);
            self.$nextTick(async function() {
                await self.save();
            });
        },

        async onSdkBlur(index) {
            let item = this.sdkPaths[index];
            if (!item.sdk.val) {
                item.sdk.editable = true;
                item.sdk.error = 'SDK path is required!';
                return;
            }
            // same sdk path
            let findIndex = this.sdkPaths.findIndex(row => row.sdk.val === item.sdk.val);
            if (~findIndex && findIndex !== index) {
                item.sdk.editable = true;
                item.sdk.error = 'SDK path have already existed!';
                return;
            }
            //
            let valid = await $.post('/sdk/validate', {dir: item.sdk.val, version: true});
            if (valid.error) {
                item.sdk.editable = true;
                item.sdk.error = `SDK ${valid.msg}`;
                return;
            }
            //
            item.version.val = valid.version;
            let saved = await this.onVersionBlur(index);
            !saved && $(`input[data-id="version${index}"]`).focus();
            //
            item.sdk.editable = false;
            item.sdk.error = '';
            return await this.save();
        },

        async onVersionBlur(index) {
            let item = this.sdkPaths[index];
            if (!item.version.val) {
                item.version.editable = true;
                item.version.error = 'Version is required!';
                return;
            }
            item.version.editable = false;
            item.version.error = '';
            return await this.save();
        },

        onClickEdit(evt, index, type) {
            this.sdkPaths[index][type].editable = true;
            this.$nextTick(() => $(evt.target).parents('td').find('input').get(0).select());
        },

        async save() {
            let self = this,
                sdkPaths = self.sdkPaths.map(item => {
                    return {sdk: item.sdk.val, version: item.version.val};
                }).filter((item, index) => {
                    item = self.sdkPaths[index];
                    return !item.sdk.editable && !item.version.editable;
                });
            return await $.post('/sdk/update', {
                sdkPaths: sdkPaths
            });
        }
    },
    async mounted() {
        let env = await $.getJSON('/sdk/env');
        defaultItem.sdk.val =
        defaultItem.sdk.placeholder = `${env.homedir}${env.sep}aos`;
        let sdks = await $.getJSON('/sdk/load');
        if (sdks.sdkPaths.length) {
            this.sdkPaths = sdks.sdkPaths.map(item => {
                return $.extend(true, {}, defaultItem, {
                    sdk: {val: item.sdk, editable: false},
                    version: {val: item.version, editable: false}
                });
            });
        } else {
            this.onClickAdd();
        }
    }
});

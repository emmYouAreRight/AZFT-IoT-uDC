'use strict';
let parameters = null;
if (location.search) {
    let array = location.search.replace('?', '').split('&');
    parameters = {};
    array.forEach(item => {
        item = item.split('=');
        parameters[item[0]] = decodeURIComponent(item[1]);
    });
}
module.exports = {
    getParameters() {
        return parameters;
    },
    parse(url) {
        if (!parameters) {return url;}
        return `${url}${~url.indexOf('?') ? '&' : '?'}theme=${parameters.theme}&bgcolor=${parameters.bgcolor}&color=${parameters.color}`;
    }
};

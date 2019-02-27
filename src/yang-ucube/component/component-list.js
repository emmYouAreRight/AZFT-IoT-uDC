const Component = require('./component');
module.exports = class ComponentList {
    constructor(componentList) {
        this.componentList = [];
        for (let componentPath in componentList) {
            this.componentList.push(new Component(componentPath, componentList[componentPath].name, componentList[componentPath]));
        }
    }

    get componentList() {
        return this._componentList;
    }

    set componentList(componentList) {
        this._componentList = componentList;
    }

    get componentListVO() {
        return this.componentList.map(component => component.componentVO);
    }
}
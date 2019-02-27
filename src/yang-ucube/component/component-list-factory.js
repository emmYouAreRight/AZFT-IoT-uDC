const ComponentList = require('./component-list');
const ComponentService = require('./component-service');
class ComponentListFactory {
    static generateComponentList(str) {
        const componentListVO = JSON.parse(str);
        const componentList = new ComponentList(componentListVO);
        componentList.componentList = componentList.componentList.map(item => ComponentService.setDefaultSpecification(item));
        return componentList;
    }
}

module.exports = ComponentListFactory;
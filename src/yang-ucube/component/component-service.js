module.exports = class ComponentService {

    static setDefaultSpecification(component) {
        return ComponentService.systemComponentNotModifiableSpecification(component);
    }

    static systemComponentNotModifiableSpecification(component) {
        if (component.path.startsWith("aos/platform") || component.path.startsWith("aos/example")) {
            component.addAble = false;
            component.removeAble = false;
        }
        return component;
    }
}
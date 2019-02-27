module.exports = class Component {
    constructor(componentPath, componentName, componentProps) {
        if (typeof componentPath === 'object') {
            // when component path is a component-like object
            this.path = componentPath.path;
            this.name = componentPath.name;
            this.props = componentPath;
        } else {
            this.path = componentPath;
            this.name = componentName;
            this.props = componentProps;
        }
    }

    get path() {
        return this._path;
    }

    set path(path) {
        this._path = path;
    }

    get name() {
        return this._name;
    }

    set name(name) {
        this._name = name;
    }

    get props() {
        return this._props;
    }

    set props(props) {
        this._props = props;
    }

    get used() {
        return this.props.used;
    }

    set addAble(flag) {
        this.props.cube_add = !flag;
    }

    set removeAble(flag) {
        this.props.cube_remove = !flag;
    }

    get addAble() {
        return !this.props.cube_add;
    }

    get removeAble() {
        return !this.props.cube_remove;
    }

    get componentVO() {
        return {
            path: this.path,
            name: this.name,
            addAble: !!this.addAble,
            removeAble: !!this.removeAble,
            //used: !!this.used
        }
    }
}
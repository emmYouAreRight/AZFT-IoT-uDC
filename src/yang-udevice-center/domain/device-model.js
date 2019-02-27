class Device {
    get name() {
        return this._name;
    }

    set name(value) {
        this._name = value;
    }

    get props() {
        return this._props;
    }

    set props(value) {
        this._props = value;
    }

    constructor(name, props) {
        this._name = name;
        this._props = props;
        try {
            if (!this._props.model) this._props.model = this._name.match('/dev/(.*)-')[1];
        } catch(err) {}
    }
}

module.exports = Device;
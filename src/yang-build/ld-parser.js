module.exports = function(linkerScript) {
    const res = linkerScript.match(/PROVIDE\(.*=.*\)/g);
    if (!res || res.length <= 0) return {};
    let ret = {};
    res.forEach(line => {
        let temp = line.match(/PROVIDE\(\s*(.*?)\s*=\s*(.*?)\s*\)/);
        if (temp && temp[1] && temp[2]) {
            ret[temp[1].trim()] = temp[2].trim();
        }
    });
    return ret;
}
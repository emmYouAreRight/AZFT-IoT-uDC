const fs = require('fs-plus');
const path = require('path');
module.exports = {
    findDirectory: function(root) {
        const includePath = [];
        return new Promise((resolve) => {
            fs.traverseTree(root, filePath => {
                if (path.extname(filePath) === ".h") {
                    includePath.push(filePath);
                    // let pushPath = path.dirname(filePath);
                    // while (pushPath.includes(root)) {
                    //     includePath.push(pushPath + "/");
                    //     pushPath = path.join(pushPath, '..');
                    // }
                }
            }, dir => !dir.includes('compiler') && !dir.includes('out') && !dir.includes('tools') && !dir.includes('test') && !dir.includes('bootloader') && !dir.includes('build')&& !dir.includes('platform'), () => {
                resolve(includePath.sort().reduce((prev, curr) => prev && prev[prev.length - 1] === curr ? prev : prev.concat(curr), []));
            });
        });
    }
}
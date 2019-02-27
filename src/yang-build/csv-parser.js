module.exports = function(fileContent) {
    const noCommentsStr = filterComments(fileContent);
    return noCommentsStr.split('\n').filter(line => line).map(line => {
        return line.trim().split(',').map(part => part.trim()).filter(part => part);
    });
}

function filterComments(str) {
    return str.split('\n').map(line => {
        return line.replace(/#.*/, '');
    }).join('\n');
}
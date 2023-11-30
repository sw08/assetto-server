function formatTime(time, format = '%m:%s.%ms') {
    const formats = ['%ms', '%s', '%m', '%h', '%d'];
    const units = [1000, 60, 60, 24, 1];
    const lengths = [3, 2, 2, 2, 0]
    var temp;
    var n = 0;
    for (const f of formats) {
        if (format.includes(f)) n++;
        else break;
    }
    for (var i = 0; i < n; i++) {
        temp = time % units[i];
        format = format.replaceAll(formats[i], addZero(temp, lengths[i]));
        time -= temp
        time /= units[i];
    }
    return format;
}

function addZero(value, length) {
    var result = value.toString();
    if (length !== 0) {
        for (var i = 0; i < length - result.length; i++) {
            result = '0' + result;
        }
    }
    return result;
}

module.exports = {
    formatTime: formatTime,
    addZero: addZero
}
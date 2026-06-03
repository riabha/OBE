/**
 * Derive a short unique faculty code from a full QUEST faculty name.
 * e.g. "Faculty of Science" -> SCIENC, "Faculty of Technology" -> TECHNO
 */
function facultyCodeFromName(name, usedCodes = null) {
    const cleaned = String(name || '').replace(/^Faculty of\s+/i, '').trim();
    const words = cleaned.split(/\s+/).filter(w => w && !/^and$/i.test(w));

    let code;
    if (words.length >= 2) {
        code = words.map(w => w[0]).join('').toUpperCase();
    } else if (words.length === 1) {
        code = words[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    } else {
        code = 'FAC';
    }
    code = code.slice(0, 12);

    if (usedCodes) {
        const base = code;
        let n = 2;
        while (usedCodes.has(code)) {
            code = `${base.slice(0, 10)}${n}`.slice(0, 12);
            n += 1;
        }
        usedCodes.add(code);
    }

    return code;
}

module.exports = { facultyCodeFromName };

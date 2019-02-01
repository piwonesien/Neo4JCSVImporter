const fs = require("fs");
const path = require("path");
const configFolder = "./configs/"


/**
 * Read a csv file line by line and returns an JSON object list of it
 * Use the config file, to modify the format.
 * Async function! - Use await to get the list
 * @param config Configuration file object
 * @returns {Promise<any>} Promise or list with json of each line
 */
async function readCSV(config) {
    // Open file stream
    const lineReader = require('readline').createInterface({
        input: fs.createReadStream(config.file)
    });

    // Parse lines
    let lines = [];
    lineReader.on('line', function (line) {
        lineConverter(line, lines, config)
    });

    return await new Promise(resolve => {
        lineReader.on('close', () => {
            resolve(lines)
        });
    });
}

/**
 * Gets a line string, convert it to json
 * @param line LineString which should be converted
 * @param lines Object in which the converted line should store to
 * @param config config file object
 */
function lineConverter (line, lines, config) {
    // Ignore all comments
    if(line.startsWith("#")) {
        return;
    }

    var splitted = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

    var obj = {};
    config.fields.forEach((field, index) => {
        var tmp = splitted[index].replace("\"", "");

        // Separate strings to list, if they have a separator in it
        if(tmp.includes("|")) {
            tmp = tmp.split("|")
        }
        // Split if value is a list
        obj[field] = tmp;
    });

    // Remove keys, which should not exist
    if(!filterObject(obj, config)) {
        lines.push(obj);
    }
}

/**
 * Remove all fields, that should not be in the object
 *
 * @param object the given object
 * @param config object which contains the removeFields element
 * @returns boolean true = don't push element to list, false = add element to list
 */
function filterObject(object, config) {
    // Remove unessesary fields
    config.removeFields.forEach((x) => {
        delete object[x];
    });

    let removeObject = false
    // Remove object, if value does not match
    Object.keys(config.removeFieldsByValue.noMatch).forEach((x) => {
        if (object[x] !== config.removeFieldsByValue.noMatch[x]) {
            removeObject = true;
        }
    });

    if(removeObject === true) {
        return removeObject;
    }

    // Remove object if value match
    Object.keys(config.removeFieldsByValue.match).forEach((x) => {
        if (object[x] === config.removeFieldsByValue.match[x]) {
            removeObject = true;
        }
    });

    return removeObject;
}

/**
 * Convert all files in the configFolder.
 */
function convertAll() {
    fs.readdir(configFolder, (err, files) => {
        files.forEach(async file => {
            let tmp = fs.readFileSync(path.join(configFolder, file));
            let config = JSON.parse(tmp);

            let lines = await readCSV(config);
            console.log(lines.length)
        });
    })
}

convertAll()
//readCSV("./csv/CTD_pheno_term_ixns.csv");

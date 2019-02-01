const fs = require("fs");
const path = require("path");
const configFolder = "./configs/"



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

function lineConverter (line, lines, config) {
    // Ignore all comments
    if(line.startsWith("#")) {
        return;
    }

    var splitted = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

    var obj = {};
    config.fields.forEach((field, index) => {
        var tmp = splitted[index].replace("\"", "");

        if(tmp.includes("|")) {
            tmp = tmp.split("|")
        }
        // Split if value is a list
        obj[field] = tmp;
    });
    lines.push(obj);
}

function convertAll() {
    fs.readdir(configFolder, (err, files) => {
        files.forEach(file => {
            let tmp = fs.readFileSync(path.join(configFolder, file));
            let config = JSON.parse(tmp);
            readCSV(config)
        });
    })
}

convertAll()
//readCSV("./csv/CTD_pheno_term_ixns.csv");

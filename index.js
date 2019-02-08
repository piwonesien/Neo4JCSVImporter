const fs = require("fs");
const path = require("path");
const neo4j = require('neo4j-driver').v1;
const ProgressBar = require('progress');
const configFolder = "./configs/"


/**
 * Read a csv file line by line and returns an JSON object list of it
 * Use the config file, to modify the format.
 * Async function! - Use await to get the list
 * @param config Configuration file object
 * @returns {Promise<list>} Promise or list with json of each line
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

    let removeObject = false;

    // Remove object, if value does not match
    Object.keys(config.removeFieldsByValue.noMatch).forEach((x) => {
        if (object[x] !== config.removeFieldsByValue.noMatch[x]) {
            removeObject = true;
        }
    });

    // Skip the next filter, because the line should allready removed
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

async function createSQL (line, config, driver, fileStream) {
    // ToDo: Eigentlich muesste zuerst ueber alle Relationen gegangen werden und die Values zwischengespeichert werden, damit tatsaechlich alle Relationsattribute bei allen Relationen entfernt wurden.
    // ToDo: Beruecksichtige: aFieldVal und bFieldVal koennen auch Listen sein. In diesem Fall muessen alle moeglichen Konstellationen iteriert werden. aFieldVal[0] -> bFieldVal, aFieldVal[1] -> bFieldVal usw.
    for(var relationName in config.relations) {
        // Define all relation values
        let relation = config.relations[relationName];
        let override = relation.create;
        delete relation.create;
        let aName = Object.keys(relation)[0];
        let bName = Object.keys(relation)[1];
        let a = Object.keys(relation[aName])[0];
        let aFieldKey = relation[aName][a];
        let aFieldVal = line[aFieldKey];
        let b = Object.keys(relation[bName])[0];
        let bFieldKey = relation[bName][b];
        let bFieldVal = line[bFieldKey];

        // Remove relation keys from object
        delete line[aFieldKey];
        delete line[bFieldKey];

        // Create Neo4J statement
        let stmt = "";
        if(override) {
            // Create relation A-[relation]->B and create nodes A & B if they are not existing
            stmt = "MERGE (a:" + aName + " {" + a + ": {aFieldVal}}) \n" +
                "MERGE (b:" + bName + " {" + b + ": {bFieldVal}}) \n" +
                "MERGE (a)-[r:" + relationName + " " +
                    /*
                    JSON.stringify would create an object like {"key": "value", ...}
                    For reasons I can't understand, Neo4J wants an object like {key: "value"} -> replace quotes for keys:
                    */
                    JSON.stringify(line)
                        .replace(/\\"/g,"\uFFFF")
                        .replace(/\"([^"]+)\":/g,"$1:")
                        .replace(/\uFFFF/g,"\\\"") +
                "]->(b) \n";
        } else {
            // Create only the relation A-[relation]->B and show console output, if line could not created
            stmt = "MATCH (a:" + aName + "),(b:" + bName + ") WHERE a." + a + " = {aFieldVal} AND b." + b + " = {bFieldVal} CREATE (a)-[r:" + relationName + " {line}]->(b) RETURN r";
        }

        // Neo4J insertion
        const session = driver.session();
        const result = await session.run(
            stmt,
            {aFieldVal: aFieldVal, bFieldVal: bFieldVal, line: line}
        );

        // Log missing lines -> only possible, if lines should not created
        if(!override && typeof result.records[0] === "undefined") {
            console.log("  Error: Relation (" + aName + "." + a+ "=" + aFieldVal+ " -> " + bName + "." + b + "=" + bFieldVal+ ") could not created");
            fileStream.write(relationName +"," + aFieldVal + "," + bFieldVal + "\n");
        }

        // Close session
        session.close();
    }
}

/**
 * Insert all lines in sql.
 * @param lines all lines list
 * @param config current config file
 * @param driver Neo4J driver
 * @returns {Promise<void>}
 */
async function insertLines(lines, config, driver) {
    // Init progress bar
    let bar = new ProgressBar('  Inserting Lines: [:bar] :rate/lps :percent', {
        complete: '=',
        incomplete: ' ',
        total: lines.length
    });

    // Open filestream for new csv file with all missing nodes
    fs.mkdirSync("./missing/");
    let fileStream = fs.createWriteStream("./missing/missingData_" + path.basename(config.file, '.csv')+ ".csv", {flags:'a'});
    fileStream.write("RelationName,AFieldValue,BFieldValue\n");

    // Insert all lines
    for(var key in lines) {
        var line = lines[key];
        await createSQL(line, config, driver, fileStream );
        bar.tick();
    }

    fileStream.end();
}

function openSQL(config) {
    return neo4j.driver(config.database.uri, neo4j.auth.basic(config.database.user, config.database.pw));
}

/**
 * Convert all files in the configFolder.
 */
function convertAll() {
    fs.readdir(configFolder, (err, files) => {
        files.forEach(async file => {
            console.log(new Date().toLocaleString(), " [", file, "]: Begin process for this config file");
            let tmp = fs.readFileSync(path.join(configFolder, file));
            let config = JSON.parse(tmp);
            let lines = await readCSV(config);
            console.log(new Date().toLocaleString(), " [", file, "]: Read lines finished. Found ", lines.length, " lines. Start SQL insertion");
            let driver = openSQL(config);
            await insertLines(lines, config, driver);
            driver.close();
            console.log(new Date().toLocaleString(), " [", file, "]: Finished SQL insertion and finished this config file");
        });
    })
}

convertAll();
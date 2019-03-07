module.exports = {
  "file": "path to csv file",
  "database": {
    "uri": "neo4juri",
    "user": "username for database",
    "pw": "password for database"
  },
  "fields": ["List", "with", "all", "Fields", "of", "the", "csv", "file"],
  "relations": {
    // Create Relation: MATCH (a:nameA),(b:nameB) WHERE a.fieldnameA = {properties[fieldValueA]} AND b.fieldnameB = {properties[fieldValueB]} CREATE (a)-[r:relationname {properties}]->(b) RETURN r
    "relationname": {
      "nameA": {
        "fieldnameA": "fieldValueA"
      },
      "nameB": {
        "fieldnameB": "fieldValueB"
      },
      "create": false // set to true, if you want to create not existing A or B nodes
    }
  },
  "complexRelations": [
    {
      // SQL Statement: You can use the normal chipher notation for chipher stuff and {{local}} notation for explicit modification functions (local vars)
      $sql: `MATCH (a:Chemical)-[]->(b:CTDchemical)-[r:phenotype]->(c:CTDGO)-[:equal_to_CTD_go ]-(d) 
             WHERE b.chemical_id = {chemicalid} AND c.go_id = {phenotypeid} 
             MERGE (a)-[:{{relationtype}}]->(d)`,
      $insert: (line) => {
        return true
      },
      // Must return a sql chiper json
      $chipher: (line) => {
        return {chemicalid: line.chemicalid, phenotypeid: line.phenotypeid}
      },
      // Optional:
      // You can add any local variable here from the sql statement. They will be called as a function with the current line as parameter.
      "relationtype": (line) => {
        return "test";
      }
    }
  ],
  "removeFields": ["List", "with", "all", "fieldnames", "which", "should", "not", "inserted", "as", "a", "property"],
  "removeFieldsByValue": {
    "match": { // The line[fielname] is not allowed to have this value, then the line would be removed
      "fieldname": "value"
    },
    "noMath": { // The line[fieldname] should have exact this value, otherwise remove this line
      "fieldname": "value"
    }
  }
}
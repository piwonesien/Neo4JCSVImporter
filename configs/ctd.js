module.exports = {
  "file": "./csv/CTD_pheno_term_ixns.csv",
  "database": {
    "uri": "bolt://localhost:7687",
    "user": "neo4j",
    "pw": "neo4j42"
  },
  "fields": [
    "chemicalname",
    "chemicalid",
    "casrn",
    "phenotypename",
    "phenotypeid",
    "comentionedterms",
    "organism",
    "organismid",
    "interaction",
    "interactionactions",
    "anatomyterms",
    "inferencegenesymbols",
    "pubmedids"
  ],
  "relations": {
    "phenotype": {
      "CTDchemical": {
        "chemical_id": "chemicalid"
      },
      "CTDGO": {
        "go_id": "phenotypeid"
      },
      "create": false
    }
  },
  "complexRelations": [
    {
      $sql: `MATCH (a:Chemical)- []->(:CTDchemical)-[r:phenotype]->(b:CTDGO)-[:equal_to_CTD_go ]-(bc 
              WHERE a.chemical_id = {chemicalid} AND b.go_id = {phenotypeid} 
              CREATE (a)-[r:{{relationtype}}]->(c) RETURN r`,
      "relationtype": (line) => {
        console.log('test', line);
        let aName = line.chemicalname;
        let bName = line.phenotypename;
        let interaction = line.interaction; // Array

        if(interaction.includes("affects^phenotype")) {
          return "associates"
        }




        return "associates"
      },
      // Must return a boolean
      $insert: (line) => {
        return true
      },
      // Must return a sql chiper json
      $chipher: (line) => {
        return {chemicalid: line.chemicalid, phenotypeid: line.phenotypeid}
      }
    }
  ],
  "removeFields": ["casrn"],
  "removeFieldsByValue": {
    "match": {

    },
    "noMatch": {
      "organism": "Homo sapiens"
    }
  }
};
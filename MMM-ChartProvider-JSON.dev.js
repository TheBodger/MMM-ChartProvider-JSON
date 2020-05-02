// this is a utility module that can be run using nodejs
//
//  1) read the config file and store locally, setting any defaults for missing entries
//  2) read the input file and check it is JSON.parse compatible
//  3) process all the entries at the specified rootkey level to try and match any of the keys at that level for extraction
//  4) build a new item for each key match found from any passed subject,object,timestamp.
//  5) either display to console or write to file as a JSON.stringify all of the items as an array of items

const moduleruntime = new Date();

// get required scripts

const moment = require("moment");

// get required structures and utilities

const structures = require("./structures.js");
const utilities = require("./common.js");

const JSONutils = new utilities.JSONutils();
const configutils = new utilities.configutils();

    const defaults = {
        input:"./input.json"    // | No | The locator of the input JSON | any valid fs locator | ./input.json
    }

    const paramdefaults = {
        rootkey: '',             // | No | the key value to determine at what level to extract data | a valid string | the first level
        subject: null,           // | Yes | the KEY name to use as a subject for an item | any valid string | none
        object: null,            // | Yes | the object to insert into the item | any valid string | none
        value: null,             // | Yes | the KEY name to use to for the value field of the item | any valid string | none
        type: "string",          // | No | the type of the value when added tot he item | numeric(will validate using parsefloat) or string | string
        timestamp: 0,            // | No | the KEY name of a timestamp to use for the timestamp field value in the item, or an offset from the runtime of the module as a number | any valid string(timestamp uses loose moment to validate) Or a negaitive or positive integer of seconds to offset from the tun time | the timestamp of running the module (i.e. use offset of 0)
        timestampformat:null,    // | No | a moment compatible timestamp format used to validate any dates found | timestamp string | Null - dont use any format
        filename: null           // | No | local file name(no paths) to save a serialised version of the extracted data as an array of items | any valid filename or not defined for no output.If not defined then the output is displayed to the console | none
}

//------------------------------------------ load and prepare the config --------------------------------

let config = configutils.setconfig(defaults,true);

    // for each of the parameters found, merge with the defaults
    // process the timestamp option

const cpl = config.params.length;

for (var idx = 0; idx < cpl; idx++) {

    var param = Object.assign({}, paramdefaults, config.params[idx]);

    param["useruntime"] = false;
    param["usenumericoutput"] = false;

    if (param.type == 'numeric') { param["usenumericoutput"] = true;}

    if (typeof param.timestamp == "number") { //wants an offset of the runtime, provided in seconds, or it was blank

        param["useruntime"] = true;
        param["runtime"] = new Date(moduleruntime.getTime() + (param.timestamp*1000));

    }

    config.params[idx] = param;

}

//------------------------------------------ process input data --------------------------------

// all the configs are good so we can now start processing the actual data

var outputarray = new Array(config.params.length)// param and then items

for (cidx = 0; cidx < config.params.length; cidx++) { outputarray[cidx] = []; }

//attempt to pull anything back that is valid in terms of a fs recognised locator

var inputjson = JSONutils.getJSON(config);

// now make sure we are accessing the json at the correct level - will needs load more work for complex multi level json data

var jsonarray = inputjson[config.params[0].rootkey];

//this should now be an array that we can process in the simplest case

//check it actually contains something, assuming if empty it is in error

if (jsonarray.length == 0) { console.error("json array is empty"); process.exit(1); }

for (var idx = 0; idx < jsonarray.length; idx++) {

    //look for any key value pairs required and create an item

    for (var cidx = 0; cidx < config.params.length; cidx++) {

        var processthisitem = false;

        var tempitem = new structures.NDTFItem()

        tempitem.object = config.params[cidx].object; 

        //do we have a subject

        if (jsonarray[idx][config.params[cidx].subject] != null) {

            tempitem.subject = jsonarray[idx][config.params[cidx].subject];

            //do we have a value

            if (jsonarray[idx][config.params[cidx].value] != null) {

                //check if numeric 

                if (config.params[cidx].usenumericoutput) {
                    if (isNaN(parseFloat(jsonarray[idx][config.params[cidx].value]))) {
                        console.error("Invalid numeric value: " + jsonarray[idx][config.params[cidx].value]);
                    }
                    else {
                        tempitem.value = parseFloat(jsonarray[idx][config.params[cidx].value]);
                    }
                }
                else {
                    tempitem.value = jsonarray[idx][config.params[cidx].value];
                }

                //if the timestamp is requested do we have one of those as well

                if (!config.params[cidx].useruntime) {

                    //got a timestamp key, now validate it

                    var temptimestamp = jsonarray[idx][config.params[cidx].timestamp];

                    if (temptimestamp != null) {

                        if (config.params[cidx].timestampformat != null) {

                            if (moment(temptimestamp, config.params[cidx].timestampformat).isValid()) {

                                //got a good date

                                tempitem.timestamp = moment(temptimestamp, config.params[cidx].timestampformat).toDate();

                                processthisitem = true;

                            }
                            else { console.error("Invalid date");}

                        }

                        else {

                            if (moment(temptimestamp).isValid()) {

                                //got a good date

                                tempitem.timestamp = moment(temptimestamp).toDate();

                                processthisitem = true;

                            }
                            else { console.error("Invalid date"); }

                        }

                    }
                }
                else { // use an offset timestamp

                    tempitem.timestamp = config.params[cidx].adjustedruntime;

                    processthisitem = true;

                }

            }

        }

        if (processthisitem) {

            outputarray[cidx].push(tempitem);

        }

        delete tempitem;

    }  //end of process loop - params


}  //end of process loop - input array

//now determine what to do next

for (var cidx = 0; cidx < config.params.length; cidx++) {

    if (config.params[cidx].filename == null) {
        console.info(outputarray[cidx]);
    }
    else {

        // write out to a file

        JSONutils.putJSON("./" + config.params[cidx].filename, outputarray[cidx]);

        console.info(outputarray[cidx].length);

    }

}





# MMM-ChartProvider-JSON

This magic mirror module is a MMM-ChartProvider module that is part of the MMM-Chartxxx and MMM-Feedxxx interrelated modules.

For an overview of these modules see the README.md in https://github.com/TheBodger/MMM-ChartDisplay.

the -JSON module reads JSON formatted data, from a URL or local text file and formats it into one of more NDTF standard feeds to one or more MMM-ChartDisplay consumers.

### Example
![Example of MMM-ChartProvider-JSON output being displayed](images/screenshot.png?raw=true "Example screenshot")

### Dependencies

Before installing this module;
		use https://github.com/TheBodger/MMM-ChartUtilities to setup the MMM-Chart... dependencies and  install all modules.
		use https://github.com/TheBodger/MMM-FeedUtilities to setup the MMM-Feed... dependencies and  install all modules.

```
moment
```

## Installation
To install the module, use your terminal to:
1. Navigate to your MagicMirror's modules folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules`
2. Clone the module:<br />`git clone https://github.com/TheBodger/MMM-ChartProvider-JSON`

## Using the module

### MagicMirror² Configuration

To use this module, add the following minimum configuration block to the modules array in the `config/config.js` file:
```js
{
  "input": "JSON filename or URL",
  "params": [
    {
      "subject": "the name of the key in the input JSON that will provide the value for the NDTF subject",
      "object": "the name of the key in the input JSON that will provide the value for the NDTF object",
      "value": "the name of the key in the input JSON that will provide the value for the NDTF value",
 
    }
  ]
}

```

### Configuration Options

| Option                  | Details
|------------------------ |--------------
| `text`                | *Optional* - <br><br> **Possible values:** Any string.<br> **Default value:** The Module name
| `consumerids`            | *Required* - a list of 1 or more consumer modules this module will provide for.<br><br> **Possible values:** An array of strings exactly matching the ID of one or more MMM-ChartDisplay modules <br> **Default value:** none
| `id`         | *Required* - The unique ID of this provider module<br><br> **Possible values:** any unique string<br> **Default value:** none
| `datarefreshinterval`            | *Optional* - milliseconds to pause before checking for new data in the feeds.<br><br> **Possible values:** a number in milliseconds <br> **Default value:** `60000` 
| `input`            | *Required* - the local filename with file path relative to the Magicmirror folder or  the URL of the JSON feed<br><br> **Possible values:** any valid file and path or URL <br> **Default value:** none
| `jsonfeeds`        | *Required* - An array of one or more feed definitions, see below for the jsonfeed configuration options 
| `waitforqueuetime`            |*Ignore* -  Queue delay between ending one queue item and starting the next <br><br> **Possible values:** a number in milliseconds. <br> **Default value:** `10`
| `JSONFeed Format`            |
| `feedname`            |*Optional* -  Name of the feed for reference purposes<br><br> **Possible values:** Any unique string. <br> **Default value:** none
| `setid`            |*Required* - The unique identifier of the set of data produced by this definition. It will be used in the MMM-ChartDisplay configuration to identifier this set for usage.<br><br> **Possible values:** Any unique string. <br> **Default value:** none
| `rootkey`            |*Optional* - the JSON address of the base level of the data to use for extracting data<br><br> **Possible values:** Any string representing, in dot notation the JSON  that identifies the root level of data to extract. <br> **Default value:** none - the first level of the JSON Data
| `oldestage`            |*Optional* -  Currently unused. <br><br> **Possible values:** 'today' or a number of minutes or a valid date(See [Moment.js formats](http://momentjs.com/docs/#/parsing/string-format/). <br> **Default value:** none
| `subject`            |*Required* - The key name, including any parent levels up to but excluding the rootkey level that will be used to populate the subject field value.<br><br> **Possible values:** Any string of a dot notation JSON key address. <br> **Default value:** none
| `object`            |*Required* - The value that will be used to populate the object field value.<br><br> **Possible values:** Any string. <br> **Default value:** none
| `value`            |*Required* - The key name, including any parent levels up to but excluding the rootkey level that will be used to populate the value field value.<br><br> **Possible values:** Any string of a dot notation JSON key address. <br> **Default value:** none
| `type`            |*Optional* - The format the value will be held in the output feed. if numeric, then the value will be validated as numeric and if it fails the item will be dropped<br><br> **Possible values:** 'string' or 'numeric'. <br> **Default value:** `'string'`
| `timestamp`            |*Optional* - The key name, including any parent levels up to but excluding the rootkey level that will be used to populate the timestamp field value or an offset from the runtime of the module as a number of seconds.<br><br> **Possible values:** Any string of a dot notation JSON key address or a numeric value of seconds offset (+-). <br> **Default value:** none - equivalent to 0 second offset
| `timestampformat`            |*Optional* - A moment compatible string indicating the format of the timestamp in the input JSON feed.<br><br> **Possible values:** Any valid moment string <br> **Default value:** none
| `filename`            |*Optional* - The filename, with path, where the output feed will be written in a JSON format<br><br> **Possible values:** Any valid filename and path string <br> **Default value:** none

### Example configuration

this configuration produces two feeds from the input JSON feed, 

```
{
  consumerids:['MMCD1'],
  id:'MMCP1',
  input: "https://opendata.ecdc.europa.eu/covid19/casedistribution/json/",
  jsonfeeds: [
    {
      setid: "CV19Pop",
      rootkey: "records",
      subject: "geoId",
      object: "population",
      value: "popData2018",
      filename: "population.json",
    },
    {
       setid:"CV19Dth",
      rootkey: "records",
      subject: "geoId",
      object: "coviddeaths",
      value: "deaths",
      type: "numeric",
      timestamp: "dateRep",
      timestampformat: "DD-MM-YYYY",
    }
  ]
}

```

### Additional Notes

This is a WIP; changes are being made all the time to improve the compatibility across the modules. Please refresh this and the MMM-feedUtilities modules with a `git pull` in the relevant modules folders.

The JSON input must be well formed and capable of being parsed with JSON.parse(). If there are errors generated whilst trying to parse the JSON, there are plenty of on-line tools that can be used to validate the feed and indicate where the issue may occur.

Look out for the correct key name/value name pairs for output purposes and a format for an input timestamp.

/* global Module, MMM-ChartProvider-JSON */

/* Magic Mirror
 * Module: node_helper
 *
 * By Neil Scott
 * MIT Licensed.
 */

const moduleruntime = new Date();

//this loads and formats JSON feeds into NDTF items, depending on its config when called to from the main module
//to minimise activity, it will track what data has been already sent back to the module
//and only send the delta each time, using the timestamp of the JSON data.

//this is done by making a note of the last timestamp data of feeds sent to the module, tracked at the jsonfeed level
//and ignoring anything older than that

//as some feeds wont have a timestamp date, they will be allocated a pseudo timestamp date of the latest timestamp date in the current processed jsonfeeds

//if the module calls a RESET, then the date tracking is reset and all data will be sent (TODO)

var NodeHelper = require("node_helper");
var moment = require("moment");

//pseudo structures for commonality across all modules
//obtained from a helper file of modules

var LOG = require('../MMM-FeedUtilities/LOG');
var QUEUE = require('../MMM-FeedUtilities/queueidea');
var RSS = require('../MMM-FeedUtilities/RSS');

// get required structures and utilities

const structures = require("../MMM-ChartUtilities/structures");
const utilities = require("../MMM-ChartUtilities/common");

const JSONutils = new utilities.JSONutils();
const configutils = new utilities.configutils();

// local variables, held at provider level as this is a common module

var providerstorage = {};

var trackingfeeddates = []; //an array of last date of feed recevied, one for each feed in the feeds index, build from the config
var aFeed = { lastFeedDate: '', feedURL: '' };

var payloadformodule = []; //we send back an array of identified stuff
var payloadstuffitem = { stuffID: '', stuff: '' }

var latestfeedpublisheddate = new Date(0) // set the date so no feeds are filtered, it is stored in providerstorage

module.exports = NodeHelper.create({

	start: function () {
		this.debug = false;
		console.log(this.name + ' node_helper is started!');
		this.logger = {};
		this.logger[null] = LOG.createLogger("logs/logfile_Startup" + ".log", this.name);
		this.queue = new QUEUE.queue("single", false);
	},

	showElapsed: function () {
		endTime = new Date();
		var timeDiff = endTime - startTime; //in ms
		// strip the ms
		timeDiff /= 1000;

		// get seconds 
		var seconds = Math.round(timeDiff);
		return (" " + seconds + " seconds");
	},

	stop: function () {
		console.log("Shutting down node_helper");
		//this.connection.close();
	},

	setconfig: function (moduleinstance, config) {

		if (this.debug) { this.logger[moduleinstance].info("In setconfig: " + moduleinstance + " " + config); }

		//store a local copy so we dont have keep moving it about

		providerstorage[moduleinstance] = { config: config, trackingfeeddates: [] };

		var self = this;

		//process the jsonfeed details into the local tracker

		providerstorage[moduleinstance].config.jsonfeeds.forEach(function (configfeed) {

			var feed = { sourcetitle: '', lastFeedDate: '', latestfeedpublisheddate: new Date(0), feedconfig: configfeed };

			//we add some additional config information for usage in processing the data

			//var jsonfeed = Object.assign({}, paramdefaults, config.params[idx]);

			configfeed["useruntime"] = false;
			configfeed["usenumericoutput"] = false;

			if (configfeed.type == 'numeric') { configfeed["usenumericoutput"] = true; }

			if (typeof configfeed.timestamp == "number") { //wants an offset of the runtime, provided in seconds, or it was blank

				configfeed["useruntime"] = true;
				configfeed["runtime"] = new Date(moduleruntime.getTime() + (configfeed.timestamp * 1000));

			}

			//store the actual timestamp to start filtering, this will change as new feeds are pulled to the latest date of those feeds
			//if no date is available on a feed, then the current latest date of a feed published is allocated to it

			feed.lastFeedDate = self.calcTimestamp(configfeed.oldestage);
			feed.sourcetitle = configfeed.feedtitle;
			feed.feedconfig = configfeed;

			providerstorage[moduleinstance].trackingfeeddates.push(feed);

		});

	},

	calcTimestamp: function (age) {

		//calculate the actual timestamp to use for filtering feeds, 
		//options are timestamp format, today for midnight + 0.0001 seconds today, or age in minutes
		//determine the format of the data in age

		var filterDate = new Date();

		if (typeof (age) == 'number') {

			filterDate = new Date(filterDate.getTime() - (age * 60 * 1000));

		}
		else { //age is hopefully a string ha ha

			if (age.toLowerCase() == 'today') {
				filterDate = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 0, 0, 0, 0)
			}

			else { //we assume the user entered a correct date - we can try some basic validation

				if (moment(age, "YYYY-MM-DD HH:mm:ss", true).isValid()) {
					filterDate = new Date(age);
				}
				else {

					console.log(this.name + " Invalid date provided for filter age of feeds:" + age.toString());
				}

			}
		}

		return filterDate;

	},

	getconfig: function () { return config; },

	socketNotificationReceived: function (notification, payload) {

		var self = this;

		if (this.logger[payload.moduleinstance] == null) {
			this.logger[payload.moduleinstance] = LOG.createLogger("logfile_" + payload.moduleinstance + ".log", payload.moduleinstance);
		};

		if (this.debug) {
			this.logger[payload.moduleinstance].info(this.name + " NODE HELPER notification: " + notification + " - Payload: ");
			this.logger[payload.moduleinstance].info(JSON.stringify(payload));
		}

		//we can receive these messages:
		//
		//RESET: clear any date processing or other so that all available stuff is returned to the module
		//CONFIG: we get our copy of the config to look after
		//UPDATE: request for any MORE stuff that we have not already sent
		//STATUS: show the stored local config for a provider
		//

		switch (notification) {
			case "CONFIG":
				this.setconfig(payload.moduleinstance, payload.config);
				break;
			case "RESET":
				this.reset(payload);
				break;
			case "UPDATE":
				//because we can get some of these in a browser refresh scenario, we check for the
				//local storage before accepting the request

				if (providerstorage[payload.moduleinstance] == null) { break; } //need to sort this out later !!
				this.processfeeds(payload.moduleinstance, payload.providerid);
				break;
			case "STATUS":
				this.showstatus(payload.moduleinstance);
				break;
		}

	},

	processfeeds: function (moduleinstance, providerid) {

		var self = this;
		var feedidx = -1;

		if (this.debug) { this.logger[moduleinstance].info("In processfeeds: " + moduleinstance + " " + providerid); }

		//because we only get one data feed in the chart providers, then we preload the data before letting the jsonfeed actually process it

		//we need to initialise the storage area within the providerstorage.

		this.outputarray = new Array(providerstorage[moduleinstance].config.jsonfeeds.length)// feeds and then items

		for (var cidx = 0; cidx < providerstorage[moduleinstance].config.jsonfeeds.length; cidx++) {

			this.outputarray[cidx] = [];
		}

		//attempt to pull anything back that is valid in terms of a fs ot HTTP recognised locator

		console.error(`Current directory: ${process.cwd()}`);

		var inputjson = JSONutils.getJSON(providerstorage[moduleinstance].config);

		providerstorage[moduleinstance].trackingfeeddates.forEach(function (feed) {

				var jsonarray = inputjson[feed.feedconfig.rootkey];

			//this should now be an array that we can process in the simplest case

			//check it actually contains something, assuming if empty it is in error

			if (jsonarray.length == 0) {
				console.error("json array is empty");
				return;
			}

			if (self.debug) {
				self.logger[moduleinstance].info("In process feed: " + JSON.stringify(feed));
				self.logger[moduleinstance].info("In process feed: " + moduleinstance);
				self.logger[moduleinstance].info("In process feed: " + providerid);
				self.logger[moduleinstance].info("In process feed: " + feedidx);
				self.logger[moduleinstance].info("building queue " + self.queue.queue.length);
			}

			self.queue.addtoqueue(function () { self.processfeed(feed, moduleinstance, providerid, ++feedidx, jsonarray); });

		});
		//even though this is no longer asynchronous we keep the queue just for ease of development

		this.queue.startqueue(providerstorage[moduleinstance].config.waitforqueuetime);
		
	},

	showstatus: function (moduleinstance) {

		console.log('============================ start of status ========================================');

		console.log('config for provider: ' + moduleinstance);

		console.log(providerstorage[moduleinstance].config);

		console.log('feeds for provider: ' + moduleinstance);

		console.log(providerstorage[moduleinstance].trackingfeeddates);

		console.log('============================= end of status =========================================');

	},

	sendNotificationToMasterModule: function (stuff, stuff2) {
		this.sendSocketNotification(stuff, stuff2);
	},

	done: function (err) {

		if (err) {

			console.log(err, err.stack);

		}

	},

	send: function (moduleinstance, providerid, source, feedidx) {

		//wrap the output array in an object so the main module handles it in the same way as if it was a collection of feeds
		//and add an id for tracking purposes and wrap that in an array

		var payloadforprovider = {
			providerid: providerid, source: source, payloadformodule: [{ setid: providerstorage[moduleinstance].trackingfeeddates[feedidx].feedconfig.setid, itemarray: this.outputarray[feedidx] }]
		};

		if (this.debug) {
			this.logger[moduleinstance].info("In send, source, feeds // sending items this time: " + (this.outputarray[feedidx].length > 0));
			this.logger[moduleinstance].info(JSON.stringify(source));
		}

		if (this.outputarray[feedidx].length > 0) {

			this.sendNotificationToMasterModule("UPDATED_STUFF_" + moduleinstance, payloadforprovider);

		}

		// as we have sent it and the important date is stored we can clear the outputarray

		this.outputarray[feedidx] = [];

		this.queue.processended();

	},

	//now to the core of the system, where there are most different to the feedprovider modules
	//we enter this for wach of the jsonfeeds we want to create to send back for later processing

	processfeed: function (feed, moduleinstance, providerid, feedidx, jsonarray) {

		//we process a feed at a time here

		if (this.debug) {
			this.logger[moduleinstance].info("In fetch feed: " + JSON.stringify(feed));
			this.logger[moduleinstance].info("In fetch feed: " + moduleinstance);
			this.logger[moduleinstance].info("In fetch feed: " + providerid);
			this.logger[moduleinstance].info("In fetch feed: " + feedidx);
		}

		//use these in the feedparser area
		var sourcetitle = feed.sourcetitle;

		var self = this;

		var maxfeeddate = new Date(0);
			
		if (new Date(0) < maxfeeddate) {
			providerstorage[moduleinstance].trackingfeeddates[feedidx]['latestfeedpublisheddate'] = maxfeeddate;
		}

		for (var idx = 0; idx < jsonarray.length; idx++) {

			//look for any key value pairs required and create an item
			//ignore any items that are older than the max feed date

				var processthisitem = false;

				var tempitem = new structures.NDTFItem()

				tempitem.object = feed.feedconfig.object;

				//do we have a subject

			if (jsonarray[idx][feed.feedconfig.subject] != null) {

				tempitem.subject = jsonarray[idx][feed.feedconfig.subject];

					//do we have a value

				if (jsonarray[idx][feed.feedconfig.value] != null) {

						//check if numeric 

					if (feed.feedconfig.usenumericoutput) {
						if (isNaN(parseFloat(jsonarray[idx][feed.feedconfig.value]))) {
							console.error("Invalid numeric value: " + jsonarray[idx][feed.feedconfig.value]);
							}
							else {
							tempitem.value = parseFloat(jsonarray[idx][feed.feedconfig.value]);
							}
						}
						else {
						tempitem.value = jsonarray[idx][feed.feedconfig.value];
						}

						//if the timestamp is requested do we have one of those as well

					if (!feed.feedconfig.useruntime) {

							//got a timestamp key, now validate it

						var temptimestamp = jsonarray[idx][feed.feedconfig.timestamp];

							if (temptimestamp != null) {

								if (feed.feedconfig.timestampformat != null) {

									if (moment(temptimestamp, feed.feedconfig.timestampformat).isValid()) {

										//got a good date

										tempitem.timestamp = moment(temptimestamp, feed.feedconfig.timestampformat).toDate();

										processthisitem = true;

									}
									else { console.error("Invalid date"); }

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

						tempitem.timestamp = feed.feedconfig.adjustedruntime;

							processthisitem = true;

						}

					}

				}

				if (maxfeeddate > tempitem.timestamp) { processthisitem = false };

				if (processthisitem) {


					this.outputarray[feedidx].push(tempitem);

				}

				delete tempitem;




		}  //end of process loop - input array

		if (feed.feedconfig.filename == null) {
			console.info(this.outputarray[feedidx].length);
		}
		else {

			// write out to a file

			JSONutils.putJSON("./" + feed.feedconfig.filename, this.outputarray[feedidx]);

			console.info(this.outputarray[feedidx].length);

		}

		var rsssource = new RSS.RSSsource();
		rsssource.sourceiconclass = '';
		rsssource.sourcetitle = feed.sourcetitle;
		rsssource.title = feed.sourcetitle;

		self.send(moduleinstance, providerid, rsssource, feedidx);
		self.done();

	},

});
'use strict';

const Crawler = require('node-webcrawler');
const cheerio = require('cheerio');
const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
const firstPage = 0;


class Collector {

	/**
	 * Initialize a new instance of Collector
	 * @param {string} appId - The app ID to collect reviews for
	 * @param {Object} options - Configuration options for the review collection
	 */
	constructor(apps, options) {
		const defaults = {
			maxPages: 5,
			userAgent: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.85 Safari/537.36',
			delay: 5000,
			maxRetries: 3,
		};
		this.options = _.assign(defaults, options);
		this.apps = {};
		if (_.isArray(apps)) {
			_.forEach(apps, (appId) => {
				if (typeof appId !== 'string') {
					throw new Error('App IDs must be strings');
				}
				this.apps[appId] = {
					appId: appId,
					retries: 0,
					pageNum: firstPage,
				};
			});
		} else if (_.isString(apps)) {
			// 'apps' is a single app ID string
			this.apps[apps] = {
				appId: apps,
				retries: 0,
				pageNum: firstPage,
			};
		} else {
			throw new Error('You must provide either a string or an array for the \'apps\' argument');
		}
		this.emitter = new EventEmitter();
	}

	/**
	 * Collect reviews for the Collector's app using the options provided in the constructor
	 */
	collect() {
		// Preserve our reference to 'this'
		const self = this;
		// Get a list of app IDs
		const appIds = _.keys(self.apps);
		// Keep track of what we're processing
		let currentApp;
		let currentPage;

		// Setup the Crawler instance
		const c = new Crawler({
			maxConnections: 1,
			userAgent: self.options.userAgent,
			followRedirect: true,
			followAllRedirects: true,
			callback: function processRequest(error, result) {
				if (error) {
					console.error(`Could not complete the request: ${error}`);
					requeue();
				} else {
					parse(result);
				}
			},
		});

		// Queue the first app
		processNextApp();

		/**
		 * Collect reviews for the next app in the list (if one exists)
		 */
		function processNextApp() {
			if (appIds.length > 0) {
				currentApp = appIds.shift();
				currentPage = firstPage;
				queuePage();
			} else {
				self.emitter.emit('done with apps');
			}
		}

		/**
		 * Add a page to the Crawler queue to be parsed
		 * @param {number} pageNum - The page number to be collected (0-indexed)
		 */
		function queuePage() {
			// Delay the request for the specified # of milliseconds
			setTimeout(() => {
				const url = `https://play.google.com/store/getreviews?id=${currentApp}&reviewSortOrder=0&reviewType=1&pageNum=${currentPage}`;
				const postData = {
					xhr: '1',
				};
				// Add the url to the Crawler queue
				c.queue({
					uri: url,
					method: 'POST',
					headers: {
						'User-Agent': self.options.userAgent,
						'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
						'Content-Length': formToString(postData).length,
					},
					form: postData,
				});
			}, self.options.delay);
		}

		/**
		 * Parse a reviews page and emit review objects
		 * @param {string} result - The page HTML
		 * @param {number} pageNum - The number of the page that is being parsed
		 */
		function parse(result) {
			const html = responseToHtml(result);
			if (typeof html === 'undefined') {
				// We got an invalid response
				requeue();
			} else if (html === null) {
				// There were no more reviews
				self.emitter.emit('done collecting', {
					appId: currentApp,
					pageNum: currentPage,
				});
			} else if (typeof html === 'string') {
				// We got a valid response, proceed
				const converted = htmlToReviews(html, currentApp, currentPage, self.emitter);
				if (converted.error) {
					console.error(`Could not turn response into reviews: ${converted.error}`);
					requeue();
				} else {
					// Reset retries
					self.apps[currentApp].retries = 0;
					if (converted.reviews.length > 0 &&
						(
							self.options.maxPages === 0 ||
							currentPage + 1 < self.options.maxPages + firstPage
						)
					) {
						continueProcessingApp();
					} else {
						stopProcessingApp();
					}
				}
			}
		}

		/**
		 * Requeue a page if we aren't over the retries limit
		 * @param {number} pageNum - The number of the page to requeue
		 */
		function requeue() {
			self.apps[currentApp].retries++;
			if (self.apps[currentApp].retries < self.options.maxRetries) {
				queuePage();
			} else {
				self.emitter.emit('done collecting', {
					appId: currentApp,
					pageNum: currentPage,
					error: new Error('Retry limit reached'),
				});
			}
		}

		/**
		 * Process the next page of the current app
		 */
		function continueProcessingApp() {
			// Increment currentPage and queue it
			currentPage++;
			queuePage();
		}

		/**
		 * Stop processing the current app and go on to the next app
		 */
		function stopProcessingApp() {
			self.emitter.emit('done collecting', {
				appId: currentApp,
				pageNum: currentPage,
				appsRemaining: appIds.length,
			});
			// Move on to the next app
			processNextApp();
		}
	}

	/**
	 * Attach event handlers to the Collector's event emitter
	 * @param {string} event - The name of the event to listen for
	 * @param {funtion} action - The function to be executed each time this event is emitted
	 */
	on(event, action) {
		this.emitter.on(event, action);
	}

}
module.exports = Collector;

/**
 * Convert HTML extracted from the reviews JSON object into an array of reviews
 * @param {string} html - The HTML extracted via #responseToHtml
 * @param {string} appId - The app ID of the app that the given HTML is from
 * @param {EventEmitter} emitter - The Collector's event emitter
 * @return {Object[]} An array of review objects
 */
function htmlToReviews(html, appId, pageNum, emitter) {
	try {
		const $ = cheerio.load(html);
		const reviewObjs = $('.single-review');
		const reviews = [];
		// Get the reviews
		_.forEach(reviewObjs, (reviewObj) => {
			const review = {};
			const reviewInfo = $(reviewObj).find('.review-info');
			const reviewBody = $(reviewObj).children('.review-body');
			// App Information
			review.appId = appId;
			review.os = 'Android';
			review.device = 'Android';
			review.type = 'review';
			// Review ID
			const id = $(reviewObj).children('.review-header').attr('data-reviewid');
			review.id = id;
			// Review Date
			const dateStr = $(reviewInfo).children('.review-date').text();
			review.date = new Date(dateStr);
			// Review Rating
			const ratingStr = $(reviewInfo).find('.current-rating').attr('style');
			const widthRegex = /width: ([0-9]{2,3})%/;
			review.rating = Number(widthRegex.exec(ratingStr)[1]) / 20;
			// Review Title
			review.title = $(reviewBody).children('.review-title').text().trim();
			// Review Text
			review.text = $(reviewBody)
				.clone()
				.children()
				.remove()
				.end()
				.text()
				.trim();
			// Add it to our reviews array
			reviews.push(review);
			// Let our listener(s) know
			emitter.emit('review', {
				appId: appId,
				pageNum: pageNum,
				review: review,
			});
		});
		// Let our listener(s) know we finished a page
		emitter.emit('page complete', {
			appId: appId,
			pageNum: pageNum,
			reviews: reviews,
		});
		// Return our reviews
		return { reviews: reviews };
	} catch (err) {
		return { error: err };
	}
}

/**
 * Extract the HTML from the HTTP request's response
 * @param {Object} response - the response returned from the HTTP requesy
 * @return {string|null|undefined} String if response was valid, null if no reviews, undefined if invalid response
 */
function responseToHtml(response) {
	if (response.headers['content-type'] === 'application/json; charset=utf-8') {
		try {
			const decoded = decodeUnicode(decodeUTF8(response.body));
			const body = JSON.parse(removeLeadingChars(decoded));
			if (_.isArray(body) && body.length > 0) {
				const arr = body[0];
				if (_.isArray(arr) && arr.length === 4) {
					return arr[2];
				}
				console.log('No more reviews for this app');
				return null;
			}
			console.error('Unexpected response - JSON was not in the format we expected');
			return undefined;
		} catch (err) {
			console.error('Unexpected response - JSON was invalid');
			return undefined;
		}
	}
	console.error('Unexpected response - was not in JSON format');
	return undefined;
}

/**
 * Helper function to get rid of the extraneous characters at the beginning of the response
 * @param {string} str - The response string to remove the characters from
 * @return {string} - The string with the leading characters removed
 */
function removeLeadingChars(str) {
	const firstCharAt = str.indexOf('[');
	return str.substring(firstCharAt, str.length);
}

/**
 * Helper function to turn a form object into a URL-encoded string
 * @param {Object} form - The object to be converted
 * @return {[type]} The URL-encoded string
 */
function formToString(form) {
	const keys = Object.keys(form);
	let str = '';
	let i;
	for (i = 0; i < keys.length; i++) {
		if (i > 0) {
			str += '&';
		}
		str += `${encodeURIComponent(keys[i])}=${encodeURIComponent(form[keys[i]])}`;
	}
	return str;
}

/**
 * Helper function to decode a string to unicode
 * @param {string} str - The string to be decoded
 * @return {string} The resultant unicode string
 */
function decodeUnicode(str) {
	if (str) {
		const patt = /\\u([\d\w]{4})/gi;
		return str.replace(patt, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
	}
}

/**
 * Helper function to decode a unicode string to UTF8
 * @param {string} str - The string to be decoded
 * @return {string} The resultant UTF8 string
 */
function decodeUTF8(str) {
	try {
		const encoded = escape(str);
		return decodeURIComponent(encoded);
	} catch (err) {
		return str;
	}
}

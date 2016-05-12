'use strict';

const Crawler = require('node-webcrawler');
const cheerio = require('cheerio');
const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;


class Collector {

	/**
	 * Initialize a new instance of Collector
	 * @param {string} appId - The app ID to collect reviews for
	 * @param {Object} options - Configuration options for the review collection
	 */
	constructor(appId, options) {
		const defaults = {
			maxPages: 5,
			userAgent: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.85 Safari/537.36',
			delay: 5000,
			maxRetries: 3,
		};
		this.options = _.assign(defaults, options);
		this.appId = appId;
		this.emitter = new EventEmitter();
		this.retries = 0;
	}

	/**
	 * Collect reviews for the Collector's app using the options provided in the constructor
	 */
	collect() {
		// Preserve our reference to 'this'
		const self = this;

		// Setup the Crawler instance
		const c = new Crawler({
			maxConnections: 1,
			rateLimits: self.options.delay,
			followRedirect: true,
			followAllRedirects: true,
			callback: function processRequest(error, result) {
				if (error) {
					console.error(`Could not complete the request: ${error}`);
					requeue(result.options.pageNum);
				} else {
					parse(result, result.options.pageNum);
				}
			},
		});

		// Queue the first page
		queue(0);

		/**
		 * Add a page to the Crawler queue to be parsed
		 * @param {number} pageNum - The page number to be collected (0-indexed)
		 */
		function queue(pageNum) {
			const url = `https://play.google.com/store/getreviews?id=${self.appId}&reviewSortOrder=0&reviewType=1&pageNum=${pageNum}`;
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
				pageNum: pageNum,
			});
		}

		/**
		 * Parse a reviews page and emit review objects
		 * @param {string} result - The page HTML
		 * @param {number} pageNum - The number of the page that is being parsed
		 */
		function parse(result, pageNum) {
			const html = responseToHtml(result);
			if (typeof html === 'undefined') {
				// We got an invalid response
				requeue(pageNum);
			} else if (html === null) {
				// There were no more reviews
				self.emitter.emit('done collecting', null);
			} else if (typeof html === 'string') {
				// We got a valid response, proceed
				try {
					const $ = cheerio.load(html);
					const reviewObjs = $('.single-review');
					let i;
					// Get the reviews
					for (i = 0; i < reviewObjs.length; i++) {
						const review = {};
						const reviewObj = $(reviewObjs[i]);
						const reviewInfo = $(reviewObj).find('.review-info');
						const reviewBody = $(reviewObj).children('.review-body');
						// App Information
						review.appId = self.appId;
						review.appName = 'tbd';
						review.os = 'Android';
						review.device = 'Android';
						review.type = 'review';
						// Review ID
						const id = reviewObj.children('.review-header').attr('data-reviewid');
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
							.contents()
							.filter(function getNodeText() {
								return this.nodeType === 3;
							})[0]
							.nodeValue;
						// Review Version
						review.version = 'Unknown';

						// Let our listener(s) know
						self.emitter.emit('review', review);
					}
					// Reset retries
					self.retries = 0;
					// Queue the next page if we're allowed
					const nextPage = pageNum + 1;
					if (nextPage < self.options.maxPages - 1) {
						queue(nextPage);
					}
				} catch (err) {
					console.error(`Could not turn response into reviews: ${err}`);
					requeue(pageNum);
				}
			}
		}

		/**
		 * Requeue a page if we aren't over the retries limit
		 * @param {number} pageNum - The number of the page to requeue
		 */
		function requeue(pageNum) {
			self.retries++;
			if (self.retries < self.options.maxRetries) {
				queue(pageNum);
			} else {
				self.emitter.emit('done collecting', new Error('Retry limit reached'));
			}
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
 * Extract the HTML from the HTTP request's response
 * @param {Object} response - the response returned from the HTTP requesy
 * @return {string|null|undefined} String if response was valid, null if no reviews, undefined if invalid response
 */
function responseToHtml(response) {
	if (response.headers['content-type'] === 'application/json; charset=utf-8') {
		const body = response.body;
		if (_.isArray(body) && body.length > 0) {
			const arr = body[0];
			if (_.isArray(arr) && arr.length === 4) {
				return arr[2];
			}
			console.error('No more reviews for this app');
			return null;
		}
		console.error('Unexpected response - JSON was not in the format we expected');
		return undefined;
	}
	console.error('Unexpected response - was not in JSON format');
	return undefined;
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
		str += `${keys[i]}=${form[keys[i]]}`;
	}
	return str;
}

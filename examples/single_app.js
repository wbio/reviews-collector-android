'use strict';

const Collector = require('../lib/index.js');

// Collect reviews for one app (Facebook) and go a maximum of 2 pages
const collector = new Collector('com.facebook.katana', { maxPages: 2 });

// Report the star rating of each review
collector.on('review', (result) => {
	console.log(`Found a ${result.review.rating} star rating on page ${result.pageNum}`);
});

// Exit after we're done with the app
collector.on('done collecting', (result) => {
	if (result.error) {
		console.error(`Finished collecting reviews due to error: ${result.error}`);
	} else {
		console.log(`Finished collecting reviews after page ${result.pageNum}`);
	}
	process.exit();
});

// Count the number of reviews on each page
collector.on('page complete', (result) => {
	console.log(`Found ${result.reviews.length} reviews on page ${result.pageNum}`);
});

// Start collecting
collector.collect();

'use strict';

const Collector = require('../lib/index.js');

// Collect reviews for two apps (Instagram and Facebook) and go a maximum of 2 pages
const collector = new Collector(
	[
		'com.instagram.android',
		'com.facebook.katana'
	],
	{ maxPages: 2 }
);

// Report the star rating of each review and which app it is for
collector.on('review', (result) => {
	console.log(`Found a ${result.review.rating} star rating for ${result.appId} on page ${result.pageNum}`);
});

// Report when we finish processing reviews for an app and tell us how many apps are left to process
collector.on('done collecting', (result) => {
	if (result.error) {
		console.error(`Finished collecting for ${result.appId} due to error: ${result.error}, with ${result.appsRemaining} apps to go`);
	} else {
		console.log(`Finished collecting for ${result.appId} after page ${result.pageNum}, with ${result.appsRemaining} apps to go`);
	}
});

// Let us know we have no more apps and exit the process
collector.on('done with apps', () => {
	console.log('Finished collecting for all of the apps');
	process.exit();
});

// Count the number of reviews on each page
collector.on('page complete', (result) => {
	console.log(`Found ${result.reviews.length} reviews on page ${result.pageNum} of ${result.appId}`);
});

// Start collecting
collector.collect();

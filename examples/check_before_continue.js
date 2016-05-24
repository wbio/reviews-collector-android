'use strict';

const Collector = require('../lib/index.js');

// Collect reviews for two apps (Instagram and Facebook) and let us decide after each page if we should continue
const collector = new Collector(
	[
		'com.instagram.android',
		'com.facebook.katana'
	],
	{ checkBeforeContine: true }
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

// Determine the date of today - 2 days
const now = new Date();
const twoDaysAgo = now.setDate(now.getDate() - 2);

// Decide whether or not we should keep collecting reviews for this app by determining if any reviews are more than 2 days old
collector.on('page complete', (result) => {
	let stopProcessingThisApp = false;
	let i;
	// Cycle through all of the reviews to check their dates
	for (i = 0; i < result.reviews.length; i++) {
		const review = result.reviews[i];
		// If the review is more than two days old, we should not process any more reviews for this app
		if (review.date < twoDaysAgo) {
			stopProcessingThisApp = true;
			break;
		}
	}
	// Now, tell the collector what we've decided
	if (stopProcessingThisApp) {
		// Tell the collector to stop processing this app
		console.log(`Stop collecting reviews for ${result.appId}`);
		result.stop();
	} else {
		// The the collector to continue processing reviews for this app
		console.log(`Keep collecting reviews for ${result.appId}`);
		result.continue();
	}
});

// Start collecting
collector.collect();

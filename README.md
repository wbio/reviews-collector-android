# reviews-collector-android
[![Build Status](https://travis-ci.org/wbio/reviews-collector-android.svg?branch=master)](https://travis-ci.org/wbio/reviews-collector-android)
[![Code Climate](https://codeclimate.com/github/wbio/reviews-collector-android/badges/gpa.svg)](https://codeclimate.com/github/wbio/reviews-collector-android)

---

## Getting Started

```javascript
// Create our Collector
var Collector = require('reviews-collector-android');
// Create an instance of Collector to get reviews of Google Maps and only parse 2 pages max
var collector = new Collector('com.google.android.apps.gmoney', { maxPages: 2 });

// Do something when we parse a review
collector.on('review', (result) => {
	console.log(`Found a ${result.review.rating} star review`);
});

// Do something when we finish parsing a page of reviews
collector.on('page complete', (result) => {
	console.log(`Finished page ${result.pageNum} and found ${result.reviews.length} reviews`);
});

// Do something when we are done parsing
collector.on('done collecting', (result) => {
	if (result.error) {
		console.error('Stopped collecting because something went wrong');
	} else {
		console.log(`Finished collecting reviews for ${result.appId}`);
	}
});

// Start collecting reviews
collector.collect();
```

## Instantiating
First, create a `Collector` prototype by requiring `reviews-collector-android`

```javascript
var Collector = require('reviews-collector-android');
```

Next, create an `Collector` instance using the `new` keyword and passing an app ID and an options object

```javascript
var collector = new Collector('com.google.android.apps.gmoney', { maxPages: 2 });
```

Where the arguments are:

- `App ID`: The portion after the `id=` section of the URL in the Google Play Store (e.g. the app ID for this URL - `https://play.google.com/store/apps/details?id=com.google.android.apps.maps&hl=en` - would be `com.google.android.apps.maps`)
- `Options`: An object with any (or none) of the following properties:
  - `maxPages` *(Default 5)*: The maximum number of pages of reviews to parse. Use 0 for unlimited
  - `userAgent` *(Default Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.85 Safari/537.36)*: The user agent string to use when making requests
  - `delay` *(Default 5000)*: The delay (in milliseconds) between page requests
  - `maxRetries` *(Default 3)*: The maximum number of times to retry a page that could not be parsed before giving up


## Listening for Events
Several events are triggered as the Collector parses reviews. You can setup event listeners for these using:

```javascript
collector.on('<EVENT NAME>', function (result) {
	// Do something with the result every time the event is fired
});
```

Where the event name is one of:

- `review`
  - Fires when: A review is parsed from the page
  - Emits:

    ```javascript
	{
		appId: '<APP_ID>',
		pageNum: '<PAGE_NUMBER>',
		review: { /* Review object */ }
	}
    ```
- `page complete`
  - Fires when: A page of reviews has been parsed
  - Emits:

    ```javascript
	{
		appId: '<APP_ID>',
		pageNum: '<PAGE_NUMBER>',
		reviews: [ /* Review objects */ ]
	}
    ```
- `done collecting`
  - Fires when: One of the following happens:
     - The collector's `maxPages` limit is reached
     - The collector reaches the last page of reviews for the app
     - The collector's `maxRetries` limit is reached
  - Emits:

    ```javascript
	{
		appId: '<APP_ID>',
		pageNum: '<PAGE_NUMBER>',
		error: undefined || { /* Error object */ }
	}
    ```


## Starting the Collector
Once you have created an instance of Collector and setup your event listeners, you can begin the collection process using:

```javascript
collector.collect();
```

The Collector will then collect reviews until it reaches one of the stop points described in the `done collecting` event (see above)


## To Do:

- Use request instead of node-webcrawler
- Allow for multiple app IDs in a single Collector (create a map of appIDs + emit the appId)
- Allow user to determine whether or not to keep going after each page (if desired)
- Move these to GitHub Issues

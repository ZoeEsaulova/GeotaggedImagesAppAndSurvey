/* Database schema for surevy results*/

var mongoose = require('mongoose');
var mongooseToCsv = require('mongoose-to-csv');

var testImageSchema = mongoose.Schema({
	name: { type: String },
	test: Number,
	GPSLatitudeRef: String,
	GPSLatitude: Number,
	GPSLongitudeRef: String,
	GPSLongitude: Number, 
	GPSImgDirection: Number,
	focalLength: Number,
	familiarPlace: Number,
	directionFromUser: Number,
	markedObjectId: String,
	objectCoordsOnImage: String,
	centerCoordsOnMap: String,
	imageSize: String,
	directionFromObject: Number,
	polygonCoords: [],
	time: Number,
	temp: String,
	entry: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry' }
});

testImageSchema.plugin(mongooseToCsv, {
  headers: 'ID EntryId Name test GPSLatitudeRef GPSLatitude GPSLongitudeRef GPSLongitude GPSImgDirection focalLength familiarPlace directionFromUser markedObjectId objectCoordsOnImage centerCoordsOnMap_x centerCoordsOnMap_y imageSize directionFromObject polygonCoords time',
  constraints: {
  	'EntryId': 'entry',
    'Name': 'name',
	"test": "test",
	"GPSLatitudeRef": "GPSLatitudeRef",
	"GPSLatitude": "GPSLatitude",
	"GPSLongitudeRef": "GPSLongitudeRef",
	"GPSLongitude": "GPSLongitude", 
	"GPSImgDirection": "GPSImgDirection",
	"focalLength": "focalLength",
	"familiarPlace": "familiarPlace",
	"directionFromUser": "directionFromUser",
	"markedObjectId": "markedObjectId",
	"objectCoordsOnImage": "objectCoordsOnImage",
	"imageSize": "imageSize",
	"directionFromObject": "directionFromObject",
	"polygonCoords": "polygonCoords",
	"time": "time"
  },
  virtuals: {
    'centerCoordsOnMap_x': function(doc) {
    	if (doc.centerCoordsOnMap!=undefined) {
    		return JSON.parse(doc.centerCoordsOnMap)[0].x
    	} else {
    		return undefined
    	}
      
    },
    'centerCoordsOnMap_y': function(doc) {
      if (doc.centerCoordsOnMap!=undefined) {
    		return JSON.parse(doc.centerCoordsOnMap)[0].y
    	} else {
    		return undefined
    	}
    },
    'ID': function(doc) {
		return doc._id	
    }
  }
});

module.exports = mongoose.model('TestImage', testImageSchema);
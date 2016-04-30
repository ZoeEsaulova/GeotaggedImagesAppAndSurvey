/* Database schema for survey results*/

var mongoose = require('mongoose');
var mongooseToCsv = require('mongoose-to-csv');

var entrySchema = mongoose.Schema({
	name: String, 
	age: Number,
	sex: String,
	selfRating: Number, //result of the sense-of-direction test
	sot: [ Number ], //result of the sot test
	sotTime: String,
	test1: { 
		images: [ { type: mongoose.Schema.Types.ObjectId, ref: 'TestImage' } ],
		easy: Number,
		quickly: Number,
		comfortable: Number,
		difficult: String,
		like: String,
		dislike: String
	},
	test2: {
		images: [ { type: mongoose.Schema.Types.ObjectId, ref: 'TestImage' } ],
		easy: Number,
		quickly: Number,
		comfortable: Number,
		difficult: String,
		like: String,
		dislike: String
	},
	temp: String,
	test1Time: Number,
	test2Time: Number,
	test1Result: Number,
	test2Result: Number
});

entrySchema.virtual('sotMeanError').get(function () {
	var result = [ 123, 237, 83, 156, 319, 235, 333, 260, 280, 48, 26, 150 ]
	var diffSum = 0
	for (j = 0; j<this.sot.length; j++) {
		var diff = Math.abs(this.sot[j]-result[j])
		if (diff>180) {
            diff = 360-diff
        }
        diffSum = diffSum + diff
     }
  	return diffSum/this.sot.length
})

// save all data in a .csv file
entrySchema.plugin(mongooseToCsv, {
  headers: 'ID Name test1_difficult test1_like test1_dislike test2_difficult test2_like test2_dislike',
  constraints: {
    'Name': 'name',
  },
  virtuals: {
    'ID': function(doc) {
		return doc._id	
    },
    'test1_difficult': function(doc) {
		return doc.test1.difficult
    },
    'test1_like': function(doc) {
		return doc.test1.like	
    },
    'test1_dislike': function(doc) {
		return doc.test1.dislike
    },
    'test2_difficult': function(doc) {
		return doc.test2.difficult
    },
    'test2_like': function(doc) {
		return doc.test2.like	
    },
    'test2_dislike': function(doc) {
		return doc.test2.dislike
    },
}
})


entrySchema.set('toJSON', { virtuals: true });
entrySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Entry', entrySchema);
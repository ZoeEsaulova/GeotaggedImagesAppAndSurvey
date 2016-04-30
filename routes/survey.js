//include all nedded packages and models 
var express = require('express');
var async = require('async');
var router = express.Router();
var MyImage = require('../models/image');
var Entry = require('../models/entry');
var MyTestImage = require('../models/testImage');
var Entry = require('../models/entry');
var multer = require('multer');
var fs = require('fs');
router.use(multer({ dest: './public/images', inMemory: true }).single('image'));
var im = require('imagemagick');
var gm = require('gm').subClass({ imageMagick: true });
var dms2dec = require('dms2dec');
var request = require('request');
var orb = require('orbjs'); 
var LatLon = require('geodesy').LatLonEllipsoidal;
var Dms = require('geodesy').Dms; 
var exif = require('exif-reader');
var turf = require('turf');
var gju = require('geojson-utils');
var po = require('poly-overlap');
var reproject = require('reproject-spherical-mercator');
var merc = require('mercator-projection');
var proj4 = require('proj4');
var tools = require('./tools');

/*
*
* Survey
*
*/

/* Survey welcome page */
router.get('/welcome', function(req, res) {
  res.render('survey_welcome.ejs');
})

/* The first form, sense-of-direction test */
router.get('/welcome/form', function(req, res) {
  res.render('survey_welcome_2.ejs');
})

/* Submit the first form */
router.post('/submitForm', function(req, res) {
  var entry = new Entry({ 
    name: req.body.inputName,
    age: Number(req.body.inputAge),
    sex: req.body.sex,
    selfRating: (Number(req.body.directions)+Number(req.body.poor)+Number(req.body.distances)+Number(req.body.sense)+
      Number(req.body.cardinal)+Number(req.body.lost)+Number(req.body.reading)+Number(req.body.understanding)+Number(req.body.good)+
      Number(req.body.routes)+Number(req.body.enjoy)+Number(req.body.where)+Number(req.body.navigational)+Number(req.body.once)+
      Number(req.body.environment))/15
  })
  entry.save(function (err) {
    if (err) return console.error("Database error: " + err)
  })
  var entryId = entry._id
  res.redirect('/survey/part1/' + entryId);
})

/* Part 1 welcome page */
router.get('/part1/:entryId?', function(req, res) {
  res.render('part1.ejs', {
    entryId: req.params.entryId
  })
})

/* Spatial Orientation Test: welcome page*/
router.get('/part1/start/:entryId?', function(req, res) {
  res.render('sot.ejs', {
    entryId: req.params.entryId
  });
});

/* Proceed Spatial Orientation Test */
router.get('/part1/next/:entryId?', function(req, res) {
  //save the result
  Entry.findOne({ _id: req.params.entryId }).exec(function(err, entry) {
    entry.sot.push(Number(req.query.angle))
    var timeSplit = req.query.time.split(":")
    entry.sotTime = 300-(Number(timeSplit[2])+(Number(timeSplit[1])*60))
    entry.save()

  })
  var objects = ['car', 'traffic light', 'stop sign', 'cat', 'tree', 'house', 'flower']
  var obs = []
  var number = Number(req.query.number) +1
  if (number==2) {
    obs.push('cat')
    obs.push('tree')
    obs.push('car')
  } else if (number==3) {
    obs.push('stop sign')
    obs.push('cat')
    obs.push('house')
  } else if (number==4) {
    obs.push('cat')
    obs.push('flower')
    obs.push('car')
  } else if (number==5) {
    obs.push('stop sign')
    obs.push('tree')
    obs.push('traffic light')
  } else if (number==6) {
    obs.push('stop sign')
    obs.push('flower')
    obs.push('car')
  } else if (number==7) {
    obs.push('traffic light')
    obs.push('house')
    obs.push('flower')
  } else if (number==8) {
    obs.push('house')
    obs.push('flower')
    obs.push('stop sign')
  } else if (number==9) {
    obs.push('car')
    obs.push('stop sign')
    obs.push('tree')
  } else if (number==10) {
    obs.push('traffic light')
    obs.push('cat')
    obs.push('car')
  } else if (number==11) {
    obs.push('tree')
    obs.push('flower')
    obs.push('house')
  } else if (number==12) {
    obs.push('cat')
    obs.push('house')
    obs.push('traffic light')
  } else if (number==13) {
    number = "finish"
    obs.push('')
    obs.push('')
    obs.push('')
    finish = true
  }
  res.send({
    number: number,
    ob1: obs[0],
    ob2: obs[1],
    ob3: obs[2],
    entryId: req.params.entryId
  }) 
})


/* Get Part 2 welcome page */
router.get('/part2/:entryId?', function(req, res) {
  res.render('part2.ejs', {
    entryId: req.params.entryId
  });
});


/* GET Part 2 first page */
router.get('/part2/first/:entryId?', function(req, res) {
  var names = [
    126807944,
    126910529,
    571,
    101,
    127678387,
    127678395,
    127678412,
    127678439,
    651,
    127682806
  ]
  var x = Math.floor((Math.random() * 10));
  var buf = fs.readFileSync('/root//Bachelor/public/images/' + names[x] + ".jpg");      
  var parser = require('exif-parser').create(buf);
  var result = parser.parse();
  var dec = [ result.tags.GPSLatitude, result.tags.GPSLongitude ]
  var focalLength = result.tags.FocalLength
  var sensorWidth = 6.17
  //Calculate FOV
  var fov = tools.radToDegree(2*Math.atan(0.5*sensorWidth/Number(focalLength)))
  
  res.render('home_for_survey.ejs', { 
    coordsString: 'Home page', 
    imageSource:"http://a-rommel.de/" + names[x] + ".jpg",
    properties: JSON.stringify(dec),
    nextImage: x,
    image: 1,
    showBuilding: false,
    test: "1",
    all: "false",
    modal: false,
    entryId: req.params.entryId,
    fov: fov
  })
})

/* Display demo videos */
router.get('/demo/:test?', function(req, res) {
  if (req.params.test=="1") {
    var url = "http://www.youtube.com/embed/pM9I-g8hwUI?autoplay=0"
  } else if (req.params.test=="2") {
    var url = "http://www.youtube.com/embed/X8S7mzNeGD0?autoplay=0"
  } 
  res.render("demo.ejs", { 
    url: url
  }) 
})

/* Get the last page */
router.get('/thanks', function(req, res) {
  res.render('thanks.ejs');
});

module.exports = router;
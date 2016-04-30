//include all nedded packages and models 
var express = require('express');
var async = require('async');
var router = express.Router();
var MyImage = require('../models/image');
var MyTestImage = require('../models/testImage');
var MySurveyImage = require('../models/surveyimage');
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
var countImages = 1

/**
* Get input from client and send calculated polygon coordinates 
*/
router.get('/showPolygon', function(req, res) {
  //get map rotation in radians and convert it to degrees
  var r = 360-Number(tools.radToDegree(req.query.mapRotation))
  //get gps coordinates of the image
  var originLat = Number(JSON.parse(req.query.origin)[0])
  var originLon = Number(JSON.parse(req.query.origin)[1])
  // read exif data of a current image
  var buf = fs.readFileSync('/root/Bachelor/public' + req.query.imagePath);      
  var parser = require('exif-parser').create(buf);
  var result = parser.parse();
  var focalLength = result.tags.FocalLength
  var sensorWidth = 6.17
  //calculate FOV
  var fov = 2*Math.atan(0.5*sensorWidth/Number(focalLength))
  //if only building(s) are defined by user
  if (req.query.objectCoordsMap!="y" && req.query.modalCameraRotation=="t") {
    var result = tools.findPolygonFromObject(fov, originLat, originLon, req.query.imageSize, req.query.objectCoords, req.query.objectCoordsMap)
  //if only rotation is defined by user
  } else if (req.query.modalCameraRotation=="f" && req.query.objectCoordsMap=="y") {
    var result = tools.findPolygonFromRotation(fov, req.query.mapRotation, originLat, originLon, focalLength)
  //if rotation and building(s) are defined by user
  } else if (req.query.modalCameraRotation=="f" && req.query.objectCoordsMap!="y") {
    var result = tools.findPolygonFromRotationAndObject(
      fov, req.query.mapRotation, 
      originLat, originLon, req.query.imageSize, 
      req.query.objectCoords, req.query.objectCoordsMap)
  } 
  //send the coordinates of the polygon
  res.send({ 
    polygonCoords: JSON.stringify(result)
  })
})

/**
* Get input from the client, define polygon coordinates, rotation and displayed buildings
* and save all data in a database
*/
router.post('/submitToDatabase', function(req, res) {

  var focalLength = 0
  var fov = 0
  //get map rotation in radians and convert it to degrees
  var r = 360-Number(tools.radToDegree(req.body.mapRotation))
  //get image data
  var originLat = Number(JSON.parse(req.body.origin)[0])
  var originLon = Number(JSON.parse(req.body.origin)[1])
  var imageId = req.params.imageId
  var buf = fs.readFileSync('/root/Bachelor/public' + req.body.imagePath);      
  var parser = require('exif-parser').create(buf);
  var result = parser.parse();
  focalLength = Number(result.tags.FocalLength)
  var sensorWidth = 6.17
  //calculate FOV
  fov = 2*Math.atan(0.5*sensorWidth/Number(focalLength))
  //set new image name
  var imageNameOrder = countImages+5
  countImages = imageNameOrder
  imageNameOrder = imageNameOrder.toString()
  //move the image to another folder
  fs.rename('/root/Bachelor/public' + req.body.imagePath, '/var/www/html/'+ imageNameOrder + '.jpg', function(error) {
    if (error) {
      MyImage.find({}).exec(function(err,images) {
        if (err) {
          error = error + ", no images found"
        } 
        res.render('home.ejs', { 
          error: error + ".",
          coordsString: 'Home page', 
          properties: "[51.964045, 7.609542]",
          imageData: JSON.stringify(images)
        })
      }) 
     return 
    }
    
  })
  //if only one building is defined by user
  if (req.body.objectCoordsMap!="y" && req.body.modalCameraRotation=="t" && req.body.multipleObjects!="Yes" ) {
    //find coordinates of the camera viewing area
    var result = tools.findPolygonFromObject(fov, originLat, originLon, req.body.imageSize, req.body.objectCoords, req.body.objectCoordsMap)
  //if only rotation is defined by user
  } else if (req.body.modalCameraRotation=="f" && req.body.objectCoordsMap=="y") {
    //find coordinates of the camera viewing area
    var result = tools.findPolygonFromRotation(fov, req.body.mapRotation, originLat, originLon, focalLength)
  //if rotation and one building are defined by user
  } else if (req.body.modalCameraRotation=="f" && req.body.objectCoordsMap!="y" && req.body.multipleObjects!="Yes") {
    //find coordinates of the camera viewing area
    var result = tools.findPolygonFromRotationAndObject(
      fov, req.body.mapRotation, 
      originLat, originLon, req.body.imageSize, 
      req.body.objectCoords, req.body.objectCoordsMap)
  //if rotation and multiple buildings are defined by user
  } else if (req.body.multipleObjects=="Yes" && req.body.modalCameraRotation=="f") {
    //save image to db
    var image = new MyImage({ 
        name: imageNameOrder,
        path: '/root/Bachelor/public/db/images/' + imageNameOrder + '.jpg',
        coords: [ Number(originLat), Number(originLon) ],
        direction: 360-tools.radToDegree(Number(req.body.mapRotation)),
        buildings: JSON.parse(req.body.selectedBuildings)
    })
    image.save(function (error) {
      if (error) 
       MyImage.find({}).exec(function(err,images) {
        if (err) {
          error = error + ", no images found"
        } 
        res.render('home.ejs', { 
          error: error + ".",
          coordsString: 'Home page', 
          properties: "[51.964045, 7.609542]",
          imageData: JSON.stringify(images)
        })
      }) 
     return
    })
    //go to the home page
    res.redirect("/")
  //if only buildings are defined by user     
  } else if (req.body.multipleObjects=="Yes" && req.body.modalCameraRotation=="t") {
    //get building coordinates
    var parsed = JSON.parse(req.body.objectCoordsMap)
    var targetLat = Number(parsed[0].x)
    var targetLon = Number(parsed[0].y)
    //save image in db
    var image = new MyImage({ 
      name: imageNameOrder,
      path: '/root/Bachelor/public/db/images/' + imageNameOrder + '.jpg',
      coords: [ Number(originLat), Number(originLon) ],
      direction: Number(tools.findRotationFromTarget(targetLat, targetLon, originLat, originLon)),
      buildings: JSON.parse(req.body.selectedBuildings)
    })
     image.save(function (error) {
      if (error) 
       MyImage.find({}).exec(function(err,images) {
        if (err) {
          error = error + ", no images found"
        } 
        res.render('home.ejs', { 
          error: error + ".",
          coordsString: 'Home page', 
          properties: "[51.964045, 7.609542]",
          imageData: JSON.stringify(images)
        })
      }) 
     return
    })
    //go to the home page
    res.redirect("/")
  }
  // Transform coordinates from EPSG:4326 to EPSG:3857 
  var point1 = [ Number(result[0][0].originLat), Number(result[0][0].originLon) ]
  var point2 = [ Number(result[0][0].leftLat), Number(result[0][0].leftLon) ]
  var point3 = [ Number(result[0][0].rightLat), Number(result[0][0].rightLon) ]
  var point4 = [ Number(result[0][0].originLat), Number(result[0][0].originLon) ]
  var coords = []
  coords.push(point1)
  coords.push(point2)
  coords.push(point3)
  coords.push(point4)
  var polygon = ""
  for (x in coords) {
    var mercator = proj4(proj4('EPSG:3857'), proj4('EPSG:4326'), coords[x])
    polygon = polygon + mercator[1] + " " + mercator[0] + " "
  }
  // send overpass request 
  var latlon = ""
  var radius = "100"
  var data = 'way(poly:"' + polygon + '")["building"];'
  var url = 'http://overpass-api.de/api/interpreter?data=[out:json];' + data + 'out geom;';
  request(
    { method: 'GET'
    , uri: url
    , gzip: true
    , lalon: latlon
    , polygon: polygon
    , imageId: imageId
    }
    , function (error, response, body) { 
      //get overpass response
      var bodyString = body
      //find viewable buildings
      var buildings = tools.findViewableBuildings(polygon, body, latlon)
      //save image in db
      var image = new MyImage({ 
        name: imageNameOrder,
        path: '/root/Bachelor/public/db/images/' + imageNameOrder + '.jpg',
        coords: [ Number(originLat), Number(originLon) ],
        direction: Number(result[1]),
        buildings: buildings
      })
       image.save(function (error) {
        if (error) 
         MyImage.find({}).exec(function(err,images) {
          if (err) {
            error = error + ", no images found"
          } 
          res.render('home.ejs', { 
            error: error + ".",
            coordsString: 'Home page', 
            properties: "[51.964045, 7.609542]",
            imageData: JSON.stringify(images)
          })
        }) 
       return
      })
      //go to the home page
      res.redirect("/") 
    }
  )
})


/* Render the home page */
router.get('/', function(req, res) {
  //put all data from database to .csv files
  Entry.findAndStreamCsv({}).pipe(fs.createWriteStream('entries.csv'));
  MyTestImage.findAndStreamCsv({}).pipe(fs.createWriteStream('test_images.csv'));
  // Find saved images and send them to the client
  MyImage.find({}).exec(function(err,images) {
    var error = "0"
    if (err) {
      error = "No images found"
    } 
    res.render('home.ejs', { 
      error: error + ".",
      coordsString: 'Home page', 
      properties: "[51.964045, 7.609542]",
      imageData: JSON.stringify(images)
    })
  })     
})

/* Get nodes, ways and relations inside a triangle polygon or within a certain radius*/
router.post('/overpass', function(req, res) {
  var latlon = ""
  var polygon = ""
  var radius = "100"
  //if polygon coords are available
  /*if (req.body.polyCoords!="x") {
    //create a data query
    var polygon = req.body.polyCoords
    var data = 'way(poly:"' + polygon + '")["building"];'   
  //if no polygon coords are available
  } else {*/
    //create a data query
    radius = req.body.radius
    var latlon = req.body.properties.slice(1, req.body.properties.length-1)
    var data = 'way(around:' + radius + ',' + latlon +  ')["building"];'
  //}
  var url = 'http://overpass-api.de/api/interpreter?data=[out:json];' + data + 'out geom;'
  //send request to the Overpass API
  request(
      { method: 'GET'
      , uri: url
      , gzip: true
      , lalon: latlon
      , polygon: polygon
      }
    , function (error, response, body) { 
      if (error) {
         MyImage.find({}).exec(function(err,images) {
            if (err) {
              error = error + ", no images found"
            } 
            res.render('home.ejs', { 
              error: error + ".",
              coordsString: 'Home page', 
              properties: "[51.964045, 7.609542]",
              imageData: JSON.stringify(images)
            })
          }) 
        return
      } else {
        //get found elements
        var result = JSON.parse(body).elements
        var buildings = []
        var bodyString = body
        var coords = []
        //if no polygon coords are available, save all found buildings
        if (polygon=="") {
          for (element in result) {          
            var nodes = result[element].geometry
            var geometry = []
              for (node in nodes) {
                var lat = Number(nodes[node].lat)
                var lon = Number(nodes[node].lon)
                var oneNode = proj4(proj4('EPSG:4326'), proj4('EPSG:3857'), [ lon, lat ])
                geometry.push(oneNode)
              }
              buildings.push({ id: result[element].id, geometry: [geometry] }) 
          }
        //if polygon coords are available, find viewable buildings
        } else {
          buildings = tools.findViewableBuildings(polygon, body, latlon)
        }
        //render image page
        res.render("image.ejs", {
          imagePath: req.body.imagePath,
          properties: req.body.properties,
          buildingCoords: JSON.stringify(buildings),
          building: true,
          radius: radius,
          bodyString: bodyString,
          rotation: req.body.mapRotation,
          icon: req.body.icon
        })
      }
    }
  )
})


/* Upload an image */
router.post('/upload', function(req, res) {
  var serverPath = '/images/' + req.file.originalname;
  fs.rename(req.file.path, '/root/Bachelor/public' + serverPath, function(error) {
    if (error) {
      res.send({
        error: 'Image upload failed'
      });
      return
    } else {
      // read exif
      var buf = fs.readFileSync('/root/Bachelor/public' + serverPath);      
      try { 
        var parser = require('exif-parser').create(buf) 
        var result = parser.parse()
      }
      catch(error) {
         MyImage.find({}).exec(function(err,images) {
          if (err) {
            error = error + ", no images found"
          } 
          res.render('home.ejs', { 
            error: error + ".",
            coordsString: 'Home page', 
            properties: "[51.964045, 7.609542]",
            imageData: JSON.stringify(images)
          })
        }) 
        return
      }
      
      var dec = [ result.tags.GPSLatitude, result.tags.GPSLongitude ]
      if ((dec[0]==undefined) || (dec[1]==undefined)) {
        var error = "Please upload a geotagged image (with GPS Coordinates available)"
         MyImage.find({}).exec(function(err,images) {
          if (err) {
            error = error + ", no images found"
          } 
          res.render('home.ejs', { 
            error: error + ".",
            coordsString: 'Home page', 
            properties: "[51.964045, 7.609542]",
            imageData: JSON.stringify(images)
          })
        }) 
        return
      }
      res.render('image.ejs', { 
        imagePath: serverPath,         
        properties: JSON.stringify(dec),
        building: false,
        radius: "100",
        rotation: '0',
        icon: '"Point"'
      })
    } 
  })                   
})

/* Render survey pages
*
*
*/
router.post('/test/next/:entryId?', function(req, res) {
  //get gps coords of the image
  var originLat = Number(req.body.lat)
  var originLon = Number(req.body.lon)
  var arrow
  var array = req.body.nextImage.split(" ") 
  var curIndex = Number(array[array.length-1])
  var showBuilding = false 
  var timeSplit = req.body.time.split(":")
  var time = 1800-(Number(timeSplit[2])+(Number(timeSplit[1])*60))
  var demoDur = 60
  if (req.body.demoClicked=="ja" && array.length==1) {
    time = time - demoDur
  } else if (req.body.demoClicked=="ja") {
    time = time - 10
  } 
  var names = []  
  // define file names for each test
  if (req.body.test=="1") {
    names = [ 
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
    arrow = "arrow";
  } else if (req.body.test=="2") {
     names = [ 
      126807938,
      127678448,
      127678634,
      127678645,
      127678662,
      127678675,
      127678695,
      127678707,
      127678738,
      127678751
    ]
    arrow = '"Point"'
    showBuilding = true
  } 

  // read exif data of a current image  
  var buf = fs.readFileSync('/root/Bachelor/public/images/' +  names[curIndex] + ".jpg");    
  var parser = require('exif-parser').create(buf);
  var result = parser.parse();
  //read EXIF data
  var dec = [ result.tags.GPSLatitude, result.tags.GPSLongitude ]
  var focalLength = result.tags.FocalLength
  var sensorWidth = 6.17 //sensor width for SONY Cyber-shot DSC-HX10V
  //calculate field of view 
  var fov = 2*Math.atan(0.5*sensorWidth/Number(focalLength))
  //save in db
  if (req.body.test=="1") {
    var testImage = new MyTestImage({ 
    name: names[curIndex],
    test: Number(req.body.test),    
    GPSLatitudeRef: result.tags.GPSLatitudeRef,
    GPSLatitude: Number(result.tags.GPSLatitude),
    GPSLongitudeRef: result.tags.GPSLongitudeRef,
    GPSLongitude: Number(result.tags.GPSLongitude),
    GPSImgDirection: Number(result.tags.GPSImgDirection),
    focalLength: Number(result.tags.FocalLength),
    familiarPlace: Number(req.body.known),
    directionFromUser: 360-tools.radToDegree(Number(req.body.mapRotation)),
    time: time,
    entry: req.params.entryId,
    imageSize: req.body.imageSize,
    polygonCoords: tools.findPolygonFromRotation(fov, Number(req.body.mapRotation), req.body.lat, req.body.lon, focalLength)[0]

    })
    testImage.save(function (err) {
      if (err) { 
        return console.error(err)
      }
        else { 
        }
    })
  } else {
    //calculate target
    var targetCoords = tools.targetFromObject(fov, req.body.lat, req.body.lon, req.body.imageSize, req.body.objectCoords, req.body.objectCoordsMap)
    var direction = Number(tools.findRotationFromTarget(targetCoords[0], targetCoords[1], originLat, originLon))
    var testImage = new MyTestImage({ 
      name: names[curIndex],
      test: Number(req.body.test),    
      GPSLatitudeRef: result.tags.GPSLatitudeRef,
      GPSLatitude: Number(result.tags.GPSLatitude),
      GPSLongitudeRef: result.tags.GPSLongitudeRef,
      GPSLongitude: Number(result.tags.GPSLongitude),
      GPSImgDirection: Number(result.tags.GPSImgDirection),
      focalLength: Number(result.tags.FocalLength),
      familiarPlace: Number(req.body.known),
      directionFromUser: 360-tools.radToDegree(Number(req.body.mapRotation)),
      time: time,
      entry: req.params.entryId,
      imageSize: req.body.imageSize,
      markedObjectId: req.body.markedObjectId,
      objectCoordsOnImage: req.body.objectCoords,
      centerCoordsOnMap: req.body.objectCoordsMap,
      directionFromObject: direction,
      polygonCoords: tools.findPolygonFromObject(fov, req.body.lat, req.body.lon, req.body.imageSize, req.body.objectCoords, req.body.objectCoordsMap)[0]
    })
    testImage.save(function (err) {
      if (err) { 
        return console.error("Image not saved" + err)
      }
    })
  }
  
  var imageId = testImage._id

  if (req.body.test=="1") {
    Entry.findOne({ _id: req.params.entryId }).exec(function(err, entry) {
      entry.test1.images.push(imageId)
      entry.save()
    })
  } else {
    Entry.findOne({ _id: req.params.entryId }).exec(function(err, entry) {
      entry.test2.images.push(imageId)
      entry.save()
    })
  } 
  if (array.length==10 && req.body.test=="2") {
    Entry.findOne({ _id: req.params.entryId }).populate('testImage').exec(function(err, entry) {
      MyTestImage.find({ entry: req.params.entryId }).populate('entry').exec(function(err, images) { 
        var test1Time = 0
        var test2Time = 0
        var test1Result = 0
        var test2Result = 0
        for (i=0;i<images.length;i++) {
          if (images[i].test=="1") {
            test1Time = test1Time + images[i].time
            var diff = Math.abs(images[i].GPSImgDirection-2.9-images[i].directionFromUser)
            if (diff>180) {
              diff = 360-diff
            }
            test1Result = test1Result + diff
          } else if (images[i].test=="2") {
            test2Time = test2Time + images[i].time
            var diff = Math.abs(images[i].GPSImgDirection-2.9-images[i].directionFromObject)
            if (diff>180) {
              diff = 360-diff
            }
            test2Result = test2Result + diff
          }
        }
        entry.test2.easy = Number(req.body.easy),
        entry.test2.quickly = Number(req.body.quickly),
        entry.test2.comfortable = Number(req.body.comfortable),
        entry.test2.difficult = "Difficult: " + req.body.whatDifficult,
        entry.test2.like = "Like: " + req.body.whatLike,
        entry.test2.dislike = "Dislike: " + req.body.whatDislike
        entry.test1Time = Number(test1Time)
        entry.test2Time = test2Time
        entry.test1Result = Math.abs(test1Result/10)
        entry.test2Result = Math.abs(test2Result/10)
        entry.save(function (err) {
        if (err) {
          res.redirect("/survey/thanks")
          return
        } else {
          res.redirect("/survey/thanks")
        }
        })    
      })
    })  
  } else {
    var modal = false
    var test = ""                               
    var next = ""                               
    if (array.length==9) {
      modal = true
    }
    if (array.length==10 && req.body.test=="1") {
       Entry.findOne({ _id: req.params.entryId }).exec(function(err, entry) {
        entry.test1.easy = Number(req.body.easy),
        entry.test1.quickly = Number(req.body.quickly),
        entry.test1.comfortable = Number(req.body.comfortable),
        entry.test1.difficult = "Difficult:" + req.body.whatDifficult,
        entry.test1.like = "Like: " + req.body.whatLike,
        entry.test1.dislike = "Dislike: " + req.body.whatDislike
        entry.save(function(err) {
          if (err) console.log("Entry not evaluated " + err)
        })
      })
      test = "2"
      array = []
      arrow = "point"
      showBuilding = true
      names = [
        126807938,
        127678448,
        127678634,
        127678645,
        127678662,
        127678675,
        127678695,
        127678707,
        127678738,
        127678751
      ]
    } else {
      test = req.body.test
      next = req.body.nextImage
    }
    var image = array.length + 1
    // files which have alredy been tested
    var nextArray = []
    for (var i=0;i<array.length;i++) {
      nextArray.push(Number(array[i]))
    }
    // define the next file name randomly
    var x = Math.floor((Math.random() * 10))
    while (tools.randomInArray(x, nextArray)) {
      x = Math.floor((Math.random() * 10))
    }
    if (next!="") { 
      next = next + " " + x
    } else {
      next = x
    }
    // read exif data of a current image
    var buf = fs.readFileSync('/root/Bachelor/public/images/' + names[x] + ".jpg");      
    var parser = require('exif-parser').create(buf);
    var result = parser.parse();
    //read GPS data
    var dec = [ result.tags.GPSLatitude, result.tags.GPSLongitude ]
    // read focal length
    var focalLength = result.tags.FocalLength
    var sensorWidth = 6.17
    //calculate FOV
    var fov = tools.radToDegree(2*Math.atan(0.5*sensorWidth/Number(focalLength)))
    if (test=="2") {
      MySurveyImage.findOne({ name: names[x].toString() }).exec(function(err, surveyImage) {
        res.render('home_for_survey.ejs', { 
          imageSource: "http://a-rommel.de/" + names[x] + ".jpg",
          nextImage: next,
          properties: JSON.stringify(dec),
          coordsString: 'Home page',
          buildingCoords: JSON.stringify(surveyImage.buildings),
          showBuilding: showBuilding,
          arrow: arrow,
          image: image,
          test: test,
          modal: modal,
          entryId: req.params.entryId,
          fov: fov
        })
      })
    } else {
      res.render('home_for_survey.ejs', { 
        imageSource: "http://a-rommel.de/" + names[x] + ".jpg",
        nextImage: next,
        properties: JSON.stringify(dec),
        coordsString: 'Home page',
        buildingCoords: "Test 1 --> no buildings",
        showBuilding: showBuilding,
        arrow: arrow,
        image: image,
        test: test,
        modal: modal,
        entryId: req.params.entryId,
        fov: fov
      })
    }
  }
})

module.exports = router;

'use strict';
var User = require('../models/User');
var Advert = require('../models/Advert');
var jwt = require('jwt-simple');
var request = require('request');
var http = require('http');
var xmlHTTP = require('xhr2');
var passport = require('passport');
var path = require('path');

/**
 * @api {get} /search/searchByJWT Search using JWT Token
 * @apiName Search by JWT
 * @apiGroup Search
 *
 * @apiParam {String} req.headers JWT Token
 * @apiParam {Integer} radius Radius to Search, defaults to 10 miles
 * @apiParam {Date} start Date of availability start
 * @apiParam {Date} endData Date of availabiliy end
 *
 * @apiSuccess [Employees] Returns Array of Employee Objects
 */
exports.searchByJWT = function (req, res1) {
    if (!req.headers) {
        return res.status(400).send();
    } else {
        var token = getToken(req.headers);
        if (!token) {
            res1.json({success: false, msg: 'Invalid JWT'}).send();
        } else {
            var employer = jwt.decode(token, 'secret');
            var postcode = employer.postCode;
            var radius = req.query.radius;
            var wage = req.query.wage;
            var startDate = req.query.startDate;
            var endDate = req.query.endDate;
            if (typeof radius === 'undefined') {
                radius = 10;
            }
            populateAllEmployees();
            var long = undefined;
            var lat = undefined;
            var matchedEmployees = [];
            request.get('http://api.postcodes.io/postcodes/' + postcode, function (err, res) {
                if (err) {
                    return res1.status(400).send("An Error Has Occured");
                }
                else {
                    var body = JSON.parse(res.body);
                    if (!body.result) {
                        return res1.status(400).send("Please Check Your PostCode");
                    } else {
                        long = body.result.longitude;
                        lat = body.result.latitude;
                        if (long && lat) {

                            User.find({'role': 'employee'})
                                .populate({
                                    path: 'employee',
                                    populate: {
                                        path: 'availableTimes',
                                    }
                                }).exec(function (err, emp) {
                                if (err)  return res.status(400).send('error');
                                var arrayofemployees = emp;
                                for (var i = 0; i < emp.length; ++i) {
                                    var employee = emp[i];
                                    var distance = getDistance(lat, long, employee.latitude, employee.longitude);
                                    if (distance >= radius) {
                                        var index = arrayofemployees.indexOf(employee);
                                        if (index !== -1) {
                                            delete arrayofemployees[index];
                                        }
                                    }
                                    if(employee.employee) {
                                        if(employee.employee.wage) {
                                            if (employee.employee.wage < wage) {
                                                var index = arrayofemployees.indexOf(employee);
                                                if (index !== -1) {
                                                    delete arrayofemployees[index];
                                                }
                                            }
                                        }
                                    }
                                    
                                    if (startDate != undefined && typeof endDate != undefined) {
                                        if (startDate > employee.employee.availableTimes.start || endDate < employee.employee.availableTimes.end) {
                                            var index = arrayofemployees.indexOf(employee);
                                            if (index !== -1) {
                                                delete arrayofemployees[index];
                                            }
                                        }
                                    }
                                } 
                                var array = arrayofemployees.filter(function() { return true; });
                                return res1.json({success: true, employees: arrayofemployees}).end();
                            });
                        }
                    }
                }
            });
        }
    }
}



/**
 * @api {get} /search/search Search 
 * @apiName Search 
 * @apiGroup Search
 *
 * @apiParam {Integer} req.query.postcode Postcode to use for searching
 * @apiParam {Integer} req.query.radius Radius to search, defaults to 10 miles
 * @apiParam {Integer} req.query.wage Max Wage
 * @apiParam {Date} req.query.startDate Date of availabiliy start
 * @apiParam {Date} req.query.endDate Date of availabiliy end

 *
 * @apiSuccess [Employees] Returns Array of Employee Objects
 */
exports.search = function (req, res1) {
    if (!req.query) {
       return res1.status(400).send('Wrong Format, Provide Query');
    } else {
        var postcode = req.query.postcode;
        var radius = req.query.radius;
        var wage = req.query.wage;
        var startDate = req.query.startDate;
        var endDate = req.query.endDate;
        if (typeof radius === 'undefined') {
            radius = 10;
        }
        populateAllEmployees();
        var long = undefined;
        var lat = undefined;
        var matchedEmployees = [];
        request.get('http://api.postcodes.io/postcodes/' + postcode, function (err, res) {
            if (err) {
                return res1.status(400).send("An Error Has Occured");
            }
            else {
                var body = JSON.parse(res.body);
                if (!body.result) {
                    return res1.status(400).send("Please Check Your PostCode");
                } else {
                    long = body.result.longitude;
                    lat = body.result.latitude;
                    if (long && lat) {

                        User.find({'role': 'employee'})
                            .populate({
                                path: 'employee',
                                populate: {
                                    path: 'availableTimes',
                                }
                            }).exec(function (err, emp) {
                            if (err)  return res.status(400).send('error');
                            var arrayofemployees = emp;
                            for (var i = 0; i < emp.length; ++i) {
                                var employee = emp[i];
                                var distance = getDistance(lat, long, employee.latitude, employee.longitude);
                                if (distance >= radius) {
                                    var index = arrayofemployees.indexOf(employee);
                                    if (index !== -1) {
                                        delete arrayofemployees[index];
                                    }
                                }
                                if(employee.employee) {
                                    if(employee.employee.wage) {
                                        if (employee.employee.wage < wage) {
                                            var index = arrayofemployees.indexOf(employee);
                                            if (index !== -1) {
                                                delete arrayofemployees[index];
                                            }
                                        }
                                    }
                                }
                                
                                if (startDate != undefined && typeof endDate != undefined) {
                                    if (startDate > employee.employee.availableTimes.start || endDate < employee.employee.availableTimes.end) {
                                        var index = arrayofemployees.indexOf(employee);
                                        if (index !== -1) {
                                            delete arrayofemployees[index];
                                        }
                                    }
                                }
                            } 
                            var array = arrayofemployees.filter(function() { return true; });
                            return res1.json({success: true, employees: arrayofemployees}).end();
                        });
                    }
                }
            }
        });
    }
}



function getDistance(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d * 0.621371;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}


function populateAllEmployees() {
    var employees = [];
    User.find({'role': 'employee'})
        .populate('employee').exec(function (err, emp) {
        if (err) return 'Error finding users';
        emp.forEach(function (employee) {
            var postcode = employee.postCode;
            request.get('http://api.postcodes.io/postcodes/' + postcode, function (err, res) {
                if (err) throw err
                if (res.statusCode !== 200) {}

                var body = JSON.parse(res.body);
		        if(body) {
			        if(body.result) {
                		if(body.result.longitude && body.result.latitude) {
	                		var longitude = body.result.longitude;
        	        		var latitude = body.result.latitude;
                			employee.longitude = longitude;
                			employee.latitude = latitude;
               		 		employees.push(employee);
                			employee.save(function (err, emp) {})
				        }
			         }
		          }
            });
        });
    });
    return employees;
}


function getToken(headers) {
    if (headers && headers.authorization) {
        var parted = headers.authorization.split(' ');
        if (parted.length === 2) {
            return parted[1];
        } else {
            return null;
        }
    } else {
        return null;
    }
}

/**
 * @api {get} /search/searchByAdvert Search by Advert
 * @apiName Search by Advert
 * @apiGroup Search
 *
 * @apiParam {Integer} req.query.id Id of Advert
 *
 * @apiSuccess [Employees] Returns Array of Employee Objects
 */
exports.searchByAdvert = function (req, res) {
    if (!req.query) {
        return res.status(400).send('Wrong format');
    } else if (!req.query.id) {
        return res.status(400).send('Provide ID');
    } else {
        var id = req.query.id;
        Advert.findById(id, function (err, ad) {
            if (err) return res.json({success: false, msg: 'Error thrown'}).send();
            if (ad) {
                var wage = ad.wage;
                var postcode = ad.postcode;
                var startDate = ad.start;
                var endDate = ad.end;
                var radius = 10;
                populateAllEmployees();
                var long = undefined;
                var lat = undefined;
                request.get('http://api.postcodes.io/postcodes/' + postcode, function (err, res1) {
                    if (err) {
                        console.log(err);
                        return res.status(400).json({success: false, msg: 'Cant Find postcode'}).send();
                    } else {
                        if(res1.body) {
                               var body = JSON.parse(res1.body);
			      if(body.result) {
                                long = body.result.longitude;
                                lat = body.result.latitude;
                      		console.log("here");
			         if (long && lat) {
                                    User.find({'role': 'employee'})
                                        .populate({
                                            path: 'employee',
                                            populate: {
                                                path: 'availableTimes',
                                                model: 'AvailableTime'
                                            }
                                        }).exec(function (err, emp) {
                                        if (err)  return res.status(400).send();
                                        else {
                                            var arrayofemployees = emp;
                                            for (var i = 0; i < emp.length; ++i) {
                                                var employee = emp[i];
                                                var distance = getDistance(lat, long, employee.latitude, employee.longitude);
                                                if (distance >= radius) {
                                                    var index = arrayofemployees.indexOf(employee);
                                                    if (index !== -1) {
                                                        delete arrayofemployees[index];
                                                    }
                                                }
                                                if (typeof wage !== undefined && employee.employee.wage > wage) {
                                                    var index = arrayofemployees.indexOf(employee);
                                                    if (index !== -1) {
                                                        delete arrayofemployees[index];
                                                    }
                                                }
                                                if (typeof startDate !== 'undefined' && typeof endDate !== 'undefined') {
                                                    if (startDate > employee.employee.availableTimes.start ||
                                                        endDate < employee.employee.availableTimes.end) {
                                                        var index = arrayofemployees.indexOf(employee);
                                                        if (index !== -1) {
                                                            delete arrayofemployees[index];
                                                        }
                                                    }
                                                }
                                            }
                                            var array = arrayofemployees.filter(function() { return true; });
                                            return res.status(200).json({success: true, employees: array}).send();        
                                        }
                                   });
                                }
                            }
                        }
                    } 
                });
            }
        });
    }
}



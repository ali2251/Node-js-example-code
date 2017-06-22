var request = require('request');
var AvailableTime = require('../models/AvailableTime');
var moment = require('moment');
var async = require('async');
var User = require('../models/User');

/**
 * @api {post} /employee/setAvailableTime Set Available Time for Employee
 * @apiName Set Available Time
 * @apiGroup Employee
 *
 * @apiParam {User} employee_id Id of Employee
 * @apiParam {Event} event Event Object from Angular Full calendar
 *
 * @apiSuccess {AvailableTime} Returns JSON of Available Time Data
 */
exports.setAvailableTime = function (req, res) {
    if(req.body) {
        if(req.body.event) {
            if(req.body.event.start && req.body.event.end && req.body.employee_id) {
                var duration = moment.duration(moment(req.body.event.end).diff(moment(req.body.event.start)));
                var hours = duration.asHours();
                var counter = 0;
                var startDate = moment(req.body.event.start);
                for(var i = 0; i<hours; i++) {
                  var event = new AvailableTime(req.body.event);
                  event.employee = req.body.employee_id;
                  if(startDate == req.body.event.start) {
                    event.start = startDate.toISOString();
                    event.end = startDate.add(1,'hours').toISOString();
                    event.save(function (err, data) {
                        if (err) {
                            return res.status(400).send({
                                message: err
                            });
                        } 
                    });
                  } else {
                    startDate = startDate.add(1,'hours');
                    event.start = startDate.toISOString();
                    event.end = startDate.add(1,'hours');
                    event.save(function (err, data) {
                        if (err) {
                            return res.status(400).send({
                                message: err
                            });
                        } 
                    });
                  }
                  counter += 1;
                }
                if(counter == hours.length - 1) {
                    return res.status(200).json(data);
                }
            } else {
                return res.status(400).send({success: false, message: "Please check data"});
            }
        } else {
            return res.status(400).send({success: false, message: "Please check data"});
        }
    } else {
        return res.status(400).send({success: false, message: "Please check data"});
    }
};

/**
 * @api {post} /employee/getAvailabilityCalendar Get Calendar Availability for Employee
 * @apiName Get Availability Calendar
 * @apiGroup Employee
 *
 * @apiParam {Date} req.query.start Start Time to Get Available Times For
 * @apiParam {Date} req.query.end End Time to Get Available Times For
 * @apiParam {String} employee Employee to get available times for
 *
 * @apiSuccess {AvailableTime} Returns JSON of Available Time Data
 */
exports.getAvailabilityCalendar = function(req, res, next){
    if(req.query) {
        if(req.query.start && req.query.end && req.query.employee) {
            var start = req.query.start;
            var end = req.query.end;
            if(start < new Date()){
                start = moment().startOf('day').toDate();
            }
            var filter = {
                employee: req.query.employee,
                start: {
                  $gte: start,
                  $lte: end
                }
            }
            AvailableTime.find(filter).sort('start').exec(function(err, data){
                if(err){ return next(err); }
                return res.status(200).json(data);
            });
        } else {
            return res.status(400).send({success: false, message: "Please check query"});
        }
    } else {
        return res.status(400).send({success: false, message: "Please check data"});
    }
};

/**
 * @api {delete} /employee/deleteAvailableTime Delete Available Time for Employee
 * @apiName Delete Available Time
 * @apiGroup Employee
 *
 * @apiParam {String} id Time to be deleted ID
 *
 * @apiSuccess {Status} Returns 200
 */
 exports.deleteAvailableTime = function (req, res) {
    if(req.body) {
        if(req.body.id) {
            AvailableTime.findOne({_id: req.body.id}).exec(function (err, data) {
                if (err) {
                    return res.status(400).send({
                        message: err
                    });
                } else {
                    var temp = data;
                    data.remove(function (err) {
                        if (!err) {
                            return res.sendStatus(200);
                        } else {
                            return res.sendStatus(400);
                        }
                    });
                }
            });
        } else {
            return res.status(400).send({success: false, message: 'Please check the body'});
        }
    } else {
        return res.status(400).send({success: false, message: 'Please check the body'});
    }
};

/**
 * @api {post} /user/getAllEmployees Get all employees
 * @apiName Get All Employees
 * @apiGroup Employee
 * *
 * @apiSuccess {JSON} Returns Array of Employees
 */
exports.getAllEmployees = function (req, res) {
    User.find({'role': 'employee'}).populate('employee').exec(function (err, emp) {
        if (err) res.status(400).json({success: false, msg: 'Cannot find employees'}).send();
        return res.status(200).json({success: true, employees: emp}).send();
    });
}

/**
 * @api {get} /user/getEmployeeByID Gets Employee by ID
 * @apiName Get Employee by ID
 * @apiGroup Employee
 *
 * @apiParam {String} req.headers.id ID of Employer
 *
 * @apiSuccess {Employee} Returns Employee Object
 */
exports.getEmployeeByID = function (req, res) {
    if (!req.query) {
    //    res.status(400).send();
    } else if (!req.query.id) {
      //  res.status(400).send();
    } else {
        var id = req.query.id;
        User.findOne({'employee': id})
            .populate('employee')
            .select('-password -employer')
            .exec(function (err, employee) {
                if (err) {
                    return res.status(400).json({success: false, msg: 'Cannot find employee'}).send();
                }
               else if (employee) {
                    return res.status(200).json({Employee: employee}).send();
                } else {
                    return res.status(400).json({success: false, msg: 'Cannot find employee'}).send();
                }
            });
    }
}

/**
 * @api {get} /employee/getAvailabilityCalendar Gets Availabile Slots for Employee
 * @apiName Get Available Time Slots
 * @apiGroup Employee
 *
 * @apiParam {String} req.query.employee ID of Employer
 * @apiParam {String} req.query.start Start Date of Employer
 * @apiParam {String} req.query.end End Date of Employer
 *
 * @apiSuccess {Event} Returns Array of Event Objects
 */
exports.getAvailabilityCalendar = function(req, res, next){
    if(req.query) {
        if(req.query.start && req.query.end && req.query.employee) {
            var start = req.query.start;
            var end = req.query.end;

            if(start < new Date()){
                start = moment().startOf('day').toDate();
            }
            var filter = {
                employee: req.query.employee,
                start: {
                    $gte: start,
                    $lte: end
                }
            }

            AvailableTime.find(filter).sort('start').exec(function(err, data){
                if(err){ return next(err); }
                return res.status(200).json(data);
            });
        } else {
            return res.status(400).json({success: false, msg: 'Please check your data'}).send();
        }
    } else {
        return res.status(400).json({success: false, msg: 'Please check your data'}).send();
    }
};

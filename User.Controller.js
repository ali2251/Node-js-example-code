'use strict';

var passport = require('passport');
var User = require('../models/User');
var request = require('request');
var Employer = require('../models/Employer');
var Employee = require('../models/Employee');
var LocalStrategy = require('passport-local').Strategy;
var jwt = require('jwt-simple');
var aws = require('aws-sdk');
var busboy = require('connect-busboy');
var http = require('http');
var xmlHTTP = require('xhr2');
var fs = require('fs');
var path = require('path');
var nodemailer = require('nodemailer');
var bcrypt = require('bcrypt-nodejs');
var async = require('async');
var crypto = require('crypto');
var bcryptjs = require('bcryptjs');
var CLIENT_ID = 'ca_A2UbhVCJorclCcITmqkEow28k4pUivW7';
var API_KEY = 'sk_test_r4gnv7aGaGJKrhgCFezDGLrL'; // must never leave the backend
var PUBLISHABLE_KEY = ' pk_test_T7A8OFhzKHJO0badDnTI0p6Y'; // used for card tokenization

var stripe = require('stripe')(API_KEY);

const S3_BUCKET = 'imagesuploadjs' //= process.env.S3_BUCKET;

const s3 = new aws.S3({
    sslEnabled: true,
    accessKeyId: "AKIAINT4DVSPUNN7MQOA",
    secretAccessKey: "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"

});

/**
 * @api {post} /user/signup Signs up Employer or Employee
 * @apiName Signup
 * @apiGroup User
 *
 * @apiParam {String} email Email Address of User
 * @apiParam {String} password Password of User
 * @apiParam {String} role Employee or Employer
 * @apiParam {String} name Name
 * @apiParam {String} photoURL Url of Profile Photo
 * @apiParam {Date} dob Amount to be charged
 * @apiParam {String} location Location of User
 * @apiParam {String} phoneNumber Phone Number
 * 
 * @apiParam {String} summary Summary of Employee (Only for Employee)
 * @apiParam {String} skillLevel Beginner or Experienced (Only for Employee)
 * @apiParam {Integer} experience Experience of Employee (Only for Employee)
 * @apiParam {Integer} wage Wage of Employee
 * @apiParam {String} speciality Speciality of Employee(Only for Employee)
 *
 * @apiSuccess {Users} Returns User Object on Success
 */
exports.signup = function (req, res) {
    var newUser;
    if (!req.body.email || !req.body.password || !req.body.role || !req.body.name || !req.body.photoURL || !req.body.dob || !req.body.address || !req.body.phoneNumber || !req.body.postcode) {
        console.log("Not everything is defined");
	return res.status(400).json({message: 'Please provide a username and password'}).send();
    } else {
        request.get('http://api.postcodes.io/postcodes/' + req.body.postcode, function (err, response) {
            var body = JSON.parse(response.body);
            if (err || !body.result) {
                console.log("Post Code");
                res.status(400).send('Incorrect Post Code');
            } else {
                var role = req.body.role;
                newUser = new User();
                User.findOne({'email': req.body.email}, function (err, user) {
                    if (err) {
                        return res.json({success: false, msg: 'Database error'}).send();
                    } if (!user) {
                        newUser.email = req.body.email;
                        newUser.password = req.body.password;
                        newUser.radius = req.body.radius;
                        newUser.name = req.body.name;
                        newUser.photoUrl = req.body.photoURL;
                        newUser.dob = req.body.dob;
                        newUser.address = req.body.address;
                        newUser.postCode = req.body.postcode;
                        newUser.phoneNumber = req.body.phoneNumber;
                        newUser.gender = req.body.gender;
		                if (role === 'employer') {
                            var newEmployer = new Employer();
                            newEmployer.position = req.body.position;
                            newEmployer.save(function (err, emp) {
                                if (err) {
                                    return res.status(400).json({success: false, msg: 'Wrong format provided'}).send();
                                }
                            });
                            newUser.employer = newEmployer._id;
                            newUser.role = role;
                            newEmployer.user = newUser._id;
                            newUser.chats[0] = "Default";
                            User.createUser(newUser, function (err, user) {
                                if (err) {
                                    console.log(err);
                                    return res.status(400).json({success: false, err: err}).send();
                                }
                                User.findOne({'_id': user._id}).populate('employer').exec(function (err, user) {
                                    if (err) {
                                        return res.status(400).json({success: false, msg: 'User not created'}).send();
                                    }
                                    return res.status(200).json({success: true, user: user}).send();
                                });
                            });
                        }
                        else if (role === 'employee') {
                            if (!req.body.gender || !req.body.summary || !req.body.skillLevel || !req.body.experience || !req.body.wage || !req.body.speciality) {
                                return res.status(400).send('Send all information');
                            }
                            var newEmployee = new Employee({
                                summary: req.body.summary,
                                skillLevel: req.body.skillLevel,
                                experience: req.body.experience,
                                wage: req.body.wage,
                                speciality: req.body.speciality

                            });
                            newEmployee.save(function (err, emp) {
                                if (err) {
                                    return res.status(400).json({success: false, msg: 'Wrong format provided'}).send();
                                }
                            }).then(function (emp) {
                                newUser.employee = newEmployee._id;
                                newUser.role = role;
                                newEmployee.user = newUser._id;
                                User.createUser(newUser, function (err, user) {
                                    if (err) {
                                        return res.status(400).json({success: false, err: err});
                                    }
                                    if (user) {
                                        User.findOne({'_id': user._id}).populate('employee').exec(function (err, user) {
                                            if (err) {
                                                return res.status(400).json({success: false, msg: 'User not created'}).send();
                                            }
                                            return res.status(200).json({success: true, user: user, email: newUser.email}).send();
                                        });
                                    } else {
                                        return res.status(400).json({success: false, msg: 'Invalid User'}).send();
                                    }
                                });
                            })
                        }
                    } else {
                        return res.status(402).json({message: 'Username already exists!'}).send();
                    }
                });
            }
        });
    }
}


/**
 * @api {Post} /user/getUserById Edit Profile for User
 * @apiName Get User By Id
 * @apiGroup User
 *
 * @apiParam {String} id User ID
 *
 * @apiSuccess {Employer} Returns JSON object of user
 */
exports.getUserFromId = function (req, res) {
    if (req.body) {
        User.findOne({
            '_id': req.body.id
        }).populate('employee').select('-password - employee')
            .exec(function (err, usr) {
            if (err) {
                return res.status(400).json({success: false, msg: 'User not found'}).send();
            } else if (usr) {
                if(usr.stripeToken) {
                    stripe.customers.retrieve(
                      usr.stripeToken,
                      function(err, customer) {
                        return res.json({success: true, user: usr, payment: customer});
                      }
                    );
                } else {
                    return res.status(200).json({success: true, user: usr}).send();
                }
            } else {
                return res.status(400).json({success: false, msg: 'User not found'}).send();
            }

        });
     } else {
       return res.json({success: false, msg: 'Check body'}).send();
    }
}


/**
 * @api {Post} /user/rateUser Rate User
 * @apiName Rate User By Id & Stars
 * @apiGroup User
 *
 * @apiParam {String} req.query.id Id of User to Rate
 * @apiParam {String} req.query.rating Rating of User to Rate (1 to 5)
 *
 * @apiSuccess {Employer} Returns JSON object of user
 */
exports.rateUser = function (req, res) {
    if (req.query) {
        if(req.query.id && req.query.rating) {
            User.findOne({
                '_id': req.query.id
            }).exec(function (err, usr) {
                if (err) {
                    return res.status(400).json({success: false, msg: 'User not found'}).send();
                } else if (usr) {
                    var oldRating = usr.rating;
                    var newRating = (req.query.rating + usr.rating)/2;
                    var body = {rating: newRating};
                    User.findOneAndUpdate({ '_id': req.query.id }, body, { new: true }, function(err, doc) {                   
                       return res.status(200).json({success: true, user: doc}).send();
                    });
                }

            });
        } else {
           return res.status(400).json({success: false, msg: 'Check query'}).send();
        }
    } else {
        return res.status(400).json({success: false, msg: 'Check query'}).send();
    }
}



/**
 * @api {Post} /user/editProfile Edit Profile for User
 * @apiName Edit Profile
 * @apiGroup User
 *
 * @apiParam {String} req.header JWT Token
 * @apiParam {String} requestType Employeer or Employer
 * @apiParam {Object} req.body.employeedata data to be passed into employee model
 * @apiParam {Object} req.body.employerdata data to be passed into employer model
 * @apiParam {Object} req.body.user data to be passed into user model
 *
 * @apiSuccess {User} Returns JSON object of user
 */
exports.editProfile = function (req, res) {
    if(req.body) {
        if(req.body.email) {
            User.findOneAndUpdate({ 'email': req.body.email }, req.body.user, { new: true }, function(err, doc) {
                if(req.body.requestType == "Employee") {
                    Employee.findByIdAndUpdate(doc.employee, req.body.employeedata, {new: true}, function(err, model) {
                        return res.status(200).json({success: true, user:doc, employee:model});
                    });
                } 
                if(req.body.requestType == "Employer") {
                    Employer.findByIdAndUpdate(doc.employer, req.body.employerdata, {new: true}, function(err, model) {
                        return res.status(200).json({success: true, user:doc, employer:model});
                    });
                }
                if(!req.body.requestType) {
               return res.status(200).json({success: true, user: doc}).send(); }
            });
        }  else {
            return res.status(500).send({success: false, msg: 'No Body'});
        }
    } else {
        return res.status(500).send({success: false, msg: 'No Body'});
    }
}

/**
 * @api {post} /user/login Logs-in User
 * @apiName Login
 * @apiGroup User
 *
 * @apiParam {String} email Email Address of User
 * @apiParam {String} password Password of User
 *
 * @apiSuccess {JSON} Returns JWT Token, Email, and Sucess Message
 */
exports.login = function (req, res) {
    try {
        if (!req.body.email || !req.body.password) {
            return res.json({message: 'Please provide a username and password'}).send();
        } else {
            User.findOne({'email': req.body.email}, function (err, user) {
                if (err) {
                    return res.status(400).send('error');
                }
                if (!user) {
                    return res.status(403).send({success: false, msg: 'Authentication failed. User not found'});
                } else {
                    User.comparePassword(req.body.password, user.password, function (err, isMatch) {
                        if (err) throw err;
                        if (isMatch) {
                            var token = jwt.encode(user, 'secret');
                            return res.status(200).json({success: true, token: 'JWT ' + token, email: req.body.email}).send();
                        } else {
                            return res.status(403).json({success: false, msg: 'Wrong Password'}).send();
                        }
                    });
                }
            });
        }
    } catch (err) {
        res.status(400).send();
    }
}

var getToken = function (headers) {
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
};

/**
 * @api {post} /user/getUser Get User by ID
 * @apiName Get User
 * @apiGroup User
 *
 * @apiParam {String} id User Id
 *
 * @apiSuccess {User} Returns User Object
 */
exports.getUser = function (req, res) {
    if (req.body) {
        User.findOne({'_id': req.body.id})
            .exec(function (err, employer) {
                if (err) {
                    console.log('n error');
                    return res.json({success: false, msg: 'Cannot find employer'}).send();
                }
                else if (employer) {
                    return res.json({success: true, employer: employer}).send();
                } else {
                    console.log('here, no user found');  
                }
            });
     } else {
       return res.json({success: false, msg: 'Check body'}).send();
    }
}

/**
 * @api {post} /user/checkAuthorisation Checks to see whether user is authorised
 * @apiName Check Authorisation
 * @apiGroup User
 *
 * @apiParam {String} req.headers Token in Header
 *
 * @apiSuccess {JSON} Returns Message User is Authorisized
 */
exports.checkAuthorisation = function (req, res) {
    if (!req.headers) {
        return res.status(400).send();
    } else {
        passport.authenticate('jwt', {session: false});
        var token = getToken(req.headers);
        if (token) {
            var decoded = jwt.decode(token, 'secret');
            User.findOne({
                'email': decoded.email
            }, function (err, user) {
                if (err) {
                    return res.status(400).json({success: false, msg: 'User not found.'}).send();
                }
                if (!user) {
                    return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
                } else {
                    return res.status(200).json({success: true, msg: 'User is authorised'}).send();
                }
            });
        } else {
            return res.status(403).send({success: false, msg: 'No token provided.'}).send();
        }
    }
}

/**
 * @api {post} /user/upload Upload File to AWS
 * @apiName Upload File
 * @apiGroup User
 *
 * @apiParam {String} req.multipart file 
 *
 * @apiSuccess {JSON} Returns URL of File Location
 */
exports.upload = function (req, res) {
    try {
        if (req.busboy) {
            req.pipe(req.busboy);
            req.busboy.on('field', function (fieldname, val) {});
            req.busboy.on('file', function (fieldname, file, filename) {
                file.on('data', function (data) {
                    var uploadParams = {Bucket: S3_BUCKET, Key: '', Body: '', ACL: 'public-read'};
                    uploadParams.Body = new Buffer(data);
                    uploadParams.Key = new Date().toString();
                    s3.upload(uploadParams, function (err, data) {
                        if (err) {
                            console.log('ERROR MSG: ', err);
                            res.send(400);
                        } else {
                            console.log(data.Location);
                            console.log('Successfully uploaded data');
                            res.end(JSON.stringify({url: data.Location})); 
                       }
                    });
                });
            });
        } else {
            return res.status(400).send('Bad Request: Wrong Format');
        }
    } catch (err) {
        return res.status(400).send();
    }
}

/**
 * @api {post} /user/getUserFromJWT Get User from JWT Token
 * @apiName Get User from JWT Token
 * @apiGroup User
 *
 * @apiParam {String} req.headers Token in Header
 *
 * @apiSuccess {User} Returns User Object
 */
exports.getUserFromJWT = function (req, res) {
    if (!req.headers) {
        return res.status(400).send();
    } else {
        passport.authenticate('jwt', {session: false});

        var token = getToken(req.headers);

        if (token) {
            var decoded = jwt.decode(token, 'secret');
            User.findOne({
                'email': decoded.email
            }).populate('employee').select('-password').exec(function (err, usr) {
                if (err) {
                    return res.status(400).json({success: false, msg: 'User not found'}).send();
                } else if (usr) {
                    if(usr.stripeToken) {
                        stripe.customers.retrieve(
                          usr.stripeToken,
                          function(err, customer) {
                            return res.json({success: true, user: usr, payment: customer});
                          }
                        );
                    } else {
                        return res.json({success: true, user: usr});
                    }
                } else {
                    return res.status(400).json({success: false, msg: 'User not found'}).send();
                }

            });
        } else {
            res.status(403).send({success: false, msg: 'No token provided.'});
        }
    }
}

/**
 * @api {get} /user/getChats Get Chats
 * @apiName Get Chats
 * @apiGroup User
 *
 * @apiParam {String} req.headers Token in Header
 *
 * @apiSuccess {Array} Returns Array of Chat String's
 */
exports.getChats = function (req, res) {
    if (!req.headers) {
        return res.status(400).send();
    } else {
        passport.authenticate('jwt', {session: false});
        var token = getToken(req.headers);
        if (token) {
            var decoded = jwt.decode(token, 'secret');
            User.findOne({
                'email': decoded.email
            }).populate('employee').select('-password').exec(function (err, usr) {
                if (err) {
                   res.status(500).json({success: false, msg: 'User not found'}).send();
                } else if (usr) {
                    return res.status(200).json({success: true, chats: usr.chats}).send();
                } else {
                    res.status(500).json({success: false, msg: 'User not found'}).send();
                }

            });
        } else {
            res.status(403).send({success: false, msg: 'No token provided.'});
        }
    }
}



/**
 * @api {post} /user/addCardDetails Adds Stripe Token
 * @apiName Add Card Details
 * @apiGroup User
 *
 * @apiParam {String} stripeToken token to be added
 *
 * @apiSuccess {User} Returns User Object
 */
exports.addCardDetails = function (req, res) {
    if(req.body) {
        if(req.body.email) {
            var query = {'email': req.body.email};
            if(req.body.stripeToken) {
               stripe.customers.create({ // https://stripe.com/docs/charges#saving-credit-card-details-for-later
                    source: req.body.stripeToken
                }).then(function(customer) {
                    User.findOneAndUpdate(query,{ "stripeToken": customer.id },{safe: true, upsert: true},
                        function(err, model) {
                            console.log(err);
                            if(!err) {
                                return res.status(200).json({success: true, customer: customer});
                            } else {
                                return res.status(400).json({success: true, customer: customer});
                            }
                        }
                    );
                });
            } else {
                res.status(400).send({success: false, msg: 'No Stripe Token provided.'});
            }
        }
    } else {
      res.status(400).send({success: false, msg: 'No Body'});
    }
}

/**
 * @api {delete} /user/deleteCardDetails Deletes Stripe Token
 * @apiName Delete Stripe Token
 * @apiGroup User
 *
 * @apiParam {String} stripeToken Token from Stripe
 *
 * @apiSuccess {User} Returns User Object
 */
exports.deleteCardDetails = function (req, res) {
    // if (!req.headers) {
    //     return res.status(400).send();
    // } else {
    //     passport.authenticate('jwt', {session: false});

    //     var token = getToken(req.headers);

    //     if (token) {
    //         var decoded = jwt.decode(token, 'secret');
    if(req.body) {
        if(req.body.email) {
            var query = {'email': req.body.email};
            var options = {new: true};
            if(req.body) {
                if(req.body.stripeToken) {
                    User.update( query, { $pullAll: {"stripeToken": req.body.stripeToken } },
                        function(err, model) {
                            console.log(err);
                            if(!err) {
                                return res.status(200).json({success: true, data: model}).send();
                            }
                        }
                    );
                }
            }      
        }  
    } else {
        res.status(400).send({success: false, msg: 'No token provided.'});
    }
}

/**
 * @api {post} /user/updateChats Update all chats
 * @apiName Update Chats
 * @apiGroup User
 *
 * @apiParam {String} chatid Id of the Sendbird Chat
 *
 * @apiSuccess {Array} Returns array of chats updated
 */
exports.updateChats = function (req, res) {
    if (!req.headers) {
        return res.status(400).send();
    } else {
        passport.authenticate('jwt', {session: false});
        var token = getToken(req.headers);

        if (token) {
            var decoded = jwt.decode(token, 'secret');
            var query = {'email': decoded.email};
            if(req.body) {
                if(req.body.chatid) {
                    User.findOneAndUpdate(query,{$push: { "chats": req.body.chatid }},{safe: true, upsert: true},
                        function(err, model) {
                            console.log(err);
                            if(!err) {
                                return res.status(200).json({success: true, chats: model.chats}).send();
                            }
                        }
                    );
                }
            }
   
        } else {
            res.status(400).send({success: false, msg: 'No token provided.'});
        }
    }
}

/**
 * @api {delete} /user/deleteChats Deletes chat by id
 * @apiName Delete Chats
 * @apiGroup User
 *
 * @apiParam {String} chatid Id of the Sendbird Chat
 *
 * @apiSuccess {Array} Returns array of chats updated
 */
exports.deleteChats = function (req, res) {
    if (!req.headers) {
        return res.status(400).send();
    } else {
        passport.authenticate('jwt', {session: false});
        var token = getToken(req.headers);
        if (token) {
            var decoded = jwt.decode(token, 'secret');
            var query = {'email': decoded.email};
            var options = {new: true};
            if(req.body) {
                if(req.body.chatid) {
                    User.update( query, { $pullAll: {"chats": [req.body.chatid] } },
                        function(err, model) {
                            console.log(err);
                            if(!err) {
                                return res.status(200).json({success: true, chats: model.chats}).send();
                            }
                        }
                    );
                }
            }
        } else {
            res.status(403).send({success: false, msg: 'No token provided.'});
        }
    }
}

function GeneratePassword() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@£$%^&*()_+-=";
    for (var i = 0; i < 9; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

/**
 * @api {post} /user/forgotPassword Resets password and sends link to email
 * @apiName Forgot Password
 * @apiGroup User
 *
 * @apiParam {String} email Email of the user who forgot there password
 *
 * @apiSuccess {JSON} Returns Success Message
 */
exports.forgotPassword = function (req, res) {
    if (!req.body.email) {
        return res.status(400).send();
    } else {
        var password = GeneratePassword();
        User.findOne({'email': req.body.email}, function (err, user) {
            if (err) {
                res.status(400).json({success: false, msg: 'No account with that email address exists.'}).send();
            }
            if (!user) {
                res.status(400).json({success: false, msg: 'No account with that email address exists.'}).send();
            } else {
                user.password = password;
                bcryptjs.genSalt(10, function (err, salt) {
                    bcryptjs.hash(user.password, salt, function (err, hash) {
                        user.password = hash;
                        user.save(function (err) {
                            if (err) {
                                return res.json({
                                    success: false,
                                    msg: 'No account with that email address exists.'
                                }).send();
                            }
                            else {

                                var smtpTransport = nodemailer.createTransport({
                                    service: 'SendGrid',
                                    auth: {
                                        user: 'mlb-jaiten',
                                        pass: 'Steelhead@8'
                                    }
                                });


                                var mailOptions = {
                                    to: req.body.email,
                                    from: 'admin@mlb.com',
                                    subject: 'Password Reset Request',
                                    text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                                    'Please use the password below to log in:\n\n' +
                                    'Your new Password is: ' + password + '   ' + '\n\n'
                                    //'If you did not request this, please ignore this email and your password will remain unchanged.\n'
                                };
                                smtpTransport.sendMail(mailOptions, function (err) {
                                    res.status(200).json({success: true, msg: 'Email has been sent'}).send();
                                });
                            }

                        });
                    });
                });
            }
        });
    }
}

/**
 * @api {post} /user/changePassword Allows you to change your password
 * @apiName Change Password
 * @apiGroup User
 *
 * @apiParam {String} password New Password
 * @apiParam {String} req.headers Token in Header
 *
 * @apiSuccess {User} Returns User Object
 */
exports.changePassword = function (req, res) {
    if (!req.query) {
        return res.status(400).send();
    } else if (!req.query.password) {
        return res.status(400).send();
    } else {
        var password = req.query.password;
        passport.authenticate('jwt', {session: false});
        if (!req.headers) {
            return res.status(400).send();
        } else {
            var token = getToken(req.headers);
            if (token) {
                var decoded = jwt.decode(token, 'secret');
                if (decoded && decoded) {
                    User.findOne({
                        'email': decoded.email
                    }, function (err, user) {
                        if (err) {
                            return res.status(400).send();
                        }
                        if (!user) {
                            return res.status(403).send({
                                success: false,
                                msg: 'Authentication failed. User not found.'
                            }).send();
                        } else {
                            user.password = password;
                            bcryptjs.genSalt(10, function (err, salt) {
                                bcryptjs.hash(user.password, salt, function (err, hash) {
                                    user.password = hash;
                                    user.save(function (err, updateduser) {
                                        if (err) res.json({success: false, msg: 'Error while trying to save'}).send();
                                        User.findOne({'_id': updateduser}).populate('employee').exec(function (err, us) {
                                            return res.status(200).json({success: true, user: us}).send();
                                        });

                                    });
                                });
                            });
                        }
                    });
                }
            } else {
                return res.status(403).send({success: false, msg: 'No token provided.'});
            }
        }
    }
}


//Helper Functions for Future


module.exports.getUserByUsername = function(username, callback){
    var query = {username: username};
    User.findOne(query, callback);
}

module.exports.getUserById = function(id, callback){
    User.findById(id, callback);
}

module.exports.comparePassword = function(candidatePassword, hash, callback){
    bcrypt.compare(candidatePassword, hash, function(err, isMatch) {
        if(err) {
          console.log("\n\n\n\n\n  ERROR THROWN FROM comparePassword \n\n\n\n\n ");
        }
        callback(null, isMatch);
    });
}

module.exports.getUserByEmail = function(email, callback) {
    var query = {email: email};
    User.findOne(query, callback);

}



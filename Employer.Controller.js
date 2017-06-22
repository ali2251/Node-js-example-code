var request = require('request');
var async = require('async');
var User = require('../models/User');

/**
 * @api {get} /user/getEmployerByID Gets Employer by ID
 * @apiName Get Employer by ID
 * @apiGroup User
 *
 * @apiParam {String} req.id ID of Employer
 *
 * @apiSuccess {Employer} Returns Employer Object
 */
exports.getEmployerByID = function (req, res) {
    if (req.body) {
        if(req.body.id) {
            User.findOne({'employer': req.body.id})
                .exec(function (err, employer) {
                    if (err) {
                        return res.json({success: false, msg: 'Cannot find employer'}).send();
                    }
                    if (employer) {
                        return res.json({success: true, employer: employer}).send();

                    } else {
                        return res.json({success: false, msg: 'Cannot find employer'}).send();
                    }

                });
        } else {
            return res.status(400).json({success: false, msg: 'Check body'}).send();
        }
    }
}

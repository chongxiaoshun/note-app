/**
 * must read for Passport configuration:
 * 1. Three pieces need to be configured to use Passport for authentication: a. Authentication strategies
 *    b. Application middleware. c. Sessions (optional)
 * 2. Strategies: Before asking Passport to authenticate a request, the strategy (or strategies) used by
 *    an application must be configured. Strategies, and their configuration, are supplied via the use()
 *    function.
 * 3. Verify Callback: Strategies require what is known as a verify callback. The purpose of a verify
 *    callback is to find the user that possesses a set of credentials.
 * 4. Middleware: In a Connect or Express-based application, passport.initialize() middleware is required
 *    to initialize Passport. If your application uses persistent login sessions, passport.session()
 *    middleware must also be used.
 * 5. Sessions: In a typical web application, the credentials used to authenticate a user will only be
 *    transmitted during the login request. If authentication succeeds, a session will be established and
 *    maintained via a cookie set in the user's browser.
 *
 *    Each subsequent request will not contain credentials, but rather the unique cookie that identifies
 *    the session. In order to support login sessions, Passport will serialize and deserialize user instances
 *    to and from the session.
 *
 *    passport.serializeUser(function(user, done) {
 *       done(null, user.id);
 *     });

 *     passport.deserializeUser(function(id, done) {
 *       User.findById(id, function(err, user) {
 *           done(err, user);
 *       });
 *     });

 *    In this example, only the user ID is serialized to the session, keeping the amount of data stored within
 *    the session small. When subsequent requests are received, this ID is used to find the user, which will be restored
 *    to req.user.
 */

import path from 'path';
import util from 'util';
import {default as express} from 'express';
import {default as passport} from 'passport';
import {default as passportLocal} from 'passport-local';
const LocalStrategy = passportLocal.Strategy;
import * as usersModel from '../models/superagent.mjs';
import {sessionCookieName} from '../app.mjs';

export const router = express.Router();

import DBG from 'debug';
const debug = DBG('notes:router-users');
const error = DBG('notes:error-users');

/**
 * 1. initPassport() ?????? app.mjs ?????????????????????????????? app.mjs ?????? Passport ?????????
 * 2. passport ?????? sessions ?????? HTTP ?????????????????????????????????????????????????????????????????????
 * ??? request ???????????? user ?????????
 * @param app
 */
export function initPassport(app) {
    app.use(passport.initialize());
    app.use(passport.session());
}

/**
 * ensureAuthenticated() ??????????????? req.user ??????????????? Passport ???????????????????????????
 * ???????????????????????? next() ????????????????????????
 * ensureAuthenticated() ??????????????????????????????????????? Router ????????????????????????
 * @param req
 * @param res
 * @param next
 */
export function ensureAuthenticated(req, res, next) {
    try {
        //req.user is set by passport in the deserialize function
        if (req.user) next();
        else res.redirect('/users/login');
    } catch(e) {next(e);}
}

router.get('/login', function(req, res, next) {
    try {
        res.render('login', {title: "Login to Notes", user: req.user});
    } catch(e) {next(e);}
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/', //success: go to home page
    failureRedirect: 'login', //Fall: go to /user/login
}));

/**
 * Passport ???????????????????????? req.session.destroy() ??????????????????????????????????????????????????????
 * ???????????????????????? req.logout() ???????????????????????? ??????????????? seession ??????????????????????????????????????? cookie ????????????
 */
router.get('/logout', function(req, res, next) {
    try {
        req.session.destroy();
        req.logout();
        res.clearCookie(sessionCookieName);
        res.redirect('/');
    } catch(e) {next(e);}
});

passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            let check = await usersModel.userPasswordCheck(username, password);
            if (check.check) {
                done(null, {id: check.username, username: check.username});
            } else {
                done(null, false, check.message);
            }
            //server exception, done() first argument is error.
        } catch(e) {done(e);}
    }
));

/**
 * serializeUser() and deserializeUser() take care of encoding and decoding authentication data for
 * the session. serializeUser() attach username to the session.
 * deserializeUser() is called while processing an incoming HTTP request and is where we look
 * up the user profile data.
 * req.user is set in passport.deserializeUser() function.
 */
passport.serializeUser(function(user, done) {
    try {
        done(null, user.username);
    } catch(e) {done(e);}
});

passport.deserializeUser(async (username, done) => {
    try {
        let user = await usersModel.find(username);
        done(null, user);
    } catch(e) {done(e);}
});




























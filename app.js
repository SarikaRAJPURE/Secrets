//jshint esversion:6
const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();
//const encrypt = require('mongoose-encryption');
//1.1authenticate user using passport and session
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();
const port = 3000;

app.set('view engine', 'ejs')
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
//1.2.setup session
app.use(session({
    secret: process.env.SOME_LONG_UNGUESSABLE_STRING,
    resave: false,
    saveUninitialized: false
}));

//1.3.setup passport
app.use(passport.initialize());
//1.4.use session
app.use(passport.session());

//console.log(process.env.DBUSERNAME);
mongoose.connect(
    `mongodb+srv://${process.env.DBUSERNAME}:${process.env.DBPASSWORD}@cluster0.cfmpdcj.mongodb.net/SecretsDB?retryWrites=true&w=majority`
    , {
        useNewUrlParser: true
    });

// new user db
//1. creatte userschema
var userSchema = new mongoose.Schema({
    username: String ,
    password: String,
    googleId:String,
    secret:String
}, { timestamps: true });




//2. Add any other plugins or middleware here. For example, middleware for hashing passwords
var secret = process.env.SOME_LONG_UNGUESSABLE_STRING;
console.log(secret);
//userSchema.plugin(encrypt, { secret: secret, encryptedFields: ['password'] });

//1.5 set userschema to use passportlocalmongoose plugin
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

//3. create User model using user schema
var User = new mongoose.model("User", userSchema);

//1.6 create local login strateggy to authenticate user using their username and password
passport.use(User.createStrategy());

/* passport.serializeUser(function (user,done) {
    done(null,user.id);
});
passport.deserializeUser(function (id,done) {
User.findById();
res.send
});//crumbles cookie and reveals the user */
//creates cookie containing identification of user

passport.serializeUser(function(user, cb) {
    console.log("creating cookie");
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
    console.log("cookie created");
  });
  
  
  //crumbles cookie and reveals the user 
  passport.deserializeUser(function(user, cb) {
    console.log("crumble cookie to get user info from db");
    process.nextTick(function() {
      return cb(null, user);
    });
    console.log("crumbled cookie revealed the user");
  });
 
passport.use(new GoogleStrategy({
    
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log("authenticating with google strategy");
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/', (req, res) => {
    res.render("home");
});
//initiate authentication on google server asking them for users profile once they have logged in
//using passport authenticate our user using google strategy and it also popup signing user with goole account
app.get('/auth/google', passport.authenticate('google',{ scope: ["profile"] }));

//once user is logged in google will redirect user to back to our website at this path
  //add this route to authenticate them locally on our website 
  //in order to store their login session using session and cookies
app.get("/auth/google/secrets",passport.authenticate('google',{ failureRedirect:"/login"}),
  function(req, res) {
    console.log("user is getting authenticated at local website redirecting to secrets");
    //res.send("authenticated");
    // Successful authentication, redirect serets.
    res.redirect("/secrets");
  }); 

app.get("/login", (req, res) => {
    console.log("inside login page");
    res.render("login");
});

app.get('/register', (req, res) => {
    console.log("inside register page");
    res.render("register");
});

app.get("/secrets", async (req, res) => {
    console.log("here in secrets code");
    /* if (req.isAuthenticated()) {
        //res.send("take to secrets");
        console.log("taking to secrets....");
        res.render("secrets");
    } else {
        res.redirect("/login");
    } */
    //look through all of the users collections look for secret field which is not null
    try {
      const foundUsers = await User.find({"secret": {$ne:null} });
      res.render("secrets",{userwithSecrets:foundUsers});
    } catch (error) {
        console.log(error);
    }    
});

app.get('/submit', (req, res) => {
    console.log("here in submit code");
    if (req.isAuthenticated()) {
        //res.send("take to secrets");
        console.log("taking to submit code....");
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});
app.post('/submit', async(req, res) => {
    const submittedSecret = req.body.secret; 
    console.log(submittedSecret);
    console.log(req.user);
    try {
        const foundUser= await User.findById(req.user.id);
        if(!foundUser){
            foundUser.secret="";
        }else{

            foundUser.secret=submittedSecret;
            foundUser.save();
            res.redirect("/secrets");
        }
    } catch (error) {
        console.log(error);
    }
});
/* app.post('/register', (req, res) => {
    try {
        const newUser = new User({
            email: req.body.username,
            password: req.body.password
        });
        newUser.save();
        res.render("secrets")
    } catch {
        console.error();
    }
});
app.post('/login', async(req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;
        console.log(password);
        const foundUser = await User.findOne({email:username});
        
        if (foundUser) {
            console.log("foundUser:" + foundUser);
            if (foundUser.password === password) {
                console.log("foundUser.password:" + foundUser.password);
                res.render("secrets");
            }else {
               // console.log("foundUser.password:" + foundUser.password);
                //console.log("foundUser.email:" + foundUser.email);
                //res.render("login",{Errmessage:"Please enter correct password"});
                console.log("Please enter correct password");
            }
        }
        else {
           
             res.render("register");// ,{Errmessage:"Please enter correct password"} 
             console.log("User doesnt exists please register");
         }
    
    }

catch {

    console.error();
}
}); */

app.post('/register', async (req, res) => {
    try {
        //use register method to create a new user using passportLocalMongoose
        User.register({ username: req.body.username },
            req.body.password,
            function (err, user) {
                if (err) {
                    console.log("hi");
                    console.log(err);
                    res.redirect("/register");
                } else {
                    console.log("hello");
                    passport.authenticate("local")(req, res, function () {
                        res.redirect("/secrets");
                    });
                        }
            });
    } catch (error) {
        console.log(error);
    }
});

app.post('/login', async (req, res) => {

    const user = new User({
        username:req.body.username,
        password:req.body.password
    });
    //use the passport login function to form login session.
    req.logIn(user,function(err){
        if(err){
            console.log(err); 
        }else{
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    }) 
});

app.get('/logout', (req, res,next) => {
   // req.logOut();
    req.logout(
        function(err) {
        if (err) { return next(err); }
        res.redirect("/");
      });
    //res.redirect("home");
});

//http://localhost:3000/auth/google/secrets
app.listen(port, () => {
    console.log("Server started on port 3000");
});